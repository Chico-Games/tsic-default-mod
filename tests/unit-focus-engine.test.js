// Unit tests for shared/tsic-focus.js — the focus engine.
//
// Each scenario loads a vanilla page (typically inventory.html since it pulls
// the shared bundle), strips its body, and renders a deterministic test
// fixture so the asserts don't depend on the host page's layout.
//
// jsdom does not compute layout, so getBoundingClientRect returns zero for
// every element. The focus engine's isFocusable + spatial-nearest math both
// need real rects. We mock them per-fixture: each test calls applyRects(...)
// to stamp a deterministic rect onto every focusable in the fixture. The
// rects live on the DOM elements so the engine reads them transparently.

function setupFixture(ctx, bodyHTML) {
    if (!ctx.doc.querySelector('meta[name="tsic-focus"]')) {
        ctx.doc.head.insertAdjacentHTML('beforeend', '<meta name="tsic-focus" content="enabled">');
    }
    ctx.doc.body.innerHTML = bodyHTML;
}

function mockRect(el, x, y, w, h) {
    if (!el) return;
    const r = { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x: x, y: y };
    el.getBoundingClientRect = () => r;
}

// Convenience: read style.left/top/width/height (defaulting to 28×100) and
// install a getBoundingClientRect that reports that rect. Pass a NodeList or
// array of elements. Elements without explicit width get a 100x28 default.
function applyRects(elements, defaultW, defaultH) {
    const w0 = defaultW || 100;
    const h0 = defaultH || 28;
    for (const el of elements) {
        const sx = parseFloat(el.style.left || '0') || 0;
        const sy = parseFloat(el.style.top  || '0') || 0;
        const sw = parseFloat(el.style.width  || '') || w0;
        const sh = parseFloat(el.style.height || '') || h0;
        mockRect(el, sx, sy, sw, sh);
    }
}

TSICTestHarness.register({
    name: 'Focus/Engine: stamps data-tsic-input from UI.Input.Mode.Changed',
    file: '/screens/inventory.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.documentElement.getAttribute('data-tsic-input'));
        ctx.expect(ctx.assert.eq(
            ctx.doc.documentElement.getAttribute('data-tsic-input'),
            'MouseAndKeyboard'));
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.eq(
            ctx.doc.documentElement.getAttribute('data-tsic-input'),
            'Gamepad'));
    },
});

TSICTestHarness.register({
    name: 'Focus/Engine: initial focus picks [data-tsic-initial-focus] on Gamepad',
    file: '/screens/inventory.html',
    async run(ctx) {
        setupFixture(ctx,
            '<div data-tsic-focus-group="t">' +
              '<button id="t1" data-tsic-initial-focus>One</button>' +
              '<button id="t2">Two</button>' +
            '</div>');
        applyRects(ctx.doc.querySelectorAll('button'));
        ctx.win.tsic.focus.enable();
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 50));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 't1'));
    },
});

TSICTestHarness.register({
    name: 'Focus/Engine: per-screen memory restores last-focused on re-enable',
    file: '/screens/inventory.html',
    async run(ctx) {
        setupFixture(ctx,
            '<div data-tsic-focus-group="t">' +
              '<button id="m1" data-tsic-initial-focus>One</button>' +
              '<button id="m2">Two</button>' +
            '</div>');
        applyRects(ctx.doc.querySelectorAll('button'));
        ctx.win.tsic.focus.enable();
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 50));
        ctx.win.tsic.focus.focus('#m2');
        ctx.mode('MouseAndKeyboard');
        await new Promise(r => setTimeout(r, 30));
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 50));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'm2'));
    },
});

