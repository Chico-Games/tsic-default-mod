// shared/hud.js — HUD orchestrator (pure).
//
// Builds DOM shells for all HUD elements and dynamically loads component
// scripts. Contains ZERO component logic — each component lives in its
// own file:
//
//   hud-toast.js        — toast notifications (loaded on ALL screens)
//   hud-liquid-bar.js   — shared liquid vial component (health + stamina)
//   hud-health.js       — health vial (mounts hud-liquid-bar)
//   hud-stamina.js      — stamina vial (mounts hud-liquid-bar)
//   hud-crosshair.js    — crosshair visibility
//   hud-interaction.js  — interaction prompt label
//   hud-behavior-bar.js — gameplay behavior bar (System A)
//   hud-construction-carousel.js — construction build strip (bottom-centre)
//   hud-minimap.js      — minimap (fixed-zoom, player-tracking)
//   hud-chunk-debug.js  — chunk debug overlay (dev)
//   hud-hotbar.js       — bottom-centre hotbar shelf
//   hud-screen-fade.js  — full-screen black fade (death sequence)
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
    // Stomach — digesting-food slots, right of the stamina vial, bottom-aligned
    // with the bars. Left = stamina body end (128) + the 8px inter-bar gap + the
    // 4px the vial's block shadow overhangs to the right = 140. Slot styling: hud-stomach.js.
    '#hud-stomach { position:fixed; left:140px; bottom:30px; pointer-events:none; z-index:20; }',
    '#hud-crosshair { position:fixed; left:50%; top:50%; margin-left:-2px; margin-top:-2px; width:4px; height:4px; background:#fff; border-radius:50%; pointer-events:none; z-index:20; }',
    '#hud-crosshair.hidden { display:none; }',
    'body.hud-hidden #hud-chrome, body.hud-hidden #hud-health, body.hud-hidden #hud-stamina, body.hud-hidden #hud-stomach, body.hud-hidden #hud-crosshair, body.hud-hidden #bb-shell-gameplay, body.hud-hidden #hud-minimap, body.hud-hidden #hud-chunk-debug, body.hud-hidden #hud-hotbar, body.hud-hidden #ping-shell, body.hud-hidden #hud-low-health, body.hud-hidden #hud-hit-reaction { display:none !important; }',
    'body.hud-hide-health #hud-health, body.hud-hide-stamina #hud-stamina, body.hud-hide-stomach #hud-stomach, body.hud-hide-crosshair #hud-crosshair, body.hud-hide-minimap #hud-minimap, body.hud-hide-actionbar #bb-shell-gameplay, body.hud-hide-interaction #interaction-prompt, body.hud-hide-hotbar #hud-hotbar, body.hud-hide-lowhealth #hud-low-health, body.hud-hide-hitreaction #hud-hit-reaction { display:none !important; }',
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
    // Minimap — circular HUD badge. Frame matches the ping wheel: heavy ink ring
    // + soft drop shadow. The ink ring is an INSET shadow (not a real border) so
    // the content box stays a full 180px = the canvas buffer, keeping the player
    // marker dead-centre. will-change promotes the map/FOW to their own layer so
    // the per-frame pan transform composites on the GPU instead of repainting.
    '#hud-minimap { position:fixed; top:24px; right:24px; width:180px; height:180px; border-radius:50%; overflow:hidden; box-shadow: inset 0 0 0 3px var(--ink-night), 0 4px 16px rgba(0,0,0,0.5); background:#d4c19d; pointer-events:none; z-index:20; }',
    '#minimap-tex, #minimap-fow { position:absolute; left:0; top:0; transform-origin:0 0; will-change:transform; image-rendering:pixelated; image-rendering:-webkit-optimize-contrast; image-rendering:crisp-edges; pointer-events:none; }',
    '#minimap-canvas { position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none; }',
    '#hud-chunk-debug { display:none; position:fixed; top:214px; right:24px; width:140px; height:140px; overflow:hidden; border:1px solid rgba(184,170,145,0.55); box-shadow:0 2px 6px rgba(0,0,0,0.3); background:#1a1a1a; pointer-events:none; z-index:20; }',
    '#chunk-debug-tex { position:absolute; left:0; top:0; width:100%; height:100%; image-rendering:pixelated; image-rendering:-webkit-optimize-contrast; image-rendering:crisp-edges; pointer-events:none; }',
    // Hotbar — bottom-centre showroom shelf. Interactive (click/drag), so it
    // opts back into pointer events. Visual styling is owned by hud-hotbar.js.
    '#hud-hotbar { position:fixed; left:50%; bottom:24px; transform:translateX(-50%); pointer-events:auto; z-index:20; }',
    // Ping composer — full-screen radial overlay, hidden until shown. Styling
    // is owned by hud-ping.js; hud.js only owns its display gate + z-order.
    '#ping-shell { display:none; z-index:60; }',
    'body.hud-show-ping #ping-shell { display:flex; }',
  ].join('\n');

  // ---- Screen detection ----

  function isInGameScreen() {
    var meta = document.querySelector('meta[name="tsic-screen"]');
    return !!meta && meta.getAttribute('content') === 'InGame';
  }

  // ---- DOM construction ----

  // Toasts + notification cards share a top-left column (#corner-stack in
  // hud.css) so the two stacks never overlap when both fire.
  function ensureCornerStack() {
    if (document.getElementById('corner-stack')) return;
    var stack = el('div', { id: 'corner-stack' });
    stack.appendChild(el('div', { id: 'toast-container' }));
    stack.appendChild(el('div', { id: 'notif-stack' }));
    document.body.appendChild(stack);
  }

  function buildChrome() {
    if (document.getElementById('hud-chrome')) return;

    var style = document.createElement('style');
    style.id = 'hud-inline-styles';
    style.textContent = STYLE;
    document.head.appendChild(style);

    var chrome = el('div', { id: 'hud-chrome' });
    document.body.appendChild(chrome);

    // Empty containers — the liquid-bar component builds the vial inside each.
    document.body.appendChild(el('div', { id: 'hud-health' }));
    document.body.appendChild(el('div', { id: 'hud-stamina' }));
    document.body.appendChild(el('div', { id: 'hud-stomach' }));

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

    // Hotbar shell — hud-hotbar.js builds the slots inside #hotbar-row.
    var hotbar = el('div', { id: 'hud-hotbar' });
    hotbar.appendChild(el('div', { id: 'hotbar-row' }));
    document.body.appendChild(hotbar);

    // Full-screen blood overlays — components build their own contents inside.
    // Low-health surround sits under the bars (z18); hit-reaction above it (z19).
    document.body.appendChild(el('div', { id: 'hud-low-health' }));
    document.body.appendChild(el('div', { id: 'hud-hit-reaction' }));

    // Ping composer overlay — hud-ping.js builds the wheel inside it.
    document.body.appendChild(el('div', { id: 'ping-shell' }));
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
    // Toasts + notification cards work on every screen.
    ensureCornerStack();
    loadScript('/shared/hud-toast.js');
    loadScript('/shared/hud-notifications.js');

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

    // Per-element HUD visibility — hide/show a single chrome element without
    // touching the rest. Element ∈ health|stamina|crosshair|minimap|actionbar|
    // interaction. Used by settings toggles and the playground's element toggles.
    tsic.on('tsic.msg.UI.HUD.SetElementVisible', function (e) {
      if (!e || !e.Element) return;
      // Ping uses show-convention (hidden by default, revealed on demand);
      // everything else uses hide-convention (visible by default).
      if (e.Element === 'ping') {
        document.body.classList.toggle('hud-show-ping', e.Visible !== false);
        return;
      }
      document.body.classList.toggle('hud-hide-' + e.Element, e.Visible === false);
    });

    // Load component scripts. Each self-initialises by subscribing to
    // tsic channels and operating on the DOM shells created above.
    loadScript('/shared/hud-liquid-bar.js');   // shared vial component (health + stamina)
    loadScript('/shared/hud-health.js');
    loadScript('/shared/hud-stamina.js');
    loadScript('/shared/hud-stomach.js');
    loadScript('/shared/hud-crosshair.js');
    loadScript('/shared/hud-interaction.js');
    loadScript('/shared/hud-behavior-bar.js');
    loadScript('/shared/hud-construction-carousel.js');
    loadScript('/shared/hud-minimap.js');
    loadScript('/shared/hud-chunk-debug.js');
    loadScript('/shared/hud-hotbar.js');
    loadScript('/shared/hud-low-health.js');
    loadScript('/shared/hud-hit-reaction.js');
    loadScript('/shared/hud-ping.js');
    loadScript('/shared/hud-screen-fade.js');
  });
})();
