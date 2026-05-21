// Drives the playground exactly like a user — including listening to BOTH
// the parent window AND the iframe's console output. Surfaces every log
// line tagged [TSIC-INPUT] / [TSIC-FOCUS] / [TSIC-BRIDGE] so we can see what
// fires when a "direction" button is clicked.

const { chromium } = require('playwright');

(async () => {
    const fixture = process.argv[2] || 'bug-report';
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const logs = [];
    function push(src, msg) { logs.push('[' + src + '] ' + msg); }

    page.on('console', msg => push('parent', msg.type() + ' ' + msg.text()));
    page.on('pageerror', e => push('parent', 'ERROR ' + e.message));

    // Hook into iframe console too — playwright surfaces iframe console
    // messages through the main page's 'console' event, but the source
    // frame is in msg.location(). We'll just log everything.
    page.on('frameattached', frame => {
        frame.page().on('console', msg => {
            const loc = msg.location();
            if (loc.url && loc.url.includes(fixture)) push('iframe', msg.type() + ' ' + msg.text());
        });
    });

    await page.goto('http://localhost:8765/screens/playground.html#' + fixture, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        return f && f.contentWindow && f.contentWindow.tsic && f.contentWindow.tsic.focus;
    }, { timeout: 5000 });

    await page.click('.pg-tab[data-pane="pg-input-pane"]');

    push('script', '--- Toggling Gamepad mode ON ---');
    await page.click('.pg-input-mode-bar .pg-btn');
    await page.waitForTimeout(150);

    async function clickDir(label) {
        push('script', '--- Clicking "' + label + '" QUICK button ---');
        const btn = await page.evaluateHandle((needle) => {
            return Array.from(document.querySelectorAll('.pg-input-grid .pg-btn'))
                .find(b => b.textContent.trim() === needle);
        }, label);
        await btn.asElement().click();
        await page.waitForTimeout(150);
        const snap = await page.evaluate(() => {
            const f = document.getElementById('pg-iframe');
            const a = f.contentDocument.activeElement;
            const marker = f.contentDocument.querySelector('[data-tsic-focused]');
            return {
                active: a ? (a.id || a.tagName) : null,
                marker: marker ? (marker.id || marker.tagName) : null,
            };
        });
        push('snap', JSON.stringify(snap));
    }

    await clickDir('Up');
    await clickDir('Up');
    await clickDir('Down');
    await clickDir('Right');
    await clickDir('Left');

    for (const l of logs) console.log(l);

    await browser.close();
})();
