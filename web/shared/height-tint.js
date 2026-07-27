// Height-tint overlay data, shared by the live map (shared/screens/map.js) and
// the HUD minimap (shared/hud-minimap.js). Visualises per-tile ground height
// relative to the local player's current height level: tiles on the player's
// level are untinted, tiles above tint progressively lighter (white), tiles
// below progressively darker (black), clamped at +/-4 levels.
//
// Resolution is 1 pixel per tile (WorldSize x WorldSize) — heights come from
// the UI.Map.TileGrid sticky payload (HeightRLE), the same source the hover
// chip's "Floor N" line uses. One small canvas is built per height level and
// cached, so switching levels is a cache lookup + blit; all work happens in
// the CEF renderer process, never on the game thread.
//
// levelPixels() is pure data (no DOM), so it unit-tests cleanly under node.
(function (root) {
  var MAX_OFFSET = 4;
  // Overlay alpha (0-255) per |level offset| step 0..4. Above uses white,
  // below uses black; below is slightly stronger so depth reads as shadow.
  var ABOVE_ALPHA = [0, 28, 48, 68, 88];
  var BELOW_ALPHA = [0, 34, 60, 86, 112];

  // Mirrors the RLE expander in shared/screens/map.js (FRLEEntry: Value/Count).
  function expandRLE(entries, expectedLen) {
    var out = new Array(expectedLen | 0).fill(0);
    if (!Array.isArray(entries)) return out;
    var i = 0;
    for (var e = 0; e < entries.length; e++) {
      var ent = entries[e];
      var v = (ent && ent.Value) | 0;
      var n = (ent && ent.Count) | 0;
      if (n <= 0) continue;
      if (i + n > expectedLen) n = expectedLen - i;
      for (var k = 0; k < n; k++) out[i + k] = v;
      i += n;
      if (i >= expectedLen) break;
    }
    return out;
  }

  // Build a tint store from the UI.Map.TileGrid payload. Returns null when the
  // payload is unusable — callers treat that as "no overlay".
  function build(p) {
    if (!p || !(p.WorldSize > 0)) return null;
    var ws = p.WorldSize | 0;
    return {
      worldSize: ws,
      heights: expandRLE(p.HeightRLE, ws * ws),
      canvases: new Map(),
    };
  }

  // RGBA pixel buffer (Uint8ClampedArray, worldSize^2 * 4) for one player
  // level. Pixel row 0 is the TOP of the texture = highest North index, the
  // same vertical flip the world-map basemap bakes in, so the overlay aligns
  // when stretched over it. Heights are indexed North * worldSize + East.
  function levelPixels(heights, worldSize, level) {
    var out = new Uint8ClampedArray(worldSize * worldSize * 4);
    for (var n = 0; n < worldSize; n++) {
      var rowFromTop = (worldSize - 1) - n;
      for (var e = 0; e < worldSize; e++) {
        var d = (heights[n * worldSize + e] | 0) - level;
        if (d === 0) continue;
        if (d > MAX_OFFSET) d = MAX_OFFSET;
        if (d < -MAX_OFFSET) d = -MAX_OFFSET;
        var i = (rowFromTop * worldSize + e) * 4;
        if (d > 0) {
          out[i] = 255; out[i + 1] = 255; out[i + 2] = 255;
          out[i + 3] = ABOVE_ALPHA[d];
        } else {
          // rgb stays 0 (black)
          out[i + 3] = BELOW_ALPHA[-d];
        }
      }
    }
    return out;
  }

  // Cached per-level canvas (worldSize x worldSize). Null without DOM or store.
  function getCanvas(store, level) {
    if (!store || typeof document === 'undefined') return null;
    var key = level | 0;
    var c = store.canvases.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = store.worldSize;
    c.height = store.worldSize;
    var cx = c.getContext('2d');
    var img = cx.createImageData(store.worldSize, store.worldSize);
    img.data.set(levelPixels(store.heights, store.worldSize, key));
    cx.putImageData(img, 0, 0);
    store.canvases.set(key, c);
    return c;
  }

  // Pre-generate the canvases for the whole ground-height range (0-9) so the
  // first level switch never pays a build. Spread over idle time — each canvas
  // is only worldSize^2 pixels, but there's no reason to block the caller.
  function prebuild(store) {
    if (!store || typeof document === 'undefined') return;
    var level = 0;
    function step() {
      if (level > 9) return;
      getCanvas(store, level);
      level++;
      setTimeout(step, 0);
    }
    step();
  }

  var TSICHeightTint = { build, expandRLE, levelPixels, getCanvas, prebuild, MAX_OFFSET };
  if (root) root.TSICHeightTint = TSICHeightTint;
  if (typeof module !== 'undefined' && module.exports) module.exports = TSICHeightTint;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
