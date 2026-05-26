// shared/hud-action-bar.js — Gameplay HUD action bar (System A).
//
// THIS IS THE IN-GAME HUD. screens/action-bar.html is the MENU bar (System B).
//
// Renders into #ab-shell-gameplay > #ab-gameplay (DOM created by hud.js).
// Each row: [ability name]  [key icon]
// Depends on: window.TSIC.keyIconUrl (from icons.js)
(function () {
  var STATUS = ['available', 'blocked', 'cooldown', 'single-use-used'];
  var inputMode = 'MouseAndKeyboard';
  var slots = [];

  function preferGamepad() { return inputMode === 'Gamepad'; }

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

    if (resolvedUrl || keyText) {
      var key = document.createElement('span');
      key.className = 'ab-key';
      if (resolvedUrl) {
        var img = document.createElement('img');
        img.src = resolvedUrl;
        img.alt = keyText || '';
        img.onerror = function () {
          if (keyText) {
            img.replaceWith(Object.assign(document.createElement('span'),
              { className: 'ab-key-fallback', textContent: keyText }));
          } else { key.remove(); }
        };
        key.appendChild(img);
      } else {
        var fb = document.createElement('span');
        fb.className = 'ab-key-fallback';
        fb.textContent = keyText;
        key.appendChild(fb);
      }
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

  function render() {
    var host = document.getElementById('ab-gameplay');
    var shell = document.getElementById('ab-shell-gameplay');
    if (!host || !shell) return;
    host.innerHTML = '';
    var hasVisible = false;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].bVisible === false) continue;
      hasVisible = true;
      host.appendChild(renderRow(slots[i]));
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
