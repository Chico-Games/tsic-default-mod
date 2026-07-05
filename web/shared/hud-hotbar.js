// shared/hud-hotbar.js — In-game HUD hotbar (the "showroom shelf").
//
// THIS IS THE IN-GAME HUD hotbar, loaded by hud.js into the #hotbar-row shell.
// screens/hotbar.html is the standalone screen (same look, its own inline copy)
// — mirrors the action-bar split (hud-action-bar.js ↔ screens/action-bar.html).
//
// Each slot is a teak-laminate plinth on a brushed-brass shelf; the SELECTED
// slot scales up and lifts off the shelf with a warm gold spotlight.
//
// Channels:
//   tsic.msg.UI.Hotbar.Changed    { SlotIndices, SelectedSlot }
//   tsic.msg.UI.Inventory.Updated (OwnerId === 'Player') → item icons/counts
// Commands published:
//   UI.Cmd.Hotbar.Select { SlotIndex }
//   UI.Cmd.Hotbar.Assign { SlotIndex, ItemId }   (ItemId carries the item's InstanceId)
// Depends on: window.TSIC.itemIconUrl (icons.js)
(function () {
  // ── Styling (scoped to #hotbar-row; kept in sync with screens/hotbar.html) ──
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
    /* Deselected: the current slot with its weapon stowed (fists out) — same
       lift/scale so it still reads as the current slot, but a muted rim and a
       greyed, see-through item to show the weapon isn't out. Empty slots are
       always shown this way. */
    '#hotbar-row .tsic-slot.selected-inactive { --mag:1.16; --lift:-5px; border-color:rgba(150,145,135,0.85); }',
    '#hotbar-row .tsic-slot.selected-inactive img { filter:grayscale(0.65) drop-shadow(0 2px 3px rgba(0,0,0,0.6)); opacity:0.6; }',
    '#hotbar-row .tsic-slot .key { position:absolute; top:3px; left:4px; min-width:15px; padding:0 4px; pointer-events:none;',
    '  font-family:var(--font-display); font-size:14px; font-weight:700; line-height:1.35; letter-spacing:0.02em; text-align:center; color:#f3ecda; text-shadow:0 1px 2px rgba(0,0,0,0.95);',
    '  background:rgba(14,9,8,0.62); border:1px solid var(--ink-night); border-radius:5px; }',
    '#hotbar-row .tsic-slot.selected .key { color:#fff; border-color:rgba(224,208,170,0.90); }',
    '#hotbar-row .tsic-slot .count { position:absolute; bottom:3px; right:4px; top:auto; left:auto; pointer-events:none;',
    '  font-family:var(--font-display); font-size:12px; font-weight:700; line-height:1; letter-spacing:0.02em; padding:2px 4px; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.95);',
    '  background:rgba(14,9,8,0.70); border:1px solid var(--ink-night); border-radius:5px; }',
    '#hotbar-row .tsic-slot.is-dragging { opacity:0.45; }',
    '#hotbar-row .tsic-slot.is-drop-target { border-color:rgba(224,208,170,0.95); box-shadow:0 0 0 2px rgba(224,208,170,0.55), inset 0 0 12px rgba(0,0,0,0.50); }',
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('hud-hotbar-styles')) return;
    var s = document.createElement('style');
    s.id = 'hud-hotbar-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ── State ──
  var lastHotbar = null;
  // Signature of the last fully-rendered contents (slot assignments + each
  // slot's item id/count — NOT the selection). A change that leaves this equal
  // (e.g. just moving the selection) reuses the existing DOM so the CSS
  // transition animates the grow/shrink; a real content change rebuilds.
  var lastContentKey = null;
  var playerItemsByInstance = new Map();
  // The slot currently being dragged — used by the dragend fallback so a
  // "drop outside" clears the assignment.
  var activeHotbarDrag = null;

  // Ammo badge clamps each side to two digits — "99/99" is the widest it draws.
  function cap2(n) { n = (typeof n === 'number' && n > 0) ? n : 0; return n > 99 ? 99 : n; }
  // True when this item is ammo-using equipment (C++ sends -1 for everything else).
  function usesAmmo(item) { return item && typeof item.LoadedAmmo === 'number' && item.LoadedAmmo >= 0; }

  function publish(tag, payload) {
    if (window.tsic && window.tsic.publishMessage) window.tsic.publishMessage(tag, payload);
  }
  function clearSlot(slotIndex) {
    publish('UI.Cmd.Hotbar.Assign', { SlotIndex: slotIndex, ItemId: '' });
  }
  function isAssigned(invSlot) {
    return invSlot !== undefined && invSlot !== null && invSlot >= 0;
  }
  function contentKey() {
    if (!lastHotbar) return '';
    var slots = lastHotbar.SlotIndices || [];
    var parts = [];
    for (var i = 0; i < slots.length; i++) {
      var inv = slots[i];
      var item = isAssigned(inv) ? playerItemsByInstance.get(inv) : null;
      var key = String(inv);
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
  // a rebuild. SelectedSlot = active (weapon out); SelectedSlotPending = deselected
  // (weapon stowed / fists out, incl. every empty slot).
  function applySelection() {
    var host = document.getElementById('hotbar-row');
    if (!host || !lastHotbar) return;
    var sel = (typeof lastHotbar.SelectedSlot === 'number') ? lastHotbar.SelectedSlot : -1;
    var pending = (typeof lastHotbar.SelectedSlotPending === 'number') ? lastHotbar.SelectedSlotPending : -1;
    var kids = host.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('selected', i === sel);
      kids[i].classList.toggle('selected-inactive', i === pending);
    }
  }

  // Animate the selection if only it changed; rebuild if the contents differ.
  function update() {
    var host = document.getElementById('hotbar-row');
    if (host && host.children.length && contentKey() === lastContentKey) applySelection();
    else render();
  }

  function render() {
    if (!lastHotbar) return;
    var host = document.getElementById('hotbar-row');
    if (!host) return;
    host.innerHTML = '';
    var slots = lastHotbar.SlotIndices || [];
    var selected = (typeof lastHotbar.SelectedSlot === 'number') ? lastHotbar.SelectedSlot : -1;
    // Deselected: the current slot with its weapon stowed (fists out) — greyed.
    // Every empty slot, when current, lands here since it has nothing to equip.
    var pending = (typeof lastHotbar.SelectedSlotPending === 'number') ? lastHotbar.SelectedSlotPending : -1;
    for (var i = 0; i < slots.length; i++) {
      (function (i) {
        var slot = document.createElement('div');
        var selClass = (i === selected) ? ' selected' : (i === pending ? ' selected-inactive' : '');
        slot.className = 'tsic-slot' + selClass;
        slot.dataset.slot = String(i);
        var inventorySlot = slots[i];
        var slotHasItem = isAssigned(inventorySlot);
        var item = slotHasItem ? playerItemsByInstance.get(inventorySlot) : null;
        if (item && item.ItemId) {
          var img = document.createElement('img');
          img.src = TSIC.itemIconUrl(item.ItemId);
          img.onerror = function () { img.style.visibility = 'hidden'; };
          slot.appendChild(img);
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
        idxLabel.textContent = i === 9 ? '0' : String(i + 1);
        slot.appendChild(idxLabel);
        slot.onclick = function () { publish('UI.Cmd.Hotbar.Select', { SlotIndex: i }); };

        // Drag source — only assigned slots can be dragged.
        slot.draggable = slotHasItem;
        if (slotHasItem) {
          slot.addEventListener('dragstart', function (e) {
            activeHotbarDrag = { slot: i, inventorySlot: inventorySlot };
            e.dataTransfer.setData('application/tsic-slot',
              JSON.stringify({ kind: 'hotbar', slot: i, inventorySlot: inventorySlot }));
            slot.classList.add('is-dragging');
          });
          slot.addEventListener('dragend', function (e) {
            var drag = activeHotbarDrag;
            activeHotbarDrag = null;
            slot.classList.remove('is-dragging');
            // No drop zone accepted it → clear the source slot.
            if (drag && e.dataTransfer && e.dataTransfer.dropEffect === 'none') {
              clearSlot(drag.slot);
            }
          });
        }

        // Drop target — accepts inventory rows (assign) and hotbar slots (swap).
        slot.addEventListener('dragover', function (e) {
          e.preventDefault();
          slot.classList.add('is-drop-target');
        });
        slot.addEventListener('dragleave', function () { slot.classList.remove('is-drop-target'); });
        slot.addEventListener('drop', function (e) {
          e.preventDefault();
          slot.classList.remove('is-drop-target');

          var itemData = e.dataTransfer.getData('application/tsic-item');
          if (itemData) {
            try {
              var src = JSON.parse(itemData);
              // Assign by the stable instance id, not the array position — hotbar slots are keyed by
              // InstanceId (see the inventory listener), and src.slot would point at the wrong item
              // the moment the inventory reorders.
              var assignId = (src.instanceId != null) ? src.instanceId : src.slot;
              publish('UI.Cmd.Hotbar.Assign', { SlotIndex: i, ItemId: String(assignId) });
            } catch (err) { console.warn('[hotbar] bad item drag payload', err); }
            return;
          }
          var slotData = e.dataTransfer.getData('application/tsic-slot');
          if (slotData) {
            try {
              var s = JSON.parse(slotData);
              if (s.slot === i) return;
              // Swap: assign target to source's inv slot, source to target's inv slot.
              var targetInv = isAssigned(slots[i]) ? String(slots[i]) : '';
              publish('UI.Cmd.Hotbar.Assign', { SlotIndex: i,      ItemId: String(s.inventorySlot) });
              publish('UI.Cmd.Hotbar.Assign', { SlotIndex: s.slot, ItemId: targetInv });
            } catch (err) { console.warn('[hotbar] bad slot drag payload', err); }
          }
        });

        host.appendChild(slot);
      })(i);
    }
    lastContentKey = contentKey();
  }

  (function boot() {
    if (!window.tsic || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
    injectStyles();
    tsic.whenReady(function () {
      tsic.on('tsic.msg.UI.Hotbar.Changed', function (p) {
        lastHotbar = p || null;
        update();
      });
      tsic.on('tsic.msg.UI.Inventory.Updated', function (p) {
        if (!p || p.OwnerId !== 'Player') return;
        playerItemsByInstance = new Map();
        var items = (p.Items || []);
        for (var k = 0; k < items.length; k++) {
          var it = items[k];
          // Key by InstanceId (the stable InternalInventoryId), NOT SlotIndex. Hotbar slots store
          // the InstanceId, and SlotIndex is just the volatile array position — it shifts whenever a
          // stack is removed (e.g. ammo consumed on reload), which would orphan the lookup and make
          // the icon + ammo vanish even though the item is still in the inventory.
          if (it && typeof it.InstanceId === 'number') playerItemsByInstance.set(it.InstanceId, it);
        }
        update();
      });
    });
  })();
})();
