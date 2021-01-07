// Puppeteer to load and interact with a browser
const puppeteer = require('puppeteer');
// Interact with files on your system
const fs = require('fs');
const path = require('path');
// Utility functions
const FileUtil = require('./util/FileFunctions');
// Native crossplatform notifications
//const notifier = require('node-notifier');
const { app, Tray, ipcMain, BrowserWindow, Menu, MenuItem, screen, globalShortcut }  = require('electron');
// Handle automatic startup (crossplatform)
const AutoLaunch = require('auto-launch')
// Default VIEWPORT before electron loads up [it gets changes to fit the screen size later on]
let VIEWPORT = { width: 1920, height: 1080 }
const Constants = require('./util/Constants')

// Create the files [Constants.CURRENT_FILES_FILEPATH, Constants.ENV_FILEPATH, etc.] if they do not exist 
FileUtil.createFiles();

let { USERNAME, PASSWORD } = require('dotenv').config({ path: Constants.ENV_FILEPATH }).parsed;

// Makes a desktop icon on Windows [TODO: Check if that's really what it does]
if(require('electron-squirrel-startup')) return app.quit();

for(let arg of process.argv) {
    if(arg.substring(0, 2) == '--') {
        process[arg.substring(2)] = true
    }
}

// Automatically launch the app, default set to false
let autoLaunching = new AutoLaunch({
    name: 'moodle-notifier'
})

// Define browser globally so as to not have it be garbage collected
let browser = undefined;

function main() {
    // If the .env file is not yet set up - exit this function
    if(USERNAME === '' || PASSWORD === '') return;
    (async () => {
        // Make sure they have the correct revision of the browser (supposed to be bundled but may break)
        // If they don't - puppeteer won't work
        const browserFetcher = puppeteer.createBrowserFetcher();
        const revisionInfo = await browserFetcher.download('818858');
        browser = await puppeteer.launch({
            headless: (process.dev) ? false : true, // Browser visible for easier debugging
            devtools: (process.dev) ? true : false, // Automatically open Dev-Tools on each tab
            product: 'chrome',
            dumpio: (process.dev) ? true : false, // Log puppeteer in console
            executablePath: revisionInfo.executablePath
        });
        // Create a pages array, initially of size 1 [the default loaded one that comes with the browser]
        const pages = await browser.pages(); 
        const page = pages[0];
        await page.setViewport(VIEWPORT)
        await page.goto('https://myconcordia.ca');

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
                window.webContents.send('setLoginFormVisibility', { visible: true })
                window.show()
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
            let currentFiles = FileUtil.fileToJSON(Constants.CURRENT_FILES_FILEPATH);
            if(currentFiles === undefined) {
                FileUtil.overwriteFile(Constants.CURRENT_FILES_FILEPATH, newFiles);
                return;
            }
            printData(compareData(currentFiles, newFiles)); 
            FileUtil.overwriteFile(Constants.CURRENT_FILES_FILEPATH, newFiles);
            await refreshPages(pages);
        }

        async function refreshPages(pages) {
            pages.forEach(async page => {
                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.waitForSelector('body', { waitUntil: 'domcontentloaded'});
            })
        }

        async function fetchFiles() {
            let data = await Promise.all(pages.map(async page => {
                let files = await page.evaluate(() => {
                    return [...document.querySelectorAll('a.aalink[href]')].map(el => ({
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
                    FileUtil.saveNotificationState(displayData)

                    FileUtil.appendFile(Constants.DATALOG_FILEPATH, data);
                }
            })
        }

    })()
}

// Call main
main()

// Declare here because of garbage collection
let tray = null;
let window = null;
const menu = new Menu()
app.on('ready', () => {
    createTray()
    createWindow()
    window.webContents.once('dom-ready', () => {
        // If there isn't a username or a password
        if(USERNAME === '' || PASSWORD === '') {
            window.webContents.send('setLoginFormVisibility', { visible: true })
            window.show()
        }
        // If the last state was 'empty notifications', don't bother calling display-data
        if(FileUtil.numOfLinesInFile(Constants.NOTIFICATIONLOG_FILEPATH) > 0) {
            window.webContents.send('display-data', { notifications: JSON.parse(FileUtil.getLastLine(Constants.NOTIFICATIONLOG_FILEPATH)), append: true })
        }
    })

    menu.append(new MenuItem(
        {
            label: 'Undo',
            accelerator: 'CommandOrControl+Z',
            click: () => { 
                // Delete the last state and go back
                FileUtil.deleteLastLine(Constants.NOTIFICATIONLOG_FILEPATH)
                // Go back to last state
                if(FileUtil.numOfLinesInFile(Constants.NOTIFICATIONLOG_FILEPATH) > 0) {
                    window.webContents.send('display-data', { notifications: JSON.parse(FileUtil.getLastLine(Constants.NOTIFICATIONLOG_FILEPATH)), append: false })
                }
            }
        }
    ))

    Menu.setApplicationMenu(menu)
})

function createTray() {
    tray = new Tray(Constants.TRAYICON_DEFAULT_FILEPATH)
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Notifications', click: () => 
            {
                window.show()
            }
        },
        { label: 'Exit', click: () => { app.quit(); }}
    ])
    tray.setContextMenu(contextMenu)
}

function createWindow() {
    // Get width and height of the user's viewport
    VIEWPORT = { width: screen.getPrimaryDisplay().size.width, height: screen.getPrimaryDisplay().size.height }
    window = new BrowserWindow({
        width: VIEWPORT.width * Constants.RATIO_WINDOW_TO_SCREEN,
        height: VIEWPORT.height * Constants.RATIO_WINDOW_TO_SCREEN,
        show: false,
        frame: false,
        autoHideMenuBar: true,
        fullscreenable: false,
        resizable: false,
        alwaysOnTop: false,
        webPreferences: {
            nodeIntegration: true
        }
    })
    window.loadURL(`file://${Constants.FRONTEND_HTML_FILEPATH}`)

    if(process.dev) {
        window.webContents.toggleDevTools()
    }

    globalShortcut.register('CommandOrControl+Alt+W', () => {
        if(window.isVisible()) {
            window.hide()
        }
        else {
            window.show()
        }
    })
}

ipcMain.on('setTrayIcon', (event, args) => {
    if(args === 'defaultIcon') {
        tray.setImage(Constants.TRAYICON_DEFAULT_FILEPATH)
    }
    else if(args === 'notificationIcon') {
        tray.setImage(Constants.TRAYICON_NOTIFICATION_FILEPATH)
    }
})

ipcMain.on('setStartAtLogin', (event, args) => {
    if(args === true) {
        autoLaunching.enable()
    }
    else {
        autoLaunching.disable()
    }
})

ipcMain.on('setLoginInfo', (event, args) => {
    USERNAME = args.USERNAME
    PASSWORD = args.PASSWORD
    // Now that we have USERNAME and PASSWORD, launch main
    fs.writeFile(Constants.ENV_FILEPATH, `USERNAME='${USERNAME}'\nPASSWORD='${PASSWORD}'`, (err) => {
        if(err) {
            console.error(err)
        }
        else {
            // Done logging in, hide the window
            window.hide()
            window.webContents.send('setLoginFormVisibility', { visible: false })
            // If a browser was previously open - close it, the main function will create a new one
            if(browser) {
                browser.close() 
            }
        }
    })
    main()
});

ipcMain.on('saveState', (event, state) => {
    FileUtil.saveNotificationState(state)
})

ipcMain.on('log', (event, args) => {
    console.info(`FROM RENDERER: ${args}`);
});
