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

  window.TSIC = window.TSIC || {};
  window.TSIC.keyIconUrl = keyIconUrl;
  window.TSIC.itemIconUrl = itemIconUrl;
  window.TSIC.iconImg = iconImg;
})();
