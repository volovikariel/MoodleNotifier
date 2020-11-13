const {USERNAME, PASSWORD} = require('dotenv').config().parsed;
const puppeteer = require('puppeteer');
const {setInterval} = require('timers');
const MYCONCORDIA_URL = 'https://myconcordia.ca';
const fs = require('fs');
const VIEWPORT = {width: 1920, height: 1080};

(async () => {
    //const browser = await puppeteer.launch({headless: false});
    const browser = await puppeteer.launch();
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



    const FIVE_MINUTES = 1000 * 60;
    let curr_data = '';
    setInterval(async () => {
        let new_data = await fetchData();
        if(curr_data == '') {
            curr_data = new_data;
            return;
        }

        await printData(new_data); // [requires more time than 30 seconds]
        await compareData(curr_data, new_data);
        curr_data = new_data;
        await refreshPages(pages);
    }, FIVE_MINUTES)

    async function refreshPages(pages) {
        pages.forEach(async (page) => {
            await page.reload({waitUntil: ["networkidle2", "domcontentloaded"]})
            await page.waitForSelector('body');
        })
    }
    async function fetchData() {
        let data = await Promise.all(pages.map(async (page) => {
            let page_data = await page.evaluate(() => {
                let title_and_link = [...document.querySelectorAll('div.course-content ul.weeks li[id^="section"] li.activity')].map((el) => {
                    let links = [...el.querySelectorAll('a[href]')].map(el => el.href);
                    return {title: el.innerText.replace(/[\n\r]/g, ' ').trim(), links: links}
                })
                return title_and_link;
            })
            return page_data;
        }))
        return data;
    }
    async function compareData(curr_data, new_data) {
        // TODO
    }

    async function printData(data) {
        // Delete file if it exists
        fs.unlink('data.txt', (err) => {
            if(err) throw err;
            console.log('deleted');
        })

        let pageNum = 1;
        let fileNum = 1;
        data.forEach((page) => {
            page.forEach((el) => {
                // Write data to file
                fs.appendFileSync('data.txt', `Page-instance: ${pageNum}-${fileNum++}: ${JSON.stringify(el)}\n`, (err) => {
                    if(err) throw err;
                    console.log(`Page-instance: ${pageNum}-${fileNum++}: ${JSON.stringify(el)}\n`);
                });

            })
            pageNum++;
            fileNum = 1; // Reset back so that it always starts at 1 for each page
        });
    }
})()
