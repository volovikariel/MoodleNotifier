const {USERNAME, PASSWORD} = require('dotenv').config().parsed;
const puppeteer = require('puppeteer');
const MYCONCORDIA_URL = 'https://myconcordia.ca';
const fs = require('fs');
const notifier = require('node-notifier');
const { app, Menu, MenuItem, Tray }  = require('electron');


const VIEWPORT = {width: 1920, height: 1080};

(async () => {
    //const browser = await puppeteer.launch({headless: false});
    const browser = await puppeteer.launch();
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
    await page.waitForSelector(accessMoodleSelector);

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

    for(let i = 0; i < coursePages.length; i++) {
        pages[i] || pages.push(await browser.newPage());
        pages[i].setDefaultNavigationTimeout(0); 
        await pages[i].goto(coursePages[i]);
        await pages[i].waitForSelector('body');
        await pages[i].waitForTimeout(500);
        await pages[i].setViewport(VIEWPORT);
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
        arrData.forEach(data => {
            if(data.added_files.length != 0 || data.deleted_files.length != 0) {
                // Filter out unwanted
                let temp = menu.items.filter((item) => { return item.label != 'No changes recorded!' && item.label != 'Clear all notifications.' });
                menu = new Menu();
                menu.items = [...temp];

                let addedFilesMessage = '';
                let deletedFilesMessage = '';
                if(data.added_files.length != 0) {
                    addedFilesMessage = 'Added files:' +  '\n';
                    data.added_files.forEach(file => {
                        file.forEach(el => {
                            let temp = '';
                            temp += el.pageName + '\n';
                            temp += el.sectionName + '\n';
                            temp += el.fileName + '\n';
                            temp += el.link + '\n\n\n';
                            addedFilesMessage += temp;
                            menu.append(new MenuItem({ label: `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\nAdded:${temp}\n`, async click() {
                                const { shell } = require('electron');
                                await shell.openExternal(el.link);
                            }}));
                        })
                    });
                }
                if(data.deleted_files.length != 0) {
                    deletedFilesMessage = 'Deleted files:' + '\n';
                    data.deleted_files.forEach(file => {
                        file.forEach(el => {
                            let temp = '';
                            temp += el.pageName + '\n';
                            temp += el.sectionName + '\n';
                            temp += el.fileName + '\n';
                            temp += el.link + '\n\n\n';
                            deletedFilesMessage += temp;
                            menu.append(new MenuItem({ label: `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\nDeleted:${temp}\n`, async click() {
                                const { shell } = require('electron');
                                await shell.openExternal(el.link);
                            }}));
                        })
                    })
                }

                notifier.notify({
                    title:  `${data.deleted_files.length} files removed. ${data.added_files.length} files added.`,
                    message: '\n' + new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString() + '\n' + addedFilesMessage + '\n' + deletedFilesMessage,
                    wait: true
                });

                menu.append(new MenuItem({ label: 'Clear all notifications.', click() {
                    menu = new Menu();
                    menu.append(new MenuItem({ label: 'No changes recorded!' }))
                    tray.setContextMenu(menu);
                }}))

                tray.setContextMenu(menu);

                logChanges(data);
            }
        })
        // If it only contains the loading up MenuItem, swap it out for 'No changes recorded!'
        if(menu.items[0].label === 'Loading up!') {
            menu = new Menu();
            menu.append(new MenuItem({ label: 'No changes recorded!' }))
            tray.setContextMenu(menu);
        }
    }

    function logChanges(data) {
        fs.appendFile('data.txt', `${new Date()}:\n${JSON.stringify(data)}\n\n`, (err) => {
            if(err) console.log(err);
        });
    }
})()

// Declare here because of garbage collection
let tray = null;
let menu = new Menu();
app.whenReady().then(() => {
    tray = new Tray('./aww.png');
    menu.append(new MenuItem({ label: 'Loading up!' }));
    tray.setContextMenu(menu);
})

// TODO: Make it so the user can enter their user and pass. How do I store it, plain text???

// Detailed fetchData [ Pages[ Sections(s1, s2, [links] ) ] ]
//let data = await Promise.all(pages.map(async (page) => {
//    let page_data = await page.evaluate(() => {
//        const page_attributes = { pageHeader: document.querySelector('div#page header .page-header-headings').innerText };
//        return ([...document.querySelectorAll('div[class=content]')].map(section => ({
//                // Page header stays constant for the page
//                pageHeader: page_attributes.pageHeader,
//                // Section name, changes every section
//                sectionName: section.querySelector('h3.sectionname').innerText,
//                // Links, changes every file
//                links: [...section.querySelectorAll('ul.section li [href]')].map(aalink => aalink.href)
//        })));
//    });
//    return page_data;
//}));
//return data;
//
//
//function getFilePath(url) {
//    let filePath = document.querySelector(`a[href="${url}"]`);
//    return filePath;
//}

//function getFileInfo(filePath) {
//    let pageName = filePath.closest('div#page').querySelector('header .page-header-headings').innerText;
//    let sectionName = filePath.closest('div[class=content]').querySelector('h3').innerText;
//    let fileName = filePath.querySelector('span.instancename').innerText;
//    return ({
//        pageName: pageName,
//        sectionName: sectionName,
//        fileName: fileName
//    });
//}
//

