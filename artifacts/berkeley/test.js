import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    // We will host it locally just via file protocol to see if it parses script.js
    const targetUrl = 'file:///' + process.cwd().replace(/\\/g, '/') + '/public/index.html';
    console.log('Loading:', targetUrl);
    
    await page.goto(targetUrl);
    await new Promise(r => setTimeout(r, 3000));
    await browser.close();
})();
