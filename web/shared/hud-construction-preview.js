// shared/hud-construction-preview.js — build-mode placement readout.
//
// The ghost already turns red when a piece cannot go down, but the REASON —
// "no clearance", "out of range", "no floor" — only exists in the
// UI.Construction.PreviewState payload, which UGameplayAbility_Construct
// resolves specifically so the player can do something about the refusal.
// That payload used to be read by the modal construction picker; the hotbar
// redesign made the hotbar the picker and the readout went with it, leaving
// the reason resolved on every build tick and shown to nobody.
//
// hud.js loads this on the InGame screen. It builds its own
// #hud-construction-preview root, so the test page can host it standalone.
//
// The pill is centred on the crosshair and its label changes on almost every
// frame of a placement, so the pill and its two cells hold a reserved width:
// the words change and the box does not.
(function () {
  var STYLE = [
    '#hud-construction-preview { position:fixed; left:50%; top:24px; transform:translateX(-50%);',
    '  min-width:280px; box-sizing:border-box; padding:6px 16px; text-align:center;',
    '  font-family:var(--font-body, Georgia, serif); font-size:12px; letter-spacing:2px;',
    '  color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.75); pointer-events:none; z-index:20; }',
    '#hud-construction-preview.hidden { display:none; }',
    'body.hud-hidden #hud-construction-preview { display:none !important; }',
    '#cp-text { display:inline-block; min-width:132px; font-weight:700; }',
    '#cp-text.cp-ready   { color:#7ee2a8; }',
    '#cp-text.cp-blocked { color:#ef8a80; }',
  ].join('\n');

  function injectStyleOnce() {
    if (document.getElementById('hud-construction-preview-style')) return;
    var s = document.createElement('style');
    s.id = 'hud-construction-preview-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function ensureRoot() {
    var root = document.getElementById('hud-construction-preview');
    if (root) return root;
    injectStyleOnce();
    root = document.createElement('div');
    root.id = 'hud-construction-preview';
    root.className = 'hidden';
    var text = document.createElement('span');
    text.id = 'cp-text';
    text.textContent = '—';
    root.appendChild(text);
    document.body.appendChild(root);
    return root;
  }

  function render(p) {
    var root = ensureRoot();
    var text = document.getElementById('cp-text');
    if (!text) return;
    // bActive false is the ability saying build mode is over. The channel is
    // cached, so without that flag the last verdict would stick forever.
    if (!p || p.bActive === false) {
      root.classList.add('hidden');
      return;
    }
    root.classList.remove('hidden');
    if (p.bCanPlace) {
      text.textContent = 'READY';
      text.className = 'cp-ready';
      return;
    }
    text.textContent = String(p.FailureReason || 'BLOCKED').toUpperCase();
    text.className = 'cp-blocked';
  }

  function boot() {
    if (!window.tsic || typeof tsic.on !== 'function' || !document.body) {
      setTimeout(boot, 16);
      return;
    }
    ensureRoot();
    tsic.on('tsic.msg.UI.Construction.PreviewState', render);
  }
  boot();
})();
