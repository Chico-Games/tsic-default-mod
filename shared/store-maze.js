// shared/store-maze.js — shifting furniture-store maze background motif.
//
// Procedural store floor plan (BSP rooms + doorways) drawn as a thin-line
// blueprint, with dashed "shopper routes" wandering edge-to-edge plus loops
// filling the interior. Every cycle a sweep front crosses the screen and
// morphs the plan into a freshly generated layout: walls shrink/grow as the
// front passes, routes swap behind it. The perimeter stays open so the plan
// reads as an endless store, and the camera drifts slowly along a diagonal
// so the whole plan feels like an aerial pan.
//
// Camera model: layouts are anchored in WORLD cell coordinates (orgX/orgY).
// The camera's path is deterministic (cam = panSpeed * elapsed), so each
// layout is generated to cover exactly the window the camera will see over
// that layout's on-screen lifetime — no tiling, no wrap seams, the plan is
// simply always big enough.
//
// Rendering architecture (perf): the scene is NOT re-stroked every frame.
// Each layout pre-renders its walls and routes ONCE per cycle into offscreen
// layer canvases (world-window-sized, at renderScale). A frame is then:
//   - REST phase: two plain drawImage blits (pure layout-B scene).
//   - SWEEP phase: pure-A and pure-B wall regions blit from the layers under
//     straight conservative clips; only the segments inside the morph band
//     (~110px ease + wobble, found by binary search over a per-cycle sorted
//     segment list) are stroked live. Routes blit from their layers under
//     the same wavy front clip as before.
// Layout generation (~100ms at 1080p) runs in a Blob-URL Web Worker during
// the REST window (sync fallback if workers are unavailable), and the next
// cycle's layers/segment list are also prepared during REST, so cycle
// rollover is a pointer swap — no main-thread generation hitch.
// The rAF loop is throttled to maxFps (the 9px/s pan does not need 60).
//
// Intended as an ambient backdrop for menu screens. Styled to the magazine
// look (see shared/base.css tokens): ink-printed walls and ink shopper
// routes, drawn over a TRANSPARENT canvas by default so the motif sits on
// whatever paper stage the host page provides (tsic-stage--magazine et al).
// Pass opts.bg to paint an opaque backdrop instead. Self-contained canvas —
// no message channels, no external assets. Honors prefers-reduced-motion
// (static plan, no sweep, no pan).
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
    loopMax: 44,           // max rooms per loop (both halves of the ring)
    loopSpan: 540,         // min px between a loop's two furthest rooms —
                           // loops are built by ringing two disjoint paths to
                           // a room at least this far away
    candidates: 14,        // attempts per route, best new-coverage wins
    minNewCoverage: 6,     // a route must claim at least this many fresh
                           // coverage cells or it's rejected (avoids doubling
                           // up on already-busy areas)
    sweepMs: 8000,         // sweep-front travel time
    restMs: 6500,          // hold time between sweeps
    panSpeed: 9,           // camera drift, px/s (0 = static camera)
    panAngle: 0.46,        // camera drift direction, radians (down-right)
    maxFps: 30,            // backdrop frame cap — pan is 9px/s, 60fps is waste
    renderScale: 0.65,     // canvas backing-store scale; upscaled via CSS.
                           // The soft blueprint look tolerates sub-native res
                           // and it cuts raster cost quadratically.
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

  // Wall lookups in WORLD cell coords — out of a layout's window means
  // "no wall there" (the perimeter is open by design).
  function vWall(L, wx, wy) {
    var ix = wx - L.orgX, iy = wy - L.orgY;
    return (ix >= 0 && ix <= L.cols && iy >= 0 && iy < L.rows) ? L.V[iy][ix] : 0;
  }
  function hWall(L, wx, wy) {
    var ix = wx - L.orgX, iy = wy - L.orgY;
    return (ix >= 0 && ix < L.cols && iy >= 0 && iy <= L.rows) ? L.Hw[iy][ix] : 0;
  }

  // Layout generation. SELF-CONTAINED on purpose: no references to anything
  // outside its own scope (only Math/Set/Map and the o/win arguments), so it
  // can be stringified into a Blob-URL Web Worker and run off the main
  // thread — generation costs ~100ms+ at 1080p and would otherwise stutter
  // the menu every cycle.
  function genLayoutCore(win, o) {
    var CS = o.cellSize;
    var cols = win.cols, rows = win.rows;
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
    })(0, 0, cols, rows);

    // Interior walls only — the perimeter stays open so the plan reads as endless.
    var V = [], Hw = [];
    for (var vy = 0; vy < rows; vy++) V.push(new Array(cols + 1).fill(0));
    for (var hy = 0; hy <= rows; hy++) Hw.push(new Array(cols).fill(0));
    for (var ri = 0; ri < rooms.length; ri++) {
      var r = rooms[ri];
      for (var y0 = r.y; y0 < r.y + r.h; y0++) {
        if (r.x > 0) V[y0][r.x] = 1;
        if (r.x + r.w < cols) V[y0][r.x + r.w] = 1;
      }
      for (var x0 = r.x; x0 < r.x + r.w; x0++) {
        if (r.y > 0) Hw[r.y][x0] = 1;
        if (r.y + r.h < rows) Hw[r.y + r.h][x0] = 1;
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

    function touches(rm) { return rm.x === 0 || rm.y === 0 || rm.x + rm.w === cols || rm.y + rm.h === rows; }
    var perim = rooms.map(function (_, i) { return i; }).filter(function (i) { return touches(rooms[i]); });
    var usedRooms = new Set();   // rooms claimed by a route; routes never share rooms

    function inner(d, rm) {
      if (d.vert) return { x: d.x + (Math.abs(d.x - rm.x * CS) < 1 ? CS / 2 : -CS / 2), y: d.y };
      return { x: d.x, y: d.y + (Math.abs(d.y - rm.y * CS) < 1 ? CS / 2 : -CS / 2) };
    }
    function sideDoor(i) {
      var rm = rooms[i], sides = [];
      if (rm.x === 0) sides.push({ vert: true, x: 0, y: (rm.y + rm.h / 2) * CS, out: -1 });
      if (rm.x + rm.w === cols) sides.push({ vert: true, x: cols * CS, y: (rm.y + rm.h / 2) * CS, out: 1 });
      if (rm.y === 0) sides.push({ vert: false, x: (rm.x + rm.w / 2) * CS, y: 0, out: -1 });
      if (rm.y + rm.h === rows) sides.push({ vert: false, x: (rm.x + rm.w / 2) * CS, y: rows * CS, out: 1 });
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

    function roomCenter(i) {
      var rc = rooms[i];
      return { x: (rc.x + rc.w / 2) * CS, y: (rc.y + rc.h / 2) * CS };
    }

    // Greedy randomized path S→T through unclaimed rooms. biasSign bows
    // the path to one side of the S→T line so the ring's two halves take
    // different streets and the loop reads round, not ladder-like. Rooms
    // are marked seen permanently (no re-expansion), keeping a search
    // near-linear in rooms visited.
    function findPath(S, T, blocked, maxLen, biasSign) {
      var sc = roomCenter(S), tc = roomCenter(T);
      var lx = tc.x - sc.x, ly = tc.y - sc.y;
      var ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
      function score(v) {
        var c = roomCenter(v);
        var dT = Math.hypot(c.x - tc.x, c.y - tc.y);
        var lat = (c.x - sc.x) * (-ly) + (c.y - sc.y) * lx;   // signed perp offset
        return dT - biasSign * lat * 0.35 + (Math.random() - 0.5) * CS * 6;
      }
      var seen = new Array(rooms.length).fill(false);
      seen[S] = true;
      var result = null;
      (function dfs(u, trail) {
        if (result || trail.length > maxLen) return;
        if (u === T) { result = trail.slice(); return; }
        // Score once per neighbour, then sort — scoring inside the
        // comparator re-evaluates (and re-randomizes) per comparison.
        var nbs = [];
        for (var n0 = 0; n0 < adj[u].length; n0++) {
          var cand = adj[u][n0];
          if (seen[cand.v] || blocked.has(cand.v) || usedRooms.has(cand.v)) continue;
          nbs.push({ e: cand, s: score(cand.v) });
        }
        nbs.sort(function (p, q) { return p.s - q.s; });
        for (var n = 0; n < nbs.length && !result; n++) {
          var eN = nbs[n].e;
          if (seen[eN.v]) continue;
          seen[eN.v] = true; trail.push(eN); dfs(eN.v, trail); trail.pop();
        }
      })(S, []);
      return result;
    }

    // Big rings on demand: random cycle-hunting rarely closes a large
    // ring, so instead pick a target room at least loopSpan away and join
    // two room-disjoint paths (one bowed each way) into a cycle. Returns
    // { trail, span } like a cycle search would.
    function findLoop(S) {
      var sc = roomCenter(S);
      var targets = [];
      for (var ti = 0; ti < rooms.length; ti++) {
        if (ti === S || usedRooms.has(ti)) continue;
        var tdd = Math.hypot(roomCenter(ti).x - sc.x, roomCenter(ti).y - sc.y);
        if (tdd >= o.loopSpan) targets.push({ i: ti, d: tdd });
      }
      // Nearest target past the span floor = shortest legs = easiest ring.
      targets.sort(function (p, q) { return p.d - q.d; });
      var maxLeg = Math.ceil(o.loopMax / 2) + 2;
      for (var tt = 0; tt < Math.min(6, targets.length); tt++) {
        var T = targets[tt].i;
        var p1 = findPath(S, T, new Set(), maxLeg, 1);
        if (!p1) continue;
        var blocked = new Set();
        for (var b1 = 0; b1 < p1.length - 1; b1++) blocked.add(p1[b1].v);   // interior only
        var p2 = findPath(S, T, blocked, maxLeg, -1);
        if (!p2) continue;
        // trail = S→T via p1, then T→S via p2 reversed (same doors,
        // destination rooms shifted one step back toward S).
        var seq = [S];
        for (var s2 = 0; s2 < p2.length; s2++) seq.push(p2[s2].v);
        var trail = p1.slice();
        for (var k2 = p2.length - 1; k2 >= 0; k2--) trail.push({ v: seq[k2], d: p2[k2].d });
        return { trail: trail, span: targets[tt].d };
      }
      return null;
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

    // Coverage grid: routes are picked to spread over the window. Fine
    // enough (18×12) that "fresh ground" discriminates real gaps, coarse
    // enough that nearby strokes still count as covering the same area.
    var gx = Math.max(1, (cols * CS) / 18), gy = Math.max(1, (rows * CS) / 12);
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

    // Central loop first so it gets the middle of the window — prefer a
    // big ring, settle for the floor.
    var mx0 = cols * CS / 2, my0 = rows * CS / 2;
    if (!addLoopAt(mx0, my0, Math.max(o.loopMin, 8))) addLoopAt(mx0, my0, o.loopMin);

    // Edge-to-edge routes, never reusing a claimed room. Starts are spread
    // out, and a candidate route only lands if it claims enough FRESH
    // coverage cells — otherwise we burn the start and try elsewhere. A few
    // consecutive rejections means the plan is saturated, so stop instead
    // of piling routes onto already-busy areas.
    var ROUTES = Math.max(4, Math.min(16, Math.round((cols * CS) * (rows * CS) / 150000) + 2));
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
    var NX = Math.ceil((cols * CS) / gx), NY = Math.ceil((rows * CS) / gy);
    var triedCells = new Set(), loopFails = 0;
    for (var fill = 0; fill < 24 && loopFails < 5; fill++) {
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
      if (addLoopAt((gap.ix + 0.5) * gx, (gap.iy + 0.5) * gy, o.loopMin)) loopFails = 0;
      else loopFails++;
    }
    return { orgX: win.orgX, orgY: win.orgY, cols: cols, rows: rows, V: V, Hw: Hw, routes: routes };
  }

  // Stroke a layout's routes into a 2d context (layout-local coordinates).
  // Only called when rendering a layout's route LAYER — once per layout per
  // cycle — so the expensive micro-dash pattern is amortized, not per-frame.
  function drawRoutes(c2d, L, o) {
    c2d.strokeStyle = o.ink;
    c2d.lineCap = 'round'; c2d.lineJoin = 'round';
    for (var r = 0; r < L.routes.length; r++) {
      var route = L.routes[r];
      var pts = route.pts;
      c2d.lineWidth = o.routeWidth;
      c2d.setLineDash(o.dash);
      c2d.beginPath();
      for (var p = 0; p < pts.length; p++) {
        if (p) c2d.lineTo(pts[p].x, pts[p].y); else c2d.moveTo(pts[p].x, pts[p].y);
      }
      c2d.stroke();
      c2d.setLineDash([]);
      c2d.fillStyle = o.ink;
      for (var dd = 0; dd < route.dots.length; dd++) {
        var dot = route.dots[dd];
        c2d.beginPath(); c2d.arc(dot.x, dot.y, o.dotRadius, 0, 7); c2d.fill();
      }
      c2d.lineWidth = 1.4;
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        var len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 40) continue;
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        var ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
        c2d.beginPath();
        c2d.moveTo(mx - ux * 2 - uy * o.arrow, my - uy * 2 + ux * o.arrow);
        c2d.lineTo(mx + ux * o.arrow, my + uy * o.arrow);
        c2d.lineTo(mx - ux * 2 + uy * o.arrow, my - uy * 2 - ux * o.arrow);
        c2d.stroke();
      }
    }
  }

  function mount(container, opts) {
    if (!container) return null;
    var o = {};
    for (var k in DEFAULTS) o[k] = DEFAULTS[k];
    for (var ok in (opts || {})) if (ok in DEFAULTS) o[ok] = opts[ok];
    var CS = o.cellSize;
    var RS = o.renderScale;
    // Camera velocity in px/ms.
    var pvx = (o.panSpeed / 1000) * Math.cos(o.panAngle);
    var pvy = (o.panSpeed / 1000) * Math.sin(o.panAngle);

    var cv = document.createElement('canvas');
    cv.className = 'store-maze-canvas';
    cv.style.position = 'absolute';
    cv.style.inset = '0';
    cv.style.display = 'block';
    container.appendChild(cv);
    var ctx = cv.getContext('2d');
    var reduced = global.matchMedia('(prefers-reduced-motion: reduce)');

    var W, H, A, B, start, cyclePrev;
    var nextL = null;       // pre-generated layout for the next cycle
    var nextSegs = null;    // pre-merged wall-segment list for the next cycle
    var P = null;           // current cycle's sweep personality
    var wobMax = 0;
    var segs = null;        // current cycle's wall segments, sorted by ps
    var alive = true, rafId = 0, rsTimer = 0, lastDraw = -1e9;

    // World-cell window covering everything the camera sees between t0 and
    // t1 (ms since start), plus overscan. Layouts are generated per-window
    // and anchored at (orgX, orgY) world cells.
    function windowFor(t0, t1) {
      var minX = Math.min(pvx * t0, pvx * t1) - o.pad * CS;
      var maxX = Math.max(pvx * t0, pvx * t1) + W + o.pad * CS;
      var minY = Math.min(pvy * t0, pvy * t1) - o.pad * CS;
      var maxY = Math.max(pvy * t0, pvy * t1) + H + o.pad * CS;
      var orgX = Math.floor(minX / CS), orgY = Math.floor(minY / CS);
      return {
        orgX: orgX, orgY: orgY,
        cols: Math.max(12, Math.ceil(maxX / CS) - orgX),
        rows: Math.max(10, Math.ceil(maxY / CS) - orgY),
      };
    }

    function genLayout(win) { return genLayoutCore(win, o); }

    // ---- Worker: layout generation off the main thread ----
    // Built from genLayoutCore's own source via a Blob URL, so it needs no
    // separately-served script (CEF custom schemes and file fixtures both
    // just work). `false` = workers unavailable/broken, use sync fallback.
    var worker = null, workerUrl = null, genJob = 0, genPending = false;
    function ensureWorker() {
      if (worker !== null) return worker;
      try {
        var src = 'var genLayoutCore = ' + genLayoutCore.toString() + ';\n' +
          'onmessage = function (e) { postMessage({ id: e.data.id, layout: genLayoutCore(e.data.win, e.data.o) }); };';
        workerUrl = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        worker = new Worker(workerUrl);
        worker.onmessage = function (e) {
          if (!alive || !genPending || e.data.id !== genJob) return;
          genPending = false;
          nextL = e.data.layout;
        };
        worker.onerror = function () {
          genPending = false;
          if (worker) worker.terminate();
          worker = false;
        };
      } catch (err) {
        worker = false;
      }
      return worker;
    }
    function requestGen(win) {
      var w = ensureWorker();
      if (!w) { nextL = genLayout(win); return; }
      genPending = true;
      genJob++;
      w.postMessage({ id: genJob, win: win, o: o });
    }

    // ---- Per-cycle cached layers ----
    // Each layout owns offscreen canvases of its full-strength walls and its
    // routes, rendered once (in layout-local px at renderScale). Frames then
    // composite these with drawImage instead of re-stroking vectors.
    function renderLayers(L) {
      if (L.layers) return;
      var pw = L.cols * CS, ph = L.rows * CS;
      var walls = document.createElement('canvas');
      walls.width = Math.max(1, Math.round(pw * RS));
      walls.height = Math.max(1, Math.round(ph * RS));
      var wc = walls.getContext('2d');
      wc.setTransform(RS, 0, 0, RS, 0, 0);
      var path = new Path2D();
      for (var y = 0; y < L.rows; y++) {
        var row = L.V[y];
        for (var x = 0; x <= L.cols; x++) {
          if (!row[x]) continue;
          path.moveTo(x * CS, y * CS);
          path.lineTo(x * CS, y * CS + CS);
        }
      }
      for (var y2 = 0; y2 <= L.rows; y2++) {
        var hrow = L.Hw[y2];
        for (var x2 = 0; x2 < L.cols; x2++) {
          if (!hrow[x2]) continue;
          path.moveTo(x2 * CS, y2 * CS);
          path.lineTo(x2 * CS + CS, y2 * CS);
        }
      }
      wc.strokeStyle = o.wall;
      wc.lineWidth = o.wallWidth;
      wc.lineCap = 'square';
      wc.stroke(path);

      var routes = document.createElement('canvas');
      routes.width = walls.width;
      routes.height = walls.height;
      var rc = routes.getContext('2d');
      rc.setTransform(RS, 0, 0, RS, 0, 0);
      drawRoutes(rc, L, o);
      L.layers = { walls: walls, routes: routes };
    }

    // Merged wall-segment list for the morph band: every world cell the
    // camera can see this cycle where layout A or B has a wall, with its
    // projection onto the cycle's sweep direction precomputed and sorted so
    // a frame can binary-search just the segments inside the band.
    function buildSegs(cn, LA, LB, Pc) {
      var CYCLE = o.sweepMs + o.restMs;
      var win = windowFor(cn * CYCLE, cn * CYCLE + o.sweepMs);
      var list = [];
      var x1 = win.orgX + win.cols, y1 = win.orgY + win.rows;
      for (var wy = win.orgY; wy < y1; wy++) {
        for (var wx = win.orgX; wx <= x1; wx++) {
          var av = vWall(LA, wx, wy), bv = vWall(LB, wx, wy);
          if (!av && !bv) continue;
          var mx = wx * CS, my = wy * CS + CS / 2;
          list.push({ mx: mx, my: my, vert: true, av: av, bv: bv, ps: mx * Pc.dx + my * Pc.dy });
        }
      }
      for (var hy = win.orgY; hy <= y1; hy++) {
        for (var hx = win.orgX; hx < x1; hx++) {
          var ah = hWall(LA, hx, hy), bh = hWall(LB, hx, hy);
          if (!ah && !bh) continue;
          var mx2 = hx * CS + CS / 2, my2 = hy * CS;
          list.push({ mx: mx2, my: my2, vert: false, av: ah, bv: bh, ps: mx2 * Pc.dx + my2 * Pc.dy });
        }
      }
      list.sort(function (p, q) { return p.ps - q.ps; });
      return list;
    }

    // First index with ps >= lo, first index with ps > hi.
    function segRange(lo, hi) {
      var a = 0, b = segs.length;
      while (a < b) { var m = (a + b) >> 1; if (segs[m].ps < lo) a = m + 1; else b = m; }
      var i0 = a;
      b = segs.length;
      while (a < b) { var m2 = (a + b) >> 1; if (segs[m2].ps <= hi) a = m2 + 1; else b = m2; }
      return [i0, a];
    }

    function prep(cn, preSegs) {
      P = cycleParams(cn);
      wobMax = P.w1a + P.w2a;
      renderLayers(A);
      renderLayers(B);
      segs = preSegs || buildSegs(cn, A, B, P);
    }

    function frame(now) {
      if (!alive) return;
      // Backdrop frame cap: rAF ticks land on display refresh multiples, so
      // accept a tick once it's within ~2ms of the target interval.
      if (now - lastDraw < 1000 / o.maxFps - 2) {
        rafId = requestAnimationFrame(frame);
        return;
      }
      lastDraw = now;

      var el = now - start;
      var CYCLE = o.sweepMs + o.restMs;
      var cn = Math.floor(el / CYCLE);
      if (cn > cyclePrev) {
        // Normal rollover: old B becomes the base and the REST-prepared
        // layout/segs swap in — no generation on this frame. After a long
        // rAF suspension (hidden tab) the stale windows no longer cover the
        // camera, so regenerate both synchronously (rare one-off).
        var skipped = cn - cyclePrev > 1;
        var usePre = !skipped && !!nextL;
        if (!usePre) { genJob++; genPending = false; }   // drop any in-flight worker result
        A = skipped ? genLayout(windowFor(cn * CYCLE, cn * CYCLE + o.sweepMs)) : B;
        B = usePre ? nextL : genLayout(windowFor(cn * CYCLE, (cn + 1) * CYCLE + o.sweepMs));
        var preSegs = usePre ? nextSegs : null;
        nextL = null;
        nextSegs = null;
        cyclePrev = cn;
        prep(cn, preSegs);
      }
      var local = el % CYCLE;
      var animate = !reduced.matches;

      // REST-phase idle work, one chunk per frame so nothing stutters:
      // 1) kick the worker for the next layout, 2) render its layers,
      // 3) pre-merge the next cycle's segment list. By rollover everything
      // is ready and the swap above is pointer shuffling.
      if (animate && local >= o.sweepMs + 500) {
        if (!nextL && !genPending) {
          requestGen(windowFor((cn + 1) * CYCLE, (cn + 2) * CYCLE + o.sweepMs));
        } else if (nextL && !nextL.layers) {
          renderLayers(nextL);
        } else if (nextL && !nextSegs) {
          nextSegs = buildSegs(cn + 1, B, nextL, cycleParams(cn + 1));
        }
      }

      // Camera: slow deterministic diagonal drift. The maze lives in world
      // coordinates; the camera's top-left is at (camX, camY).
      var camX = animate ? pvx * el : 0;
      var camY = animate ? pvy * el : 0;

      ctx.setTransform(RS, 0, 0, RS, 0, 0);
      if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H); }
      else { ctx.clearRect(0, 0, W, H); }
      ctx.translate(-camX, -camY);

      function blit(L, kind) {
        ctx.drawImage(L.layers[kind], L.orgX * CS, L.orgY * CS, L.cols * CS, L.rows * CS);
      }

      var sweeping = animate && local < o.sweepMs;
      if (!sweeping) {
        // REST (and reduced-motion static): the whole scene is pure layout
        // B — two plain blits, no vector work at all.
        blit(B, 'walls');
        blit(B, 'routes');
        if (animate) rafId = requestAnimationFrame(frame);
        return;
      }

      // Sweep geometry: positions project onto the cycle's leaned direction
      // (s = along travel, t = along the front line); the front is a wavy
      // line s = frontU - wob(t) rather than a straight vertical. Projected
      // ranges come from the current VIEWPORT corners (world coords), so the
      // ripple always crosses what's on screen.
      var smin = Infinity, smax = -Infinity, tmin = Infinity, tmax = -Infinity;
      var corners = [[camX, camY], [camX + W, camY], [camX, camY + H], [camX + W, camY + H]];
      for (var cc = 0; cc < 4; cc++) {
        var sC = corners[cc][0] * P.dx + corners[cc][1] * P.dy;
        var tC = -corners[cc][0] * P.dy + corners[cc][1] * P.dx;
        if (sC < smin) smin = sC; if (sC > smax) smax = sC;
        if (tC < tmin) tmin = tC; if (tC > tmax) tmax = tC;
      }
      function wob(t) { return P.w1a * Math.sin(t * P.w1f + P.w1p) + P.w2a * Math.sin(t * P.w2f + P.w2p); }
      // Advance with a subtle surge/lag (zeroed at both ends so cycle
      // boundaries stay seamless) — the ripple doesn't travel at one speed.
      var u = local / o.sweepMs;
      var uJ = u + 0.05 * Math.sin(u * 7 + P.w2p) * Math.sin(Math.PI * u);
      var frontU = (smin - 220 - wobMax) + ((smax - smin) + 520 + 2 * wobMax) * uJ;

      // Conservative straight-line band in s: ahead of sHi every wall is
      // provably pure A (p = 0 even at max wobble), behind sLo provably
      // pure B. Those regions blit from the cached layers; only the band
      // between them is stroked live with the exact per-segment wobble.
      var sLo = frontU - 110 - wobMax, sHi = frontU + wobMax;
      var FAR = (smax - smin) + 600 + wobMax;

      // Clip to the strip s0..s1 (s/t space → world space quad).
      function clipBand(s0, s1) {
        var lo = tmin - 200, hi = tmax + 200;
        ctx.beginPath();
        ctx.moveTo(P.dx * s0 - P.dy * lo, P.dy * s0 + P.dx * lo);
        ctx.lineTo(P.dx * s1 - P.dy * lo, P.dy * s1 + P.dx * lo);
        ctx.lineTo(P.dx * s1 - P.dy * hi, P.dy * s1 + P.dx * hi);
        ctx.lineTo(P.dx * s0 - P.dy * hi, P.dy * s0 + P.dx * hi);
        ctx.closePath();
        ctx.clip();
      }

      ctx.save();
      clipBand(sHi, smax + FAR);
      blit(A, 'walls');
      ctx.restore();
      ctx.save();
      clipBand(smin - FAR, sLo);
      blit(B, 'walls');
      ctx.restore();

      // Live morph band. Segment midpoints within CS of the band bounds are
      // included so segments straddling a clip plane are drawn on both sides
      // (the clip keeps the halves from double-painting).
      ctx.save();
      clipBand(sLo, sHi);
      var range = segRange(sLo - CS, sHi + CS);
      var path = new Path2D();
      for (var si = range[0]; si < range[1]; si++) {
        var sg = segs[si];
        var p = ease((frontU - (sg.ps + wob(-sg.mx * P.dy + sg.my * P.dx))) / 110);
        var s = sg.av * (1 - p) + sg.bv * p;
        if (s < 0.04) continue;
        var half = (CS / 2) * Math.min(s, 1);
        if (sg.vert) { path.moveTo(sg.mx, sg.my - half); path.lineTo(sg.mx, sg.my + half); }
        else { path.moveTo(sg.mx - half, sg.my); path.lineTo(sg.mx + half, sg.my); }
      }
      ctx.strokeStyle = o.wall;
      ctx.lineWidth = o.wallWidth;
      ctx.lineCap = 'square';
      ctx.stroke(path);
      ctx.restore();

      // Routes swap at the front: old layout's ahead of it, new behind it.
      // The clip region follows the wavy front line — a polyline sampled
      // along the front, closed off far behind (new side) or far ahead
      // (old side). Both sides blit from the cached route layers.
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
      blit(A, 'routes');
      ctx.restore();
      ctx.save();
      clipFront(true);
      blit(B, 'routes');
      ctx.restore();

      rafId = requestAnimationFrame(frame);
    }

    function setup() {
      if (!alive) return;
      W = Math.max(1, container.clientWidth || global.innerWidth);
      H = Math.max(1, container.clientHeight || global.innerHeight);
      cv.width = Math.max(1, Math.round(W * RS));
      cv.height = Math.max(1, Math.round(H * RS));
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
      // Restart the clock (camera returns to the world origin) and build the
      // first two layouts around the camera's opening path. This first build
      // is synchronous on purpose — it lands inside the page-load cost.
      var CYCLE = o.sweepMs + o.restMs;
      A = genLayout(windowFor(0, o.sweepMs));
      B = genLayout(windowFor(0, CYCLE + o.sweepMs));
      nextL = null;
      nextSegs = null;
      genJob++;
      genPending = false;
      prep(0);
      start = performance.now();
      cyclePrev = 0;
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
    reduced.addEventListener('change', setup);
    setup();

    return {
      destroy: function () {
        if (!alive) return;
        alive = false;
        cancelAnimationFrame(rafId);
        clearTimeout(rsTimer);
        if (worker) worker.terminate();
        if (workerUrl) URL.revokeObjectURL(workerUrl);
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
