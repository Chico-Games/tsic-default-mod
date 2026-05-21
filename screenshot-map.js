// One-off screenshotter for the map screen in the playground.
// Captures the Default scenario with the gamepad crosshair on Ziggy so the
// hover chip and bounds outline are both visible.
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://localhost:8765/screens/playground.html#map', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        return f && f.contentDocument && f.contentDocument.getElementById('g-players')
            && f.contentDocument.getElementById('g-players').children.length > 0;
    }, null, { timeout: 8000 });
    // Reset to initial state, then toggle gamepad to show the crosshair + chip.
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('#pg-scenarios .pg-btn'))
            .find(b => b.textContent === 'Reset state');
        if (btn) btn.click();
    });
    await page.waitForTimeout(120);
    await page.click('.pg-tab[data-pane="pg-input-pane"]');
    await page.click('.pg-input-mode-bar .pg-btn');
    await page.waitForTimeout(150);
    // Screenshot just the iframe so the page chrome doesn't dominate.
    const iframeEl = await page.$('#pg-iframe');
    await iframeEl.screenshot({ path: process.argv[2] || 'map-screenshot.png' });
    await browser.close();
})();
