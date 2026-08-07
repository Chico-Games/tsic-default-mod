// shared/tsic-runtime.js
//
// Tiny utility belt that every SPA page can rely on. The intent is to give
// pages a uniform "boot" surface so each page only has to declare its data
// subscriptions + DOM interactions — no repeated whenReady polling, no
// hand-rolled Esc handlers, no copy-pasted Pause.Resume publishes.
//
// Everything is attached to `window.tsic` (the existing namespace stamped by
// the C++ bridge OR by the test-harness mock). The shim ALWAYS waits for the
// bridge to load before installing, so the production C++ tsic and the test
// mock both work without races.
(function () {
    function install(t) {
        if (t.__runtimeInstalled) return;
        t.__runtimeInstalled = true;

        // ---- Bootstrap helpers ------------------------------------------
        // Resolves once window.tsic exists. Pages call this exactly once.
        t.whenReady = t.whenReady || function (cb) {
            if (window.tsic) { try { cb(); } catch (e) { console.warn('[tsic.whenReady]', e); } return; }
            setTimeout(() => t.whenReady(cb), 16);
        };

        // Subscribe to a sticky-cached channel only after the bridge is ready.
        // Equivalent to: whenReady(() => tsic.on(channel, cb)).
        t.onReady = function (channel, cb) {
            t.whenReady(() => t.on(channel, cb));
        };

        // ---- Outbound message shortcuts -------------------------------
        t.resume       = () => t.publishMessage('UI.Cmd.Pause.Resume', {});
        t.quitToMenu   = () => t.publishMessage('UI.Cmd.Pause.QuitToMenu', {});
        t.closeScreen  = () => t.publishMessage('UI.Cmd.GameScreen.Close', {});
        let lastSoundAt = 0;
        t.playSound    = (key, vol) => {
            lastSoundAt = Date.now();
            t.publishMessage('UI.Cmd.Sound.Play',
                { SoundKey: key, VolumeScale: typeof vol === 'number' ? vol : 1.0 });
        };

        // ---- Generic control sounds -------------------------------------
        // Delegated document-level listeners give every button-ish element a
        // default click/hover sound without per-screen wiring. An element (or
        // any ancestor) opts out with data-no-sfx. Explicit playSound calls
        // win: the click layer skips its generic sound when something already
        // played one this instant (target handlers run before this bubble
        // listener), so e.g. a transfer button doesn't stack Click on top of
        // Inventory.Transfer.
        const SFX_SELECTOR = 'button, [role="button"]';
        document.addEventListener('click', (ev) => {
            const el = ev.target && ev.target.closest && ev.target.closest(SFX_SELECTOR);
            if (!el || el.disabled || el.closest('[data-no-sfx]')) return;
            if (Date.now() - lastSoundAt < 50) return;
            t.playSound('UI.Click');
        });
        let lastHoverEl = null;
        let lastHoverAt = 0;
        document.addEventListener('mouseover', (ev) => {
            const el = ev.target && ev.target.closest && ev.target.closest(SFX_SELECTOR);
            if (!el || el === lastHoverEl) { if (!el) lastHoverEl = null; return; }
            lastHoverEl = el;
            if (el.disabled || el.closest('[data-no-sfx]')) return;
            const now = Date.now();
            if (now - lastHoverAt < 60) return;
            lastHoverAt = now;
            t.playSound('UI.Hover', 0.4);
        });

        // ---- DOM helpers ------------------------------------------------
        t.qs  = (sel, root) => (root || document).querySelector(sel);
        t.qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

        // Bind a click handler to a selector or element. Returns an unbind fn.
        t.onClick = function (target, fn) {
            const el = (typeof target === 'string') ? t.qs(target) : target;
            if (!el) return () => {};
            const handler = (ev) => { try { fn(ev); } catch (e) { console.warn('[onClick]', e); } };
            el.addEventListener('click', handler);
            return () => el.removeEventListener('click', handler);
        };

        // Bind any key on the window to a handler.
        t.onKey = function (key, fn, opts) {
            const o = opts || {};
            const handler = (ev) => {
                if (ev.key !== key) return;
                if (o.requireFocus && document.activeElement && document.activeElement !== document.body) {
                    // Skip if focus is in an input/textarea — useful for global Esc handlers.
                    const tn = document.activeElement.tagName;
                    if (tn === 'INPUT' || tn === 'TEXTAREA' || document.activeElement.isContentEditable) return;
                }
                try { fn(ev); } catch (e) { console.warn('[onKey]', e); }
            };
            window.addEventListener('keydown', handler, o.capture === true);
            return () => window.removeEventListener('keydown', handler, o.capture === true);
        };

        // Wires Esc to the page's idiomatic close behaviour:
        //   - default: publish UI.Cmd.Pause.Resume
        //   - opts.closeScreen: publish UI.Cmd.GameScreen.Close instead
        //   - opts.handler: invoke a custom callback
        t.bindEscape = function (opts) {
            const o = opts || {};
            return t.onKey('Escape', () => {
                // Backing out with Escape reads differently from clicking a
                // button — the screen-open/close sound covers the transition,
                // this covers the gesture itself.
                t.playSound('UI.Back', 0.3);
                if (o.handler) { o.handler(); return; }
                if (o.closeScreen) { t.closeScreen(); return; }
                t.resume();
            });
        };

        // Wires a close-button (#btn-close by default) to the same behaviour.
        t.bindCloseButton = function (selectorOrEl, opts) {
            return t.onClick(selectorOrEl || '#btn-close', () => {
                const o = opts || {};
                t.playSound('UI.Cancel', 0.3);
                if (o.handler) { o.handler(); return; }
                if (o.closeScreen) { t.closeScreen(); return; }
                t.resume();
            });
        };

        // ---- Page boot helper ------------------------------------------
        // Standard recipe for menu screens: wait for the bridge, run setup,
        // wire Esc + the close button.
        //
        //   tsic.bootMenu(({ on }) => {
        //     on('tsic.msg.UI.Foo.Bar', (p) => renderFoo(p));
        //   });
        t.bootMenu = function (setup, opts) {
            const o = opts || {};
            t.whenReady(() => {
                const ctx = {
                    on: (ch, cb) => t.on(ch, cb),
                    publish: (ch, p) => t.publishMessage(ch, p || {}),
                };
                try { setup && setup(ctx); } catch (e) { console.warn('[bootMenu]', e); }
                if (o.escape !== false)     t.bindEscape({ closeScreen: !!o.closeScreen, handler: o.onClose });
                if (o.closeButton !== false) t.bindCloseButton(o.closeButton || '#btn-close',
                    { closeScreen: !!o.closeScreen, handler: o.onClose });
            });
        };

        // ---- Keyboard focus routing ------------------------------------
        // Hard rule: keyboard input always belongs to the Enhanced Input system.
        // The C++ UI input bridge turns every InputAction into a UI.Input.* event
        // that menus react to (close, navigate, tabs), so the web view must NOT
        // hold keyboard focus during normal menu use — otherwise those actions
        // never fire and the player has to click the screen to close a menu.
        //
        // The single exception: while an actual text-entry element is focused, we
        // hand keyboard focus to CEF so the player can type, then return it the
        // moment focus leaves the field. This watches document focus transitions
        // and toggles native keyboard capture to match — and nothing else ever
        // captures the keyboard.
        if (!t.__focusCaptureInstalled && typeof document !== 'undefined' && document.addEventListener) {
            t.__focusCaptureInstalled = true;

            const TEXT_INPUT_TYPES = {
                text: 1, search: 1, email: 1, url: 1, tel: 1, password: 1,
                number: 1, date: 1, time: 1, 'datetime-local': 1, month: 1, week: 1,
            };
            const isTextEntry = (el) => {
                if (!el || el.nodeType !== 1) return false;
                if (el.isContentEditable) return true;
                const tag = el.tagName;
                if (tag === 'TEXTAREA') return true;
                if (tag === 'INPUT') {
                    const type = (el.getAttribute('type') || 'text').toLowerCase();
                    return !!TEXT_INPUT_TYPES[type];
                }
                return false;
            };

            let captured = false;
            const apply = (want, force) => {
                want = !!want;
                if (want === captured && !force) return;
                captured = want;
                if (typeof t.setFocusCapture === 'function') t.setFocusCapture(want);
            };

            // Always re-assert on focusin, even when we already believe the
            // keyboard is ours: a page navigation or a torn-down screen can leave
            // `captured` true while the engine has since handed focus back, and a
            // deduped call there means the next text field silently gets no keys.
            document.addEventListener('focusin', (ev) => {
                if (isTextEntry(ev.target)) apply(true, /*force*/ true);
            }, true);

            document.addEventListener('focusout', () => {
                // Defer one turn: tabbing between two fields fires focusout then
                // focusin, and we don't want to bounce the keyboard to gameplay
                // for a frame in between. Re-read activeElement after it settles.
                setTimeout(() => apply(isTextEntry(document.activeElement)), 0);
            }, true);

            // Focus a field from code (not from a click). The listeners above
            // cannot carry this case: while the view has no keyboard focus the
            // page is not the focused document, so Chromium moves
            // document.activeElement without dispatching focusin — the field
            // looks focused, the engine keeps the keyboard, and the player types
            // into gameplay. Asking for capture directly breaks that deadlock.
            // Use this instead of el.focus() whenever code opens a text field.
            t.focusTextField = function (el) {
                if (!el) return;
                try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
                if (isTextEntry(el)) apply(true, /*force*/ true);
            };

            // Mirror of the above for closing: a blur while the page is not the
            // focused document fires no focusout either.
            t.blurTextField = function (el) {
                if (el && typeof el.blur === 'function') { try { el.blur(); } catch (e) {} }
                setTimeout(() => apply(isTextEntry(document.activeElement)), 0);
            };
        }

        // ---- Magazine helpers -------------------------------------------
        // Pick a random tagline from `taglines` and write it into `slot`
        // (an element or element-id). Appends `suffix` if provided. Used
        // for Minecraft-splash-style kicker lines on menu screens.
        t.kicker = function (slot, taglines, suffix) {
            const el = (typeof slot === 'string') ? document.getElementById(slot) : slot;
            if (!el || !taglines || !taglines.length) return;
            const pick = taglines[Math.floor(Math.random() * taglines.length)];
            el.textContent = pick + (suffix || '');
        };

        // ---- Item-icon URL helper (used everywhere we render an item) ----
        // Falls back to the catalog's itemIconUrl when present, otherwise the
        // /tex/ file-system path. Pages should call this instead of building
        // tex paths inline.
        t.iconUrlFor = function (itemId) {
            if (!itemId) return null;
            if (typeof t.itemIconUrl === 'function') return t.itemIconUrl(itemId);
            return `/tex/item-icon/${encodeURIComponent(itemId)}`;
        };
    }

    // ---- Custom cursor ---------------------------------------------------
    // Every live page gets the magazine cursor layer (shared/cursor.js —
    // arrow / target brackets / I-beam / map registration mark). Injected
    // here so no page has to remember the script tag; cursor.js self-guards
    // against the test harness and double-install.
    if (!document.querySelector('script[src*="/shared/cursor.js"]')) {
        var cursorScript = document.createElement('script');
        cursorScript.src = '/shared/cursor.js';
        cursorScript.defer = true;
        document.head.appendChild(cursorScript);
    }

    // The mock tsic in test-harness.js installs the namespace synchronously
    // before any page script runs; production C++ stamps it slightly later.
    // Either way, poll-and-install — this stays harmless if called twice.
    (function poll() {
        if (window.tsic) { install(window.tsic); return; }
        setTimeout(poll, 16);
    })();
})();

