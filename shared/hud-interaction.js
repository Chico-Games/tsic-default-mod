// shared/hud-interaction.js — Interaction target name + divider inside the
// gameplay action-bar panel (#ab-shell-gameplay > #interaction-prompt + #ab-divider).
// Shows the primary interaction target's label and reveals the divider line.
(function () {
  tsic.on('tsic.msg.UI.Interaction.Targets', function (p) {
    var label = document.getElementById('interaction-prompt');
    var divider = document.getElementById('ab-divider');
    if (!label || !divider) return;
    var target = p && p.Targets && p.Targets.find(function (t) { return t.bIsPrimary; });
    if (target) {
      label.textContent = target.Label || 'Interact';
      label.classList.remove('hidden');
      divider.classList.remove('hidden');
    } else {
      label.classList.add('hidden');
      divider.classList.add('hidden');
    }
  });
})();
