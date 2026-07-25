// shared/hud-stamina.js — mounts the blue liquid vial into #hud-stamina.
// DOM shell: #hud-stamina (created by hud.js). Component: shared/hud-liquid-bar.js.
// Channel: UI.Player.Attribute (Stamina). Muted yellow, no waves, no droplets
// (keeps the lagging drain trail).
(function () {
  var root = document.getElementById('hud-stamina');
  if (!root) return;
  (function go() {
    if (!window.TSICLiquidBar) { setTimeout(go, 16); return; }
    TSICLiquidBar.mount(root, {
      channel: 'Stamina', label: 'Stamina',
      waves: false, droplets: false, sheen: true,
      palette: { lo: [104, 82, 18], hi: [199, 162, 42], trail: '#3a2d08', rim: '199,162,42' },
    });
  })();
})();
