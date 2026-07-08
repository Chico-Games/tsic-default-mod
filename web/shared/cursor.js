// shared/cursor.js — the magazine-print custom mouse cursor.
//
// One fixed, pointer-events:none layer that follows the mouse and swaps art
// by context:
//   arrow — ink pointer with a hard red offset shadow (default)
//   hot   — red target brackets, centered (buttons, rows, tabs, links…)
//   text  — ink I-beam (text inputs / textareas / contenteditable)
//   map   — printer's registration mark (inside [data-cursor="map"])
// Click feedback is a small red ring ripple plus a quick press on the art.
//
// The native cursor is hidden with `cursor: none` — CEF reports CT_NONE and
// the WebUI plugin maps that to EMouseCursor::None, so the hardware cursor
// disappears while the web view is hovered (CEFWebInterfaceBrowserWindow).
//
// Loaded on every page by tsic-runtime.js. Self-guards: skips the headless
// test harness, never double-installs. Hidden while the game owns the mouse
// (UI.Input.Mode.Changed) and in gamepad mode (html[data-tsic-input]).
//
// All colors carry literal fallbacks so the layer also works on pages that
// don't load base.css (e.g. cursor-lab.html opened straight in Chrome).
(function () {
    'use strict';

    if (window.__tsicCursorInstalled) return;
    // Headless component tests host live modules — an extra overlay + forced
    // cursor:none is noise there, not coverage.
    if (document.querySelector('script[src*="test-harness"]')) return;
    window.__tsicCursorInstalled = true;

    // Shared arrow silhouette (tip at 1,1 in a 0 0 14 19 box).
    var ARROW = 'M1 1 L1 15.4 L4.6 12 L7 17.6 L9.6 16.5 L7.2 11 L12 11 Z';

    var STYLE = [
        '/* Hide the native cursor everywhere; the layer below replaces it. */',
        'html.tsic-cursor-on, html.tsic-cursor-on *, html.tsic-cursor-on *::before, html.tsic-cursor-on *::after { cursor: none !important; }',
        '',
        '#tsic-cursor {',
        '  --cu-ink:   var(--ink-night, #0a0a0a);',
        '  --cu-red:   var(--mag-red, #e60000);',
        '  --cu-paper: var(--paper-bright, #fffdf3);',
        '  position: fixed; left: 0; top: 0;',
        '  z-index: 2147483647;',
        '  pointer-events: none;',
        '  will-change: transform;',
        '  transition: opacity 100ms ease;',
        '}',
        '#tsic-cursor.is-gone, #tsic-cursor.is-suppressed { opacity: 0; }',
        'html[data-tsic-input="Gamepad"] #tsic-cursor { opacity: 0; }',
        '',
        '/* Variants stack at the hotspot; the active one fades/scales in. */',
        '#tsic-cursor .cu-v {',
        '  position: absolute;',
        '  opacity: 0;',
        '  transform: scale(0.6);',
        '  transition: opacity 70ms ease, transform 70ms ease;',
        '}',
        '',
        '/* arrow — hotspot at the tip. */',
        '.cu-arrow { left: -1px; top: -1px; transform-origin: 2px 2px; }',
        '#tsic-cursor[data-mode="arrow"] .cu-arrow { opacity: 1; transform: scale(1); }',
        '#tsic-cursor[data-mode="arrow"].is-down .cu-arrow { transform: scale(0.88); }',
        '.cu-arrow .a-sh { fill: var(--cu-red); }',
        '.cu-arrow .a-main { fill: var(--cu-ink); stroke: var(--cu-paper); stroke-width: 1.2; }',
        '',
        '/* hot — red target brackets centered on the pointer. */',
        '.cu-brackets { left: -15px; top: -15px; width: 30px; height: 30px; transform-origin: center; }',
        '#tsic-cursor[data-mode="hot"] .cu-brackets { opacity: 1; transform: scale(1); animation: tsic-cu-pulse 900ms ease-in-out infinite; }',
        '#tsic-cursor[data-mode="hot"].is-down .cu-brackets { animation: none; transform: scale(0.82); }',
        '.cu-brackets i {',
        '  position: absolute; width: 9px; height: 9px;',
        '  border: 3px solid var(--cu-red);',
        '  filter: drop-shadow(1.5px 1.5px 0 var(--cu-paper));',
        '}',
        '.cu-brackets .tl { left: 0;  top: 0;    border-right: 0; border-bottom: 0; }',
        '.cu-brackets .tr { right: 0; top: 0;    border-left: 0;  border-bottom: 0; }',
        '.cu-brackets .bl { left: 0;  bottom: 0; border-right: 0; border-top: 0; }',
        '.cu-brackets .br { right: 0; bottom: 0; border-left: 0;  border-top: 0; }',
        '.cu-brackets .dot {',
        '  position: absolute; left: 50%; top: 50%;',
        '  width: 4px; height: 4px; margin: -2px 0 0 -2px;',
        '  background: var(--cu-red);',
        '  box-shadow: 1px 1px 0 var(--cu-paper);',
        '}',
        '@keyframes tsic-cu-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.09); } }',
        '',
        '/* text — I-beam centered on the pointer. */',
        '.cu-ibeam { left: -8px; top: -12px; transform-origin: center; }',
        '#tsic-cursor[data-mode="text"] .cu-ibeam { opacity: 1; transform: scale(1); }',
        '#tsic-cursor[data-mode="text"].is-down .cu-ibeam { transform: scale(0.9); }',
        '.cu-ibeam .i-sh { stroke: var(--cu-red); stroke-width: 2.2; }',
        '.cu-ibeam .i-halo { stroke: var(--cu-paper); stroke-width: 5; }',
        '.cu-ibeam .i-main { stroke: var(--cu-ink); stroke-width: 2.2; }',
        '',
        '/* map — printer registration mark centered on the pointer.',
        '   map-hot = over a pickable POI: locked on — 45°, red, slightly grown. */',
        '.cu-reg { left: -18px; top: -18px; transform-origin: center; transition: opacity 70ms ease, transform 140ms ease; }',
        '#tsic-cursor[data-mode="map"] .cu-reg { opacity: 1; transform: scale(1); }',
        '#tsic-cursor[data-mode="map"].is-down .cu-reg { transform: rotate(45deg) scale(0.9); }',
        '#tsic-cursor[data-mode="map-hot"] .cu-reg { opacity: 1; transform: rotate(45deg) scale(1.12); }',
        '#tsic-cursor[data-mode="map-hot"].is-down .cu-reg { transform: rotate(45deg) scale(0.9); }',
        '.cu-reg .r-halo { stroke: var(--cu-paper); stroke-width: 5; fill: none; }',
        '.cu-reg .r-main { stroke: var(--cu-ink); stroke-width: 2.2; fill: none; }',
        '#tsic-cursor[data-mode="map"].is-down .cu-reg .r-main,',
        '#tsic-cursor[data-mode="map-hot"] .cu-reg .r-main { stroke: var(--cu-red); }',
        '.cu-reg .r-dot { fill: var(--cu-red); }',
        '',
        '/* click ripple — small red ring, quick fade. */',
        '.tsic-cursor-ripple {',
        '  position: fixed; left: 0; top: 0;',
        '  width: 22px; height: 22px; margin: -11px 0 0 -11px;',
        '  border: 2px solid var(--mag-red, #e60000);',
        '  border-radius: 50%;',
        '  z-index: 2147483646;',
        '  pointer-events: none;',
        '  animation: tsic-cu-ripple 200ms ease-out forwards;',
        '}',
        '@keyframes tsic-cu-ripple {',
        '  from { transform: scale(0.35); opacity: 0.55; }',
        '  to   { transform: scale(1);    opacity: 0; }',
        '}',
    ].join('\n');

    var HTML = [
        '<svg class="cu-v cu-arrow" width="28" height="38" viewBox="-1 -1 17 22">',
        '  <path class="a-sh" d="' + ARROW + '" transform="translate(1.6 1.6)"/>',
        '  <path class="a-main" d="' + ARROW + '"/>',
        '</svg>',
        '<div class="cu-v cu-brackets"><i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i><span class="dot"></span></div>',
        '<svg class="cu-v cu-ibeam" width="16" height="24" viewBox="0 0 16 24">',
        '  <g class="i-sh" transform="translate(1.4 1.4)"><line x1="4" y1="3" x2="12" y2="3"/><line x1="8" y1="3" x2="8" y2="21"/><line x1="4" y1="21" x2="12" y2="21"/></g>',
        '  <g class="i-halo"><line x1="4" y1="3" x2="12" y2="3"/><line x1="8" y1="3" x2="8" y2="21"/><line x1="4" y1="21" x2="12" y2="21"/></g>',
        '  <g class="i-main"><line x1="4" y1="3" x2="12" y2="3"/><line x1="8" y1="3" x2="8" y2="21"/><line x1="4" y1="21" x2="12" y2="21"/></g>',
        '</svg>',
        '<svg class="cu-v cu-reg" width="36" height="36" viewBox="0 0 36 36">',
        '  <g class="r-halo"><circle cx="18" cy="18" r="10"/><line x1="18" y1="3" x2="18" y2="33"/><line x1="3" y1="18" x2="33" y2="18"/></g>',
        '  <g class="r-main"><circle cx="18" cy="18" r="10"/><line x1="18" y1="3" x2="18" y2="33"/><line x1="3" y1="18" x2="33" y2="18"/></g>',
        '  <circle class="r-dot" cx="18" cy="18" r="2.2"/>',
        '</svg>',
    ].join('\n');

    // Context detection. Text beats everything, then interactive, then map.
    var HOT_SEL = [
        'button', 'a', '[role="button"]', 'select',
        '.tsic-list-row', '.tsic-tab', '.tsic-context-item', '.tsic-dropdown',
        'li[role="option"]', 'input[type="range"]', 'input[type="checkbox"]',
        'input[type="radio"]', '[data-cursor="hot"]',
    ].join(', ');
    var MAP_SEL = '[data-cursor="map"]';
    var TEXT_TYPES = {
        text: 1, search: 1, email: 1, url: 1, tel: 1, password: 1, number: 1,
        date: 1, time: 1, 'datetime-local': 1, month: 1, week: 1,
    };

    function isTextEntry(el) {
        if (el.isContentEditable) return true;
        var tag = el.tagName;
        if (tag === 'TEXTAREA') return true;
        if (tag === 'INPUT') {
            var type = (el.getAttribute('type') || 'text').toLowerCase();
            return !!TEXT_TYPES[type];
        }
        return false;
    }

    function modeFor(el) {
        if (!el || el.nodeType !== 1 || !el.closest) return 'arrow';
        if (isTextEntry(el)) return 'text';
        if (el.closest(HOT_SEL)) return 'hot';
        var mapEl = el.closest(MAP_SEL);
        // data-cursor-poi is toggled by the map screen's pick logic (POIs are
        // hit-tested in code, not DOM-hoverable elements).
        if (mapEl) return mapEl.hasAttribute('data-cursor-poi') ? 'map-hot' : 'map';
        return 'arrow';
    }

    function mount() {
        var style = document.createElement('style');
        style.id = 'tsic-cursor-style';
        style.textContent = STYLE;
        document.head.appendChild(style);

        var root = document.createElement('div');
        root.id = 'tsic-cursor';
        root.dataset.mode = 'arrow';
        root.className = 'is-gone';
        root.innerHTML = HTML;
        document.body.appendChild(root);

        document.documentElement.classList.add('tsic-cursor-on');

        // Recompute mode from the last pointer target. Exposed so code that
        // toggles cursor context attributes outside pointer events (the map's
        // rAF-coalesced POI picking) can refresh without waiting for the next
        // pointermove.
        var lastTarget = null;
        function setMode(target) {
            lastTarget = target;
            root.dataset.mode = modeFor(target);
        }
        window.TSICCursor = {
            refresh: function () { if (lastTarget) root.dataset.mode = modeFor(lastTarget); },
        };

        document.addEventListener('pointermove', function (e) {
            root.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';
            root.classList.remove('is-gone');
            setMode(e.target);
        }, { passive: true });

        document.addEventListener('pointerover', function (e) {
            setMode(e.target);
        });

        document.addEventListener('pointerdown', function (e) {
            root.classList.add('is-down');
            if (root.classList.contains('is-gone') || root.classList.contains('is-suppressed')) return;
            var ripple = document.createElement('div');
            ripple.className = 'tsic-cursor-ripple';
            ripple.style.left = e.clientX + 'px';
            ripple.style.top = e.clientY + 'px';
            document.body.appendChild(ripple);
            ripple.addEventListener('animationend', function () { ripple.remove(); });
        });
        document.addEventListener('pointerup', function () { root.classList.remove('is-down'); });

        document.documentElement.addEventListener('pointerleave', function () { root.classList.add('is-gone'); });

        // Hide while the game owns the mouse. Mirrors the C++ rule in
        // ScpUIDirectorSubsystem::RefreshFocusCapture: the UI has the mouse
        // when an overlay is open OR the current screen is a capture screen.
        // (UI.Input.Mode.Changed only carries the input DEVICE — gamepad is
        // handled via html[data-tsic-input] CSS.) Both channels are sticky,
        // so a freshly loaded page gets current state on subscribe.
        // Keep in sync with the CaptureScreens set in ScpUIDirectorSubsystem.cpp.
        var CAPTURE_SCREENS = {
            MainMenu: 1, NewStore: 1, LoadSave: 1, Mods: 1, Settings: 1,
            Credits: 1, DeathScreen: 1, PauseMenu: 1, Inventory: 1, Map: 1,
            Crafting: 1, Production: 1, Chat: 1, CheatMenu: 1, HtmlGame: 1,
            DebugScreen: 1, Construction: 1,
        };
        var currentScreen = '';
        var overlayCount = 0;
        function applySuppression() {
            var uiHasMouse = overlayCount > 0 || !!CAPTURE_SCREENS[currentScreen];
            root.classList.toggle('is-suppressed', !uiHasMouse);
        }
        var tries = 0;
        (function bindUiState() {
            var t = window.tsic;
            if (!t || typeof t.on !== 'function') {
                // Bridge-less pages (Chrome preview) never suppress.
                if (++tries < 100) setTimeout(bindUiState, 150);
                return;
            }
            t.on('tsic.msg.UI.Screen.Changed', function (p) {
                if (!p || !p.Name) return;
                currentScreen = String(p.Name);
                applySuppression();
            });
            t.on('tsic.msg.UI.Overlay.Changed', function (p) {
                overlayCount = (p && p.Stack && p.Stack.length) || 0;
                applySuppression();
            });
        })();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }
})();
