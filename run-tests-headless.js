// Headless runner for the TSICWebUI SPA test harness.
// Usage: node run-tests-headless.js [--filter <substring>]
// Assumes a static server is serving the /Web tree at http://localhost:8765.

const { chromium } = require('playwright');

(async () => {
    const filter = process.argv.includes('--filter')
        ? process.argv[process.argv.indexOf('--filter') + 1]
        : null;

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('pageerror', e => console.error('[pageerror]', e.message));
    page.on('console', msg => {
        if (msg.type() === 'error') console.error('[console.error]', msg.text());
    });

    await page.goto('http://localhost:8765/screens/tests.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.TSICTestHarness && window.TSICTestHarness.scenarios.length > 0);

    const total = await page.evaluate(() => window.TSICTestHarness.scenarios.length);
    console.log(`Loaded ${total} scenarios`);

    // Run either a filtered subset or everything.
    if (filter) {
        await page.evaluate(async (needle) => {
            const matches = window.TSICTestHarness.scenarios.filter(s => s.name.includes(needle));
            window.__results = [];
            const log = (...a) => window.__results.push(a.join(' '));
            log(`Filter "${needle}" matched ${matches.length} scenario(s)`);
            for (const scn of matches) {
                const row = scn._el || document.querySelector('.scn[data-name="' + scn.name + '"]');
                // Click the row to mark selected, then trigger Run selected.
                if (row) row.click();
                document.getElementById('btn-run-sel').click();
                // Wait for the row to reach a terminal state (pass/fail).
                const deadline = Date.now() + 15000;
                while (Date.now() < deadline) {
                    await new Promise(r => setTimeout(r, 50));
                    if (scn._el && (scn._el.classList.contains('pass') || scn._el.classList.contains('fail') || scn._el.classList.contains('skip'))) break;
                }
                const status = scn._el && scn._el.classList.contains('pass') ? 'PASS'
                    : scn._el && scn._el.classList.contains('skip') ? 'SKIP' : 'FAIL';
                log(status + '  ' + scn.name);
            }
        }, filter);
    } else {
        await page.click('#btn-run-all');
        await page.waitForFunction(() => {
            const total = window.TSICTestHarness.scenarios.length;
            const done = document.querySelectorAll('.scn.pass, .scn.fail, .scn.skip').length;
            return done >= total;
        }, { timeout: 120000 });
        await page.evaluate(() => {
            window.__results = [];
            const scns = window.TSICTestHarness.scenarios;
            const log = (...a) => window.__results.push(a.join(' '));
            let pass = 0, fail = 0, skipped = 0;
            for (const s of scns) {
                if (s._el && s._el.classList.contains('pass')) { pass++; log('PASS  ' + s.name); }
                else if (s._el && s._el.classList.contains('skip')) { skipped++; log('SKIP  ' + s.name); }
                else { fail++; log('FAIL  ' + s.name); }
            }
            log('---');
            log(`SUMMARY: ${pass}/${scns.length} passing, ${fail} failing, ${skipped} skipped`);
        });
    }

    const lines = await page.evaluate(() => window.__results || []);
    const logLines = await page.evaluate(() => Array.from(document.querySelectorAll('#log-list .log-entry')).map(e => e.className.replace('log-entry ', '') + '  ' + e.textContent));

    for (const l of lines) console.log(l);
    if (filter) {
        console.log('--- log ---');
        for (const l of logLines) console.log(l);
    }

    await browser.close();
})();
