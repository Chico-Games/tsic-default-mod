// shared/hud-detection.js — directional "you have been spotted" overlay.
//
// Loaded by hud.js into the #hud-detection shell. One angular wedge per enemy
// that can see you, hugging the screen edge in that enemy's true direction,
// plus an ambient edge vignette driven by the overall mist value.
//
// Channel: tsic.msg.UI.Detection.State
//   { Enemies: [{ BearingDeg, DetectionScore }], ScreenMist }
// published by UDetectionHUDComponent, throttled to 6 Hz on the C++ side.
//
// This render lived in screens/detection.html, which nothing ever loads — the
// live UI is in-game.html plus the hud-*.js components — so the whole feature
// was broadcasting into a page no player ever saw (GH #83). It is here now for
// the same reason every other overlay is: hud.js is the only thing that mounts.
(function () {
  // A barbed, concave-sided spike rather than a clean chevron — points inward,
  // reads like a claw. This is the morph's resting state; chev-morph animates
  // `d` between this and a lunged claw.
  var CHEVRON_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 3 C12.6 8.5 13.8 12.2 15 15 L18.5 19.5 L13.2 16 C12.7 17.2 11.3 17.2 10.8 16 ' +
    'L5.5 19.5 L9 15 C10.2 12.2 11.4 8.5 12 3 Z"/></svg>';

  // Muted dark red (a faint contact) to bright red (locked on). Eased so the
  // glow stays subdued through the low-mid range and only reaches alarm red as
  // the threat closes on full detection.
  var C_LOW = [130, 68, 64];
  var C_HIGH = [231, 76, 60];

  var CSS = [
    // The whole effect lives on the screen EDGES; the centre stays clear.
    // Below the blood overlays (low-health z18, hit-reaction z19) so damage
    // feedback always reads over it, above the stealth shroud (z17).
    '#hud-detection { position:fixed; inset:0; pointer-events:none; z-index:17; }',

    // Ambient edge vignette (overall detection). Faint by design: it conveys
    // "something is watching" without competing with the wedges that say where.
    '#hud-detection .dt-vignette { position:fixed; inset:0; z-index:0; pointer-events:none;',
    '  opacity:0; --edge:10%; --col:231,76,60;',
    '  background:',
    '    linear-gradient(to right,  rgba(var(--col),0.7), transparent var(--edge)),',
    '    linear-gradient(to left,   rgba(var(--col),0.7), transparent var(--edge)),',
    '    linear-gradient(to bottom, rgba(var(--col),0.7), transparent var(--edge)),',
    '    linear-gradient(to top,    rgba(var(--col),0.7), transparent var(--edge));',
    '  transition:opacity 220ms ease; will-change:opacity; }',
    '#hud-detection .dt-vignette.pulse { animation:dt-edge-pulse var(--pulse,1.8s) ease-in-out infinite; }',
    '@keyframes dt-edge-pulse { 0%,100% { opacity:var(--lo,0.12); } 50% { opacity:var(--hi,0.3); } }',

    // Per-enemy directional wedge: a screen-centred conic gradient (conic 0deg
    // is up and runs clockwise, exactly the BearingDeg convention) masked down
    // to the outer ring, so the bright band lands on the edge in the threat's
    // true direction while the middle of the screen stays unobscured.
    '#hud-detection .dt-arc { position:fixed; inset:0; z-index:1; pointer-events:none;',
    '  opacity:var(--hi,0.7);',
    '  -webkit-mask-image: radial-gradient(ellipse farthest-side at 50% 50%, transparent 46%, #000 92%);',
    '          mask-image: radial-gradient(ellipse farthest-side at 50% 50%, transparent 46%, #000 92%);',
    '  will-change:opacity; }',
    '#hud-detection .dt-arc.pulse { animation:dt-arc-pulse var(--pulse,1.6s) ease-in-out infinite; }',
    '@keyframes dt-arc-pulse { 0%,100% { opacity:var(--lo,0.3); } 50% { opacity:var(--hi,0.8); } }',

    // Inward-pointing claw pinpointing the exact bearing on the edge.
    '#hud-detection .dt-chev { position:fixed; left:0; top:0; width:32px; height:32px;',
    '  margin-left:-16px; margin-top:-16px; z-index:3; pointer-events:none;',
    '  opacity:var(--hi,0.7);',
    // Dark halo separates the mark from the red glow behind it.
    '  filter:drop-shadow(0 0 4px rgba(0,0,0,0.85)); }',
    '#hud-detection .dt-chev svg { width:100%; height:100%; display:block; transform-origin:50% 50%; overflow:visible; }',
    // paint-order puts the stroke behind the fill, giving a clean dark edge.
    '#hud-detection .dt-chev path { fill:var(--chev-fill, rgb(255,246,242)); stroke:#000; stroke-width:2.4;',
    '  stroke-linejoin:miter; paint-order:stroke; }',
    '#hud-detection .dt-chev.pulse { animation:dt-chev-pulse var(--pulse,1.6s) ease-in-out infinite; }',
    // The claw geometry itself morphs — a real animation on the path's `d`, not
    // a transform wobble — so the barbs splay and the spike lunges out.
    '#hud-detection .dt-chev.pulse svg  { animation:dt-chev-throb var(--pulse,1.6s) ease-in-out infinite; }',
    '#hud-detection .dt-chev.pulse path { animation:dt-chev-morph var(--pulse,1.6s) ease-in-out infinite; }',
    '@keyframes dt-chev-pulse { 0%,100% { opacity:var(--lo,0.45); } 50% { opacity:var(--hi,0.9); } }',
    '@keyframes dt-chev-throb { 0%,100% { transform:scale(var(--throb-lo,0.96)); } 50% { transform:scale(var(--throb-hi,1.08)); } }',
    // Both paths share the same command sequence (M C L L C L L C Z) so the
    // morph interpolates cleanly instead of snapping.
    '@keyframes dt-chev-morph {',
    '  0%,100% { d: path("M12 3 C12.6 8.5 13.8 12.2 15 15 L18.5 19.5 L13.2 16 C12.7 17.2 11.3 17.2 10.8 16 L5.5 19.5 L9 15 C10.2 12.2 11.4 8.5 12 3 Z"); }',
    '  50%     { d: path("M12 0.5 C12.9 8 14.6 12.6 16.2 15.6 L21.5 22 L13.6 16.6 C12.9 19 11.1 19 10.4 16.6 L2.5 22 L7.8 15.6 C9.4 12.6 11.1 8 12 0.5 Z"); }',
    '}',

    // Players who opt out of motion get a steady read instead of a pulsing one.
    // Both the OS preference and the in-game Motion & Comfort setting, which is
    // the same gate hud-stealth.js honours.
    '@media (prefers-reduced-motion: reduce) {',
    '  #hud-detection .dt-vignette.pulse, #hud-detection .dt-arc.pulse,',
    '  #hud-detection .dt-chev.pulse, #hud-detection .dt-chev.pulse svg,',
    '  #hud-detection .dt-chev.pulse path { animation:none; }',
    '}',
    'html[data-tsic-no-screen-pulse] #hud-detection .dt-vignette.pulse,',
    'html[data-tsic-no-screen-pulse] #hud-detection .dt-arc.pulse,',
    'html[data-tsic-no-screen-pulse] #hud-detection .dt-chev.pulse,',
    'html[data-tsic-no-screen-pulse] #hud-detection .dt-chev.pulse svg,',
    'html[data-tsic-no-screen-pulse] #hud-detection .dt-chev.pulse path { animation:none; }',
  ].join('\n');

  var root = null;
  var threats = null;
  var vignette = null;
  var lastPayload = null;

  function clamp01(v) { return Math.max(0, Math.min(1, v || 0)); }
  function lerp(a, b, t) { return a + (b - a) * clamp01(t); }

  function rampColor(t) {
    var k = Math.pow(clamp01(t), 1.3);
    function mix(a, b) { return Math.round(a + (b - a) * k); }
    return mix(C_LOW[0], C_HIGH[0]) + ', ' + mix(C_LOW[1], C_HIGH[1]) + ', ' + mix(C_LOW[2], C_HIGH[2]);
  }

  // conic-gradient(from <bearing>deg ...) puts gradient-angle 0 at the bearing
  // direction. One soft band centred on 0/360 (half-width w), transparent
  // everywhere else, so the bright arc points exactly at the threat.
  function wedgeGradient(bearingDeg, col, w) {
    var from = (((bearingDeg || 0) % 360) + 360) % 360;
    return 'conic-gradient(from ' + from.toFixed(1) + 'deg,' +
      ' rgba(' + col + ',0.95) 0deg,' +
      ' rgba(' + col + ',0) ' + w.toFixed(1) + 'deg,' +
      ' rgba(' + col + ',0) ' + (360 - w).toFixed(1) + 'deg,' +
      ' rgba(' + col + ',0.95) 360deg)';
  }

  // Where a ray from screen centre meets the viewport edge, for placing the
  // claw, plus the inward rotation that points it back at centre. This has to
  // account for the real aspect ratio: the conic wedge follows the true
  // geometric angle, so normalising by max(|dx|,|dy|) drifts off the wedge near
  // the corners — on a 16:9 screen the diagonal sits at atan(16/9), not 45deg.
  // Solve the actual ray-rectangle intersection in pixels instead.
  function edgeAnchor(bearingDeg) {
    var t = (bearingDeg || 0) * Math.PI / 180;
    var dx = Math.sin(t), dy = -Math.cos(t);
    var a = (window.innerWidth || 1) / 2;
    var b = (window.innerHeight || 1) / 2;
    var tx = Math.abs(dx) > 1e-6 ? a / Math.abs(dx) : Infinity;
    var ty = Math.abs(dy) > 1e-6 ? b / Math.abs(dy) : Infinity;
    var s = Math.min(tx, ty);
    return {
      x: 50 + ((s * dx) / a) * 45.5,
      y: 50 + ((s * dy) / b) * 45.5,
      rotDeg: (bearingDeg || 0) + 180,
    };
  }

  function clearVignette() {
    vignette.style.opacity = '0';
    vignette.classList.remove('pulse');
  }

  function renderEnemy(e) {
    var score = clamp01(e && e.DetectionScore);
    if (score <= 0) return;

    var col = rampColor(score);
    // Visible floor: even a faint contact reads, then climbs to a hard bright
    // lock at full detection.
    var hi = lerp(0.62, 1.0, score);
    // Flash depth: barely breathes when low, hard strobe when near spotted.
    var lo = hi * lerp(0.9, 0.32, score);
    // Flash speed: slow when low, urgent when near spotted.
    var pulse = lerp(3.0, 0.55, score).toFixed(2) + 's';
    // Width and inward reach both grow with the threat; the reach is driven by
    // the mask's clear centre shrinking.
    var w = lerp(22, 46, score);
    var innerClear = lerp(60, 32, score);
    var mask = 'radial-gradient(ellipse farthest-side at 50% 50%, transparent ' +
      innerClear.toFixed(1) + '%, #000 94%)';
    // The claw tracks the threat too. Hold red at full brightness and crash the
    // green/blue channels down fast, so it is saturated red by ~45% detection
    // rather than washing out to pink through the mid range.
    var ct = Math.pow(Math.min(1, score / 0.45), 0.7);
    function gb(hiC) { return Math.round(255 + (hiC - 255) * ct); }
    var chevFill = 'rgb(255, ' + gb(38) + ', ' + gb(32) + ')';
    var chevScale = lerp(0.65, 1.95, score);
    var throbLo = lerp(0.98, 0.8, score);
    var throbHi = lerp(1.02, 1.22, score);
    var anchor = edgeAnchor(e.BearingDeg);

    var arc = document.createElement('div');
    arc.className = 'dt-arc pulse';
    arc.style.setProperty('--hi', hi.toFixed(3));
    arc.style.setProperty('--lo', lo.toFixed(3));
    arc.style.setProperty('--pulse', pulse);
    arc.style.webkitMaskImage = mask;
    arc.style.maskImage = mask;
    arc.style.backgroundImage = wedgeGradient(e.BearingDeg, col, w);
    threats.appendChild(arc);

    var chev = document.createElement('div');
    chev.className = 'dt-chev pulse';
    chev.style.setProperty('--col', col);
    chev.style.setProperty('--hi', hi.toFixed(3));
    chev.style.setProperty('--lo', lo.toFixed(3));
    chev.style.setProperty('--pulse', pulse);
    chev.style.setProperty('--chev-fill', chevFill);
    chev.style.setProperty('--throb-lo', throbLo.toFixed(3));
    chev.style.setProperty('--throb-hi', throbHi.toFixed(3));
    chev.style.left = anchor.x + '%';
    chev.style.top = anchor.y + '%';
    chev.style.transform = 'rotate(' + anchor.rotDeg + 'deg) scale(' + chevScale.toFixed(2) + ')';
    chev.innerHTML = CHEVRON_SVG;
    threats.appendChild(chev);
  }

  function render(p) {
    if (!root) return;
    lastPayload = p;
    threats.textContent = '';

    if (!p) {
      clearVignette();
      return;
    }

    var enemies = p.Enemies || [];
    for (var i = 0; i < enemies.length; i++) {
      renderEnemy(enemies[i]);
    }

    var mist = clamp01(p.ScreenMist);
    if (mist <= 0.001) {
      clearVignette();
      return;
    }
    var hi = lerp(0.16, 0.4, mist);
    var lo = hi * lerp(0.92, 0.45, mist);
    vignette.style.setProperty('--col', rampColor(mist));
    vignette.style.setProperty('--edge', lerp(7, 13, mist).toFixed(1) + '%');
    vignette.style.setProperty('--hi', hi.toFixed(3));
    vignette.style.setProperty('--lo', lo.toFixed(3));
    vignette.style.setProperty('--pulse', lerp(3.2, 0.85, mist).toFixed(2) + 's');
    // Steady fallback for anyone who has the pulse turned off.
    vignette.style.opacity = hi.toFixed(3);
    vignette.classList.add('pulse');
  }

  function injectStyles() {
    if (document.getElementById('hud-detection-styles')) return;
    var s = document.createElement('style');
    s.id = 'hud-detection-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function build() {
    root = document.getElementById('hud-detection');
    if (!root) return false;
    vignette = document.createElement('div');
    vignette.className = 'dt-vignette';
    root.appendChild(vignette);
    threats = document.createElement('div');
    threats.className = 'dt-threats';
    root.appendChild(threats);
    return true;
  }

  (function boot() {
    if (!window.tsic || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
    injectStyles();
    if (!build()) { setTimeout(boot, 16); return; }
    tsic.whenReady(function () {
      tsic.on('tsic.msg.UI.Detection.State', render);
    });
    // Claw placement depends on viewport size, so re-lay-out on resize to keep
    // it glued to its wedge.
    window.addEventListener('resize', function () { render(lastPayload); });
  })();
})();
