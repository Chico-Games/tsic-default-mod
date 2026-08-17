// shared/hud-crosshair.js — Crosshair dot visibility + look-target affordances.
// DOM: #hud-crosshair + #hud-crosshair-hand (created by hud.js; the hand is
// created here when missing so the test host page stays minimal).
// Hides when input mode switches to menu/UI mouse. The dot itself stays fully
// opaque; the look target's category (Targets[0].Category, bridge field from
// FScpUIInteractionTarget) is stamped as data-cat to drive a subtle per-category
// halo animation (styles in hud.js). A slightly transparent hand icon appears
// beside the dot while looking at a draggable target and tightens while
// dragging (both flags ride on UI.Interaction.Targets; bridge bools keep
// their b-prefix). A second glyph (#hud-crosshair-cat) sits nearest the dot and
// shows the look target's category symbol (loot/storage/door/…), tinted to match
// the interaction panel — so a lootable vs a storage vs a door read differently
// at a glance. The icon is shared with the panel via TSIC.categoryIcon (icons.js).
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

  // Category glyph beside the dot. Created here when missing so the test host
  // page stays minimal; the SVG is (re)built when the category changes.
  function catEl(dot) {
    var cel = document.getElementById('hud-crosshair-cat');
    if (!cel && dot && dot.parentNode && window.TSIC && TSIC.el) {
      cel = TSIC.el('div', { id: 'hud-crosshair-cat' });
      dot.parentNode.insertBefore(cel, dot.nextSibling);
    }
    return cel;
  }

  function setCatGlyph(cel, cat) {
    if (cel.dataset.cat === cat) return; // unchanged — keep the decoded SVG
    cel.dataset.cat = cat;
    for (var i = cel.classList.length - 1; i >= 0; i--) {
      var c = cel.classList[i];
      if (c.indexOf('cat-') === 0) cel.classList.remove(c);
    }
    while (cel.firstChild) cel.removeChild(cel.firstChild);
    var svg = (window.TSIC && TSIC.categoryIcon) ? TSIC.categoryIcon(cat) : null;
    if (svg) {
      cel.classList.add('cat-' + cat);
      cel.appendChild(svg);
    }
  }

  // Hide the crosshair whenever the UI owns the mouse — same rule cursor.js uses to
  // decide the opposite (see GAMEPLAY_SCREENS there); the two are complementary, so
  // they must agree or you get both or neither.
  //
  // This used to key off UI.Input.Mode.Changed and read `p.Device === 'mouse' &&
  // p.Focus === 'ui'`. FScpUIInputMode carries ONE field, `Mode` ("Gamepad" |
  // "MouseAndKeyboard") — Device and Focus have never existed on it, so the
  // condition was always false and the crosshair stayed lit over the map, the
  // inventory and every other screen. Nothing caught it: the mismatch is silent on
  // the bridge, and no test covered the hide-in-menus behaviour.
  var GAMEPLAY_SCREENS = { InGame: 1, Boot: 1, Loading: 1 };
  var currentScreen = 'InGame';
  var overlayCount = 0;

  function applyCrosshairVisibility() {
    var dot = document.getElementById('hud-crosshair');
    if (!dot) return;
    var uiHasMouse = overlayCount > 0 || !GAMEPLAY_SCREENS[currentScreen];
    dot.classList.toggle('hidden', uiHasMouse);
    var hand = document.getElementById('hud-crosshair-hand');
    if (hand) hand.classList.toggle('hidden', uiHasMouse);
    var cel = document.getElementById('hud-crosshair-cat');
    if (cel) cel.classList.toggle('hidden', uiHasMouse);
    // The progress collar + its completion bloom (hud-circular-progress.js) are
    // crosshair furniture too — without this they float over an open menu.
    var prog = document.getElementById('hud-crosshair-progress');
    if (prog) prog.classList.toggle('hidden', uiHasMouse);
    var bloom = document.getElementById('hud-crosshair-bloom');
    if (bloom) bloom.classList.toggle('hidden', uiHasMouse);
  }

  tsic.on('tsic.msg.UI.Screen.Changed', function (p) {
    if (!p || !p.Name) return;
    currentScreen = String(p.Name);
    applyCrosshairVisibility();
  });

  tsic.on('tsic.msg.UI.Overlay.Changed', function (p) {
    overlayCount = (p && p.Stack && p.Stack.length) || 0;
    applyCrosshairVisibility();
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

    // Category glyph shows whenever there's an interactable look target; hidden
    // while dragging (the hand tells the whole story then).
    var cel = catEl(dot);
    if (cel) {
      var showCat = !!target && !!cat && !dragging;
      if (showCat) setCatGlyph(cel, cat);
      cel.classList.toggle('visible', showCat);
    }
  });
})();
