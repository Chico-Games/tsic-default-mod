// Smoke test for the joystick driving IA_UI_Navigate alongside the configured
// axis2d action. Loads a focus-engine-enabled screen (pause-menu) and drives
// the joystick right; expects the focused element inside the iframe to move,
// matching what clicking the d-pad's right arrow does.

const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push('[console.error] ' + msg.text());
    });

    await page.goto('http://localhost:8765/screens/playground.html#pause-menu', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        return f && f.contentWindow && f.contentWindow.tsic && f.contentWindow.tsic.focus;
    }, null, { timeout: 6000 });

    await page.click('.pg-tab[data-pane="pg-input-pane"]');
    await page.waitForSelector('.pg-joystick', { timeout: 4000 });
    // Toggle Gamepad mode (calls fEngine.enable() so the initial focus lands).
    await page.click('.pg-input-mode-bar .pg-btn');
    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        return f && f.contentDocument && f.contentDocument.querySelector('[data-tsic-focused]');
    }, null, { timeout: 4000 });

    let failed = 0;
    function log(ok, msg) {
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
        if (!ok) failed++;
    }

    async function focusedId() {
        return await page.evaluate(() => {
            const f = document.getElementById('pg-iframe');
            const el = f.contentDocument.querySelector('[data-tsic-focused]');
            return el ? (el.id || el.tagName + ':' + (el.textContent || '').trim().slice(0, 30)) : null;
        });
    }

    async function joystickCenter() {
        return await page.evaluate(() => {
            const j = document.querySelector('.pg-joystick');
            const r = j.getBoundingClientRect();
            return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width };
        });
    }

    // Capture every IA_UI_Navigate event the playground emits so we can
    // confirm Started fires on the first cardinal hit and again on direction
    // change (not just every 180ms throttle window).
    await page.evaluate(() => {
        window.__navEvents = [];
        const f = document.getElementById('pg-iframe');
        const orig = f.contentWindow.tsic.on.bind(f.contentWindow.tsic);
        // Tap the iframe's existing tsic.on without breaking other consumers
        // — instead hook the host's inject log via a fresh listener.
        f.contentWindow.tsic.on('tsic.msg.UI.Input.IA_UI_Navigate', (e) => {
            window.__navEvents.push({ phase: e.Phase, x: e.Value && e.Value.X, y: e.Value && e.Value.Y });
        });
    });

    const initialFocus = await focusedId();
    log(!!initialFocus, `initial focus = ${initialFocus}`);

    // Drive joystick to the right and hold long enough for the engine to
    // step a few times (engine throttles Triggered to 180ms, so 500ms gives
    // ~2-3 steps).
    const j = await joystickCenter();
    await page.mouse.move(j.cx, j.cy);
    await page.mouse.down();
    await page.mouse.move(j.cx + j.w * 0.6, j.cy, { steps: 4 });
    await page.waitForTimeout(550);
    const focusAfterRight = await focusedId();
    log(focusAfterRight && focusAfterRight !== initialFocus,
        `focus after holding right: "${focusAfterRight}" (initial was "${initialFocus}")`);

    // Without releasing, rotate the stick to point up. The implementation
    // should fire Navigate Started("up") immediately on the direction change,
    // not wait out the throttle window.
    await page.mouse.move(j.cx, j.cy - j.w * 0.6, { steps: 4 });
    await page.waitForTimeout(120);
    const navAfterRotate = await page.evaluate(() => window.__navEvents.slice());
    const startedDirections = navAfterRotate
        .filter(e => e.phase === 'Started')
        .map(e => (e.x > 0 ? 'right' : e.x < 0 ? 'left' : (e.y > 0 ? 'up' : 'down')));
    log(startedDirections.includes('right') && startedDirections.includes('up'),
        `Started fired for both initial and rotated dirs: ${JSON.stringify(startedDirections)}`);

    // Release.
    await page.mouse.up();
    await page.waitForTimeout(80);

    const navAll = await page.evaluate(() => window.__navEvents.slice());
    const completed = navAll.filter(e => e.phase === 'Completed');
    log(completed.length >= 1, `Navigate Completed fired ${completed.length} time(s)`);

    // Sanity — the joystick still drove the axis2d action too. Check the
    // readout snapped back to 0.
    const readoutX = await page.evaluate(() => {
        return document.querySelector('.pg-axis2d-readout .v').textContent;
    });
    log(readoutX === '0.00', `axis2d readout snapped back: X="${readoutX}"`);

    // Inside the deadzone, no Navigate events should fire. Drive the knob
    // a tiny amount, hold, then release and check.
    await page.evaluate(() => { window.__navEvents.length = 0; });
    await page.mouse.move(j.cx, j.cy);
    await page.mouse.down();
    // 0.2 of radius — well inside the 0.4 deadzone.
    await page.mouse.move(j.cx + j.w * 0.1, j.cy + j.w * 0.05, { steps: 3 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    const navInsideDeadzone = await page.evaluate(() => window.__navEvents.slice());
    log(navInsideDeadzone.length === 0,
        `no Navigate events fired while inside deadzone (got ${navInsideDeadzone.length})`);

    if (errors.length) {
        console.log('--- page errors ---');
        for (const e of errors) console.log(e);
    }
    console.log(`SUMMARY: ${failed === 0 ? 'all checks passed' : failed + ' failing'}`);
    await browser.close();
    process.exit(failed === 0 ? 0 : 1);
})();
