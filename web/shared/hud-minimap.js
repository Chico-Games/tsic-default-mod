// shared/hud-minimap.js — Minimap with fixed zoom, always follows the player.
// DOM: #hud-minimap, #minimap-tex, #minimap-canvas (created by hud.js).
// Channel: UI.Map.Snapshot (player positions + world bounds at ~10 Hz).
//
// Position and rotation are interpolated between snapshots using
// requestAnimationFrame so movement appears smooth even if the message
// rate drops.
(function () {
  var SIZE = 180;
  var HALF = SIZE / 2;
  var PX_PER_CM = 1;
  var ZOOM_FRACTION = 0.03;
  var LERP_SPEED = 12;

  var container = document.getElementById('hud-minimap');
  var tex = document.getElementById('minimap-tex');
  var fow = document.getElementById('minimap-fow');
  var cvs = document.getElementById('minimap-canvas');
  if (!container || !tex || !cvs) return;
  var ctx = cvs.getContext('2d');

  var bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, hasData: false };
  var worldW = 0, worldH = 0;
  var scale = 1;

  var targetLocal = { x: 0, y: 0 };
  var currentLocal = { x: 0, y: 0 };
  var targetYaw = 0;
  var currentYaw = 0;
  var firstSnapshot = true;
  var players = [];
  var animating = false;
  var lastTime = 0;

  function worldToLocal(wx, wy) {
    return {
      x: (wy - bounds.minY) * PX_PER_CM,
      y: (bounds.maxX - wx) * PX_PER_CM
    };
  }

  function updateBounds(minB, maxB) {
    var minX = (minB && typeof minB.X === 'number') ? minB.X : 0;
    var minY = (minB && typeof minB.Y === 'number') ? minB.Y : 0;
    var maxX = (maxB && typeof maxB.X === 'number') ? maxB.X : 0;
    var maxY = (maxB && typeof maxB.Y === 'number') ? maxB.Y : 0;
    if (bounds.minX === minX && bounds.minY === minY &&
        bounds.maxX === maxX && bounds.maxY === maxY) return;
    bounds = { minX: minX, minY: minY, maxX: maxX, maxY: maxY,
               hasData: (maxX - minX) > 0 && (maxY - minY) > 0 };
    if (!bounds.hasData) return;
    worldW = (bounds.maxY - bounds.minY) * PX_PER_CM;
    worldH = (bounds.maxX - bounds.minX) * PX_PER_CM;
    tex.style.width = worldW + 'px';
    tex.style.height = worldH + 'px';
    if (fow) {
      fow.style.width = worldW + 'px';
      fow.style.height = worldH + 'px';
    }
    var visibleRadius = Math.max(worldW, worldH) * ZOOM_FRACTION;
    scale = HALF / visibleRadius;
  }

  function lerpAngle(from, to, t) {
    var diff = to - from;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return from + diff * t;
  }

  function render() {
    if (!bounds.hasData) return;
    var lx = currentLocal.x;
    var ly = currentLocal.y;
    var tx = HALF - lx * scale;
    var ty = HALF - ly * scale;
    var xform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    tex.style.transform = xform;
    if (fow) fow.style.transform = xform;

    ctx.clearRect(0, 0, SIZE, SIZE);

    for (var i = 1; i < players.length; i++) {
      var pl = players[i];
      var pos = worldToLocal(
        (pl.Position && pl.Position.X) || 0,
        (pl.Position && pl.Position.Y) || 0
      );
      var sx = HALF + (pos.x - lx) * scale;
      var sy = HALF + (pos.y - ly) * scale;
      if (sx < -10 || sx > SIZE + 10 || sy < -10 || sy > SIZE + 10) continue;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = pl.Color || '#888888';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(HALF, HALF);
    ctx.rotate((currentYaw - 90) * Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fillStyle = '#3498db';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function tick(now) {
    if (!bounds.hasData) { animating = false; return; }
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;

    var t = Math.min(1, LERP_SPEED * dt);
    currentLocal.x += (targetLocal.x - currentLocal.x) * t;
    currentLocal.y += (targetLocal.y - currentLocal.y) * t;
    currentYaw = lerpAngle(currentYaw, targetYaw, t);

    render();

    // Idle when fully caught up — no point burning 60fps (canvas redraw + a
    // layout-affecting transform) while the player stands still. The next
    // snapshot calls startAnimation() and resumes interpolation.
    var dxy = Math.abs(targetLocal.x - currentLocal.x) + Math.abs(targetLocal.y - currentLocal.y);
    var dyaw = Math.abs(((targetYaw - currentYaw + 540) % 360) - 180);
    if (dxy < 0.05 && dyaw < 0.1) { animating = false; return; }

    requestAnimationFrame(tick);
  }

  function startAnimation() {
    if (animating) return;
    animating = true;
    lastTime = 0;
    requestAnimationFrame(tick);
  }

  tsic.on('tsic.msg.UI.Map.Fow', function () {
    if (fow) fow.src = TSIC.runtimeImgUrl('fow') + '?t=' + Date.now();
  });

  tsic.on('tsic.msg.UI.Map.Snapshot', function (p) {
    if (!p) return;
    updateBounds(p.MinBounds, p.MaxBounds);
    players = p.Players || [];
    if (players.length > 0) {
      var me = players[0];
      var pos = worldToLocal(
        (me.Position && me.Position.X) || 0,
        (me.Position && me.Position.Y) || 0
      );
      targetLocal.x = pos.x;
      targetLocal.y = pos.y;
      targetYaw = me.YawDeg || 0;
      if (firstSnapshot) {
        currentLocal.x = targetLocal.x;
        currentLocal.y = targetLocal.y;
        currentYaw = targetYaw;
        firstSnapshot = false;
      }
    }
    startAnimation();
  });
})();
