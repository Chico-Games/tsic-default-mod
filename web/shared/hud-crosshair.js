// shared/hud-crosshair.js — Crosshair dot visibility + look-target affordances.
// DOM: #hud-crosshair + #hud-crosshair-hand (created by hud.js; the hand is
// created here when missing so the test host page stays minimal).
// Hides when input mode switches to menu/UI mouse. The dot itself stays fully
// opaque; the look target's category (Targets[0].Category, bridge field from
// FScpUIInteractionTarget) is stamped as data-cat to drive a subtle per-category
// halo animation (styles in hud.js). A slightly transparent hand icon appears
// beside the dot while looking at a draggable target and tightens while
// dragging (both flags ride on UI.Interaction.Targets; bridge bools keep
// their b-prefix).
(function () {
  var HAND_PATHS = [
    'M18 11V6a2 2 0 0 0-4 0v5',
    'M14 10V4a2 2 0 0 0-4 0v6',
    'M10 10.5V6a2 2 0 0 0-4 0v8',
    'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
  ];

  function handEl(dot) {
    var hand = document.getElementById('hud-crosshair-hand');
    if (!hand && dot && dot.parentNode && window.TSIC && TSIC.el) {
      hand = TSIC.el('div', { id: 'hud-crosshair-hand' });
      dot.parentNode.insertBefore(hand, dot.nextSibling);
    }
    if (hand && !hand.firstChild && window.TSIC && TSIC.svg) {
      var svg = TSIC.svg('svg', {
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      });
      for (var i = 0; i < HAND_PATHS.length; i++) svg.appendChild(TSIC.svg('path', { d: HAND_PATHS[i] }));
      hand.appendChild(svg);
    }
    return hand;
  }

  tsic.on('tsic.msg.UI.Input.Mode.Changed', function (p) {
    var dot = document.getElementById('hud-crosshair');
    if (!dot || !p) return;
    var isMenuMode = String(p.Device || '') === 'mouse' && String(p.Focus || '') === 'ui';
    dot.classList.toggle('hidden', isMenuMode);
    var hand = document.getElementById('hud-crosshair-hand');
    if (hand) hand.classList.toggle('hidden', isMenuMode);
  });

  tsic.on('tsic.msg.UI.Interaction.Targets', function (p) {
    var dot = document.getElementById('hud-crosshair');
    if (!dot || !p) return;
    var dragging = !!p.bDragging;
    dot.classList.toggle('dragging', dragging);
    dot.classList.toggle('draggable', !dragging && !!p.bDraggable);

    var target = p.Targets && p.Targets[0];
    var cat = target ? String(target.Category || 'interact') : '';
    if (cat) dot.setAttribute('data-cat', cat);
    else dot.removeAttribute('data-cat');

    var hand = handEl(dot);
    if (hand) {
      hand.classList.toggle('visible', dragging || !!p.bDraggable);
      hand.classList.toggle('dragging', dragging);
    }
  });
})();
