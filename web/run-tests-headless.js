// Headless runner for the TSICWebUI SPA test harness.
// Usage: node run-tests-headless.js [--filter <substring>] [--channel chrome]
//                                   [--order reverse|shuffle [--seed <n>]]
// Assumes a static server is serving the /Web tree at http://localhost:8765.
// --channel chrome runs against the installed Chrome instead of the
// downloaded chromium headless shell (no `npx playwright install` needed).
//
// --order exists because a suite whose result depends on the order it ran in is
// not a verdict. The harness reuses ONE iframe for every scenario, so anything a
// scenario leaves behind — a screen that never finished mounting, a document
// still holding focus — is visible to the next one, and the damage surfaces as
// some later scenario measuring a DOM it did not build. The default alphabetical
// order only ever exercises one arrangement. Run reverse (or a seeded shuffle)
// to find that coupling deliberately rather than waiting for it to appear as a
// mystery red in CI.

const { chromium } = require('playwright');

(async () => {
    const filter = process.argv.includes('--filter')
        ? process.argv[process.argv.indexOf('--filter') + 1]
        : null;
    const channel = process.argv.includes('--channel')
        ? process.argv[process.argv.indexOf('--channel') + 1]
        : null;
    const order = process.argv.includes('--order')
        ? process.argv[process.argv.indexOf('--order') + 1]
        : null;
    if (order && order !== 'reverse' && order !== 'shuffle') {
        console.error(`--order must be "reverse" or "shuffle", got "${order}"`);
        process.exit(1);
    }
    const seed = process.argv.includes('--seed')
        ? Number(process.argv[process.argv.indexOf('--seed') + 1])
        : 1;

    const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
    // Playwright's 1280x720 default, minus the 660px of scenario-list + log chrome around the
    // viewer, left screens rendering into a 620px iframe — narrower than the game ever runs,
    // and narrow enough that --tsic-slot bottoms out at its clamp minimum. Layout assertions
    // measured there describe a window nobody plays in. This gives the iframe ~1740px, i.e. a
    // 1080p-and-up game window, where the slot clamp sits at its full 68px.
    const page = await browser.newPage({ viewport: { width: 2400, height: 1300 } });
    page.on('pageerror', e => console.error('[pageerror]', e.message));
    page.on('console', msg => {
        if (msg.type() === 'error') console.error('[console.error]', msg.text());
    });

    await page.goto('http://localhost:8765/screens/tests.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.TSICTestHarness && window.TSICTestHarness.scenarios.length > 0);

    const total = await page.evaluate(() => window.TSICTestHarness.scenarios.length);
    console.log(`Loaded ${total} scenarios`);

    if (order) {
        // The host page sorted the array by name and cached each scenario's row on it,
        // so reordering IN PLACE after that keeps every row reference valid while
        // changing the order "Run all" walks.
        await page.evaluate(({ how, s }) => {
            const scns = window.TSICTestHarness.scenarios;
            if (how === 'reverse') { scns.reverse(); return; }
            // Deterministic shuffle: a failing order has to be replayable from the seed.
            let x = s >>> 0 || 1;
            const rand = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
            for (let i = scns.length - 1; i > 0; i--) {
                const j = Math.floor(rand() * (i + 1));
                [scns[i], scns[j]] = [scns[j], scns[i]];
            }
        }, { how: order, s: seed });
        console.log(order === 'reverse' ? 'Order: reversed' : `Order: shuffled (seed ${seed})`);
    }

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
        }, null, { timeout: 420000 });
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

    // Exit code, not just a printed SUMMARY. Both branches emit one "FAIL  <name>"
    // line per failing scenario, so this covers filtered and full runs alike.
    // Without it this script exited 0 no matter how many scenarios failed, which made
    // the whole web suite report success to every caller that checked $LASTEXITCODE.
    const failed = lines.filter(l => l.startsWith('FAIL')).length;
    // A filter that matches nothing is a typo, not a pass — it would otherwise report
    // "0 failing" and exit clean having run no scenario at all.
    const ran = lines.filter(l => /^(PASS|FAIL|SKIP)/.test(l)).length;
    if (failed > 0) {
        console.error(`${failed} scenario(s) failed`);
        process.exitCode = 1;
    } else if (ran === 0) {
        console.error(filter
            ? `Filter "${filter}" matched no scenarios — nothing was run`
            : 'No scenarios ran');
        process.exitCode = 1;
    }
})();
