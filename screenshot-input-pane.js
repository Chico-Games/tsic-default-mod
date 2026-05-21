// Screenshots the playground side-pane in INPUT mode so we can eyeball the
// d-pad + virtual joystick layout.
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto('http://localhost:8765/screens/playground.html#map', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#pg-iframe', { timeout: 4000 });
    await page.click('.pg-tab[data-pane="pg-input-pane"]');
    await page.waitForSelector('.pg-joystick', { timeout: 4000 });
    // Drag knob a little so it's not centered in the screenshot.
    const box = await page.evaluate(() => {
        const j = document.querySelector('.pg-joystick');
        const r = j.getBoundingClientRect();
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width };
    });
    await page.mouse.move(box.cx, box.cy);
    await page.mouse.down();
    await page.mouse.move(box.cx + box.w * 0.32, box.cy - box.w * 0.22, { steps: 3 });
    await page.waitForTimeout(80);
    const pane = await page.$('#pg-input-pane');
    await pane.screenshot({ path: process.argv[2] || 'input-pane.png' });
    await page.mouse.up();
    await browser.close();
})();
