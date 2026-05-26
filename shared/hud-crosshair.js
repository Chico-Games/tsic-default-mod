// shared/hud-crosshair.js — Crosshair dot visibility.
// DOM: #hud-crosshair (created by hud.js).
// Hides when input mode switches to menu/UI mouse.
(function () {
  tsic.on('tsic.msg.UI.Input.Mode.Changed', function (p) {
    var dot = document.getElementById('hud-crosshair');
    if (!dot || !p) return;
    var isMenuMode = String(p.Device || '') === 'mouse' && String(p.Focus || '') === 'ui';
    dot.classList.toggle('hidden', isMenuMode);
  });
})();
