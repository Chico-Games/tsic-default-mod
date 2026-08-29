// shared/store-maze.js — diagonal sweep-morph store-maze background motif.
//
// A viewport-filling perfect maze (recursive backtracker over a cell grid)
// drawn as straight printed-ink lines. Every cycle a leaned, wavy front
// crosses the screen and leaves a freshly generated plan behind it: walls
// shrink/grow about their midpoints as the front passes, then the new plan
// rests before the next sweep comes back the other way at a new lean angle.
//
// A handful of "shopper" dots wander the aisles at a stroll, leaving short
// fading dotted footprint trails. Shoppers treat half-morphed walls as
// solid, so nobody walks through a wall that is still growing in — and
// every boundary a shopper walks through is carved out of the incoming
// plan (and re-carved into each freshly generated plan while the trail
// lasts), so a sweep never drops a wall across a visible footprint trail.
// The carved walls merely add a loop to the new plan, invisible at
// backdrop density.
//
// Rendering (perf): walls are NOT re-stroked every frame. Each plan's walls
// live on an offscreen layer canvas. During REST the frame is one blit plus
// the shoppers. During a SWEEP, provably-pure regions ahead of and behind
// the front blit from the layers under straight conservative clips; only
// walls inside the morph band are stroked live with the exact per-wall
// wobble, and the band is reached by bucket lookup into a wall table ordered
// by sweep projection (rebuilt per cycle) rather than by rescanning the grid.
// The rAF loop is throttled to maxFps — a backdrop does not need 60.
//
// Every change here was checked by rendering the same seeded frames in Chrome
// before and after and diffing the pixels; the module is bit-identical to its
// pre-optimisation output. See drawWalkers() for the one idea that failed that
// test.
//
// prefers-reduced-motion is intentionally NOT honored: this is a game menu
// backdrop, and OS-level "disable animations" (common on RDP/dev boxes)
// leaks into CEF and would silently freeze it. The GAME setting is honored
// instead — TSIC.onReduceMotion (shared/reduce-motion.js) freezes the backdrop
// on a resting plan, shoppers included, and thaws it if the player turns the
// setting back off. Pages that never load reduce-motion.js keep full motion.
//
// Intended as an ambient backdrop for menu screens. Styled to the magazine
// look (see shared/base.css tokens): ink-printed walls and ink shoppers,
// drawn over a TRANSPARENT canvas by default so the motif sits on whatever
// paper stage the host page provides (tsic-stage--magazine et al). Pass
// opts.bg to paint an opaque backdrop instead. Self-contained canvas — no
// message channels, no external assets.
//
// API:
//   var handle = TSICStoreMaze.mount(container, opts);  // opts optional, see DEFAULTS
//   TSICStoreMaze.unmount(handle);
(function (global) {
  'use strict';

  var DEFAULTS = {
    cellSize: 24,          // px per maze cell
    pad: 2,                // overscan cells beyond each viewport edge, so the
                           // open perimeter (no border walls) stays off-screen
                           // and the plan reads as endless
    bg: null,              // null = transparent (host page's stage shows through)
    wall: 'rgba(10, 10, 10, 0.45)',   // --ink-night, printed-plan weight
    ink: 'rgba(10, 10, 10, 0.9)',     // --ink-night shoppers
    wallWidth: 2.5,
    sweepMs: 12000,        // front travel time across the screen
    restMs: 6000,          // hold time between sweeps
    band: 110,             // morph band depth along the sweep direction, px
    walkerArea: 260000,    // px² of viewport per shopper (bigger = fewer)
    walkerMax: 9,
    walkerSpeed: 17,       // px/s along corridors — an unhurried browse
    trailLen: 14,          // footprint dots kept per shopper
    trailSpacing: 7,       // px between footprint dots
    dotRadius: 2.4,        // shopper head radius (footprints are smaller)
    // Frame cap. Keep this >= 60: CEF's off-screen capture samples the WHOLE
    // page at the dominant animation's cadence, so a 30fps backdrop makes the
    // cursor and every hover/transition on the page render at 30fps too.
    maxFps: 60,
    renderScale: 0.75,     // canvas backing-store scale; upscaled via CSS —
                           // the soft ink look tolerates sub-native res and
                           // it cuts raster cost quadratically
  };

  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];   // N E S W

  // Candidate lists for the maze carve, keyed by a 4-bit N/E/S/W open mask.
  // CAND_N[mask] is how many neighbours are open; CAND_D[mask] packs their
  // direction indices two bits each, in the same ascending order the old
  // per-direction loop appended them — so a given mask and random draw pick the
  // same direction as before.
  var CAND_N = new Uint8Array(16), CAND_D = new Uint8Array(16);
  (function () {
    for (var m = 0; m < 16; m++) {
      var n = 0, packed = 0;
      for (var d = 0; d < 4; d++) {
        if (m & (1 << d)) { packed |= d << (n << 1); n++; }
      }
      CAND_N[m] = n; CAND_D[m] = packed;
    }
  })();

  function opp(d) { return (d + 2) & 3; }
  function ease(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }

  function mount(container, opts) {
    if (!container) return null;
    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (var ok in (opts || {})) if (ok in DEFAULTS) o[ok] = opts[ok];
    var CS = o.cellSize;
    var RS = o.renderScale;
    var TRAIL_SPACING2 = o.trailSpacing * o.trailSpacing;

    var cv = document.createElement('canvas');
    cv.className = 'store-maze-canvas';
    cv.style.position = 'absolute';
    cv.style.inset = '0';
    cv.style.display = 'block';
    container.appendChild(cv);
    var ctx = cv.getContext('2d');

    var W, H, cols, rows;
    var A, B;                 // outgoing / incoming plan (wall arrays)
    var layerA = null, layerB = null;
    var cyc = null;           // current sweep personality
    var t0 = 0;               // cycle start (0 = set on next frame)
    var u = 1;                // sweep progress; 1 = resting on plan B
    var flip = false;         // alternates the sweep's overall direction
    var walkers = [];
    var alive = true, frozen = false, rafId = 0, rsTimer = 0, lastDraw = -1e9, lastNow = 0;
    // Walls ordered by their projection onto the current sweep direction — see
    // buildWallOrder(). Rebuilt once per cycle; the frame loop reads the band
    // straight out of it instead of rescanning every wall in the grid.
    var wS = null, wK = null, wX = null, wY = null;
    var bucketStart = null, bucketCount = 0;
    // Per-wall wob() memo, filled lazily as the band reaches each wall (see the
    // sweep branch of frame()) and invalidated per cycle.
    var wWob = null, wDone = null;
    // Scratch for buildWallOrder's counting sort, and the two rotating plan /
    // layer slots. Everything the rollover needs is allocated once per size, not
    // once per cycle: the rollover frame is the only frame in the animation that
    // was ever near budget, and a fresh Uint8Array pair plus a fresh 1440x810
    // canvas every 18s is both allocation cost and GC pressure landing squarely
    // on it.
    var scrCount = null, scrCursor = null;
    var mzVisited = null, mzStack = null;

    var planPool = [null, null], planSlot = 0;
    var layerPool = [null, null], layerSlot = 0;

    function inB(x, y) { return x >= 0 && y >= 0 && x < cols && y < rows; }
    // Flat indices into a plan's wall grids.
    function vi(x, y) { return y * (cols + 1) + x; }
    function hi(x, y) { return y * cols + x; }

    // ---- plans ----
    // V[vi(x,y)] wall between cells (x-1,y)|(x,y), x in 1..cols-1;
    // H[hi(x,y)] wall between (x,y-1)|(x,y), y in 1..rows-1. Perimeter open.
    // Flat Uint8Arrays, not arrays-of-arrays: the sweep reads both plans for
    // every wall it draws, every frame, and the double indirection is the
    // hottest read in the loop.
    // Carves a plan into the next pooled slot. Two slots is all that is ever
    // live: at a rollover the outgoing A is dropped, so the incoming B can be
    // carved straight back into the buffers A used to own.
    function genMaze() {
      var w = planPool[planSlot];
      planSlot ^= 1;
      w.V.fill(1);
      w.H.fill(1);
      // The visited grid carries a one-cell border of permanently-visited
      // sentinels, so the four neighbour tests need no bounds check: an off-grid
      // read lands on the border and declines exactly as a visited cell would.
      // Same four tests in the same order, so the candidate list — and with it
      // the random draw — is unchanged. This loop runs ~8k times per plan and
      // used to make four inB() and four idx() calls each time; it was two
      // thirds of the rollover frame, the only frame here near budget.
      var P = cols + 2, VW = cols + 1;
      var vis = mzVisited;
      vis.fill(1);
      for (var ry = 0; ry < rows; ry++) {
        var rowStart = (ry + 1) * P + 1;
        vis.fill(0, rowStart, rowStart + cols);
      }
      var sx = (Math.random() * cols) | 0, sy = (Math.random() * rows) | 0;
      vis[(sy + 1) * P + sx + 1] = 1;
      // Flat (x,y)-interleaved stack. Every cell is pushed exactly once — it is
      // marked visited on push — so cols*rows pairs is the true bound. The old
      // array-of-pairs allocated one throwaway array per cell, ~4k per plan.
      // Everything the loop touches is hoisted into a local: cols, DX/DY and
      // w.V/w.H are context-slot or property loads otherwise, and this body runs
      // ~8k times.
      var stack = mzStack, WV = w.V, WH = w.H, CW = cols, dxs = DX, dys = DY;
      var rnd = Math.random;
      var sp = 0;
      stack[sp++] = sx; stack[sp++] = sy;
      while (sp > 0) {
        var tx = stack[sp - 2], ty = stack[sp - 1];
        var tp = (ty + 1) * P + tx + 1;
        // One 4-bit open-neighbour mask indexes the candidate table, replacing
        // the per-direction loop and its four inB()/idx() calls.
        var mask = (vis[tp - P] ? 0 : 1) | (vis[tp + 1] ? 0 : 2)
                 | (vis[tp + P] ? 0 : 4) | (vis[tp - 1] ? 0 : 8);
        if (!mask) { sp -= 2; continue; }
        var pick = (CAND_D[mask] >> (((rnd() * CAND_N[mask]) | 0) << 1)) & 3;
        if (pick === 1) WV[ty * VW + tx + 1] = 0;
        else if (pick === 3) WV[ty * VW + tx] = 0;
        else if (pick === 2) WH[(ty + 1) * CW + tx] = 0;
        else WH[ty * CW + tx] = 0;
        var nx = tx + dxs[pick], ny = ty + dys[pick];
        vis[(ny + 1) * P + nx + 1] = 1;
        stack[sp++] = nx; stack[sp++] = ny;
      }
      return w;
    }

    function wallSeg(kind, x, y) {
      if (kind === 'v') return { x0: x * CS, y0: y * CS, x1: x * CS, y1: y * CS + CS };
      return { x0: x * CS, y0: y * CS, x1: x * CS + CS, y1: y * CS };
    }
    function wallStyle(c2d) {
      c2d.strokeStyle = o.wall;
      c2d.lineWidth = o.wallWidth;
      c2d.lineCap = 'round';
    }
    // Grid px -> canvas: scale by RS, shift the overscan off-screen.
    function gridTransform(c2d) {
      c2d.setTransform(RS, 0, 0, RS, -o.pad * CS * RS, -o.pad * CS * RS);
    }

    // Inks a whole plan onto the next pooled layer canvas. Direct loops rather
    // than eachWall(): this runs ~8k times on the rollover frame and the
    // callback plus wallSeg()'s throwaway object were most of its cost.
    function renderLayer(plan) {
      var c = layerPool[layerSlot];
      layerSlot ^= 1;
      var lc = c.getContext('2d');
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(0, 0, c.width, c.height);   // the slot still holds a dead plan
      gridTransform(lc);
      wallStyle(lc);
      lc.beginPath();
      var V = plan.V, Hh = plan.H, x, y, px, py;
      for (y = 0; y < rows; y++) {
        py = y * CS;
        for (x = 1; x < cols; x++) {
          if (!V[vi(x, y)]) continue;
          px = x * CS;
          lc.moveTo(px, py); lc.lineTo(px, py + CS);
        }
      }
      for (y = 1; y < rows; y++) {
        py = y * CS;
        for (x = 0; x < cols; x++) {
          if (!Hh[hi(x, y)]) continue;
          px = x * CS;
          lc.moveTo(px, py); lc.lineTo(px + CS, py);
        }
      }
      lc.stroke();
      return c;
    }

    // Re-ink a small dirty rect on layerB after a wall is carved out of B
    // mid-cycle (trail protection below) — the layer must match the array
    // before the front reveals that region.
    function redrawOnLayerB(kind, x, y) {
      if (!layerB) return;
      var p = wallSeg(kind, x, y);
      var m = o.wallWidth + 2;
      var rx0 = Math.min(p.x0, p.x1) - m, ry0 = Math.min(p.y0, p.y1) - m;
      var rx1 = Math.max(p.x0, p.x1) + m, ry1 = Math.max(p.y0, p.y1) + m;
      var lc = layerB.getContext('2d');
      lc.save();
      gridTransform(lc);
      lc.beginPath();
      lc.rect(rx0, ry0, rx1 - rx0, ry1 - ry0);
      lc.clip();
      lc.clearRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
      wallStyle(lc);
      lc.beginPath();
      var cx0 = Math.max(0, Math.floor(rx0 / CS) - 1), cx1 = Math.min(cols, Math.ceil(rx1 / CS) + 1);
      var cy0 = Math.max(0, Math.floor(ry0 / CS) - 1), cy1 = Math.min(rows, Math.ceil(ry1 / CS) + 1);
      for (var wy = cy0; wy <= cy1; wy++) {
        for (var wx = cx0; wx <= cx1; wx++) {
          if (wx >= 1 && wy < rows && B.V[vi(wx, wy)]) {
            var pv = wallSeg('v', wx, wy);
            lc.moveTo(pv.x0, pv.y0); lc.lineTo(pv.x1, pv.y1);
          }
          if (wy >= 1 && wx < cols && B.H[hi(wx, wy)]) {
            var ph = wallSeg('h', wx, wy);
            lc.moveTo(ph.x0, ph.y0); lc.lineTo(ph.x1, ph.y1);
          }
        }
      }
      lc.stroke();
      lc.restore();
    }

    // ---- sweep personality ----
    // A leaned front (alternating overall direction, random lean each pass)
    // with two incommensurate sine wobbles bending the front line.
    function makeCycle() {
      var ang = (flip ? Math.PI : 0) + (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.25);
      var dx = Math.cos(ang), dy = Math.sin(ang);
      var GW = cols * CS, GH = rows * CS;
      var smin = Infinity, smax = -Infinity, tmin = Infinity, tmax = -Infinity;
      var corners = [[0, 0], [GW, 0], [0, GH], [GW, GH]];
      for (var i = 0; i < 4; i++) {
        var s = corners[i][0] * dx + corners[i][1] * dy;
        var t = -corners[i][0] * dy + corners[i][1] * dx;
        if (s < smin) smin = s; if (s > smax) smax = s;
        if (t < tmin) tmin = t; if (t > tmax) tmax = t;
      }
      return {
        dx: dx, dy: dy,
        ph1: Math.random() * 7, ph2: Math.random() * 7,
        smin: smin, smax: smax, tmin: tmin, tmax: tmax,
        wobMax: 32,
      };
    }
    // A wall's projection onto the sweep direction depends only on its midpoint
    // and the cycle's lean, so the whole grid can be ordered by it once per
    // cycle and the morph band read back as a contiguous run. Buckets are one
    // cell wide and the exact projection is still tested per candidate, so
    // order WITHIN a bucket is irrelevant — which makes this a two-pass counting
    // sort rather than a comparator sort. That matters because the only frame
    // this runs on is the rollover, which already carries genMaze() and a full
    // layer re-ink; a comparator sort added ~0.8ms to the worst frame there.
    // Counting sort of the grid's walls by sweep projection. Two passes over the
    // same nested loops: the first only counts, the second scatters. The
    // projection is recomputed in the second pass rather than parked in scratch
    // arrays — four multiplies a wall is cheaper than writing and re-reading
    // five parallel arrays, and it means the only buffers this touches are the
    // four it actually produces.
    function buildWallOrder() {
      var counts = scrCount, cursor = scrCursor;
      var dx = cyc.dx, dy = cyc.dy, smin = cyc.smin;
      var oS = wS, oK = wK, oX = wX, oY = wY;
      // Every wall midpoint lies inside the grid, so [smin, smax] bounds them.
      bucketCount = Math.max(1, Math.ceil((cyc.smax - smin) / CS) + 1);
      var bMax = bucketCount - 1, x, y, sv, b, d;
      counts.fill(0, 0, bucketCount + 1);
      for (y = 0; y < rows; y++) {
        for (x = 1; x < cols; x++) {
          sv = x * CS * dx + (y + 0.5) * CS * dy;
          b = ((sv - smin) / CS) | 0;
          counts[(b < 0 ? 0 : b > bMax ? bMax : b) + 1]++;
        }
      }
      for (y = 1; y < rows; y++) {
        for (x = 0; x < cols; x++) {
          sv = (x + 0.5) * CS * dx + y * CS * dy;
          b = ((sv - smin) / CS) | 0;
          counts[(b < 0 ? 0 : b > bMax ? bMax : b) + 1]++;
        }
      }
      for (var c = 0; c < bucketCount; c++) counts[c + 1] += counts[c];
      bucketStart = counts;                 // counts[b] .. counts[b+1] is bucket b
      for (var cc = 0; cc <= bucketCount; cc++) cursor[cc] = counts[cc];
      for (y = 0; y < rows; y++) {
        for (x = 1; x < cols; x++) {
          sv = x * CS * dx + (y + 0.5) * CS * dy;
          b = ((sv - smin) / CS) | 0;
          d = cursor[b < 0 ? 0 : b > bMax ? bMax : b]++;
          oS[d] = sv; oK[d] = 0; oX[d] = x; oY[d] = y;
        }
      }
      for (y = 1; y < rows; y++) {
        for (x = 0; x < cols; x++) {
          sv = (x + 0.5) * CS * dx + y * CS * dy;
          b = ((sv - smin) / CS) | 0;
          d = cursor[b < 0 ? 0 : b > bMax ? bMax : b]++;
          oS[d] = sv; oK[d] = 1; oX[d] = x; oY[d] = y;
        }
      }
      wDone.fill(0);                        // the wob memo is per-cycle
    }
    // One-time allocation for a given grid size. Called from setup().
    var tableCols = -1, tableRows = -1;
    function allocTables() {
      if (cols === tableCols && rows === tableRows) return;
      tableCols = cols; tableRows = rows;
      var n = rows * (cols - 1) + (rows - 1) * cols;
      var maxBuckets = Math.ceil(Math.hypot(cols * CS, rows * CS) / CS) + 3;
      scrCount = new Uint32Array(maxBuckets + 1);
      scrCursor = new Uint32Array(maxBuckets + 1);
      wS = new Float64Array(n); wK = new Uint8Array(n);
      wX = new Uint16Array(n); wY = new Uint16Array(n);
      wWob = new Float64Array(n); wDone = new Uint8Array(n);
      mzVisited = new Uint8Array((cols + 2) * (rows + 2));   // 1-cell sentinel border
      mzStack = new Int32Array(cols * rows * 2);
      planPool = [
        { V: new Uint8Array(rows * (cols + 1)), H: new Uint8Array((rows + 1) * cols) },
        { V: new Uint8Array(rows * (cols + 1)), H: new Uint8Array((rows + 1) * cols) },
      ];
      planSlot = 0;
    }
    function bucketOf(sv) {
      var b = ((sv - cyc.smin) / CS) | 0;
      return b < 0 ? 0 : b >= bucketCount ? bucketCount - 1 : b;
    }

    function frontS(uu) { return cyc.smin - 140 + (cyc.smax - cyc.smin + 280) * uu; }
    function wob(t) { return 22 * Math.sin(t * 0.02 + cyc.ph1) + 10 * Math.sin(t * 0.045 + cyc.ph2); }
    function pFor(mx, my, uu) {
      var s = mx * cyc.dx + my * cyc.dy;
      var t = -mx * cyc.dy + my * cyc.dx;
      return ease((frontS(uu) - s + wob(t)) / o.band);
    }

    // Effective wall amount (0 = absent, 1 = fully inked) at the current
    // sweep progress — the single source of truth for drawing AND shoppers.
    function wallAmt(kind, x, y) {
      var a = (kind === 'v' ? A.V[vi(x, y)] : A.H[hi(x, y)]) ? 1 : 0;
      var b = (kind === 'v' ? B.V[vi(x, y)] : B.H[hi(x, y)]) ? 1 : 0;
      if (u >= 1 || a === b) return b;
      var mx = kind === 'v' ? x * CS : (x + 0.5) * CS;
      var my = kind === 'v' ? (y + 0.5) * CS : y * CS;
      var p = pFor(mx, my, u);
      return a * (1 - p) + b * p;
    }

    // ---- shoppers ----
    function center(x, y) { return { x: (x + 0.5) * CS, y: (y + 0.5) * CS }; }
    function boundaryFor(cx, cy, d) {
      if (d === 1) return { k: 'v', x: cx + 1, y: cy };
      if (d === 3) return { k: 'v', x: cx, y: cy };
      if (d === 2) return { k: 'h', x: cx, y: cy + 1 };
      return { k: 'h', x: cx, y: cy };
    }
    function passable(cx, cy, d) {
      if (!inB(cx + DX[d], cy + DY[d])) return false;
      var b = boundaryFor(cx, cy, d);
      return wallAmt(b.k, b.x, b.y) < 0.5;
    }
    function carveInB(b) {
      var closed = b.k === 'v' ? B.V[vi(b.x, b.y)] : B.H[hi(b.x, b.y)];
      if (b.k === 'v') B.V[vi(b.x, b.y)] = 0; else B.H[hi(b.x, b.y)] = 0;
      if (closed) redrawOnLayerB(b.k, b.x, b.y);
    }
    function markCrossing(wk, d) {
      var b = boundaryFor(wk.cx, wk.cy, d);
      wk.bounds.push(b);
      if (wk.bounds.length > 8) wk.bounds.shift();
      carveInB(b);
    }
    function newWalker() {
      var cx = (Math.random() * cols) | 0, cy = (Math.random() * rows) | 0;
      var c = center(cx, cy);
      return { cx: cx, cy: cy, dir: -1, avoid: -1, px: c.x, py: c.y, trail: [], lfx: c.x, lfy: c.y, bounds: [] };
    }
    function updateWalkers(dt) {
      for (var i = 0; i < walkers.length; i++) {
        var wk = walkers[i];
        var step = o.walkerSpeed * dt / 1000;
        var guard = 8;
        while (step > 0 && guard-- > 0) {
          if (wk.dir === -1) {
            var optsD = [];
            for (var d = 0; d < 4; d++) {
              if (d !== wk.avoid && passable(wk.cx, wk.cy, d)) optsD.push(d);
            }
            if (!optsD.length && wk.avoid !== -1 && passable(wk.cx, wk.cy, wk.avoid)) optsD.push(wk.avoid);
            if (!optsD.length) break;   // boxed in mid-morph; wait it out
            wk.dir = optsD[(Math.random() * optsD.length) | 0];
            markCrossing(wk, wk.dir);
          }
          var tc = center(wk.cx + DX[wk.dir], wk.cy + DY[wk.dir]);
          var ddx = tc.x - wk.px, ddy = tc.y - wk.py;
          var left = Math.abs(ddx) + Math.abs(ddy);   // axis-aligned movement
          if (left <= step) {
            wk.px = tc.x; wk.py = tc.y;
            wk.cx += DX[wk.dir]; wk.cy += DY[wk.dir];
            wk.avoid = opp(wk.dir);
            step -= left;
            wk.dir = -1;
          } else {
            wk.px += (ddx === 0 ? 0 : ddx > 0 ? 1 : -1) * step;
            wk.py += (ddy === 0 ? 0 : ddy > 0 ? 1 : -1) * step;
            step = 0;
          }
        }
        var fdx = wk.px - wk.lfx, fdy = wk.py - wk.lfy;
        if (fdx * fdx + fdy * fdy >= TRAIL_SPACING2) {
          wk.trail.push({ x: wk.px, y: wk.py });
          if (wk.trail.length > o.trailLen) wk.trail.shift();
          wk.lfx = wk.px; wk.lfy = wk.py;
        }
      }
    }
    // Footprint alpha depends only on the dot's index within its trail, and
    // every shopper shares trailLen, so in the steady state the whole fleet's
    // dots collapse into one path per trail index — 14 fills a frame instead of
    // one per dot. Walking the index outermost and only breaking the path when
    // the alpha actually changes keeps that exact while trails are still
    // filling and lengths differ. Dots sharing an alpha come from different
    // shoppers and so never overlap, which is what makes a single fill of the
    // union identical to separate fills.
    // One fill per dot, deliberately. Batching the fleet's dots into one path
    // per alpha looks like the obvious win — ~15 fills a frame instead of ~120 —
    // and it is wrong twice over. Measured in Chrome (5400 frames, 1280x720) it
    // is 24% SLOWER than this, because at ~120 tiny circles Skia's cost is in
    // building the multi-subpath rather than in the fill calls. And it is not
    // pixel-identical: one fill of the union rounds coverage once where separate
    // fills round per dot, which moved ~250 pixels by up to 4/255. Neither
    // closePath() nor dropping the leading moveTo recovers it.
    function drawWalkers() {
      ctx.fillStyle = o.ink;
      for (var i = 0; i < walkers.length; i++) {
        var wk = walkers[i];
        for (var t = 0; t < wk.trail.length; t++) {
          var f = wk.trail[t];
          ctx.globalAlpha = 0.5 * (t + 1) / wk.trail.length;
          ctx.beginPath();
          ctx.arc(f.x, f.y, o.dotRadius * 0.58, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(wk.px, wk.py, o.dotRadius, 0, 7);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Clip to the strip s0..s1 of the sweep direction (s/t space -> quad).
    function clipBand(s0, s1) {
      gridTransform(ctx);
      var lo = cyc.tmin - 200, hi = cyc.tmax + 200;
      ctx.beginPath();
      ctx.moveTo(cyc.dx * s0 - cyc.dy * lo, cyc.dy * s0 + cyc.dx * lo);
      ctx.lineTo(cyc.dx * s1 - cyc.dy * lo, cyc.dy * s1 + cyc.dx * lo);
      ctx.lineTo(cyc.dx * s1 - cyc.dy * hi, cyc.dy * s1 + cyc.dx * hi);
      ctx.lineTo(cyc.dx * s0 - cyc.dy * hi, cyc.dy * s0 + cyc.dx * hi);
      ctx.closePath();
      ctx.clip();
    }

    // ---- frame loop ----
    // A resting still: plan B blitted whole, shoppers where they stand. This is
    // exactly what a REST frame draws, so freezing is invisible apart from the
    // motion stopping.
    function drawStill() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, cv.width, cv.height); }
      else ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(layerB, 0, 0);
      gridTransform(ctx);
      drawWalkers();
    }

    // Reduce Motion stops the rAF loop outright rather than just skipping the
    // sweep — an idling loop still costs a repaint per frame, and CEF samples
    // the whole page at the dominant animation's cadence.
    function setFrozen(on) {
      if (!alive) return;
      frozen = !!on;
      cancelAnimationFrame(rafId);
      if (frozen) {
        A = B; layerA = layerB; u = 1;   // land on a whole plan, mid-sweep or not
        drawStill();
        return;
      }
      lastNow = performance.now();
      lastDraw = -1e9;
      rafId = requestAnimationFrame(frame);
    }

    function frame(now) {
      if (!alive || frozen) return;
      rafId = requestAnimationFrame(frame);
      // Frame cap: rAF ticks land on refresh multiples, so accept a tick
      // once it's within ~2ms of the target interval.
      if (now - lastDraw < 1000 / o.maxFps - 2) return;
      lastDraw = now;
      var dt = Math.min(100, now - lastNow);   // clamp hidden-tab gaps
      lastNow = now;

      if (!t0) t0 = now - o.sweepMs;   // first cycle starts at REST on plan B
      var el = now - t0;
      if (el > o.sweepMs + o.restMs) {
        A = B;
        layerA = layerB;
        B = genMaze();
        // Trail protection: the fresh plan must not wall over live trails.
        for (var wi = 0; wi < walkers.length; wi++) {
          var bs = walkers[wi].bounds;
          for (var bi = 0; bi < bs.length; bi++) {
            if (bs[bi].k === 'v') B.V[vi(bs[bi].x, bs[bi].y)] = 0;
            else B.H[hi(bs[bi].x, bs[bi].y)] = 0;
          }
        }
        layerB = renderLayer(B);
        flip = !flip;
        cyc = makeCycle();
        buildWallOrder();          // the sort order is per-lean, so per-cycle
        t0 = now;
        el = 0;
      }
      u = Math.min(1, el / o.sweepMs);

      updateWalkers(dt);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, cv.width, cv.height); }
      else ctx.clearRect(0, 0, cv.width, cv.height);

      if (u >= 1) {
        // REST: the whole scene is plan B — one blit.
        ctx.drawImage(layerB, 0, 0);
      } else if (frontS(u) + cyc.wobMax + CS < cyc.smin) {
        // Front has not reached the grid yet: every wall still reads as plan A,
        // so the two clips and the band scan have nothing to separate.
        ctx.drawImage(layerA, 0, 0);
      } else if (frontS(u) - o.band - cyc.wobMax - CS > cyc.smax) {
        // Front is past the grid — plan B everywhere.
        ctx.drawImage(layerB, 0, 0);
      } else {
        var fs = frontS(u);
        var sLo = fs - o.band - cyc.wobMax;   // behind: provably pure B
        var sHi = fs + cyc.wobMax;            // ahead: provably pure A
        ctx.save();
        clipBand(sHi, cyc.smax + 1e4);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(layerA, 0, 0);
        ctx.restore();
        ctx.save();
        clipBand(cyc.smin - 1e4, sLo);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(layerB, 0, 0);
        ctx.restore();
        // Live morph band, taken as a slice of the s-sorted wall table. Wall
        // midpoints within CS of the band bounds are included so segments
        // straddling a clip plane draw on both sides (the clip keeps the halves
        // from double-painting).
        ctx.save();
        clipBand(sLo, sHi);
        wallStyle(ctx);
        ctx.beginPath();
        var half = CS / 2;
        var sStart = sLo - CS, sEnd = sHi + CS;
        var qEnd = bucketStart[bucketOf(sEnd) + 1];
        var fsU = frontS(u);          // same for every wall this frame
        for (var q = bucketStart[bucketOf(sStart)]; q < qEnd; q++) {
          var sq = wS[q];
          if (sq < sStart || sq > sEnd) continue;   // bucket slop at both ends
          var qx = wX[q], qy = wY[q], isV = wK[q] === 0;
          // wallAmt() inlined: it is the innermost call in the module, and
          // reaching it through a string kind cost three string compares a wall.
          var av = (isV ? A.V[vi(qx, qy)] : A.H[hi(qx, qy)]) ? 1 : 0;
          var bv = (isV ? B.V[vi(qx, qy)] : B.H[hi(qx, qy)]) ? 1 : 0;
          var amt;
          if (av === bv) amt = bv;
          else {
            // wob() is two Math.sin calls and was 49% of this module's entire
            // CPU: it was recomputed for every morphing wall on every frame,
            // though it depends only on the wall and the cycle. Memoised on
            // first touch — and because a wall is first touched exactly when
            // the band arrives at it, the grid's trig spreads itself thinly
            // across the sweep instead of landing per-frame or in one lump on
            // the rollover. Same expression, same operand order, so the result
            // is bit-identical to computing it inline.
            if (!wDone[q]) {
              var mxq = isV ? qx * CS : (qx + 0.5) * CS;
              var myq = isV ? (qy + 0.5) * CS : qy * CS;
              wWob[q] = wob(-mxq * cyc.dy + myq * cyc.dx);
              wDone[q] = 1;
            }
            var pq = ease((fsU - sq + wWob[q]) / o.band);
            amt = av * (1 - pq) + bv * pq;
          }
          if (amt <= 0.03) continue;
          var hl = half * amt;   // walls shrink/grow about their midpoint
          if (isV) {
            var vx = qx * CS, vy = qy * CS + half;
            ctx.moveTo(vx, vy - hl); ctx.lineTo(vx, vy + hl);
          } else {
            var hx = qx * CS + half, hy = qy * CS;
            ctx.moveTo(hx - hl, hy); ctx.lineTo(hx + hl, hy);
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      gridTransform(ctx);
      drawWalkers();
    }

    function setup() {
      if (!alive) return;
      W = Math.max(1, container.clientWidth || global.innerWidth);
      H = Math.max(1, container.clientHeight || global.innerHeight);
      cv.width = Math.max(1, Math.round(W * RS));
      cv.height = Math.max(1, Math.round(H * RS));
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
      cols = Math.max(4, Math.ceil(W / CS) + o.pad * 2);
      rows = Math.max(4, Math.ceil(H / CS) + o.pad * 2);
      allocTables();
      // Two layer canvases, ping-ponged. Assigning .width also clears them,
      // which is exactly what a resize wants.
      for (var li = 0; li < 2; li++) {
        if (!layerPool[li]) layerPool[li] = document.createElement('canvas');
        layerPool[li].width = cv.width;
        layerPool[li].height = cv.height;
      }
      layerSlot = 0;

      // Both plans start identical so no sweep plays until the first
      // rollover — the backdrop opens resting.
      B = genMaze();
      A = B;
      layerB = renderLayer(B);
      layerA = layerB;
      cyc = makeCycle();
      buildWallOrder();
      t0 = 0;
      u = 1;

      var count = Math.min(o.walkerMax, Math.max(3, Math.round(W * H / o.walkerArea)));
      walkers = [];
      for (var i = 0; i < count; i++) walkers.push(newWalker());

      lastNow = performance.now();
      lastDraw = -1e9;
      cancelAnimationFrame(rafId);
      if (frozen) { drawStill(); return; }   // a resize while frozen re-draws the still
      rafId = requestAnimationFrame(frame);
    }

    function onResize() { clearTimeout(rsTimer); rsTimer = setTimeout(setup, 250); }
    var ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(onResize);
      ro.observe(container);
    } else {
      global.addEventListener('resize', onResize);
    }
    setup();

    // reduce-motion.js resolves its state from a sticky message, so poll until
    // it exists (it may be a later <script> than this one, or absent entirely on
    // pages that never load it — those keep full motion, which is the default).
    (function bindReduceMotion() {
      if (!alive) return;
      if (global.TSIC && typeof global.TSIC.onReduceMotion === 'function') {
        global.TSIC.onReduceMotion(setFrozen);
        return;
      }
      setTimeout(bindReduceMotion, 100);
    })();

    return {
      destroy: function () {
        if (!alive) return;
        alive = false;
        cancelAnimationFrame(rafId);
        clearTimeout(rsTimer);
        if (ro) ro.disconnect(); else global.removeEventListener('resize', onResize);
        if (cv.parentNode) cv.parentNode.removeChild(cv);
      },
    };
  }

  global.TSICStoreMaze = {
    mount: mount,
    unmount: function (handle) { if (handle && handle.destroy) handle.destroy(); },
  };
})(window);
