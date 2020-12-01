let { USERNAME, PASSWORD } = require('dotenv').config().parsed;
const puppeteer = require('puppeteer');
const MYCONCORDIA_URL = 'https://myconcordia.ca';
const NOTIFICATION_FILE = 'notifications.txt';
const fs = require('fs');
//const notifier = require('node-notifier');
const { app, Tray, ipcMain, BrowserWindow, Menu, MenuItem }  = require('electron');
const path = require('path')


const VIEWPORT = {width: 1920, height: 1080};
let browser = undefined;

function main() {
    // If the .env file is not set up properly, exit the method.
    if(USERNAME == undefined || PASSWORD == undefined) return;
    (async () => {
        //browser = await puppeteer.launch({headless: false});
        browser = await puppeteer.launch();
        const pages = await browser.pages(); // Get the initial pages loaded [a single blank one]
        const page = pages[0];
        await page.setViewport(VIEWPORT)
        await page.goto(MYCONCORDIA_URL);

        const usernameSelector = 'input[id=userid]'
        const passwordSelector = 'input[id=pwd]'
        const submitSelector = 'input[type=submit]'
        await page.waitForSelector(usernameSelector);
        await page.waitForSelector(passwordSelector);
        await page.$eval(usernameSelector, (el, username) => {
            el.value = username;
        }, USERNAME);
        await page.$eval(passwordSelector, (el, password) => {
            el.value = password;
        }, PASSWORD);
        await page.waitForSelector(submitSelector);
        await page.$eval(submitSelector, (el) => {
            el.click();
        }, submitSelector);

        // Now logged in
        const accessMoodleSelector = 'div[id=CU_MOODLEINFODISP_Data] script:not([id]):not([src])';
        try {
            await page.waitForSelector(accessMoodleSelector);
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
        let PATH_TO_MOODLE_COURSES = await page.evaluate((accessMoodleSelector) => {
            let MOODLE_LINK_REGEX = new RegExp(/(https:\/\/moodle.concordia.ca\/moodle\/course_gadget_portal.php?[^"]*)/g);
            let temp = document.querySelectorAll(accessMoodleSelector)[1].innerText.match(MOODLE_LINK_REGEX)[0];
            return temp;
        }, accessMoodleSelector)
        await page.goto(PATH_TO_MOODLE_COURSES)


        let coursePages = await page.evaluate(() => {
            let pages = [...document.querySelectorAll('li a[href]')].map((element) => {
                return element.href;
            });
            return pages;
        });

        try {
            await loadPages(pages, coursePages);
        }
        catch (err) {
            if(err instanceof Error) {
                window.webContents.send('alert', 'Error loading course pages! Please restart~')
            }
        }

        async function loadPages(pages, coursePages){
            for(let i = 0; i < coursePages.length; i++) {
                pages[i] || pages.push(await browser.newPage());
                pages[i].setDefaultNavigationTimeout(0); 
                await pages[i].goto(coursePages[i]);
                await pages[i].waitForSelector('body');
                await pages[i].waitForTimeout(500);
                await pages[i].setViewport(VIEWPORT);
            }
        }


        const ONE_MIN = 1000 * 60;

        await fetchCompareRefresh(); // Run once
        setTimeout(loopFetch, ONE_MIN); // Then forever

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
                let data = fs.readFileSync("currentFiles.txt", "utf8");
                return JSON.parse(data);
            } 
            catch (err) {
                // File does not exist
                if(err.code === "ENOENT") {
                    console.error("FILE 'currentFiles.txt' NOT FOUND");
                    return undefined;
                }
                console.error("Some other error occured when trying to read currentFiles.txt");
            }
        }

        function saveDataInFile(data) {
            fs.writeFileSync("currentFiles.txt", `${JSON.stringify(data)}\n\n`);
        }

        async function refreshPages(pages) {
            pages.forEach(async (page) => {
                await page.reload()
                //await page.reload({waitUntil: ["networkidle2", "domcontentloaded"]})
                await page.waitForSelector('body');
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

                    window.webContents.send("display-data", displayData)
                    saveState(displayData)
                    // TODO: Change icon to show notification?

                    logChanges(data);
                }
            })
        }

        function logChanges(data) {
            fs.appendFile('data.txt', `${new Date()}:\n${JSON.stringify(data)}\n\n`, (err) => {
                if(err) console.log(err);
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
        if(numOfLinesInFile(NOTIFICATION_FILE) > 0) {
            window.webContents.send("display-data", JSON.parse(getLastState()))
        }
    })

    menu.append(new MenuItem({
        label: 'Undo',
        accelerator: 'CommandOrControl+Z',
        click: () => { 
            // Delete the last state and go back
            //console.log("BEOFRE:" + getLastState())
            deleteLastState()
            //console.log("AFTER:" + getLastState())
            // Go back to last state
            if(numOfLinesInFile(NOTIFICATION_FILE) > 0) {
                window.webContents.send("display-data", JSON.parse(getLastState()))
            }
        }
    }))

    Menu.setApplicationMenu(menu)
})

function createTray() {
  tray = new Tray(path.join(__dirname, './aww.png'))
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
  window = new BrowserWindow({
    width: 500,
    height: 600,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    fullscreenable: false,
    resizable: false,
    //transparent: false, // Lags out on scroll
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: true
    }
  })
  window.loadURL(`file://${path.join(__dirname, './index.html')}`)

    window.webContents.toggleDevTools()

  window.on("blur", () => {
    window.hide()
  })
}

function showWindow() {
  //const position = getWindowPosition()
  //window.setPosition(position.x, position.y, true)
  window.show()
  window.focus()
}

ipcMain.on("log", (event, args) => {
  console.log(args);
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

ipcMain.on("saveState", (event, state) => {
    saveState(state)
})

const NEWLINE_REGEX = /\r\n|\r|\n/g;
function saveState(state) {
    // Append to end of file if we haven't reached the 5 notification limit
    if(numOfLinesInFile(NOTIFICATION_FILE) < 5) {
        fs.appendFileSync(NOTIFICATION_FILE, `${state}`, (err) => {
            if(err) console.error(err);
        })
    }
    // Remove the first line and append the latest notification instead if we've reached the 5 notification limit
    else {
        let updatedFile = fs.readFileSync(NOTIFICATION_FILE).toString().split(NEWLINE_REGEX)
        updateFile = updatedFile.shift()
        if(updatedFile[updatedFile.length - 1] === '') {
            updatedFile.pop()
        }
        updatedFile = `${updatedFile.join("\n")}${state}`
        // If the state was empty [no notifications], add an extra new line character
        if(state === '\n') {
            updatedFile += '\n'
        }
        fs.writeFileSync(NOTIFICATION_FILE, updatedFile, (err) => {
            if(err) console.error(err);
        })
    }
}

function numOfLinesInFile(fileName) {
    const data = fs.readFileSync(path.join(__dirname, fileName)).toString().split(NEWLINE_REGEX)
    return (data.length - 1)
}

function getLastState() {
    let stateFileArray = fs.readFileSync(path.join(__dirname, NOTIFICATION_FILE)).toString().split(NEWLINE_REGEX)
    stateFileArray.pop()
    if(stateFileArray.length > 0) {
        return stateFileArray[stateFileArray.length - 1]
    }
    else {
        return []
    }
}

function deleteLastState() {
    const stateFile = fs.readFileSync(path.join(__dirname, NOTIFICATION_FILE)).toString().split(NEWLINE_REGEX)
    stateFile.splice(-1)
    fs.writeFileSync(NOTIFICATION_FILE, stateFile.join("\n"), (err) => {
        if(err) console.error(err)
    })
}
