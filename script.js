const {USERNAME, PASSWORD} = require('dotenv').config().parsed;
const puppeteer = require('puppeteer');
const {setInterval} = require('timers');
const MYCONCORDIA_URL = 'https://myconcordia.ca';
const fs = require('fs');
const VIEWPORT = {width: 1920, height: 1080};

(async () => {
    const browser = await puppeteer.launch({headless: false});
    //const browser = await puppeteer.launch();
    const pages = await browser.pages(); // Get the initial pages loaded [a single blank one]
    const page = pages[0];
    // Make it small for video recording so that they don't see my USERNAME/PASS
    await page.setViewport(VIEWPORT)
    //await page.setViewport({width:10, height:10}) // DEMO
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

    //await page.setViewport(VIEWPORT) // DEMO

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
        await pages[i].goto(coursePages[i]);
        await pages[i].waitForSelector('body');
        await pages[i].waitForTimeout(500);
        await pages[i].setViewport(VIEWPORT);
    }



    const ONE_MINUTE = 1000 * 60;
    let curr_data = '';
    setInterval(async () => {
        let new_data = await fetchData();
        if(curr_data == '') {
            curr_data = new_data;
            return;
        }

        await printData(new_data); // [requires more time than 30 seconds]
        //await compareData(curr_data, new_data);
        curr_data = new_data;
        await refreshPages(pages);
    }, ONE_MINUTE)

    async function refreshPages(pages) {
        pages.forEach(async (page) => {
            await page.reload({waitUntil: ["networkidle2", "domcontentloaded"]})
            await page.waitForSelector('body');
        })
    }

    async function fetchData() {
        let data = await Promise.all(pages.map(async (page) => {
            let page_data = await page.evaluate(() => {
                const page_attributes = { pageHeader: document.querySelector('div#page header .page-header-headings').innerText };
                return ([...document.querySelectorAll('div[class=content]')].map(section => ({
                        // Page header stays constant for the page
                        pageHeader: page_attributes.pageHeader,
                        // Section name, changes every section
                        sectionName: section.querySelector('h3.sectionname').innerText,
                        // Links, changes every file
                        links: [...section.querySelectorAll('ul.section li [href]')].map(aalink => aalink.href)
                })));
            });
            return page_data;
        }));
        return data;
    }

    async function compareData(curr_data, new_data) {
        // TODO
    }

    async function printData(data) {
        // Delete file if it exists
        fs.unlink('data.txt', (err) => {
            if(err) console.log('deleted data.txt');
        })

        data.forEach((page) => {
            fs.appendFile('data.txt', JSON.stringify(page), (err) => {
                if(err) console.log(err);
            });
        })
        console.log('Updated file!');
    }
})()
