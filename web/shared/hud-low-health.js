// shared/hud-low-health.js — Low-health blood overlay (scattered animated splats).
//
// Loaded by hud.js into the #hud-low-health shell. Rides the health vial's
// channel: UI.Player.Attribute { Channel:'Health', Current, Max }.
//
// Subtle, atmospheric: small blood splatters scattered randomly around the
// screen (centre kept clear), each a hand-authored SVG roughened by an animated
// turbulence filter so the edges slowly WRITHE (wet/alive). They splatter IN
// with a quick pop as you cross the threshold, and the whole field breathes with
// a slow heartbeat that quickens toward death. More splats fade in / grow bolder
// as HP drops; they recede as the player heals. Above the threshold the layer is
// transparent with no running animation.
//
// The edge vignette is painted art (/img/blood-vignette.png) masked per edge;
// the splats are procedural SVG. Honors prefers-reduced-motion.
//
// Channel: tsic.msg.UI.Player.Attribute (Channel === 'Health')
(function () {
  var THRESHOLD = 0.20;
  var COUNT = 16;                 // splats scattered around the screen
  var BLOOD = '120,8,12';
  var BLOOD_DARK = '40,0,3';

  // Deterministic RNG (mulberry32) so the scatter is stable frame-to-frame.
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // A rough near-round blob (viewBox 0 0 100 100) — turbulence does the ragged
  // edge; this gives it lobes.
  var BLOB =
    'M50 8 C64 8 76 16 84 30 C90 41 94 52 90 65 C86 78 74 90 60 92 ' +
    'C46 94 34 88 25 79 C15 69 9 57 11 44 C13 29 24 16 37 11 C41 9 46 8 50 8 Z';

  var CSS = [
    '@property --beat { syntax:"<number>"; inherits:true; initial-value:1; }',
    '@property --depth { syntax:"<percentage>"; inherits:true; initial-value:8%; }',
    '#hud-low-health { position:fixed; inset:0; pointer-events:none; z-index:18; overflow:hidden;',
    '  opacity:0; transition: opacity 500ms ease; }',
    '#hud-low-health.lh-on { opacity:1; }',

    // Blood vignette — painted border art (T_Blood, alpha-faded centre) stretched
    // over the full screen, with one mask fade per edge so the soft transition
    // reaches every edge AND every corner (where two edge fades overlap and
    // deepen). The art is fully visible at the screen border, masked to
    // transparent --depth into the screen. --depth scales with damage (see
    // apply()).
    '#hud-low-health .lh-vignette { position:absolute; inset:0;',
    '  background: url(/img/blood-vignette.png) center / 100% 100% no-repeat;',
    '  -webkit-mask-image: linear-gradient(to bottom,#000,transparent var(--depth,8%)), linear-gradient(to top,#000,transparent var(--depth,8%)), linear-gradient(to right,#000,transparent var(--depth,8%)), linear-gradient(to left,#000,transparent var(--depth,8%));',
    '          mask-image: linear-gradient(to bottom,#000,transparent var(--depth,8%)), linear-gradient(to top,#000,transparent var(--depth,8%)), linear-gradient(to right,#000,transparent var(--depth,8%)), linear-gradient(to left,#000,transparent var(--depth,8%));',
    '  transition: --depth 500ms ease; }',

    // Each splat: an absolutely-placed square holding one rough SVG cluster. The
    // splatter-in pop plays once when the layer turns on; --st staggers them.
    // Independent rotate/scale props (not the transform shorthand) so the static
    // per-splat rotation and the animated pop scale don\'t clobber each other.
    '#hud-low-health .lh-splat { position:absolute; transform-origin:50% 50%; opacity:0; scale:0.4;',
    '  filter: drop-shadow(0 1px 2px rgba(15,0,0,0.5)); }',
    '#hud-low-health.lh-on .lh-splat { animation: lh-pop 460ms cubic-bezier(0.22,1.4,0.5,1) var(--st,0ms) forwards; }',
    '#hud-low-health .lh-splat svg { width:100%; height:100%; display:block; overflow:visible; }',
    '@keyframes lh-pop { 0% { opacity:0; scale:0.35; } 70% { scale:1.06; } 100% { opacity:var(--sa,0.5); scale:1; } }',

    // The whole field breathes — gentle opacity throb (heartbeat) on the stage.
    '#hud-low-health.lh-on .lh-stage { animation: lh-beat var(--pulse,1.8s) ease-in-out infinite; }',
    '#hud-low-health .lh-stage { position:absolute; inset:0; }',
    '@keyframes lh-beat {',
    '  0%,100% { opacity: var(--lo,0.7); }',
    '  14% { opacity: var(--hi,1); }',
    '  28% { opacity: calc(var(--lo,0.7) * 1.08); }',
    '  40% { opacity: calc(var(--hi,1) * 0.92); }',
    '  55% { opacity: var(--lo,0.7); }',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  #hud-low-health.lh-on .lh-splat { animation:none; opacity:var(--sa,0.5); scale:1; }',
    '  #hud-low-health.lh-on .lh-stage { animation:none; opacity:var(--hi,1); }',
    '}',
  ].join('\n');

  // Shared turbulence filter — gives every splat a ragged, organic edge via a
  // one-shot displacement map. (The baseFrequency previously animated to make
  // the edge writhe, but that re-rasterized the filter region every frame for
  // each of 16 splats. The reduced-motion media query already disabled it, and
  // the effect is subtle enough that doing the same for everyone is invisible.)
  var DEFS =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<filter id="lh-rough" x="-40%" y="-40%" width="180%" height="180%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.05 0.06" numOctaves="2" seed="21" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G"/>' +
    '</filter>' +
    '<radialGradient id="lh-fill" cx="42%" cy="38%" r="68%">' +
      '<stop offset="0%" stop-color="rgb(' + BLOOD + ')"/>' +
      '<stop offset="66%" stop-color="rgb(' + BLOOD + ')"/>' +
      '<stop offset="100%" stop-color="rgb(' + BLOOD_DARK + ')"/>' +
    '</radialGradient>' +
    '</defs></svg>';

  function injectStyles() {
    if (!document.getElementById('hud-low-health-styles')) {
      var s = document.createElement('style');
      s.id = 'hud-low-health-styles';
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    if (!document.getElementById('hud-low-health-defs')) {
      var d = document.createElement('div');
      d.id = 'hud-low-health-defs';
      d.innerHTML = DEFS;
      document.body.appendChild(d);
    }
  }

  var lerp = function (a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); };

  // One splat = a main blob + a few scattered droplets (procedural, seeded), all
  // run through the writhing turbulence filter.
  function splatSvg(r) {
    var parts = '<g transform="translate(20 20) scale(0.6)"><path d="' + BLOB + '" fill="url(#lh-fill)" filter="url(#lh-rough)"/></g>';
    var drops = 2 + Math.floor(r() * 4);
    for (var i = 0; i < drops; i++) {
      var dx = 10 + r() * 80, dy = 10 + r() * 80;
      var dr = 4 + r() * 12;
      parts += '<g transform="translate(' + (dx - dr) + ' ' + (dy - dr) + ') scale(' + (dr * 2 / 100) + ')">' +
        '<path d="' + BLOB + '" fill="url(#lh-fill)" filter="url(#lh-rough)"/></g>';
    }
    return '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + parts + '</svg>';
  }

  var root, vignette, stage, splats = [];

  function build() {
    root = document.getElementById('hud-low-health');
    if (!root) return false;

    vignette = document.createElement('div');
    vignette.className = 'lh-vignette lh-stage';
    root.appendChild(vignette);

    stage = document.createElement('div');
    stage.className = 'lh-stage';
    root.appendChild(stage);

    var r = rng(0x5eed1234);
    for (var i = 0; i < COUNT; i++) {
      // Edge-anchored: every splat hugs one of the four edges. `along` runs the
      // splat down the edge; `inward` is a small offset in from it (so they stay
      // in a thin perimeter band, never drifting toward the centre).
      var edge = i % 4;                       // even spread across the 4 edges
      var along = r() * 100;
      var inward = r() * 7;                   // 0–7% in from the edge (tight hug)
      var x, y;
      if (edge === 0) { x = along; y = inward; }              // top
      else if (edge === 1) { x = 100 - inward; y = along; }   // right
      else if (edge === 2) { x = along; y = 100 - inward; }   // bottom
      else { x = inward; y = along; }                          // left

      var size = lerp(7, 18, r());            // vmax — small + subtle
      var el = document.createElement('div');
      el.className = 'lh-splat';
      el.style.width = size.toFixed(1) + 'vmax';
      el.style.height = size.toFixed(1) + 'vmax';
      el.style.left = 'calc(' + x.toFixed(1) + '% - ' + (size / 2).toFixed(1) + 'vmax)';
      el.style.top = 'calc(' + y.toFixed(1) + '% - ' + (size / 2).toFixed(1) + 'vmax)';
      el.style.setProperty('--st', Math.floor(r() * 380) + 'ms');     // splatter stagger
      el.style.rotate = Math.floor(r() * 360) + 'deg';
      el.dataset.edge = (inward / 7).toFixed(3);    // 0 = right on the edge … 1 = innermost band
      el.innerHTML = splatSvg(r);
      stage.appendChild(el);
      splats.push(el);
    }
    return true;
  }

  function apply(intensity) {
    if (!root) return;
    if (intensity <= 0.001) { root.classList.remove('lh-on'); return; }
    root.classList.add('lh-on');

    // Subtle throughout. Heartbeat band + speed.
    var hi = lerp(0.78, 1.0, intensity);
    var lo = hi * lerp(0.78, 0.5, intensity);
    var pulse = lerp(1.9, 0.7, intensity).toFixed(2) + 's';
    // How far the blood art reaches in from each edge: ~6% when mild (just the
    // outer grunge rim) → ~19% at death. (% of the relevant screen dimension per
    // edge: height for top/bottom, width for left/right — so the band is
    // naturally a touch deeper on the sides.)
    var depth = lerp(6, 19, intensity).toFixed(2) + '%';

    root.style.setProperty('--lo', lo.toFixed(3));
    root.style.setProperty('--hi', hi.toFixed(3));
    root.style.setProperty('--pulse', pulse);
    root.style.setProperty('--depth', depth);

    // Each splat's settled opacity ramps with intensity; edge splats lead,
    // inner ones only join in as HP gets dire (so it creeps inward).
    for (var i = 0; i < splats.length; i++) {
      var edgeT = parseFloat(splats[i].dataset.edge) || 0;     // 0 = at edge
      var reach = Math.max(0, Math.min(1, (intensity - edgeT * 0.55) / 0.6));
      var sa = lerp(0.0, lerp(0.22, 0.6, intensity), reach);   // subtle cap
      splats[i].style.setProperty('--sa', sa.toFixed(3));
    }
  }

  function onAttribute(p) {
    if (!p || p.Channel !== 'Health') return;
    var max = Number(p.Max) || 1;
    var frac = max > 0 ? (Number(p.Current) || 0) / max : 0;
    apply(Math.max(0, Math.min(1, (THRESHOLD - frac) / THRESHOLD)));
  }

  (function boot() {
    if (!window.tsic || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
    injectStyles();
    if (!build()) { setTimeout(boot, 16); return; }
    tsic.whenReady(function () {
      tsic.on('tsic.msg.UI.Player.Attribute', onAttribute);
    });
  })();
})();