TSICTestHarness.register({
    name: 'Focus/Engine: spatial nav picks nearest in direction (3x3 grid)',
    file: '/screens/inventory.html',
    async run(ctx) {
        setupFixture(ctx,
            '<div id="grid" data-tsic-focus-group="g" style="position:fixed; inset:0;">' +
              '<button id="b00" style="position:absolute; left:50px;  top:50px;">00</button>' +
              '<button id="b10" style="position:absolute; left:150px; top:50px;">10</button>' +
              '<button id="b20" style="position:absolute; left:250px; top:50px;">20</button>' +
              '<button id="b01" style="position:absolute; left:50px;  top:150px;">01</button>' +
              '<button id="b11" style="position:absolute; left:150px; top:150px;" data-tsic-initial-focus>11</button>' +
              '<button id="b21" style="position:absolute; left:250px; top:150px;">21</button>' +
              '<button id="b02" style="position:absolute; left:50px;  top:250px;">02</button>' +
              '<button id="b12" style="position:absolute; left:150px; top:250px;">12</button>' +
              '<button id="b22" style="position:absolute; left:250px; top:250px;">22</button>' +
            '</div>');
        applyRects(ctx.doc.querySelectorAll('button, [data-tsic-focusable], [data-tsic-skip-focus]'));
        ctx.win.tsic.focus.enable();
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 50));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'b11'));
        ctx.focus.pressDir('right'); await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'b21'));
        ctx.focus.pressDir('down');  await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'b22'));
        ctx.focus.pressDir('left');  await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'b12'));
        ctx.focus.pressDir('up');    await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'b11'));
    },
});

TSICTestHarness.register({
    name: 'Focus/Engine: pressing past the edge is a no-op (no wrap)',
    file: '/screens/inventory.html',
    async run(ctx) {
        setupFixture(ctx,
            '<div data-tsic-focus-group="g" style="position:fixed; inset:0;">' +
              '<button id="top"    style="position:absolute; left:50px; top:50px;"  data-tsic-initial-focus>top</button>' +
              '<button id="bottom" style="position:absolute; left:50px; top:150px;">bottom</button>' +
            '</div>');
        applyRects(ctx.doc.querySelectorAll('button, [data-tsic-focusable], [data-tsic-skip-focus]'));
        ctx.win.tsic.focus.enable();
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 50));
        ctx.focus.pressDir('up'); await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'top')); // didn't wrap
        ctx.focus.pressDir('down'); await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'bottom'));
        ctx.focus.pressDir('down'); await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'bottom')); // still no wrap
    },
});

TSICTestHarness.register({
    name: 'Focus/Engine: ConfirmAccept clicks the focused element',
    file: '/screens/inventory.html',
    async run(ctx) {
        setupFixture(ctx,
            '<div data-tsic-focus-group="t"><button id="bx" data-tsic-initial-focus>X</button></div>');
        applyRects(ctx.doc.querySelectorAll('button'));
        let clicked = 0;
        ctx.doc.getElementById('bx').addEventListener('click', () => clicked++);
        ctx.win.tsic.focus.enable();
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 50));
        ctx.focus.confirm();
        await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(clicked, 1));
    },
});

TSICTestHarness.register({
    name: 'Focus/Engine: pushScope constrains nav and popScope restores caller',
    file: '/screens/inventory.html',
    async run(ctx) {
        setupFixture(ctx,
            '<div data-tsic-focus-group="outer" style="position:fixed; inset:0;">' +
              '<button id="o1" data-tsic-initial-focus style="position:absolute; left:20px; top:20px;">O1</button>' +
              '<button id="o2" style="position:absolute; left:120px; top:20px;">O2</button>' +
              '<div id="modal" data-tsic-focus-group="modal" style="position:absolute; left:200px; top:200px;">' +
                '<button id="m1" style="position:absolute; left:200px; top:200px;">M1</button>' +
                '<button id="m2" style="position:absolute; left:200px; top:240px;">M2</button>' +
              '</div>' +
            '</div>');
        applyRects(ctx.doc.querySelectorAll('button, [data-tsic-focusable], [data-tsic-skip-focus]'));
        ctx.win.tsic.focus.enable();
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 50));
        ctx.win.tsic.focus.focus('#o1');
        ctx.win.tsic.focus.pushScope(ctx.doc.getElementById('modal'), '#m1');
        await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'm1'));
        // Down inside the scope should find m2, not o2.
        ctx.focus.pressDir('down'); await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'm2'));
        ctx.win.tsic.focus.popScope();
        await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'o1'));
    },
});