// ---- TEMP-PERF-PROBE (remove before commit) -------------------------------
(function () {
    function report(text) {
        try { window.tsic.publishMessage('UI.Cmd.Cheat.Execute', { Command: text }); } catch (e) {}
    }
    function rafRound(tag, done) {
        var c = 0, t0 = performance.now(), prev = t0, max = 0, over25 = 0;
        function f() {
            c++;
            var n = performance.now(), d = n - prev; prev = n;
            if (d > max) max = d;
            if (d > 25) over25++;
            if (n - t0 < 3000) { requestAnimationFrame(f); return; }
            report('RAFPROBE page=' + location.pathname + ' tag=' + tag +
                ' fps=' + (c / ((n - t0) / 1000)).toFixed(1) +
                ' worst=' + max.toFixed(1) + ' over25=' + over25);
            done && done();
        }
        requestAnimationFrame(f);
    }
    function moveMonitor() {
        var n = 0, sum = 0, max = 0, prev = 0;
        document.addEventListener('pointermove', function () {
            var t = performance.now();
            if (prev) { var d = t - prev; sum += d; if (d > max) max = d; }
            prev = t;
            n++;
        }, { passive: true, capture: true });
        setInterval(function () {
            if (n > 5) {
                report('MOVEPROBE page=' + location.pathname + ' n=' + n +
                    ' hz=' + (n / 5).toFixed(1) +
                    ' avg_gap=' + (sum / Math.max(1, n - 1)).toFixed(1) +
                    ' max_gap=' + max.toFixed(1));
            }
            n = 0; sum = 0; max = 0; prev = 0;
        }, 5000);
    }
    setTimeout(function () {
        rafRound('boot', null);
        moveMonitor();
        (function bindScreenProbe() {
            var t = window.tsic;
            if (!t || typeof t.on !== 'function') { setTimeout(bindScreenProbe, 500); return; }
            var busy = false, n = 0;
            t.on('tsic.msg.UI.Screen.Changed', function (p) {
                if (busy) return;
                busy = true;
                setTimeout(function () {
                    rafRound((p && p.Name ? p.Name : 'screen') + '-' + (n++), function () { busy = false; });
                }, 500);
            });
        })();
    }, 4000);
})();
