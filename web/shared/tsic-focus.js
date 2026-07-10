// shared/tsic-focus.js
//
// Focus engine for the SPA. Activates on pages that opt in via
//   <meta name="tsic-focus" content="enabled">
// Mirrors UI.Input.Mode.Changed onto <html data-tsic-input="..."> so CSS can
// branch on input mode regardless of whether the engine is active. When the
// page opts in, the engine takes over keyboard/D-pad navigation: spatial
// nearest-in-direction picks the next focus target, the ring is rendered via
// [data-tsic-focused], scrollable containers auto-follow, and modal scopes
// constrain navigation + restore caller focus on close.
//
// Input modes. In Gamepad mode the engine always drives focus. In
// MouseAndKeyboard mode the engine is dormant until the player presses a
// nav key (arrows — UI.Behavior.Nav*); that engages keyboard-nav, stamps
// <html data-tsic-kbnav> so the focus-ring CSS shows, and Accept/Back work
// exactly as on gamepad. Any real mouse movement or click disengages it and
// hands highlighting back to :hover. DOM focus is left in place on
// disengage, so the next arrow press resumes from the same element.
//
// Exposes window.tsic.focus.*:
//   enable() / disable() / isEnabled() / getMode()
//   refresh()                      // re-scan after dynamic re-render (currently a no-op
//                                  // because the focusable set is read fresh per step)
//   focus(elOrSel)                 // programmatically set focus
//   step(dir)                      // 'up'|'down'|'left'|'right' — spatial nearest
//   pushScope(rootEl, initialEl)   // modal scope; subsequent step() restricted to root
//   popScope()                     // restores caller focus
//   resetMemory()                  // clear per-screen focus memory (for tests)
//   snapshot()                     // debug — { mode, enabled, scope, focusable: [...] }
//   __focusableSet()               // (test-only) returns current focusable list
//   __stableSelector(el)           // (test-only) structural selector
//   __state                        // (test-only) internal state object
(function () {
    function install(t) {
        if (t.__focusInstalled) return;
        t.__focusInstalled = true;

        const State = {
            enabled: false,
            mode: 'MouseAndKeyboard',
            kbnav: false,        // keyboard-nav engaged while in MouseAndKeyboard mode
            backConsumedByScope: false, // Back popped a scope this dispatch — pages skip their close
            memory: {},          // per-screen last-focused stable selector
            scopeStack: [],      // [{ root, caller }]
            smoothScroll: true,  // tests flip this to 'instant'
        };

        // ---- DOM helpers --------------------------------------------------

        function stampMode(mode) {
            try { document.documentElement.setAttribute('data-tsic-input', mode); }
            catch (e) { /* document might not be ready in odd test cases */ }
        }

        function metaSaysEnabled() {
            const m = document.querySelector('meta[name="tsic-focus"]');
            return !!(m && m.getAttribute('content') === 'enabled');
        }

        // Keyboard-nav sub-state for MouseAndKeyboard mode. Engaged by the
        // first nav keypress, disengaged by mouse activity. The <html>
        // attribute gates the same focus-ring CSS the Gamepad attribute does.
        function setKbnav(on) {
            if (State.kbnav === on) return;
            State.kbnav = on;
            try {
                if (on) document.documentElement.setAttribute('data-tsic-kbnav', '');
                else document.documentElement.removeAttribute('data-tsic-kbnav');
            } catch (e) {}
            if (!on) {
                for (const stale of document.querySelectorAll('[data-tsic-focused]')) {
                    stale.removeAttribute('data-tsic-focused');
                }
            }
        }

        // True while the engine owns focus movement: always on gamepad,
        // on keyboard only once the player has started navigating by keys.
        function navDriving() {
            return State.mode === 'Gamepad' || State.kbnav;
        }

        function isFocusable(el) {
            if (!el || el.nodeType !== 1) return false;
            if (el.matches('[hidden], [disabled], [aria-hidden="true"], [data-tsic-skip-focus]')) return false;
            if (!el.matches('button, a[href], input:not([type=hidden]), select, textarea, [data-tsic-focusable]')) return false;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            return true;
        }

        // Like isFocusable but ignores zero-rect filter. Used when a scope was
        // just pushed and elements haven't laid out yet, or in environments
        // without real layout (jsdom in tests).
        function isStructurallyFocusable(el) {
            if (!el || el.nodeType !== 1) return false;
            if (el.matches('[hidden], [disabled], [aria-hidden="true"], [data-tsic-skip-focus]')) return false;
            return el.matches('button, a[href], input:not([type=hidden]), select, textarea, [data-tsic-focusable]');
        }

        function focusableSet(root) {
            const scope = root || document;
            return Array.from(scope.querySelectorAll(
                'button, a[href], input:not([type=hidden]), select, textarea, [data-tsic-focusable]'
            )).filter(isFocusable);
        }

        // DOM-order list (no rect filter). Used as a fallback for spatial nav
        // when no candidate has a measurable rect — e.g. inside a fresh portal
        // before layout or in a test environment.
        function structuralFocusableSet(root) {
            const scope = root || document;
            return Array.from(scope.querySelectorAll(
                'button, a[href], input:not([type=hidden]), select, textarea, [data-tsic-focusable]'
            )).filter(isStructurallyFocusable);
        }

        function screenKey() {
            const m = document.querySelector('meta[name="tsic-screen"]');
            return m ? m.getAttribute('content') : 'Unknown';
        }

        function stableSelector(el) {
            if (!el) return null;
            if (el.id) return '#' + el.id;
            if (el.dataset && el.dataset.tsicFocusId) {
                return '[data-tsic-focus-id="' + el.dataset.tsicFocusId + '"]';
            }
            const group = el.closest('[data-tsic-focus-group]') || document.body;
            const path = [];
            let n = el;
            while (n && n !== group && n.parentNode) {
                const sib = Array.from(n.parentNode.children).filter(c => c.tagName === n.tagName);
                path.unshift(n.tagName.toLowerCase() + ':nth-of-type(' + (sib.indexOf(n) + 1) + ')');
                n = n.parentNode;
            }
            const prefix = (group.dataset && group.dataset.tsicFocusGroup)
                ? '[data-tsic-focus-group="' + group.dataset.tsicFocusGroup + '"] '
                : '';
            return prefix + path.join(' > ');
        }

        function findInitial() {
            return document.querySelector('[data-tsic-initial-focus]');
        }

        // ---- Spatial-nearest ---------------------------------------------

        function centre(rect) { return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; }

        function pickNeighbor(from, dir, candidates) {
            if (!from) return null;
            const fr = from.getBoundingClientRect();
            const fc = centre(fr);
            // Two-pass scoring. Pass A (overlap): only candidates whose
            // perpendicular extent overlaps the source rect — i.e. "things
            // on the same row" for L/R, "same column" for U/D. Among those
            // we pick by directional distance only. Pass B (fallback): no
            // overlap exists, fall back to spatial-nearest with a perp
            // penalty so we still favour aligned-ish targets.
            //
            // Without this, a button slightly to the left and well above
            // the source (dirDist=9, perpOffset=85) beats a far-but-aligned
            // button on the same row (dirDist=367, perpOffset=0) — that's
            // the new-store Back↔Create "L/R doesn't reach the logical
            // neighbour" bug.
            let bestOverlap = null, bestOverlapScore = Infinity, bestOverlapIdx = Infinity;
            let bestAny = null, bestAnyScore = Infinity, bestAnyIdx = Infinity;
            candidates.forEach((c, idx) => {
                if (c === from) return;
                const cr = c.getBoundingClientRect();
                const cc = centre(cr);
                let dirDist = 0, perpOffset = 0, inHalfPlane = false, overlaps = false;
                switch (dir) {
                    case 'up':
                        inHalfPlane = cc.y < fc.y - 1;
                        dirDist = fc.y - cc.y;
                        perpOffset = Math.abs(cc.x - fc.x);
                        overlaps = cr.left < fr.right && cr.right > fr.left;
                        break;
                    case 'down':
                        inHalfPlane = cc.y > fc.y + 1;
                        dirDist = cc.y - fc.y;
                        perpOffset = Math.abs(cc.x - fc.x);
                        overlaps = cr.left < fr.right && cr.right > fr.left;
                        break;
                    case 'left':
                        inHalfPlane = cc.x < fc.x - 1;
                        dirDist = fc.x - cc.x;
                        perpOffset = Math.abs(cc.y - fc.y);
                        overlaps = cr.top < fr.bottom && cr.bottom > fr.top;
                        break;
                    case 'right':
                        inHalfPlane = cc.x > fc.x + 1;
                        dirDist = cc.x - fc.x;
                        perpOffset = Math.abs(cc.y - fc.y);
                        overlaps = cr.top < fr.bottom && cr.bottom > fr.top;
                        break;
                }
                if (!inHalfPlane) return;
                if (overlaps) {
                    if (dirDist < bestOverlapScore || (dirDist === bestOverlapScore && idx < bestOverlapIdx)) {
                        bestOverlap = c;
                        bestOverlapScore = dirDist;
                        bestOverlapIdx = idx;
                    }
                }
                const score = dirDist + perpOffset * 3;
                if (score < bestAnyScore || (score === bestAnyScore && idx < bestAnyIdx)) {
                    bestAny = c;
                    bestAnyScore = score;
                    bestAnyIdx = idx;
                }
            });
            return bestOverlap || bestAny;
        }

        // ---- Scroll into view --------------------------------------------

        function scrollFocusIntoView(el) {
            let n = el.parentElement;
            let container = null;
            while (n && n !== document.body) {
                const cs = getComputedStyle(n);
                if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && n.scrollHeight > n.clientHeight) {
                    container = n; break;
                }
                n = n.parentElement;
            }
            if (!container) return;
            const margin = (el.getBoundingClientRect().height || 28) * 1.5;
            const cRect = container.getBoundingClientRect();
            const eRect = el.getBoundingClientRect();
            const behavior = (State.smoothScroll === false) ? 'instant' : 'smooth';
            if (eRect.top - margin < cRect.top) {
                container.scrollBy({ top: (eRect.top - margin) - cRect.top, behavior: behavior });
            } else if (eRect.bottom + margin > cRect.bottom) {
                container.scrollBy({ top: (eRect.bottom + margin) - cRect.bottom, behavior: behavior });
            }
        }

        // ---- Public API --------------------------------------------------

        const api = {
            enable() {
                State.enabled = true;
                if (State.mode === 'Gamepad') applyInitialFocus();
            },
            disable() { State.enabled = false; },
            isEnabled() { return State.enabled; },
            getMode() { return State.mode; },

            refresh() {
                // No cached state — focusable list is read fresh on every step.
                // Hook exists so pages can call after re-rendering without
                // changing call sites if we add caching later.
            },

            focus(elOrSel, opts) {
                const el = (typeof elOrSel === 'string') ? document.querySelector(elOrSel) : elOrSel;
                if (!el) return false;
                // opts.trust: skip rect-based isFocusable. Used by pushScope
                // when the caller explicitly names the initial element (e.g.
                // dropdown portals whose <li>s haven't been laid out yet).
                if (!(opts && opts.trust) && !isFocusable(el)) return false;
                try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (_) {} }
                for (const stale of document.querySelectorAll('[data-tsic-focused]')) {
                    if (stale !== el) stale.removeAttribute('data-tsic-focused');
                }
                el.setAttribute('data-tsic-focused', '');
                const sel = stableSelector(el);
                if (sel) State.memory[screenKey()] = sel;
                try { scrollFocusIntoView(el); } catch (e) {}
                return true;
            },

            step(dir) {
                if (!State.enabled || !navDriving()) return false;
                const scopeRoot = State.scopeStack.length > 0
                    ? State.scopeStack[State.scopeStack.length - 1].root
                    : document;
                let candidates = focusableSet(scopeRoot);
                // Layout-less fallback: nothing has a measurable rect (fresh
                // portal, or jsdom-style test env). Use the structural list
                // and DOM-order navigation instead of spatial-nearest.
                const layoutless = candidates.length === 0;
                if (layoutless) candidates = structuralFocusableSet(scopeRoot);
                if (candidates.length === 0) return false;
                // activeElement reverts to <body> the moment focus leaves the
                // iframe — e.g. the playground's host-page direction buttons
                // steal focus on click. Fall back to the engine's own ring
                // marker so navigation resumes from where it left off instead
                // of bouncing to initial on every press.
                let cur = document.activeElement;
                if (!cur || !candidates.includes(cur)) {
                    const marked = (scopeRoot.querySelector
                        ? scopeRoot.querySelector('[data-tsic-focused]')
                        : document.querySelector('[data-tsic-focused]'));
                    if (marked && candidates.includes(marked)) cur = marked;
                }
                if (!cur || !candidates.includes(cur)) {
                    const init = findInitial();
                    if (init && candidates.includes(init)) return api.focus(init, { trust: layoutless });
                    return api.focus(candidates[0], { trust: layoutless });
                }
                // Author-declared override: data-tsic-nav-<dir> holds a CSS selector
                // for a transition spatial math cannot infer — e.g. a tab strip whose
                // page content sits below-LEFT of it, where the only rect-overlapping
                // candidate below is a full-width footer button. First focusable match
                // wins; a missing/hidden target falls through to spatial. Scoped
                // navigation never escapes the scope root.
                const hintSel = cur.getAttribute && cur.getAttribute('data-tsic-nav-' + dir);
                if (hintSel) {
                    let hinted = null;
                    try {
                        for (const m of document.querySelectorAll(hintSel)) {
                            if (State.scopeStack.length > 0 && !scopeRoot.contains(m)) continue;
                            if (layoutless ? isStructurallyFocusable(m) : isFocusable(m)) { hinted = m; break; }
                        }
                    } catch (e) {}
                    if (hinted) return api.focus(hinted, { trust: layoutless });
                }
                if (layoutless) {
                    // DOM order. Up/Left = previous, Down/Right = next.
                    const idx = candidates.indexOf(cur);
                    const delta = (dir === 'up' || dir === 'left') ? -1 : 1;
                    const next = candidates[idx + delta];
                    if (!next) return false;
                    return api.focus(next, { trust: true });
                }
                const next = pickNeighbor(cur, dir, candidates);
                if (!next) return false;
                return api.focus(next);
            },

            pushScope(root, initial, opts) {
                if (!root) return false;
                const caller = document.activeElement;
                const onPop = (opts && typeof opts.onPop === 'function') ? opts.onPop : null;
                State.scopeStack.push({ root: root, caller: caller, onPop: onPop });
                const target = (typeof initial === 'string') ? root.querySelector(initial) : initial;
                if (target) {
                    // Caller explicitly named the initial target — trust it and
                    // focus without re-running the rect-based isFocusable check.
                    // This matters for portals (the dropdown's <li> options)
                    // whose layout hasn't been measured yet.
                    api.focus(target, { trust: true });
                } else {
                    const found = focusableSet(root)[0];
                    if (found) api.focus(found);
                }
                return true;
            },

            popScope() {
                if (State.scopeStack.length === 0) return false;
                const frame = State.scopeStack.pop();
                // Let the scope owner (e.g. tsic-dropdown) clean up its DOM.
                if (frame.onPop) {
                    try { frame.onPop(); } catch (e) { console.warn('[tsic-focus] onPop threw', e); }
                }
                if (frame.caller && isFocusable(frame.caller)) api.focus(frame.caller);
                return true;
            },

            resetMemory() { State.memory = {}; },

            // True when a Back press is (or just was) consumed by popping a
            // modal scope. Router/screen-manager check this before publishing
            // their close command so one Esc/B press closes the dropdown, not
            // the whole screen. Covers both listener orders: scope still open
            // (they ran first) or the just-popped flag (engine ran first).
            backHandled() {
                return State.scopeStack.length > 0 || State.backConsumedByScope;
            },

            snapshot() {
                return {
                    mode: State.mode,
                    enabled: State.enabled,
                    kbnav: State.kbnav,
                    scope: State.scopeStack.length,
                    focusable: focusableSet().length,
                };
            },

            // Test-only escape hatches.
            __focusableSet: focusableSet,
            __structuralFocusableSet: structuralFocusableSet,
            __stableSelector: stableSelector,
            __state: State,
        };

        function applyInitialFocus() {
            const saved = State.memory[screenKey()];
            if (saved) {
                let restored = null;
                try { restored = document.querySelector(saved); } catch (e) { restored = null; }
                if (restored && isStructurallyFocusable(restored)) {
                    api.focus(restored, { trust: true });
                    return;
                }
            }
            const init = findInitial();
            // Trust the author's declaration — initial-focus is the canonical
            // landing element. We accept it even if its rect hasn't been
            // measured yet (page just rendered, layout-less env, etc.).
            if (init && isStructurallyFocusable(init)) {
                api.focus(init, { trust: true });
                return;
            }
            // Last resort: the first focusable in the layout if there is one,
            // else the first structurally focusable so navigation can start.
            const first = focusableSet()[0] || structuralFocusableSet()[0];
            if (first) api.focus(first, { trust: true });
        }

        t.focus = api;

        // ---- Channel wiring ----------------------------------------------

        t.on('tsic.msg.UI.Input.Mode.Changed', (payload) => {
            const mode = (payload && payload.Mode) || 'MouseAndKeyboard';
            State.mode = mode;
            stampMode(mode);
            setKbnav(false);
            if (!State.enabled) return;
            if (mode === 'Gamepad') {
                try { t.setInteractiveRects && t.setInteractiveRects([]); } catch (e) {}
                applyInitialFocus();
            } else {
                // Restore default (whole-view interactive) for the page's mouse
                // mode. Pages that maintain their own rects re-publish them.
                try { t.setInteractiveRects && t.setInteractiveRects([{ x: 0, y: 0, w: 99999, h: 99999 }]); } catch (e) {}
                // Strip every focused marker — mouse users get the existing
                // :hover styling, the focused-state CSS should never apply.
                for (const stale of document.querySelectorAll('[data-tsic-focused]')) {
                    stale.removeAttribute('data-tsic-focused');
                }
            }
        });

        // Returns the element gamepad nav should treat as "current" —
        // activeElement if it's a real focus, else the engine's own marker
        // (matches the same fallback step()/Confirm use after iframe focus
        // loss).
        function currentFocused() {
            const a = document.activeElement;
            if (a && a !== document.body) return a;
            return document.querySelector('[data-tsic-focused]');
        }

        // Slider helper: L/R on a focused <input type=range> nudges the
        // value by one step instead of moving focus. U/D still moves focus
        // out of the slider row so navigation flows naturally.
        function nudgeRange(el, dir) {
            const step = Number(el.step) || 1;
            const min = Number(el.min);
            const max = Number(el.max);
            const cur = Number(el.value) || 0;
            const delta = (dir === 'right') ? step : -step;
            let next = cur + delta;
            if (!Number.isNaN(min)) next = Math.max(min, next);
            if (!Number.isNaN(max)) next = Math.min(max, next);
            if (next === cur) return;
            el.value = String(next);
            // Both events so any listener (oninput / onchange) reacts.
            try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
            try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        }

        // Move focus one step; for sliders, L/R nudges the value instead of jumping columns.
        function navStep(dir) {
            if (!State.enabled) return;
            // A nav keypress in MouseAndKeyboard mode engages keyboard-nav.
            // (Keys can't reach here while a text field is focused — the
            // runtime hands keyboard capture to CEF for typing, so Enhanced
            // Input behaviors don't fire; see tsic-runtime.js.)
            if (State.mode !== 'Gamepad') setKbnav(true);
            if (dir === 'left' || dir === 'right') {
                const cur = currentFocused();
                if (cur && cur.tagName === 'INPUT' && cur.type === 'range' && !cur.disabled) {
                    nudgeRange(cur, dir);
                    return;
                }
            }
            api.step(dir);
        }

        // Analog stick menu navigation (gamepad). BH_Navigate is a 2D axis behaviour.
        // -Infinity, not 0: performance.now() is epoched at page start, so 0 would
        // swallow every flick in the page's first 180ms (the repeat-limit window).
        let lastNavAt = -Infinity;
        t.on('tsic.msg.UI.Behavior.Navigate', (payload) => {
            if (!State.enabled || State.mode !== 'Gamepad') return;
            const phase = payload && payload.Phase;
            if (phase !== 'Started' && phase !== 'Triggered' && phase !== 'Axis') return;
            const v = (payload && payload.Value) || { X: 0, Y: 0 };
            const ax = Math.abs(v.X), ay = Math.abs(v.Y);
            if (ax < 0.4 && ay < 0.4) return;
            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            if ((now - lastNavAt) < 180) return;
            lastNavAt = now;
            const dir = (ax > ay)
                ? (v.X > 0 ? 'right' : 'left')
                : (v.Y > 0 ? 'up' : 'down');
            navStep(dir);
        });

        // Discrete directional nav: arrow keys (KBM) and D-pad (gamepad), one step per press.
        t.on('tsic.msg.UI.Behavior.NavUp',    (p) => { if (p && p.Phase === 'Started') navStep('up'); });
        t.on('tsic.msg.UI.Behavior.NavDown',  (p) => { if (p && p.Phase === 'Started') navStep('down'); });
        t.on('tsic.msg.UI.Behavior.NavLeft',  (p) => { if (p && p.Phase === 'Started') navStep('left'); });
        t.on('tsic.msg.UI.Behavior.NavRight', (p) => { if (p && p.Phase === 'Started') navStep('right'); });

        t.on('tsic.msg.UI.Behavior.Accept', (payload) => {
            if (!State.enabled || !navDriving()) return;
            if (!payload || payload.Phase !== 'Started') return;
            const a = document.activeElement;
            // Same fallback as step() — when iframe lost focus the marker is the
            // source of truth.
            const target = (a && a !== document.body) ? a : document.querySelector('[data-tsic-focused]');
            if (!target) return;
            // Pages with a "select vs commit" distinction (list rows where
            // single-click selects and double-click commits) listen for a
            // 'tsic:confirm' event and call preventDefault to suppress the
            // click fallback. Plain buttons ignore the event and get a
            // regular el.click().
            let proceed = true;
            try {
                const ev = new CustomEvent('tsic:confirm', { bubbles: true, cancelable: true });
                proceed = target.dispatchEvent(ev);
            } catch (e) { /* old DOM — skip and click directly */ }
            if (proceed && typeof target.click === 'function') {
                try { target.click(); } catch (e) { console.warn('[tsic-focus] confirm click failed', e); }
            }
        });

        // Back pops an open modal scope in ANY input mode — a mouse user's
        // Esc must close the dropdown they clicked open, not the screen.
        // The consumed flag lets the page's own Back handler (router /
        // screen-manager via backHandled()) skip its close for this press;
        // it clears after the current dispatch settles.
        t.on('tsic.msg.UI.Behavior.Back', (payload) => {
            if (!State.enabled) return;
            if (!payload || payload.Phase !== 'Started') return;
            if (State.scopeStack.length === 0) return;
            api.popScope();
            State.backConsumedByScope = true;
            setTimeout(() => { State.backConsumedByScope = false; }, 0);
        });

        // Mouse activity ends keyboard-nav: the ring hides, :hover takes
        // back over. DOM focus is intentionally left alone so arrows resume
        // from the same element. Capture phase so no page handler can
        // swallow the event first.
        let lastMouseX = NaN, lastMouseY = NaN;
        document.addEventListener('mousemove', (ev) => {
            const moved = ev.clientX !== lastMouseX || ev.clientY !== lastMouseY;
            lastMouseX = ev.clientX; lastMouseY = ev.clientY;
            if (moved && State.kbnav) setKbnav(false);
        }, true);
        document.addEventListener('mousedown', () => {
            if (State.kbnav) setKbnav(false);
        }, true);

        // Next/Prev tab — cycles tabs in a [data-tsic-tab-bar] container.
        // Picks the tab bar nearest to current focus so multi-pane screens
        // (e.g. storage's player ↔ container split) route tab keys to the
        // side you're currently in. Falls back to the first tab bar on the
        // page if focus isn't inside one.
        //
        // Tab bar convention:
        //   <div data-tsic-tab-bar>
        //     <button class="my-tab active">A</button>
        //     <button class="my-tab">B</button>
        //   </div>
        // Active class: any of .active / .is-active / [aria-selected=true].
        function findTabBar() {
            const focus = currentFocused();
            if (focus) {
                const inside = focus.closest && focus.closest('[data-tsic-tab-bar]');
                if (inside) return inside;
                // Focus might be in a side pane that *contains* a tab bar
                // alongside the list. Walk up looking for a tab-context that
                // declares its associated bar.
                const ctx = focus.closest && focus.closest('[data-tsic-tab-context]');
                if (ctx) {
                    const bar = ctx.querySelector('[data-tsic-tab-bar]');
                    if (bar) return bar;
                }
            }
            return document.querySelector('[data-tsic-tab-bar]');
        }
        function isActiveTab(el) {
            return el.classList.contains('active')
                || el.classList.contains('is-active')
                || el.getAttribute('aria-selected') === 'true';
        }
        function cycleTab(delta) {
            const bar = findTabBar();
            if (!bar) return false;
            const tabs = Array.from(bar.children).filter(c => c.nodeType === 1);
            if (tabs.length === 0) return false;
            const activeIdx = tabs.findIndex(isActiveTab);
            const fromIdx = activeIdx >= 0 ? activeIdx : 0;
            const nextIdx = (fromIdx + delta + tabs.length) % tabs.length;
            const next = tabs[nextIdx];
            if (next && typeof next.click === 'function') {
                try { next.click(); } catch (e) {}
            }
            return true;
        }
        t.on('tsic.msg.UI.Behavior.NextTab', (payload) => {
            if (!payload || payload.Phase !== 'Started') return;
            cycleTab(+1);
        });
        t.on('tsic.msg.UI.Behavior.PrevTab', (payload) => {
            if (!payload || payload.Phase !== 'Started') return;
            cycleTab(-1);
        });

        // IA_UI_NextPage / IA_UI_PreviousPage — page-jump the nearest
        // scrollable ancestor of the focused element. Falls back to the
        // active scrolling root when no element is focused.
        function pageStep(delta) {
            const focused = document.querySelector('[data-tsic-focused]') || document.activeElement;
            let scroller = focused;
            while (scroller && scroller !== document.body) {
                const cs = getComputedStyle(scroller);
                const oy = cs.overflowY;
                if ((oy === 'auto' || oy === 'scroll') && scroller.scrollHeight > scroller.clientHeight) {
                    break;
                }
                scroller = scroller.parentElement;
            }
            const target = (scroller && scroller !== document.body) ? scroller : document.scrollingElement;
            if (!target) return;
            const step = (target.clientHeight || window.innerHeight) * 0.9 * delta;
            target.scrollBy({ top: step, left: 0, behavior: 'auto' });
        }
        t.on('tsic.msg.UI.Behavior.NextPage', (payload) => {
            if (!payload || payload.Phase !== 'Started') return;
            pageStep(+1);
        });
        t.on('tsic.msg.UI.Behavior.PrevPage', (payload) => {
            if (!payload || payload.Phase !== 'Started') return;
            pageStep(-1);
        });

        // First-paint stamp so CSS can branch immediately.
        stampMode(State.mode);

        // ---- :hover → [data-tsic-focused] mirror ------------------------
        // CSS :hover is a UA-controlled state; we can't toggle it from JS.
        // To make focused elements look hovered without authors having to
        // duplicate every :hover rule, walk the stylesheets once and
        // synthesise a matching [data-tsic-focused] rule for every :hover
        // rule, gated to html[data-tsic-input="Gamepad"]. Inserted as a
        // single <style id="tsic-focus-hover-mirror"> at the end of <head>
        // so it wins on equal specificity.
        function mirrorHoverRules() {
            if (document.getElementById('tsic-focus-hover-mirror')) return;
            const mirrors = [];
            for (const sheet of Array.from(document.styleSheets)) {
                let rules = null;
                try { rules = sheet.cssRules; } catch (e) { continue; /* cross-origin */ }
                if (!rules) continue;
                walkRules(rules, mirrors);
            }
            if (mirrors.length === 0) return;
            const style = document.createElement('style');
            style.id = 'tsic-focus-hover-mirror';
            style.textContent = mirrors.join('\n');
            document.head.appendChild(style);
        }
        function walkRules(rules, out) {
            for (const rule of Array.from(rules)) {
                // Style rule — the common case.
                if (rule.type === 1 /* CSSRule.STYLE_RULE */) {
                    const mirrored = mirrorSelector(rule.selectorText || '');
                    if (mirrored && rule.style && rule.style.cssText) {
                        out.push(mirrored + ' { ' + rule.style.cssText + ' }');
                    }
                    continue;
                }
                // @media / @supports — recurse and re-wrap.
                if (rule.cssRules && (rule.type === 4 || rule.type === 12)) {
                    const inner = [];
                    walkRules(rule.cssRules, inner);
                    if (inner.length === 0) continue;
                    const condition = (rule.media && rule.media.mediaText)
                        || (rule.conditionText || '');
                    const at = (rule.type === 4) ? '@media' : '@supports';
                    out.push(at + ' ' + condition + ' {\n' + inner.join('\n') + '\n}');
                }
            }
        }
        function mirrorSelector(selectorText) {
            if (!selectorText || selectorText.indexOf(':hover') === -1) return null;
            const parts = selectorText.split(',').map(s => s.trim()).filter(Boolean);
            const mapped = [];
            for (const p of parts) {
                if (p.indexOf(':hover') === -1) continue;
                // Replace :hover with our focused attribute. Multiple :hover
                // in one selector (rare, e.g. .a:hover .b:hover) — replace all.
                const focused = p.replace(/:hover/g, '[data-tsic-focused]');
                mapped.push('html:is([data-tsic-input="Gamepad"], [data-tsic-kbnav]) ' + focused);
            }
            return mapped.length ? mapped.join(', ') : null;
        }
        // Run after the page's CSS has loaded. <link rel="stylesheet"> blocks
        // before DOMContentLoaded, but @import inside an existing sheet may
        // resolve a tick later — give it one rAF.
        function scheduleMirror() {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => requestAnimationFrame(mirrorHoverRules));
            } else {
                setTimeout(mirrorHoverRules, 32);
            }
        }
        if (document.readyState === 'complete') scheduleMirror();
        else window.addEventListener('load', scheduleMirror, { once: true });

        if (metaSaysEnabled()) {
            // Defer to next tick so the page's render pass can populate
            // [data-tsic-initial-focus] elements before we look for them.
            setTimeout(() => api.enable(), 0);
        }
    }

    (function poll() {
        if (window.tsic && typeof window.tsic.on === 'function') { install(window.tsic); return; }
        setTimeout(poll, 16);
    })();
})();
