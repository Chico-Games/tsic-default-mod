// shared/hud-crosshair.js — Crosshair dot visibility + drag affordance.
// DOM: #hud-crosshair (created by hud.js).
// Hides when input mode switches to menu/UI mouse. Shows a faint ring while
// looking at a draggable target and a solid ring while dragging (both flags
// ride on UI.Interaction.Targets; bridge bools keep their b-prefix).
(function () {
  tsic.on('tsic.msg.UI.Input.Mode.Changed', function (p) {
    var dot = document.getElementById('hud-crosshair');
    if (!dot || !p) return;
    var isMenuMode = String(p.Device || '') === 'mouse' && String(p.Focus || '') === 'ui';
    dot.classList.toggle('hidden', isMenuMode);
  });

  tsic.on('tsic.msg.UI.Interaction.Targets', function (p) {
    var dot = document.getElementById('hud-crosshair');
    if (!dot || !p) return;
    var dragging = !!p.bDragging;
    dot.classList.toggle('dragging', dragging);
    dot.classList.toggle('draggable', !dragging && !!p.bDraggable);
  });
})();
