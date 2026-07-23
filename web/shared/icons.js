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
  // delay: calls opts.onFail if given, else hides unless opts.keepOnFail.
  var ICON_RETRY_DELAYS = [120, 280, 600, 1200];

  function bustUrl(src, n) {
    return src + (src.indexOf('?') < 0 ? '?' : '&') + 'r=' + n;
  }

  function attachIconRetry(img, src, opts) {
    var o = opts || {};
    var retriable = src.indexOf('/tex/') !== -1; // data: URLs and static svgs don't warm
    var tries = 0;
    img.onerror = function () {
      if (retriable && tries < ICON_RETRY_DELAYS.length) {
        var delay = ICON_RETRY_DELAYS[tries++];
        setTimeout(function () { img.src = bustUrl(src, tries); }, delay);
        return;
      }
      img.onerror = null;
      if (typeof o.onFail === 'function') { o.onFail(img); return; }
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
      imgEl.src = base + '?t=' + (++seq);
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

  window.TSIC = window.TSIC || {};
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
