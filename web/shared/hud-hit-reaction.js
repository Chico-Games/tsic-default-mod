// shared/hud-hit-reaction.js — Directional hit-reaction blood splat.
//
// Loaded by hud.js into the #hud-hit-reaction shell. On each incoming hit it
// spawns a TRANSIENT spray of blood hugging the screen edge in the direction
// the damage came from, sized by the damage amount, that splatters in then fades
// + drips out and removes itself. Concurrent hits stack as separate splats.
//
// Borrows detection's directional math: conic 0° = up, +clockwise == BearingDeg;
// edgeAnchor() solves the true ray↔viewport-rectangle intersection (aspect-
// correct) so the splat sits exactly on the bearing even near the corners.
//
// The spatter is a CLUSTER — one main blob plus scattered droplets thrown inward
// from the edge — each an organic blob roughened by an feTurbulence displacement
// filter (full Chromium under CEF). A thin conic edge band tints the rim red.
//
// Channel: tsic.msg.UI.Player.Hit { BearingDeg, Amount }   (Amount 0..1)
// Depends on: nothing (self-contained styles + SVG)
(function () {
  // A rough near-circular blob (viewBox 0 0 100 100, centred at 50,50). The
  // turbulence filter does the fine ragged edge; this just gives it lobes.
  var BLOB =
    'M50 6 C66 6 78 14 86 28 C92 39 96 50 92 64 C88 78 76 92 60 94 ' +
    'C45 96 33 90 23 80 C13 70 6 58 8 44 C10 28 22 14 36 9 C40 7 45 6 50 6 Z';

  var BLOOD = '92,3,6';        // base blood red
  var BLOOD_DARK = '48,0,2';   // rim / shadow

  var CSS = [
    '#hud-hit-reaction { position:fixed; inset:0; pointer-events:none; z-index:19; overflow:hidden; }',
    '.hr-splat { position:absolute; inset:0; pointer-events:none; animation: hr-life var(--life,1000ms) ease-out forwards; }',

    // Thin conic edge band at the bearing — a subtle red rim tint, NOT the main
    // read. Masked to hug the very edge so it doesn\'t wash the screen as fog.
    '.hr-wedge { position:absolute; inset:0;',
    '  -webkit-mask-image: radial-gradient(ellipse farthest-side at 50% 50%, transparent 74%, #000 99%);',
    '          mask-image: radial-gradient(ellipse farthest-side at 50% 50%, transparent 74%, #000 99%); }',

    // Each droplet is an HTML box holding one rough SVG blob, pinned by left/top.
    // Undistorted (square box) so circles stay circular on wide screens.
    '.hr-drop { position:absolute; transform-origin:50% 50%;',
    '  filter: drop-shadow(0 1px 2px rgba(20,0,0,0.6)); animation: hr-pop var(--pop,900ms) ease-out forwards; }',
    '.hr-drop svg { width:100%; height:100%; display:block; overflow:visible; }',

    // See-through at peak so the splat reads as blood ON the lens without
    // blocking the view behind it.
    '@keyframes hr-life { 0% { opacity:0; } 8% { opacity:0.52; } 52% { opacity:0.52; } 100% { opacity:0; } }',
    '@keyframes hr-pop  { 0% { transform: translateY(8%) scale(0.2); } 16% { transform: translateY(0) scale(1.12); } 100% { transform: translateY(0) scale(1.0); } }',

    '@media (prefers-reduced-motion: reduce) {',
    '  .hr-splat { animation: hr-life-rm var(--life,1000ms) linear forwards; }',
    '  .hr-drop { animation: none; }',
    '  @keyframes hr-life-rm { 0% { opacity:0; } 12% { opacity:0.5; } 60% { opacity:0.5; } 100% { opacity:0; } }',
    '}',
  ].join('\n');

  // Shared SVG defs: the turbulence displacement filter that roughens every blob
  // edge into organic spatter, plus the radial blood gradient (bright core →
  // dark rim) used as the fill.
  var DEFS =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<filter id="hr-rough" x="-40%" y="-40%" width="180%" height="180%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.045 0.05" numOctaves="2" seed="4" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter>' +
    '<radialGradient id="hr-fill" cx="42%" cy="38%" r="68%">' +
      '<stop offset="0%" stop-color="rgb(' + BLOOD + ')"/>' +
      '<stop offset="70%" stop-color="rgb(' + BLOOD + ')"/>' +
      '<stop offset="100%" stop-color="rgb(' + BLOOD_DARK + ')"/>' +
    '</radialGradient>' +
    '</defs></svg>';

  function injectStyles() {
    if (!document.getElementById('hud-hit-reaction-styles')) {
      var s = document.createElement('style');
      s.id = 'hud-hit-reaction-styles';
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    if (!document.getElementById('hud-hit-reaction-defs')) {
      var d = document.createElement('div');
      d.id = 'hud-hit-reaction-defs';
      d.innerHTML = DEFS;
      document.body.appendChild(d);
    }
  }

  var lerp = function (a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); };
  var rand = function (a, b) { return a + (b - a) * Math.random(); };

  function wedgeGradient(bearingDeg, alpha, w) {
    var from = ((bearingDeg % 360) + 360) % 360;
    return 'conic-gradient(from ' + from.toFixed(1) + 'deg,' +
      ' rgba(' + BLOOD + ',' + alpha.toFixed(3) + ') 0deg,' +
      ' rgba(' + BLOOD + ',0) ' + w.toFixed(1) + 'deg,' +
      ' rgba(' + BLOOD + ',0) ' + (360 - w).toFixed(1) + 'deg,' +
      ' rgba(' + BLOOD + ',' + alpha.toFixed(3) + ') 360deg)';
  }

  // Centre-ray ↔ viewport-rectangle intersection (percent), aspect-correct.
  function edgeAnchor(bearingDeg) {
    var t = (bearingDeg || 0) * Math.PI / 180;
    var dx = Math.sin(t), dy = -Math.cos(t);
    var a = (window.innerWidth || 1) / 2;
    var b = (window.innerHeight || 1) / 2;
    var tx = Math.abs(dx) > 1e-6 ? a / Math.abs(dx) : Infinity;
    var ty = Math.abs(dy) > 1e-6 ? b / Math.abs(dy) : Infinity;
    var s = Math.min(tx, ty);
    return { x: 50 + (s * dx) / a * 48, y: 50 + (s * dy) / b * 48 };
  }

  var root;
  // De-dupe for the playground only: its fixture re-broadcasts the last hit on
  // every control change, tagged with a monotonic _id. Skip repeats of the same
  // _id so dragging a slider doesn't spam splats. Real C++ hits carry no _id and
  // always fire.
  var lastHitId = null;

  // Pre-rasterized blob PNG used by every drop. Each hit creates 6–12 drops,
  // and each one as inline <svg filter="url(#hr-rough)"> made Chromium build a
  // new feTurbulence/feDisplacementMap graph per element — fully wasted work,
  // because the underlying path + filter inputs are identical. We bake the
  // filtered+gradient-filled blob into a PNG data URL once at module load,
  // then drops become <img src=…> with no SVG filter dependency at all.
  // Bake failure (rare CEF policy edge cases) falls back to the inline SVG.
  var BLOB_PNG = null;
  function bakeBlobPng() {
    var px = 220;   // generous enough that the filter's region grows aren't clipped
    var blobSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + px + '" viewBox="0 0 100 100">' +
      '<defs>' +
      '<filter id="hr-rough" x="-40%" y="-40%" width="180%" height="180%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.045 0.05" numOctaves="2" seed="4" result="n"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>' +
      '<radialGradient id="hr-fill" cx="42%" cy="38%" r="68%">' +
        '<stop offset="0%" stop-color="rgb(' + BLOOD + ')"/>' +
        '<stop offset="70%" stop-color="rgb(' + BLOOD + ')"/>' +
        '<stop offset="100%" stop-color="rgb(' + BLOOD_DARK + ')"/>' +
      '</radialGradient>' +
      '</defs>' +
      '<path d="' + BLOB + '" fill="url(#hr-fill)" filter="url(#hr-rough)"/>' +
      '</svg>';
    var img = new Image();
    img.onload = function () {
      try {
        var cvs = document.createElement('canvas');
        cvs.width = px; cvs.height = px;
        cvs.getContext('2d').drawImage(img, 0, 0);
        BLOB_PNG = cvs.toDataURL('image/png');
      } catch (e) { /* tainted-canvas / OOM — fall back to inline SVG */ }
    };
    img.onerror = function () { /* leave BLOB_PNG null; fallback path stays in use */ };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(blobSvg);
  }

  // One rough blood blob as an HTML box, centred on (xPct,yPct), `vmax` across.
  function makeDrop(xPct, yPct, vmax, pop, delay) {
    var d = document.createElement('div');
    d.className = 'hr-drop';
    d.style.width = vmax.toFixed(2) + 'vmax';
    d.style.height = vmax.toFixed(2) + 'vmax';
    d.style.left = 'calc(' + xPct.toFixed(2) + '% - ' + (vmax / 2).toFixed(2) + 'vmax)';
    d.style.top = 'calc(' + yPct.toFixed(2) + '% - ' + (vmax / 2).toFixed(2) + 'vmax)';
    d.style.setProperty('--pop', pop.toFixed(0) + 'ms');
    if (delay) d.style.animationDelay = delay.toFixed(0) + 'ms';
    if (BLOB_PNG) {
      var img = document.createElement('img');
      img.src = BLOB_PNG;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      d.appendChild(img);
    } else {
      // First-hit fallback (or bake failure): the original live-filter SVG.
      d.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        '<path d="' + BLOB + '" fill="url(#hr-fill)" filter="url(#hr-rough)"/></svg>';
    }
    return d;
  }

  function spawn(bearingDeg, amount) {
    if (!root) return;
    var amt = Math.max(0, Math.min(1, amount));
    var life = lerp(820, 1180, amt);
    var a = edgeAnchor(bearingDeg);

    // Inward unit direction (edge → screen centre), in percent space.
    var ix = 50 - a.x, iy = 50 - a.y;
    var ilen = Math.hypot(ix, iy) || 1; ix /= ilen; iy /= ilen;
    // Lateral (tangent) for jitter.
    var lx = -iy, ly = ix;

    var splat = document.createElement('div');
    splat.className = 'hr-splat';
    splat.style.setProperty('--life', life.toFixed(0) + 'ms');

    // Thin edge tint at the bearing.
    var wedge = document.createElement('div');
    wedge.className = 'hr-wedge';
    wedge.style.backgroundImage = wedgeGradient(bearingDeg, lerp(0.25, 0.6, amt), lerp(20, 40, amt));
    splat.appendChild(wedge);

    // Main blob right at the edge — kept compact so it doesn't dominate.
    var mainSize = lerp(7, 15, amt);
    splat.appendChild(makeDrop(a.x, a.y, mainSize, life * 0.7, 0));

    // A spray of smaller droplets thrown inward from the edge, thinning with
    // distance. Fewer + smaller than the main blob so the screen stays readable.
    var count = Math.round(lerp(5, 11, amt));
    for (var i = 0; i < count; i++) {
      var t = (i + 1) / (count + 1);                // 0..1 inward progress
      var dist = lerp(2, lerp(8, 22, amt), t);      // vmax-ish reach, scaled to %
      var reachPct = dist * (1 - 0.35 * t);
      var jitter = rand(-1, 1) * lerp(3, 8, t);
      var px = a.x + ix * reachPct + lx * jitter;
      var py = a.y + iy * reachPct + ly * jitter;
      var size = lerp(mainSize * 0.5, 0.9, t) * rand(0.7, 1.2);
      splat.appendChild(makeDrop(px, py, Math.max(0.5, size), life * rand(0.5, 0.8), rand(0, 90)));
    }

    splat.addEventListener('animationend', function (e) {
      if (e.target === splat) splat.remove();
    });
    root.appendChild(splat);
  }

  function onHit(p) {
    if (!p) return;
    if (p._id != null) {
      if (p._id === lastHitId) return;
      lastHitId = p._id;
    }
    var bearing = Number(p.BearingDeg) || 0;
    var amount = (p.Amount == null) ? 0.6 : Number(p.Amount);
    spawn(bearing, amount);
  }

  (function boot() {
    if (!window.tsic || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
    injectStyles();
    bakeBlobPng();
    root = document.getElementById('hud-hit-reaction');
    if (!root) { setTimeout(boot, 16); return; }
    tsic.whenReady(function () {
      tsic.on('tsic.msg.UI.Player.Hit', onHit);
    });
  })();
})();
