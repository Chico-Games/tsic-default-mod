// Map screen module. Was screens/map.html (~1100 lines).
//
// All DOM lookups go through the per-mount `root` element to keep selectors
// scoped to this overlay's container (multiple overlays share the document).
// Window-level listeners (resize, keydown, mousemove, mouseup) are gated on
// ctx.isVisible() so a hidden Map doesn't repaint or steal input.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const STYLE = `
    [data-screen="Map"] #map-root {
      position: absolute; inset: 0;
      background: #d4c19d;
      color: var(--cat-ink-soft);
      font-family: var(--font-terminal);
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    [data-screen="Map"] #map-title {
      letter-spacing: 4px; font-size: 14px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--tsic-border);
      background: rgba(35,31,24,0.35);
      flex: 0 0 auto;
    }
    [data-screen="Map"] #map-viewport { flex: 1 1 auto; position: relative; overflow: hidden; cursor: grab; outline: none; }
    [data-screen="Map"] #map-viewport.dragging { cursor: grabbing; }
    [data-screen="Map"] #map-content {
      position: absolute; left: 0; top: 0;
      /* Promote to its own compositor layer: pan/zoom is a transform update, and
         without the promotion every drag frame repainted the full viewport
         (measured: 115 full-screen paints per 48-move drag). With it, panning
         recomposites already-rasterised tiles. Chromium tiles huge layers, so
         the world-sized element does not allocate world-sized textures. */
      will-change: transform;
      transform-origin: 0 0;
      image-rendering: pixelated;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      background-color: white;
      box-shadow: 0 3px 12px rgba(0,0,0,0.2);
    }
    [data-screen="Map"] #map-content::before {
      content: ""; position: absolute;
      width: 100%; height: 4%;
      left: 0; bottom: -4%;
      z-index: -1; pointer-events: none;
      background-image:
        linear-gradient(177deg, rgba(0,0,0,0.22) 10%, transparent 50%),
        linear-gradient(-177deg, rgba(0,0,0,0.22) 10%, transparent 50%);
      background-size: 49% 100%, 49% 100%;
      background-position: 2% 0, 98% 0;
      background-repeat: no-repeat;
    }
    [data-screen="Map"] #map-content::after {
      content: ""; position: absolute;
      left: 0; top: 0; width: 100%; height: 100%;
      z-index: 2; pointer-events: none;
      background-image:
        linear-gradient(to right, rgba(255,255,255,0.1) 0.5%, rgba(0,0,0,0.15) 1.2%, transparent 1.2%),
        linear-gradient(to bottom, rgba(255,255,255,0.1) 0.5%, rgba(0,0,0,0.15) 1.2%, transparent 1.2%),
        linear-gradient(to bottom, rgba(255,255,255,0.1) 0.5%, rgba(0,0,0,0.15) 1.2%, transparent 1.2%),
        linear-gradient(265deg, rgba(0,0,0,0.2), transparent 10%),
        linear-gradient(5deg, rgba(0,0,0,0.2), transparent 15%),
        linear-gradient(-5deg, rgba(0,0,0,0.1), transparent 10%),
        linear-gradient(5deg, rgba(0,0,0,0.1), transparent 10%),
        linear-gradient(-265deg, rgba(0,0,0,0.2), transparent 10%),
        linear-gradient(-5deg, rgba(0,0,0,0.2), transparent 15%),
        linear-gradient(266deg, rgba(0,0,0,0.2), transparent 10%);
      background-size:
        50% 100%, 100% 33.3333%, 100% 33.3333%,
        50% 33.3333%, 50% 33.3333%, 50% 33.3333%,
        50% 33.3333%, 50% 33.3333%, 50% 33.3333%, 50% 33.3333%;
      background-position:
        right top, left center, left bottom,
        left top, left top, right top,
        left center, right center, right center, left bottom;
      background-repeat: no-repeat;
    }
    [data-screen="Map"] #world-tex, [data-screen="Map"] #fow-tex, [data-screen="Map"] #overlay,
    [data-screen="Map"] #height-tint-tex, [data-screen="Map"] #wall-tex,
    [data-screen="Map"] #debug-height-tex, [data-screen="Map"] #debug-maze-tex {
      position: absolute; left: 0; top: 0;
      pointer-events: none; user-select: none; -webkit-user-drag: none;
    }
    /* Zero-sized until setBounds() knows the world size: an <img> with no CSS
       size paints at its natural resolution, so the basemap used to flash a
       1:1 crop of the (unfogged) world texture in the beat before the first
       snapshot landed — outside the fog veil, which is world-sized. */
    [data-screen="Map"] #world-tex          { z-index: 1; image-rendering: pixelated; width: 0; height: 0; }
    /* Furniture walls streamed in after the basemap was fetched. Same z as the
       basemap and later in DOM order, so it paints directly on top of it and BELOW
       the height tint — which is where walls sat back when they were baked into the
       basemap itself, so the tint keeps affecting them exactly as before. */
    [data-screen="Map"] #wall-tex           { z-index: 1; image-rendering: pixelated; width: 0; height: 0; }
    [data-screen="Map"] #height-tint-tex    { z-index: 1; image-rendering: pixelated; }
    [data-screen="Map"] #debug-height-tex   { z-index: 2; }
    [data-screen="Map"] #debug-maze-tex     { z-index: 3; }
    [data-screen="Map"] #debug-all-tex      { z-index: 4; }
    [data-screen="Map"] #fow-tex            { z-index: 5; }
    [data-screen="Map"] #overlay            { z-index: 6; }
    /* Fog-not-ready veil: the same opaque black the fog texture paints over
       unexplored ground (see FGenerateExploredTexture::DoWork), covering every
       map layer INCLUDING the SVG markers until real fog pixels are up. */
    [data-screen="Map"] #fow-veil {
      position: absolute; left: 0; top: 0; width: 100%; height: 100%;
      z-index: 7; pointer-events: none;
      background: #000;
    }
    [data-screen="Map"] #debug-height-tex, [data-screen="Map"] #debug-maze-tex, [data-screen="Map"] #debug-all-tex {
      image-rendering: pixelated; display: none;
    }
    [data-screen="Map"] #fow-tex   { image-rendering: pixelated; }
    [data-screen="Map"] .ic { cursor: default; }
    [data-screen="Map"] .ic.clickable { cursor: pointer; pointer-events: auto; }
    [data-screen="Map"] .ic-spawn   { fill: #f1c40f; }
    [data-screen="Map"] .ic-tele    { fill: #2ecc71; }
    [data-screen="Map"] .ic-death   { fill: #9b59b6; }
    [data-screen="Map"] .ic-land    { fill: #e74c3c; }
    [data-screen="Map"] .ic-other   { fill: #bbbbbb; }
    [data-screen="Map"] #player-canvas { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 3; }
    [data-screen="Map"] .ping       { stroke: #ffcc00; }
    [data-screen="Map"] #legend {
      flex: 0 0 auto; padding: 6px 14px; font-size: 11px; letter-spacing: 2px;
      border-top: 1px solid var(--tsic-border);
      background: rgba(35,31,24,0.35);
      display: flex; gap: 18px; flex-wrap: wrap;
    }
    [data-screen="Map"] #legend .li { display:inline-flex; align-items:center; gap:5px; }
    [data-screen="Map"] #legend .li svg { display:block; overflow:visible; }
    [data-screen="Map"] #hint { margin-left: auto; color: rgba(108, 94, 73, 0.6); }
    [data-screen="Map"] #empty {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none;
      color: var(--cat-ink-soft);
    }
    [data-screen="Map"] #pad-cursor {
      position: absolute; left: 50%; top: 50%;
      width: 28px; height: 28px; margin: -14px 0 0 -14px;
      border: 2px solid #ffcc00; border-radius: 50%;
      pointer-events: none; display: none;
      box-shadow: 0 0 4px rgba(255,204,0,0.6);
    }
    [data-screen="Map"] #map-viewport.pad-cursor #pad-cursor { display: block; }
    [data-screen="Map"] .ic-cluster { fill: rgba(35,31,24,0.35); stroke: #ffffff; }
    [data-screen="Map"] .ic-cluster-text { fill: #ffffff; font-family: var(--font-terminal); font-size: 17px; }
    [data-screen="Map"] #world-bounds {
      fill: none; stroke: #5a4a30; stroke-width: 2;
      vector-effect: non-scaling-stroke; pointer-events: none;
    }
    [data-screen="Map"] .bound-coord {
      fill: rgba(90, 74, 48, 0.85);
      font-family: var(--font-terminal);
      pointer-events: none;
    }
    @keyframes tsic-map-tp-flash {
      from { fill-opacity: 1; r: 4; }
      to   { fill-opacity: 0; r: 24; }
    }
    [data-screen="Map"] .tp-flash {
      fill: #f1c40f; stroke: #ffffff; stroke-width: 1;
      animation: tsic-map-tp-flash 600ms ease-out forwards;
      pointer-events: none;
    }
    [data-screen="Map"] #hover-chip {
      position: absolute;
      left: 0; top: 0;
      padding: 3px 7px;
      background: rgba(35,31,24,0.85);
      color: #f3e8c8;
      font-family: var(--font-terminal);
      /* VT323 runs small for its px size — 15px matches the legibility of the
       * 12px Consolas this used to fall back to. */
      font-size: 15px;
      letter-spacing: 1px;
      line-height: 1.35;
      border: 1px solid #5a4a30;
      pointer-events: none;
      white-space: pre;
      display: none;
      z-index: 5;
    }
  `;

  const TEMPLATE = `
    <div id="map-root">
      <div id="map-title">MAP</div>
      <!-- tabindex/focusable: the map has no buttons, but focus must land
           INSIDE the overlay on open (an activeElement of <body> drops
           anticipatory keys) and the focus engine needs a territory anchor.
           Accept on it is a no-op click; pan/zoom stay behavior-driven. -->
      <div id="map-viewport" data-cursor="map" tabindex="-1" data-tsic-focusable data-tsic-initial-focus>
        <div id="map-content">
          <img id="world-tex" src="/runtime/world-map.imgsrc">
          <canvas id="height-tint-tex" width="0" height="0"></canvas>
          <img id="debug-height-tex" src="/runtime/world-debug-height.imgsrc">
          <img id="debug-maze-tex"   src="/runtime/world-debug-maze.imgsrc">
          <img id="debug-all-tex"    src="/runtime/world-debug-all.imgsrc">
          <canvas id="fow-tex" width="0" height="0"></canvas>
          <svg id="overlay" xmlns="http://www.w3.org/2000/svg">
            <rect id="world-bounds" x="0" y="0" width="0" height="0"></rect>
            <g id="g-icons"></g>
            <g id="g-pings"></g>
            <g id="g-coords"></g>
            <g id="g-cheat-fx"></g>
          </svg>
          <div id="fow-veil"></div>
        </div>
        <div id="empty">Waiting for map data…</div>
        <canvas id="player-canvas"></canvas>
        <div id="pad-cursor"></div>
        <div id="hover-chip"></div>
      </div>
      <div id="tp-bar" style="display:none;">
        <b>TELEPORT</b>
        <span class="tp-layers">
          <button class="tp-layer is-active" data-layer="Floor">Ground</button>
          <button class="tp-layer" data-layer="Sky">Sky</button>
          <button class="tp-layer" data-layer="Underground">Underground</button>
        </span>
        <span id="tp-note">Click a tile to teleport there.</span>
        <button id="tp-done">Back to cheats</button>
      </div>
      <div id="legend">
        <span id="hint" data-base="drag = pan · wheel = zoom · R = reset · Esc = close · RMB = ping · WebUI.Map.DebugHeight / DebugMazeRegions">drag = pan · wheel = zoom · R = reset · Esc = close · RMB = ping · WebUI.Map.DebugHeight / DebugMazeRegions</span>
      </div>
    </div>
  `;

  // Teleport-picker chrome. Kept out of the main STYLE block so the picker is
  // obviously an addition to the map rather than part of its normal look.
  const TELEPORT_STYLE = `
    [data-screen="Map"] #tp-bar {
      display:flex; gap:10px; align-items:center; flex-wrap:wrap;
      padding: 5px 10px; background: var(--ink-night, #14110c); color: var(--paper-bright, #fffdf3);
      border-bottom: 2px solid var(--mag-yellow, #f5c518); font-size: 12px;
    }
    [data-screen="Map"] #tp-bar b { font-family: var(--font-display, inherit); letter-spacing: 2px; color: var(--mag-yellow, #f5c518); font-weight: 400; font-size: 15px; }
    [data-screen="Map"] #tp-bar .tp-layers { display:inline-flex; gap:3px; }
    [data-screen="Map"] .tp-layer {
      font: inherit; padding: 2px 9px; cursor: pointer;
      background: transparent; color: var(--paper-bright, #fffdf3);
      border: 1px solid rgba(255,253,247,0.4);
    }
    [data-screen="Map"] .tp-layer:hover { background: rgba(255,253,247,0.15); }
    [data-screen="Map"] .tp-layer.is-active { background: var(--mag-yellow, #f5c518); color: var(--ink-night, #14110c); border-color: var(--ink-night, #14110c); font-weight: bold; }
    [data-screen="Map"] #tp-note { opacity: 0.75; }
    [data-screen="Map"] #tp-note.is-warn { opacity: 1; color: var(--mag-yellow, #f5c518); font-weight: bold; }
    [data-screen="Map"] #tp-done { font: inherit; margin-left:auto; padding: 2px 10px; cursor:pointer; background: var(--mag-red, #e60000); color: var(--paper-bright, #fffdf3); border: 1px solid var(--ink-night, #14110c); }
    [data-screen="Map"] #map-viewport.is-teleport { cursor: crosshair; }
  `;

  function injectStyleOnce() {
    if (document.getElementById('screen-map-style')) return;
    const s = document.createElement('style');
    s.id = 'screen-map-style';
    s.textContent = STYLE + TELEPORT_STYLE;
    document.head.appendChild(s);
  }

  // Set by mount() so the module-level onShow() (which has no access to the
  // per-mount closure) can drive the fog refresh. One mount per screen.
  let onShowHook = null;
  // Set by mount() so onShow(params) can hand the per-mount closure the
  // teleport-picker flag the cheat menu opened us with.
  let teleportModeHook = null;

  TSIC.registerScreen('Map', {
    inputModeTag: 'InputMode.Menu.Map',
    cancelCmd: 'UI.Cmd.GameScreen.Close',
    screenSound: false, // plays its own Map.Open / Map.Close
    opaque: true,       // #map-root is a full-inset opaque sheet over the HUD
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();

      // ---- helpers / state -----------------------------------------
      const qs = (sel) => root.querySelector(sel);
      // Legend built after helpers are declared (see end of mount).

      const PX_PER_CM = 1;
      const ICON_PX = 8;
      const PING_HALF_PX = 8;
      const PING_STROKE_PX = 3;
      const PICK_RADIUS_PX = 16;
      let bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, hasData: false };
      let MIN_SCALE = 0.05;
      const MAX_SCALE = 6;
      // Default open/reset zoom relative to the fit-whole-map scale (1 = fit whole map).
      const DEFAULT_ZOOM_MULT = 3;
      const state = { panX: 0, panY: 0, scale: 1, isPad: false, mouseX: -1, mouseY: -1 };
      // Test/debug hook: the Gauntlet DOM-assert seam reads closure state
      // (zoom clamps, pad mode, icon sizing) through here. Not a public API.
      window.__tsicMap = {
        state,
        get minScale() { return MIN_SCALE; },
        maxScale: MAX_SCALE,
        iconPx: ICON_PX,
        defaultZoomMult: DEFAULT_ZOOM_MULT,
        // World -> local projection, so a test can aim a click at a known tile
        // without re-deriving the projection (and silently drifting from it).
        worldToLocal: (wx, wy) => worldToLocal(wx, wy),
        // Drops the fog gate to its documented fail-open state (fowGrid = null)
        // so icon/cluster contracts are testable without hours of exploration.
        // Also lifts the fog-not-ready veil, which would otherwise cover the
        // markers the caller is about to assert on.
        disableFogGate() {
          fowGrid = null;
          fowGridSuppressed = true;
          fowGateOverridden = true;
          applyFowGate();
          if (latestSnapshot) renderIcons(latestSnapshot.Icons);
        },
        // Fog-gate probes (see the fog readiness gate below): whether fog is in
        // play for this session, whether its pixels are up, and whether the veil
        // is currently covering the map.
        get fowPainted() { return fowPainted; },
        get fowExpected() { return fowExpected; },
        get fowVeiled() { return !fowReady(); },
        // Viewport-centre zoom via the REAL clamp path (what triggers drive);
        // dt is seconds-at-rate, so large values pin against MIN/MAX.
        zoomBy(direction, dt) { zoomBy(direction, dt); },
      };
      let latestSnapshot = null;
      let latestPings = null;
      let tileGrid = null;
      // Height-tint overlay (shared/height-tint.js): per-level tile tints
      // relative to the local player's height level. null until TileGrid lands.
      let heightTint = null;
      let heightLevel = 0;
      // Fog-of-war hover gate. Built from UI.Map.FowGrid (see shared/fow-lookup.js).
      // null = no fog data yet → fail open (never suppress the hover panel).
      //
      // fowGridRaw holds the last payload; fowGrid is the built lookup, made on first
      // read after a payload arrives and cached until the next one. Building eagerly in
      // the message handler cost a full walk of every explored row per fog regen, all
      // session, whether or not the map was open — see the UI.Map.FowGrid handler.
      let fowGridRaw = null;
      let fowGrid = null;
      // Set by disableFogGate() so a test's fail-open override isn't undone by the
      // next lazy rebuild.
      let fowGridSuppressed = false;
      function getFowGrid() {
        if (fowGridSuppressed) return null;
        if (!fowGrid && fowGridRaw && window.TSICFow) {
          fowGrid = window.TSICFow.build(fowGridRaw);
        }
        return fowGrid;
      }
      let latestPlayers = [];

      // ---- fog readiness gate --------------------------------------
      // The basemap must NEVER paint before the fog overlay. They are two
      // independent fetches with no ordering guarantee, and the basemap wins for
      // two reasons: (1) #world-tex declares its src in the template, so the
      // request is issued the moment the overlay HTML is inserted, while the fog
      // request is only issued when the sticky UI.Map.Fow handler runs at the END
      // of mount(); (2) the 'fow' runtime source only exists once the first FOW
      // texture has been generated, so early on it can 404 while the basemap —
      // baked during worldgen — already resolves. Result: opening the map showed
      // a fully-revealed world for a beat, exposing unexplored ground. Until real
      // fog pixels are on screen, #fow-veil covers every layer with the same
      // opaque black the fog paints over unexplored.
      //
      // The gate fails CLOSED while fog status is unknown: not-yet-known is the
      // same risk as not-yet-loaded. It opens on exactly four conditions —
      //   1. fog pixels are painted (the normal case, well under a frame or two)
      //   2. the fog overlay is hidden by the SetFogOfWarVisible cheat
      //   3. the grace window expired with no fog broadcast at all → fog is off
      //      for this session (worldgen disabled / dev map), so a fog-less world
      //      never sits behind a black square forever
      //   4. the fetch ladder gave up → fog is broken; a permanently black map
      //      would be worse than an unfogged one (logged loudly)
      // Fog counts as "in play" once a UI.Map.Fow / UI.Map.FowGrid broadcast has
      // been seen; both are sticky, so a late mount replays the last one
      // synchronously and condition 3 never fires in a real fogged session.
      const FOW_ASSUME_OFF_MS = 3000;
      const FOW_RETRY_MS = 750;
      const FOW_MAX_RETRIES = 6;
      let fowExpected = false;      // a fog broadcast has been seen
      let fowPainted = false;       // fog pixels are in the #fow-tex canvas
      let fowGraceExpired = false;  // grace window elapsed (see condition 3)
      let fowFetchGaveUp = false;   // retry ladder exhausted (see condition 4)
      let fowGateOverridden = false; // test seam (__tsicMap.disableFogGate)

      // ---- teleport picker (cheat menu) ----------------------------
      // Opened as UI.Screen.Changed {Name:'Map', ParamsJson:'{"mode":"teleport"}'}.
      // Fog is revealed for the VIEW only — no HideFOW is run, so the session's
      // real fog grid and the save are untouched.
      let teleportMode = false;
      let teleportLayer = 'Floor';
      // 0 = whoever opened the picker, resolved server-side. A literal 1 is index 0 of
      // the server's player array, so on a client it would teleport the host instead.
      let teleportPlayer = 0;

      function setTeleportMode(on, playerNum) {
        teleportMode = !!on;
        const picked = parseInt(playerNum, 10);
        teleportPlayer = Number.isFinite(picked) && picked > 0 ? picked : 0;
        const bar = qs('#tp-bar');
        if (bar) bar.style.display = teleportMode ? 'flex' : 'none';
        const vpEl = qs('#map-viewport');
        if (vpEl) vpEl.classList.toggle('is-teleport', teleportMode);
        // The teleport bar changes the viewport's height; refresh the cached size.
        measureViewport();
        // Revealing is a render-side override: the gate opens, the fog canvas
        // hides, and the marker fog test short-circuits (see iconVisibleInFog).
        fowGateOverridden = teleportMode;
        const fowTex = qs('#fow-tex');
        if (fowTex) fowTex.style.visibility = teleportMode ? 'hidden' : '';
        applyFowGate();
        if (teleportMode) selectTeleportLayer(teleportLayer);
        rerenderSoon();
      }

      function selectTeleportLayer(layer) {
        teleportLayer = layer;
        root.querySelectorAll('#tp-bar .tp-layer').forEach((b) => {
          b.classList.toggle('is-active', b.getAttribute('data-layer') === layer);
        });
      }

      // Tile-snap and hand the tile indices to C++; the cheat owns the world
      // position so the tile centre and layer Z are computed in one place.
      function teleportToPoint(wx, wy) {
        const t = tileAt(wx, wy);
        if (!t) return;
        if (teleportLayer === 'Sky' && !t.hasSky) { flashTeleportRefusal('no sky layer on that tile'); return; }
        if (teleportLayer === 'Underground' && !t.hasUnderground) { flashTeleportRefusal('no underground on that tile'); return; }
        ctx.publish('UI.Cmd.Cheat.Execute', {
          Command: 'TeleportToTileLayer ' + teleportPlayer + ' ' + t.east + ' ' + t.north + ' ' + teleportLayer,
        });
        if (window.tsic && window.tsic.playSound) window.tsic.playSound('Map.Ping', 0.35);
      }

      function flashTeleportRefusal(why) {
        const note = qs('#tp-note');
        if (!note) return;
        note.textContent = why;
        note.classList.add('is-warn');
        setTimeout(() => { note.classList.remove('is-warn'); note.textContent = TP_HINT; }, 1600);
      }
      const TP_HINT = 'Click a tile to teleport there.';
      let fowStale = false;         // fog changed while the screen was hidden
      let fowGen = 0;               // stale-guard for out-of-order fetches
      let fowInFlight = false;
      let fowRetries = 0;
      let fowRetryTimer = null;

      // Blit the decoded fog PNG into the #fow-tex canvas. A canvas (not an
      // <img>) is the fog layer precisely because assigning a new .src to a live
      // <img> clears its pixels for the whole fetch+decode — every fog regen
      // would blank the fog layer for a few frames and flash the whole
      // unexplored world (the same trap hud-minimap.js documents in reloadFow).
      function paintFow(img) {
        const cvs = qs('#fow-tex');
        if (!cvs) return false;
        if (cvs.width !== img.naturalWidth || cvs.height !== img.naturalHeight) {
          cvs.width = img.naturalWidth;
          cvs.height = img.naturalHeight;
        }
        const c2d = cvs.getContext('2d');
        if (!c2d) return false;
        c2d.clearRect(0, 0, cvs.width, cvs.height);
        c2d.drawImage(img, 0, 0);
        fowPainted = true;
        applyFowGate();
        return true;
      }

      // Fetch the current fog texture off-DOM and blit it once decoded. The
      // runtime image source only resolves after the C++ side registers it, so a
      // failed fetch retries a few times instead of leaving the map veiled.
      function reloadFow() {
        if (fowRetryTimer) { clearTimeout(fowRetryTimer); fowRetryTimer = null; }
        fowStale = false;
        fowInFlight = true;
        const gen = ++fowGen;
        const next = new Image();
        // A zero-sized "successful" load is an empty response from the scheme
        // handler (the runtime source exists but has no pixels yet) — treat it
        // as a failure so the retry ladder keeps trying instead of latching a
        // blank fog layer over a revealed basemap.
        const onFail = () => {
          if (gen !== fowGen) return;
          fowInFlight = false;
          if (fowRetries++ >= FOW_MAX_RETRIES) {
            console.warn('[map] fog texture never loaded — revealing basemap unfogged');
            fowFetchGaveUp = true;
            applyFowGate();
            return;
          }
          fowRetryTimer = setTimeout(() => { fowRetryTimer = null; reloadFow(); }, FOW_RETRY_MS);
        };
        next.onload = () => {
          if (gen !== fowGen) return;   // a newer refresh already won
          if (!next.naturalWidth || !next.naturalHeight || !paintFow(next)) { onFail(); return; }
          fowInFlight = false;
          fowRetries = 0;
        };
        next.onerror = onFail;
        next.src = TSIC.runtimeImgUrl('fow') + '?t=' + Date.now();
      }

      // Fog refreshes are only worth fetching while the map is on screen: the
      // scheme handler re-encodes the runtime texture to PNG on every fetch, and
      // UI.Map.Fow fires on every regen (constantly while walking). Coalesce to
      // one refresh on show. Previously-painted fog stays up meanwhile — only
      // exploration adds revealed cells, so a stale copy reveals LESS than the
      // truth and cannot leak. (ClearFogOfWar is the one exception: a cheat that
      // shrinks the revealed area shows the older, MORE revealed fog until the
      // refresh lands a fraction of a second later.)
      function onFowBroadcast() {
        fowExpected = true;
        if (!ctx.isVisible()) {
          fowStale = true;
          applyFowGate();
          return;
        }
        reloadFow();
      }

      function fowReady() {
        if (fowGateOverridden || fowPainted || fowFetchGaveUp) return true;
        // The fog overlay hidden by the SetFogOfWarVisible cheat has nothing to
        // wait for. Checked via the same style.display flag fowOverlayVisible()
        // reads, but tolerant of being called before the DOM query resolves.
        const cvs = qs('#fow-tex');
        if (cvs && cvs.style.display === 'none') return true;
        // Unknown (no broadcast yet) stays closed until the grace window ends.
        // A broadcast arriving later re-closes the gate until pixels land.
        return fowGraceExpired && !fowExpected;
      }

      function applyFowGate() {
        const veil = qs('#fow-veil');
        if (!veil) return;
        veil.style.display = fowReady() ? 'none' : 'block';
      }

      function svgEl(tag, attrs) {
        const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
        if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
        return e;
      }

      function worldToLocal(wx, wy) {
        const x = (wy - bounds.minY) * PX_PER_CM;
        const y = (bounds.maxX - wx) * PX_PER_CM;
        return { x, y };
      }
      function localToWorld(lx, ly) {
        const wy = bounds.minY + lx / PX_PER_CM;
        const wx = bounds.maxX - ly / PX_PER_CM;
        return { wx, wy };
      }
      function applyTransform() {
        qs('#map-content').style.transform =
          `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
      }
      // Cached viewport size. clientWidth/Height on #map-viewport are layout
      // reads: interleaved with the SVG writes in rerender() they forced a
      // synchronous layout of the world-sized SVG on every zoom frame (the
      // single biggest zoom cost when profiled). The size only changes on
      // resize, on show, and when the teleport bar toggles — measure there,
      // read the cache everywhere else.
      let vpW = 0, vpH = 0;
      function measureViewport() {
        const vp = qs('#map-viewport');
        if (!vp) return;
        vpW = vp.clientWidth;
        vpH = vp.clientHeight;
      }
      function updateMinScale() {
        if (!bounds.hasData) return;
        if (!(vpW > 0)) measureViewport();
        const widthCm  = (bounds.maxY - bounds.minY) * PX_PER_CM;
        const heightCm = (bounds.maxX - bounds.minX) * PX_PER_CM;
        if (widthCm <= 0 || heightCm <= 0) return;
        const sx = vpW / widthCm;
        const sy = vpH / heightCm;
        MIN_SCALE = Math.min(sx, sy) * 0.95;
      }
      function fitToBounds() {
        if (!bounds.hasData) return;
        measureViewport();   // fit is rare and layout-sensitive: measure fresh
        const widthCm  = (bounds.maxY - bounds.minY) * PX_PER_CM;
        const heightCm = (bounds.maxX - bounds.minX) * PX_PER_CM;
        if (widthCm <= 0 || heightCm <= 0) return;
        const sx = vpW / widthCm;
        const sy = vpH / heightCm;
        const fitScale = Math.min(sx, sy) * 0.95;
        MIN_SCALE = fitScale;
        state.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fitScale * DEFAULT_ZOOM_MULT));
        // Center on the local player when known; otherwise center the whole map.
        const me = latestSnapshot && (latestSnapshot.Players || [])[0];
        if (me && me.Position) {
          const loc = worldToLocal(me.Position.X || 0, me.Position.Y || 0);
          state.panX = vpW / 2 - loc.x * state.scale;
          state.panY = vpH / 2 - loc.y * state.scale;
        } else {
          state.panX = (vpW - widthCm  * state.scale) / 2;
          state.panY = (vpH - heightCm * state.scale) / 2;
        }
        applyTransform();
        if (latestSnapshot) rerender();
      }
      // World-sized layer dimensions from the last setBounds(). Kept so a layer that
      // joins the stack later (the adopted wall canvas) can be sized on arrival
      // instead of waiting for the next bounds change, which may never come.
      let layerW = 0;
      let layerH = 0;
      // Bumped when bounds actually change; cached world->local products
      // (rendered pings) key off it.
      let boundsEpoch = 0;
      function sizeLayer(el) {
        if (!el || !(layerW > 0)) return;
        el.style.width  = `${layerW}px`;
        el.style.height = `${layerH}px`;
      }

      // The furniture-wall overlay canvas is owned by shared/wall-patches.js and
      // shared with the minimap, so it is ADOPTED into the layer stack rather than
      // recreated here — one world-resolution canvas per session, not two.
      if (window.TSICWallPatches) {
        window.TSICWallPatches.onCanvas((cvs) => {
          cvs.id = 'wall-tex';
          const world = qs('#world-tex');
          if (world && world.parentNode) {
            world.parentNode.insertBefore(cvs, world.nextSibling);
          }
          sizeLayer(cvs);
        });
      }

      function setBounds(minB, maxB) {
        const minX = minB && typeof minB.X === 'number' ? minB.X : 0;
        const minY = minB && typeof minB.Y === 'number' ? minB.Y : 0;
        const maxX = maxB && typeof maxB.X === 'number' ? maxB.X : 0;
        const maxY = maxB && typeof maxB.Y === 'number' ? maxB.Y : 0;
        const changed = bounds.minX !== minX || bounds.minY !== minY
                     || bounds.maxX !== maxX || bounds.maxY !== maxY;
        bounds = { minX, minY, maxX, maxY, hasData: (maxX - minX) > 0 && (maxY - minY) > 0 };
        if (changed) boundsEpoch++;
        if (changed && bounds.hasData) {
          const c = qs('#map-content');
          const w = (bounds.maxY - bounds.minY) * PX_PER_CM;
          const h = (bounds.maxX - bounds.minX) * PX_PER_CM;
          const pad = Math.round(Math.min(w, h) * 0.04);
          c.style.padding = `${pad}px`;
          c.style.width  = `${w}px`;
          c.style.height = `${h}px`;
          layerW = w;
          layerH = h;
          for (const id of ['world-tex', 'wall-tex', 'height-tint-tex', 'fow-tex', 'debug-height-tex', 'debug-maze-tex', 'debug-all-tex']) {
            sizeLayer(qs('#' + id));
          }
          const svg = qs('#overlay');
          if (svg) {
            svg.setAttribute('width',  w);
            svg.setAttribute('height', h);
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
          }
          const wb = qs('#world-bounds');
          if (wb) { wb.setAttribute('width',  w); wb.setAttribute('height', h); }
          fitToBounds();
        }
      }

      function categoryClass(cat) {
        const c = (cat || '').toLowerCase();
        if (c === 'spawn' || c === 'spawnpoint') return 'ic-spawn';
        if (c === 'fasttravel' || c === 'teleporter') return 'ic-tele';
        if (c === 'deathbox') return 'ic-death';
        if (c === 'landmark') return 'ic-land';
        return 'ic-other';
      }

      // Biome map colour ("#RRGGBB") under a world point, from the TileGrid
      // palette. Null when there's no tile data or the biome has no colour.
      function biomeColorAt(wx, wy) {
        if (!tileGrid || !Array.isArray(tileGrid.colors) || tileGrid.tileSize <= 0 || tileGrid.worldSize <= 0) return null;
        const N = Math.floor(wx / tileGrid.tileSize);
        const E = Math.floor(wy / tileGrid.tileSize);
        if (N < 0 || E < 0 || N >= tileGrid.worldSize || E >= tileGrid.worldSize) return null;
        const paletteIdx = tileGrid.biomes[N * tileGrid.worldSize + E] | 0;
        const col = tileGrid.colors[paletteIdx];
        return (typeof col === 'string' && col.length >= 4) ? col : null;
      }

      // Fill colour for a landmark marker: the same MapColor its POI pixels use
      // on the map texture. Landmark labels and the TileGrid palette names both
      // derive from the biome's DisplayName, so match by name first; fall back
      // to sampling the tile under the icon (the icon sits on its POI cluster).
      function landmarkColor(ic, wx, wy) {
        if (tileGrid && Array.isArray(tileGrid.palette) && Array.isArray(tileGrid.colors)) {
          const idx = tileGrid.palette.indexOf(String(ic.Label || ''));
          const col = idx >= 0 ? tileGrid.colors[idx] : null;
          if (typeof col === 'string' && col.length >= 4) return col;
        }
        return biomeColorAt(wx, wy);
      }

      // Fog gate for markers: hide icons over unexplored fog, mirroring the hover
      // panel. Fail-open when there's no fog data or the fog overlay is hidden.
      function iconVisibleInFog(wx, wy) {
        const TF = window.TSICFow;
        // The picker exists to show you everywhere you could go, so every POI is
        // visible regardless of exploration.
        if (teleportMode) return true;
        const grid = getFowGrid();
        if (!grid || !TF || !fowOverlayVisible()) return true;
        return TF.exploredAt(grid, wx, wy);
      }

      // --- marker shape geometry (points centred on cx,cy) ------------
      function regularPoints(cx, cy, radius, sides, startDeg) {
        const start = (startDeg || 0) * Math.PI / 180;
        const pts = [];
        for (let i = 0; i < sides; i++) {
          const a = start + i * 2 * Math.PI / sides;
          pts.push((cx + radius * Math.cos(a)).toFixed(2) + ',' + (cy + radius * Math.sin(a)).toFixed(2));
        }
        return pts.join(' ');
      }
      function starPoints(cx, cy, rOuter, rInner, points, startDeg) {
        const start = (startDeg || 0) * Math.PI / 180;
        const pts = [];
        for (let i = 0; i < points * 2; i++) {
          const rr = (i % 2 === 0) ? rOuter : rInner;
          const a = start + i * Math.PI / points;
          pts.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2));
        }
        return pts.join(' ');
      }
      function crossPoints(cx, cy, arm, thick) {
        const p = [
          [-thick, -arm], [thick, -arm], [thick, -thick], [arm, -thick], [arm, thick], [thick, thick],
          [thick, arm], [-thick, arm], [-thick, thick], [-arm, thick], [-arm, -thick], [-thick, -thick],
        ];
        return p.map((xy) => (cx + xy[0]).toFixed(2) + ',' + (cy + xy[1]).toFixed(2)).join(' ');
      }
      // Landmarks are POI-biome markers: hash the POI's label onto a shape set
      // so each POI type keeps its own silhouette. An empty label hashes to 0
      // (circle), which is also what the legend glyph shows for the category.
      function landmarkShape(cx, cy, r, label) {
        const s = String(label || '');
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        switch (Math.abs(h) % 7) {
          case 0: return svgEl('circle', { cx: cx, cy: cy, r: r });
          case 1: return svgEl('polygon', { points: regularPoints(cx, cy, r * 1.2, 3, -90) });
          case 2: return svgEl('polygon', { points: regularPoints(cx, cy, r * 1.2, 3, 90) });
          case 3: return svgEl('polygon', { points: regularPoints(cx, cy, r * 1.1, 5, -90) });
          case 4: return svgEl('polygon', { points: regularPoints(cx, cy, r * 1.05, 6, 0) });
          case 5: return svgEl('polygon', { points: starPoints(cx, cy, r * 1.3, r * 0.6, 6, -90) });
          default: return svgEl('polygon', { points: starPoints(cx, cy, r * 1.3, r * 0.55, 4, -90) });
        }
      }
      // A distinct shape per icon category so type reads without relying on colour.
      // spawn = star, teleporter = diamond, deathbox = cross, other = square;
      // landmarks get a per-POI shape from their label.
      function markerShape(category, cx, cy, r, label) {
        const c = (category || '').toLowerCase();
        if (c === 'landmark') return landmarkShape(cx, cy, r, label);
        if (c === 'spawn' || c === 'spawnpoint') return svgEl('polygon', { points: starPoints(cx, cy, r * 1.25, r * 0.55, 5, -90) });
        if (c === 'fasttravel' || c === 'teleporter') return svgEl('polygon', { points: regularPoints(cx, cy, r * 1.2, 4, -90) });
        if (c === 'deathbox') return svgEl('polygon', { points: crossPoints(cx, cy, r * 1.15, r * 0.38) });
        return svgEl('polygon', { points: regularPoints(cx, cy, r * 0.95, 4, -45) });
      }

      // Small legend glyph that matches the on-map marker shape for a category.
      function legendGlyph(kind, color) {
        const s = svgEl('svg', { width: 14, height: 14, viewBox: '0 0 14 14' });
        if (kind === 'player') {
          const arrow = svgEl('polygon', { points: '12,7 3,2.5 5.5,7 3,11.5', fill: color, stroke: '#fff', 'stroke-width': 1 });
          s.appendChild(arrow);
          return s;
        }
        if (kind === 'ping') {
          s.appendChild(svgEl('line', { x1: 3, y1: 3, x2: 11, y2: 11, stroke: color, 'stroke-width': 2.2 }));
          s.appendChild(svgEl('line', { x1: 3, y1: 11, x2: 11, y2: 3, stroke: color, 'stroke-width': 2.2 }));
          return s;
        }
        const shape = markerShape(kind, 7, 7, 5);
        shape.setAttribute('fill', color);
        shape.setAttribute('stroke', '#231f18');
        shape.setAttribute('stroke-width', 1);
        s.appendChild(shape);
        return s;
      }
      function buildLegend() {
        const legend = qs('#legend');
        const hint = qs('#hint');
        if (!legend || !hint) return;
        const items = [
          { label: 'Player', kind: 'player', color: '#3498db' },
          { label: 'Landmark', kind: 'landmark', color: '#c98a3a' },
          { label: 'Spawn', kind: 'spawnpoint', color: '#f1c40f' },
          { label: 'Teleporter', kind: 'teleporter', color: '#2ecc71' },
          { label: 'Death', kind: 'deathbox', color: '#9b59b6' },
          { label: 'Ping', kind: 'ping', color: '#ffcc00' },
        ];
        for (const it of items) {
          const span = document.createElement('span');
          span.className = 'li';
          span.appendChild(legendGlyph(it.kind, it.color));
          span.appendChild(document.createTextNode(it.label));
          legend.insertBefore(span, hint);
        }
      }

      // Clustering is per POI type: only markers that share a category (and,
      // for landmarks, the same POI label) merge into one group marker, so the
      // group can honestly wear its members' shape and colour. The radius is
      // wider than the old mixed-type value (32) because worldgen spreads each
      // POI type out — same-type neighbours sit farther apart than mixed ones.
      const CLUSTER_SCREEN_PX = 48;
      function iconTypeKey(ic) {
        const c = (ic.Category || '').toLowerCase();
        return c === 'landmark' ? c + '|' + String(ic.Label || '') : c;
      }
      function clusterIcons(icons) {
        if (state.scale >= 0.5) return { clusters: [], singletons: icons || [] };
        const byType = new Map();
        for (const ic of icons || []) {
          const key = iconTypeKey(ic);
          if (!byType.has(key)) byType.set(key, []);
          byType.get(key).push(ic);
        }
        const clusters = [];
        const singletons = [];
        for (const bucket of byType.values()) {
          const part = clusterIconBucket(bucket);
          clusters.push(...part.clusters);
          singletons.push(...part.singletons);
        }
        return { clusters, singletons };
      }
      function clusterIconBucket(icons) {
        const radiusLocal = CLUSTER_SCREEN_PX / state.scale;
        const remaining = (icons || []).slice();
        const clusters = [];
        const singletons = [];
        while (remaining.length > 0) {
          const seed = remaining.shift();
          const sx = (seed.Position && seed.Position.X) || 0;
          const sy = (seed.Position && seed.Position.Y) || 0;
          const group = [seed];
          for (let i = remaining.length - 1; i >= 0; i--) {
            const ic = remaining[i];
            const x = (ic.Position && ic.Position.X) || 0;
            const y = (ic.Position && ic.Position.Y) || 0;
            if (Math.hypot(x - sx, y - sy) <= radiusLocal) {
              group.push(ic);
              remaining.splice(i, 1);
            }
          }
          if (group.length === 1) {
            singletons.push(seed);
          } else {
            let cx = 0, cy = 0;
            for (const g of group) {
              cx += (g.Position && g.Position.X) || 0;
              cy += (g.Position && g.Position.Y) || 0;
            }
            cx /= group.length;
            cy /= group.length;
            // Represent the cluster with its centre-most REAL member (not the
            // centroid) so zooming in on the group marker lands on an actual POI.
            let rep = group[0];
            let best = Infinity;
            for (const g of group) {
              const d = Math.hypot(((g.Position && g.Position.X) || 0) - cx,
                                   ((g.Position && g.Position.Y) || 0) - cy);
              if (d < best) { best = d; rep = g; }
            }
            clusters.push({ rep: rep, count: group.length });
          }
        }
        return { clusters, singletons };
      }

      // Keyed marker DOM. renderIcons used to tear down and recreate every SVG
      // marker on every call — and it is called on every snapshot broadcast,
      // which is continuous while the map is open. Markers keep the original
      // flat shape-with-baked-geometry form (position and 1/scale baked into
      // the points, class on the shape — the form the Gauntlet map node's
      // getBBox contract was written against), but each is registered under a
      // key of (icon, position, scale, bounds). A render where nothing changed
      // — every snapshot broadcast while the player reads the map — matches
      // every key and writes NOTHING to the DOM; a zoom or bounds change drops
      // the layer wholesale and rebuilds it exactly as the old code did.
      //
      // Negative results, all measured on this screen at 250/500 icons:
      // - Two-layer markers (outer translate g + inner counter-scale g) with
      //   in-place transform updates on zoom: won at 250 icons, LOST ~2x at
      //   500 — scattered SVG transform invalidations across a retained tree
      //   beat one bulk rebuild, and the doubled node count taxed every pass.
      // - The same structure rebuilt wholesale on zoom: worst of all (5 nodes
      //   per marker rebuilt vs the old 2-3).
      // - A shared CSS custom property (scale(var(--mi)), one setProperty per
      //   zoom tick) was ~3x MORE style time than attribute writes — even with
      //   a dozen var users, because changing an inherited custom property
      //   invalidates style for the whole subtree it is set on.
      const iconDom = new Map();   // key -> { els: [nodes], shape, fill }
      let iconsRenderedScale = ''; // geometry bakes the scale: change = rebuild
      let iconsRenderedEpoch = -1; // geometry bakes the bounds too
      // Zoom-compensation groups OUTSIDE #g-icons (ping crosses, corner coords):
      // rebuilt rarely, but their scale must track every zoom change. Each
      // rebuild repopulates its own list; renderIcons sweeps both on zoom.
      let pingScaleGs = [];
      let coordScaleGs = [];
      let auxScaleApplied = '';
      function newAuxScaleGroup(list) {
        const inv = state.scale > 0 ? (1 / state.scale) : 1;
        const sg = svgEl('g', { transform: `scale(${inv.toFixed(5)})` });
        list.push(sg);
        return sg;
      }
      function clearIconDom() {
        iconDom.clear();
        iconsRenderedScale = '';
        iconsRenderedEpoch = -1;
        const g = qs('#g-icons');
        if (g) g.textContent = '';
      }
      // Empty-state reset for every diffed overlay group: dropping the DOM
      // without also dropping the "already rendered" records would leave the
      // caches claiming content that is no longer there.
      function clearOverlaySvg() {
        clearIconDom();
        const pingsG = qs('#g-pings');
        if (pingsG) pingsG.textContent = '';
        pingsRendered = null;
        pingsRenderedEpoch = -1;
        pingScaleGs = [];
        const coordsG = qs('#g-coords');
        if (coordsG) coordsG.textContent = '';
        coordsKey = '';
        coordScaleGs = [];
      }
      function renderIcons(icons) {
        const g = qs('#g-icons');
        const inv = state.scale > 0 ? (1 / state.scale) : 1;
        const scaleStr = inv.toFixed(5);
        if (scaleStr !== iconsRenderedScale || boundsEpoch !== iconsRenderedEpoch) {
          // Zoom or bounds changed: marker geometry bakes both, so drop the
          // layer and rebuild below (one bulk pass — see note above).
          clearIconDom();
          iconsRenderedScale = scaleStr;
          iconsRenderedEpoch = boundsEpoch;
        }
        if (scaleStr !== auxScaleApplied) {
          auxScaleApplied = scaleStr;
          // Ping/coord scale groups follow the same zoom compensation; they are
          // a dozen nodes, so in-place attribute writes are the cheap option.
          const auxStr = `scale(${scaleStr})`;
          for (const el of pingScaleGs) el.setAttribute('transform', auxStr);
          for (const el of coordScaleGs) el.setAttribute('transform', auxStr);
        }
        const r = ICON_PX * inv;
        const sw = 1.5 * inv;
        // Hide markers sitting on unexplored fog before clustering, so cluster
        // counts only reflect what the player has actually discovered.
        const visible = (icons || []).filter((ic) =>
          iconVisibleInFog((ic.Position && ic.Position.X) || 0, (ic.Position && ic.Position.Y) || 0));
        const { clusters, singletons } = clusterIcons(visible);

        // Keys carry everything the baked geometry depends on beyond scale and
        // bounds (handled above): identity and world position. Cluster keys add
        // the count so a membership change rebuilds the badge.
        const posKey = (ic) => {
          const p = ic.Position || {};
          return (ic.IconId || iconTypeKey(ic)) + '|' + (p.X || 0) + ',' + (p.Y || 0);
        };
        const desired = new Map();   // key -> { ic, cluster? }
        for (const ic of singletons) desired.set('s|' + posKey(ic), { ic });
        for (const cl of clusters) desired.set('c|' + posKey(cl.rep) + '|' + cl.count, { ic: cl.rep, cluster: cl });

        for (const [key, entry] of iconDom) {
          if (!desired.has(key)) {
            for (const el of entry.els) el.remove();
            iconDom.delete(key);
          }
        }

        // Marker for one icon at its world position: category/POI shape, dark
        // outline, and the POI's map-pixel colour as fill for landmarks. The
        // fill goes on style (not the attribute) so it wins over the .ic-land
        // CSS fallback — presentation attributes lose to any CSS rule.
        function buildMarker(ic, baseClass) {
          const wx = (ic.Position && ic.Position.X) || 0;
          const wy = (ic.Position && ic.Position.Y) || 0;
          const pos = worldToLocal(wx, wy);
          const shape = markerShape(ic.Category, pos.x, pos.y, r, ic.Label);
          shape.setAttribute('class', `${baseClass} ${categoryClass(ic.Category)}`);
          shape.setAttribute('stroke', '#231f18');
          shape.setAttribute('stroke-width', sw);
          let fill = '';
          if ((ic.Category || '').toLowerCase() === 'landmark') {
            fill = landmarkColor(ic, wx, wy) || '';
            if (fill) shape.style.fill = fill;
          }
          return { shape, pos, fill };
        }

        for (const [key, d] of desired) {
          const ic = d.ic;
          let entry = iconDom.get(key);
          if (!entry) {
            if (d.cluster) {
              // Clusters draw as their centre-most member's real marker
              // (truthful position, shape, and POI colour — zooming in on the
              // group lands on an actual POI) plus a count badge.
              const { shape, pos, fill } = buildMarker(ic, 'ic-cluster-rep');
              const title = svgEl('title');
              const repName = ic.Label || ic.Category || ic.IconId || '';
              title.textContent = `${repName || 'POIs'} ×${d.cluster.count} (zoom in to expand)`;
              shape.appendChild(title);
              const badgeR = ICON_PX * 0.9 * inv;
              const badgeOff = ICON_PX * 1.5 * inv;
              const badge = svgEl('circle', {
                cx: pos.x + badgeOff, cy: pos.y - badgeOff, r: badgeR,
                class: 'ic-cluster', 'stroke-width': sw,
              });
              const text = svgEl('text', {
                x: pos.x + badgeOff, y: pos.y - badgeOff + 3.5 * inv,
                'text-anchor': 'middle', class: 'ic-cluster-text',
                'font-size': 10 * inv,
              });
              text.textContent = String(d.cluster.count);
              g.appendChild(shape);
              g.appendChild(badge);
              g.appendChild(text);
              entry = { els: [shape, badge, text], shape, fill };
            } else {
              const c = (ic.Category || '').toLowerCase();
              const isClickable = c === 'fasttravel' && (ic.EntityId | 0) > 0;
              const { shape, fill } = buildMarker(ic, `ic${isClickable ? ' clickable' : ''}`);
              if (isClickable) {
                shape.setAttribute('data-entity-id', String(ic.EntityId | 0));
                shape.addEventListener('click', (ev) => {
                  ev.stopPropagation();
                  ctx.publish('UI.Cmd.Teleporter.Travel', {
                    FromId: 0, ToId: parseInt(shape.dataset.entityId, 10) || 0,
                  });
                });
              }
              const title = svgEl('title');
              title.textContent = ic.Label || ic.Category || ic.IconId || '';
              shape.appendChild(title);
              g.appendChild(shape);
              entry = { els: [shape], shape, fill };
            }
            iconDom.set(key, entry);
          } else if ((ic.Category || '').toLowerCase() === 'landmark') {
            // Surviving landmark: its POI colour can arrive later (TileGrid).
            // Compared via our own record, not style.fill — the browser
            // normalises colour strings, which would defeat the equality check.
            const wx = (ic.Position && ic.Position.X) || 0;
            const wy = (ic.Position && ic.Position.Y) || 0;
            const col = landmarkColor(ic, wx, wy) || '';
            if (entry.fill !== col) { entry.fill = col; entry.shape.style.fill = col; }
          }
        }
      }

      function worldToScreen(wx, wy) {
        const local = worldToLocal(wx, wy);
        return {
          x: state.panX + local.x * state.scale,
          y: state.panY + local.y * state.scale,
        };
      }
      function drawPlayerArrow(c, x, y, yawDeg, color, sz) {
        c.save();
        c.translate(x, y);
        c.rotate((yawDeg - 90) * Math.PI / 180);
        var s = sz / 8;
        c.beginPath();
        c.moveTo(8 * s, 0);
        c.lineTo(-4 * s, -5 * s);
        c.lineTo(-2 * s, 0);
        c.lineTo(-4 * s, 5 * s);
        c.closePath();
        c.fillStyle = color; c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
        c.restore();
      }
      function drawPlayerDot(c, x, y, color, radius) {
        c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2);
        c.fillStyle = color; c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke();
      }
      function redrawPlayerCanvas() {
        const cvs = qs('#player-canvas');
        if (!cvs) return;
        if (!(vpW > 0)) measureViewport();
        const w = vpW;
        const h = vpH;
        if (cvs.width !== w || cvs.height !== h) { cvs.width = w; cvs.height = h; }
        const c = cvs.getContext('2d');
        c.clearRect(0, 0, w, h);
        if (!bounds.hasData) return;
        for (let i = 0; i < latestPlayers.length; i++) {
          const pl = latestPlayers[i];
          const wx = (pl.Position && pl.Position.X) || 0;
          const wy = (pl.Position && pl.Position.Y) || 0;
          const isSelf = (i === 0);
          const color = pl.Color || (isSelf ? '#3498db' : '#888888');
          const yaw = pl.YawDeg || 0;
          const s = worldToScreen(wx, wy);
          if (isSelf) drawPlayerArrow(c, s.x, s.y, yaw, color, 10);
          else        drawPlayerDot(c, s.x, s.y, color, 5);
        }
      }
      // Pan input (mouse drag, gamepad axis) can fire faster than the frame
      // rate; the canvas can only be presented once per frame, so coalesce the
      // clear+redraw to rAF. Data updates (renderPlayers) stay synchronous —
      // tests read the canvas right after injecting a snapshot.
      let playersRedrawQueued = false;
      function repositionPlayers() {
        if (playersRedrawQueued) return;
        playersRedrawQueued = true;
        requestAnimationFrame(() => {
          playersRedrawQueued = false;
          if (ctx.isVisible()) redrawPlayerCanvas();
        });
      }
      function renderPlayers(players) { latestPlayers = players || []; redrawPlayerCanvas(); }

      // Fixed-size cross inside a --mi scale group: the output no longer depends
      // on zoom (the shared custom property handles size), so rebuild only when
      // the ping set itself changes.
      let pingsRendered = null;
      let pingsRenderedEpoch = -1;
      function renderPings(pings) {
        if (pings === pingsRendered && pingsRenderedEpoch === boundsEpoch) return;
        pingsRendered = pings;
        pingsRenderedEpoch = boundsEpoch;
        const g = qs('#g-pings');
        g.textContent = '';
        pingScaleGs = [];
        const half = PING_HALF_PX;
        const sw = PING_STROKE_PX;
        for (const p of (pings || [])) {
          const loc = p.Location || {};
          const pos = worldToLocal(loc.X || 0, loc.Y || 0);
          const cross = svgEl('g', { transform: `translate(${pos.x},${pos.y})` });
          const scaleG = newAuxScaleGroup(pingScaleGs);
          scaleG.appendChild(svgEl('line', { x1: -half, y1: -half, x2:  half, y2:  half, class: 'ping', 'stroke-width': sw }));
          scaleG.appendChild(svgEl('line', { x1: -half, y1:  half, x2:  half, y2: -half, class: 'ping', 'stroke-width': sw }));
          cross.appendChild(scaleG);
          const title = svgEl('title');
          title.textContent = `${p.PingType || 'Ping'} • ${p.OwnerId || ''}`;
          cross.appendChild(title);
          g.appendChild(cross);
        }
      }

      // Corner coordinates only change with bounds; rebuilding the four <text>
      // nodes on every rerender invalidated SVG layout on every snapshot
      // broadcast for nothing. Zoom-size compensation rides the shared --mi
      // scale group like the markers, so zoom does not touch these nodes either.
      let coordsKey = '';
      function renderBoundsCoords() {
        const g = qs('#g-coords');
        const key = bounds.hasData
          ? `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`
          : '';
        if (key === coordsKey) return;
        coordsKey = key;
        g.textContent = '';
        coordScaleGs = [];
        if (!bounds.hasData) return;
        const inset = 6;
        const fs = 11;
        const w = (bounds.maxX - bounds.minX) * PX_PER_CM;
        const h = (bounds.maxY - bounds.minY) * PX_PER_CM;
        // Anchor a scale group at each corner; the label offsets inside are
        // fixed pixels, counter-scaled by --mi.
        const corners = [
          { cx: 0, cy: 0, lx: inset,  ly: inset + fs, anchor: 'start', wx: bounds.maxX, wy: bounds.minY },
          { cx: w, cy: 0, lx: -inset, ly: inset + fs, anchor: 'end',   wx: bounds.maxX, wy: bounds.maxY },
          { cx: 0, cy: h, lx: inset,  ly: -inset,     anchor: 'start', wx: bounds.minX, wy: bounds.minY },
          { cx: w, cy: h, lx: -inset, ly: -inset,     anchor: 'end',   wx: bounds.minX, wy: bounds.maxY },
        ];
        for (const cc of corners) {
          const corner = svgEl('g', { transform: `translate(${cc.cx} ${cc.cy})` });
          const scaleG = newAuxScaleGroup(coordScaleGs);
          const t = svgEl('text', {
            x: cc.lx, y: cc.ly, 'text-anchor': cc.anchor, class: 'bound-coord', 'font-size': fs,
          });
          t.textContent = `${Math.round(cc.wx)}, ${Math.round(cc.wy)}`;
          scaleG.appendChild(t);
          corner.appendChild(scaleG);
          g.appendChild(corner);
        }
      }

      function flashTeleportMarker(lx, ly) {
        const g = qs('#g-cheat-fx');
        if (!g) return;
        const inv = state.scale > 0 ? (1 / state.scale) : 1;
        const ring = svgEl('circle', {
          cx: lx, cy: ly, r: 4 * inv, class: 'tp-flash', 'stroke-width': 1 * inv,
        });
        g.appendChild(ring);
        setTimeout(() => { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 700);
      }

      function pickAt(lx, ly) {
        if (!latestSnapshot || !bounds.hasData) return null;
        const inv = state.scale > 0 ? (1 / state.scale) : 1;
        const r = PICK_RADIUS_PX * inv;
        const r2 = r * r;
        const players = latestSnapshot.Players || [];
        for (const pl of players) {
          const p = worldToLocal((pl.Position && pl.Position.X) || 0, (pl.Position && pl.Position.Y) || 0);
          const dx = lx - p.x, dy = ly - p.y;
          if (dx * dx + dy * dy <= r2) return { type: 'player', entity: pl };
        }
        const pings = latestPings || [];
        for (const pg of pings) {
          const loc = pg.Location || {};
          const p = worldToLocal(loc.X || 0, loc.Y || 0);
          const dx = lx - p.x, dy = ly - p.y;
          if (dx * dx + dy * dy <= r2) return { type: 'ping', entity: pg };
        }
        const icons = latestSnapshot.Icons || [];
        for (const ic of icons) {
          const p = worldToLocal((ic.Position && ic.Position.X) || 0, (ic.Position && ic.Position.Y) || 0);
          const dx = lx - p.x, dy = ly - p.y;
          if (dx * dx + dy * dy <= r2) return { type: 'icon', entity: ic };
        }
        return null;
      }

      function expandRLE(entries, expectedLen) {
        const out = new Array(expectedLen | 0).fill(0);
        if (!Array.isArray(entries)) return out;
        let i = 0;
        for (const e of entries) {
          const v = (e && e.Value) | 0;
          let n = (e && e.Count) | 0;
          if (n <= 0) continue;
          if (i + n > expectedLen) n = expectedLen - i;
          for (let k = 0; k < n; k++) out[i + k] = v;
          i += n;
          if (i >= expectedLen) break;
        }
        return out;
      }

      function onTileGrid(p) {
        if (!p || !p.WorldSize || p.WorldSize <= 0) { tileGrid = null; heightTint = null; return; }
        const total = (p.WorldSize | 0) * (p.WorldSize | 0);
        tileGrid = {
          worldSize: p.WorldSize | 0,
          tileSize: p.TileSizeUnits || 0,
          minX: (p.MinBounds && p.MinBounds.X) || 0,
          minY: (p.MinBounds && p.MinBounds.Y) || 0,
          maxX: (p.MaxBounds && p.MaxBounds.X) || 0,
          maxY: (p.MaxBounds && p.MaxBounds.Y) || 0,
          palette: Array.isArray(p.BiomePalette) ? p.BiomePalette : [],
          colors:  Array.isArray(p.BiomeColors) ? p.BiomeColors : [],
          biomes:  expandRLE(p.BiomeRLE,  total),
          heights: expandRLE(p.HeightRLE, total),
          // Sky / Underground, for the cheat menu's teleport picker. A world
          // with no such layers yields zeroes, which reads as "not here" —
          // which is correct.
          skyHeights:   expandRLE(p.SkyHeightRLE, total),
          underHeights: expandRLE(p.UndergroundHeightRLE, total),
          layerMask:    expandRLE(p.LayerMaskRLE, total),
        };
        const HT = window.TSICHeightTint;
        heightTint = HT ? HT.build(p) : null;
        if (heightTint && HT) HT.prebuild(heightTint);
        updateHeightTintLayer();
        // Repaint markers so newly-arrived biome colours apply.
        if (ctx.isVisible() && latestSnapshot) rerenderSoon();
      }

      // Blit the cached tint canvas for the player's current level into the
      // overlay layer. The display canvas is 1px/tile; CSS stretches it over
      // the map with pixelated sampling (see setBounds).
      function updateHeightTintLayer() {
        const cvs = qs('#height-tint-tex');
        if (!cvs) return;
        const HT = window.TSICHeightTint;
        const src = (heightTint && HT) ? HT.getCanvas(heightTint, heightLevel) : null;
        if (!src) {
          if (cvs.width > 0) cvs.getContext('2d').clearRect(0, 0, cvs.width, cvs.height);
          return;
        }
        if (cvs.width !== src.width || cvs.height !== src.height) {
          cvs.width = src.width;
          cvs.height = src.height;
        }
        const c2d = cvs.getContext('2d');
        c2d.clearRect(0, 0, cvs.width, cvs.height);
        c2d.drawImage(src, 0, 0);
      }

      function tileAt(wx, wy) {
        if (!tileGrid || tileGrid.tileSize <= 0 || tileGrid.worldSize <= 0) return null;
        const N = Math.floor(wx / tileGrid.tileSize);
        const E = Math.floor(wy / tileGrid.tileSize);
        if (N < 0 || E < 0 || N >= tileGrid.worldSize || E >= tileGrid.worldSize) return null;
        const idx = N * tileGrid.worldSize + E;
        const paletteIdx = tileGrid.biomes[idx] | 0;
        const biomeName = (paletteIdx >= 0 && paletteIdx < tileGrid.palette.length)
          ? tileGrid.palette[paletteIdx]
          : '';
        const mask = tileGrid.layerMask[idx] | 0;
        return {
          index: idx, north: N, east: E, biome: biomeName,
          height: tileGrid.heights[idx] | 0,
          // bit0 = Sky walkable, bit1 = Underground walkable (FScpUIMapTileGrid).
          hasSky: (mask & 1) !== 0,
          hasUnderground: (mask & 2) !== 0,
          skyHeight: tileGrid.skyHeights[idx] | 0,
          underHeight: tileGrid.underHeights[idx] | 0,
        };
      }

      function humanizeBiome(name) {
        if (!name || /\s/.test(name)) return name || '';
        return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
      }

      function describeTile(wx, wy) {
        const t = tileAt(wx, wy);
        if (!t) return null;
        const lines = [];
        const biome = humanizeBiome(t.biome);
        if (biome) lines.push(biome);
        lines.push('Floor ' + t.height);
        // In teleport mode the other layers are the whole point, so spell out
        // whether they exist here and how far each is offset.
        if (teleportMode) {
          lines.push(t.hasSky ? ('Sky +' + t.skyHeight) : 'Sky —');
          lines.push(t.hasUnderground ? ('Underground -' + t.underHeight) : 'Underground —');
          lines.push('tile E' + t.east + ' N' + t.north);
        }
        lines.push('(' + Math.round(wx) + ', ' + Math.round(wy) + ')');
        return lines.join('\n');
      }

      // PlayerState names come through blank in a local/PIE session, and the
      // unique-id fallback is a bare net-id number ("0") — neither reads as a
      // name, so drop through to the in-fiction default rather than show digits.
      function playerLabel(e) {
        const name = String((e && e.Name) || '').trim();
        if (name && !/^\d+$/.test(name)) return name;
        const id = String((e && e.PlayerId) || '').trim();
        if (id && !/^\d+$/.test(id)) return id;
        return 'Customer';
      }

      function describePick(pick) {
        if (!pick) return null;
        const e = pick.entity;
        if (pick.type === 'player') {
          const x = Math.round((e.Position && e.Position.X) || 0);
          const y = Math.round((e.Position && e.Position.Y) || 0);
          // Name the biome they're standing on, same as hovering bare ground.
          const t = tileAt(x, y);
          const biome = t ? humanizeBiome(t.biome) : '';
          return [playerLabel(e), biome, `(${x}, ${y})`].filter(Boolean).join(' • ');
        }
        if (pick.type === 'ping') {
          const loc = e.Location || {};
          const x = Math.round(loc.X || 0);
          const y = Math.round(loc.Y || 0);
          return [e.PingType || 'Ping', e.OwnerId, `(${x}, ${y})`].filter(Boolean).join(' • ');
        }
        const x = Math.round((e.Position && e.Position.X) || 0);
        const y = Math.round((e.Position && e.Position.Y) || 0);
        return [e.Label, e.Category, `(${x}, ${y})`].filter(Boolean).join(' • ');
      }

      function hideHoverChip() { const chip = qs('#hover-chip'); if (chip) chip.style.display = 'none'; setPoiHover(false); }
      // Mirrors "the mouse is over a pickable POI" onto the viewport so the
      // custom cursor (shared/cursor.js) switches to its locked-on look. POIs
      // are hit-tested in code, so the cursor can't see them via DOM hover.
      function setPoiHover(on) {
        const vp = qs('#map-viewport');
        if (!vp) return;
        const want = !!on && !state.isPad;
        if (vp.hasAttribute('data-cursor-poi') === want) return;
        vp.toggleAttribute('data-cursor-poi', want);
        if (window.TSICCursor) window.TSICCursor.refresh();
      }
      // The fog overlay is visible unless the SetFogOfWarVisible cheat hid it.
      // When it's hidden (or fog is disabled), don't suppress hover.
      function fowOverlayVisible() {
        const img = qs('#fow-tex');
        return !!img && img.style.display !== 'none';
      }
      function updateHoverChip() {
        const chip = qs('#hover-chip');
        const vp = qs('#map-viewport');
        if (!chip || !vp || !bounds.hasData) { hideHoverChip(); return; }
        // The chip lives outside #map-content, so it draws OVER the fog veil —
        // it would happily label tiles and POIs the veil is busy hiding. The
        // per-cell fowGrid gate below can't cover this: it fails open until the
        // grid arrives, which is exactly the window the veil exists for.
        if (!fowReady()) { hideHoverChip(); return; }
        if (!(vpW > 0)) measureViewport();
        let cx, cy;
        if (state.isPad) { cx = vpW / 2; cy = vpH / 2; }
        else { if (state.mouseX < 0) { hideHoverChip(); return; } cx = state.mouseX; cy = state.mouseY; }
        const lx = (cx - state.panX) / state.scale;
        const ly = (cy - state.panY) / state.scale;
        const { wx, wy } = localToWorld(lx, ly);
        // Hide everything (tile info + POI/player/ping labels) over unexplored fog.
        const TF = window.TSICFow;
        const hoverFowGrid = teleportMode ? null : getFowGrid();
        if (hoverFowGrid && TF && fowOverlayVisible() && !TF.exploredAt(hoverFowGrid, wx, wy)) {
          hideHoverChip();
          return;
        }
        const pick = pickAt(lx, ly);
        setPoiHover(!!pick);
        let text = describePick(pick);
        if (!text) { text = describeTile(wx, wy); }
        if (!text) { hideHoverChip(); return; }
        chip.textContent = text;
        chip.style.display = 'block';
        const offset = state.isPad ? 18 : 12;
        let px = cx + offset, py = cy + offset;
        const w = chip.offsetWidth;
        const h = chip.offsetHeight;
        if (px + w > vpW) px = Math.max(0, cx - offset - w);
        if (py + h > vpH) py = Math.max(0, cy - offset - h);
        chip.style.left = px + 'px';
        chip.style.top  = py + 'px';
      }

      // rAF-coalesced rerender for high-frequency triggers (wheel ticks, held
      // gamepad triggers, repeated centerOnLocalPlayer). Each call queues at most
      // one rerender per frame instead of tearing down + rebuilding every SVG
      // icon, ping, and coord label on each event. applyTransform() still runs
      // synchronously so the visual pan/zoom is immediate; only the SVG redraw
      // is deferred. Callers that need the redraw observed in the same tick
      // (snapshot arrival, fitToBounds) continue to call rerender() directly.
      let rerenderQueued = false;
      function rerenderSoon() {
        if (rerenderQueued) return;
        rerenderQueued = true;
        requestAnimationFrame(() => {
          rerenderQueued = false;
          if (ctx.isVisible()) rerender();
        });
      }

      // Mousemove fires per pixel during pan/hover and each call hit pickAt
      // (linear scan over players + pings + icons) + offsetWidth/Height reads
      // (forced layout). Coalesce to one update per frame.
      let hoverChipQueued = false;
      function updateHoverChipSoon() {
        if (hoverChipQueued) return;
        hoverChipQueued = true;
        requestAnimationFrame(() => {
          hoverChipQueued = false;
          if (ctx.isVisible()) updateHoverChip();
        });
      }

      function rerender() {
        const p = latestSnapshot;
        const empty = qs('#empty');
        if (!p) {
          clearOverlaySvg();
          renderPlayers([]);
          hideHoverChip();
          empty.textContent = 'Waiting for map data…';
          empty.style.display = '';
          return;
        }
        if (!bounds.hasData) {
          clearOverlaySvg();
          renderPlayers([]);
          hideHoverChip();
          empty.textContent = 'Map bounds unavailable.';
          empty.style.display = '';
          return;
        }
        const hasAny = ((p.Icons || []).length + (p.Players || []).length) > 0;
        if (!hasAny) { empty.textContent = 'No map data.'; empty.style.display = ''; }
        else         { empty.style.display = 'none'; }
        renderIcons(p.Icons);
        renderPlayers(p.Players);
        renderPings(latestPings);
        renderBoundsCoords();
        updateHoverChip();
      }

      function onSnapshot(p) {
        latestSnapshot = p;
        if (p) setBounds(p.MinBounds, p.MaxBounds);
        // Players[0] is the local player; retint the height overlay when their
        // height level changes (elevators, stairs, ramps).
        const me = p && Array.isArray(p.Players) ? p.Players[0] : null;
        if (me && typeof me.HeightLevel === 'number' && me.HeightLevel !== heightLevel) {
          heightLevel = me.HeightLevel | 0;
          updateHeightTintLayer();
        }
        if (ctx.isVisible()) rerender();
      }
      function onPingSet(p) {
        latestPings = (p && p.Pings) || [];
        if (ctx.isVisible() && latestSnapshot) renderPings(latestPings);
      }

      // ---- mouse / wheel / keyboard --------------------------------
      let lastZoomSoundAt = 0;
      let dragging = false;
      let dragLastX = 0, dragLastY = 0;
      // Where the press started, so a teleport click isn't fired at the end of a pan.
      let pressX = 0, pressY = 0;
      const CLICK_SLOP_PX = 4;
      const vp = qs('#map-viewport');

      vp.addEventListener('mousedown', (ev) => {
        if (ev.button !== 0) return;
        if (ev.ctrlKey && !ev.shiftKey && !ev.altKey) {
          const rect = vp.getBoundingClientRect();
          const lx = (ev.clientX - rect.left - state.panX) / state.scale;
          const ly = (ev.clientY - rect.top  - state.panY) / state.scale;
          if (!bounds.hasData) return;
          const { wx, wy } = localToWorld(lx, ly);
          const X = Math.max(bounds.minX, Math.min(bounds.maxX, wx));
          const Y = Math.max(bounds.minY, Math.min(bounds.maxY, wy));
          ctx.publish('UI.Cmd.Cheat.Execute', { Command: `Teleport2D ${X.toFixed(0)} ${Y.toFixed(0)}` });
          if (window.tsic && window.tsic.playSound) window.tsic.playSound('Map.Teleport', 0.5);
          flashTeleportMarker(lx, ly);
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }
        dragging = true;
        dragLastX = ev.clientX;
        dragLastY = ev.clientY;
        pressX = ev.clientX;
        pressY = ev.clientY;
        vp.classList.add('dragging');
      });

      // Window-level mouse follows the drag even when the cursor leaves the
      // viewport. Gated on dragging so other overlays' interactions aren't
      // disturbed.
      window.addEventListener('mousemove', (ev) => {
        if (!dragging) return;
        state.panX += (ev.clientX - dragLastX);
        state.panY += (ev.clientY - dragLastY);
        dragLastX = ev.clientX;
        dragLastY = ev.clientY;
        applyTransform();
        repositionPlayers();
        updateHoverChipSoon();
      });
      window.addEventListener('mouseup', (ev) => {
        if (!dragging) return;
        dragging = false;
        vp.classList.remove('dragging');
        if (!teleportMode || !bounds.hasData) return;
        // A pan ends in a mouseup too; only a press that barely moved is a click.
        if (Math.abs(ev.clientX - pressX) > CLICK_SLOP_PX
         || Math.abs(ev.clientY - pressY) > CLICK_SLOP_PX) return;
        const rect = vp.getBoundingClientRect();
        if (ev.clientX < rect.left || ev.clientX > rect.right
         || ev.clientY < rect.top  || ev.clientY > rect.bottom) return;
        const lx = (ev.clientX - rect.left - state.panX) / state.scale;
        const ly = (ev.clientY - rect.top  - state.panY) / state.scale;
        const { wx, wy } = localToWorld(lx, ly);
        teleportToPoint(wx, wy);
        flashTeleportMarker(lx, ly);
      });

      // Layer buttons + exit. Bound once; the bar is hidden outside teleport mode.
      root.querySelectorAll('#tp-bar .tp-layer').forEach((b) => {
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          selectTeleportLayer(b.getAttribute('data-layer'));
        });
      });
      const tpDone = qs('#tp-done');
      if (tpDone) {
        tpDone.addEventListener('click', (ev) => {
          ev.stopPropagation();
          ctx.publish('UI.Cmd.Pause.CheatMenu', {});
        });
      }

      vp.addEventListener('wheel', (ev) => {
        ev.preventDefault();
        const rect = vp.getBoundingClientRect();
        const cx = ev.clientX - rect.left;
        const cy = ev.clientY - rect.top;
        const factor = ev.deltaY < 0 ? 1.1 : (1 / 1.1);
        const lx = (cx - state.panX) / state.scale;
        const ly = (cy - state.panY) / state.scale;
        const prevScale = state.scale;
        state.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.scale * factor));
        // Throttled + clamp-aware: a wheel spin fires many events, and at the
        // zoom limits nothing moves, so neither should make a sound.
        if (state.scale !== prevScale && Date.now() - lastZoomSoundAt > 70) {
          lastZoomSoundAt = Date.now();
          if (window.tsic && window.tsic.playSound) window.tsic.playSound('Map.Zoom.Step', 0.2);
        }
        state.panX = cx - lx * state.scale;
        state.panY = cy - ly * state.scale;
        applyTransform();
        rerenderSoon();
      }, { passive: false });

      // Suppress the browser context menu on the map; ping placement is driven
      // by the MapPlacePing hotkey (middle mouse) via the behavior system, not
      // by raw right-click.
      vp.addEventListener('contextmenu', (ev) => ev.preventDefault());

      // R = reset. Esc closes via screen-manager's cancelCmd (UI.Cmd.GameScreen.Close).
      window.addEventListener('keydown', (ev) => {
        if (!ctx.isVisible()) return;
        if (ev.key === 'r' || ev.key === 'R') {
          fitToBounds();
          if (window.tsic && window.tsic.playSound) window.tsic.playSound('Map.Reset', 0.35);
        }
      });

      // Resize: refit while visible.
      window.addEventListener('resize', () => { if (ctx.isVisible()) fitToBounds(); });

      vp.addEventListener('mousemove', (ev) => {
        const rect = vp.getBoundingClientRect();
        state.mouseX = ev.clientX - rect.left;
        state.mouseY = ev.clientY - rect.top;
        updateHoverChipSoon();
      });
      vp.addEventListener('mouseleave', () => {
        state.mouseX = -1;
        state.mouseY = -1;
        if (!state.isPad) hideHoverChip();
      });

      // ---- bridge subscriptions ------------------------------------
      const GAMEPAD_PAN_PX_PER_SEC = 800;
      function zoomBy(direction, dt) {
        if (!ctx.isVisible()) return;
        const factor = direction > 0 ? Math.pow(1.5, dt) : Math.pow(1 / 1.5, dt);
        const rect = vp.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const lx = (cx - state.panX) / state.scale;
        const ly = (cy - state.panY) / state.scale;
        state.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.scale * factor));
        state.panX = cx - lx * state.scale;
        state.panY = cy - ly * state.scale;
        applyTransform();
        rerenderSoon();
      }
      function centerOnLocalPlayer() {
        if (!ctx.isVisible() || !latestSnapshot || !bounds.hasData) return;
        const me = (latestSnapshot.Players || [])[0];
        if (!me || !me.Position) return;
        const loc = worldToLocal(me.Position.X || 0, me.Position.Y || 0);
        if (!(vpW > 0)) measureViewport();
        state.panX = vpW / 2 - loc.x * state.scale;
        state.panY = vpH / 2 - loc.y * state.scale;
        applyTransform();
        rerenderSoon();
      }
      function placePingAtCursorOrCenter() {
        if (!ctx.isVisible() || !bounds.hasData) return;
        const rect = vp.getBoundingClientRect();
        // Mouse (middle-click): drop the ping under the cursor. Gamepad has no
        // cursor (mouseX/Y reset to -1 on leave), so fall back to viewport center.
        const useCursor = state.mouseX >= 0 && state.mouseY >= 0;
        const cx = useCursor ? state.mouseX : rect.width / 2;
        const cy = useCursor ? state.mouseY : rect.height / 2;
        const lx = (cx - state.panX) / state.scale;
        const ly = (cy - state.panY) / state.scale;
        const { wx, wy } = localToWorld(lx, ly);
        const X = Math.max(bounds.minX, Math.min(bounds.maxX, wx));
        const Y = Math.max(bounds.minY, Math.min(bounds.maxY, wy));
        ctx.publish('UI.Cmd.Ping.Request', { PingType: 'Map', Location: { X, Y, Z: 0 } });
        if (window.tsic && window.tsic.playSound) window.tsic.playSound('Map.Ping', 0.45);
      }
      function panBy(dx, dy) {
        state.panX += dx;
        state.panY += dy;
        applyTransform();
        repositionPlayers();
        updateHoverChipSoon();
      }

      // Zoom via the behavior system is GAMEPAD-ONLY (zooms at viewport centre —
      // there's no cursor on a pad). The mouse wheel is also bound to these
      // hotkeys (HK_MapZoomIn/Out → MouseScrollUp/Down), but the wheel already
      // has a cursor-anchored DOM handler below; letting the behavior path also
      // fire made every wheel tick zoom twice (once at the cursor, once at the
      // centre) and fight itself. Gate on isPad so only one path runs per input.
      const zoomStep = (e, dir) => {
        if (!state.isPad) return;
        if (e.Phase === 'Started' || e.Phase === 'Triggered') zoomBy(dir, e.ElapsedSec || 0.12);
      };
      ctx.on('tsic.msg.UI.Behavior.MapZoomIn',  (e) => zoomStep(e, +1));
      ctx.on('tsic.msg.UI.Behavior.MapZoomOut', (e) => zoomStep(e, -1));
      ctx.on('tsic.msg.UI.Behavior.MapCenter',     (e) => { if (e.Phase === 'Started') centerOnLocalPlayer(); });
      ctx.on('tsic.msg.UI.Behavior.MapPlacePing',  (e) => { if (e.Phase === 'Started') placePingAtCursorOrCenter(); });
      // Same contract as keyboard 'R': fit the whole map. (This previously
      // guarded on an undefined `resetView` and silently no-oped on gamepad.)
      ctx.on('tsic.msg.UI.Behavior.MapResetView',  (e) => {
        if (e.Phase !== 'Started') return;
        fitToBounds();
        if (window.tsic && window.tsic.playSound) window.tsic.playSound('Map.Reset', 0.35);
      });
      ctx.on('tsic.msg.UI.Behavior.MapMove', (e) => {
        if (!ctx.isVisible() || e.Phase !== 'Axis') return;
        const dt = (1 / 60);
        panBy(-e.Value.X * GAMEPAD_PAN_PX_PER_SEC * dt,
               e.Value.Y * GAMEPAD_PAN_PX_PER_SEC * dt);
      });
      ctx.on('tsic.msg.UI.Map.Snapshot', onSnapshot);
      ctx.on('tsic.msg.UI.Map.TileGrid', onTileGrid);
      ctx.on('tsic.msg.UI.Ping.Set', onPingSet);
      ctx.on('tsic.msg.UI.Map.Fow', onFowBroadcast);
      ctx.on('tsic.msg.UI.Map.FowGrid', (p) => {
        // Keep the RAW payload and rebuild lazily. build() walks every explored row,
        // so doing it here ran a cost proportional to total exploration on every fog
        // regen for the rest of the session — on the CEF renderer's main thread, the
        // one serving mouse and clicks — even with the map closed. The texture refetch
        // three lines up was already visibility-gated; this was the hole beside it.
        // Only the hover chip reads the grid, and only while the map is on screen.
        fowGridRaw = p;
        fowGrid = null;
        // FowGrid ships with every fog regen, so it proves fog is in play even
        // if the texture message was missed.
        fowExpected = true;
        applyFowGate();
        if (ctx.isVisible()) updateHoverChip();
      });
      ctx.on('tsic.msg.Cheats.Map.Fow.Visibility', (p) => {
        const cvs = qs('#fow-tex');
        if (!cvs) return;
        cvs.style.display = (p && p.bVisible === false) ? 'none' : '';
        applyFowGate();
        // Both hover gates (the veil gate and the per-cell fowGrid gate) key off
        // this flag, so the chip has to be recomputed rather than waiting for the
        // next mouse move.
        if (ctx.isVisible()) updateHoverChip();
      });
      ctx.on('tsic.debug.Map.Overlay', (p) => {
        if (!p || !p.Layer) return;
        const id = p.Layer === 'height' ? 'debug-height-tex'
                 : p.Layer === 'maze'   ? 'debug-maze-tex'
                 : p.Layer === 'all'    ? 'debug-all-tex'
                 : null;
        if (!id) return;
        const img = qs('#' + id);
        if (!img) return;
        if (p.Visible) {
          const base = id === 'debug-height-tex' ? TSIC.runtimeImgUrl('world-debug-height')
                     : id === 'debug-maze-tex'   ? TSIC.runtimeImgUrl('world-debug-maze')
                     : id === 'debug-all-tex'    ? TSIC.runtimeImgUrl('world-debug-all')
                     : null;
          if (!base) return;
          img.src = base + '?t=' + Date.now();
          img.style.display = 'block';
        } else {
          img.style.display = 'none';
        }
      });
      ctx.on('tsic.msg.UI.Input.Mode.Changed', (p) => {
        const isPad = !!(p && (p.Device === 'gamepad' || p.Mode === 'Gamepad'));
        state.isPad = isPad;
        vp.classList.toggle('pad-cursor', isPad);
        updateHoverChip();
      });

      let cheatEnabled = false;
      function updateHint() {
        const h = qs('#hint');
        if (!h) return;
        const base = h.getAttribute('data-base') || h.textContent;
        h.textContent = cheatEnabled ? base + ' · Ctrl+Click = teleport (cheats)' : base;
      }
      ctx.on('tsic.msg.UI.Cheat.Catalog', () => { cheatEnabled = true; updateHint(); });

      // Veil until fog pixels land (sticky UI.Map.Fow above may already have
      // kicked the fetch off), and give up on fog if no broadcast ever arrives.
      applyFowGate();
      setTimeout(() => {
        fowGraceExpired = true;
        applyFowGate();
      }, FOW_ASSUME_OFF_MS);

      // onShow() runs outside this closure; hand it the per-mount refresh.
      teleportModeHook = setTeleportMode;
      onShowHook = () => {
        // A fresh open re-arms the retry ladder: a session that gave up on the
        // fog source earlier should try again rather than stay unfogged forever.
        // fowFetchGaveUp stays latched so the veil doesn't flicker back on.
        fowRetries = 0;
        if (fowStale || (fowExpected && !fowPainted && !fowInFlight)) reloadFow();
        applyFowGate();
      };

      buildLegend();
    },

    onShow(params /*, ctx */) {
      if (window.tsic && window.tsic.playSound) window.tsic.playSound('Map.Open', 0.4);
      // The cheat menu opens us as {"mode":"teleport"}; the map hotkey sends
      // nothing, which must land back in the normal read-only map even if the
      // picker was used earlier in the session.
      const p = params || {};
      if (teleportModeHook) teleportModeHook(p.mode === 'teleport', p.player);
      if (onShowHook) onShowHook();
      // Force a refit on show so the map fills the viewport correctly after
      // any prior overlay's display:none changed layout dimensions.
      // Defer to next frame so the container has actual rect dimensions.
      const root = document.querySelector('#screen-overlay-host [data-screen="Map"]');
      if (!root) return;
      requestAnimationFrame(() => {
        const vp = root.querySelector('#map-viewport');
        if (vp) vp.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('resize'));
      });
    },

    onHide(/* ctx */) {
      if (window.tsic && window.tsic.playSound) window.tsic.playSound('Map.Close', 0.4);
      // Never leave the fog override latched — the next opener may be the normal map.
      if (teleportModeHook) teleportModeHook(false, 1);
    },
  });
})();
