// Drives the playground exactly like a user: open the page, toggle Gamepad
// mode by clicking the button in the host UI, then click the Down direction
// in the QUICK panel — which is what steals focus from the iframe. Verifies
// the iframe's focus actually moves between presses.

const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('[pageerror]', e.message));

    const fixture = process.argv[2] || 'bug-report';
    const expectedInitial = process.argv[3] || 'btn-submit';
    await page.goto('http://localhost:8765/screens/playground.html#' + fixture, { waitUntil: 'domcontentloaded' });

    // Wait for the iframe to actually load (defer scripts + tsic-focus install).
    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        return f && f.contentWindow && f.contentWindow.tsic && f.contentWindow.tsic.focus;
    }, { timeout: 5000 });

    // Switch to the INPUT pane (mirrors a real user clicking the tab).
    await page.click('.pg-tab[data-pane="pg-input-pane"]');

    // Toggle Gamepad mode on.
    await page.click('.pg-input-mode-bar .pg-btn');

    // Give the focus engine a beat to land initial focus.
    await page.waitForFunction((id) => {
        const f = document.getElementById('pg-iframe');
        const a = f && f.contentDocument && f.contentDocument.activeElement;
        return a && a.id === id;
    }, expectedInitial, { timeout: 4000 });

    const initialId = await page.evaluate(() => document.getElementById('pg-iframe').contentDocument.activeElement.id);
    console.log('Initial focus inside iframe:', initialId);

    async function snapshot() {
        return await page.evaluate(() => {
            const f = document.getElementById('pg-iframe');
            const a = f.contentDocument.activeElement;
            const marked = f.contentDocument.querySelector('[data-tsic-focused]');
            const all = Array.from(f.contentWindow.tsic.focus.__focusableSet());
            return {
                activeId: a && a.id,
                activeTag: a && a.tagName,
                markerId: marked && marked.id,
                candidates: all.map(el => {
                    const r = el.getBoundingClientRect();
                    return {
                        id: el.id || '(' + el.tagName.toLowerCase() + ')',
                        x: Math.round(r.left), y: Math.round(r.top),
                        w: Math.round(r.width), h: Math.round(r.height),
                    };
                }),
            };
        });
    }

    async function clickDir(label) {
        const btn = await page.evaluateHandle((needle) => {
            return Array.from(document.querySelectorAll('.pg-input-grid .pg-btn'))
                .find(b => b.textContent.trim() === needle);
        }, label);
        await btn.asElement().click();
        await page.waitForTimeout(80);
    }

    const before = await snapshot();
    console.log('Initial snapshot:', JSON.stringify(before, null, 2));

    await clickDir('Up');
    console.log('After Up:', JSON.stringify(await snapshot()));
    await clickDir('Up');
    console.log('After Up (2):', JSON.stringify(await snapshot()));
    await clickDir('Down');
    console.log('After Down:', JSON.stringify(await snapshot()));
    await clickDir('Left');
    console.log('After Left:', JSON.stringify(await snapshot()));

    const finalSnap = await snapshot();
    const ok = finalSnap.markerId && finalSnap.markerId !== expectedInitial;
    console.log(ok ? 'PASS — focus walked off initial' : 'FAIL — focus stuck on ' + expectedInitial);

    await browser.close();
    process.exit(ok ? 0 : 1);
})();
