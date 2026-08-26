// shared/icons.js — Icon URL resolution and standard <img> creation.
//
// TSIC.keyIconUrl('LMB')             → '/icons/keyboard/mouse-left.svg'
// TSIC.keyIconUrl('Face Bottom', true) → '/icons/gamepad/face-bottom.svg'
// TSIC.itemIconUrl('ID_Bread')        → '/tex/item-icon/ID_Bread'
// TSIC.iconImg('/tex/item-icon/X')    → <img> with standard onerror
(function () {
  // Lookups are keyed by every spelling a key can arrive as: UE's long
  // FKey::GetDisplayName() string (e.g. "Space Bar", "Left Ctrl") AND its
  // stable FName (e.g. "SpaceBar", "LeftControl"). At load these are folded
  // through norm() — lowercased, whitespace/hyphen/underscore stripped — so
  // "Space Bar", "SpaceBar" and "space  bar" all collapse to one entry. This
  // makes resolution robust to UE display-name quirks (e.g. "D-pad" vs "DPad")
  // and to whichever form a given C++ path happens to send.
  var KB = {
    'LMB': 'mouse-left', 'Left Mouse Button': 'mouse-left', 'LeftMouseButton': 'mouse-left',
    'RMB': 'mouse-right', 'Right Mouse Button': 'mouse-right', 'RightMouseButton': 'mouse-right',
    'MMB': 'mouse-wheel', 'Middle Mouse Button': 'mouse-wheel', 'MiddleMouseButton': 'mouse-wheel',
    'Space': 'space', 'SpaceBar': 'space', 'Space Bar': 'space',
    'Left Shift': 'shift', 'Right Shift': 'shift', 'Shift': 'shift',
    'LeftShift': 'shift', 'RightShift': 'shift',
    'Left Control': 'ctrl', 'Right Control': 'ctrl', 'Ctrl': 'ctrl', 'Control': 'ctrl',
    'Left Ctrl': 'ctrl', 'Right Ctrl': 'ctrl', 'LeftControl': 'ctrl', 'RightControl': 'ctrl',
    'Left Alt': 'alt', 'Right Alt': 'alt', 'Alt': 'alt', 'LeftAlt': 'alt', 'RightAlt': 'alt',
    'Tab': 'tab', 'Escape': 'esc', 'Esc': 'esc', 'Enter': 'enter', 'Return': 'enter',
    'Page Up': 'page-up', 'PageUp': 'page-up', 'Page Down': 'page-down', 'PageDown': 'page-down',
    // Mouse wheel rotation (MMB above is the wheel *click*).
    'Mouse Wheel Up': 'scroll-up', 'MouseScrollUp': 'scroll-up', 'Scroll Up': 'scroll-up',
    'Mouse Wheel Down': 'scroll-down', 'MouseScrollDown': 'scroll-down', 'Scroll Down': 'scroll-down',
    // Arrow keys.
    'Up': 'arrow-up', 'Down': 'arrow-down', 'Left': 'arrow-left', 'Right': 'arrow-right',
    // Digit FName forms (the numeric-glyph fallback below handles "1".."0").
    'Zero': '0', 'One': '1', 'Two': '2', 'Three': '3', 'Four': '4',
    'Five': '5', 'Six': '6', 'Seven': '7', 'Eight': '8', 'Nine': '9',
  };
  var GP = {
    'Gamepad Face Button Bottom': 'face-bottom', 'Gamepad Face Button Left': 'face-left',
    'Gamepad Face Button Right': 'face-right', 'Gamepad Face Button Top': 'face-top',
    'Gamepad_FaceButton_Bottom': 'face-bottom', 'Gamepad_FaceButton_Left': 'face-left',
    'Gamepad_FaceButton_Right': 'face-right', 'Gamepad_FaceButton_Top': 'face-top',
    'Face Bottom': 'face-bottom', 'Face Left': 'face-left',
    'Face Right': 'face-right', 'Face Top': 'face-top',
    'Gamepad Left Shoulder': 'lb', 'Gamepad Right Shoulder': 'rb',
    'Gamepad_LeftShoulder': 'lb', 'Gamepad_RightShoulder': 'rb',
    'Left Shoulder': 'lb', 'Right Shoulder': 'rb',
    'LB': 'lb', 'RB': 'rb',
    // Triggers: the digital button (Gamepad_LeftTrigger), the analog axis form
    // (Gamepad_LeftTriggerAxis -> "Gamepad Left Trigger Axis", which UE often
    // reports when a trigger is pressed/captured), and bare spellings all fold to lt/rt.
    'Gamepad Left Trigger': 'lt', 'Gamepad Right Trigger': 'rt',
    'Gamepad_LeftTrigger': 'lt', 'Gamepad_RightTrigger': 'rt',
    'Gamepad Left Trigger Axis': 'lt', 'Gamepad Right Trigger Axis': 'rt',
    'Gamepad_LeftTriggerAxis': 'lt', 'Gamepad_RightTriggerAxis': 'rt',
    'Left Trigger': 'lt', 'Right Trigger': 'rt',
    'LT': 'lt', 'RT': 'rt',
    'Gamepad DPad Up': 'dpad-up', 'Gamepad DPad Down': 'dpad-down',
    'Gamepad DPad Left': 'dpad-left', 'Gamepad DPad Right': 'dpad-right',
    'Gamepad_DPad_Up': 'dpad-up', 'Gamepad_DPad_Down': 'dpad-down',
    'Gamepad_DPad_Left': 'dpad-left', 'Gamepad_DPad_Right': 'dpad-right',
    'Gamepad Left Thumbstick Button': 'lstick-press',
    'Gamepad Right Thumbstick Button': 'rstick-press',
    'Gamepad_LeftThumbstick': 'lstick-press', 'Gamepad_RightThumbstick': 'rstick-press',
    'Gamepad Special Left': 'special-left', 'Gamepad Special Right': 'special-right',
    'Gamepad_Special_Left': 'special-left', 'Gamepad_Special_Right': 'special-right',
  };

  // Fold a key string to its canonical lookup form: lowercase, no spaces,
  // hyphens or underscores. "Left Ctrl", "LeftControl" and "left-ctrl" all map
  // to the same bucket.
  function norm(s) {
    return String(s).toLowerCase().replace(/[\s_\-]+/g, '');
  }
  function foldMap(src) {
    var out = {};
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) out[norm(k)] = src[k];
    }
    return out;
  }
  var KB_N = foldMap(KB);
  var GP_N = foldMap(GP);

  // Substring fallbacks for gamepad keys: UE display names vary ("Gamepad Left
  // Trigger", "Left Trigger", "...Trigger Axis", the digital vs analog forms), so
  // when the exact table misses, match on the canonical token. Order matters only
  // in that no token is a prefix of another here.
  var GP_TOKENS = [
    ['lefttrigger', 'lt'], ['righttrigger', 'rt'],
    ['leftshoulder', 'lb'], ['rightshoulder', 'rb'],
    ['leftbumper', 'lb'], ['rightbumper', 'rb'],
  ];
  function gamepadFallback(n) {
    for (var i = 0; i < GP_TOKENS.length; i++) {
      if (n.indexOf(GP_TOKENS[i][0]) !== -1) return GP_TOKENS[i][1];
    }
    return '';
  }

  function keyIconUrl(keyText, isGamepad) {
    if (!keyText) return '';
    var n = norm(keyText);
    if (isGamepad) {
      var gp = GP_N[n] || gamepadFallback(n);
      return gp ? '/icons/gamepad/' + gp + '.svg' : '';
    }
    var kb = KB_N[n];
    if (kb) return '/icons/keyboard/' + kb + '.svg';
    var t = String(keyText).trim();
    if (/^[A-Za-z]$/.test(t)) return '/icons/keyboard/' + t.toLowerCase() + '.svg';
    if (/^[0-9]$/.test(t)) return '/icons/keyboard/' + t + '.svg';
    return '';
  }

  function itemIconUrl(itemId) {
    if (!itemId) return '';
    if (window.tsic && typeof window.tsic.itemIconUrl === 'function') {
      return window.tsic.itemIconUrl(itemId);
    }
    return '/tex/item-icon/' + encodeURIComponent(itemId);
  }

  // Item icons are served by the C++ /tex/item-icon resolver, which 404s the
  // first (cold) request while it async-loads + PNG-encodes the asset thumbnail
  // (or the in-data fallback thumbnail on a miss) and caches it for the NEXT
  // request. Without a retry the cold-cache 404 is terminal — the icon vanishes
  // or shows the browser's broken-image glyph until something happens to
  // re-render it. attachIconRetry re-fetches a few times with backoff; each try
  // appends a cache-buster so CEF re-hits the handler (the resolver strips the
  // query string, so the item id — and cache key — is unchanged). Once the cache
  // warms, the retry lands the real (or fallback) icon. Gives up after the last
  // delay: calls opts.onFail if given; otherwise a /tex/ icon settles on the
  // cardboard-box placeholder, and anything else hides unless opts.keepOnFail.
  var ICON_RETRY_DELAYS = [120, 280, 600, 1200];

  // While an icon is still resolving we paint the same cardboard box the C++
  // resolver serves for an item whose thumbnail can't be resolved at all, so the
  // loading state looks like the game rather than like breakage. It rides as a
  // CSS background: the <img>'s own content is what the browser replaces with the
  // broken-image glyph on a failed src, and a background is immune to that.
  // Cleared once the real icon lands so transparent PNGs don't sit on top of it.
  var FALLBACK_ICON_URL = '/tex/fallback-icon';

  // 1x1 transparent GIF. Parked in img.src whenever the real icon is not
  // available: a src that always loads paints nothing and, crucially, suppresses
  // the glyph — leaving the background placeholder above visible underneath.
  var BLANK_PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  function bustUrl(src, n) {
    return src + (src.indexOf('?') < 0 ? '?' : '&') + 'r=' + n;
  }

  // A class, not inline styles: call sites size icons by assigning img.style.cssText
  // (shared/inventory.js does), which would wipe an inline background wholesale.
  // background-origin lines the stand-in up with the object-fit:contain content box
  // rather than letting it spill into the slot padding.
  var PLACEHOLDER_CLASS = 'tsic-icon-loading';
  var PLACEHOLDER_CSS = '.' + PLACEHOLDER_CLASS + ' {'
    + ' background-image: url("' + FALLBACK_ICON_URL + '");'
    + ' background-size: contain;'
    + ' background-position: center;'
    + ' background-repeat: no-repeat;'
    + ' background-origin: content-box; }';

  function ensurePlaceholderStyles() {
    if (document.getElementById('tsic-icon-placeholder-styles')) return;
    var style = document.createElement('style');
    style.id = 'tsic-icon-placeholder-styles';
    style.textContent = PLACEHOLDER_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function showPlaceholder(img) {
    ensurePlaceholderStyles();
    img.classList.add(PLACEHOLDER_CLASS);
  }

  function clearPlaceholder(img) {
    img.classList.remove(PLACEHOLDER_CLASS);
  }

  function attachIconRetry(img, src, opts) {
    var o = opts || {};
    var retriable = src.indexOf('/tex/') !== -1; // data: URLs and static svgs don't warm
    var tries = 0;
    if (retriable) showPlaceholder(img);
    img.onload = function () {
      // BLANK_PX loads too — only a real icon retires the placeholder.
      if (img.src.indexOf(BLANK_PX) === 0) return;
      clearPlaceholder(img);
    };
    img.onerror = function () {
      if (retriable && tries < ICON_RETRY_DELAYS.length) {
        var delay = ICON_RETRY_DELAYS[tries++];
        // Park on the blank pixel for the whole wait, not just the instant of
        // the swap — otherwise the glyph is what shows for the entire backoff.
        img.src = BLANK_PX;
        setTimeout(function () { img.src = bustUrl(src, tries); }, delay);
        return;
      }
      img.onerror = null;
      if (typeof o.onFail === 'function') { o.onFail(img); return; }
      // Out of retries: keep the placeholder rather than collapsing the slot, so
      // the layout holds and the item still reads as "something is here".
      if (retriable) { img.src = BLANK_PX; return; }
      if (o.keepOnFail) return;
      img.style.display = 'none';
    };
  }

  function iconImg(src, opts) {
    var o = opts || {};
    var img = document.createElement('img');
    if (o.alt) img.alt = o.alt;
    if (o['class']) img.className = o['class'];
    if (o.width) { img.style.width = o.width + 'px'; img.style.height = (o.height || o.width) + 'px'; }
    attachIconRetry(img, src, o);
    img.src = src;
    return img;
  }

  // ---- Runtime image sources (served as PNG by the TSIC scheme handler) ----
  // The texture must be registered on the C++ side via
  // UTSICWebUISubsystem::RegisterImageSourceFromTexture or
  // RegisterImageSourceFromRenderTarget before the URL resolves.
  //
  // Known sources: 'world-map', 'character-preview', 'fow',
  //   'world-debug-height', 'world-debug-maze', 'world-debug-all'

  function runtimeImgUrl(name) {
    // The surface decides, when it has an opinion — SolUi serves runtime
    // textures as image sources rather than as URLs a scheme handler routes.
    // Same indirection itemIconUrl above already uses, and for the same reason.
    if (window.tsic && typeof window.tsic.runtimeImgUrl === 'function') {
      return window.tsic.runtimeImgUrl(name);
    }
    // .imgsrc is the documented runtime-texture extension; the scheme handler
    // strips it (FPaths::GetBaseFilename) so any extension resolves, but keep
    // this consistent with the initial-load <img src> sites and CLAUDE.md.
    return '/runtime/' + name + '.imgsrc';
  }

  function runtimeImg(name, opts) {
    var o = opts || {};
    var img = document.createElement('img');
    img.src = runtimeImgUrl(name);
    if (o.id) img.id = o.id;
    if (o.alt) img.alt = o.alt;
    if (o['class']) img.className = o['class'];
    if (o.width) { img.style.width = o.width + 'px'; img.style.height = (o.height || o.width) + 'px'; }
    return img;
  }

  // Cache-busted reload for debug overlays that register their texture
  // after page load (first fetch returns empty, toggle re-fetches).
  function runtimeImgReload(imgEl) {
    var base = imgEl.src.split('?')[0];
    imgEl.src = base + '?t=' + Date.now();
  }

  // Continuously re-fetch a runtime image source so an animating capture
  // (e.g. the character preview, which loops an idle animation) updates live
  // in the browser. Each frame appends a fresh cache-buster so CEF treats it
  // as a new resource. The next fetch is scheduled only after the current one
  // finishes (load or error), throttled to opts.fps (default 30) — this
  // backpressures naturally if PNG encode/transfer can't keep up, and retries
  // through the empty responses that occur before the first snapshot lands.
  // Returns a stop() function; call it when the image is no longer visible.
  var HIDDEN_POLL_MS = 500;

  function startRuntimeImgStream(imgEl, name, opts) {
    var o = opts || {};
    var minInterval = 1000 / (o.fps || 30);
    var base = runtimeImgUrl(name);
    var stopped = false;
    var seq = 0;
    var lastStart = 0;
    var timer = null;
    var now = function () {
      return (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();
    };
    function fetchNext() {
      if (stopped) return;
      lastStart = now();
      // Nothing can see it — don't pay for it. Every frame of this stream is a
      // full PNG decoded on the renderer's MAIN thread, which is also the thread
      // that services pointermove, so a stream left running behind a closed or
      // hidden screen is pure input latency for no picture at all. Keep polling
      // at the slow idle rate so it comes straight back when it reappears.
      if (!isVisible()) {
        timer = setTimeout(fetchNext, HIDDEN_POLL_MS);
        return;
      }
      imgEl.src = base + '?t=' + (++seq);
    }
    // Deliberately ONLY document.hidden, not an element-visibility test.
    // Screens already stop their own streams on hide (see inventory.js onHide),
    // so an offsetParent check here would be redundant for the real callers while
    // adding a way to get it wrong: any caller whose element is laid out in a way
    // that reports no offsetParent would silently drop to the idle rate and look
    // broken. This covers the case the screens cannot — the whole page being
    // backgrounded — and nothing else.
    function isVisible() {
      return !(typeof document !== 'undefined' && document.hidden);
    }
    function scheduleNext() {
      if (stopped) return;
      timer = setTimeout(fetchNext, Math.max(0, minInterval - (now() - lastStart)));
    }
    imgEl.addEventListener('load', scheduleNext);
    imgEl.addEventListener('error', scheduleNext);
    fetchNext();
    return function stop() {
      stopped = true;
      if (timer) { clearTimeout(timer); timer = null; }
      imgEl.removeEventListener('load', scheduleNext);
      imgEl.removeEventListener('error', scheduleNext);
    };
  }

  // Fists — the reserved first hotbar slot (bare hands, nothing equipped).
  // Drawn inline rather than served as an item icon: fists are not an item, so
  // there is no ItemId to resolve and no PNG in the mod's icons/ folder.
  // currentColor lets each hotbar tint it to match its own slot styling — ink
  // on the inventory's paper slots, cream on the HUD's dark plinths.
  //
  // Artwork: "hand-fist" (bold weight) from Phosphor Icons
  // <https://phosphoricons.com> — https://github.com/phosphor-icons/core
  // Bold matches this UI's heavy ink borders; the regular weight goes thin
  // against them and the fill weight loses the knuckle detail at 56px.
  //
  //   MIT License. Copyright (c) 2023 Phosphor Icons
  //
  //   Permission is hereby granted, free of charge, to any person obtaining a
  //   copy of this software and associated documentation files (the
  //   "Software"), to deal in the Software without restriction, including
  //   without limitation the rights to use, copy, modify, merge, publish,
  //   distribute, sublicense, and/or sell copies of the Software, and to
  //   permit persons to whom the Software is furnished to do so, subject to
  //   the following conditions:
  //
  //   The above copyright notice and this permission notice shall be included
  //   in all copies or substantial portions of the Software.
  //
  //   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  //   OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  //   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
  //   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
  //   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
  //   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  //   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
  var FISTS_PATH = 'M200,76H188V64a36,36,0,0,0-60-26.8A36,36,0,0,0,69.27,54.54,36,36,0,0,0,20,88v40'
    + 'a108,108,0,0,0,216,0V112A36,36,0,0,0,200,76ZM140,64a12,12,0,0,1,24,0V76H140ZM92,64a12,12,0,0,1,'
    + '24,0v40a12,12,0,0,1-24,0ZM44,88a12,12,0,0,1,24,0v16a12,12,0,0,1-24,0Zm168,40A84,84,0,0,1,44.61,'
    + '138.15,35.93,35.93,0,0,0,80,130.8a35.89,35.89,0,0,0,43.65,3.34A36.23,36.23,0,0,0,130,140.5,'
    + '51.82,51.82,0,0,0,116,176a12,12,0,0,0,24,0,28,28,0,0,1,28-28,12,12,0,0,0,0-24H152a12,12,0,0,1-'
    + '12-12V100h60a12,12,0,0,1,12,12Z';

  function fistsIcon(attrs) {
    var s = TSIC.svg('svg', Object.assign({
      viewBox: '0 0 256 256', fill: 'currentColor',
    }, attrs || {}));
    s.appendChild(TSIC.svg('path', { d: FISTS_PATH }));
    return s;
  }

  // Interaction-category stroke-icon paths (24×24 viewBox, inherit currentColor).
  // Shared by the interaction panel header (hud-interaction.js) and the crosshair
  // affordance (hud-crosshair.js) so a given category always draws the same glyph.
  var CATEGORY_ICON_PATHS = {
    crafting: ['m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9', 'M17.64 15 22 10.64', 'm20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91'],
    production: ['M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'm4.9 4.9 2.1 2.1', 'm17 17 2.1 2.1', 'M19.1 4.9 17 7', 'm7 17-2.1 2.1', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    plantable: ['M7 20h10', 'M12 20v-6', 'M12 14c0-4 3-7 7-7 0 4-3 7-7 7z', 'M12 14c0-4-3-7-7-7 0 4 3 7 7 7z'],
    storage: ['M3 8l9-5 9 5v8l-9 5-9-5z', 'M3 8l9 5 9-5', 'M12 13v8'],
    door: ['M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16', 'M3 21h18', 'M15 12h.01'],
    toggle: ['M12 2v8', 'M18.4 6.6a9 9 0 1 1-12.77.04'],
    loot: ['M6 8h12l1.5 12a1.5 1.5 0 0 1-1.5 1.6H6A1.5 1.5 0 0 1 4.5 20z', 'M9 8a3 3 0 0 1 6 0'],
    shop: ['M12 2H4v8l10 10 8-8z', 'M7.5 6.5h.01'],
    item: ['M12 4v12', 'm7 11 5 5 5-5', 'M5 20h14'],
    cart: ['M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M2 3h2l2.5 12.5a2 2 0 0 0 2 1.5h8.7a2 2 0 0 0 2-1.6L21 8H6'],
    elevator: ['M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'm8.5 10 3.5-4 3.5 4', 'm8.5 14 3.5 4 3.5-4'],
    teleporter: ['M4 18c0 1.66 3.58 3 8 3s8-1.34 8-3-3.58-3-8-3-8 1.34-8 3z', 'M12 2v13', 'm8 11 4 4 4-4'],
    cage: ['M5 21V8a7 7 0 0 1 14 0v13', 'M3 21h18', 'M9 10.5V21', 'M15 10.5V21', 'M12 8v13'],
    summon: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'm12 7 1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5L7 10.5l3.5-.5z'],
    repair: ['M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z'],
    text: ['M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z', 'M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z'],
    interact: ['M12 3l9 9-9 9-9-9z'],
  };

  // Build an <svg> glyph for an interaction category, or null when the category
  // is unknown or the DOM helpers aren't loaded. Inherits currentColor so callers
  // tint it by adding a .cat-<category> class on an ancestor.
  function categoryIcon(cat, attrs) {
    var paths = CATEGORY_ICON_PATHS[cat];
    if (!paths || !window.TSIC || !TSIC.svg) return null;
    var svg = TSIC.svg('svg', Object.assign({
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }, attrs || {}));
    for (var i = 0; i < paths.length; i++) svg.appendChild(TSIC.svg('path', { d: paths[i] }));
    return svg;
  }

  window.TSIC = window.TSIC || {};
  window.TSIC.CATEGORY_ICON_PATHS = CATEGORY_ICON_PATHS;
  window.TSIC.categoryIcon = categoryIcon;
  window.TSIC.keyIconUrl = keyIconUrl;
  window.TSIC.itemIconUrl = itemIconUrl;
  window.TSIC.iconImg = iconImg;
  window.TSIC.fistsIcon = fistsIcon;
  window.TSIC.attachIconRetry = attachIconRetry;
  window.TSIC.runtimeImgUrl = runtimeImgUrl;
  window.TSIC.runtimeImg = runtimeImg;
  window.TSIC.runtimeImgReload = runtimeImgReload;
  window.TSIC.startRuntimeImgStream = startRuntimeImgStream;
})();
