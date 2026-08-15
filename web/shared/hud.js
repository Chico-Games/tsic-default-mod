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
//   hud-stomach.js      — digesting-consumable slots (right of the vials)
//   hud-conditions.js   — status-effect / consumable-buff chips (right of the stomach)
//   hud-crosshair.js    — crosshair visibility
//   hud-circular-progress.js — throw-charge / timed-ability progress ring
//   hud-interaction.js  — interaction prompt label
//   hud-behavior-bar.js — gameplay behavior bar (System A)
//   hud-construction-carousel.js — construction build strip (bottom-centre)
//   hud-minimap.js      — minimap (fixed-zoom, player-tracking)
//   hud-chunk-debug.js  — chunk debug overlay (dev)
//   hud-hotbar.js       — bottom-centre hotbar shelf
//   hud-hotbar-wheel.js — hold-to-open radial hotbar selector (gamepad + Q)
//   hud-screen-fade.js  — full-screen black fade (death sequence)
//   hud-chat.js         — multiplayer text chat (bottom-left, above the vials)
//   hud-tutorial.js     — tutorial objectives box (top-right, below the minimap)
//   hud-detection.js    — directional "you have been spotted" wedges + edge mist
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
    // Conditions — status-effect / consumable-buff chips, immediately right of the
    // stomach column and bottom-aligned with it. Left = stomach left (140) + its 42px
    // slot + the 4px block-shadow overhang + a 4px gap = 190. Chip styling and the
    // bottom-up stacking live in hud-conditions.js.
    '#hud-conditions { position:fixed; left:190px; bottom:30px; pointer-events:none; z-index:20; }',
    // Crosshair dot — always fully opaque; affordances animate a halo around it.
    '#hud-crosshair { position:fixed; left:50%; top:50%; margin-left:-2px; margin-top:-2px; width:4px; height:4px; background:#fff; border-radius:50%; pointer-events:none; z-index:20; transition:box-shadow 120ms ease, transform 120ms ease; }',
    // Per-category halo breathing — same keyframes, subtly different cadence and
    // reach per category (hud-crosshair.js stamps data-cat from Targets[0].Category).
    '@keyframes hud-ch-halo { 0%,100% { box-shadow:0 0 0 2px rgba(255,255,255,0); } 50% { box-shadow:0 0 0 var(--ch-halo,4px) rgba(255,255,255,var(--ch-halo-a,0.28)); } }',
    '#hud-crosshair[data-cat] { animation:hud-ch-halo var(--ch-t,2.2s) ease-in-out infinite; }',
    '#hud-crosshair[data-cat="crafting"] { --ch-t:1.6s; --ch-halo:5px; }',
    '#hud-crosshair[data-cat="production"] { --ch-t:1.1s; --ch-halo:4px; --ch-halo-a:0.35; }',
    '#hud-crosshair[data-cat="plantable"] { --ch-t:2.8s; --ch-halo:6px; --ch-halo-a:0.22; }',
    '#hud-crosshair[data-cat="storage"] { --ch-t:2s; --ch-halo:5px; }',
    '#hud-crosshair[data-cat="door"] { --ch-t:2.4s; --ch-halo:3px; }',
    '#hud-crosshair[data-cat="toggle"] { --ch-t:1.4s; --ch-halo:3px; --ch-halo-a:0.35; }',
    '#hud-crosshair[data-cat="loot"] { --ch-t:1.8s; --ch-halo:6px; }',
    '#hud-crosshair[data-cat="shop"] { --ch-t:1.8s; --ch-halo:5px; }',
    '#hud-crosshair[data-cat="item"] { --ch-t:2s; --ch-halo:4px; }',
    '#hud-crosshair[data-cat="cart"] { --ch-t:1.6s; --ch-halo:5px; }',
    '#hud-crosshair[data-cat="elevator"] { --ch-t:2.2s; --ch-halo:4px; }',
    '#hud-crosshair[data-cat="teleporter"] { --ch-t:1.2s; --ch-halo:6px; --ch-halo-a:0.32; }',
    '#hud-crosshair[data-cat="cage"] { --ch-t:2.6s; --ch-halo:4px; }',
    '#hud-crosshair[data-cat="summon"] { --ch-t:1s; --ch-halo:7px; --ch-halo-a:0.35; }',
    '#hud-crosshair[data-cat="repair"] { --ch-t:1.9s; --ch-halo:4px; }',
    '#hud-crosshair[data-cat="text"] { --ch-t:3s; --ch-halo:3px; --ch-halo-a:0.22; }',
    // ONE palette for every category-tinted element (panel header, interaction
    // rows, crosshair glyph). Classes set the variable; each consumer's base rule
    // reads color:var(--cat-color,#fff) — so the tint follows the class without
    // per-ID duplicate rules, and status rules that set color directly still win.
    '.cat-crafting { --cat-color:#f0cd8a; }',
    '.cat-production { --cat-color:#9fd4f0; }',
    '.cat-plantable { --cat-color:#a9e2a0; }',
    '.cat-storage { --cat-color:#d9c9f2; }',
    '.cat-door { --cat-color:#c9d9ea; }',
    '.cat-toggle { --cat-color:#f2e394; }',
    '.cat-loot { --cat-color:#f2d3a4; }',
    '.cat-shop { --cat-color:#a3e2d2; }',
    '.cat-item { --cat-color:#e8e2d5; }',
    '.cat-cart { --cat-color:#98d4c8; }',
    '.cat-elevator { --cat-color:#d5e0a8; }',
    '.cat-teleporter { --cat-color:#c5a8f0; }',
    '.cat-cage { --cat-color:#f0a8b8; }',
    '.cat-summon { --cat-color:#e89090; }',
    '.cat-repair { --cat-color:#f0b878; }',
    '.cat-text { --cat-color:#e8d8b0; }',
    '.cat-interact { --cat-color:#e8e2d5; }',
    // Dragging ring — solid, suppresses the category halo while active.
    '#hud-crosshair.dragging { transform:scale(1.4); box-shadow:0 0 0 3px rgba(255,255,255,0.65); animation:none; }',
    '#hud-crosshair.hidden { display:none; }',
    // Drag hand — slightly transparent icon beside the (opaque) dot while the
    // look target is draggable; tightens while dragging. SVG built by hud-crosshair.js.
    '#hud-crosshair-hand { position:fixed; left:calc(50% + 32px); top:50%; margin-top:-9px; width:18px; height:18px; color:#fff; opacity:0; pointer-events:none; z-index:20; transition:opacity 120ms ease, transform 120ms ease; filter:drop-shadow(0 1px 1px rgba(0,0,0,0.6)); }',
    '#hud-crosshair-hand.visible { opacity:0.55; }',
    '#hud-crosshair-hand.dragging { opacity:0.8; transform:scale(0.9); }',
    '#hud-crosshair-hand.hidden { display:none; }',
    '#hud-crosshair-hand svg { width:100%; height:100%; display:block; }',
    // Category affordance sits nearest the dot; the hand (above) sits just beyond it.
    '#hud-crosshair-cat { position:fixed; left:calc(50% + 10px); top:50%; margin-top:-8px; width:16px; height:16px; color:var(--cat-color,#fff); opacity:0; pointer-events:none; z-index:20; transition:opacity 120ms ease; filter:drop-shadow(0 1px 1px rgba(0,0,0,0.6)); }',
    '#hud-crosshair-cat.visible { opacity:0.7; }',
    '#hud-crosshair-cat.hidden { display:none; }',
    '#hud-crosshair-cat svg { width:100%; height:100%; display:block; }',
    // Circular progress ring — throw charge / timed-ability progress. Rendered
    // in TWO places from the one UI.CircularProgress.State broadcast: the
    // bottom-right behavior-bar panel (below the interaction prompt) and a
    // subtle collar on the crosshair, where the player is actually looking
    // during a hold. Fill percent + colour from hud-circular-progress.js.
    //
    // The panel ring CIRCLES the key chip of the action that is running — the
    // thing filling is the key you are holding. hud-circular-progress.js mounts
    // it into that chip (.bb-key.cp-host) and parks it in the panel's corner when
    // no chip is available (throw charge with no matching row).
    //
    // It is absolutely positioned and opacity-gated, never display-gated, so it
    // contributes NOTHING to layout. It used to be a display:none -> block block
    // element at the end of the bottom-anchored panel, which grew and shrank the
    // panel by 32px and shoved every row up and back down on each hold.
    '#hud-circular-progress { position:absolute; left:50%; top:50%; width:37px; height:37px; margin:-18.5px 0 0 -18.5px; border-radius:50%; background:conic-gradient(var(--cp-color,#fff) calc(var(--cp-p,0) * 1%), rgba(241,229,207,0.30) 0); mask:radial-gradient(circle, transparent 16px, #000 17px); -webkit-mask:radial-gradient(circle, transparent 16px, #000 17px); pointer-events:none; opacity:0; transform:scale(0.8); transition:opacity 140ms ease, transform 180ms cubic-bezier(0.2,0.9,0.3,1.2); }',
    '#hud-circular-progress.active { opacity:1; transform:scale(1); }',
    // Chips clip their key thumbnail, so the hosting one has to stop clipping or
    // it would shear the ring off at the chip's edges.
    '.bb-key.cp-host { overflow:visible; }',
    // Parked: no key chip to circle, so it sits in the panel's bottom-right
    // corner at its old size — still out of flow, still no reflow.
    '#hud-circular-progress.parked { left:auto; top:auto; right:9px; bottom:-15px; margin:0; width:26px; height:26px; mask:radial-gradient(circle, transparent 9px, #000 10px); -webkit-mask:radial-gradient(circle, transparent 9px, #000 10px); }',
    // Crosshair collar — the same fill, 22px across with a ~2px stroke at 55%
    // opacity, sitting inside the category glyph (which starts at +10px) so the
    // two never collide. The 4px dot never moves; the category halo breathing is
    // suppressed while this is up (below) so only one thing animates at a time.
    '#hud-crosshair-progress { position:fixed; left:50%; top:50%; width:22px; height:22px; margin:-11px 0 0 -11px; border-radius:50%; background:conic-gradient(var(--cp-color,#fff) calc(var(--cp-p,0) * 1%), rgba(241,229,207,0.20) 0); mask:radial-gradient(circle, transparent 9px, #000 9.8px); -webkit-mask:radial-gradient(circle, transparent 9px, #000 9.8px); opacity:0; transform:scale(0.86); pointer-events:none; z-index:20; transition:opacity 160ms ease, transform 200ms cubic-bezier(0.2,0.9,0.3,1.2); }',
    '#hud-crosshair-progress.active { opacity:0.55; transform:scale(1); }',
    '#hud-crosshair-progress.hidden { display:none; }',
    // A ring filling IS the halo's message, and two overlapping animations on a
    // 4px dot read as a glitch — so the category breathing yields to it.
    'body.hud-charging #hud-crosshair[data-cat] { animation:none; box-shadow:0 0 0 0 rgba(255,255,255,0); }',
    // One-shot bloom on the 0->100% edge. The publisher HOLDS at 100% (a maxed
    // throw charge keeps a full ring until Stop), so this is fired by JS on the
    // edge rather than keyed off a "full" class, which would re-trigger forever.
    '@keyframes hud-cp-bloom { 0% { opacity:0.5; transform:scale(0.9); } 100% { opacity:0; transform:scale(1.9); } }',
    '#hud-crosshair-bloom { position:fixed; left:50%; top:50%; width:22px; height:22px; margin:-11px 0 0 -11px; border-radius:50%; border:1px solid var(--cp-color,#fff); opacity:0; pointer-events:none; z-index:20; }',
    '#hud-crosshair-bloom.fire { animation:hud-cp-bloom 420ms ease-out 1; }',
    '#hud-crosshair-bloom.hidden { display:none; }',
    // Reduce motion: keep the fill (it is information), drop the scale-in and
    // the completion bloom (they are decoration).
    'html[data-tsic-reduce-motion] #hud-circular-progress, html[data-tsic-reduce-motion] #hud-crosshair-progress { transition:opacity 140ms ease; transform:none; }',
    'html[data-tsic-reduce-motion] #hud-circular-progress.active, html[data-tsic-reduce-motion] #hud-crosshair-progress.active { transform:none; }',
    'html[data-tsic-reduce-motion] #hud-crosshair-bloom.fire { animation:none; }',
    'body.hud-hidden #hud-chrome, body.hud-hidden #hud-health, body.hud-hidden #hud-stamina, body.hud-hidden #hud-stomach, body.hud-hidden #hud-conditions, body.hud-hidden #hud-crosshair, body.hud-hidden #hud-crosshair-hand, body.hud-hidden #hud-crosshair-cat, body.hud-hidden #hud-crosshair-progress, body.hud-hidden #hud-crosshair-bloom, body.hud-hidden #hud-circular-progress, body.hud-hidden #bb-shell-gameplay, body.hud-hidden #hud-minimap, body.hud-hidden #hud-chunk-debug, body.hud-hidden #hud-hotbar, body.hud-hidden #ping-shell, body.hud-hidden #hud-low-health, body.hud-hidden #hud-hit-reaction, body.hud-hidden #hud-stealth, body.hud-hidden #hud-detection, body.hud-hidden #hud-sprint-vignette,body.hud-hidden #hud-chat, body.hud-hidden #hud-voice, body.hud-hidden #hud-tutorial { display:none !important; }',
    'body.hud-hide-health #hud-health, body.hud-hide-stamina #hud-stamina, body.hud-hide-stomach #hud-stomach, body.hud-hide-conditions #hud-conditions, body.hud-hide-crosshair #hud-crosshair, body.hud-hide-crosshair #hud-crosshair-hand, body.hud-hide-crosshair #hud-crosshair-cat, body.hud-hide-crosshair #hud-crosshair-progress, body.hud-hide-crosshair #hud-crosshair-bloom, body.hud-hide-minimap #hud-minimap, body.hud-hide-actionbar #bb-shell-gameplay, body.hud-hide-interaction #interaction-prompt, body.hud-hide-hotbar #hud-hotbar, body.hud-hide-lowhealth #hud-low-health, body.hud-hide-hitreaction #hud-hit-reaction, body.hud-hide-stealth #hud-stealth, body.hud-hide-detection #hud-detection, body.hud-hide-tutorial #hud-tutorial { display:none !important; }',
    '#bb-shell-gameplay { position:fixed; bottom:18px; right:24px; min-width:240px; max-width:calc(100vw - 48px); padding:8px 12px; color:#fff; pointer-events:none; z-index:20; font-family:var(--font-body); text-shadow:0 1px 2px rgba(0,0,0,0.75); }',
    '#bb-shell-gameplay.hidden { display:none; }',
    '#bb-gameplay { display:flex; flex-direction:column; align-items:stretch; gap:0; }',
    // Look-target block (name header + interaction verbs) pinned above the divider.
    '#bb-target { display:flex; flex-direction:column; align-items:stretch; }',
    '#bb-target.hidden { display:none; }',
    // Furniture name header — the panel title when looking at interactable furniture.
    // Tint rides the shared .cat-* palette via --cat-color.
    '#bb-target-name { text-align:right; font-size:15px; font-weight:700; color:var(--cat-color,#fff); letter-spacing:0.04em; margin-bottom:2px; }',
    '#bb-target-name.hidden { display:none; }',
    '#bb-target-name .cat-icon { display:inline-block; width:14px; height:14px; margin-right:6px; vertical-align:-2px; }',
    '#bb-target-name .cat-icon svg { width:100%; height:100%; display:block; }',
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
    // Furniture-scoped interaction rows — rendered like input-action rows (verb
    // left, key chip right) so the furniture's own actions read as the TOP of the
    // input-action list. Tint rides the shared .cat-* palette via --cat-color.
    '#interaction-prompt { display:flex; justify-content:flex-end; align-items:center; gap:6px; font-size:13px; font-weight:700; color:var(--cat-color,#fff); letter-spacing:0.06em; text-transform:uppercase; }',
    '#interaction-prompt.hidden { display:none; }',
    // Category symbol on the interaction rows (hud-interaction.js stamps
    // .cat-<category> and builds the inline SVG, which inherits currentColor).
    '#interaction-prompt .cat-icon, #interaction-hold-prompt .cat-icon { display:inline-flex; width:13px; height:13px; }',
    '#interaction-prompt .cat-icon svg, #interaction-hold-prompt .cat-icon svg { width:100%; height:100%; display:block; }',
    // Non-available option (single-use already used / blocked / cooldown): dim + strike, overrides the category tint.
    '#interaction-prompt.interaction-disabled { color:rgba(190,190,190,0.4) !important; text-decoration:line-through; }',
    '#interaction-prompt.interaction-disabled .cat-icon { opacity:0.4; }',
    '#interaction-hold-prompt { display:flex; justify-content:flex-end; align-items:center; gap:6px; font-size:11px; font-weight:700; color:var(--cat-color,#fff); letter-spacing:0.06em; text-transform:uppercase; opacity:0.85; }',
    '#interaction-hold-prompt.hidden { display:none; }',
    // "HOLD" qualifier chip on the hold-interact row.
    '.bb-hold-tag { font-size:8px; font-weight:700; letter-spacing:0.1em; border:1px solid currentColor; border-radius:3px; padding:0 3px; opacity:0.8; }',
    // Refused hold option (trolley seat taken, trolley tipped): dim + strike, with the reason trailing.
    '#interaction-hold-prompt.interaction-disabled { color:rgba(190,190,190,0.4) !important; text-decoration:line-through; }',
    '#interaction-hold-prompt.interaction-disabled .cat-icon { opacity:0.4; }',
    '.bb-hold-reason { font-size:9px; font-weight:600; text-decoration:none; opacity:0.9; }',
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
    document.body.appendChild(el('div', { id: 'hud-conditions' }));

    document.body.appendChild(el('div', { id: 'hud-crosshair' }));
    document.body.appendChild(el('div', { id: 'hud-crosshair-hand' }));
    // Second crosshair affordance: the look target's category glyph (loot/storage/
    // door/…), tinted per category. Driven by hud-crosshair.js.
    document.body.appendChild(el('div', { id: 'hud-crosshair-cat' }));
    // Third crosshair affordance: the interaction/charge progress collar plus its
    // one-shot completion bloom, both driven by hud-circular-progress.js from the
    // same broadcast that fills the panel ring.
    document.body.appendChild(el('div', { id: 'hud-crosshair-progress' }));
    document.body.appendChild(el('div', { id: 'hud-crosshair-bloom' }));

    var minimap = el('div', { id: 'hud-minimap' });
    // No src here, deliberately: hud-minimap.js fetches world-map on the first
    // UI.Map.Snapshot instead (its retryFailedImg path already treats a src-less
    // img as "not loaded"). The basemap snapshot the scheme handler encodes is
    // final for the life of that <img>; walls composited AFTER it arrive only as
    // UI.Map.WallPatch messages, which are transient. hud.js runs before
    // shared/wall-patches.js and both wait on window.tsic with a 16ms poll, so
    // fetching here raced the patch subscription — a chunk that finished in that
    // window was in neither the snapshot nor the overlay, and its walls never
    // appeared. Deferring the fetch to the snapshot tick puts it unambiguously
    // after every deferred script has subscribed.
    minimap.appendChild(el('img', { id: 'minimap-tex' }));
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
    // Look-target block sits at the TOP: furniture name header, then the
    // interaction verb(s). hud-interaction.js drives it from UI.Interaction.Targets.
    var bbTarget = el('div', { id: 'bb-target', class: 'hidden' });
    bbTarget.appendChild(el('div', { id: 'bb-target-name', class: 'hidden' }));
    bbTarget.appendChild(el('div', { id: 'interaction-prompt', class: 'hidden' }));
    bbShell.appendChild(bbTarget);
    bbShell.appendChild(el('div', { id: 'bb-divider', class: 'hidden' }));
    // General input-action rows (hud-behavior-bar.js) render below the target block.
    bbShell.appendChild(el('div', { id: 'bb-gameplay' }));
    // Progress ring (interact holds + throw charge). Born parked in the panel's
    // corner; hud-circular-progress.js re-parents it onto the running action's
    // key chip whenever there is one. Absolute either way, so it never reflows
    // the panel.
    bbShell.appendChild(el('div', { id: 'hud-circular-progress', class: 'parked' }));
    document.body.appendChild(bbShell);

    // Hotbar shell — hud-hotbar.js builds the slots inside #hotbar-row.
    var hotbar = el('div', { id: 'hud-hotbar' });
    hotbar.appendChild(el('div', { id: 'hotbar-row' }));
    document.body.appendChild(hotbar);

    // Radial hotbar selector — hud-hotbar-wheel.js fills it while held open.
    document.body.appendChild(el('div', { id: 'hud-hotbar-wheel' }));

    // Full-screen overlays — components build their own contents inside.
    // Sprint comfort vignette lowest (z16, opt-in), stealth shroud and the
    // detection wedges above it (z17), low-health surround above that (z18),
    // hit-reaction on top (z19). Stealth and detection share a band because
    // they are mutually exclusive in practice: one says you are hidden, the
    // other says you have been seen.
    document.body.appendChild(el('div', { id: 'hud-sprint-vignette' }));
    document.body.appendChild(el('div', { id: 'hud-stealth' }));
    document.body.appendChild(el('div', { id: 'hud-detection' }));
    document.body.appendChild(el('div', { id: 'hud-low-health' }));
    document.body.appendChild(el('div', { id: 'hud-hit-reaction' }));

    // Ping composer overlay — hud-ping.js builds the wheel inside it.
    document.body.appendChild(el('div', { id: 'ping-shell' }));

    // Text chat shell — hud-chat.js builds the log + input row inside it.
    document.body.appendChild(el('div', { id: 'hud-chat' }));

    // Voice chat speaking indicator — hud-voice.js builds the chip + rows inside it.
    document.body.appendChild(el('div', { id: 'hud-voice' }));

    // Tutorial objectives box — hud-tutorial.js builds the list inside it.
    document.body.appendChild(el('div', { id: 'hud-tutorial' }));
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
    loadScript('/shared/hud-conditions.js');
    loadScript('/shared/hud-crosshair.js');
    loadScript('/shared/hud-circular-progress.js');
    loadScript('/shared/hud-interaction.js');
    loadScript('/shared/hud-upgrade.js');      // hammer look-at upgrade cost readout
    loadScript('/shared/hud-behavior-bar.js');
    loadScript('/shared/hud-construction-carousel.js');
    loadScript('/shared/hud-minimap.js');
    loadScript('/shared/hud-chunk-debug.js');
    loadScript('/shared/hud-hotbar.js');
    loadScript('/shared/hud-hotbar-wheel.js');
    loadScript('/shared/hud-low-health.js');
    loadScript('/shared/hud-stealth.js');
    loadScript('/shared/hud-detection.js');
    loadScript('/shared/hud-sprint-vignette.js');
    loadScript('/shared/hud-hit-reaction.js');
    loadScript('/shared/hud-ping.js');
    loadScript('/shared/hud-screen-fade.js');
    loadScript('/shared/hud-chat.js');
    loadScript('/shared/hud-voice.js');
    loadScript('/shared/hud-tutorial.js');
  });
})();
