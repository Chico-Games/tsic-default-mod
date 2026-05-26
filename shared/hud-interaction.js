// shared/hud-interaction.js — Interaction prompt ("Press E to Open").
// DOM: #interaction-prompt (created by hud.js).
// Shows the primary interaction target's label.
(function () {
  tsic.on('tsic.msg.UI.Interaction.Targets', function (p) {
    var el = document.getElementById('interaction-prompt');
    if (!el) return;
    var target = p && p.Targets && p.Targets.find(function (t) { return t.bIsPrimary; });
    if (target) { el.textContent = target.Label || 'Interact'; el.style.display = ''; }
    else { el.style.display = 'none'; }
  });
})();
