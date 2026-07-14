// shared/hud-stealth.js — Stealth vignette overlay.
//
// Loaded by hud.js into the #hud-stealth shell. Fades a soft darkened vignette
// in around the screen edges while the player is stealthed (crouched long
// enough for the crouch ability to apply Status.Stealth), and fades it back
// out when the tag drops (uncrouching ends the crouch ability, which removes
// the tag).
//
// Channel: tsic.msg.UI.Player.Tags — full gameplay-tag snapshot on any change.
(function () {
  var STEALTH_TAG = 'Status.Stealth';

  var CSS = [
    // Under the blood overlays (low-health z18, hit-reaction z19) so damage
    // feedback always reads over the stealth shroud.
    '#hud-stealth { position:fixed; inset:0; pointer-events:none; z-index:17;',
    '  opacity:0; transition: opacity 700ms ease; }',
    '#hud-stealth.st-on { opacity:1; }',

    // Two stacked radial falloffs: a wide soft shading that creeps toward the
    // centre plus a tighter, darker rim right at the edges. Slightly blue-black
    // so it reads as "shadow" rather than damage.
    '#hud-stealth .st-vignette { position:absolute; inset:0;',
    '  background:',
    '    radial-gradient(ellipse at center, transparent 42%, rgba(6,9,16,0.42) 78%, rgba(4,6,12,0.62) 100%),',
    '    radial-gradient(ellipse at center, transparent 62%, rgba(2,3,8,0.5) 100%);',
    '}',

    // A very slow breathing on the shroud while stealthed — alive, not static.
    '#hud-stealth.st-on .st-vignette { animation: st-breathe 4.6s ease-in-out infinite; }',
    '@keyframes st-breathe {',
    '  0%,100% { opacity:0.92; }',
    '  50% { opacity:1; }',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  #hud-stealth.st-on .st-vignette { animation:none; opacity:1; }',
    '}',
  ].join('\n');

  var root = null;

  function injectStyles() {
    if (document.getElementById('hud-stealth-styles')) return;
    var s = document.createElement('style');
    s.id = 'hud-stealth-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function build() {
    root = document.getElementById('hud-stealth');
    if (!root) return false;
    var v = document.createElement('div');
    v.className = 'st-vignette';
    root.appendChild(v);
    return true;
  }

  function onTags(p) {
    if (!root || !p || !Array.isArray(p.Tags)) return;
    root.classList.toggle('st-on', p.Tags.indexOf(STEALTH_TAG) !== -1);
  }

  (function boot() {
    if (!window.tsic || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
    injectStyles();
    if (!build()) { setTimeout(boot, 16); return; }
    tsic.whenReady(function () {
      tsic.on('tsic.msg.UI.Player.Tags', onTags);
    });
  })();
})();
