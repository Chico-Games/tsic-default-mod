// Asserts a focused range input receives L/R nudges from gamepad Navigate.

const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('[pageerror]', e.message));

    await page.goto('http://localhost:8765/screens/playground.html#settings', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        return f && f.contentWindow && f.contentWindow.tsic && f.contentWindow.tsic.focus;
    }, { timeout: 5000 });
    await page.click('.pg-tab[data-pane="pg-input-pane"]');
    await page.click('.pg-input-mode-bar .pg-btn');
    await page.waitForTimeout(200);

    // Find a range input and force focus there.
    const sliderInfo = await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const slider = f.contentDocument.querySelector('input[type=range]');
        if (!slider) return null;
        f.contentWindow.tsic.focus.focus(slider, { trust: true });
        return { value: Number(slider.value), step: Number(slider.step) || 1, id: slider.id };
    });

    if (!sliderInfo) {
        console.log('FAIL — no slider found in settings fixture');
        await browser.close();
        process.exit(1);
    }
    console.log('Focused slider:', sliderInfo);

    async function clickDir(label) {
        const btn = await page.evaluateHandle((needle) => {
            return Array.from(document.querySelectorAll('.pg-input-grid .pg-btn'))
                .find(b => b.textContent.trim() === needle);
        }, label);
        await btn.asElement().click();
        await page.waitForTimeout(80);
    }
    await clickDir('Right');
    const afterRight = await page.evaluate(() => {
        const slider = document.getElementById('pg-iframe').contentDocument.querySelector('input[type=range]');
        return slider ? Number(slider.value) : null;
    });
    console.log('After Right:', afterRight, '(expected', sliderInfo.value + sliderInfo.step, ')');
    await clickDir('Left');
    const afterLeft = await page.evaluate(() => {
        const slider = document.getElementById('pg-iframe').contentDocument.querySelector('input[type=range]');
        return slider ? Number(slider.value) : null;
    });
    console.log('After Left:', afterLeft, '(expected', sliderInfo.value, ')');

    const ok = afterRight === sliderInfo.value + sliderInfo.step && afterLeft === sliderInfo.value;
    console.log(ok ? 'PASS — slider responds to gamepad L/R' : 'FAIL');
    await browser.close();
    process.exit(ok ? 0 : 1);
})();
