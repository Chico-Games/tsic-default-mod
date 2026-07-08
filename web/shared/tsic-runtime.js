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
        t.playSound    = (key, vol) => t.publishMessage('UI.Cmd.Sound.Play',
            { SoundKey: key, VolumeScale: typeof vol === 'number' ? vol : 1.0 });

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
                if (o.handler) { o.handler(); return; }
                if (o.closeScreen) { t.closeScreen(); return; }
                t.resume();
            });
        };

        // Wires a close-button (#btn-close by default) to the same behaviour.
        t.bindCloseButton = function (selectorOrEl, opts) {
            return t.onClick(selectorOrEl || '#btn-close', () => {
                const o = opts || {};
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
            const apply = (want) => {
                want = !!want;
                if (want === captured) return;
                captured = want;
                if (typeof t.setFocusCapture === 'function') t.setFocusCapture(want);
            };

            document.addEventListener('focusin', (ev) => {
                if (isTextEntry(ev.target)) apply(true);
            }, true);

            document.addEventListener('focusout', () => {
                // Defer one turn: tabbing between two fields fires focusout then
                // focusin, and we don't want to bounce the keyboard to gameplay
                // for a frame in between. Re-read activeElement after it settles.
                setTimeout(() => apply(isTextEntry(document.activeElement)), 0);
            }, true);
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
