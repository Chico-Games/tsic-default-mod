// shared/hud-circular-progress.js — ability progress / throw-charge ring.
// DOM: #hud-circular-progress (created by hud.js), a conic-gradient ring
// centred on the crosshair. Driven by the 30 Hz UI.CircularProgress.State
// broadcast (bridge bools keep their b-prefix). The publisher clamps Elapsed,
// so a maxed throw charge holds a full ring until the ability stops it.
(function () {
  tsic.on('tsic.msg.UI.CircularProgress.State', function (p) {
    var host = document.getElementById('hud-circular-progress');
    if (!host) return;
    var active = !!(p && p.bActive && p.Total > 0);
    host.classList.toggle('active', active);
    if (!active) return;
    var pct = Math.max(0, Math.min(100, (p.Elapsed / p.Total) * 100));
    host.style.setProperty('--cp-p', String(pct));
    if (p.Color) host.style.setProperty('--cp-color', p.Color);
  });
})();
