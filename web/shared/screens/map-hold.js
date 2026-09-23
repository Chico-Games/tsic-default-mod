// Map screen: the paper map held up in the world (AScpPaperMapView), not drawn here.
//
// The page covers the whole viewport and takes every mouse event, so the game never hears the
// pointer while a screen is up. This screen is a transparent layer that forwards the pointer to
// C++ (UI.Cmd.Map.Pointer) as viewport fractions: moves at ~60 Hz, buttons and the wheel as they
// happen. The drawn cursor (shared/cursor.js) stays the pointer. Escape closes via cancelCmd;
// UMapViewControllerComponent owns the input situation, so there is no inputModeTag.
(function () {
  'use strict';

  const TEMPLATE = '<div id="mh-layer" style="position:fixed;inset:0;background:transparent;"></div>';

  TSIC.registerScreen('Map', {
    cancelCmd: 'UI.Cmd.GameScreen.Close',
    opaque: false,
    screenSound: false,
    template: TEMPLATE,

    mount(root, ctx) {
      const layer = root.querySelector('#mh-layer');
      const frac = (ev) => ({ X: ev.clientX / Math.max(1, window.innerWidth), Y: ev.clientY / Math.max(1, window.innerHeight) });

      let pending = null;
      let timer = null;
      function flush() {
        timer = null;
        if (!pending) return;
        ctx.publish('UI.Cmd.Map.Pointer', pending);
        pending = null;
      }
      layer.addEventListener('pointermove', (ev) => {
        pending = { Type: 0, Button: 0, Wheel: 0, bCtrl: ev.ctrlKey, ...frac(ev) };
        if (!timer) timer = setTimeout(flush, 16);
      });
      const button = (type) => (ev) => {
        if (ev.pointerType && ev.pointerType !== 'mouse') return;
        ev.preventDefault();
        flush();
        ctx.publish('UI.Cmd.Map.Pointer', { Type: type, Button: ev.button, Wheel: 0, bCtrl: ev.ctrlKey, ...frac(ev) });
      };
      layer.addEventListener('pointerdown', button(1));
      layer.addEventListener('pointerup', button(2));
      layer.addEventListener('wheel', (ev) => {
        ev.preventDefault();
        if (!ev.deltaY) return;
        flush();
        ctx.publish('UI.Cmd.Map.Pointer', { Type: 3, Button: 0, Wheel: ev.deltaY < 0 ? 1 : -1, bCtrl: ev.ctrlKey, ...frac(ev) });
      }, { passive: false });
      layer.addEventListener('contextmenu', (ev) => ev.preventDefault());
      layer.addEventListener('auxclick', (ev) => ev.preventDefault());
    },
  });
})();
