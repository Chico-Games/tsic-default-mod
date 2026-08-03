// shared/test-input.js — synthetic pointer gestures for UI regression tests.
//
// WHY THIS IS IN shared/ AND NOT tests/: the live in-game page loads it too, so the SAME
// gesture code drives both the headless harness and Gauntlet nodes running against a packaged
// build (via ScpMechanicsTestDriver::RequestWebUIEval, which evaluates an expression in the
// live CEF view and hands the string result back to C++). One implementation, two consumers —
// a drag that passes headless is the same drag the Gauntlet node performs in-game.
//
// It is inert until called: nothing here runs at load, and it registers no listeners. Same
// precedent as the __tsicMap hooks that already ship inside shared/screens/map.js.
//
// WHAT THIS DOES AND DOES NOT COVER
//   Covers: the cursor engine, hit testing, real CSS layout and stacking, and the commands the
//   page publishes. Because the gestures run against the real page, a drop that lands on the
//   wrong element BECAUSE of z-order reproduces faithfully — which is the class of bug that
//   made a hotbar drop silently throw the stack on the floor.
//   Does NOT cover: whether CEF itself routes a real OS mouse drag into the page (pointer
//   capture, focus, the Slate-to-CEF bridge). Nothing short of real Slate mouse events tests
//   that, and those are coordinate-based and flaky; this seam is the high-value layer.
(function () {
    var NS = {};

    // The cursor engine only promotes a press to a drag past DRAG_THRESHOLD_PX (6), so every
    // gesture here steps well past it. Keep this above that constant.
    var STEP_PX = 12;

    function resolve(target) {
        if (!target) return null;
        return (typeof target === 'string') ? document.querySelector(target) : target;
    }

    /** Centre point of an element, in client coordinates. */
    function centre(target) {
        var el = resolve(target);
        if (!el) return null;
        var r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, el: el };
    }
    NS.centre = centre;

    /**
     * Dispatch one pointer event at a point. `buttons` is the held-button MASK (1 = LMB,
     * 2 = RMB) and matters for move/up; `button` is the button that changed.
     */
    function pointer(el, type, x, y, buttons, button) {
        el.dispatchEvent(new PointerEvent(type, {
            bubbles: true, cancelable: true, clientX: x, clientY: y,
            buttons: buttons || 0, button: button || 0, pointerId: 1, isPrimary: true,
        }));
    }
    NS.pointer = pointer;

    /**
     * Press–drag–release from one element to another. Intermediate moves are dispatched at the
     * DOCUMENT, exactly like a real drag: the engine tracks moves globally, and dispatching
     * them on the source element would let a stopPropagation anywhere in between mask a bug.
     */
    NS.drag = function (fromTarget, toTarget, opts) {
        opts = opts || {};
        var from = centre(fromTarget);
        var to = centre(toTarget);
        if (!from) return 'ERR:no-source ' + fromTarget;
        if (!to) return 'ERR:no-target ' + toTarget;
        var mask = opts.rmb ? 2 : 1;
        var button = opts.rmb ? 2 : 0;

        pointer(from.el, 'pointerdown', from.x, from.y, mask, button);
        // A midpoint move guarantees we clear the drag threshold even when the two elements
        // overlap or sit within a few pixels of each other.
        pointer(document, 'pointermove', from.x + STEP_PX, from.y, mask, button);
        pointer(document, 'pointermove', (from.x + to.x) / 2, (from.y + to.y) / 2, mask, button);
        pointer(document, 'pointermove', to.x, to.y, mask, button);
        pointer(to.el, 'pointerup', to.x, to.y, 0, button);
        return 'ok';
    };

    /**
     * Click–move–click: the same gesture as drag() with different timing (grid design §6), so
     * both paths through the cursor engine get exercised by tests that care.
     */
    NS.clickMoveClick = function (fromTarget, toTarget) {
        var from = centre(fromTarget);
        var to = centre(toTarget);
        if (!from) return 'ERR:no-source ' + fromTarget;
        if (!to) return 'ERR:no-target ' + toTarget;
        from.el.dispatchEvent(new MouseEvent('click', {
            bubbles: true, cancelable: true, clientX: from.x, clientY: from.y,
        }));
        pointer(to.el, 'pointerdown', to.x, to.y, 1, 0);
        pointer(to.el, 'pointerup', to.x, to.y, 0, 0);
        return 'ok';
    };

    /**
     * Sweep a held stack across several cells without releasing — the drag-distribute gesture
     * (LMB even split, RMB place-one). Pass the cells in the order they should be swept.
     */
    NS.dragPath = function (fromTarget, throughTargets, opts) {
        opts = opts || {};
        var from = centre(fromTarget);
        if (!from) return 'ERR:no-source ' + fromTarget;
        var mask = opts.rmb ? 2 : 1;
        var button = opts.rmb ? 2 : 0;
        pointer(from.el, 'pointerdown', from.x, from.y, mask, button);
        pointer(document, 'pointermove', from.x + STEP_PX, from.y, mask, button);
        var last = from;
        for (var i = 0; i < throughTargets.length; i++) {
            var p = centre(throughTargets[i]);
            if (!p) return 'ERR:no-target ' + throughTargets[i];
            pointer(document, 'pointermove', p.x, p.y, mask, button);
            last = p;
        }
        pointer(last.el, 'pointerup', last.x, last.y, 0, button);
        return 'ok';
    };

    /** Move the cursor over an element without pressing — drives hover/info panels. */
    NS.hover = function (target) {
        var p = centre(target);
        if (!p) return 'ERR:no-target ' + target;
        p.el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: p.x, clientY: p.y }));
        pointer(document, 'pointermove', p.x, p.y, 0, 0);
        return 'ok';
    };

    /**
     * Compact description of a grid/bar for eval assertions: "0=ID_Axe 1=- 2=ID_Bread".
     * Gauntlet nodes read this straight out of RequestWebUIEval.
     */
    NS.describeSlots = function (selector, indexAttr) {
        var out = [];
        var slots = document.querySelectorAll(selector);
        for (var i = 0; i < slots.length; i++) {
            var img = slots[i].querySelector('img');
            var name = '-';
            if (img && img.src) {
                var parts = decodeURIComponent(img.src).split('/');
                name = parts[parts.length - 1].split('?')[0];
            }
            var key = indexAttr ? slots[i].getAttribute(indexAttr) : String(i);
            out.push(key + '=' + name);
        }
        return out.join(' ');
    };

    window.TSIC = window.TSIC || {};
    window.TSIC.testInput = NS;
})();
