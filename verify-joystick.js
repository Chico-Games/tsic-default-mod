// Smoke test for the playground's virtual joystick driving IA_UI_MapMove.
// Drags the joystick knob to the right and confirms map.html's pan state
// actually moves the world (so consumers receive Triggered axis2d events).

const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push('[console.error] ' + msg.text());
    });

    await page.goto('http://localhost:8765/screens/playground.html#map', { waitUntil: 'domcontentloaded' });
    // Wait until map.html has run fitToBounds() — content.style.transform is
    // set with non-zero scale only after the first snapshot lands.
    await page.waitForFunction(() => {
        const f = document.getElementById('pg-iframe');
        if (!f || !f.contentDocument) return false;
        const c = f.contentDocument.getElementById('map-content');
        return c && c.style.transform && c.style.transform.indexOf('scale') !== -1;
    }, null, { timeout: 8000 });
    // Switch to Input pane so the joystick exists in the DOM.
    await page.click('.pg-tab[data-pane="pg-input-pane"]');
    await page.waitForSelector('.pg-joystick', { timeout: 4000 });

    let failed = 0;
    function log(ok, msg) {
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
        if (!ok) failed++;
    }

    // 1. D-pad layout sanity — all four cardinal cells exist and live in a .pg-dpad.
    const dpad = await page.evaluate(() => {
        const pads = document.querySelectorAll('.pg-dpad');
        if (pads.length === 0) return null;
        const slots = {};
        for (const cls of ['up', 'down', 'left', 'right']) {
            slots[cls] = !!document.querySelector('.pg-dpad .pg-dpad-' + cls);
        }
        return { pads: pads.length, slots };
    });
    log(dpad && dpad.pads >= 2 && dpad.slots.up && dpad.slots.down && dpad.slots.left && dpad.slots.right,
        `d-pad: ${dpad ? `${dpad.pads} pads, slots=${JSON.stringify(dpad.slots)}` : 'missing'}`);

    // 2. Joystick exists with knob + readout.
    const joyStaticState = await page.evaluate(() => ({
        joystick: !!document.querySelector('.pg-joystick'),
        knob: !!document.querySelector('.pg-joystick .pg-joystick-knob'),
        readout: !!document.querySelector('.pg-axis2d-readout'),
        actionDefault: document.querySelector('.pg-axis2d select').value,
    }));
    log(joyStaticState.joystick && joyStaticState.knob && joyStaticState.readout,
        `joystick scaffold present (action default=${joyStaticState.actionDefault})`);
    log(joyStaticState.actionDefault === 'IA_UI_MapMove',
        `axis2d action defaults to IA_UI_MapMove`);

    // 3. Drive the joystick — drag the knob to the right and hold for ~250ms.
    // While held, map.html should pan left (Stick +X pans world left per its
    // own convention). Capture state.panX before and after.
    const panBefore = await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        // map.html keeps state inside an IIFE closure — read via the inline
        // transform on #map-content instead.
        const c = f.contentDocument.getElementById('map-content');
        const m = (c.style.transform || '').match(/translate\(\s*([-0-9.]+)px,\s*([-0-9.]+)px\)/);
        return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
    });
    log(!!panBefore, `read initial pan = ${JSON.stringify(panBefore)}`);

    const joyBox = await page.evaluate(() => {
        const j = document.querySelector('.pg-joystick');
        const r = j.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
    });
    // Press down on the center, then drag the pointer far to the right.
    await page.mouse.move(joyBox.x, joyBox.y);
    await page.mouse.down();
    // Drag in two steps so the joystick definitely processes Move events.
    await page.mouse.move(joyBox.x + joyBox.w * 0.6, joyBox.y, { steps: 4 });
    await page.waitForTimeout(280); // ~17 rAF frames of Triggered events
    const valueDuring = await page.evaluate(() => {
        const v = document.querySelector('.pg-axis2d-readout .v');
        return v ? v.textContent : null;
    });
    await page.mouse.up();
    await page.waitForTimeout(80);

    const panAfter = await page.evaluate(() => {
        const f = document.getElementById('pg-iframe');
        const c = f.contentDocument.getElementById('map-content');
        const m = (c.style.transform || '').match(/translate\(\s*([-0-9.]+)px,\s*([-0-9.]+)px\)/);
        return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : null;
    });

    // Readout should have shown a positive X (stick pushed right).
    log(valueDuring && parseFloat(valueDuring) > 0.5,
        `joystick readout while held: X="${valueDuring}" (expected > 0.5)`);

    // Pan delta — map.html's handler does panBy(-stickX * speed * dt), so a
    // sustained +X stick produces a negative panX delta of ~hundreds of px.
    const dx = panAfter && panBefore ? (panAfter.x - panBefore.x) : null;
    log(dx !== null && dx < -10,
        `map.html panX moved while joystick held: dx=${dx} (expected < -10)`);

    // Readout should snap back to 0 on release.
    const valueAfter = await page.evaluate(() => {
        const v = document.querySelector('.pg-axis2d-readout .v');
        return v ? v.textContent : null;
    });
    log(valueAfter === '0.00', `joystick readout after release: X="${valueAfter}"`);

    if (errors.length) {
        console.log('--- page errors ---');
        for (const e of errors) console.log(e);
    }
    console.log(`SUMMARY: ${failed === 0 ? 'all checks passed' : failed + ' failing'}`);
    await browser.close();
    process.exit(failed === 0 ? 0 : 1);
})();
