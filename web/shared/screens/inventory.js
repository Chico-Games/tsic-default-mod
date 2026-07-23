// Inventory screen module — grid design §10.1 "Split Page" layout.
//
// Left column: category tabs + the player grid + the weight bar (weight only;
// the slot count lives as text in the headline band). Right rail: armor-only
// paper doll (+ Backpack), character preview, item info card. Bottom: the
// in-screen 10-slot hotbar mirror + contextual hotkey hint row.
//
// All interactions ride the shared cursor engine (shared/inventory.js):
// click/drag pickup, RMB half/place-one, shift-click quick-move (equip),
// double-click collect, Q / Ctrl+Q drops, click-outside world drops.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const STYLE = `
    [data-screen="Inventory"] #inv-root { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:auto; }
    [data-screen="Inventory"] #inv-panel { width:auto; height:auto; max-width:92vw; max-height:92vh; overflow:auto; }
    [data-screen="Inventory"] #inv-band { display:flex; align-items:baseline; gap:12px; border-bottom:3px solid rgba(10,10,10,0.85); margin-bottom:10px; padding-bottom:5px; }
    [data-screen="Inventory"] #inv-band h2 { margin:0; }
    [data-screen="Inventory"] #inv-band .spacer { flex:1; }
    [data-screen="Inventory"] #inv-band .slots-text { font-size:14px; letter-spacing:0.08em; color:rgba(37,33,25,0.65); }
    [data-screen="Inventory"] .sort-btn {
      font: inherit; font-size:12px; letter-spacing:0.1em; cursor:pointer; padding:2px 10px;
      background: rgba(255,253,243,0.96); border:2px solid rgba(10,10,10,0.85); color:inherit;
    }
    [data-screen="Inventory"] .sort-btn:hover, [data-screen="Inventory"] .sort-btn[data-tsic-focused] { background: var(--mag-red, #e60000); color:#fff; }
    [data-screen="Inventory"] .inv-cols { display:grid; gap:12px; grid-template-columns:max-content 300px; align-items:stretch; }
    [data-screen="Inventory"] #inv-tabs { display:flex; gap:0; margin-bottom:8px; }
    [data-screen="Inventory"] #inv-tabs .tsic-tab { font-size:11px; padding:3px 8px; }

    [data-screen="Inventory"] .inv-grid {
      display:grid; grid-template-columns: repeat(var(--grid-cols, 8), var(--tsic-slot));
      grid-auto-rows: var(--tsic-slot); gap:var(--tsic-slot-gap); width:max-content;
      max-height: calc(var(--tsic-slot-rows) * (var(--tsic-slot) + var(--tsic-slot-gap))); overflow-y:auto;
    }
    [data-screen="Inventory"] .tsic-slot {
      width:var(--tsic-slot); height:var(--tsic-slot); position:relative; cursor:pointer; padding:4px;
      background: rgba(255,253,243,0.96); border:2px solid rgba(10,10,10,0.85);
      display:flex; align-items:center; justify-content:center;
      transition: background-color 90ms ease, opacity 160ms ease, filter 160ms ease, transform 90ms ease, box-shadow 90ms ease;
    }
    [data-screen="Inventory"] .tsic-slot.is-empty { background: rgba(237,228,203,0.85); border-color: rgba(10,10,10,0.45); }
    [data-screen="Inventory"] .tsic-slot:hover:not(.is-locked),
    [data-screen="Inventory"] .tsic-slot[data-tsic-focused] { border-color: rgba(10,10,10,1); background: #fffdf3; }
    [data-screen="Inventory"] .tsic-slot.is-held-source img { opacity:0.35; }
    [data-screen="Inventory"] .tsic-slot.is-drop-target { outline:2px solid var(--buff-green, #1e8f3e); outline-offset:-2px; }
    [data-screen="Inventory"] .tsic-slot.is-filtered { opacity:0.2; filter:grayscale(0.8); }
    [data-screen="Inventory"] .tsic-slot.is-locked {
      background: rgba(227,216,184,0.7); border-style:dashed; border-color: rgba(10,10,10,0.35);
      cursor:default; font-size:15px; opacity:0.75;
    }
    [data-screen="Inventory"] .tsic-slot .lock-glyph { opacity:0.35; pointer-events:none; }
    [data-screen="Inventory"] .tsic-slot .count {
      position:absolute; bottom:1px; right:2px; padding:1px 4px; line-height:1;
      font-size:12px; font-weight:700; color:#1a1612; background: var(--mag-yellow, #ffcc00);
      border:1px solid rgba(10,10,10,0.85); pointer-events:none;
    }
    [data-screen="Inventory"] .tsic-slot .equip-badge {
      position:absolute; top:1px; left:2px; padding:1px 4px; line-height:1;
      font-size:11px; font-weight:700; color:#fff; background: var(--mag-red, #e60000);
      border:1px solid rgba(10,10,10,0.85); pointer-events:none;
    }
    [data-screen="Inventory"] .tsic-slot .hotbar-badge {
      position:absolute; top:1px; right:2px; padding:1px 4px; line-height:1;
      font-size:11px; font-weight:700; color: var(--mag-yellow, #ffcc00); background: rgba(10,10,10,0.9);
      border:1px solid rgba(10,10,10,0.85); pointer-events:none;
    }

    [data-screen="Inventory"] .inv-meter { margin-top:8px; min-width:200px; }
    [data-screen="Inventory"] .inv-meter .lab { display:flex; justify-content:space-between; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(37,33,25,0.8); }
    [data-screen="Inventory"] .inv-meter .val { font-size:13px; }
    [data-screen="Inventory"] .inv-meter .stackw {
      display:inline-block; min-width:58px; text-align:center; font-size:12px;
      color:#1a1612; background: var(--mag-yellow, #ffcc00); border:1px solid rgba(10,10,10,0.85);
      padding:0 4px; margin-right:6px; line-height:1.4;
    }
    [data-screen="Inventory"] .inv-meter .stackw.none { visibility:hidden; }
    [data-screen="Inventory"] .inv-meter .track { height:14px; border:2px solid rgba(10,10,10,0.85); background: rgba(227,216,184,0.9); position:relative; overflow:hidden; }
    [data-screen="Inventory"] .inv-meter .fill { height:100%; background: var(--mag-red, #e60000); transition: width 120ms linear; }
    [data-screen="Inventory"] .inv-meter[data-state="overburdened"] .fill { animation: inv-ob-pulse 900ms ease-in-out infinite; }
    @keyframes inv-ob-pulse { 50% { filter: brightness(1.5); } }
    [data-screen="Inventory"] .inv-meter .fillsel { position:absolute; top:0; bottom:0; background: var(--mag-yellow, #ffcc00); border-left:1px solid rgba(10,10,10,0.85); }

    [data-screen="Inventory"] .inv-rail { display:flex; flex-direction:column; gap:8px; }
    [data-screen="Inventory"] #inv-doll {
      position:relative; display:grid; grid-template-columns:var(--tsic-slot) 1fr var(--tsic-slot); gap:4px; padding:8px;
      min-height:240px; background: rgba(255,253,243,0.96); border:2px solid rgba(10,10,10,0.85);
    }
    [data-screen="Inventory"] .doll-col { display:flex; flex-direction:column; justify-content:space-around; align-items:center; gap:14px; }
    [data-screen="Inventory"] .equip-slot {
      width:var(--tsic-slot); height:var(--tsic-slot); position:relative;
      background: rgba(237,228,203,0.9); border:2px dashed rgba(10,10,10,0.5);
      display:flex; align-items:center; justify-content:center;
      font-size:9px; letter-spacing:1px; text-transform:uppercase; color: rgba(74,66,57,0.8);
      cursor:pointer;
    }
    [data-screen="Inventory"] .equip-slot.is-full { border-style:solid; border-color: rgba(10,10,10,0.85); background:#fffdf3; }
    [data-screen="Inventory"] .equip-slot img { width:100%; height:100%; object-fit:contain; pointer-events:none; }
    [data-screen="Inventory"] .equip-slot .tag {
      position:absolute; bottom:-9px; left:50%; transform:translateX(-50%);
      font-size:8px; letter-spacing:0.1em; background: rgba(10,10,10,0.9); color:#fff;
      padding:0 4px; white-space:nowrap; pointer-events:none;
    }
    [data-screen="Inventory"] .equip-slot.is-drop-target { outline:2px solid var(--buff-green, #1e8f3e); outline-offset:-2px; }
    [data-screen="Inventory"] #inv-char-preview { grid-column:2; min-height:0; display:flex; align-items:center; justify-content:center; overflow:hidden; }
    [data-screen="Inventory"] #inv-char-preview img { width:100%; height:100%; object-fit:contain; transform:scale(1.9); transform-origin:50% 42%; }

    [data-screen="Inventory"] #inv-info {
      padding:9px 11px; background:#fffdf3; border:2px solid rgba(10,10,10,0.85);
      min-height:140px; flex:1 1 auto; overflow:auto; font-size:13px;
    }
    [data-screen="Inventory"] #inv-info .info-eyebrow { font-size:10px; letter-spacing:0.18em; color: var(--mag-red, #e60000); text-transform:uppercase; }
    [data-screen="Inventory"] #inv-info .statline { display:flex; justify-content:space-between; border-top:1px dashed rgba(10,10,10,0.3); padding:2px 0; }
    [data-screen="Inventory"] #inv-info .statline b { letter-spacing:0.06em; font-size:12px; }

    [data-screen="Inventory"] .inv-hotbar { display:flex; gap:5px; margin-top:12px; justify-content:center; }
    [data-screen="Inventory"] .inv-hotbar .hslot {
      width:56px; height:56px; position:relative; cursor:pointer;
      background:#fffdf3; border:2px solid rgba(10,10,10,0.85);
      display:flex; align-items:center; justify-content:center;
    }
    [data-screen="Inventory"] .inv-hotbar .hslot img { width:100%; height:100%; object-fit:contain; pointer-events:none; }
    [data-screen="Inventory"] .inv-hotbar .hslot .num {
      position:absolute; top:-8px; left:-5px; padding:1px 3px; line-height:1;
      font-size:8px; font-weight:700; background: rgba(10,10,10,0.9); color: var(--mag-yellow, #ffcc00);
      border:1px solid rgba(10,10,10,0.85); pointer-events:none;
    }
    [data-screen="Inventory"] .inv-hotbar .hslot .count {
      position:absolute; bottom:1px; right:2px; padding:1px 2px; line-height:1;
      font-size:8px; font-weight:700; color:#1a1612; background: var(--mag-yellow, #ffcc00);
      border:1px solid rgba(10,10,10,0.85); pointer-events:none;
    }
    [data-screen="Inventory"] .inv-hotbar .hslot.sel { background: var(--mag-red, #e60000); box-shadow: 3px 3px 0 rgba(10,10,10,0.85); }
    [data-screen="Inventory"] .inv-hotbar .hslot.is-drop-target { outline:2px solid var(--buff-green, #1e8f3e); outline-offset:-2px; }

    [data-screen="Inventory"] .inv-hints { display:flex; gap:14px; justify-content:center; margin-top:10px; border-top:2px dashed rgba(10,10,10,0.3); padding-top:8px; flex-wrap:wrap; }
    [data-screen="Inventory"] .inv-hints .hint { display:flex; align-items:center; gap:5px; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(74,66,57,0.9); }
    [data-screen="Inventory"] .inv-hints .kbd {
      display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:20px; padding:0 4px;
      background:#fffdf3; border:2px solid rgba(10,10,10,0.85); box-shadow:2px 2px 0 rgba(10,10,10,0.85);
      font-size:9px; font-weight:700; color:#1a1612;
    }
  `;

  const TEMPLATE = `
    <div id="inv-root" class="tsic-modal-scrim">
      <div id="inv-panel" class="tsic-panel tsic-panel--screen">
        <div id="inv-band">
          <h2 class="tsic-title">Inventory</h2>
          <span class="spacer"></span>
          <button id="inv-sort" class="sort-btn" data-tsic-focusable>SORT</button>
          <span class="slots-text" id="inv-slots-text">—</span>
        </div>
        <div class="inv-cols">
          <div>
            <div id="inv-tabs" data-tsic-tab-bar></div>
            <div id="inv-grid" class="inv-grid"></div>
            <div class="inv-meter" id="inv-meter">
              <div class="lab"><span>Weight</span>
                <span class="val"><span class="stackw none" id="inv-stackw">0.0 kg</span><span id="inv-weight-text">—</span></span>
              </div>
              <div class="track"><div class="fill" id="inv-weight-fill"></div><div class="fillsel" id="inv-weight-sel" style="display:none"></div></div>
            </div>
          </div>
          <div class="inv-rail">
            <div id="inv-doll"><div id="inv-char-preview"><img id="inv-char-img" alt=""></div></div>
            <div id="inv-info" class="tsic-empty">Hover an item to see details</div>
          </div>
        </div>
        <div class="inv-hotbar" id="inv-hotbar"></div>
        <div class="inv-hints" id="inv-hints"></div>
      </div>
    </div>
  `;

  // Tabs FILTER the grid in place: non-matching items dim (.is-filtered) but
  // never move — a filter must never change slot geometry (rule 48).
  const TAB_FILTERS = {
    'All':           null,
    'Equipment':     (d) => d.Category === 'Equipment',
    'Consumables':   (d) => d.Category === 'Consumable',
    'Constructable': (d) => d.Category === 'Constructable',
    'Ammo':          (d) => d.Category === 'Ammo',
    'Materials':     (d) => d.Category === 'CraftingMaterial',
  };
  const TAB_LABELS = {
    'All': 'All', 'Equipment': 'Equip', 'Consumables': 'Cons.',
    'Constructable': 'Constr.', 'Ammo': 'Ammo', 'Materials': 'Mat.',
  };
  const TAB_DEFS = Object.keys(TAB_FILTERS).map((id) => ({ id, label: TAB_LABELS[id] || id }));

  // The doll is armor + Outfit + Backpack: the Weapon slot stays in data but is
  // represented by the hotbar's selection frame, not a doll cell (§10.1).
  const DOLL_LEFT  = ['Head', 'Body', 'Outfit', 'Backpack'];
  const DOLL_RIGHT = ['Gloves', 'Legs', 'Shoes'];
  const DOLL_TAG_PREFIX = 'Entity.Inventory.Item.Equipment.Slot.';

  // Locked-preview region is UI-ONLY (§10.1): grey cells up to the shipped
  // bag tier (48) so backpack upgrades are a visible unlock moment.
  const PREVIEW_TIER_SLOTS = 48;
  const MAX_PREVIEW_CELLS = 16;

  function injectStyleOnce() {
    if (document.getElementById('screen-inventory-style')) return;
    const s = document.createElement('style');
    s.id = 'screen-inventory-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function hintChip(keys, label) {
    const hint = TSIC.el('span', { class: 'hint' });
    keys.forEach((k, i) => {
      if (i > 0) hint.appendChild(document.createTextNode('+'));
      hint.appendChild(TSIC.el('span', { class: 'kbd' }, k));
    });
    hint.appendChild(document.createTextNode(' ' + label));
    return hint;
  }

  TSIC.registerScreen('Inventory', {
    inputModeTag: 'InputMode.Menu.Inventory',
    cancelCmd: 'UI.Cmd.Pause.Resume',
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();

      // §5 P2 SortInventory: merge mergeable stacks, re-place by category/name.
      root.querySelector('#inv-sort').addEventListener('click', () => {
        window.TSICInventory.cancelHeld();
        ctx.publish('UI.Cmd.Inventory.Sort', { OwnerId: 'Player' });
        tsic.playSound('Inventory.Transfer');
      });

      let tabFilter = null;
      let lastUpdate = null;
      let lastEquipment = null;
      let lastHotbar = null;
      let hoveredItem = null;
      this._state = { get hoveredItem() { return hoveredItem; } };

      function equippedSlotTagFor(instanceId) {
        if (instanceId == null) return null;
        const target = String(instanceId);
        for (const s of ((lastEquipment && lastEquipment.Slots) || [])) {
          if (s && s.ItemId != null && s.ItemId !== '' && String(s.ItemId) === target) return s.SlotTag;
        }
        return null;
      }
      function defIdForInstance(instanceId) {
        if (instanceId == null || instanceId === '') return null;
        const target = String(instanceId);
        const row = ((lastUpdate && lastUpdate.Items) || []).find(
          (i) => i && i.InstanceId != null && String(i.InstanceId) === target);
        return row ? row.ItemId : null;
      }
      function itemByInstance(instanceId) {
        if (instanceId == null) return null;
        const target = String(instanceId);
        return ((lastUpdate && lastUpdate.Items) || []).find(
          (i) => i && i.InstanceId != null && String(i.InstanceId) === target) || null;
      }

      function renderInfo(item) {
        const host = root.querySelector('#inv-info');
        const cat = window.tsic.itemCatalog || {};
        host.classList.remove('tsic-empty');
        host.innerHTML = '';
        const desc = item ? cat[item.ItemId] : null;
        if (!desc) {
          host.classList.add('tsic-empty');
          host.textContent = 'Hover an item to see details';
          return;
        }
        window.TSICInventory.renderInfoPanel(host, Object.assign({ ItemId: item.ItemId }, desc), item);
      }

      function renderMeter() {
        if (!lastUpdate) return;
        const cur = lastUpdate.CurrentWeight || 0;
        const max = lastUpdate.MaxWeight || 0;
        const meter = root.querySelector('#inv-meter');
        root.querySelector('#inv-weight-text').textContent = `${cur.toFixed(1)}/${max.toFixed(0)} kg`;
        // The bar PEGS at 100% while the number keeps counting (soft cap).
        const ratio = max > 0 ? Math.min(1, cur / max) : 0;
        root.querySelector('#inv-weight-fill').style.width = `${(ratio * 100).toFixed(1)}%`;
        meter.dataset.state = max > 0 && cur > max ? 'overburdened'
          : ratio >= 0.75 ? 'warning' : 'normal';

        // Hovered-stack readout: yellow chip (space ALWAYS reserved) + a
        // zero-layout overlay segment at the fill's right end.
        const chip = root.querySelector('#inv-stackw');
        const seg = root.querySelector('#inv-weight-sel');
        const cat = window.tsic.itemCatalog || {};
        const sel = hoveredItem;
        const desc = sel ? cat[sel.ItemId] : null;
        if (sel && desc && max > 0) {
          const stackKg = (desc.Weight || 0) * (sel.Count || 1);
          chip.textContent = `${stackKg.toFixed(1)} kg`;
          chip.classList.remove('none');
          const segWidth = Math.min(ratio, stackKg / max);
          seg.style.display = 'block';
          seg.style.left = `${((ratio - segWidth) * 100).toFixed(2)}%`;
          seg.style.width = `${(segWidth * 100).toFixed(2)}%`;
        } else {
          chip.classList.add('none');
          seg.style.display = 'none';
        }
      }

      function hotbarNumbersByInstance() {
        const map = new Map();
        const slots = (lastHotbar && lastHotbar.SlotIndices) || [];
        for (let i = 0; i < slots.length; i++) {
          if (slots[i] != null && slots[i] >= 0) map.set(String(slots[i]), (i + 1) % 10);
        }
        return map;
      }

      function refresh() {
        if (!lastUpdate) return;
        const cat = window.tsic.itemCatalog || {};
        const activeTab = tabFilter ? tabFilter.getActive() : 'All';
        const filter = TAB_FILTERS[activeTab] || null;
        const equippedIds = new Set(
          ((lastEquipment && lastEquipment.Slots) || [])
            .map((s) => s && s.ItemId)
            .filter((id) => id != null && id !== '')
            .map((id) => String(id))
        );

        const slotCount = lastUpdate.MaxSlots > 0 ? lastUpdate.MaxSlots : 32;
        const lockedPreview = Math.min(MAX_PREVIEW_CELLS, Math.max(0, PREVIEW_TIER_SLOTS - slotCount));

        window.TSICInventory.renderGrid(root.querySelector('#inv-grid'), lastUpdate.Items || [], {
          catalog: cat,
          gridWidth: lastUpdate.GridWidth > 0 ? lastUpdate.GridWidth : 8,
          slotCount,
          lockedPreviewCells: lockedPreview,
          ownerId: 'Player',
          focusGroup: 'inv-grid',
          panelEl: root.querySelector('#inv-panel'),
          equippedIds,
          hotbarNumbersByInstance: hotbarNumbersByInstance(),
          filterFn: filter ? (it) => {
            const desc = cat[it.ItemId];
            return desc ? filter(desc) : false;
          } : null,
          onHover: (it) => {
            hoveredItem = it || null;
            if (it) renderInfo(it);
            renderMeter();
          },
          onLeave: () => { hoveredItem = null; renderMeter(); /* info stays sticky */ },
          // Shift-click quick-move on the inventory screen: equippables equip
          // (armor shift-click parity); everything else is a no-op (§7.4).
          onQuickMove: (it) => {
            const desc = cat[it.ItemId];
            if (desc && desc.Category === 'Equipment') {
              const slotTag = equippedSlotTagFor(it.InstanceId);
              if (slotTag) {
                ctx.publish('UI.Cmd.Equipment.Unequip', { ItemId: '', SlotTag: slotTag });
              } else {
                ctx.publish('UI.Cmd.Equipment.Equip', { ItemId: String(it.InstanceId), SlotTag: '' });
              }
            }
          },
          otherOwnerId: () => '',
          // Paper-doll item dragged into the grid: unequip, then place it in
          // the release cell (the item never left its cell — just unmarked).
          onDollDrop: (src, cellIndex) => {
            if (!src.equipSlotTag) return;
            ctx.publish('UI.Cmd.Equipment.Unequip', { ItemId: '', SlotTag: src.equipSlotTag });
            const worn = itemByInstance(src.instanceId);
            if (worn && worn.GridSlot >= 0 && worn.GridSlot !== cellIndex) {
              ctx.publish('UI.Cmd.Inventory.Move', {
                FromOwnerId: 'Player', ToOwnerId: 'Player',
                ItemId: worn.InstanceId, FromSlot: worn.GridSlot,
                ToSlot: cellIndex, Count: 0,
              });
            }
          },
        });

        // Gamepad landing: opening the screen puts focus on the first grid
        // cell (§8.1). Re-stamped on every re-render.
        const firstCell = root.querySelector('#inv-grid .tsic-slot[data-tsic-focusable]');
        if (firstCell) firstCell.setAttribute('data-tsic-initial-focus', '');

        const used = (lastUpdate.Items || []).length;
        root.querySelector('#inv-slots-text').textContent = `${used}/${slotCount} SLOTS`;
        renderMeter();
        renderHotbar();
      }

      function renderEquipment() {
        const host = root.querySelector('#inv-doll');
        for (const old of host.querySelectorAll('.doll-col')) old.remove();
        const byLabel = new Map();
        for (const s of ((lastEquipment && lastEquipment.Slots) || [])) {
          if (s && s.SlotTag) byLabel.set(s.SlotTag.split('.').pop(), s);
        }
        const makeCol = (labels, gridColumn) => {
          const col = TSIC.el('div', { class: 'doll-col', style: `grid-column:${gridColumn};grid-row:1;` });
          for (const label of labels) {
            const s = byLabel.get(label) || { SlotTag: DOLL_TAG_PREFIX + label, ItemId: '' };
            const isEmpty = !s.ItemId;
            const div = TSIC.el('div', { class: 'equip-slot' + (isEmpty ? '' : ' is-full') });
            div.dataset.equip = label;
            div.setAttribute('data-tsic-focusable', '');
            div.tabIndex = -1;
            if (!isEmpty) {
              const iconUrl = TSIC.itemIconUrl(defIdForInstance(s.ItemId) || s.ItemId);
              div.appendChild(TSIC.iconImg(iconUrl));
              div.title = `${label} — click to unequip, drag into the grid to stow`;
              div.addEventListener('click', () => {
                if (window.TSICInventory.clickSuppressed()) return;
                ctx.publish('UI.Cmd.Equipment.Unequip', { ItemId: '', SlotTag: s.SlotTag });
              });
              div.addEventListener('pointerdown', (e) => {
                window.TSICInventory.beginPointerDrag(div, {
                  equipSlotTag: s.SlotTag, instanceId: s.ItemId, ownerId: 'Player',
                }, iconUrl, e);
              });
            } else {
              div.title = `${label} (empty)`;
            }
            div.appendChild(TSIC.el('span', { class: 'tag' }, label.toUpperCase()));
            // Any doll-slot drop = "try to equip" (backend routes to its slot).
            div._tsicEquipDrop = (src) => {
              if (src.instanceId == null || src.equipSlotTag) return;
              ctx.publish('UI.Cmd.Equipment.Equip', { ItemId: String(src.instanceId), SlotTag: '' });
            };
            col.appendChild(div);
          }
          return col;
        };
        host.appendChild(makeCol(DOLL_LEFT, 1));
        host.appendChild(makeCol(DOLL_RIGHT, 3));
      }

      // In-screen 10-slot hotbar mirror: visible destination for hover+number
      // assignment and drag/held-click assignment (§10.1).
      function renderHotbar() {
        const host = root.querySelector('#inv-hotbar');
        host.innerHTML = '';
        const slots = (lastHotbar && lastHotbar.SlotIndices) || new Array(10).fill(-1);
        const sel = lastHotbar && typeof lastHotbar.SelectedSlot === 'number' ? lastHotbar.SelectedSlot : -1;
        for (let i = 0; i < 10; i++) {
          const hslot = TSIC.el('div', { class: 'hslot' + (i === sel ? ' sel' : '') });
          hslot.dataset.hotbar = i;
          // Controller path for hotbar assignment: pick a stack up (A), walk
          // focus down to the hotbar, A again assigns (the click handler).
          hslot.setAttribute('data-tsic-focusable', '');
          hslot.setAttribute('data-tsic-focus-group', 'inv-hotbar');
          hslot.tabIndex = -1;
          hslot.appendChild(TSIC.el('span', { class: 'num' }, String((i + 1) % 10)));
          const item = itemByInstance(slots[i]);
          if (item && item.ItemId) {
            hslot.appendChild(TSIC.iconImg(TSIC.itemIconUrl(item.ItemId)));
            if ((item.Count || 1) > 1) {
              hslot.appendChild(TSIC.el('span', { class: 'count' }, String(item.Count)));
            }
          }
          hslot.addEventListener('click', () => {
            // A pointerup-committed hotbar assign suppresses this click so it
            // can't double up as a Select. The held branch stays for the
            // gamepad path (focus + A synthesizes a click, no pointerup).
            if (window.TSICInventory.clickSuppressed()) return;
            const heldStack = window.TSICInventory.getHeld();
            if (heldStack) {
              // Click with a held stack = assign it to this hotbar slot; the
              // stack itself stays in its grid cell (id-based assignment).
              // Only equipment and consumables belong on the hotbar.
              if (window.TSICInventory.canAssignToHotbar(heldStack.itemId)) {
                ctx.publish('UI.Cmd.Hotbar.Assign', { SlotIndex: i, ItemId: String(heldStack.instanceId) });
              }
              window.TSICInventory.cancelHeld();
              return;
            }
            ctx.publish('UI.Cmd.Hotbar.Select', { SlotIndex: i });
          });
          host.appendChild(hslot);
        }
      }

      function renderHints() {
        const host = root.querySelector('#inv-hints');
        host.innerHTML = '';
        const heldStack = window.TSICInventory.getHeld();
        if (heldStack) {
          host.appendChild(hintChip(['LMB'], 'Place'));
          host.appendChild(hintChip(['RMB'], 'Place one'));
          host.appendChild(hintChip(['ESC'], 'Return'));
        } else {
          host.appendChild(hintChip(['LMB'], 'Take'));
          host.appendChild(hintChip(['RMB'], 'Split'));
          host.appendChild(hintChip(['SHIFT', 'LMB'], 'Equip'));
          host.appendChild(hintChip(['G'], 'Drop 1'));
          host.appendChild(hintChip(['CTRL', 'G'], 'Drop stack'));
          host.appendChild(hintChip(['1', '0'], 'Hotbar'));
        }
      }

      // ---- one-time wiring -----------------------------------------

      (function waitForDeps() {
        if (!window.TSICInventory || !window.TSIC || !window.TSIC.TabFilter) {
          setTimeout(waitForDeps, 16);
          return;
        }
        tabFilter = TSIC.TabFilter.create(
          root.querySelector('#inv-tabs'), TAB_DEFS, () => refresh()
        );
        renderEquipment();
        renderHints();
      })();

      this._renderAll = () => {
        renderEquipment();
        renderHints();
        if (window.TSICInventory) refresh();
      };

      // Cold start: a fresh page with an unchanged inventory has no snapshot to
      // replay, leaving the grid unrendered. Ask C++ to re-broadcast the player
      // inventory/equipment/hotbar state.
      ctx.publish('UI.Cmd.Inventory.RequestSync', {});

      ctx.on('tsic.msg.UI.Inventory.Updated', (p) => {
        if (!p || p.OwnerId !== 'Player') return;
        lastUpdate = p;
        // Rule 40: a broadcast mid-gesture preserves the ghost only while its
        // source entry still matches.
        if (window.TSICInventory) window.TSICInventory.reconcileHeld('Player', p.Items);
        if (!ctx.isVisible()) return;
        refresh();
        renderEquipment();
      });
      ctx.on('tsic.msg.UI.Equipment.Updated', (p) => {
        if (!p || p.OwnerId !== 'Player') return;
        lastEquipment = p;
        if (!ctx.isVisible()) return;
        renderEquipment();
        const eqIds = new Set(
          (p.Slots || []).map((s) => s && s.ItemId)
            .filter((id) => id != null && id !== '')
            .map((id) => String(id))
        );
        window.TSICInventory.updateEquippedClasses(root.querySelector('#inv-grid'), eqIds);
      });
      ctx.on('tsic.msg.UI.Hotbar.Changed', (p) => {
        lastHotbar = p || null;
        if (!ctx.isVisible()) return;
        renderHotbar();
        if (window.TSICInventory && lastUpdate) refresh();
      });
      // Gamepad grid actions (§8.2) on the focused cell: Y split/place-one,
      // X quick-move (equip), d-pad down drop one.
      ctx.on('tsic.msg.UI.Behavior.InvSplit', (e) => {
        if (ctx.isVisible() && e && e.Phase === 'Started') {
          window.TSICInventory.behaviorOnFocused('split');
          renderHints();
        }
      });
      ctx.on('tsic.msg.UI.Behavior.InvQuickMove', (e) => {
        if (ctx.isVisible() && e && e.Phase === 'Started') window.TSICInventory.behaviorOnFocused('quickmove');
      });
      ctx.on('tsic.msg.UI.Behavior.InvDrop', (e) => {
        if (ctx.isVisible() && e && e.Phase === 'Started') window.TSICInventory.behaviorOnFocused('drop');
      });

      ctx.on('tsic.msg.UI.CharacterPreview.Ready', (p) => {
        if (!p || !p.bReady) return;
        const img = root.querySelector('#inv-char-img');
        if (!img) return;
        if (this._previewStream) this._previewStream();
        this._previewStream = TSIC.startRuntimeImgStream(img, 'character-preview');
      });

      window.addEventListener('tsic-item-catalog', () => { if (ctx.isVisible()) refresh(); });

      // Held commits and outside-drops ride the engine's global gesture
      // tracker; the hint row follows the held state.
      window.TSICInventory.onHeldChanged(() => { if (ctx.isVisible()) renderHints(); });
      root.querySelector('#inv-root').addEventListener('contextmenu', (e) => {
        // RMB never opens a context menu on this screen (no context menu by
        // design §7.6); background RMB with a held stack drops one instead.
        e.preventDefault();
      });

      // Keyboard (hover-based, §7.3): number keys assign the hovered item to
      // the hotbar; Q drops one, Ctrl+Q the whole hovered stack.
      document.addEventListener('keydown', (e) => {
        if (!ctx.isVisible()) return;
        if (/^[0-9]$/.test(e.key) && hoveredItem) {
          // Only equipment and consumables belong on the hotbar.
          if (!window.TSICInventory.canAssignToHotbar(hoveredItem.ItemId)) return;
          const slotIndex = e.key === '0' ? 9 : (parseInt(e.key, 10) - 1);
          ctx.publish('UI.Cmd.Hotbar.Assign', {
            SlotIndex: slotIndex,
            ItemId: String(hoveredItem.InstanceId),
          });
          return;
        }
        if ((e.key === 'g' || e.key === 'G') && hoveredItem && !window.TSICInventory.getHeld()) {
          window.TSICInventory.dropHovered({ ownerId: 'Player' }, hoveredItem, e.ctrlKey);
          return;
        }
        if (e.key === 'Escape') {
          // bindEscape closes the screen; a held stack visually returns first.
          window.TSICInventory.cancelHeld();
          renderHints();
        }
      });
    },

    // Gamepad B / Esc: a held stack returns first; the next press closes.
    onCancel() {
      if (window.TSICInventory && window.TSICInventory.getHeld()) {
        window.TSICInventory.cancelHeld();
        return true;
      }
      return false;
    },

    onShow(/* params, ctx */) {
      if (this._renderAll) this._renderAll();
      window.tsic.publishMessage('UI.Cmd.CharacterPreview.Show', {});
    },

    onHide(/* ctx */) {
      // Closing with a held stack: nothing ever moved — the gesture dissolves.
      if (window.TSICInventory) window.TSICInventory.cancelHeld();
      if (this._previewStream) { this._previewStream(); this._previewStream = null; }
      window.tsic.publishMessage('UI.Cmd.CharacterPreview.Hide', {});
    },
  });
})();
