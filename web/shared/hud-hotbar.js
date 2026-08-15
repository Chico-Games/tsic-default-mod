// shared/hud-hotbar.js — In-game HUD hotbar (the "showroom shelf").
//
// THE HOTBAR IS THE FIRST EIGHT GRID CELLS OF THE PLAYER INVENTORY. Nothing is assigned to it:
// this view reads the inventory snapshot and draws whatever sits in GridSlot 0..NumSlots-1. A
// player moves an item onto the bar by moving it into one of those cells, in the inventory
// screen, exactly like any other grid move.
//
// THIS BAR IS A READ-ONLY MIRROR OF THOSE CELLS — it is never the editing surface. Editing
// happens on the hotbar strip along the bottom of the inventory/storage panel, where the cells
// sit next to the bag they trade with. This bar's only gesture is click-to-draw/stow, and while
// a screen is open the overlay covers it, so there is exactly one place a stack can be dragged
// onto the bar and it is inside the panel the player is already looking at.
//
// Each slot is a teak-laminate plinth on a brushed-brass shelf; the SELECTED
// slot scales up and lifts off the shelf with a warm gold spotlight.
//
// Above the shelf sits the NAME of whatever the selected cell holds — icons alone do not
// always say what a thing is (issue #245), and the name is the one piece of an item's
// identity the bar can afford to spell out. It is absolutely positioned off the row's top
// edge, so it never moves a slot: an item with a two-line name and an empty cell leave the
// shelf in exactly the same place.
//
// Channels:
//   tsic.msg.UI.Hotbar.Changed    { NumSlots, SelectedSlot, SelectedSlotPending }
//   tsic.msg.UI.Inventory.Updated (OwnerId === 'Player') → cell contents
// Commands published:
//   UI.Cmd.Hotbar.Select { SlotIndex }   (re-selecting the current cell toggles stow/draw)
// Depends on: window.TSIC.itemIconUrl (icons.js), window.tsic.itemName (catalog.js)
(function () {
  // ── Styling (scoped to #hotbar-row) ──
  // Matches the liquid health/stamina vials: dark translucent glass, heavy ink
  // outline + hard offset block shadow (magazine "bold outline" look), cream
  // serif text, soft inset highlight + glare. The SELECTED slot scales up off
  // the row with a warm gold glow + brightened rim.
  var CSS = [
    // Register --mag/--lift as typed custom props so transitions interpolate
    // them — an unregistered var() would just snap the transform/box-shadow.
    '@property --mag { syntax: "<number>"; inherits: false; initial-value: 1; }',
    '@property --lift { syntax: "<length>"; inherits: false; initial-value: 0px; }',
    '#hotbar-row { position:relative; display:flex; align-items:flex-end; gap:8px; padding:18px 4px 4px; background:transparent; }',
    '#hotbar-row .tsic-slot { position:relative; width:56px; height:56px; font-family:var(--font-body); color:#f0e7d4;',
    '  background: linear-gradient(180deg, rgba(58,40,34,0.30), rgba(14,9,8,0.40)); border:2px solid var(--ink-night); border-radius:11px;',
    '  --mag:1; --lift:0px; transform-origin:bottom center; transform: translateY(var(--lift)) scale(var(--mag));',
    '  box-shadow: inset 0 1px 0 rgba(255,250,240,0.16), inset 0 0 12px rgba(0,0,0,0.50), var(--shadow-block-sm),',
    '    0 calc((var(--mag) - 1) * 22px) calc((var(--mag) - 1) * 28px) rgba(0,0,0,0.45),',
    '    0 0 calc((var(--mag) - 1) * 40px) rgba(240,220,170, calc((var(--mag) - 1) * 1.4));',
    /* Springy grow/shrink as selection moves — animate the registered vars so
       the transform + box-shadow that read them recompute every frame. */
    '  transition: --mag 230ms cubic-bezier(0.34,1.56,0.64,1), --lift 230ms cubic-bezier(0.34,1.56,0.64,1), border-color 150ms ease; }',
    '#hotbar-row .tsic-slot:hover { transform: translateY(var(--lift)) scale(var(--mag)); }',
    '/* Top glare, matching the vial glass. */',
    '#hotbar-row .tsic-slot::before { content:""; position:absolute; left:0; right:0; top:0; height:46%; border-radius:11px 11px 0 0; pointer-events:none;',
    '  background: linear-gradient(180deg, rgba(255,250,240,0.14), transparent); }',
    '#hotbar-row .tsic-slot img { position:relative; width:100%; height:100%; object-fit:contain; padding:8px; pointer-events:none;',
    '  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.6)); }',
    '#hotbar-row .tsic-slot.selected { --mag:1.16; --lift:-5px; border-color:rgba(224,208,170,0.95); }',
    /* Deselected: the current cell with empty hands — either deliberately stowed, or holding
       something you can't hold (nothing, armour, a crafting material). Same lift/scale so it
       still reads as current, but a muted rim and a greyed, see-through item. */
    '#hotbar-row .tsic-slot.selected-inactive { --mag:1.16; --lift:-5px; border-color:rgba(150,145,135,0.85); }',
    '#hotbar-row .tsic-slot.selected-inactive img { filter:grayscale(0.65) drop-shadow(0 2px 3px rgba(0,0,0,0.6)); opacity:0.6; }',
    '#hotbar-row .tsic-slot .key { position:absolute; top:3px; left:4px; min-width:15px; padding:0 4px; pointer-events:none;',
    '  font-family:var(--font-display); font-size:14px; font-weight:700; line-height:1.35; letter-spacing:0.02em; text-align:center; color:#f3ecda; text-shadow:0 1px 2px rgba(0,0,0,0.95);',
    '  background:rgba(14,9,8,0.62); border:1px solid var(--ink-night); border-radius:5px; }',
    '#hotbar-row .tsic-slot.selected .key { color:#fff; border-color:rgba(224,208,170,0.90); }',
    '#hotbar-row .tsic-slot .count { position:absolute; bottom:3px; right:4px; top:auto; left:auto; pointer-events:none;',
    '  font-family:var(--font-display); font-size:12px; font-weight:700; line-height:1; letter-spacing:0.02em; padding:2px 4px; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.95);',
    '  background:rgba(14,9,8,0.70); border:1px solid var(--ink-night); border-radius:5px; }',

    /* Held-item name. Out of flow (bottom:100% of the fixed #hud-hotbar) so it contributes
       nothing to the shelf's layout, and centred over it. Cream serif on an ink shadow, the
       same treatment as the slot key chips — no plate, so it reads as a caption on the bar
       rather than a second widget. */
    '#hotbar-name { position:absolute; bottom:100%; left:50%; transform:translateX(-50%); max-width:520px;',
    '  padding:0 6px 4px; pointer-events:none; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;',
    '  font-family:var(--font-display); font-size:16px; font-weight:700; letter-spacing:0.04em; color:#f3ecda;',
    '  text-shadow:0 1px 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.7);',
    '  opacity:0; transition:opacity 160ms ease; }',
    '#hotbar-name.visible { opacity:1; }',
    /* Stowed, or a cell holding something the hands cannot take — the slot itself greys out,
       so the caption does too rather than claiming the item is in hand. */
    '#hotbar-name.stowed { color:#cfc8bb; opacity:0.75; }',
    'html[data-tsic-reduce-motion] #hotbar-name { transition:none; }',

    /* A panel that shows the bag draws these same eight cells itself, as a strip inside the
       panel where they can actually be edited. Leaving this bar up would put a second copy
       of them on screen — outside the panel, under its scrim, looking like a drop target and
       being inert — which is the confusion players reported (issue #203). */
    'body.tsic-bag-open #hud-hotbar { display:none !important; }',
  ].join('\n');

  var DEFAULT_SLOT_COUNT = 8;

  function injectStyles() {
    if (document.getElementById('hud-hotbar-styles')) return;
    var s = document.createElement('style');
    s.id = 'hud-hotbar-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── State ──
  var lastHotbar = null;
  // Signature of the last fully-rendered contents (each cell's item id/count — NOT the
  // selection). A change that leaves this equal (e.g. just moving the selection) reuses the
  // existing DOM so the CSS transition animates the grow/shrink; a real change rebuilds.
  var lastContentKey = null;
  var playerItemsBySlot = new Map();

  // Ammo badge clamps each side to two digits — "99/99" is the widest it draws.
  function cap2(n) { n = (typeof n === 'number' && n > 0) ? n : 0; return n > 99 ? 99 : n; }
  // True when this item is ammo-using equipment (C++ sends -1 for everything else).
  function usesAmmo(item) { return item && typeof item.LoadedAmmo === 'number' && item.LoadedAmmo >= 0; }

  function publish(tag, payload) {
    if (window.tsic && window.tsic.publishMessage) window.tsic.publishMessage(tag, payload);
  }
  function slotCount() {
    var n = lastHotbar && lastHotbar.NumSlots;
    return (typeof n === 'number' && n > 0) ? n : DEFAULT_SLOT_COUNT;
  }
  function contentKey() {
    var parts = [];
    for (var i = 0; i < slotCount(); i++) {
      var item = playerItemsBySlot.get(i);
      var key = String(i);
      if (item && item.ItemId) {
        key += ':' + item.ItemId + 'x' + (item.Count || 1);
        // Fold ammo into the signature so loading/firing/picking-up ammo forces a rebuild.
        if (usesAmmo(item)) key += 'a' + item.LoadedAmmo + '/' + (item.SpareAmmo || 0);
      }
      parts.push(key);
    }
    return parts.join('|');
  }

  // Display name for a hotbar item. The catalog is the source of truth; before it lands
  // (or for an item the pack never described) fall back to prettifying the id, which is
  // the same last resort every other surface uses — never a raw ID_Foo_EQ in front of a
  // player, and never a blank caption under a filled slot.
  function itemDisplayName(item) {
    if (!item || !item.ItemId) return '';
    var name = (window.tsic && typeof tsic.itemName === 'function') ? tsic.itemName(item.ItemId) : '';
    if (name && name !== item.ItemId) return name;
    if (window.TSIC && typeof TSIC.prettifyDefinitionName === 'function') {
      return TSIC.prettifyDefinitionName(item.ItemId);
    }
    return item.ItemId;
  }

  // Hosted by whatever wraps the row — #hud-hotbar in the live HUD, #root on the standalone
  // preview page. Keyed off the row rather than off #hud-hotbar by id so the two surfaces
  // cannot drift: the caption exists wherever the shelf does.
  function nameEl() {
    var row = document.getElementById('hotbar-row');
    var host = row && row.parentNode;
    if (!host) return null;
    var label = document.getElementById('hotbar-name');
    if (!label) {
      label = document.createElement('div');
      label.id = 'hotbar-name';
      host.appendChild(label);
    }
    return label;
  }

  // Caption the CURRENT cell — drawn or stowed. SelectedSlot wins when both are set, so a
  // drawn item never reads as stowed; an empty (or absent) current cell shows nothing at all
  // rather than an empty plate hanging over the bar.
  function renderName() {
    var label = nameEl();
    if (!label) return;
    var sel = (lastHotbar && typeof lastHotbar.SelectedSlot === 'number') ? lastHotbar.SelectedSlot : -1;
    var pending = (lastHotbar && typeof lastHotbar.SelectedSlotPending === 'number') ? lastHotbar.SelectedSlotPending : -1;
    var stowed = sel < 0 && pending >= 0;
    var slot = stowed ? pending : sel;
    var text = (slot >= 0) ? itemDisplayName(playerItemsBySlot.get(slot)) : '';
    label.textContent = text;
    label.classList.toggle('visible', !!text);
    label.classList.toggle('stowed', !!text && stowed);
  }

  // Selection-only update: toggle .selected / .selected-inactive on the existing
  // slots so the CSS transition animates the grow/shrink instead of snapping after
  // a rebuild. SelectedSlot = drawn (item in hand); SelectedSlotPending = empty hands.
  function applySelection() {
    var host = document.getElementById('hotbar-row');
    if (!host || !lastHotbar) return;
    var sel = (typeof lastHotbar.SelectedSlot === 'number') ? lastHotbar.SelectedSlot : -1;
    var pending = (typeof lastHotbar.SelectedSlotPending === 'number') ? lastHotbar.SelectedSlotPending : -1;
    var kids = host.querySelectorAll('.tsic-slot');
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('selected', i === sel);
      kids[i].classList.toggle('selected-inactive', i === pending);
    }
    renderName();
  }

  // Animate the selection if only it changed; rebuild if the contents differ.
  function update() {
    var host = document.getElementById('hotbar-row');
    if (host && host.querySelector('.tsic-slot') && contentKey() === lastContentKey) applySelection();
    else render();
  }

  function render() {
    var host = document.getElementById('hotbar-row');
    if (!host) return;
    host.innerHTML = '';
    var selected = (lastHotbar && typeof lastHotbar.SelectedSlot === 'number') ? lastHotbar.SelectedSlot : -1;
    // Empty hands on the current cell — stowed, or the cell holds something unholdable.
    var pending = (lastHotbar && typeof lastHotbar.SelectedSlotPending === 'number') ? lastHotbar.SelectedSlotPending : -1;
    var total = slotCount();
    for (var i = 0; i < total; i++) {
      (function (i) {
        var slot = document.createElement('div');
        var selClass = (i === selected) ? ' selected' : (i === pending ? ' selected-inactive' : '');
        slot.className = 'tsic-slot' + selClass;
        slot.dataset.slot = String(i);
        // The cell's position in the player grid. The bar takes no grid gestures, but the
        // number is what makes it self-describing to tests and debug.
        slot.dataset.grid = String(i);
        var item = playerItemsBySlot.get(i);
        if (item && item.ItemId) {
          // iconImg, not a hand-rolled <img>: item icons 404 on their first (cold)
          // request, and render() only runs when contentKey() changes, so a slot
          // that gave up on that first miss stayed empty until its item did.
          slot.appendChild(TSIC.iconImg(TSIC.itemIconUrl(item.ItemId)));
          // Ammo-using equipment always shows loaded/spare (incl. "0/0"); other items
          // fall back to the stack count, and only when stacked.
          if (usesAmmo(item)) {
            var ammo = document.createElement('span');
            ammo.className = 'count ammo';
            ammo.textContent = cap2(item.LoadedAmmo) + '/' + cap2(item.SpareAmmo);
            slot.appendChild(ammo);
          } else if (item.Count > 1) {
            var count = document.createElement('span');
            count.className = 'count';
            count.textContent = String(item.Count);
            slot.appendChild(count);
          }
        }
        var idxLabel = document.createElement('span');
        idxLabel.className = 'key';
        idxLabel.textContent = String(i + 1);
        slot.appendChild(idxLabel);
        // The bar's one gesture: draw the slot, or stow it if it is already drawn.
        slot.onclick = function () {
          publish('UI.Cmd.Hotbar.Select', { SlotIndex: i });
        };

        host.appendChild(slot);
      })(i);
    }
    lastContentKey = contentKey();
    renderName();
  }

  /**
   * Screens that draw the bag call setBagPanelOpen(true) on show and (false) on hide, so the
   * hotbar cells exist in exactly one place at a time: the strip inside that panel. The class
   * name lives here with the rule that reads it; the standalone dev pages boot no HUD, so
   * this is a harmless no-op there.
   */
  window.TSICHotbar = {
    setBagPanelOpen: function (open) {
      document.body.classList.toggle('tsic-bag-open', !!open);
    },
  };

  (function boot() {
    if (!window.tsic || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
    injectStyles();
    tsic.whenReady(function () {
      tsic.on('tsic.msg.UI.Hotbar.Changed', function (p) {
        // Selection tick on every genuine selection move (keyboard, wheel or
        // click — this is the one place all of them converge). Skip the very
        // first snapshot so loading in doesn't click.
        var newSel = (p && typeof p.SelectedSlot === 'number') ? p.SelectedSlot : -1;
        var oldSel = (lastHotbar && typeof lastHotbar.SelectedSlot === 'number') ? lastHotbar.SelectedSlot : -1;
        if (lastHotbar && newSel !== oldSel) {
          try { tsic.playSound('Hotbar.Select', 0.5); } catch (e) {}
        }
        lastHotbar = p || null;
        update();
      });
      tsic.on('tsic.msg.UI.Inventory.Updated', function (p) {
        if (!p || p.OwnerId !== 'Player') return;
        playerItemsBySlot = new Map();
        var items = (p.Items || []);
        var total = slotCount();
        for (var k = 0; k < items.length; k++) {
          // Keyed by GridSlot: the hotbar IS the leading cells, so position is the identity.
          var it = items[k];
          if (it && typeof it.GridSlot === 'number' && it.GridSlot >= 0 && it.GridSlot < total) {
            playerItemsBySlot.set(it.GridSlot, it);
          }
        }
        update();
      });
      // The catalog usually lands after the first hotbar snapshot, so the caption's first
      // render has only the id to work with. Re-render when the real names arrive.
      window.addEventListener('tsic-item-catalog', renderName);
    });
  })();
})();
