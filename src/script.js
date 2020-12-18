// Username and password for concordia loaded from a .env file
let { USERNAME, PASSWORD } = require('dotenv').config().parsed;
// Puppeteer to load and interact with a browser
const puppeteer = require('puppeteer');
// Interact with files on your system
const fs = require('fs');
// Native crossplatform notifications
//const notifier = require('node-notifier');
const { app, Tray, ipcMain, BrowserWindow, Menu, MenuItem, screen }  = require('electron');
const path = require('path')
// Handle automatic startup (crossplatform)
const AutoLaunch = require('auto-launch')

// Default VIEWPORT before electron loads up [it gets changes to fit the screen size later on]
let VIEWPORT = { width: 1920, height: 1080 }
// The width and height of the window are going to be 1/3 the size of the viewport
let RATIO_WINDOW_TO_SCREEN = 1/3;
// File constants
const MYCONCORDIA_URL = 'https://myconcordia.ca';
const FRONTEND_HTML_FILEPATH =  path.join(__dirname, '../Frontend/index.html');
const NOTIFICATIONLOG_FILEPATH =  path.join(__dirname, './files/notifications.txt');
const CURRENT_FILES_FILEPATH =  path.join(__dirname, './files/currentFiles.txt');
//const TRAYICON_DEFAULT_FILEPATH = '../Frontend/aww.png';
//const TRAYICON_NOTIFICATION_FILEPATH = '../../../Pictures/bunny_with_hat.jpg';
const TRAYICON_DEFAULT_FILEPATH = './aww.png';
const TRAYICON_NOTIFICATION_FILEPATH = './aww.png'
// Limit of states that the user can go back
const NOTIFICATION_LIMIT = 10;

for(let arg of process.argv) {
    if(arg.substring(0, 2) == '--') {
        process[arg.substring(2)] = true
    }
}

// Automatically launch the app, default set to false
let autoLaunching = new AutoLaunch({
    name: 'Moodle Notifier'
})

// Define browser globally so as to not have it be garbage collected
let browser = undefined;

