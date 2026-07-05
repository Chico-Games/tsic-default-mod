// shared/hud-screen-fade.js — full-screen black fade driven by UI.Screen.Fade.
// Payload: { Mode: 'Out'|'In', DurationMs: number }. 'Out' covers the screen
// (death sequence), 'In' reveals the game again (fires on pawn possession,
// including respawn). The overlay sits above all HUD chrome and never takes
// pointer events.
(function () {
  function ensureOverlay() {
    var e = document.getElementById('screen-fade');
    if (e) return e;
    e = document.createElement('div');
    e.id = 'screen-fade';
    e.style.cssText =
      'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:100;';
    document.body.appendChild(e);
    return e;
  }

  tsic.on('tsic.msg.UI.Screen.Fade', function (p) {
    if (!p || !p.Mode) return;
    var overlay = ensureOverlay();
    var ms = Math.max(0, Number(p.DurationMs) || 1000);
    overlay.style.transition = 'opacity ' + ms + 'ms ease-in-out';
    // Flush styles so a transition set in the same frame still animates.
    void overlay.offsetWidth;
    overlay.style.opacity = String(p.Mode).toLowerCase() === 'out' ? '1' : '0';
  });
})();
