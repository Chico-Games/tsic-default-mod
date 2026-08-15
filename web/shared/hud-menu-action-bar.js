// shared/hud-menu-action-bar.js — Menu behavior bar (System B).
//
// The counterpart to hud-behavior-bar.js: that one draws the GAMEPLAY actions,
// this one draws the actions the OPEN MENU offers ("Equip", "Take All", "Back").
//
// Every menu already declares its context — router.js publishes the static
// <meta name="tsic-action-bar-context"> list, screen-manager.js publishes a
// registered screen's actionBarContext, and tsic.setMenuActionContext covers
// the dynamic pages. UScpBehaviorBarPublisher resolves each entry's bound key
// (icon + display name, keyboard and gamepad) and rebroadcasts the enriched
// list on UI.BehaviorBar.MenuContext.
//
// Until this file existed nothing rendered that broadcast, so all of that work
// landed nowhere and no menu ever showed its controls.
//
// Builds its own #bb-shell-menu > #bb-menu root, and is loaded on EVERY screen
// (not just InGame): menus mount as overlays inside the shell, but the
// unmigrated pages are still real navigations with their own document.
(function () {
  var STYLE = [
    '#bb-shell-menu { position:fixed; right:24px; bottom:18px; max-width:calc(100vw - 48px);',
    '  padding:8px 12px; display:flex; flex-direction:column; align-items:flex-end; gap:2px;',
    '  color:#fff; pointer-events:none; z-index:55; font-family:var(--font-body, Georgia, serif);',
    '  text-shadow:0 1px 2px rgba(0,0,0,0.75); }',
    '#bb-shell-menu.hidden { display:none; }',
    'body.hud-hidden #bb-shell-menu { display:none !important; }',
    '#bb-menu { display:flex; flex-direction:column; align-items:flex-end; gap:2px; }',
    '.bb-menu-row { display:flex; align-items:center; justify-content:flex-end; gap:8px; font-size:12px; letter-spacing:0.04em; }',
    '.bb-menu-name { text-transform:uppercase; }',
    '.bb-menu-key { display:inline-flex; align-items:center; justify-content:center; min-width:22px; height:22px; }',
    '.bb-menu-key img { max-width:22px; max-height:22px; object-fit:contain; }',
    // Text fallback for a key with no icon in the registry — the gameplay bar
    // can drop those rows because the ability is still usable without the hint;
    // a menu row IS the hint, so it degrades to the key name instead.
    '.bb-menu-key-text { font-size:10px; font-weight:700; border:1px solid rgba(255,255,255,0.55);',
    '  border-radius:3px; padding:0 4px; line-height:16px; }',
  ].join('\n');

  var inputMode = 'MouseAndKeyboard';
  var entries = [];

  function injectStyleOnce() {
    if (document.getElementById('bb-menu-style')) return;
    var s = document.createElement('style');
    s.id = 'bb-menu-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function ensureRoot() {
    var root = document.getElementById('bb-shell-menu');
    if (root) return root;
    injectStyleOnce();
    root = document.createElement('div');
    root.id = 'bb-shell-menu';
    root.className = 'hidden';
    var list = document.createElement('div');
    list.id = 'bb-menu';
    root.appendChild(list);
    document.body.appendChild(root);
    return root;
  }

  function preferGamepad() { return inputMode === 'Gamepad'; }

  function renderRow(entry) {
    var row = document.createElement('div');
    row.className = 'bb-menu-row';
    row.dataset.action = entry.ActionName || '';

    var name = document.createElement('span');
    name.className = 'bb-menu-name';
    name.textContent = entry.Label || '';
    row.appendChild(name);

    var isGP = preferGamepad();
    var keyText = (isGP ? entry.GamepadKeyText : entry.KeyboardKeyText) || '';
    var iconUrl = (isGP ? entry.GamepadIconUrl : entry.KeyboardIconUrl) || '';
    var resolve = (window.TSIC && window.TSIC.keyIconUrl) || function () { return ''; };
    var url = iconUrl || resolve(keyText, isGP);

    var key = document.createElement('span');
    key.className = 'bb-menu-key';
    if (url) {
      var img = document.createElement('img');
      img.src = url;
      img.alt = keyText;
      // No glyph in the registry: fall back to the key's name rather than an
      // action with no visible binding.
      img.onerror = function () {
        if (!key.isConnected) return;
        key.innerHTML = '';
        if (!keyText) return;
        var txt = document.createElement('span');
        txt.className = 'bb-menu-key-text';
        txt.textContent = keyText;
        key.appendChild(txt);
      };
      key.appendChild(img);
    } else if (keyText) {
      var txt2 = document.createElement('span');
      txt2.className = 'bb-menu-key-text';
      txt2.textContent = keyText;
      key.appendChild(txt2);
    }
    row.appendChild(key);
    return row;
  }

  function render() {
    var root = ensureRoot();
    var host = document.getElementById('bb-menu');
    if (!host) return;
    host.innerHTML = '';
    var visible = 0;
    var sorted = entries.slice().sort(function (a, b) {
      return ((a && a.Priority) || 0) - ((b && b.Priority) || 0);
    });
    for (var i = 0; i < sorted.length; i++) {
      if (!sorted[i] || !sorted[i].Label) continue;
      host.appendChild(renderRow(sorted[i]));
      visible++;
    }
    root.classList.toggle('hidden', visible === 0);
  }

  function boot() {
    if (!window.tsic || typeof tsic.on !== 'function' || !document.body) {
      setTimeout(boot, 16);
      return;
    }
    ensureRoot();
    tsic.on('tsic.msg.UI.BehaviorBar.MenuContext', function (p) {
      entries = (p && p.Entries) || [];
      render();
    });
    tsic.on('tsic.msg.UI.Input.Mode.Changed', function (p) {
      inputMode = (p && p.Mode) || 'MouseAndKeyboard';
      render();
    });
  }
  boot();
})();
