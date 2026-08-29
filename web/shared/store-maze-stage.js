// shared/store-maze-stage.js — drop-in ambient store-maze backdrop for menu
// pages built on the .tsic-stage--magazine-gradient stage.
//
// Include AFTER store-maze.js on any menu page:
//   <script src="/shared/store-maze.js" defer></script>
//   <script src="/shared/store-maze-stage.js" defer></script>
//
// It finds the gradient stage, inserts a full-bleed maze layer behind the
// cover panel (absolute, z-index -2, inside the isolated stage so it sits
// above the paper wash but below the panel), and mounts the maze at its
// default strength. No-op if the page has no such stage.
//
// The stage's OWN look — cream paper opacity, halftone strength, and the
// solid data-paper-alpha="1" variant — is authored in shared/base.css, not
// here. This script is deferred and waits on the maze module, so anything it
// sets lands several frames after the stage is already on screen; setting the
// paper wash from here is what let the game world show through every menu for
// a moment on each navigation (#150).
(function (global) {
  function boot() {
    if (!global.TSICStoreMaze) { setTimeout(boot, 16); return; }
    var stage = document.querySelector('.tsic-stage--magazine-gradient');
    if (!stage) { setTimeout(boot, 16); return; }
    if (stage.querySelector('.menu-maze-layer')) return;   // already mounted

    var layer = document.createElement('div');
    layer.className = 'menu-maze-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.style.cssText = 'position:absolute; inset:0; z-index:-2; pointer-events:none;';
    stage.insertBefore(layer, stage.firstChild);

    global.TSICStoreMaze.mount(layer);
  }
  boot();
})(window);
