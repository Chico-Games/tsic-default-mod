// shared/wall-patches.js — accumulated furniture-wall overlay for the world map,
// shared by the map screen (shared/screens/map.js) and the HUD minimap
// (shared/hud-minimap.js).
//
// WHY THIS EXISTS
// The world map's basemap is a single ~4096-square PNG served from C++. Furniture
// walls are discovered as chunks stream in, i.e. continuously while the player
// walks — but the basemap <img> is fetched exactly ONCE per element (screens mount
// once; the minimap's <img> is built at HUD boot), and refetching it per chunk
// would mean re-encoding 16.7 M pixels each time. So walls arrive instead as small
// UI.Map.WallPatch messages: a sparse RGBA PNG of just the sub-rectangle a chunk
// touched, which we accumulate onto ONE canvas here.
//
// Pixels outside the wall runs are fully transparent, and written pixels are the
// final composited colours (C++ resolves the multiply-blended wall shadows against
// the floor before sending), so consumers just stamp this canvas over the basemap.
//
// ONE canvas, deliberately: at world resolution it is tens of megabytes in the
// renderer, so the map screen ADOPTS this element into its layer stack rather than
// copying it, and the minimap uses the same node as a drawImage source.
//
// The basemap fetched on mount already contains every patch applied before it, so a
// patch that arrives mid-fetch is at worst redundant — it stamps identical pixels on
// a different layer. There is no ordering protocol to get wrong.
(function (root) {
  var canvas = null;
  var ctx = null;
  var mapSize = 0;
  // Patches decode asynchronously (Image.onload), so they are queued and drained
  // one at a time: overlapping decodes could otherwise land out of order, and a
  // later patch must never be overwritten by an earlier one covering the same
  // pixels.
  var queue = [];
  var draining = false;
  var applied = 0;
  var canvasWaiters = [];
  var appliedListeners = [];
  // Bumped by reset(). A decode already in flight when the world changes must not
  // paint the old world's walls onto the cleared canvas, and clearing the queue alone
  // does not stop the one patch that is mid-decode.
  var generation = 0;

  function ensureCanvas(size) {
    if (!(size > 0) || typeof document === 'undefined') return null;
    if (canvas && mapSize === size) return canvas;
    var created = false;
    if (!canvas) {
      canvas = document.createElement('canvas');
      created = true;
    }
    // Assigning width/height also clears the canvas and resets context state, so
    // this doubles as the "world changed size" path — stale pixels go with it.
    canvas.width = size;
    canvas.height = size;
    mapSize = size;
    ctx = canvas.getContext('2d');
    // Nearest-neighbour: the overlay is stretched well past 1:1 on the map screen
    // and walls are 1-2px features — smoothing turns them into grey smears. Must be
    // re-set after any resize, since that resets the context defaults.
    ctx.imageSmoothingEnabled = false;
    if (created) {
      var waiters = canvasWaiters.slice();
      canvasWaiters.length = 0;
      for (var i = 0; i < waiters.length; i++) {
        try { waiters[i](canvas); } catch (e) { console.warn('[wall-patches] onCanvas', e); }
      }
    }
    return canvas;
  }

  function drain() {
    if (draining) return;
    var next = queue.shift();
    if (!next) return;
    draining = true;
    var startedAt = generation;
    var img = new Image();
    img.onload = function () {
      if (ctx && startedAt === generation) {
        ctx.drawImage(img, next.x, next.y);
        applied++;
        for (var i = 0; i < appliedListeners.length; i++) {
          try { appliedListeners[i](); } catch (e) { console.warn('[wall-patches] onApplied', e); }
        }
      }
      draining = false;
      drain();
    };
    img.onerror = function () {
      console.warn('[wall-patches] failed to decode patch at', next.x, next.y);
      draining = false;
      drain();
    };
    img.src = 'data:image/png;base64,' + next.png;
  }

  // Apply one UI.Map.WallPatch payload. Bools keep their C++ `b` prefix over the
  // bridge, hence p.bReset (not p.Reset).
  function apply(p) {
    if (!p) return;
    if (p.bReset) {
      reset();
      if (p.MapSize > 0) ensureCanvas(p.MapSize | 0);
      return;
    }
    if (!p.Png || !(p.W > 0) || !(p.H > 0)) return;
    if (!ensureCanvas((p.MapSize | 0) || mapSize)) return;
    queue.push({ x: p.X | 0, y: p.Y | 0, png: p.Png });
    drain();
  }

  function reset() {
    queue.length = 0;
    applied = 0;
    generation++;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // The live canvas element, or null before the first patch. Consumers must
  // tolerate null: on a world with no furniture walls it never gets created.
  function getCanvas() {
    return canvas;
  }

  // Invoked once with the canvas, as soon as it exists (immediately if it already
  // does). The map screen uses this to ADOPT the element into its layer stack — it
  // can mount long before or long after the first patch arrives, and there is only
  // ever one canvas to place.
  function onCanvas(cb) {
    if (typeof cb !== 'function') return;
    if (canvas) {
      cb(canvas);
      return;
    }
    canvasWaiters.push(cb);
  }

  // Fired after each patch is drawn. Needed by consumers that COPY these pixels
  // rather than displaying the canvas directly (the minimap blits into its own
  // canvas, and its redraw loop idles while the player stands still) — the map
  // screen displays this element live and needs no notification.
  function onApplied(cb) {
    if (typeof cb === 'function') appliedListeners.push(cb);
  }

  // Debug/verification aid: WebUI.EvalJS Root "TSICWallPatches.stats()".
  function stats() {
    return { mapSize: mapSize, applied: applied, queued: queue.length };
  }

  var TSICWallPatches = { apply, reset, getCanvas, onCanvas, onApplied, stats };
  if (root) root.TSICWallPatches = TSICWallPatches;
  if (typeof module !== 'undefined' && module.exports) module.exports = TSICWallPatches;

  // Subscribed here rather than in each consumer: the patch stream must be applied
  // exactly once, and both the map screen and the minimap read the same canvas.
  //
  // Polled rather than a bare tsic.on(): this file is a deferred <script>, so it can
  // run before the C++ bridge (or the test harness mock) has stamped window.tsic —
  // and unlike the HUD components, nothing sequences it after readiness. Mirrors
  // tsic.whenReady's own poll so it works without tsic-runtime.js being installed yet.
  function subscribe() {
    if (!root) return;
    var t = root.tsic;
    if (t && typeof t.on === 'function') {
      t.on('tsic.msg.UI.Map.WallPatch', apply);
      return;
    }
    setTimeout(subscribe, 16);
  }
  // Guarded on `document`: under node (headless test harness) there is no bridge to
  // wait for, and an open poll would keep the process alive forever.
  if (typeof document !== 'undefined') subscribe();
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