function main() {
    // If the .env file is not yet set up - exit this function
    if(USERNAME == undefined || PASSWORD == undefined) return;
    (async () => {
        if(process.dev) {
            browser = await puppeteer.launch({ headless: false });
        }
        else {
            // Browser visible for easier debugging
            browser = await puppeteer.launch();
        }
        // Create a pages array, initially of size 1 [the default loaded one that comes with the browser]
        const pages = await browser.pages(); 
        const page = pages[0];
        await page.setViewport(VIEWPORT)
        await page.goto(MYCONCORDIA_URL);

        const USERNAME_SELECTOR = 'input[id=userid]'
        const PASSWORD_SELECTOR = 'input[id=pwd]'
        await page.waitForSelector(`${USERNAME_SELECTOR}, ${PASSWORD_SELECTOR}`);
        await page.evaluate((USERNAME, USERNAME_SELECTOR, PASSWORD, PASSWORD_SELECTOR) => {
            document.querySelector(USERNAME_SELECTOR).value = USERNAME;
            document.querySelector(PASSWORD_SELECTOR).value = PASSWORD;
        }, USERNAME, USERNAME_SELECTOR, PASSWORD, PASSWORD_SELECTOR);

        const SUBMIT_SELECTOR = 'input[type=submit]'
        await page.waitForSelector(SUBMIT_SELECTOR);
        await page.evaluate((SUBMIT_SELECTOR) => {
            document.querySelector(SUBMIT_SELECTOR).click();
        }, SUBMIT_SELECTOR);

        // Access moodle now that you're logged in
        const ACCESS_MOODLE_SELECTOR = 'div[id=CU_MOODLEINFODISP_Data] script:not([id]):not([src])';
        try {
            await page.waitForSelector(ACCESS_MOODLE_SELECTOR);
        }
        catch(err) {
            // Invalid login, show login form
            if(err instanceof Error) {
                window.webContents.send('toggleHidden')
                showWindow()
                return;
            }
        }
        // Getting link for moodle
        const PATH_TO_MOODLE_COURSES = await page.evaluate((ACCESS_MOODLE_SELECTOR) => {
            let MOODLE_LINK_REGEX = new RegExp(/https:\/\/moodle.concordia.ca\/moodle\/course_gadget_portal.php?[^"]*/);
            const SCRIPT_TAG = document.querySelectorAll(ACCESS_MOODLE_SELECTOR)[1]; // There are two script tags, the second one contains the URL to moodle
            const MOODLE_URL = SCRIPT_TAG.innerText.match(MOODLE_LINK_REGEX)[0];
            return MOODLE_URL;
        }, ACCESS_MOODLE_SELECTOR)
        await page.goto(PATH_TO_MOODLE_COURSES)


        let COURSE_PAGES = await page.evaluate(() => {
            let pages = [...document.querySelectorAll('li a[href]')].map((element) => {
                return element.href;
            });
            return pages;
        });

        try {
            await loadPages(pages, COURSE_PAGES);
        }
        catch (err) {
            if(err instanceof Error) {
                // TODO: Make it automatically fix itself
                window.webContents.send('alert', 'Error loading course pages! Please restart~')
            }
        }

        async function loadPages(pages, coursePages){
            for(let i = 0; i < coursePages.length; i++) {
                pages[i] || pages.push(await browser.newPage());
                // Don't need to download the images, stylesheets or media
                await pages[i].setRequestInterception(true)
                pages[i].on('request', (request) => {
                  if (request.resourceType() === 'image' || request.resourceType() === 'stylesheet' || request.resourceType() === 'media') {
                      request.abort()
                  }
                  else {
                      request.continue()
                  }
                })
                // Increase timeout limit to 60'000ms from the 30'000ms default
                await pages[i].goto(coursePages[i], {timeout: 60000, waitUntil: 'domcontentloaded'});
                await pages[i].setViewport(VIEWPORT);
            }
        }

        // If the PC was asleep and just woke up, reload all of the pages, check every 30 seconds
        let lastTime = (new Date()).getTime()
        const FIVE_MINUTES = 5 * 60 * 1000
        setInterval(() => {
            let currentTime = (new Date()).getTime();
            if(currentTime > (lastTime + FIVE_MINUTES)) {
                pages.forEach(async page => await page.reload())
                console.info(`Was asleep for ${(lastTime - currentTime) / 1000} seconds`);
            }
            lastTime = currentTime;
        }, 30 * 1000)

        const ONE_MIN = 1000 * 60;

        // Run once without a delay and then run it every minute
        await fetchCompareRefresh();
        setTimeout(loopFetch, ONE_MIN);

        async function loopFetch() {
            await fetchCompareRefresh();
            setTimeout(loopFetch, ONE_MIN); 
        }

        async function fetchCompareRefresh() {
            let newFiles = await fetchFiles();
            let currentFiles = readDataInFile();
            if(currentFiles == undefined) {
                saveDataInFile(newFiles);
                return;
            }
            printData(compareData(currentFiles, newFiles)); 
            saveDataInFile(newFiles);
            await refreshPages(pages);
        }

        function readDataInFile() {
            try {
                let data = fs.readFileSync(CURRENT_FILES_FILEPATH, "utf8");
                return JSON.parse(data);
            } 
            catch (err) {
                // File does not exist
                if(err.code === "ENOENT") {
                    console.error(`FILE '${CURRENT_FILES_FILEPATH}' NOT FOUND`);
                    return undefined;
                }
                console.error(`Some other error occured when trying to read ${CURRENT_FILES_FILEPATH}`);
            }
        }

        function saveDataInFile(data) {
            fs.writeFileSync(CURRENT_FILES_FILEPATH, `${JSON.stringify(data)}\n\n`);
        }

        async function refreshPages(pages) {
            pages.forEach(async (page) => {
                await page.reload()
                await page.waitForSelector('body', { waitUntil: 'domcontentloaded'});
            })
        }

        async function fetchFiles() {
            let data = await Promise.all(pages.map(async (page) => {
                let files = await page.evaluate(() => {
                    return [...document.querySelectorAll(`a.aalink[href]`)].map(el => ({
                        fileName: el.querySelector('span.instancename').innerText,
                        link: el.href,
                        pageName: el.closest('div#page').querySelector('header .page-header-headings').innerText,
                        sectionName: el.closest('div[class=content]').querySelector('h3').innerText,
                    }));
                });
                return files;
            }));
            return data;
        }

        function getArrayDifference(arr1, arr2) {
            let additions = arr2.filter(x => !arr1.includes(x));
            let deleletions = arr1.filter(x => !arr2.includes(x));
            return { addition_urls: additions, deletion_urls: deleletions};
        }

        function compareData(currentFilesPages, newFilePages) {
            let response = [];
            for(let i = 0; i < pages.length; i++) {
                let currentLinks = currentFilesPages[i].map(file => file.link);
                let newLinks = newFilePages[i].map(file => file.link);
                let { addition_urls, deletion_urls } = getArrayDifference(currentLinks, newLinks);

                let added_files = getFileObject(addition_urls, newFilePages);
                let deleted_files = getFileObject(deletion_urls, currentFilesPages);
                response.push({ added_files: added_files, deleted_files: deleted_files });
            }

            return response;
        }
        function getFileObject(arrFileURLs, arrPages) {
            let response = [];
            arrFileURLs.forEach((fileUrl) => {
                arrPages.forEach((page) => {
                    let rep = page.filter((file) => {
                        return file.link == fileUrl;
                    })
                    if(rep.length != 0) response.push(rep);
                });
            })
            return response;
        }

        function printData(arrData) {
            let displayData = []
            arrData.forEach(data => {
                if(data.added_files.length != 0 || data.deleted_files.length != 0) {
                    if(data.added_files.length != 0) {
                        data.added_files.forEach(file => {
                            file.forEach(el => {
                                displayData.push({
                                    change: 'ADDED',
                                    pageName: el.pageName,
                                    sectionName: el.sectionName,
                                    fileName: el.fileName,
                                    date: `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
                                    link: el.link
                                })
                            })
                        });
                    }
                    if(data.deleted_files.length != 0) {
                        data.deleted_files.forEach(file => {
                            file.forEach(el => {
                                displayData.push({
                                    change: 'DELETED',
                                    pageName: el.pageName,
                                    sectionName: el.sectionName,
                                    fileName: el.fileName,
                                    date: `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
                                    link: el.link
                                })
                            })
                        })
                    }

                    window.webContents.send('display-data', { notifications: displayData, append: true })
                    saveState(displayData)

                    logChanges(data);
                }
            })
        }

        function logChanges(data) {
            fs.appendFile('data.txt', `${new Date()}:\n${JSON.stringify(data)}\n\n`, (err) => {
                if(err) console.error(err);
            });
        }
    })()
}

// Call main
main()

// Declare here because of garbage collection
let tray = null;
let window = null;
const menu = new Menu()
app.on("ready", () => {
    createTray()
    createWindow()
    window.webContents.once('dom-ready', () => {
        // If there isn't a username or a password
        if(USERNAME == undefined || PASSWORD == undefined) {
            // Makes it visible
            window.webContents.send('toggleHidden')
            toggleWindow()
        }
        // If the last state was "empty notifications", don't bother calling display-data
        if(numOfLinesInFile(NOTIFICATIONLOG_FILEPATH) > 0) {
            window.webContents.send('display-data', { notifications: JSON.parse(getLastState()), append: true })
        }
    })

    menu.append(new MenuItem({
        label: 'Undo',
        accelerator: 'CommandOrControl+Z',
        click: () => { 
            // Delete the last state and go back
            deleteLastState()
            // Go back to last state
            if(numOfLinesInFile(NOTIFICATIONLOG_FILEPATH) > 0) {
                window.webContents.send('display-data', { notifications: JSON.parse(getLastState()), append: false })
            }
        }
    }))

    Menu.setApplicationMenu(menu)
})

function createTray() {
    tray = new Tray(TRAYICON_DEFAULT_FILEPATH)
    tray.on('right-click', showWindow)
    tray.on('double-click', showWindow)
    tray.on('click', showWindow);
}

function toggleWindow() {
    if(window.isVisible()) {
        window.hide()
    }
    else {
        showWindow()
    }
}

function createWindow() {
    // Get width and height of the user's viewport
    VIEWPORT = { width: screen.getPrimaryDisplay().size.width, height: screen.getPrimaryDisplay().size.height }
    window = new BrowserWindow({
        width: VIEWPORT.width * RATIO_WINDOW_TO_SCREEN,
        height: VIEWPORT.height * RATIO_WINDOW_TO_SCREEN,
        show: false,
        frame: false,
        autoHideMenuBar: true,
        fullscreenable: false,
        resizable: false,
        webPreferences: {
            backgroundThrottling: false,
            nodeIntegration: true
        }
    })
    window.loadURL(`file://${FRONTEND_HTML_FILEPATH}`)

    if(process.dev) {
        window.webContents.toggleDevTools()
    }

    window.on("blur", () => {
        window.hide()
    })
}

function showWindow() {
    /**
     * Set the position to be the bottom right - to do this, make it be a 'window' away in both height and width from the bottom right corner.
     * We do 1 - RATIO_WINDOW_TO_SCREEN to get the % width and height given the VIEWPORT's size. We floor it because window.setPosition requires integers
     **/
    // TODO: For MacOS and Windows, can maybe use tray.getBounds() https://github.com/electron/electron/blob/master/docs/api/tray.md#traygetbounds-macos-windows
    const position = { x: Math.floor(VIEWPORT.width * (1 - RATIO_WINDOW_TO_SCREEN)), y: Math.floor(VIEWPORT.height * (1 - RATIO_WINDOW_TO_SCREEN)) };
    window.setPosition(position.x, position.y, true)
    window.show()
    window.focus()
}

ipcMain.on("log", (event, args) => {
    console.info("FROM RENDERER: " + args);
});

ipcMain.on("setLoginInfo", (event, args) => {
    // If it's an empty input, ignore it
    if(args.username === '' || args.password === '') return;
    USERNAME = args.username
    PASSWORD = args.password
    fs.writeFileSync(".env", `USERNAME='${USERNAME}'\nPASSWORD='${PASSWORD}'`, (err) => {
        if(err) {
            console.error(err)
        }
        else {
            // Done logging in, hide the window
            window.hide()
            window.webContents.send('toggleHidden')
            if(browser) {
                browser.close() 
            }
            main()
        }
    })
});

ipcMain.on('saveState', (event, state) => {
    saveState(state)
})

function saveState(state) {
    let numLines = numOfLinesInFile(NOTIFICATIONLOG_FILEPATH)
    // Append to end of file if we haven't reached the NOTIFICATION_LIMIT
    if(numLines < NOTIFICATION_LIMIT) {
        // If the file is just an empty line, don't add a \n
        fs.appendFileSync(NOTIFICATIONLOG_FILEPATH, `${(numLines === 0 && getFirstState() === '') ? '' : '\n'}${JSON.stringify(state)}`, (err) => {
            if(err) console.error(err);
        })
    }
    // Remove the first line and append the latest notification instead if we've reached the NOTIFICATION_LIMIT
    else if(numLines >= NOTIFICATION_LIMIT){
        let updatedFile = fs.readFileSync(NOTIFICATIONLOG_FILEPATH)
            .toString()
            .split('\n')
        console.log(updatedFile)
        if(updatedFile[updatedFile.length - 1] === '') {
            updatedFile.splice(updatedFile.length - 1, 1)
        }
        updatedFile = updatedFile.shift()
        updatedFile = `${updatedFile.join('\n')}\n${JSON.stringify(state)}`

        fs.writeFileSync(NOTIFICATIONLOG_FILEPATH, updatedFile, (err) => {
            if(err) console.error(err);
        })
    }
}

function numOfLinesInFile(fileName) {
    const stateFileArray = fs.readFileSync(fileName)
        .toString()
        .split('\n')
    if(stateFileArray[stateFileArray.length - 1] === '') {
        stateFileArray.splice(stateFileArray.length - 1, 1)
    }
    return stateFileArray.length
}

function getLastState() {
    let stateFileArray = fs.readFileSync(NOTIFICATIONLOG_FILEPATH)
        .toString()
        .split('\n')
    if(stateFileArray[stateFileArray.length - 1] === '') {
        stateFileArray.splice(stateFileArray.length - 1, 1)
    }
    if(stateFileArray.length > 0) {
        return stateFileArray[stateFileArray.length - 1]
    }
    else {
        return []
    }
}

function deleteLastState() {
    const stateFileArray = fs.readFileSync(NOTIFICATIONLOG_FILEPATH)
        .toString()
        .split('\n')
    stateFileArray.splice(stateFileArray.length - 1, 1)
    // If you have no more previous states saved, do nothing
    if(stateFileArray.length === 0) {
        return;
    }
    fs.writeFileSync(NOTIFICATIONLOG_FILEPATH, stateFileArray.join('\n'), (err) => {
        if(err) console.error(err)
    })
}

function getFirstState() {
    const stateFileArray = fs.readFileSync(NOTIFICATIONLOG_FILEPATH)
        .toString()
        .split('\n')
    return stateFileArray[0]
}

ipcMain.on('setTrayIcon', (event, args) => {
    console.log(`TrayiconDEFAULT: ${TRAYICON_DEFAULT_FILEPATH}, TrayiconNOTIF: ${TRAYICON_NOTIFICATION_FILEPATH}`)
    if(args === 'default') {
        tray.setImage(TRAYICON_DEFAULT_FILEPATH)
    }
    else if(args === 'notificationIcon') {
        tray.setImage(TRAYICON_NOTIFICATION_FILEPATH)
    }
})

ipcMain.on('setStartAtLogin', (event, args) => {
    if(args == true) {
        autoLaunching.enable()
    }
    else {
        autoLaunching.disable()
    }
})
