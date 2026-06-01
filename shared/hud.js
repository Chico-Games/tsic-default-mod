// shared/hud.js — HUD orchestrator (pure).
//
// Builds DOM shells for all HUD elements and dynamically loads component
// scripts. Contains ZERO component logic — each component lives in its
// own file:
//
//   hud-toast.js        — toast notifications (loaded on ALL screens)
//   hud-health.js       — health bar with damage trail
//   hud-stamina.js      — stamina bar with decrease trail
//   hud-crosshair.js    — crosshair visibility
//   hud-interaction.js  — interaction prompt label
//   hud-behavior-bar.js — gameplay behavior bar (System A)
//   hud-construction-carousel.js — construction build strip (bottom-centre)
//   hud-minimap.js      — minimap (fixed-zoom, player-tracking)
//
// The HUD toggle (body.hud-hidden) stays here — it's orchestrator-level
// since it hides ALL chrome elements at once.

(function () {
  function el(tag, attrs) {
    if (window.TSIC && window.TSIC.el) return TSIC.el.apply(null, arguments);
    // Minimal fallback for screens that don't load dom.js
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c != null) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  // ---- Inline styles for HUD chrome ----

  var STYLE = [
    '.hud-bar { position:fixed; left:24px; width:240px; border:1px solid rgba(184,170,145,0.45); background:rgba(241,229,207,0.88); border-radius:3px; overflow:hidden; font-family:"Segoe UI",system-ui,sans-serif; pointer-events:none; z-index:20; }',
    '#hud-health { bottom:60px; height:18px; }',
    '#hud-stamina { bottom:36px; height:14px; }',
    '.hud-bar .trail-fill, .hud-bar .live-fill { position:absolute; left:0; top:0; bottom:0; }',
    '#hud-health .trail-fill { background:#6b1010; width:100%; }',
    '#hud-health .live-fill { background:#ce2424; width:100%; transition:width 0.05s linear; }',
    '#hud-stamina .trail-fill { background:#133a73; width:100%; }',
    '#hud-stamina .live-fill { background:#1f8fff; width:100%; transition:width 0.05s linear; }',
    '.hud-bar .numbers { position:absolute; left:0; right:0; top:50%; transform:translateY(-50%); text-align:center; font-weight:700; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.75); }',
    '#hud-health .numbers { font-size:12px; }',
    '#hud-stamina .numbers { font-size:11px; }',
    '#hud-crosshair { position:fixed; left:50%; top:50%; margin-left:-2px; margin-top:-2px; width:4px; height:4px; background:#fff; border-radius:50%; pointer-events:none; z-index:20; }',
    '#hud-crosshair.hidden { display:none; }',
    'body.hud-hidden #hud-chrome, body.hud-hidden #hud-health, body.hud-hidden #hud-stamina, body.hud-hidden #hud-crosshair, body.hud-hidden #bb-shell-gameplay, body.hud-hidden #hud-minimap, body.hud-hidden #hud-chunk-debug { display:none !important; }',
    '#bb-shell-gameplay { position:fixed; bottom:18px; right:24px; min-width:240px; max-width:calc(100vw - 48px); padding:8px 12px; color:#fff; pointer-events:none; z-index:20; font-family:Georgia,"Libre Baskerville",serif; text-shadow:0 1px 2px rgba(0,0,0,0.75); }',
    '#bb-shell-gameplay.hidden { display:none; }',
    '#bb-gameplay { display:flex; flex-direction:column; align-items:stretch; gap:0; }',
    '.bb-row { display:flex; justify-content:flex-end; align-items:center; gap:6px; font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#fff; }',
    '.bb-row[data-status="cooldown"] { color:#f5d34a; }',
    '.bb-row[data-status="blocked"] { color:#e8a0a0; }',
    '.bb-row[data-status="single-use-used"] { color:#cfc8bb; text-decoration:line-through; }',
    '.bb-key { position:relative; display:inline-flex; align-items:center; justify-content:center; min-width:29px; height:29px; padding:0; background:transparent; border:0; color:inherit; font-size:11px; font-weight:700; overflow:hidden; }',
    '.bb-key img { max-width:27px; max-height:27px; object-fit:contain; }',
    '.bb-key-fallback { padding:0 2px; }',
    '.bb-cd-sweep { position:absolute; inset:0; pointer-events:none; background:conic-gradient(rgba(0,0,0,0.55) calc(var(--tsic-cd-percent,0) * 1%), transparent 0); }',
    '.bb-text { display:inline-flex; align-items:baseline; gap:6px; text-align:left; }',
    '.bb-name { font-weight:700; }',
    '.bb-sub { font-size:9px; font-weight:400; letter-spacing:0.04em; text-transform:none; }',
    '#bb-divider { height:1px; background:#fff; margin:6px 0; }',
    '#bb-divider.hidden { display:none; }',
    '#interaction-prompt { text-align:right; font-size:13px; font-weight:700; color:#fff; letter-spacing:0.06em; text-transform:uppercase; }',
    '#interaction-prompt.hidden { display:none; }',
    '#hud-minimap { position:fixed; top:24px; right:24px; width:180px; height:180px; border-radius:50%; overflow:hidden; border:2px solid rgba(184,170,145,0.7); box-shadow:0 2px 8px rgba(0,0,0,0.35); background:#d4c19d; pointer-events:none; z-index:20; }',
    '#minimap-tex, #minimap-fow { position:absolute; left:0; top:0; transform-origin:0 0; image-rendering:pixelated; image-rendering:-webkit-optimize-contrast; image-rendering:crisp-edges; pointer-events:none; }',
    '#minimap-canvas { position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none; }',
    '#hud-chunk-debug { display:none; position:fixed; top:214px; right:24px; width:140px; height:140px; overflow:hidden; border:1px solid rgba(184,170,145,0.55); box-shadow:0 2px 6px rgba(0,0,0,0.3); background:#1a1a1a; pointer-events:none; z-index:20; }',
    '#chunk-debug-tex { position:absolute; left:0; top:0; width:100%; height:100%; image-rendering:pixelated; image-rendering:-webkit-optimize-contrast; image-rendering:crisp-edges; pointer-events:none; }',
  ].join('\n');

  // ---- Screen detection ----

  function isInGameScreen() {
    var meta = document.querySelector('meta[name="tsic-screen"]');
    return !!meta && meta.getAttribute('content') === 'InGame';
  }

  // ---- DOM construction ----

  function ensureToastContainer() {
    if (document.getElementById('toast-container')) return;
    document.body.appendChild(el('div', { id: 'toast-container' }));
  }

  function buildChrome() {
    if (document.getElementById('hud-chrome')) return;

    var style = document.createElement('style');
    style.id = 'hud-inline-styles';
    style.textContent = STYLE;
    document.head.appendChild(style);

    var chrome = el('div', { id: 'hud-chrome' });
    document.body.appendChild(chrome);

    document.body.appendChild(el('div', { id: 'hud-health', class: 'hud-bar' },
      el('div', { class: 'trail-fill' }), el('div', { class: 'live-fill' }), el('div', { class: 'numbers' }, '— / —')));

    document.body.appendChild(el('div', { id: 'hud-stamina', class: 'hud-bar' },
      el('div', { class: 'trail-fill' }), el('div', { class: 'live-fill' }), el('div', { class: 'numbers' }, '— / —')));

    document.body.appendChild(el('div', { id: 'hud-crosshair' }));

    var minimap = el('div', { id: 'hud-minimap' });
    minimap.appendChild(el('img', { id: 'minimap-tex', src: '/runtime/world-map.imgsrc' }));
    minimap.appendChild(el('img', { id: 'minimap-fow', src: '/runtime/fow.imgsrc' }));
    var minimapCvs = document.createElement('canvas');
    minimapCvs.id = 'minimap-canvas';
    minimapCvs.width = 180;
    minimapCvs.height = 180;
    minimap.appendChild(minimapCvs);
    document.body.appendChild(minimap);

    var chunkDebug = el('div', { id: 'hud-chunk-debug' });
    chunkDebug.appendChild(el('img', { id: 'chunk-debug-tex' }));
    document.body.appendChild(chunkDebug);

    var bbShell = el('div', { id: 'bb-shell-gameplay', class: 'bb-shell hidden' });
    bbShell.appendChild(el('div', { id: 'bb-gameplay' }));
    bbShell.appendChild(el('div', { id: 'bb-divider', class: 'hidden' }));
    bbShell.appendChild(el('div', { id: 'interaction-prompt', class: 'hidden' }));
    document.body.appendChild(bbShell);
  }

  // ---- Dynamic script loading ----

  function loadScript(src) {
    var s = document.createElement('script');
    s.src = src;
    document.head.appendChild(s);
  }

  // ---- Boot ----

  function whenReady(cb) {
    if (window.tsic && document.body) { cb(); return; }
    setTimeout(function () { whenReady(cb); }, 16);
  }

  whenReady(function () {
    // Toast container works on every screen.
    ensureToastContainer();
    loadScript('/shared/hud-toast.js');

    // The rest of the HUD chrome is InGame only.
    if (!isInGameScreen()) return;

    buildChrome();

    // HUD toggle (BH_HUDToggle, default H) — orchestrator-level since it
    // hides ALL chrome at once via body.hud-hidden.
    tsic.on('tsic.msg.UI.Behavior.HUDToggle', function (e) {
      if (!e || e.Phase !== 'Started') return;
      document.body.classList.toggle('hud-hidden');
    });

    // SetFogOfWarVisible cheat — toggles the minimap FOW overlay locally.
    // Server grid state is untouched (HideFOW/ResetFOW handle that).
    tsic.on('tsic.msg.Cheats.Map.Fow.Visibility', function (p) {
      var img = document.getElementById('minimap-fow');
      if (!img) return;
      img.style.display = (p && p.bVisible === false) ? 'none' : '';
    });

    // Load component scripts. Each self-initialises by subscribing to
    // tsic channels and operating on the DOM shells created above.
    loadScript('/shared/hud-health.js');
    loadScript('/shared/hud-stamina.js');
    loadScript('/shared/hud-crosshair.js');
    loadScript('/shared/hud-interaction.js');
    loadScript('/shared/hud-behavior-bar.js');
    loadScript('/shared/hud-construction-carousel.js');
    loadScript('/shared/hud-minimap.js');
    loadScript('/shared/hud-chunk-debug.js');
  });
})();
