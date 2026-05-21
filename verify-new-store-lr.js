// Asserts L/R between Back and Create on new-store walks correctly.

const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://localhost:8765/screens/playground.html#new-store', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        return f && f.contentWindow && f.contentWindow.tsic && f.contentWindow.tsic.focus;
    }, { timeout: 5000 });
    await page.click('.pg-tab[data-pane="pg-input-pane"]');
    await page.click('.pg-input-mode-bar .pg-btn');
    await page.waitForTimeout(150);

    // Focus btn-back to start.
    await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        f.contentWindow.tsic.focus.focus('#btn-back');
    });
    await page.waitForTimeout(50);

    async function clickDir(label) {
        const btn = await page.evaluateHandle((needle) => {
            return Array.from(document.querySelectorAll('.pg-input-grid .pg-btn'))
                .find(b => b.textContent.trim() === needle);
        }, label);
        await btn.asElement().click();
        await page.waitForTimeout(80);
    }
    async function marker() {
        return await page.evaluate(() => {
            const f = document.getElementById('pg-iframe');
            const m = f.contentDocument.querySelector('[data-tsic-focused]');
            return m ? m.id : null;
        });
    }

    console.log('Start:', await marker());

    await clickDir('Right');
    const rightOf = await marker();
    console.log('Right from Back →', rightOf);

    await clickDir('Left');
    const leftOf = await marker();
    console.log('Left from previous →', leftOf);

    const ok = rightOf === 'btn-create' && leftOf === 'btn-back';
    console.log(ok ? 'PASS — Back↔Create walks correctly' : 'FAIL');
    await browser.close();
    process.exit(ok ? 0 : 1);
})();
