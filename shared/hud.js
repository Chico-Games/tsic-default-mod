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
//   hud-action-bar.js   — gameplay action bar (System A)
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
    // Health + stamina are liquid vials (shared/hud-liquid-bar.js), standing
    // side by side in the bottom-left. These rules just position/size them.
    '#hud-health { position:fixed; left:24px; bottom:30px; width:48px; --vial-h:200px; pointer-events:none; z-index:20; }',
    '#hud-stamina { position:fixed; left:80px; bottom:30px; width:48px; --vial-h:200px; pointer-events:none; z-index:20; }',
    '#hud-crosshair { position:fixed; left:50%; top:50%; margin-left:-2px; margin-top:-2px; width:4px; height:4px; background:#fff; box-shadow:0 0 0 1px rgba(0,0,0,0.85); border-radius:50%; pointer-events:none; z-index:20; }',
    '#hud-crosshair.hidden { display:none; }',
    'body.hud-hidden #hud-chrome, body.hud-hidden #hud-health, body.hud-hidden #hud-stamina, body.hud-hidden #hud-crosshair, body.hud-hidden #ab-shell-gameplay, body.hud-hidden #hud-minimap, body.hud-hidden #hud-hotbar { display:none !important; }',
    'body.hud-hide-health #hud-health, body.hud-hide-stamina #hud-stamina, body.hud-hide-crosshair #hud-crosshair, body.hud-hide-minimap #hud-minimap, body.hud-hide-actionbar #ab-shell-gameplay, body.hud-hide-interaction #interaction-prompt, body.hud-hide-hotbar #hud-hotbar { display:none !important; }',
    '#ab-shell-gameplay { position:fixed; bottom:18px; right:24px; max-width:calc(100vw - 48px); color:var(--cat-ink-dark); pointer-events:none; z-index:20; }',
    '#ab-shell-gameplay.hidden { display:none; }',
    '#ab-gameplay { display:flex; flex-direction:column; align-items:flex-end; gap:6px; text-shadow:0 0 3px rgba(247,237,217,0.85), 0 0 6px rgba(247,237,217,0.55), 0 1px 2px rgba(0,0,0,0.45); }',
    '.ab-row { display:inline-flex; align-items:center; gap:8px; font-family:Georgia,"Libre Baskerville",serif; font-size:12px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--cat-ink-dark); }',
    '.ab-row[data-status="blocked"] { color:var(--cat-red); }',
    '.ab-row[data-status="cooldown"] { color:rgba(37,33,25,0.55); }',
    '.ab-row[data-status="single-use-used"] { text-decoration:line-through; }',
    '.ab-key { position:relative; display:inline-flex; align-items:center; justify-content:center; min-width:26px; height:22px; padding:0 6px; background:transparent; border:1px solid currentColor; color:inherit; font-family:Georgia,"Libre Baskerville",serif; font-size:11px; font-weight:700; overflow:hidden; }',
    '.ab-key img { max-width:18px; max-height:18px; object-fit:contain; }',
    '.ab-key-fallback { padding:0 2px; }',
    '.ab-cd-sweep { position:absolute; inset:0; pointer-events:none; background:conic-gradient(rgba(35,31,24,0.5) calc(var(--tsic-cd-percent,0) * 1%), transparent 0); }',
    '.ab-text { display:inline-flex; align-items:baseline; gap:6px; }',
    '.ab-name { font-weight:700; }',
    '.ab-sub { font-size:10px; font-weight:400; letter-spacing:0.04em; text-transform:none; }',
    '#hud-minimap { position:fixed; top:24px; right:24px; width:180px; height:180px; border-radius:50%; overflow:hidden; border:2px solid rgba(184,170,145,0.7); box-shadow:0 2px 8px rgba(0,0,0,0.35); background:#d4c19d; pointer-events:none; z-index:20; }',
    '#minimap-tex { position:absolute; left:0; top:0; transform-origin:0 0; image-rendering:pixelated; image-rendering:-webkit-optimize-contrast; image-rendering:crisp-edges; pointer-events:none; }',
    '#minimap-canvas { position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none; }',
    // Hotbar — bottom-centre showroom shelf. Interactive (click/drag), so it
    // opts back into pointer events. Visual styling is owned by hud-hotbar.js.
    '#hud-hotbar { position:fixed; left:50%; bottom:24px; transform:translateX(-50%); pointer-events:auto; z-index:20; }',
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
    chrome.appendChild(el('div', { class: 'interaction-prompt', id: 'interaction-prompt', style: 'display:none;' }));
    document.body.appendChild(chrome);

    // Empty containers — the liquid-bar component builds the vial inside each.
    document.body.appendChild(el('div', { id: 'hud-health' }));
    document.body.appendChild(el('div', { id: 'hud-stamina' }));

    document.body.appendChild(el('div', { id: 'hud-crosshair' }));

    var minimap = el('div', { id: 'hud-minimap' });
    minimap.appendChild(el('img', { id: 'minimap-tex', src: '/runtime/world-map.imgsrc' }));
    var minimapCvs = document.createElement('canvas');
    minimapCvs.id = 'minimap-canvas';
    minimapCvs.width = 180;
    minimapCvs.height = 180;
    minimap.appendChild(minimapCvs);
    document.body.appendChild(minimap);

    var abShell = el('div', { id: 'ab-shell-gameplay', class: 'ab-shell hidden' });
    abShell.appendChild(el('div', { id: 'ab-gameplay' }));
    document.body.appendChild(abShell);

    // Hotbar shell — hud-hotbar.js builds the slots inside #hotbar-row.
    var hotbar = el('div', { id: 'hud-hotbar' });
    hotbar.appendChild(el('div', { id: 'hotbar-row' }));
    document.body.appendChild(hotbar);
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

    // HUD toggle (IA_HUDToggle, default H) — orchestrator-level since it
    // hides ALL chrome at once via body.hud-hidden.
    tsic.on('tsic.msg.UI.Input.IA_HUDToggle', function (e) {
      if (!e || e.Phase !== 'Started') return;
      document.body.classList.toggle('hud-hidden');
    });

    // Per-element HUD visibility — hide/show a single chrome element without
    // touching the rest. Element ∈ health|stamina|crosshair|minimap|actionbar|
    // interaction. Used by settings toggles and the playground's element toggles.
    tsic.on('tsic.msg.UI.HUD.SetElementVisible', function (e) {
      if (!e || !e.Element) return;
      document.body.classList.toggle('hud-hide-' + e.Element, e.Visible === false);
    });

    // Load component scripts. Each self-initialises by subscribing to
    // tsic channels and operating on the DOM shells created above.
    loadScript('/shared/hud-liquid-bar.js');   // shared vial component (health + stamina)
    loadScript('/shared/hud-health.js');
    loadScript('/shared/hud-stamina.js');
    loadScript('/shared/hud-crosshair.js');
    loadScript('/shared/hud-interaction.js');
    loadScript('/shared/hud-action-bar.js');
    loadScript('/shared/hud-minimap.js');
    loadScript('/shared/hud-hotbar.js');
  });
})();
