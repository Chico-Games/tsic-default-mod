// shared/store-maze-stage.js — drop-in ambient store-maze backdrop for menu
// pages built on the .tsic-stage--magazine-gradient stage.
//
// Include AFTER store-maze.js on any menu page:
//   <script src="/shared/store-maze.js" defer></script>
//   <script src="/shared/store-maze-stage.js" defer></script>
//
// It finds the gradient stage, switches off the stage's halftone dot layers
// (the drifting plan is the texture now), pins the cream paper wash to a
// uniform opacity across every non-gameplay menu, inserts a full-bleed maze
// layer behind the cover panel (absolute, z-index -2, inside the isolated
// stage so it sits above the paper wash but below the panel), and mounts the
// maze at its default strength. No-op if the page has no such stage.
(function (global) {
  // Shared cream-wash opacity for all menu backdrops (matches the old
  // loading-screen value). One number here keeps every menu consistent.
  var PAPER_ALPHA = '0.92';

  function boot() {
    if (!global.TSICStoreMaze) { setTimeout(boot, 16); return; }
    var stage = document.querySelector('.tsic-stage--magazine-gradient');
    if (!stage) { setTimeout(boot, 16); return; }
    if (stage.querySelector('.menu-maze-layer')) return;   // already mounted

    // Kill the stage's halftone dot layers — the maze is the texture now —
    // and unify the paper wash opacity across menus (overrides any inline).
    stage.style.setProperty('--tsic-stage-dot-strength', '0');
    stage.style.setProperty('--tsic-stage-paper-alpha', PAPER_ALPHA);

    var layer = document.createElement('div');
    layer.className = 'menu-maze-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:absolute; inset:0; z-index:-2; pointer-events:none;';
    stage.insertBefore(layer, stage.firstChild);

    global.TSICStoreMaze.mount(layer);
  }
  boot();
})(window);
