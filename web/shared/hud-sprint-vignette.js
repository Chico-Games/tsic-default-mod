// shared/hud-sprint-vignette.js — opt-in sprint comfort vignette.
//
// Loaded by hud.js into the #hud-sprint-vignette shell. A soft dark frame fades
// in while the player sprints and fades back out when they stop. Narrowing the
// visible field during fast self-motion is the standard mitigation for motion
// sickness in first-person games — the peripheral optical flow is what most
// people react to, and this covers it up.
//
// OFF by default: it costs a bit of the view, so it is a comfort aid the player
// asks for (Settings -> Gameplay -> Motion & Comfort), never something imposed.
// Built on the same two-radial recipe as hud-stealth.js, but neutral grey-black
// rather than the stealth shroud's blue, so the two never read as the same cue.
//
// The fade itself is a transition, not a loop, so it stays on under Reduce
// Motion — a vignette that snapped on and off would be worse for the very
// player who turned this on.
//
// Channels:
//   tsic.msg.UI.Player.Tags     — full gameplay-tag snapshot; State.Movement.Sprinting
//   tsic.msg.UI.Settings.Value  — accessibility.sprint_vignette (sticky, per key)
(function () {
  var SPRINT_TAG = 'State.Movement.Sprinting';

  var CSS = [
    // Below the stealth shroud (z17) so a stealthed sprint still reads as stealth.
    '#hud-sprint-vignette { position:fixed; inset:0; pointer-events:none; z-index:16;',
    '  opacity:0; transition: opacity 260ms ease; }',
    '#hud-sprint-vignette.sv-on { opacity:1; }',
    '#hud-sprint-vignette .sv-frame { position:absolute; inset:0;',
    '  background:',
    '    radial-gradient(ellipse at center, transparent 46%, rgba(0,0,0,0.38) 82%, rgba(0,0,0,0.62) 100%),',
    '    radial-gradient(ellipse at center, transparent 66%, rgba(0,0,0,0.42) 100%);',
    '}',
  ].join('\n');

  var root = null;
  var enabled = false;
  var sprinting = false;

  function injectStyles() {
    if (document.getElementById('hud-sprint-vignette-styles')) return;
    var s = document.createElement('style');
    s.id = 'hud-sprint-vignette-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function build() {
    root = document.getElementById('hud-sprint-vignette');
    if (!root) return false;
    var frame = document.createElement('div');
    frame.className = 'sv-frame';
    root.appendChild(frame);
    return true;
  }

  function refresh() {
    if (root) root.classList.toggle('sv-on', enabled && sprinting);
  }

  function onTags(p) {
    if (!p || !Array.isArray(p.Tags)) return;
    sprinting = p.Tags.indexOf(SPRINT_TAG) !== -1;
    refresh();
  }

  function onSetting(p) {
    if (!p || p.Key !== 'accessibility.sprint_vignette') return;
    // ValueJson is raw JSON text, not a parsed value.
    enabled = String(p.ValueJson || '').indexOf('true') !== -1;
    refresh();
  }

  (function boot() {
    if (!window.tsic || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
    injectStyles();
    if (!build()) { setTimeout(boot, 16); return; }
    tsic.whenReady(function () {
      tsic.on('tsic.msg.UI.Player.Tags', onTags);
      tsic.on('tsic.msg.UI.Settings.Value', onSetting);
    });
  })();
})();
