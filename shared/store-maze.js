// shared/store-maze.js — shifting furniture-store maze background motif.
//
// Procedural store floor plan (BSP rooms + doorways) drawn as a thin-line
// blueprint, with dashed "shopper routes" wandering edge-to-edge plus one
// central loop through the middle of the plan. Every cycle a sweep front
// crosses the screen and morphs the plan into a freshly generated layout:
// walls shrink/grow as the front passes, routes swap behind it. The
// perimeter stays open so the plan reads as an endless store.
//
// Intended as an ambient backdrop for menu screens. Styled to the magazine
// look (see shared/base.css tokens): ink-printed walls and mag-red shopper
// routes, drawn over a TRANSPARENT canvas by default so the motif sits on
// whatever paper stage the host page provides (tsic-stage--magazine et al).
// Pass opts.bg to paint an opaque backdrop instead. Self-contained canvas —
// no message channels, no external assets. Honors prefers-reduced-motion
// (static plan, no sweep).
//
// API:
//   var handle = TSICStoreMaze.mount(container, opts);  // opts optional, see DEFAULTS
//   TSICStoreMaze.unmount(handle);
(function (global) {
  var DEFAULTS = {
    cellSize: 9,           // px per grid cell (smaller = more zoomed out)
    pad: 3,                // overscan cells beyond each viewport edge
    bg: null,              // null = transparent (host page's stage shows through)
    wall: 'rgba(10, 10, 10, 0.45)',     // --ink-night, printed-plan weight
    ink: 'rgba(10, 10, 10, 0.9)',       // --ink-night shopper routes
    wallWidth: 2.5,
    routeWidth: 1.8,
    dash: [0.4, 5.5],
    dotRadius: 2.2,
    arrow: 3.2,
    routeMax: 40,          // max rooms per route
    loopMin: 6,            // min rooms per loop — smaller cycles are rejected
    loopMax: 14,           // max rooms per loop
    loopSpan: 180,         // min px between a loop's two furthest rooms —
                           // rejects rings that are technically 6+ rooms but
                           // geometrically tiny
    candidates: 14,        // attempts per route, best new-coverage wins
    minNewCoverage: 6,     // a route must claim at least this many fresh
                           // coverage cells or it's rejected (avoids doubling
                           // up on already-busy areas)
    sweepMs: 8000,         // sweep-front travel time
    restMs: 10000,         // hold time between sweeps
  };

  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }

  // Per-cycle sweep personality, derived deterministically from the cycle
  // number so every frame in a cycle agrees without stored state: a lean of
  // ~9–26° off the horizontal (overall direction still alternates), and two
  // incommensurate sine wobbles that bend the front line as it travels.
  function cycleParams(cn) {
    var s = (cn * 0x9E3779B9) | 0;
    function rnd() {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    var ang = (cn % 2 === 0 ? 0 : Math.PI) + (rnd() < 0.5 ? -1 : 1) * (0.15 + rnd() * 0.30);
    return {
      dx: Math.cos(ang), dy: Math.sin(ang),
      w1a: 24 + rnd() * 30, w1f: 0.008 + rnd() * 0.007, w1p: rnd() * Math.PI * 2,
      w2a: 10 + rnd() * 16, w2f: 0.020 + rnd() * 0.015, w2p: rnd() * Math.PI * 2,
    };
  }

  function mount(container, opts) {
    if (!container) return null;
    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (var ok in (opts || {})) if (ok in DEFAULTS) o[ok] = opts[ok];
    var CS = o.cellSize;

    var cv = document.createElement('canvas');
    cv.className = 'store-maze-canvas';
    cv.style.position = 'absolute';
    cv.style.inset = '0';
    cv.style.display = 'block';
    container.appendChild(cv);
    var ctx = cv.getContext('2d');
    var reduced = global.matchMedia('(prefers-reduced-motion: reduce)');

    var W, H, COLS, ROWS, OX, OY, ROUTES, A, B, start, cyclePrev;
    var nextL = null;   // pre-generated layout for the next cycle (see frame)
    var alive = true, rafId = 0, rsTimer = 0;

    function genLayout() {
      var rooms = [];
      (function split(x, y, w, h) {
        var canV = w >= 6, canH = h >= 6;
        if ((!canV && !canH) || (w <= 8 && h <= 6 && Math.random() < 0.35)) {
          rooms.push({ x: x, y: y, w: w, h: h });
          return;
        }
        var vert = canV && canH ? (w > h * 1.3 ? true : h > w * 1.3 ? false : Math.random() < 0.5) : canV;
        if (vert) {
          var cutX = x + 3 + Math.floor(Math.random() * (w - 5));
          split(x, y, cutX - x, h); split(cutX, y, x + w - cutX, h);
        } else {
          var cutY = y + 3 + Math.floor(Math.random() * (h - 5));
          split(x, y, w, cutY - y); split(x, cutY, w, y + h - cutY);
        }
      })(0, 0, COLS, ROWS);

      // Interior walls only — the perimeter stays open so the plan reads as endless.
      var V = [], Hw = [];
      for (var vy = 0; vy < ROWS; vy++) V.push(new Array(COLS + 1).fill(0));
      for (var hy = 0; hy <= ROWS; hy++) Hw.push(new Array(COLS).fill(0));
      for (var ri = 0; ri < rooms.length; ri++) {
        var r = rooms[ri];
        for (var y0 = r.y; y0 < r.y + r.h; y0++) {
          if (r.x > 0) V[y0][r.x] = 1;
          if (r.x + r.w < COLS) V[y0][r.x + r.w] = 1;
        }
        for (var x0 = r.x; x0 < r.x + r.w; x0++) {
          if (r.y > 0) Hw[r.y][x0] = 1;
          if (r.y + r.h < ROWS) Hw[r.y + r.h][x0] = 1;
        }
      }

      // Spanning doors (union-find) + a few extra so loops exist.
      var parent = rooms.map(function (_, i) { return i; });
      function find(i) { return parent[i] === i ? i : (parent[i] = find(parent[i])); }
      // Adjacency via edge-coordinate index instead of an all-pairs scan —
      // BSP yields thousands of rooms at small cell sizes and n² pair checks
      // dominate layout gen. Each unordered pair is found exactly once, from
      // the room whose right/bottom edge meets the other's left/top edge.
      var byLeft = new Map(), byTop = new Map();
      for (var bi = 0; bi < rooms.length; bi++) {
        var br = rooms[bi];
        if (!byLeft.has(br.x)) byLeft.set(br.x, []);
        byLeft.get(br.x).push(bi);
        if (!byTop.has(br.y)) byTop.set(br.y, []);
        byTop.get(br.y).push(bi);
      }
      var edges = [], doors = [];
      for (var i = 0; i < rooms.length; i++) {
        var a = rooms[i];
        var rightMates = byLeft.get(a.x + a.w) || [];
        for (var rm0 = 0; rm0 < rightMates.length; rm0++) {
          var j = rightMates[rm0], b = rooms[j];
          var loV = Math.max(a.y, b.y), hiV = Math.min(a.y + a.h, b.y + b.h);
          if (hiV - loV >= 1) edges.push({ i: i, j: j, vert: true, pos: b.x, lo: loV, hi: hiV });
        }
        var downMates = byTop.get(a.y + a.h) || [];
        for (var dm0 = 0; dm0 < downMates.length; dm0++) {
          var j2 = downMates[dm0], b2 = rooms[j2];
          var loH = Math.max(a.x, b2.x), hiH = Math.min(a.x + a.w, b2.x + b2.w);
          if (hiH - loH >= 1) edges.push({ i: i, j: j2, vert: false, pos: b2.y, lo: loH, hi: hiH });
        }
      }
      edges.sort(function () { return Math.random() - 0.5; });
      for (var ei = 0; ei < edges.length; ei++) {
        var e = edges[ei];
        var ra = find(e.i), rb = find(e.j);
        var need = ra !== rb;
        if (need) parent[ra] = rb;
        if (need || Math.random() < 0.2) {
          var span = e.hi - e.lo, dw = span >= 3 ? 2 : 1;
          var off = e.lo + Math.floor(Math.random() * (span - dw + 1));
          for (var dk = 0; dk < dw; dk++) { if (e.vert) V[off + dk][e.pos] = 0; else Hw[e.pos][off + dk] = 0; }
          doors.push({
            i: e.i, j: e.j, vert: e.vert,
            x: e.vert ? e.pos * CS : (off + dw / 2) * CS,
            y: e.vert ? (off + dw / 2) * CS : e.pos * CS,
          });
        }
      }

      var adj = rooms.map(function () { return []; });
      for (var di = 0; di < doors.length; di++) {
        var d = doors[di];
        adj[d.i].push({ v: d.j, d: d }); adj[d.j].push({ v: d.i, d: d });
      }

      function touches(rm) { return rm.x === 0 || rm.y === 0 || rm.x + rm.w === COLS || rm.y + rm.h === ROWS; }
      var perim = rooms.map(function (_, i) { return i; }).filter(function (i) { return touches(rooms[i]); });
      var usedRooms = new Set();   // rooms claimed by a route; routes never share rooms

      function inner(d, rm) {
        if (d.vert) return { x: d.x + (Math.abs(d.x - rm.x * CS) < 1 ? CS / 2 : -CS / 2), y: d.y };
        return { x: d.x, y: d.y + (Math.abs(d.y - rm.y * CS) < 1 ? CS / 2 : -CS / 2) };
      }
      function sideDoor(i) {
        var rm = rooms[i], sides = [];
        if (rm.x === 0) sides.push({ vert: true, x: 0, y: (rm.y + rm.h / 2) * CS, out: -1 });
        if (rm.x + rm.w === COLS) sides.push({ vert: true, x: COLS * CS, y: (rm.y + rm.h / 2) * CS, out: 1 });
        if (rm.y === 0) sides.push({ vert: false, x: (rm.x + rm.w / 2) * CS, y: 0, out: -1 });
        if (rm.y + rm.h === ROWS) sides.push({ vert: false, x: (rm.x + rm.w / 2) * CS, y: ROWS * CS, out: 1 });
        return sides[Math.floor(Math.random() * sides.length)];
      }
      function outward(d) {
        return d.vert
          ? { x: d.x + d.out * CS * 1.5, y: d.y }
          : { x: d.x, y: d.y + d.out * CS * 1.5 };
      }

      // One turn per room: enter, continue direction, turn at most once, exit.
      function roomLeg(pts, dots, room, entry, exit) {
        var Pin = inner(entry, room);
        pts.push(Pin);
        var Pout = inner(exit, room);
        if (Pin.x !== Pout.x && Pin.y !== Pout.y) {
          var corner = entry.vert ? { x: Pout.x, y: Pin.y } : { x: Pin.x, y: Pout.y };
          pts.push(corner);
          dots.push(corner);
        } else {
          dots.push({ x: (Pin.x + Pout.x) / 2, y: (Pin.y + Pout.y) / 2 });
        }
        pts.push(Pout);
      }

      // Randomized deep walk through unclaimed rooms, cut back to last perimeter room.
      function buildTrail(startI) {
        var best = [], steps = 0;
        var seen = rooms.map(function (_, i) { return usedRooms.has(i); });
        seen[startI] = true;
        (function dfs(u, trail) {
          if (trail.length > best.length) best = trail.slice();
          if (++steps > 1500) return;
          var nbs = adj[u].slice().sort(function () { return Math.random() - 0.5; });
          for (var n = 0; n < nbs.length; n++) {
            var eN = nbs[n];
            if (!seen[eN.v]) { seen[eN.v] = true; trail.push(eN); dfs(eN.v, trail); trail.pop(); seen[eN.v] = false; }
          }
        })(startI, []);
        var lim = Math.min(best.length, o.routeMax);
        for (var t = lim - 1; t >= 2; t--) {
          if (touches(rooms[best[t].v])) return best.slice(0, t + 1);
        }
        return null;
      }

      function buildRoute(startI, trail) {
        var startDoor = sideDoor(startI);
        var endDoor = sideDoor(trail[trail.length - 1].v);
        var pts = [outward(startDoor)];
        var dots = [];
        var cur = startI, entry = startDoor;
        for (var k = 0; k <= trail.length; k++) {
          var exit = k < trail.length ? trail[k].d : endDoor;
          roomLeg(pts, dots, rooms[cur], entry, exit);
          if (k === trail.length) { pts.push(outward(endDoor)); break; }
          cur = trail[k].v;
          entry = exit;
        }
        return { pts: pts, dots: dots };
      }

      // Cycle through unclaimed rooms back to S; the WIDEST cycle (largest
      // distance between its two furthest rooms) within loopMax wins — room
      // count alone lets tiny-roomed rings through.
      function findLoop(S) {
        var best = null, steps = 0;
        var seen = new Array(rooms.length).fill(false);
        function spanOf(cycleRooms) {
          var max = 0;
          for (var a2 = 0; a2 < cycleRooms.length; a2++) {
            var ra2 = rooms[cycleRooms[a2]];
            var ax = (ra2.x + ra2.w / 2) * CS, ay = (ra2.y + ra2.h / 2) * CS;
            for (var b2 = a2 + 1; b2 < cycleRooms.length; b2++) {
              var rb2 = rooms[cycleRooms[b2]];
              var dd = Math.hypot((rb2.x + rb2.w / 2) * CS - ax, (rb2.y + rb2.h / 2) * CS - ay);
              if (dd > max) max = dd;
            }
          }
          return max;
        }
        seen[S] = true;
        (function dfs(u, trail) {
          if (++steps > 2500) return;
          var nbs = adj[u].slice().sort(function () { return Math.random() - 0.5; });
          for (var n = 0; n < nbs.length; n++) {
            var eN = nbs[n];
            if (eN.v === S && trail.length >= 3 && eN.d !== trail[0].d) {
              var cycleRooms = [S];
              for (var t2 = 0; t2 < trail.length; t2++) cycleRooms.push(trail[t2].v);
              var sp = spanOf(cycleRooms);
              if (!best || sp > best.span) best = { trail: trail.concat([eN]), span: sp };
            } else if (!seen[eN.v] && !usedRooms.has(eN.v) && trail.length < o.loopMax - 1) {
              seen[eN.v] = true; trail.push(eN); dfs(eN.v, trail); trail.pop(); seen[eN.v] = false;
            }
          }
        })(S, []);
        return best;
      }

      function buildLoop(S, trail) {
        var pts = [], dots = [];
        var cur = S;
        var entry = trail[trail.length - 1].d;   // the closing door is the entry into S
        for (var k = 0; k < trail.length; k++) {
          roomLeg(pts, dots, rooms[cur], entry, trail[k].d);
          cur = trail[k].v;
          entry = trail[k].d;
        }
        pts.push(pts[0]);   // close the ring through the final doorway
        return { pts: pts, dots: dots, loop: true };
      }

      // Coverage grid: routes are picked to spread over the screen. Fine
      // enough (18×12) that "fresh ground" discriminates real gaps, coarse
      // enough that nearby strokes still count as covering the same area.
      var gx = Math.max(1, (COLS * CS) / 18), gy = Math.max(1, (ROWS * CS) / 12);
      function cells(pts) {
        var set = new Set();
        for (var p = 1; p < pts.length; p++) {
          var pa = pts[p - 1], pb = pts[p];
          var n = Math.max(1, Math.ceil(Math.hypot(pb.x - pa.x, pb.y - pa.y) / 24));
          for (var k = 0; k <= n; k++) {
            var px = pa.x + (pb.x - pa.x) * k / n, py = pa.y + (pb.y - pa.y) * k / n;
            set.add(Math.floor(px / gx) + '_' + Math.floor(py / gy));
          }
        }
        return set;
      }

      var routes = [], covered = new Set();

      // Try to land a loop near (cx, cy): seed at the closest unclaimed
      // rooms, keep the first cycle at least minLen rooms long. Loops need
      // no perimeter access, so they can fill anywhere the door graph allows.
      function addLoopAt(cx, cy, minLen) {
        var near = [];
        for (var ni0 = 0; ni0 < rooms.length; ni0++) {
          if (usedRooms.has(ni0)) continue;
          var nr = rooms[ni0];
          near.push({ i: ni0, d: Math.hypot((nr.x + nr.w / 2) * CS - cx, (nr.y + nr.h / 2) * CS - cy) });
        }
        near.sort(function (p, q) { return p.d - q.d; });
        var seeds = near.slice(0, 12);
        for (var ni = 0; ni < seeds.length; ni++) {
          var S = seeds[ni].i;
          var lt = findLoop(S);
          if (!lt || lt.trail.length < minLen || lt.span < o.loopSpan) continue;
          var loopRt = buildLoop(S, lt.trail);
          routes.push(loopRt);
          usedRooms.add(S);
          for (var le = 0; le < lt.trail.length; le++) usedRooms.add(lt.trail[le].v);
          cells(loopRt.pts).forEach(function (key) { covered.add(key); });
          return true;
        }
        return false;
      }

      // Central loop first so it gets the middle of the map — prefer a big
      // ring, settle for the floor.
      var mx0 = COLS * CS / 2, my0 = ROWS * CS / 2;
      if (!addLoopAt(mx0, my0, Math.max(o.loopMin, 8))) addLoopAt(mx0, my0, o.loopMin);

      // Edge-to-edge routes, never reusing a claimed room. Starts are spread
      // out, and a candidate route only lands if it claims enough FRESH
      // coverage cells — otherwise we burn the start and try elsewhere. A few
      // consecutive rejections means the plan is saturated, so stop instead
      // of piling routes onto already-busy areas.
      var usedStarts = new Set(), starts = [], misses = 0;
      while (routes.length < ROUTES && misses < 6) {
        var sI = -1, bd = -1;
        for (var pi = 0; pi < perim.length; pi++) {
          var cand = perim[pi];
          if (usedStarts.has(cand) || usedRooms.has(cand)) continue;
          var r0c = rooms[cand];
          var ccx = (r0c.x + r0c.w / 2) * CS, ccy = (r0c.y + r0c.h / 2) * CS;
          var dist = starts.length ? Infinity : Math.random();
          for (var si = 0; si < starts.length; si++) dist = Math.min(dist, Math.hypot(ccx - starts[si].x, ccy - starts[si].y));
          if (dist > bd) { bd = dist; sI = cand; }
        }
        if (sI < 0) break;
        usedStarts.add(sI);
        var r0 = rooms[sI];
        starts.push({ x: (r0.x + r0.w / 2) * CS, y: (r0.y + r0.h / 2) * CS });
        var bestR = null, bestS = -1;
        for (var c = 0; c < o.candidates; c++) {
          var trail = buildTrail(sI);
          if (!trail) continue;
          var rt = buildRoute(sI, trail);
          var cs = cells(rt.pts);
          var score = 0;
          cs.forEach(function (key) { if (!covered.has(key)) score++; });
          if (score > bestS) { bestS = score; bestR = { rt: rt, cs: cs, trail: trail }; }
        }
        if (bestR && bestS >= o.minNewCoverage) {
          routes.push(bestR.rt);
          usedRooms.add(sI);
          for (var te = 0; te < bestR.trail.length; te++) usedRooms.add(bestR.trail[te].v);
          bestR.cs.forEach(function (key) { covered.add(key); });
          misses = 0;
        } else {
          misses++;
        }
      }

      // Interior gap-fill: edge-to-edge routes all start at the perimeter,
      // so the middle of the plan can stay empty. Seed extra loops at the
      // middle of the largest remaining coverage gaps until the grid reads
      // evenly filled (or the door graph runs out of cycles to give).
      var NX = Math.ceil((COLS * CS) / gx), NY = Math.ceil((ROWS * CS) / gy);
      var triedCells = new Set();
      for (var fill = 0; fill < 24; fill++) {
        var gap = null;
        for (var iy = 0; iy < NY; iy++) {
          for (var ix = 0; ix < NX; ix++) {
            var cKey = ix + '_' + iy;
            if (covered.has(cKey) || triedCells.has(cKey)) continue;
            // The cell with the most uncovered in-bounds neighbours is the
            // middle of the deepest gap.
            var open = 0;
            for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
              var nx2 = ix + ox, ny2 = iy + oy;
              if (nx2 < 0 || ny2 < 0 || nx2 >= NX || ny2 >= NY) continue;
              if (!covered.has(nx2 + '_' + ny2)) open++;
            }
            if (!gap || open > gap.open) gap = { key: cKey, ix: ix, iy: iy, open: open };
          }
        }
        if (!gap) break;
        triedCells.add(gap.key);
        addLoopAt((gap.ix + 0.5) * gx, (gap.iy + 0.5) * gy, o.loopMin);
      }
      return { V: V, Hw: Hw, routes: routes };
    }

    function drawRoutes(L) {
      ctx.strokeStyle = o.ink;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (var r = 0; r < L.routes.length; r++) {
        var route = L.routes[r];
        var pts = route.pts;
        ctx.lineWidth = o.routeWidth;
        ctx.setLineDash(o.dash);
        ctx.beginPath();
        for (var p = 0; p < pts.length; p++) {
          if (p) ctx.lineTo(pts[p].x, pts[p].y); else ctx.moveTo(pts[p].x, pts[p].y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = o.ink;
        for (var dd = 0; dd < route.dots.length; dd++) {
          var dot = route.dots[dd];
          ctx.beginPath(); ctx.arc(dot.x, dot.y, o.dotRadius, 0, 7); ctx.fill();
        }
        ctx.lineWidth = 1.4;
        for (var i = 1; i < pts.length; i++) {
          var a = pts[i - 1], b = pts[i];
          var len = Math.hypot(b.x - a.x, b.y - a.y);
          if (len < 40) continue;
          var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          var ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
          ctx.beginPath();
          ctx.moveTo(mx - ux * 2 - uy * o.arrow, my - uy * 2 + ux * o.arrow);
          ctx.lineTo(mx + ux * o.arrow, my + uy * o.arrow);
          ctx.lineTo(mx - ux * 2 + uy * o.arrow, my - uy * 2 - ux * o.arrow);
          ctx.stroke();
        }
      }
    }

    function frame(now) {
      if (!alive) return;
      var el = now - start;
      var CYCLE = o.sweepMs + o.restMs;
      var cn = Math.floor(el / CYCLE);
      if (cn > cyclePrev) { A = B; B = nextL || genLayout(); nextL = null; cyclePrev = cn; }
      var local = el % CYCLE;
      var animate = !reduced.matches;
      // Layout gen costs a frame (~100ms at 1080p). During REST the scene is
      // completely static, so pre-generate the next cycle's layout there —
      // the stall is invisible. Generating lazily at rollover instead would
      // stutter the sweep right as it starts moving.
      if (animate && !nextL && local >= o.sweepMs + 500) nextL = genLayout();

      // Sweep geometry: positions project onto the cycle's leaned direction
      // (s = along travel, t = along the front line); the front is a wavy
      // line s = frontU - wob(t) rather than a straight vertical.
      var P = cycleParams(cn);
      var MW = COLS * CS, MH = ROWS * CS;
      var smin = Infinity, smax = -Infinity, tmin = Infinity, tmax = -Infinity;
      var corners = [[0, 0], [MW, 0], [0, MH], [MW, MH]];
      for (var cc = 0; cc < 4; cc++) {
        var sC = corners[cc][0] * P.dx + corners[cc][1] * P.dy;
        var tC = -corners[cc][0] * P.dy + corners[cc][1] * P.dx;
        if (sC < smin) smin = sC; if (sC > smax) smax = sC;
        if (tC < tmin) tmin = tC; if (tC > tmax) tmax = tC;
      }
      var wobMax = P.w1a + P.w2a;
      function wob(t) { return P.w1a * Math.sin(t * P.w1f + P.w1p) + P.w2a * Math.sin(t * P.w2f + P.w2p); }
      // Advance with a subtle surge/lag (zeroed at both ends so cycle
      // boundaries stay seamless) — the ripple doesn't travel at one speed.
      var u = local / o.sweepMs;
      var uJ = u + 0.05 * Math.sin(u * 7 + P.w2p) * Math.sin(Math.PI * u);
      var frontU = (animate && local < o.sweepMs)
        ? (smin - 220 - wobMax) + ((smax - smin) + 520 + 2 * wobMax) * uJ
        : smax + 300 + wobMax;

      var dpr = global.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H); }
      else { ctx.clearRect(0, 0, W, H); }
      ctx.translate(OX, OY);

      // Walls morph through the sweep front: each segment blends layout A → B.
      var path = new Path2D();
      function seg(mx, my, vert, av, bv) {
        var p = ease((frontU - (mx * P.dx + my * P.dy + wob(-mx * P.dy + my * P.dx))) / 110);
        var s = av * (1 - p) + bv * p;
        if (s < 0.04) return;
        var half = (CS / 2) * Math.min(s, 1);
        if (vert) { path.moveTo(mx, my - half); path.lineTo(mx, my + half); }
        else { path.moveTo(mx - half, my); path.lineTo(mx + half, my); }
      }
      for (var y = 0; y < ROWS; y++) for (var x = 0; x <= COLS; x++)
        if (A.V[y][x] || B.V[y][x]) seg(x * CS, y * CS + CS / 2, true, A.V[y][x], B.V[y][x]);
      for (var y2 = 0; y2 <= ROWS; y2++) for (var x2 = 0; x2 < COLS; x2++)
        if (A.Hw[y2][x2] || B.Hw[y2][x2]) seg(x2 * CS + CS / 2, y2 * CS, false, A.Hw[y2][x2], B.Hw[y2][x2]);
      ctx.strokeStyle = o.wall;
      ctx.lineWidth = o.wallWidth;
      ctx.lineCap = 'square';
      ctx.stroke(path);

      // Routes swap at the front: old layout's ahead of it, new behind it.
      // The clip region follows the wavy front line — a polyline sampled
      // along the front, closed off far behind (new side) or far ahead
      // (old side).
      function clipFront(behind) {
        var N = 28, BIG = (smax - smin) + 600;
        var lo = tmin - 120, hi = tmax + 120;
        var fx0 = 0, fy0 = 0, fxN = 0, fyN = 0;
        ctx.beginPath();
        for (var i = 0; i <= N; i++) {
          var t = lo + (hi - lo) * i / N;
          var sF = frontU - wob(t);
          var px = P.dx * sF - P.dy * t, py = P.dy * sF + P.dx * t;
          if (i) ctx.lineTo(px, py); else { ctx.moveTo(px, py); fx0 = px; fy0 = py; }
          fxN = px; fyN = py;
        }
        var side = behind ? -1 : 1;
        ctx.lineTo(fxN + side * P.dx * BIG, fyN + side * P.dy * BIG);
        ctx.lineTo(fx0 + side * P.dx * BIG, fy0 + side * P.dy * BIG);
        ctx.closePath();
        ctx.clip();
      }
      ctx.save();
      clipFront(false);
      drawRoutes(A);
      ctx.restore();
      ctx.save();
      clipFront(true);
      drawRoutes(B);
      ctx.restore();

      if (animate) rafId = requestAnimationFrame(frame);
    }

    function setup() {
      if (!alive) return;
      W = Math.max(1, container.clientWidth || global.innerWidth);
      H = Math.max(1, container.clientHeight || global.innerHeight);
      var dpr = global.devicePixelRatio || 1;
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
      COLS = Math.max(12, Math.ceil(W / CS)) + o.pad * 2;
      ROWS = Math.max(10, Math.ceil(H / CS)) + o.pad * 2;
      OX = Math.round((W - COLS * CS) / 2);
      OY = Math.round((H - ROWS * CS) / 2);
      // Route budget scales with area; the coverage gate in genLayout stops
      // early when the plan saturates, so this is a ceiling, not a target.
      ROUTES = Math.max(4, Math.min(14, Math.round(W * H / 150000) + 2));
      A = genLayout(); B = genLayout();
      nextL = null;
      start = performance.now();
      cyclePrev = 0;
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
    reduced.addEventListener('change', setup);
    setup();

    return {
      destroy: function () {
        if (!alive) return;
        alive = false;
        cancelAnimationFrame(rafId);
        clearTimeout(rsTimer);
        if (ro) ro.disconnect(); else global.removeEventListener('resize', onResize);
        reduced.removeEventListener('change', setup);
        if (cv.parentNode) cv.parentNode.removeChild(cv);
      },
    };
  }

  global.TSICStoreMaze = {
    mount: mount,
    unmount: function (handle) { if (handle && handle.destroy) handle.destroy(); },
  };
})(window);
