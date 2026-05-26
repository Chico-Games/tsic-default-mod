// shared/hud-minimap.js — Minimap with fixed zoom, always follows the player.
// DOM: #hud-minimap, #minimap-tex, #minimap-canvas (created by hud.js).
// Channel: UI.Map.Snapshot (player positions + world bounds at ~2 Hz).
(function () {
  var SIZE = 180;
  var HALF = SIZE / 2;
  var PX_PER_CM = 1;
  var ZOOM_FRACTION = 0.15;

  var container = document.getElementById('hud-minimap');
  var tex = document.getElementById('minimap-tex');
  var cvs = document.getElementById('minimap-canvas');
  if (!container || !tex || !cvs) return;
  var ctx = cvs.getContext('2d');

  var bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, hasData: false };
  var worldW = 0, worldH = 0;
  var scale = 1;
  var selfLocal = { x: 0, y: 0 };
  var selfYaw = 0;
  var players = [];

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
    worldW = (bounds.maxX - bounds.minX) * PX_PER_CM;
    worldH = (bounds.maxY - bounds.minY) * PX_PER_CM;
    tex.style.width = worldW + 'px';
    tex.style.height = worldH + 'px';
    var visibleRadius = Math.max(worldW, worldH) * ZOOM_FRACTION;
    scale = HALF / visibleRadius;
  }

  function render() {
    if (!bounds.hasData) return;
    var lx = selfLocal.x;
    var ly = selfLocal.y;
    var tx = HALF - lx * scale;
    var ty = HALF - ly * scale;
    tex.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';

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
    ctx.rotate((selfYaw - 90) * Math.PI / 180);
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

  tsic.on('tsic.msg.UI.Map.Snapshot', function (p) {
    if (!p) return;
    updateBounds(p.MinBounds, p.MaxBounds);
    players = p.Players || [];
    if (players.length > 0) {
      var me = players[0];
      selfLocal = worldToLocal(
        (me.Position && me.Position.X) || 0,
        (me.Position && me.Position.Y) || 0
      );
      selfYaw = me.YawDeg || 0;
    }
    render();
  });
})();
