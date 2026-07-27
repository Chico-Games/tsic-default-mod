// shared/hud-minimap.js — Minimap with fixed zoom, always follows the player.
// DOM: #hud-minimap, #minimap-tex, #minimap-canvas (created by hud.js).
// Channel: UI.Map.Snapshot (player positions + world bounds at ~10 Hz).
//
// Position and rotation are interpolated between snapshots using
// requestAnimationFrame so movement appears smooth even if the message
// rate drops.
//
// PERF: everything is composited into the 180px canvas via drawImage — the
// world-map / fow <img> elements are kept visibility:hidden and used only as
// pixel sources. They must NEVER be shown and transform-animated per frame:
// they are world-sized (1px/cm), and animating them dirtied a huge region of
// the software-rendered CEF surface every frame, costing ~1.6ms/frame of
// game-thread time in FWebBrowserSingleton::Tick (2026-07-13 walk-soak trace,
// p50 4.5ms -> 6.4ms regression). Canvas damage is 180px and redraws are
// capped at ~60Hz, which keeps the browser tick at noise level.
(function () {
  var SIZE = 180;
  var HALF = SIZE / 2;
  var PX_PER_CM = 1;
  var ZOOM_FRACTION = 0.021;
  var LERP_SPEED = 12;
  // Min interval between canvas redraws while animating (~60Hz). Keep this
  // <= 16ms: CEF's off-screen capture samples the WHOLE page at the dominant
  // animation's cadence, so a 30Hz minimap made every HUD/screen update
  // (cursor, hovers, hit flashes) render at 30fps while the player moved.
  var REDRAW_MS = 16;

  var container = document.getElementById('hud-minimap');
  var tex = document.getElementById('minimap-tex');
  var fow = document.getElementById('minimap-fow');
  var cvs = document.getElementById('minimap-canvas');
  if (!container || !tex || !cvs) return;
  var ctx = cvs.getContext('2d');
  // Nearest-neighbor blits: matches the pixelated look the old <img> CSS
  // declared, and keeps each redraw sampling 180x180 points instead of
  // software-downscaling megapixels of the 4096px world texture.
  ctx.imageSmoothingEnabled = false;

  // Pixel sources only — never painted by the compositor (see PERF above).
  // visibility (not display) so the SetFogOfWarVisible cheat in hud.js can
  // keep using fow.style.display as the fog-enabled flag.
  tex.style.visibility = 'hidden';
  if (fow) fow.style.visibility = 'hidden';

  var bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, hasData: false };
  var worldW = 0, worldH = 0;
  var scale = 1;
  // Timestamp of the first snapshot with usable world bounds (see fogPending).
  var drawableSince = 0;

  var targetLocal = { x: 0, y: 0 };
  var currentLocal = { x: 0, y: 0 };
  var targetYaw = 0;
  var currentYaw = 0;
  var firstSnapshot = true;
  var players = [];
  var animating = false;
  var lastTime = 0;
  var lastRender = 0;
  var fowMsgs = 0;
  // Last fully-decoded fog bitmap — the only thing render() blits. Assigning
  // a new .src to a live <img> resets its JS-visible bitmap for the whole
  // fetch+decode (naturalWidth reads 0 and drawImage draws nothing until the
  // new PNG arrives), so blitting the element directly dropped the fog layer
  // for a few frames on every fog regen while moving — a visible flash.
  // reloadFow() decodes into an offscreen Image and swaps this reference only
  // once the bitmap is ready; a failed fetch simply keeps the previous fog.
  // The element may already be complete before this script runs, so seed
  // from it (the load listener below never fires for an already-loaded img).
  var fowDraw = (fow && fow.complete && fow.naturalWidth > 0) ? fow : null;
  // Height-tint overlay (shared/height-tint.js): offscreen 1px/tile canvas for
  // the local player's current height level. Pixel source only — never in DOM.
  var tintStore = null;
  var tintDraw = null;
  var myLevel = 0;
  function refreshTint() {
    var HT = window.TSICHeightTint;
    tintDraw = (tintStore && HT) ? HT.getCanvas(tintStore, myLevel) : null;
  }
  // Test/debug hook: the Gauntlet DOM-assert seam reads the caught-up idle
  // state (no-redraw-at-rest contract), the FOW refresh count, and the fog
  // alpha at the player's own map position (a healthy minimap is always
  // revealed where the player stands) through here. Not a public API.
  window.__tsicMinimap = {
    get animating() { return animating; },
    get fowMsgs() { return fowMsgs; },
    // True while the basemap is being withheld because fog can't cover it yet
    // (see fogPending below).
    get fogPending() { return fogPending(); },
    sampleFowAtPlayer: function () {
      var img = fowDraw;
      if (!img || !img.naturalWidth || !worldW || !worldH) return 'n/a';
      var c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      var x = c.getContext('2d');
      var px = Math.max(0, Math.min(img.naturalWidth - 1, currentLocal.x / worldW * img.naturalWidth));
      var py = Math.max(0, Math.min(img.naturalHeight - 1, currentLocal.y / worldH * img.naturalHeight));
      try {
        x.drawImage(img, px, py, 1, 1, 0, 0, 1, 1);
        return x.getImageData(0, 0, 1, 1).data[3]; // 0 = revealed, 255 = fogged
      } catch (e) { return 'err:' + e.name; }
    }
  };

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
    var visibleRadius = Math.max(worldW, worldH) * ZOOM_FRACTION;
    scale = HALF / visibleRadius;
    // Start the fog grace clock from the first frame the minimap could draw
    // anything, not from HUD boot: the HUD exists long before worldgen finishes,
    // so a boot-relative window expires while fog legitimately doesn't exist yet
    // (see fogPending).
    if (!drawableSince) drawableSince = Date.now();
  }

  function lerpAngle(from, to, t) {
    var diff = to - from;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    return from + diff * t;
  }

  // Blit the visible window of a world-sized source into the canvas. Sources
  // are <img> elements (naturalWidth) or offscreen canvases (width) — either
  // way the source rect is in source pixels; local coords are 1px/cm, so
  // rescale by the source's actual resolution relative to the world.
  function drawLayer(img, lx, ly, viewR) {
    if (!img || !worldW || !worldH) return;
    var sw = img.naturalWidth || img.width || 0;
    var sh = img.naturalHeight || img.height || 0;
    if (!sw || !sh) return;
    var kx = sw / worldW;
    var ky = sh / worldH;
    ctx.drawImage(img,
      (lx - viewR) * kx, (ly - viewR) * ky, 2 * viewR * kx, 2 * viewR * ky,
      0, 0, SIZE, SIZE);
  }

  // True while the fog layer is expected but its pixels aren't decoded yet. The
  // basemap must not be blitted in that window: world-map and fow are separate
  // fetches with no ordering guarantee, and the 'fow' runtime source only exists
  // once the first FOW texture has been generated — so at HUD boot it can 404
  // (retried below) while the basemap, baked during worldgen, already resolves.
  // The minimap then briefly showed unexplored ground. Fog counts as "expected"
  // once any UI.Map.Fow broadcast has been seen — plus a grace window, since the
  // first snapshot can beat the first fog broadcast. No fog at all (worldgen
  // disabled / dev map) resolves to "not expected" and the basemap draws.
  var FOW_ASSUME_OFF_MS = 3000;
  var fowSeen = false;
  var fowAssumedOff = false;
  function fogPending() {
    if (fowDraw && fowDraw.naturalWidth > 0) return false;
    if (!fow || fow.style.display === 'none') return false; // fog hidden by cheat
    if (fowAssumedOff) return false;
    if (fowSeen) return true;
    // Unknown: fail closed until the grace window (measured from first drawable
    // frame) expires, then treat fog as off for this session.
    return !drawableSince || (Date.now() - drawableSince) < FOW_ASSUME_OFF_MS;
  }

  function render() {
    if (!bounds.hasData) return;
    var lx = currentLocal.x;
    var ly = currentLocal.y;
    var viewR = HALF / scale;
    // Fully fogged is the honest default: draw no world pixels at all until the
    // fog layer can cover them. Player markers still draw (positions the HUD
    // already shares) so the minimap doesn't look dead.
    var pending = fogPending();

    ctx.clearRect(0, 0, SIZE, SIZE);
    if (!pending) drawLayer(tex, lx, ly, viewR);
    // Height tint (above/below the player's level) sits over the basemap but
    // under fog — fogged tiles stay uniformly fogged.
    if (!pending && tintDraw) drawLayer(tintDraw, lx, ly, viewR);
    // fow.style.display doubles as the SetFogOfWarVisible cheat flag (hud.js)
    if (!pending && fow && fow.style.display !== 'none') drawLayer(fowDraw, lx, ly, viewR);

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
    // Redraw cap: skip the lerp+render but keep the loop alive. dt spans the
    // skipped frames, so interpolation speed is unaffected.
    if (now - lastRender < REDRAW_MS) { requestAnimationFrame(tick); return; }
    lastRender = now;
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;

    var t = Math.min(1, LERP_SPEED * dt);
    currentLocal.x += (targetLocal.x - currentLocal.x) * t;
    currentLocal.y += (targetLocal.y - currentLocal.y) * t;
    currentYaw = lerpAngle(currentYaw, targetYaw, t);

    render();

    // Idle when fully caught up — no point redrawing while the player stands
    // still. The next snapshot calls startAnimation() and resumes.
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

  // The canvas only repaints on animation ticks — when a source image loads
  // (or fog pixels regenerate) at rest, repaint once so the new pixels show.
  // The fow <img> element itself only loads at boot (or via the 404 retry
  // below); fog refreshes go through reloadFow() so a mid-fetch swap never
  // blanks the fog layer (see fowDraw above).
  tex.addEventListener('load', render);
  if (fow) fow.addEventListener('load', function () { fowDraw = fow; render(); });

  var fowGen = 0;
  function reloadFow() {
    if (!fow) return;
    var gen = ++fowGen;
    var next = new Image();
    // Stale guard: refreshes can complete out of order; only the newest wins.
    next.onload = function () {
      if (gen !== fowGen) return;
      fowDraw = next;
      render();
    };
    next.src = TSIC.runtimeImgUrl('fow') + '?t=' + Date.now();
  }

  tsic.on('tsic.msg.UI.Map.Fow', function () {
    fowMsgs++;
    fowSeen = true;
    reloadFow();
  });

  // Sticky channel: a late-subscribing HUD replays the last TileGrid payload.
  tsic.on('tsic.msg.UI.Map.TileGrid', function (p) {
    var HT = window.TSICHeightTint;
    tintStore = HT ? HT.build(p) : null;
    if (tintStore && HT) HT.prebuild(tintStore);
    refreshTint();
    render();
  });

  // The world-map and fow image sources register only after their async
  // texture generation completes — a fast HUD boot can fetch either .imgsrc
  // before it exists, and a failed <img> never retries on its own, leaving
  // the minimap black/fog-less until the HUD DOM is rebuilt (e.g. after
  // opening the map screen). Re-fetch on the snapshot tick until pixels
  // actually arrive. (Fog CONTENT staleness is handled separately: the
  // UI.Map.Fow bridge message is cached, so a late-subscribing page replays
  // the last regen and the handler below refetches.)
  var texRetryAt = 0;
  var fowRetries = 0;
  function retryFailedImg(img, name, now) {
    if (!img || !img.complete || img.naturalWidth > 0) return false;
    img.src = TSIC.runtimeImgUrl(name) + '?t=' + now;
    return true;
  }
  function ensureTexLoaded() {
    var now = Date.now();
    if (now < texRetryAt) return;
    texRetryAt = now + 2000;
    retryFailedImg(tex, 'world-map', now);
    if (!retryFailedImg(fow, 'fow', now)) return;
    // Bounded: a fog source that never resolves must not veil the minimap for
    // the rest of the session (see fogPending) — after ~20s, draw the basemap.
    if (++fowRetries >= 10 && !fowAssumedOff) {
      console.warn('[minimap] fog texture never loaded — drawing basemap unfogged');
      fowAssumedOff = true;
    }
  }

  tsic.on('tsic.msg.UI.Map.Snapshot', function (p) {
    if (!p) return;
    ensureTexLoaded();
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
      var lvl = (typeof me.HeightLevel === 'number') ? (me.HeightLevel | 0) : myLevel;
      if (lvl !== myLevel) {
        myLevel = lvl;
        refreshTint();
        render();
      }
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
