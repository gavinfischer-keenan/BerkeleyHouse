const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://localhost:5000');
    
    // State 0: Meteorological
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'artifacts/screenshot-state0.png' });
    
    // Skip to next state (Surf & Ocean)
    await page.evaluate(() => { transitionState(); });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'artifacts/screenshot-state1.png' });
    
    // Skip to next state (Waikiki)
    await page.evaluate(() => { transitionState(); });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'artifacts/screenshot-state2.png' });
    
    await browser.close();
})();
