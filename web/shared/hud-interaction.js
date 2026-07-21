// shared/hud-interaction.js — Interaction target name + divider inside the
// gameplay behavior-bar panel (#bb-shell-gameplay > #interaction-prompt + #bb-divider).
// Shows the primary interaction target's label, tinted per category with a
// small inline-SVG symbol (Targets[0].Category, bridge field from
// FScpUIInteractionTarget; colours live in hud.js under .cat-<category>).
// Targets may also carry a HoldLabel (hold-interact option, e.g. the shopping
// cart's "Ride"/"Drive") rendered as a second line under the tap label.
(function () {
  // Category → stroke-icon paths (24×24 viewBox, inherit currentColor).
  var CAT_ICONS = {
    crafting: ['m15 12-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9', 'M17.64 15 22 10.64', 'm20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91'],
    production: ['M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'm4.9 4.9 2.1 2.1', 'm17 17 2.1 2.1', 'M19.1 4.9 17 7', 'm7 17-2.1 2.1', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    plantable: ['M7 20h10', 'M12 20v-6', 'M12 14c0-4 3-7 7-7 0 4-3 7-7 7z', 'M12 14c0-4-3-7-7-7 0 4 3 7 7 7z'],
    storage: ['M3 8l9-5 9 5v8l-9 5-9-5z', 'M3 8l9 5 9-5', 'M12 13v8'],
    door: ['M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16', 'M3 21h18', 'M15 12h.01'],
    toggle: ['M12 2v8', 'M18.4 6.6a9 9 0 1 1-12.77.04'],
    loot: ['M6 8h12l1.5 12a1.5 1.5 0 0 1-1.5 1.6H6A1.5 1.5 0 0 1 4.5 20z', 'M9 8a3 3 0 0 1 6 0'],
    shop: ['M12 2H4v8l10 10 8-8z', 'M7.5 6.5h.01'],
    item: ['M12 4v12', 'm7 11 5 5 5-5', 'M5 20h14'],
    interact: ['M12 3l9 9-9 9-9-9z'],
  };

  function catIcon(cat) {
    var paths = CAT_ICONS[cat];
    if (!paths || !window.TSIC || !TSIC.svg || !TSIC.el) return null;
    var svg = TSIC.svg('svg', {
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    });
    for (var i = 0; i < paths.length; i++) svg.appendChild(TSIC.svg('path', { d: paths[i] }));
    var span = TSIC.el('span', { class: 'cat-icon' });
    span.appendChild(svg);
    return span;
  }

  function setLabel(label, target) {
    // Reset previous category tint, keep every other class (e.g. hidden).
    for (var i = label.classList.length - 1; i >= 0; i--) {
      var c = label.classList[i];
      if (c.indexOf('cat-') === 0) label.classList.remove(c);
    }
    while (label.firstChild) label.removeChild(label.firstChild);

    var cat = String(target.Category || '');
    var icon = cat ? catIcon(cat) : null;
    if (icon) {
      label.classList.add('cat-' + cat);
      label.appendChild(icon);
    }
    label.appendChild(document.createTextNode(target.Label || 'Interact'));
  }

  function holdPromptEl(afterEl) {
    var el = document.getElementById('interaction-hold-prompt');
    if (!el && afterEl && afterEl.parentNode) {
      el = TSIC.el('div', { id: 'interaction-hold-prompt', class: 'hidden' });
      afterEl.parentNode.insertBefore(el, afterEl.nextSibling);
    }
    return el;
  }

  tsic.on('tsic.msg.UI.Interaction.Targets', function (p) {
    var label = document.getElementById('interaction-prompt');
    var divider = document.getElementById('bb-divider');
    if (!label || !divider) return;
    var holdLabel = holdPromptEl(label);
    var target = p && p.Targets && p.Targets[0];
    if (target) {
      setLabel(label, target);
      label.classList.remove('hidden');
      divider.classList.remove('hidden');
      if (holdLabel) {
        if (target.HoldLabel) {
          holdLabel.textContent = 'Hold: ' + target.HoldLabel;
          holdLabel.classList.remove('hidden');
        } else {
          holdLabel.classList.add('hidden');
        }
      }
    } else {
      label.classList.add('hidden');
      divider.classList.add('hidden');
      if (holdLabel) holdLabel.classList.add('hidden');
    }
  });
})();
