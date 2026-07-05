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
// wobble. The rAF loop is throttled to maxFps — a backdrop does not need 60.
//
// prefers-reduced-motion is intentionally NOT honored: this is a game menu
// backdrop, and OS-level "disable animations" (common on RDP/dev boxes)
// leaks into CEF and would silently freeze it.
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
    maxFps: 30,            // backdrop frame cap
    renderScale: 0.75,     // canvas backing-store scale; upscaled via CSS —
                           // the soft ink look tolerates sub-native res and
                           // it cuts raster cost quadratically
  };

  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];   // N E S W
  function opp(d) { return (d + 2) & 3; }
  function ease(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }

  function mount(container, opts) {
    if (!container) return null;
    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (var ok in (opts || {})) if (ok in DEFAULTS) o[ok] = opts[ok];
    var CS = o.cellSize;
    var RS = o.renderScale;

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
    var alive = true, rafId = 0, rsTimer = 0, lastDraw = -1e9, lastNow = 0;

    function inB(x, y) { return x >= 0 && y >= 0 && x < cols && y < rows; }
    function idx(x, y) { return y * cols + x; }

    // ---- plans ----
    // V[y][x] wall between cells (x-1,y)|(x,y), x in 1..cols-1; H[y][x]
    // wall between (x,y-1)|(x,y), y in 1..rows-1. The perimeter is open.
    function genMaze() {
      var V = [], Hh = [];
      for (var y = 0; y < rows; y++) V.push(new Array(cols + 1).fill(true));
      for (var y2 = 0; y2 <= rows; y2++) Hh.push(new Array(cols).fill(true));
      var w = { V: V, H: Hh };
      var visited = new Uint8Array(cols * rows);
      var sx = (Math.random() * cols) | 0, sy = (Math.random() * rows) | 0;
      visited[idx(sx, sy)] = 1;
      var stack = [[sx, sy]];
      while (stack.length) {
        var top = stack[stack.length - 1];
        var optsD = [];
        for (var d = 0; d < 4; d++) {
          if (inB(top[0] + DX[d], top[1] + DY[d]) && !visited[idx(top[0] + DX[d], top[1] + DY[d])]) optsD.push(d);
        }
        if (!optsD.length) { stack.pop(); continue; }
        var pick = optsD[(Math.random() * optsD.length) | 0];
        if (pick === 1) w.V[top[1]][top[0] + 1] = false;
        else if (pick === 3) w.V[top[1]][top[0]] = false;
        else if (pick === 2) w.H[top[1] + 1][top[0]] = false;
        else w.H[top[1]][top[0]] = false;
        var nx = top[0] + DX[pick], ny = top[1] + DY[pick];
        visited[idx(nx, ny)] = 1;
        stack.push([nx, ny]);
      }
      return w;
    }

    function wallSeg(kind, x, y) {
      if (kind === 'v') return { x0: x * CS, y0: y * CS, x1: x * CS, y1: y * CS + CS };
      return { x0: x * CS, y0: y * CS, x1: x * CS + CS, y1: y * CS };
    }
    function eachWall(cb) {
      for (var y = 0; y < rows; y++) for (var x = 1; x < cols; x++) cb('v', x, y);
      for (var y2 = 1; y2 < rows; y2++) for (var x2 = 0; x2 < cols; x2++) cb('h', x2, y2);
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

    function renderLayer(plan) {
      var c = document.createElement('canvas');
      c.width = cv.width;
      c.height = cv.height;
      var lc = c.getContext('2d');
      gridTransform(lc);
      wallStyle(lc);
      lc.beginPath();
      eachWall(function (kind, x, y) {
        if (!(kind === 'v' ? plan.V[y][x] : plan.H[y][x])) return;
        var p = wallSeg(kind, x, y);
        lc.moveTo(p.x0, p.y0);
        lc.lineTo(p.x1, p.y1);
      });
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
          if (wx >= 1 && wy < rows && B.V[wy][wx]) {
            var pv = wallSeg('v', wx, wy);
            lc.moveTo(pv.x0, pv.y0); lc.lineTo(pv.x1, pv.y1);
          }
          if (wy >= 1 && wx < cols && B.H[wy][wx]) {
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
      var a = (kind === 'v' ? A.V[y][x] : A.H[y][x]) ? 1 : 0;
      var b = (kind === 'v' ? B.V[y][x] : B.H[y][x]) ? 1 : 0;
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
      var closed = b.k === 'v' ? B.V[b.y][b.x] : B.H[b.y][b.x];
      if (b.k === 'v') B.V[b.y][b.x] = false; else B.H[b.y][b.x] = false;
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
        if (Math.hypot(wk.px - wk.lfx, wk.py - wk.lfy) >= o.trailSpacing) {
          wk.trail.push({ x: wk.px, y: wk.py });
          if (wk.trail.length > o.trailLen) wk.trail.shift();
          wk.lfx = wk.px; wk.lfy = wk.py;
        }
      }
    }
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
    function frame(now) {
      if (!alive) return;
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
            if (bs[bi].k === 'v') B.V[bs[bi].y][bs[bi].x] = false;
            else B.H[bs[bi].y][bs[bi].x] = false;
          }
        }
        layerB = renderLayer(B);
        flip = !flip;
        cyc = makeCycle();
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
        // Live morph band. Wall midpoints within CS of the band bounds are
        // included so segments straddling a clip plane draw on both sides
        // (the clip keeps the halves from double-painting).
        ctx.save();
        clipBand(sLo, sHi);
        wallStyle(ctx);
        ctx.beginPath();
        eachWall(function (kind, x, y) {
          var mx = kind === 'v' ? x * CS : (x + 0.5) * CS;
          var my = kind === 'v' ? (y + 0.5) * CS : y * CS;
          var s = mx * cyc.dx + my * cyc.dy;
          if (s < sLo - CS || s > sHi + CS) return;
          var amt = wallAmt(kind, x, y);
          if (amt <= 0.03) return;
          var p = wallSeg(kind, x, y);
          var cxm = (p.x0 + p.x1) / 2, cym = (p.y0 + p.y1) / 2;
          ctx.moveTo(cxm + (p.x0 - cxm) * amt, cym + (p.y0 - cym) * amt);
          ctx.lineTo(cxm + (p.x1 - cxm) * amt, cym + (p.y1 - cym) * amt);
        });
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

      // Both plans start identical so no sweep plays until the first
      // rollover — the backdrop opens resting.
      B = genMaze();
      A = B;
      layerB = renderLayer(B);
      layerA = layerB;
      cyc = makeCycle();
      t0 = 0;
      u = 1;

      var count = Math.min(o.walkerMax, Math.max(3, Math.round(W * H / o.walkerArea)));
      walkers = [];
      for (var i = 0; i < count; i++) walkers.push(newWalker());

      lastNow = performance.now();
      lastDraw = -1e9;
      cancelAnimationFrame(rafId);
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