TSICTestHarness.register({
    name: 'Focus/Engine: CancelBack pops scope but is a no-op at top level',
    file: '/screens/inventory.html',
    async run(ctx) {
        setupFixture(ctx,
            '<div data-tsic-focus-group="outer">' +
              '<button id="x" data-tsic-initial-focus>x</button>' +
              '<div id="m" data-tsic-focus-group="m"><button id="m1">m1</button></div>' +
            '</div>');
        applyRects(ctx.doc.querySelectorAll('button, [data-tsic-focusable], [data-tsic-skip-focus]'));
        ctx.win.tsic.focus.enable();
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 50));
        // No scope pushed: cancel must not throw and must not change focus.
        ctx.focus.cancel(); await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'x'));
        // Push, then cancel pops back to caller.
        ctx.win.tsic.focus.pushScope(ctx.doc.getElementById('m'), '#m1');
        await new Promise(r => setTimeout(r, 20));
        ctx.focus.cancel(); await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'x'));
    },
});

TSICTestHarness.register({
    name: 'Focus/Engine: data-tsic-skip-focus excludes element from nav',
    file: '/screens/inventory.html',
    async run(ctx) {
        setupFixture(ctx,
            '<div data-tsic-focus-group="t" style="position:fixed; inset:0;">' +
              '<button id="a" style="position:absolute; left:20px; top:20px;" data-tsic-initial-focus>a</button>' +
              '<button id="b" style="position:absolute; left:120px; top:20px;" data-tsic-skip-focus>b</button>' +
              '<button id="c" style="position:absolute; left:220px; top:20px;">c</button>' +
            '</div>');
        applyRects(ctx.doc.querySelectorAll('button, [data-tsic-focusable], [data-tsic-skip-focus]'));
        ctx.win.tsic.focus.enable();
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 50));
        ctx.focus.pressDir('right'); await new Promise(r => setTimeout(r, 20));
        // b is skipped, so right goes from a straight to c.
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'c'));
    },
});

TSICTestHarness.register({
    name: 'Focus/Engine: zero-size elements are filtered from the focusable set',
    file: '/screens/inventory.html',
    async run(ctx) {
        setupFixture(ctx,
            '<div data-tsic-focus-group="t">' +
              '<button id="vis" data-tsic-initial-focus>vis</button>' +
              '<button id="hiddenAttr" hidden>hidden</button>' +
              '<button id="ariaHidden" aria-hidden="true">aria</button>' +
              '<button id="disabledBtn" disabled>disabled</button>' +
              '<button id="zero" style="width:0; height:0;">zero</button>' +
            '</div>');
        // Give the visible button a real rect; leave 'zero' with the default
        // zero-rect that jsdom returns to exercise the zero-size filter.
        mockRect(ctx.doc.getElementById('vis'), 0, 0, 100, 28);
        ctx.win.tsic.focus.enable();
        const set = ctx.win.tsic.focus.__focusableSet();
        const ids = set.map(el => el.id);
        ctx.expect(ctx.assert.truthy(ids.includes('vis'), 'expected vis to be focusable'));
        ctx.expect(ctx.assert.truthy(!ids.includes('hiddenAttr'),  'expected [hidden] NOT focusable'));
        ctx.expect(ctx.assert.truthy(!ids.includes('ariaHidden'),  'expected [aria-hidden] NOT focusable'));
        ctx.expect(ctx.assert.truthy(!ids.includes('disabledBtn'), 'expected [disabled] NOT focusable'));
        ctx.expect(ctx.assert.truthy(!ids.includes('zero'),        'expected zero-rect NOT focusable'));
    },
});

TSICTestHarness.register({
    name: 'Focus/Engine: Gamepad mode publishes setInteractiveRects([])',
    file: '/screens/inventory.html',
    async run(ctx) {
        let lastRects = 'unset';
        ctx.win.tsic.setInteractiveRects = (rects) => { lastRects = rects; };
        setupFixture(ctx, '<div data-tsic-focus-group="t"><button id="x" data-tsic-initial-focus>x</button></div>');
        applyRects(ctx.doc.querySelectorAll('button'));
        ctx.win.tsic.focus.enable();
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 50));
        ctx.expect(ctx.assert.eq(lastRects, []));
        ctx.mode('MouseAndKeyboard');
        await new Promise(r => setTimeout(r, 30));
        // Mouse mode restores a full-view rect so HTML is clickable again.
        ctx.expect(ctx.assert.truthy(Array.isArray(lastRects) && lastRects.length === 1));
    },
});

