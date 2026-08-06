// shared/hud-hotbar.js — In-game HUD hotbar (the "showroom shelf").
//
// THE HOTBAR IS THE FIRST EIGHT GRID CELLS OF THE PLAYER INVENTORY. Nothing is assigned to it:
// this view reads the inventory snapshot and draws whatever sits in GridSlot 0..NumSlots-1. A
// player moves an item onto the bar by moving it into one of those cells, in the inventory
// screen, exactly like any other grid move.
//
// AND THIS BAR *IS* THAT ROW — not a mirror of it. Open the inventory (or a container, or any
// screen that shows the bag) and those panels start their grid AFTER the hotbar cells, because
// this bar, which the player can already see, is where those cells live. On that cue the row
// enters GRID MODE: TSICHotbar.setGridPane() hands it to the shared cursor engine, so its
// slots take/place/split/drag exactly like in-panel cells, and it lifts above the screen
// overlay so real pointer events reach it. Leaving the screen puts it back to a click-to-select
// bar. Minecraft's model: one row, drawn once, wearing two hats.
//
// Each slot is a teak-laminate plinth on a brushed-brass shelf; the SELECTED
// slot scales up and lifts off the shelf with a warm gold spotlight.
//
// Channels:
//   tsic.msg.UI.Hotbar.Changed    { NumSlots, SelectedSlot, SelectedSlotPending }
//   tsic.msg.UI.Inventory.Updated (OwnerId === 'Player') → cell contents
// Commands published:
//   UI.Cmd.Hotbar.Select { SlotIndex }   (re-selecting the current cell toggles stow/draw)
// Depends on: window.TSIC.itemIconUrl (icons.js), window.TSICInventory (inventory.js, grid mode)
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
    '#hotbar-row .tsic-slot { position:relative; width:56px; height:56px; font-family:Georgia,"Libre Baskerville",serif; color:#f0e7d4;',
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
    '#hotbar-row .tsic-slot.is-drop-target { border-color:rgba(224,208,170,0.95); box-shadow:0 0 0 2px rgba(224,208,170,0.55), inset 0 0 12px rgba(0,0,0,0.50); }',

    /* ── Grid mode ── the bar is the open panel's first row, so it has to sit ABOVE the
       screen overlay (#screen-overlay-host, z-index 50) or pointer events never reach it
       and the cells are dead. screen-manager.css lifts the overlay's bottom edge clear of
       the bar to match, so panels never draw over it. */
    /* display:block wins back the H-key HUD toggle (body.hud-hidden) and the per-element
       hotbar toggle. In grid mode the bar is not HUD chrome any more — it is the open
       panel's first row, and hiding it would take eight inventory cells with it. */
    'body.tsic-hotbar-grid #hud-hotbar { display:block !important; z-index:55; }',
    /* The held stack's source cell dims here exactly as it does in the panel. */
    '#hotbar-row .tsic-slot.is-held-source img { opacity:0.35; }',
    /* Tab/search dimming reaches the bar too — a filtered grid with an unfiltered bar
       would read as "there is none of that" while the item sat in plain sight. */
    '#hotbar-row .tsic-slot.is-filtered img { opacity:0.25; filter:grayscale(0.85); }',
    '#hotbar-row .tsic-slot .equip-badge { position:absolute; top:3px; right:4px; padding:0 4px; line-height:1.35; pointer-events:none;',
    '  font-family:var(--font-display); font-size:11px; font-weight:700; color:#fff; background:var(--mag-red,#e60000);',
    '  border:1px solid var(--ink-night); border-radius:5px; }',
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
  // The whole player snapshot, kept for grid mode: the cursor engine resolves moves against
  // the full inventory, not just the eight cells this bar draws.
  var playerItems = [];
  // Non-null while an open screen has claimed the bar as its first row (see setGridPane).
  var gridPane = null;

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
  }

  // Animate the selection if only it changed; rebuild if the contents differ.
  //
  // Grid mode always rebuilds: the cells carry live interaction wiring and badges that the
  // selection-only path would leave stale, and the springy grow/shrink it exists to preserve
  // is not what anyone is looking at while a panel is open.
  function update() {
    var host = document.getElementById('hotbar-row');
    if (gridPane) { render(); return; }
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
        // The cell's position in the player grid — what the cursor engine addresses moves by.
        // Stamped in both modes so a bare bar is still self-describing to tests and debug.
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
        // Click = draw/stow, but ONLY as a plain HUD bar. In grid mode the cell belongs to
        // the open panel, where a click means "pick this stack up" — bindCells wires that,
        // and a Select firing alongside it would swap the player's hands mid-gesture.
        if (!gridPane) {
          slot.onclick = function () {
            // A pointerup-committed grid move onto this cell suppresses the click so it can't
            // double up as a Select.
            var inv = window.TSICInventory;
            if (inv && inv.clickSuppressed && inv.clickSuppressed()) return;
            publish('UI.Cmd.Hotbar.Select', { SlotIndex: i });
          };
        }

        host.appendChild(slot);
      })(i);
    }
    lastContentKey = contentKey();
    if (gridPane && window.TSICInventory) {
      // Re-wire every render: the cells above are brand new, so the previous render's
      // listeners and pane registration went with the old DOM.
      window.TSICInventory.bindCells(host, playerItems, {
        ownerId: gridPane.ownerId || 'Player',
        panelEl: host,
        onHover: gridPane.onHover || null,
        onLeave: gridPane.onLeave || null,
        onQuickMove: gridPane.onQuickMove || null,
        onDollDrop: gridPane.onDollDrop || null,
        otherOwnerId: gridPane.otherOwnerId || null,
        focusGroup: gridPane.focusGroup || null,
        filterFn: gridPane.filterFor ? gridPane.filterFor() : null,
        equippedIds: gridPane.equippedIds ? gridPane.equippedIds() : null,
      });
    }
  }

  /**
   * The bar's public face for screens that show the player's bag.
   *
   * A screen calls setGridPane(opts) on show and setGridPane(null) on hide. `opts` is the
   * same pane contract renderGrid takes — { ownerId, onHover, onLeave, onQuickMove,
   * otherOwnerId, focusGroup } — except that `filterFor()` and `equippedIds()` are GETTERS,
   * read fresh on every render. The screen's tab, search box and worn gear all change
   * without the pane changing, so capturing their values at bind time would freeze the bar
   * one interaction behind the panel it belongs to.
   *
   * available() lets a screen ask whether there is a live bar at all: the standalone
   * /screens/*.html hosts boot no HUD, and there the panel must keep drawing the hotbar
   * cells itself or they would be unreachable.
   */
  window.TSICHotbar = {
    available: function () { return !!document.getElementById('hotbar-row'); },
    isGridMode: function () { return !!gridPane; },
    setGridPane: function (opts) {
      var host = document.getElementById('hotbar-row');
      if (!opts && gridPane && host && window.TSICInventory) {
        window.TSICInventory.unbindCells(host);
      }
      gridPane = opts || null;
      document.body.classList.toggle('tsic-hotbar-grid', !!gridPane);
      lastContentKey = null;
      render();
    },
    /** Re-render + re-bind against the caller's current filter/equipment state. */
    refresh: function () {
      if (!gridPane) return;
      lastContentKey = null;
      render();
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
        playerItems = items;
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
    });
  })();
})();
