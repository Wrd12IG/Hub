const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    
    await page.goto('http://localhost:9002/clients/1/stories/new', { waitUntil: 'networkidle' });
    
    console.log("Page loaded. Waiting a bit to catch late errors...");
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
  } catch (e) {
    console.log("Script error:", e);
  }
})();
