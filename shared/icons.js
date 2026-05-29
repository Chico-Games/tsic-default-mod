// shared/icons.js — Icon URL resolution and standard <img> creation.
//
// TSIC.keyIconUrl('LMB')             → '/icons/keyboard/mouse-left.svg'
// TSIC.keyIconUrl('Face Bottom', true) → '/icons/gamepad/face-bottom.svg'
// TSIC.itemIconUrl('ID_Bread')        → '/tex/item-icon/ID_Bread'
// TSIC.iconImg('/tex/item-icon/X')    → <img> with standard onerror
(function () {
  var KB = {
    'LMB': 'mouse-left', 'Left Mouse Button': 'mouse-left',
    'RMB': 'mouse-right', 'Right Mouse Button': 'mouse-right',
    'MMB': 'mouse-wheel', 'Middle Mouse Button': 'mouse-wheel',
    'Space': 'space', 'SpaceBar': 'space',
    'Left Shift': 'shift', 'Right Shift': 'shift', 'Shift': 'shift',
    'Left Control': 'ctrl', 'Right Control': 'ctrl', 'Ctrl': 'ctrl',
    'Left Alt': 'alt', 'Right Alt': 'alt', 'Alt': 'alt',
    'Tab': 'tab', 'Escape': 'esc', 'Esc': 'esc', 'Enter': 'enter',
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
    'Face Bottom': 'face-bottom', 'Face Left': 'face-left',
    'Face Right': 'face-right', 'Face Top': 'face-top',
    'Gamepad Left Shoulder': 'lb', 'Gamepad Right Shoulder': 'rb',
    'LB': 'lb', 'RB': 'rb',
    'Gamepad Left Trigger': 'lt', 'Gamepad Right Trigger': 'rt',
    'LT': 'lt', 'RT': 'rt',
    'Gamepad DPad Up': 'dpad-up', 'Gamepad DPad Down': 'dpad-down',
    'Gamepad DPad Left': 'dpad-left', 'Gamepad DPad Right': 'dpad-right',
    'Gamepad Left Thumbstick Button': 'lstick-press',
    'Gamepad Right Thumbstick Button': 'rstick-press',
    'Gamepad Special Left': 'special-left', 'Gamepad Special Right': 'special-right',
  };

  function keyIconUrl(keyText, isGamepad) {
    if (!keyText) return '';
    if (isGamepad) {
      var gp = GP[keyText];
      return gp ? '/icons/gamepad/' + gp + '.svg' : '';
    }
    var kb = KB[keyText];
    if (kb) return '/icons/keyboard/' + kb + '.svg';
    if (/^[A-Za-z]$/.test(keyText)) return '/icons/keyboard/' + keyText.toLowerCase() + '.svg';
    if (/^[0-9]$/.test(keyText)) return '/icons/keyboard/' + keyText + '.svg';
    return '';
  }

  function itemIconUrl(itemId) {
    if (!itemId) return '';
    if (window.tsic && typeof window.tsic.itemIconUrl === 'function') {
      return window.tsic.itemIconUrl(itemId);
    }
    return '/tex/item-icon/' + encodeURIComponent(itemId);
  }

  function iconImg(src, opts) {
    var o = opts || {};
    var img = document.createElement('img');
    img.src = src;
    if (o.alt) img.alt = o.alt;
    if (o['class']) img.className = o['class'];
    if (o.width) { img.style.width = o.width + 'px'; img.style.height = (o.height || o.width) + 'px'; }
    img.onerror = function () { img.style.display = 'none'; };
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
    return '/runtime/' + name + '.png';
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

  window.TSIC = window.TSIC || {};
  window.TSIC.keyIconUrl = keyIconUrl;
  window.TSIC.itemIconUrl = itemIconUrl;
  window.TSIC.iconImg = iconImg;
  window.TSIC.runtimeImgUrl = runtimeImgUrl;
  window.TSIC.runtimeImg = runtimeImg;
  window.TSIC.runtimeImgReload = runtimeImgReload;
  window.TSIC.startRuntimeImgStream = startRuntimeImgStream;
})();