TSICTestHarness.register({
    name: 'Focus/Engine: scrolls container when focused row falls below viewport',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.doc.head.insertAdjacentHTML('beforeend', '<meta name="tsic-focus" content="enabled">');
        const rows = Array.from({ length: 30 }, (_, i) =>
            '<div data-tsic-focusable id="r' + i + '">' + i + '</div>'
        ).join('');
        ctx.doc.body.innerHTML =
            '<div id="scroller" data-tsic-focus-group="rows">' +
              rows.replace('id="r0"', 'id="r0" data-tsic-initial-focus') +
            '</div>';
        const scroller = ctx.doc.getElementById('scroller');
        // jsdom doesn't compute layout / scrollHeight / scrollBy. Mock the
        // scrollable container so the engine's scrollFocusIntoView fires.
        Object.defineProperty(scroller, 'scrollHeight', { value: 30 * 28, configurable: true });
        Object.defineProperty(scroller, 'clientHeight', { value: 200, configurable: true });
        // overflow-y must be auto for the engine to pick it as the scrollable.
        const cs = ctx.win.getComputedStyle;
        ctx.win.getComputedStyle = (el) => {
            if (el === scroller) return { overflowY: 'auto' };
            return cs ? cs.call(ctx.win, el) : { overflowY: 'visible' };
        };
        mockRect(scroller, 0, 0, 200, 200);
        const rowEls = ctx.doc.querySelectorAll('#scroller > div');
        rowEls.forEach((el, i) => mockRect(el, 0, i * 28, 200, 28));
        // Track scrollBy calls.
        let scrollDelta = 0;
        scroller.scrollBy = ({ top }) => { scrollDelta += top; };

        ctx.focus.disableSmoothScroll();
        ctx.win.tsic.focus.enable();
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 50));
        // Reset delta — initial focus to r0 may have triggered a margin-fitting
        // scroll. We only care about the down-jump being a positive scroll.
        scrollDelta = 0;
        ctx.win.tsic.focus.focus('#r15');
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(scrollDelta > 0,
            'expected scroll to advance downward, got scrollDelta=' + scrollDelta));
    },
});

TSICTestHarness.register({
    name: 'Focus/Engine: Started always fires; Triggered burst is throttled',
    file: '/screens/inventory.html',
    async run(ctx) {
        setupFixture(ctx,
            '<div data-tsic-focus-group="t" style="position:fixed; inset:0;">' +
              '<button id="a" style="position:absolute; left:20px; top:20px;"  data-tsic-initial-focus>a</button>' +
              '<button id="b" style="position:absolute; left:20px; top:120px;">b</button>' +
              '<button id="c" style="position:absolute; left:20px; top:220px;">c</button>' +
            '</div>');
        applyRects(ctx.doc.querySelectorAll('button, [data-tsic-focusable], [data-tsic-skip-focus]'));
        ctx.win.tsic.focus.enable();
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 50));
        // First press fires: Started -> a goes to b.
        ctx.input('IA_UI_Navigate', 'Started', { X: 0, Y: -1, Z: 0 });
        await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'b'));
        // Rapid Triggered burst within 180ms must be throttled to at most 1.
        for (let i = 0; i < 5; i++) {
            ctx.input('IA_UI_Navigate', 'Triggered', { X: 0, Y: -1, Z: 0 });
        }
        await new Promise(r => setTimeout(r, 30));
        // Active should be 'c' at most (b -> c on the one allowed Triggered),
        // never further than that because the throttle dropped the rest.
        const idAfterBurst = ctx.doc.activeElement.id;
        ctx.expect(ctx.assert.truthy(
            idAfterBurst === 'b' || idAfterBurst === 'c',
            'expected b or c after Triggered burst, got ' + idAfterBurst));
    },
});
