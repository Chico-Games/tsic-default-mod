// shared/hud-health.js — mounts the liquid blood vial into #hud-health.
// DOM shell: #hud-health (created by hud.js). Component: shared/hud-liquid-bar.js.
// Channel: UI.Player.Attribute (Health) — damage trail + side spill are handled
// by the component (it detects level drops).
(function () {
  var root = document.getElementById('hud-health');
  if (!root) return;
  (function go() {
    if (!window.TSICLiquidBar) { setTimeout(go, 16); return; }
    TSICLiquidBar.mount(root, { channel: 'Health', label: 'Health' });
  })();
})();
