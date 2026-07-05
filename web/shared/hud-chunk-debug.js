// shared/hud-chunk-debug.js — Chunk debug overlay HUD element.
// DOM: #hud-chunk-debug, #chunk-debug-tex (created by hud.js).
// Toggle: console command WebUI.Map.DebugChunks
// Channel: tsic.debug.Map.Overlay (layer='chunks')
//
// Shows a 1-pixel-per-chunk live texture of the world. Each pixel is
// colored by chunk state:
//   Generating — dark blue → bright cyan (by tile completion %)
//   Despawning — orange → transparent (1.5s fade after removal)
//   Not loaded — transparent
(function () {
  var container = document.getElementById('hud-chunk-debug');
  var img = document.getElementById('chunk-debug-tex');
  if (!container || !img) return;

  var refreshTimer = null;
  var BASE_URL = TSIC.runtimeImgUrl('world-debug-chunks');

  function startRefresh() {
    if (refreshTimer) return;
    img.src = BASE_URL + '?t=' + Date.now();
    refreshTimer = setInterval(function () {
      img.src = BASE_URL + '?t=' + Date.now();
    }, 250);
  }

  function stopRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  tsic.on('tsic.debug.Map.Overlay', function (p) {
    if (!p || p.Layer !== 'chunks') return;
    if (p.Visible) {
      container.style.display = 'block';
      startRefresh();
    } else {
      container.style.display = 'none';
      stopRefresh();
    }
  });
})();
