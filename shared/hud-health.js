// shared/hud-health.js — Health bar with damage trail decay.
// DOM: #hud-health (created by hud.js).
// Channels: UI.Player.Attribute (Health), Message.DamageEvent.
(function () {
  var root = document.getElementById('hud-health');
  if (!root) return;
  var trail = root.querySelector('.trail-fill');
  var live  = root.querySelector('.live-fill');
  var nums  = root.querySelector('.numbers');

  var current = 0, max = 0, liveN = 0, trailN = 0;
  var lastDecayTime = -1e9;
  var DELAY = 2.0, DECAY_RATE = 0.2;

  tsic.on('tsic.msg.UI.Player.Attribute', function (p) {
    if (!p || p.Channel !== 'Health') return;
    current = Number(p.Current) || 0;
    max = Number(p.Max) || 1;
  });

  tsic.on('tsic.msg.Message.DamageEvent', function () {
    lastDecayTime = performance.now() / 1000;
  });

  var last = performance.now() / 1000;
  (function frame() {
    var now = performance.now() / 1000;
    var dt = Math.max(0, now - last);
    last = now;

    var target = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    if (target > liveN) trailN = Math.max(trailN, target);
    liveN = target;

    if ((now - lastDecayTime) >= DELAY) {
      var step = DECAY_RATE * dt;
      if (trailN > liveN) trailN = Math.max(liveN, trailN - step);
    }
    if (trailN < liveN) trailN = liveN;

    if (trail) trail.style.width = (trailN * 100).toFixed(1) + '%';
    if (live)  live.style.width  = (liveN  * 100).toFixed(1) + '%';
    if (nums)  nums.textContent  = Math.round(current) + ' / ' + Math.round(max);
    requestAnimationFrame(frame);
  })();
})();
