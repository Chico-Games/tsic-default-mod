// shared/hud-liquid-bar.js — reusable "liquid vial" bar (health / stamina / …).
//
// A stylised specimen-vial that fills bottom-up behind glass, with an optional
// scrolling wavy surface, a lagging darker damage-trail, a colour ramp, value
// readout, vertical label, danger pulse, full-to-the-brim flat top, and (on
// damage) side-spill droplets that trace down as the level drops.
//
// Usage:
//   TSICLiquidBar.mount(rootEl, {
//     channel:  'Health',          // UI.Player.Attribute channel to follow
//     label:    'Health',          // vertical label text
//     waves:    true,              // wavy animated surface (false = flat top)
//     droplets: true,              // side-spill droplets on damage
//     palette:  { lo:[r,g,b], hi:[r,g,b], trail:'#hex', rim:'r,g,b' },
//   });
// The CALLER positions/sizes rootEl (position, left/bottom, width, --vial-h).
(function (global) {
  const NS = global.TSICLiquidBar = global.TSICLiquidBar || {};

  const CSS = [
    '.tlb-vial { font-family: Georgia, "Libre Baskerville", serif; --hp:#cf2233; --trail:#4f0a0f; --rim:207,34,51; --level:72%; --trail-level:72%; }',
    '.tlb-glass { position:relative; width:100%; height:var(--vial-h,248px); border-radius:13px; overflow:hidden; background:linear-gradient(180deg, rgba(58,40,34,0.55), rgba(14,9,8,0.62)); border:3px solid var(--ink-night); box-shadow: inset 0 1px 0 rgba(255,250,240,0.18), inset 0 0 18px rgba(0,0,0,0.55), var(--shadow-block); }',
    '.tlb-trail { position:absolute; left:0; right:0; bottom:0; height:var(--trail-level); background:linear-gradient(180deg, var(--trail), color-mix(in srgb, var(--trail) 65%, #000)); }',
    '.tlb-liquid { position:absolute; left:0; right:0; bottom:0; height:var(--level); background:linear-gradient(180deg, var(--hp), color-mix(in srgb, var(--hp) 55%, #1a0606)); transition: background 400ms linear; box-shadow: inset 0 8px 14px rgba(0,0,0,0.22); }',
    '.tlb-surface { position:absolute; left:-20px; right:-20px; height:16px; -webkit-mask-repeat:repeat-x; mask-repeat:repeat-x; -webkit-mask-size:120px 16px; mask-size:120px 16px; will-change:-webkit-mask-position,mask-position; }',
    '.tlb-surface.tlb-front { top:-9px; background:var(--hp); animation: tlb-wave 2.6s linear infinite; }',
    '.tlb-surface.tlb-back { top:-12px; background:var(--hp); opacity:0.45; animation: tlb-wave 4.3s linear infinite reverse; }',
    '.tlb-surface.tlb-twave { top:-12px; height:14px; background:var(--trail); opacity:0.96; -webkit-mask-size:120px 14px; mask-size:120px 14px; animation: tlb-wave 5.4s linear infinite; }',
    '@keyframes tlb-wave { from { -webkit-mask-position:0 0; mask-position:0 0; } to { -webkit-mask-position:-120px 0; mask-position:-120px 0; } }',
    '.tlb-vial.tlb-full .tlb-surface { display:none; }',
    '.tlb-ticks { position:absolute; inset:0; pointer-events:none; }',
    '.tlb-ticks::before { content:""; position:absolute; right:10px; top:0; bottom:0; width:12px; background: repeating-linear-gradient(180deg, rgba(255,250,240,0) 0, rgba(255,250,240,0) calc(25% - 1px), rgba(255,250,240,0.22) calc(25% - 1px), rgba(255,250,240,0.22) 25%); }',
    '.tlb-glare { position:absolute; left:0; right:0; top:0; height:46%; background:linear-gradient(180deg, rgba(255,250,240,0.16), transparent); pointer-events:none; }',
    '.tlb-label { position:absolute; left:50%; top:50%; z-index:2; transform: translate(-50%,-50%) rotate(-90deg); white-space:nowrap; font-size:11px; letter-spacing:0.42em; text-transform:uppercase; font-weight:700; color:#f0e7d4; text-shadow:0 1px 2px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.7); }',
    '.tlb-readout { position:absolute; left:0; right:0; bottom:10px; z-index:2; text-align:center; font-weight:700; font-size:21px; letter-spacing:0.02em; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.95), 0 0 5px rgba(0,0,0,0.7); pointer-events:none; }',
    '.tlb-readout .tlb-max { display:block; font-size:10px; opacity:0.8; margin-top:-1px; }',
    '.tlb-drip { position:absolute; width:4px; height:7px; border-radius:50% 50% 50% 50% / 60% 60% 40% 40%; background:var(--hp); top:0; opacity:0; pointer-events:none; z-index:3; box-shadow:0 0 3px rgba(0,0,0,0.4); }',
    '@keyframes tlb-drip-fall { 0% { transform: translate(0,0) scale(1,0.9); } 100% { transform: translate(var(--drift,16px), var(--fall,96px)) scale(0.18,0.32); } }',
    '@keyframes tlb-drip-fade { 0% {opacity:0;} 12% {opacity:1;} 66% {opacity:1;} 100% {opacity:0;} }',
    // Sheen sweep — a soft light glint that rises up the liquid column (opt-in
    // "energy charge" flair). Clipped to the fill via tlb-clip on the vial.
    '.tlb-vial.tlb-clip .tlb-liquid { overflow:hidden; }',
    '.tlb-sheen { position:absolute; left:-10%; right:-10%; bottom:0; height:55%; background:linear-gradient(0deg, transparent, rgba(255,255,255,0.17) 45%, rgba(255,255,255,0.17) 55%, transparent); mix-blend-mode:screen; pointer-events:none; will-change:transform,opacity; animation: tlb-sheen 3.6s ease-in-out infinite; }',
    '@keyframes tlb-sheen { 0% { transform:translateY(40%); opacity:0; } 22% { opacity:1; } 72% { opacity:1; } 100% { transform:translateY(-185%); opacity:0; } }',
    '.tlb-splash { position:absolute; left:0; right:0; top:-3px; height:5px; background:linear-gradient(90deg, transparent, color-mix(in srgb, var(--hp), #ff9a8a 55%), transparent); opacity:0; pointer-events:none; }',
    '.tlb-splash.tlb-go { animation: tlb-splash 420ms ease-out; }',
    '@keyframes tlb-splash { 0% {opacity:0;} 25% {opacity:0.9;} 100% {opacity:0;} }',
    // Low-level "danger" cue: an animated diagonal barber-pole runs around the
    // frame (a ring masked to just the 3px border) instead of recolouring it.
    // Stripe colour follows the bar's own rim, so health reads red, stamina blue.
    '.tlb-vial { position: relative; }',
    '.tlb-vial.tlb-danger::after { content:""; position:absolute; inset:0; border-radius:13px; padding:3px; pointer-events:none; z-index:4; opacity:var(--warn,1);',
    '  background-color: var(--ink-night);',
    '  background-image: linear-gradient(45deg, rgb(var(--rim)) 25%, transparent 25%, transparent 50%, rgb(var(--rim)) 50%, rgb(var(--rim)) 75%, transparent 75%, transparent);',
    '  background-size: 18px 18px;',
    '  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor;',
    '          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);         mask-composite: exclude;',
    '  animation: tlb-stripe 0.8s linear infinite; }',
    '@keyframes tlb-stripe { from { background-position: 18px 0; } to { background-position: 0 0; } }',
    '@media (prefers-reduced-motion: reduce) { .tlb-surface, .tlb-sheen, .tlb-vial.tlb-danger::after { animation:none; } .tlb-liquid { transition: background 200ms linear; } }',
  ].join('\n');

  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected || document.getElementById('tlb-styles')) { stylesInjected = true; return; }
    const s = document.createElement('style');
    s.id = 'tlb-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
    stylesInjected = true;
  }

  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const WAVE_MASK = 'url("data:image/svg+xml,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='16'>" +
    "<path fill='black' d='M0,9 Q15,2 30,9 T60,9 T90,9 T120,9 V16 H0 Z'/></svg>") + '")';

  NS.mount = function (root, opts) {
    injectStyles();
    opts = opts || {};
    const channel = opts.channel || 'Health';
    const waves = opts.waves !== false;
    const droplets = opts.droplets !== false;
    const sheen = !!opts.sheen;
    const PAL = opts.palette || {};
    const loC = PAL.lo || [110, 16, 20];
    const hiC = PAL.hi || [207, 34, 51];

    // --- DOM ---
    root.classList.add('tlb-vial');
    root.style.setProperty('--trail', PAL.trail || '#4f0a0f');
    root.style.setProperty('--rim', PAL.rim || '207,34,51');
    root.style.setProperty('--level', '72%');
    root.style.setProperty('--trail-level', '72%');
    while (root.firstChild) root.removeChild(root.firstChild);

    const glass = el('div', 'tlb-glass');
    const trail = el('div', 'tlb-trail');
    if (waves) trail.appendChild(el('div', 'tlb-surface tlb-twave'));
    const liquid = el('div', 'tlb-liquid');
    if (waves) { liquid.appendChild(el('div', 'tlb-surface tlb-back')); liquid.appendChild(el('div', 'tlb-surface tlb-front')); }
    const splash = el('div', 'tlb-splash');
    liquid.appendChild(splash);
    if (sheen) { liquid.appendChild(el('div', 'tlb-sheen')); root.classList.add('tlb-clip'); }
    const label = el('div', 'tlb-label'); label.textContent = opts.label || '';
    const readout = el('div', 'tlb-readout');
    const curText = document.createTextNode('— ');
    const maxSpan = el('span', 'tlb-max'); maxSpan.textContent = '/ —';
    readout.appendChild(curText); readout.appendChild(maxSpan);
    glass.appendChild(trail); glass.appendChild(liquid);
    glass.appendChild(el('div', 'tlb-ticks')); glass.appendChild(el('div', 'tlb-glare'));
    glass.appendChild(label); glass.appendChild(readout);
    root.appendChild(glass);

    if (waves) root.querySelectorAll('.tlb-surface').forEach((s) => { s.style.webkitMaskImage = WAVE_MASK; s.style.maskImage = WAVE_MASK; });

    // --- logic ---
    function colorFn(frac) {
      const k = clamp01(frac);
      return `rgb(${Math.round(lerp(loC[0], hiC[0], k))}, ${Math.round(lerp(loC[1], hiC[1], k))}, ${Math.round(lerp(loC[2], hiC[2], k))})`;
    }
    const levelPct = (f) => 4 + clamp01(f) * 96;          // 4% sliver at 0 .. 100% brim
    root.style.setProperty('--hp', colorFn(0.72));

    let prevFrac = null, liveFrac = 0.72, trailFrac = 0.72, decayStart = -1e9, dispFrac = 0.72, dispVel = 0;
    const TRAIL_DELAY = 0.4, TRAIL_DECAY = 0.7;
    const FG_SMOOTH_TIME = 0.12;   // foreground SmoothDamp time (s) — even, lurch-free descent

    function spawnDrip(surfaceY) {
      const w = glass.clientWidth;
      const d = el('div', 'tlb-drip');
      const side = Math.random() < 0.5 ? -1 : 1;
      d.style.left = (side < 0 ? (3 + Math.random() * 9) : (w - 3 - Math.random() * 9)).toFixed(0) + 'px';
      d.style.top = (surfaceY - 1 + Math.random() * 4).toFixed(0) + 'px';
      d.style.setProperty('--drift', (side * (9 + Math.random() * 14)).toFixed(0) + 'px');
      d.style.setProperty('--fall', (26 + Math.random() * 44).toFixed(0) + 'px');
      const dur = Math.round(720 + Math.random() * 260);
      d.style.animation = `tlb-drip-fall ${dur}ms cubic-bezier(0.45,0,0.85,0.6) forwards, tlb-drip-fade ${dur}ms linear forwards`;
      root.appendChild(d);
      setTimeout(() => d.remove(), dur + 220);
    }

    function render(cur, max) {
      const frac = clamp01(max > 0 ? cur / max : 0);
      // NOTE: --level is driven every frame by trailLoop() from dispFrac, not set
      // here — a per-frame target change must not restart a CSS transition (that
      // freezes the bar during a fast drain). render() only updates the target.
      root.style.setProperty('--hp', colorFn(frac));
      root.classList.toggle('tlb-full', frac >= 0.995);
      curText.nodeValue = Math.round(cur) + ' ';
      maxSpan.textContent = '/ ' + Math.round(max);
      if (prevFrac !== null && frac < prevFrac - 0.001) {
        decayStart = performance.now() / 1000;
        // Splash only on a FRESH hit (trail caught up). Re-flashing it every
        // frame of a continuous drain forces a per-frame sync reflow (the
        // offsetWidth read) and just strobes — both fed the jitter.
        if (trailFrac <= dispFrac + 1e-3) {
          splash.classList.remove('tlb-go'); void splash.offsetWidth; splash.classList.add('tlb-go');
        }
      }
      liveFrac = frac; prevFrac = frac;
      ensureLoop();   // wake the render loop to animate toward the new value
    }

    (function subscribe() {
      if (!global.tsic || typeof global.tsic.on !== 'function') { setTimeout(subscribe, 16); return; }
      global.tsic.on('tsic.msg.UI.Player.Attribute', (p) => {
        if (!p || p.Channel !== channel) return;
        render(Number(p.Current) || 0, Number(p.Max) || 1);
      });
    })();

    // Trail catch-up + (optional) continuous side-spill while the surface drops.
    // The loop idles itself once the bar is fully at rest and render() restarts
    // it on the next change — so a static bar costs zero per-frame layout.
    let lastT = 0, lastFg = null, dripAccum = 0, looping = false;
    const DRIP_EVERY_PX = 12;
    function ensureLoop() { if (!looping) { looping = true; lastT = 0; requestAnimationFrame(trailLoop); } }
    function trailLoop() {
      const t = performance.now() / 1000;
      const dt = lastT ? Math.min(0.05, t - lastT) : 0.016; lastT = t;

      // Foreground follows the live value with a critically-damped SmoothDamp
      // (Unity-style): it carries velocity, so attribute updates arriving batched/
      // irregularly (async bridge) can't cause an instant lurch — velocity ramps
      // gradually and the descent stays even. Analytic + unconditionally stable
      // across variable frame times. No overshoot (so no flicker at the surface).
      {
        const omega = 2 / FG_SMOOTH_TIME;
        const x = omega * dt;
        const expf = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
        const change = dispFrac - liveFrac;
        const temp = (dispVel + omega * change) * dt;
        dispVel = (dispVel - omega * temp) * expf;
        dispFrac = liveFrac + (change + temp) * expf;
        if (Math.abs(liveFrac - dispFrac) < 5e-4) { dispFrac = liveFrac; dispVel = 0; }
      }
      root.style.setProperty('--level', levelPct(dispFrac).toFixed(2) + '%');

      // Warning stripes fade in from the black border as the VISIBLE level drops:
      // 0 (invisible) at 30%, ramping to full intensity by ~10%. Synced to the
      // smoothed bar so the warning grows exactly as the liquid passes the mark.
      const warn = clamp01((0.30 - dispFrac) / 0.20);
      root.style.setProperty('--warn', warn.toFixed(3));
      root.classList.toggle('tlb-danger', warn > 0);

      if (t - decayStart >= TRAIL_DELAY && trailFrac > liveFrac) {
        trailFrac = Math.max(liveFrac, trailFrac - TRAIL_DECAY * dt);
      }
      const glassH = glass.clientHeight || 1;
      const fgFrac = dispFrac;
      if (trailFrac < fgFrac) trailFrac = fgFrac;          // never below the foreground
      root.style.setProperty('--trail-level', levelPct(trailFrac).toFixed(2) + '%');

      if (droplets) {
        const surfaceY = (1 - fgFrac) * glassH;
        if (lastFg !== null && fgFrac < lastFg - 1e-4) {
          dripAccum += (lastFg - fgFrac) * glassH;
          let made = 0;
          while (dripAccum >= DRIP_EVERY_PX && made < 4) { spawnDrip(surfaceY); dripAccum -= DRIP_EVERY_PX; made++; }
        } else { dripAccum = 0; }
        lastFg = fgFrac;
      }
      // Idle once at rest (foreground settled + trail caught up). render()
      // restarts the loop via ensureLoop() on the next change.
      if (dispVel === 0 && Math.abs(liveFrac - dispFrac) < 5e-4 && (trailFrac - liveFrac) < 1e-3) { looping = false; return; }
      requestAnimationFrame(trailLoop);
    }
    ensureLoop();
  };
})(window);
