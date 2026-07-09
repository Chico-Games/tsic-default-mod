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
      font-family: 'Consolas', monospace;
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
    [data-screen="Map"] #map-viewport { flex: 1 1 auto; position: relative; overflow: hidden; cursor: grab; }
    [data-screen="Map"] #map-viewport.dragging { cursor: grabbing; }
    [data-screen="Map"] #map-content {
      position: absolute; left: 0; top: 0;
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
    [data-screen="Map"] #debug-height-tex, [data-screen="Map"] #debug-maze-tex {
      position: absolute; left: 0; top: 0;
      pointer-events: none; user-select: none; -webkit-user-drag: none;
    }
    [data-screen="Map"] #world-tex          { z-index: 1; image-rendering: pixelated; }
    [data-screen="Map"] #debug-height-tex   { z-index: 2; }
    [data-screen="Map"] #debug-maze-tex     { z-index: 3; }
    [data-screen="Map"] #debug-all-tex      { z-index: 4; }
    [data-screen="Map"] #fow-tex            { z-index: 5; }
    [data-screen="Map"] #overlay            { z-index: 6; }
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
    [data-screen="Map"] .ic-cluster-text { fill: #ffffff; font-family: 'Consolas', monospace; font-size: 14px; }
    [data-screen="Map"] #world-bounds {
      fill: none; stroke: #5a4a30; stroke-width: 2;
      vector-effect: non-scaling-stroke; pointer-events: none;
    }
    [data-screen="Map"] .bound-coord {
      fill: rgba(90, 74, 48, 0.85);
      font-family: 'Consolas', monospace;
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
      font-family: 'Consolas', monospace;
      font-size: 12px;
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
      <div id="map-viewport" data-cursor="map">
        <div id="map-content">
          <img id="world-tex" src="/runtime/world-map.imgsrc">
          <img id="debug-height-tex" src="/runtime/world-debug-height.imgsrc">
          <img id="debug-maze-tex"   src="/runtime/world-debug-maze.imgsrc">
          <img id="debug-all-tex"    src="/runtime/world-debug-all.imgsrc">
          <img id="fow-tex"   src="/runtime/fow.imgsrc">
          <svg id="overlay" xmlns="http://www.w3.org/2000/svg">
            <rect id="world-bounds" x="0" y="0" width="0" height="0"></rect>
            <g id="g-icons"></g>
            <g id="g-pings"></g>
            <g id="g-coords"></g>
            <g id="g-cheat-fx"></g>
          </svg>
        </div>
        <div id="empty">Waiting for map data…</div>
        <canvas id="player-canvas"></canvas>
        <div id="pad-cursor"></div>
        <div id="hover-chip"></div>
      </div>
      <div id="legend">
        <span id="hint" data-base="drag = pan · wheel = zoom · R = reset · Esc = close · RMB = ping · WebUI.Map.DebugHeight / DebugMazeRegions">drag = pan · wheel = zoom · R = reset · Esc = close · RMB = ping · WebUI.Map.DebugHeight / DebugMazeRegions</span>
      </div>
    </div>
  `;

  function injectStyleOnce() {
    if (document.getElementById('screen-map-style')) return;
    const s = document.createElement('style');
    s.id = 'screen-map-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  TSIC.registerScreen('Map', {
    inputModeTag: 'InputMode.Menu.Map',
    cancelCmd: 'UI.Cmd.GameScreen.Close',
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
      let latestSnapshot = null;
      let latestPings = null;
      let tileGrid = null;
      // Fog-of-war hover gate. Built from UI.Map.FowGrid (see shared/fow-lookup.js).
      // null = no fog data yet → fail open (never suppress the hover panel).
      let fowGrid = null;
      let latestPlayers = [];

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
      function updateMinScale() {
        const vp = qs('#map-viewport');
        if (!bounds.hasData || !vp) return;
        const widthCm  = (bounds.maxY - bounds.minY) * PX_PER_CM;
        const heightCm = (bounds.maxX - bounds.minX) * PX_PER_CM;
        if (widthCm <= 0 || heightCm <= 0) return;
        const sx = vp.clientWidth  / widthCm;
        const sy = vp.clientHeight / heightCm;
        MIN_SCALE = Math.min(sx, sy) * 0.95;
      }
      function fitToBounds() {
        const vp = qs('#map-viewport');
        if (!bounds.hasData || !vp) return;
        const widthCm  = (bounds.maxY - bounds.minY) * PX_PER_CM;
        const heightCm = (bounds.maxX - bounds.minX) * PX_PER_CM;
        if (widthCm <= 0 || heightCm <= 0) return;
        const sx = vp.clientWidth  / widthCm;
        const sy = vp.clientHeight / heightCm;
        const fitScale = Math.min(sx, sy) * 0.95;
        MIN_SCALE = fitScale;
        state.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fitScale * DEFAULT_ZOOM_MULT));
        // Center on the local player when known; otherwise center the whole map.
        const me = latestSnapshot && (latestSnapshot.Players || [])[0];
        if (me && me.Position) {
          const loc = worldToLocal(me.Position.X || 0, me.Position.Y || 0);
          state.panX = vp.clientWidth  / 2 - loc.x * state.scale;
          state.panY = vp.clientHeight / 2 - loc.y * state.scale;
        } else {
          state.panX = (vp.clientWidth  - widthCm  * state.scale) / 2;
          state.panY = (vp.clientHeight - heightCm * state.scale) / 2;
        }
        applyTransform();
        if (latestSnapshot) rerender();
      }
      function setBounds(minB, maxB) {
        const minX = minB && typeof minB.X === 'number' ? minB.X : 0;
        const minY = minB && typeof minB.Y === 'number' ? minB.Y : 0;
        const maxX = maxB && typeof maxB.X === 'number' ? maxB.X : 0;
        const maxY = maxB && typeof maxB.Y === 'number' ? maxB.Y : 0;
        const changed = bounds.minX !== minX || bounds.minY !== minY
                     || bounds.maxX !== maxX || bounds.maxY !== maxY;
        bounds = { minX, minY, maxX, maxY, hasData: (maxX - minX) > 0 && (maxY - minY) > 0 };
        if (changed && bounds.hasData) {
          const c = qs('#map-content');
          const w = (bounds.maxY - bounds.minY) * PX_PER_CM;
          const h = (bounds.maxX - bounds.minX) * PX_PER_CM;
          const pad = Math.round(Math.min(w, h) * 0.04);
          c.style.padding = `${pad}px`;
          c.style.width  = `${w}px`;
          c.style.height = `${h}px`;
          for (const id of ['world-tex', 'fow-tex', 'debug-height-tex', 'debug-maze-tex', 'debug-all-tex']) {
            const img = qs('#' + id);
            if (!img) continue;
            img.style.width  = `${w}px`;
            img.style.height = `${h}px`;
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

      // Fog gate for markers: hide icons over unexplored fog, mirroring the hover
      // panel. Fail-open when there's no fog data or the fog overlay is hidden.
      function iconVisibleInFog(wx, wy) {
        const TF = window.TSICFow;
        if (!fowGrid || !TF || !fowOverlayVisible()) return true;
        return TF.exploredAt(fowGrid, wx, wy);
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
      // A distinct shape per icon category so type reads without relying on colour.
      // spawn = star, teleporter = diamond, deathbox = cross, landmark = circle,
      // other = square.
      function markerShape(category, cx, cy, r) {
        const c = (category || '').toLowerCase();
        if (c === 'landmark') return svgEl('circle', { cx: cx, cy: cy, r: r });
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

      const CLUSTER_SCREEN_PX = 32;
      function clusterIcons(icons) {
        if (state.scale >= 0.5) return { clusters: [], singletons: icons || [] };
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
            clusters.push({ x: cx / group.length, y: cy / group.length, count: group.length });
          }
        }
        return { clusters, singletons };
      }

      function renderIcons(icons) {
        const g = qs('#g-icons');
        g.textContent = '';
        const inv = state.scale > 0 ? (1 / state.scale) : 1;
        const r = ICON_PX * inv;
        const sw = 1.5 * inv;
        // Hide markers sitting on unexplored fog before clustering, so cluster
        // counts only reflect what the player has actually discovered.
        const visible = (icons || []).filter((ic) =>
          iconVisibleInFog((ic.Position && ic.Position.X) || 0, (ic.Position && ic.Position.Y) || 0));
        const { clusters, singletons } = clusterIcons(visible);
        for (const ic of singletons) {
          const wx = (ic.Position && ic.Position.X) || 0;
          const wy = (ic.Position && ic.Position.Y) || 0;
          const pos = worldToLocal(wx, wy);
          const c = (ic.Category || '').toLowerCase();
          const isClickable = c === 'fasttravel' && (ic.EntityId | 0) > 0;
          const shape = markerShape(ic.Category, pos.x, pos.y, r);
          shape.setAttribute('class', `ic ${categoryClass(ic.Category)}${isClickable ? ' clickable' : ''}`);
          shape.setAttribute('stroke', '#231f18');
          shape.setAttribute('stroke-width', sw);
          // Landmarks are POI-biome markers — tint them with the biome's map colour.
          if (c === 'landmark') {
            const biomeCol = biomeColorAt(wx, wy);
            if (biomeCol) shape.setAttribute('fill', biomeCol);
          }
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
        }
        const clusterR = ICON_PX * 1.5 * inv;
        for (const cl of clusters) {
          const pos = worldToLocal(cl.x, cl.y);
          const circle = svgEl('circle', {
            cx: pos.x, cy: pos.y, r: clusterR,
            class: 'ic-cluster', 'stroke-width': sw,
          });
          const text = svgEl('text', {
            x: pos.x, y: pos.y + 5 * inv,
            'text-anchor': 'middle', class: 'ic-cluster-text',
            'font-size': 14 * inv,
          });
          text.textContent = String(cl.count);
          const title = svgEl('title');
          title.textContent = `${cl.count} POIs (zoom in to expand)`;
          g.appendChild(circle);
          g.appendChild(text);
          circle.appendChild(title);
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
        const vp = qs('#map-viewport');
        const w = vp.clientWidth;
        const h = vp.clientHeight;
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
      function repositionPlayers() { redrawPlayerCanvas(); }
      function renderPlayers(players) { latestPlayers = players || []; redrawPlayerCanvas(); }

      function renderPings(pings) {
        const g = qs('#g-pings');
        g.textContent = '';
        const inv = state.scale > 0 ? (1 / state.scale) : 1;
        const half = PING_HALF_PX * inv;
        const sw = PING_STROKE_PX * inv;
        for (const p of (pings || [])) {
          const loc = p.Location || {};
          const pos = worldToLocal(loc.X || 0, loc.Y || 0);
          const cross = svgEl('g', { transform: `translate(${pos.x},${pos.y})` });
          cross.appendChild(svgEl('line', { x1: -half, y1: -half, x2:  half, y2:  half, class: 'ping', 'stroke-width': sw }));
          cross.appendChild(svgEl('line', { x1: -half, y1:  half, x2:  half, y2: -half, class: 'ping', 'stroke-width': sw }));
          const title = svgEl('title');
          title.textContent = `${p.PingType || 'Ping'} • ${p.OwnerId || ''}`;
          cross.appendChild(title);
          g.appendChild(cross);
        }
      }

      function renderBoundsCoords() {
        const g = qs('#g-coords');
        g.textContent = '';
        if (!bounds.hasData) return;
        const inv = state.scale > 0 ? (1 / state.scale) : 1;
        const inset = 6 * inv;
        const fs = 11 * inv;
        const w = (bounds.maxX - bounds.minX) * PX_PER_CM;
        const h = (bounds.maxY - bounds.minY) * PX_PER_CM;
        const corners = [
          { lx: inset,     ly: inset + fs,  anchor: 'start', wx: bounds.maxX, wy: bounds.minY },
          { lx: w - inset, ly: inset + fs,  anchor: 'end',   wx: bounds.maxX, wy: bounds.maxY },
          { lx: inset,     ly: h - inset,   anchor: 'start', wx: bounds.minX, wy: bounds.minY },
          { lx: w - inset, ly: h - inset,   anchor: 'end',   wx: bounds.minX, wy: bounds.maxY },
        ];
        for (const cc of corners) {
          const t = svgEl('text', {
            x: cc.lx, y: cc.ly, 'text-anchor': cc.anchor, class: 'bound-coord', 'font-size': fs,
          });
          t.textContent = `${Math.round(cc.wx)}, ${Math.round(cc.wy)}`;
          g.appendChild(t);
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
        if (!p || !p.WorldSize || p.WorldSize <= 0) { tileGrid = null; return; }
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
        };
        // Repaint markers so newly-arrived biome colours apply.
        if (ctx.isVisible() && latestSnapshot) rerenderSoon();
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
        return { index: idx, north: N, east: E, biome: biomeName, height: tileGrid.heights[idx] | 0 };
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
        lines.push('(' + Math.round(wx) + ', ' + Math.round(wy) + ')');
        return lines.join('\n');
      }

      function describePick(pick) {
        if (!pick) return null;
        const e = pick.entity;
        if (pick.type === 'player') {
          const x = Math.round((e.Position && e.Position.X) || 0);
          const y = Math.round((e.Position && e.Position.Y) || 0);
          return `${e.Name || e.PlayerId || 'Player'} • (${x}, ${y})`;
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
        let cx, cy;
        if (state.isPad) { cx = vp.clientWidth / 2; cy = vp.clientHeight / 2; }
        else { if (state.mouseX < 0) { hideHoverChip(); return; } cx = state.mouseX; cy = state.mouseY; }
        const lx = (cx - state.panX) / state.scale;
        const ly = (cy - state.panY) / state.scale;
        const { wx, wy } = localToWorld(lx, ly);
        // Hide everything (tile info + POI/player/ping labels) over unexplored fog.
        const TF = window.TSICFow;
        if (fowGrid && TF && fowOverlayVisible() && !TF.exploredAt(fowGrid, wx, wy)) {
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
        if (px + w > vp.clientWidth)  px = Math.max(0, cx - offset - w);
        if (py + h > vp.clientHeight) py = Math.max(0, cy - offset - h);
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
          qs('#g-icons').textContent = '';
          qs('#g-pings').textContent = '';
          qs('#g-coords').textContent = '';
          renderPlayers([]);
          hideHoverChip();
          empty.textContent = 'Waiting for map data…';
          empty.style.display = '';
          return;
        }
        if (!bounds.hasData) {
          qs('#g-icons').textContent = '';
          qs('#g-pings').textContent = '';
          qs('#g-coords').textContent = '';
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
        if (ctx.isVisible()) rerender();
      }
      function onPingSet(p) {
        latestPings = (p && p.Pings) || [];
        if (ctx.isVisible() && latestSnapshot) renderPings(latestPings);
      }

      // ---- mouse / wheel / keyboard --------------------------------
      let dragging = false;
      let dragLastX = 0, dragLastY = 0;
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
          flashTeleportMarker(lx, ly);
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }
        dragging = true;
        dragLastX = ev.clientX;
        dragLastY = ev.clientY;
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
      window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        vp.classList.remove('dragging');
      });

      vp.addEventListener('wheel', (ev) => {
        ev.preventDefault();
        const rect = vp.getBoundingClientRect();
        const cx = ev.clientX - rect.left;
        const cy = ev.clientY - rect.top;
        const factor = ev.deltaY < 0 ? 1.1 : (1 / 1.1);
        const lx = (cx - state.panX) / state.scale;
        const ly = (cy - state.panY) / state.scale;
        state.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, state.scale * factor));
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
        if (ev.key === 'r' || ev.key === 'R') fitToBounds();
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
        state.panX = vp.clientWidth  / 2 - loc.x * state.scale;
        state.panY = vp.clientHeight / 2 - loc.y * state.scale;
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
      ctx.on('tsic.msg.UI.Behavior.MapResetView',  (e) => { if (e.Phase === 'Started' && typeof resetView === 'function') resetView(); });
      ctx.on('tsic.msg.UI.Behavior.MapMove', (e) => {
        if (!ctx.isVisible() || e.Phase !== 'Axis') return;
        const dt = (1 / 60);
        panBy(-e.Value.X * GAMEPAD_PAN_PX_PER_SEC * dt,
               e.Value.Y * GAMEPAD_PAN_PX_PER_SEC * dt);
      });
      ctx.on('tsic.msg.UI.Map.Snapshot', onSnapshot);
      ctx.on('tsic.msg.UI.Map.TileGrid', onTileGrid);
      ctx.on('tsic.msg.UI.Ping.Set', onPingSet);
      ctx.on('tsic.msg.UI.Map.Fow', () => {
        const img = qs('#fow-tex');
        if (img) img.src = TSIC.runtimeImgUrl('fow') + '?t=' + Date.now();
      });
      ctx.on('tsic.msg.UI.Map.FowGrid', (p) => {
        fowGrid = window.TSICFow ? window.TSICFow.build(p) : null;
        if (ctx.isVisible()) updateHoverChip();
      });
      ctx.on('tsic.msg.Cheats.Map.Fow.Visibility', (p) => {
        const img = qs('#fow-tex');
        if (!img) return;
        img.style.display = (p && p.bVisible === false) ? 'none' : '';
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

      buildLegend();
    },

    onShow(/* params, ctx */) {
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
  });
})();
