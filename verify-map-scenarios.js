// Temporary smoke check for the Map playground fixture.
// Walks every scenario, reads the rendered SVG inside the iframe, and reports
// whether icons/players/pings actually land at non-origin positions with the
// right CSS classes. Delete after the map fixture migration lands.
//
// Requires the dev server on http://localhost:8765 (the /Web tree).

const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push('[console.error] ' + msg.text());
    });

    await page.goto('http://localhost:8765/screens/playground.html#map', { waitUntil: 'domcontentloaded' });

    // Wait for the iframe to load map.html and process the first project().
    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        if (!f || !f.contentWindow || !f.contentDocument) return false;
        const overlay = f.contentDocument.getElementById('overlay');
        if (!overlay) return false;
        const ic = f.contentDocument.getElementById('g-icons');
        const pl = f.contentDocument.getElementById('g-players');
        // Player default scenario has 2 players, so wait for that.
        return ic && pl && pl.children.length >= 1;
    }, null, { timeout: 8000 });

    async function listScenarios() {
        return await page.evaluate(() => {
            return Array.from(document.querySelectorAll('#pg-scenarios .pg-btn'))
                .filter(b => b.textContent !== 'Reset state')
                .map(b => b.textContent);
        });
    }

    async function clickScenario(label) {
        await page.evaluate((needle) => {
            const btn = Array.from(document.querySelectorAll('#pg-scenarios .pg-btn'))
                .find(b => b.textContent === needle);
            if (btn) btn.click();
        }, label);
        // project() is synchronous after click; give the SVG one rAF to settle.
        await page.waitForTimeout(60);
    }

    async function snapshot() {
        return await page.evaluate(() => {
            const f = document.getElementById('pg-iframe');
            const d = f.contentDocument;
            const icons = Array.from(d.getElementById('g-icons').children);
            const players = Array.from(d.getElementById('g-players').children);
            const pings = Array.from(d.getElementById('g-pings').children);
            const coords = Array.from(d.getElementById('g-coords').children);
            const bounds = d.getElementById('world-bounds');
            const boundsW = parseFloat(bounds && bounds.getAttribute('width') || '0');
            const boundsH = parseFloat(bounds && bounds.getAttribute('height') || '0');
            const empty = d.getElementById('empty');

            function classCounts(nodes) {
                const out = {};
                for (const n of nodes) {
                    const cls = (n.getAttribute('class') || '').trim();
                    out[cls] = (out[cls] || 0) + 1;
                }
                return out;
            }
            function nonOriginCount(nodes, attrPair) {
                let n = 0;
                for (const el of nodes) {
                    let x = 0, y = 0;
                    if (attrPair === 'cxy') {
                        x = parseFloat(el.getAttribute('cx') || '0');
                        y = parseFloat(el.getAttribute('cy') || '0');
                    } else {
                        // <polygon transform="translate(x,y) rotate(...)">
                        // or <g transform="translate(x,y)">
                        const t = el.getAttribute('transform') || '';
                        const m = t.match(/translate\(\s*([-0-9.]+)\s*,\s*([-0-9.]+)\s*\)/);
                        if (m) { x = parseFloat(m[1]); y = parseFloat(m[2]); }
                    }
                    if (x !== 0 || y !== 0) n++;
                }
                return n;
            }

            return {
                empty: empty && empty.style.display !== 'none' ? empty.textContent.trim() : null,
                icons: { count: icons.length, classes: classCounts(icons), nonOrigin: nonOriginCount(icons, 'cxy') },
                players: { count: players.length, classes: classCounts(players), nonOrigin: nonOriginCount(players, 't') },
                pings: { count: pings.length, classes: classCounts(pings), nonOrigin: nonOriginCount(pings, 't') },
                coords: coords.length,
                bounds: { w: boundsW, h: boundsH },
            };
        });
    }

    const scenarios = await listScenarios();
    console.log('Scenarios found:', scenarios.length);

    let failed = 0;
    for (const label of scenarios) {
        await clickScenario(label);
        const s = await snapshot();
        // Expected per-scenario invariants. The fixture's `Default` has 5 icons,
        // 2 players, 2 pings; the rest are explicit.
        const expect = {
            'Default':          { icons: 5, players: 2, pings: 2 },
            'No pings':         { pings: 0 },
            'One ping':         { pings: 1 },
            'Many pings (12)':  { pings: 12 },
            'Dense pings (32)': { pings: 32 },
            'Solo player':      { players: 1 },
            'Many players (6)': { players: 6 },
            'Cornered player':  { players: 2 },
            'Lots of icons':    { icons: 18 },
            // Clustered icons collapses many overlapping icons into cluster
            // bubbles at low zoom; just check that *some* SVG content is
            // emitted with the cluster class.
            'Clustered icons':  { cluster: true },
            'Tiny world':       { players: 1, pings: 1 },
            'No snapshot':      { players: 0, pings: 0, empty: true },
        }[label] || {};

        const checks = [];
        if (expect.cluster) {
            const hasCluster = Object.keys(s.icons.classes).some(k => /\bic-cluster\b/.test(k));
            if (s.icons.count === 0) checks.push('cluster scenario rendered nothing');
            if (!hasCluster) checks.push('cluster scenario produced no ic-cluster');
        }
        if (expect.icons   !== undefined && s.icons.count   < expect.icons - 2)   checks.push(`icons<${expect.icons}: ${s.icons.count}`);
        if (expect.players !== undefined && s.players.count !== expect.players)   checks.push(`players!=${expect.players}: ${s.players.count}`);
        if (expect.pings   !== undefined && s.pings.count   !== expect.pings)     checks.push(`pings!=${expect.pings}: ${s.pings.count}`);
        if (expect.empty && !s.empty)                                              checks.push(`empty banner missing`);
        if (!expect.empty && s.players.count > 1 && s.players.nonOrigin === 0)    checks.push(`all players stacked at origin`);
        if (!expect.empty && s.pings.count   > 1 && s.pings.nonOrigin === 0)      checks.push(`all pings stacked at origin`);
        if (!expect.empty && s.icons.count   > 1 && s.icons.nonOrigin === 0 && s.icons.count > 1) checks.push(`all icons stacked at origin`);
        // Player[0] should be pl-self when there is at least one player.
        if (s.players.count >= 1) {
            const hasSelf = Object.keys(s.players.classes).some(k => /\bpl-self\b/.test(k));
            if (!hasSelf) checks.push('no pl-self class on any player');
        }
        if (s.players.count >= 2) {
            const hasOther = Object.keys(s.players.classes).some(k => /\bpl-other\b/.test(k));
            if (!hasOther) checks.push('multi-player scenario has no pl-other');
        }
        if (!expect.empty) {
            if (s.bounds.w <= 0 || s.bounds.h <= 0) checks.push(`world-bounds rect not sized (${s.bounds.w}x${s.bounds.h})`);
            if (s.coords !== 4) checks.push(`expected 4 corner coord labels, got ${s.coords}`);
        } else {
            if (s.coords !== 0) checks.push(`empty scenario still has ${s.coords} coord labels`);
        }

        const ok = checks.length === 0;
        if (!ok) failed++;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  icons=${s.icons.count} players=${s.players.count} pings=${s.pings.count}` +
            (s.empty ? `  empty="${s.empty}"` : '') +
            (checks.length ? `  -- ${checks.join('; ')}` : ''));
    }

    // ---------------------------------------------------------------------
    // Hover-chip checks. Use the Default scenario (Ziggy at world (0,0), which
    // ends up at the viewport center under fit-to-bounds). Scenarios mutate
    // the shared state object — after "No snapshot" the Players/Icons arrays
    // are empty and Default (apply() {}) won't restore them. Click "Reset
    // state" first to call initialState() again.
    // ---------------------------------------------------------------------
    await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('#pg-scenarios .pg-btn'))
            .find(b => b.textContent === 'Reset state');
        if (btn) btn.click();
    });
    await page.waitForTimeout(120);

    // Mouse hover over Ziggy's triangle and confirm the chip names them.
    const ziggyPagePos = await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const poly = f.contentDocument.querySelector('#g-players polygon.pl-self');
        if (!poly) return null;
        const r = poly.getBoundingClientRect();
        const fr = f.getBoundingClientRect();
        return { x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 };
    });
    if (!ziggyPagePos) {
        console.log('FAIL  hover (mouse)  -- no .pl-self polygon to hover');
        failed++;
    } else {
        // Bump in twice so the iframe gets both mouseenter and a real mousemove.
        await page.mouse.move(ziggyPagePos.x - 4, ziggyPagePos.y - 4);
        await page.mouse.move(ziggyPagePos.x, ziggyPagePos.y);
        await page.waitForTimeout(80);
        const chip = await page.evaluate(() => {
            const f = document.getElementById('pg-iframe');
            const c = f.contentDocument.getElementById('hover-chip');
            return { visible: c && c.style.display !== 'none' && c.offsetWidth > 0, text: c ? c.textContent : '' };
        });
        const ok = chip.visible && /Ziggy/.test(chip.text);
        console.log(`${ok ? 'PASS' : 'FAIL'}  hover (mouse over Ziggy)  visible=${chip.visible} text="${chip.text}"`);
        if (!ok) failed++;
    }

    // Toggle Gamepad mode via the playground input pane (mirrors the user).
    // In gamepad mode the chip anchors to the crosshair at viewport center.
    // Since Ziggy is at world (0,0) and fit-to-bounds centers the world, the
    // crosshair lands on Ziggy without any panning.
    await page.click('.pg-tab[data-pane="pg-input-pane"]');
    await page.click('.pg-input-mode-bar .pg-btn');
    await page.waitForTimeout(120);
    const padChip = await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const d = f.contentDocument;
        const vp = d.getElementById('map-viewport');
        const c = d.getElementById('hover-chip');
        return {
            padCursor: vp.classList.contains('pad-cursor'),
            visible: c && c.style.display !== 'none' && c.offsetWidth > 0,
            text: c ? c.textContent : '',
        };
    });
    const padOk = padChip.padCursor && padChip.visible && /Ziggy/.test(padChip.text);
    console.log(`${padOk ? 'PASS' : 'FAIL'}  hover (gamepad crosshair on Ziggy)  pad=${padChip.padCursor} visible=${padChip.visible} text="${padChip.text}"`);
    if (!padOk) failed++;

    if (errors.length) {
        console.log('--- page errors ---');
        for (const e of errors) console.log(e);
    }
    const total = scenarios.length + 2;
    console.log(`SUMMARY: ${total - failed}/${total} passing, ${failed} failing`);
    await browser.close();
    process.exit(failed === 0 ? 0 : 1);
})();
