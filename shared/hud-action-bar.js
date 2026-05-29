// shared/hud-action-bar.js — Gameplay HUD action bar (System A).
//
// This is the ONE and ONLY renderer of the in-game gameplay action bar. hud.js
// loads it on the InGame screen; tests host it via /screens/test-action-bar.html.
// Do NOT re-implement this rendering inline in an HTML page — a duplicate inline
// copy used to live in screens/action-bar.html and silently diverged (it was
// dead at runtime, yet the whole test suite exercised it instead of this file).
// If a screen needs the action bar, load this module; keep rendering logic in JS.
//
// (The menu action bar — System B, #ab-menu — is not yet wired into the live
//  shell; the menu context is published but nothing renders it. Separate TODO.)
//
// Renders into #ab-shell-gameplay > #ab-gameplay (DOM created by hud.js).
// Each row: [ability name]  [key icon]
// Depends on: window.TSIC.keyIconUrl (from icons.js)
(function () {
  var STATUS = ['available', 'blocked', 'cooldown', 'single-use-used'];
  var inputMode = 'MouseAndKeyboard';
  var slots = [];

  // Key icon <img> nodes cached by `InputName|url`. The action bar re-broadcasts on
  // every status/cooldown change (e.g. spamming crouch toggles StatusInt each poll),
  // and a full rebuild recreates the <img> — CEF then shows a blank frame while it
  // re-decodes, which reads as a flash. Reusing the already-decoded node across
  // re-renders removes that gap. Keyed by InputName too so duplicate URLs on different
  // abilities don't steal each other's node. Pruned to live keys after each render.
  var imgCache = {};

  function preferGamepad() { return inputMode === 'Gamepad'; }

  function removeKeyFor(img) {
    var key = img.closest ? img.closest('.ab-key') : img.parentNode;
    if (key && key.remove) key.remove();
  }

  // Return a cached <img> for (cacheKey, url), creating it on first use. A changed url
  // (e.g. input-mode swap) replaces the node so the new glyph loads.
  function keyImg(cacheKey, url, keyText, isGP, resolve) {
    var img = imgCache[cacheKey];
    if (img && img.getAttribute('src') === url) return img;

    img = document.createElement('img');
    img.src = url;
    img.alt = keyText || '';
    img.onerror = function () {
      var svgUrl = resolve(keyText, isGP);
      if (svgUrl && svgUrl !== url) {
        img.onerror = function () { delete imgCache[cacheKey]; removeKeyFor(img); };
        img.src = svgUrl;
      } else {
        delete imgCache[cacheKey];
        removeKeyFor(img);
      }
    };
    imgCache[cacheKey] = img;
    return img;
  }

  function bracketedName(name) {
    if (!name) return '';
    if (name.startsWith('IA_UI_')) return name.slice(6);
    if (name.startsWith('IA_'))    return name.slice(3);
    return name;
  }

  function renderRow(slot) {
    var row = document.createElement('span');
    row.className = 'ab-row';
    row.dataset.status = STATUS[slot.StatusInt | 0] || 'available';

    var txt = document.createElement('span');
    txt.className = 'ab-text';
    var nm = document.createElement('span');
    nm.className = 'ab-name';
    nm.textContent = slot.AbilityName || bracketedName(slot.InputName);
    txt.appendChild(nm);
    if (slot.SubText) {
      var sub = document.createElement('span');
      sub.className = 'ab-sub';
      sub.textContent = slot.SubText.length > 30 ? slot.SubText.slice(0, 29) + '…' : slot.SubText;
      txt.appendChild(sub);
    }
    row.appendChild(txt);

    var isGP = preferGamepad();
    var iconUrl = isGP ? slot.GamepadIconUrl : slot.KeyboardIconUrl;
    var keyText = isGP ? slot.GamepadKeyText : slot.KeyboardKeyText;
    var resolve = (window.TSIC && window.TSIC.keyIconUrl) || function () { return ''; };
    var resolvedUrl = iconUrl || resolve(keyText, isGP);

    // Icon-only: render no key chip when no thumbnail resolves (no text fallback).
    if (resolvedUrl) {
      var key = document.createElement('span');
      key.className = 'ab-key';
      var cacheKey = (slot.InputName || '') + '|' + resolvedUrl;
      liveKeys[cacheKey] = true;
      var img = keyImg(cacheKey, resolvedUrl, keyText, isGP, resolve);
      key.appendChild(img);
      if (slot.CooldownPercent > 0 && slot.CooldownPercent < 1) {
        var sweep = document.createElement('div');
        sweep.className = 'ab-cd-sweep';
        key.style.setProperty('--tsic-cd-percent',
          String(Math.max(0, Math.min(100, Math.round(slot.CooldownPercent * 100)))));
        key.appendChild(sweep);
      }
      row.appendChild(key);
    }
    return row;
  }

  // Set of `InputName|url` keys touched in the current render; used to prune imgCache.
  var liveKeys = {};

  function render() {
    var host = document.getElementById('ab-gameplay');
    var shell = document.getElementById('ab-shell-gameplay');
    if (!host || !shell) return;
    liveKeys = {};
    host.innerHTML = '';
    var hasVisible = false;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].bVisible === false) continue;
      hasVisible = true;
      host.appendChild(renderRow(slots[i]));
    }
    for (var k in imgCache) {
      if (!liveKeys[k]) delete imgCache[k];
    }
    shell.classList.toggle('hidden', !hasVisible);
  }

  tsic.on('tsic.msg.UI.ActionBar.Abilities', function (p) {
    slots = (p && p.Slots) || [];
    render();
  });
  tsic.on('tsic.msg.UI.Input.Mode.Changed', function (p) {
    inputMode = (p && p.Mode) || 'MouseAndKeyboard';
    render();
  });
})();
