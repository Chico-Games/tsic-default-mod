// Inventory screen module. Was screens/inventory.html.
//
// Heaviest of the common menus — the page-form version was a notable
// fraction of perceived menu lag because every open re-parsed the whole
// shared/inventory.js library and rebuilt the equipment row from scratch.
// As an overlay, the catalog stays warm, listeners stay subscribed, and
// the equipment row is rebuilt only when UI.Equipment.Updated arrives.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const STYLE = `
    [data-screen="Inventory"] #inv-root { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:auto; }
    [data-screen="Inventory"] #inv-header { display:flex; align-items:baseline; gap:18px; margin-bottom:8px; }
    [data-screen="Inventory"] #inv-header .spacer { flex:1; }
    [data-screen="Inventory"] #inv-tabs { display:flex; gap:0; }
    [data-screen="Inventory"] #inv-capacity { display:flex; flex-direction:column; gap:2px; font-size:11px; min-width:200px; }
    [data-screen="Inventory"] #inv-capacity-line { display:flex; justify-content:space-between; color:rgba(37,33,25,0.75); }
    [data-screen="Inventory"] #inv-capacity-bar { height:5px; background:rgba(241,229,207,0.55); border-radius:3px; overflow:hidden; }
    [data-screen="Inventory"] #inv-capacity-fill { height:100%; width:0; background:#cbd5e1; transition: width 100ms linear, background 100ms linear; }
    [data-screen="Inventory"] #inv-capacity[data-state="warning"] #inv-capacity-fill { background:#f59e0b; }
    [data-screen="Inventory"] #inv-capacity[data-state="full"] #inv-capacity-fill { background:#ef4444; }
    [data-screen="Inventory"] #inv-capacity[data-state="overburdened"] #inv-capacity-fill { background:#b91c1c; }
    [data-screen="Inventory"] #inv-capacity[data-state="overburdened"] #inv-capacity-overburdened { display:block; }
    [data-screen="Inventory"] #inv-capacity-overburdened { display:none; color:#b91c1c; font-weight:600; letter-spacing:1px; }
    [data-screen="Inventory"] #inv-panel {
      width:80vw; height:82vh; max-width:1360px; max-height:940px;
    }
    [data-screen="Inventory"] .tsic-split {
      grid-template-columns: minmax(0, 1.75fr) minmax(0, 1fr);
    }
    [data-screen="Inventory"] #inv-grid {
      flex:1 1 auto; min-height:0;
      display:grid; grid-template-columns: repeat(var(--grid-cols, 8), minmax(0, 1fr));
      grid-template-rows: repeat(var(--grid-rows, 8), minmax(0, 1fr));
      gap:6px; overflow:auto; padding:10px;
      background: rgba(184,170,145,0.30); border:1px solid var(--tsic-border);
      box-shadow: inset 0 1px 4px rgba(37,33,25,0.18);
    }
    [data-screen="Inventory"] .tsic-slot {
      width:100%; height:100%; min-width:44px; min-height:44px; position:relative; cursor:pointer; padding:5px;
      background: rgba(241,229,207,0.55); border:1px solid rgba(37,33,25,0.28);
      box-shadow: inset 0 1px 2px rgba(37,33,25,0.14);
      transition: background-color 90ms ease, border-color 90ms ease,
                  opacity 160ms ease, filter 160ms ease, transform 90ms ease;
    }
    [data-screen="Inventory"] .tsic-slot img { image-rendering:auto; }
    [data-screen="Inventory"] .tsic-slot:hover,
    [data-screen="Inventory"] .tsic-slot[data-tsic-focused] {
      background: rgba(241,229,207,0.95);
      border-color: rgba(37,33,25,0.55);
      transform: translateY(-1px);
    }
    [data-screen="Inventory"] .tsic-slot.is-selected { outline:2px solid var(--cat-ink-soft, #514739); outline-offset:-2px; }
    [data-screen="Inventory"] .tsic-slot.is-dragging { opacity:0.35; }
    [data-screen="Inventory"] .tsic-slot.is-drop-target {
      outline:2px solid var(--cat-green, #3f7d4f); outline-offset:-2px;
      background: rgba(63,125,79,0.18);
    }
    [data-screen="Inventory"] .tsic-slot.is-filtered { opacity:0.18; filter:grayscale(0.8); }
    [data-screen="Inventory"] .tsic-slot.is-equipped {
      outline:1px solid var(--cat-green, #3f7d4f); outline-offset:-1px;
      background: rgba(63,125,79,0.12);
    }
    [data-screen="Inventory"] .tsic-slot .count {
      position:absolute; right:2px; bottom:2px; min-width:14px; height:14px;
      line-height:14px; padding:0 3px; font-size:10px; font-weight:700;
      text-align:center; color:#f6efdf; background:rgba(37,33,25,0.82);
      border-radius:7px; pointer-events:none;
    }
    [data-screen="Inventory"] .tsic-slot .equip-badge {
      position:absolute; top:-4px; right:-4px;
      min-width:13px; height:13px; line-height:13px;
      padding:0 1px; font-size:9px; text-align:center;
      color:#f6efdf; background: var(--cat-green, #3f7d4f);
      border-radius:7px; pointer-events:none;
      box-shadow:0 1px 2px rgba(0,0,0,0.35);
    }
    [data-screen="Inventory"] #inv-doll {
      display:grid; gap:8px; padding:10px; flex:0 0 auto;
      grid-template-columns: 64px 1fr 64px;
      grid-template-rows: 92px 92px 92px 92px;
      background: rgba(184,170,145,0.35); border:1px solid var(--tsic-border);
      box-shadow: inset 0 1px 4px rgba(37,33,25,0.18);
    }
    [data-screen="Inventory"] #inv-doll .equip-slot { width:auto; height:auto; }
    [data-screen="Inventory"] #inv-doll #inv-char-preview { grid-column:2; grid-row:1 / span 4; min-height:0; }
    [data-screen="Inventory"] .equip-slot[data-equip="Head"]   { grid-column:3; grid-row:1; }
    [data-screen="Inventory"] .equip-slot[data-equip="Body"]   { grid-column:3; grid-row:2; }
    [data-screen="Inventory"] .equip-slot[data-equip="Legs"]   { grid-column:3; grid-row:3; }
    [data-screen="Inventory"] .equip-slot[data-equip="Shoes"]  { grid-column:3; grid-row:4; }
    [data-screen="Inventory"] .equip-slot[data-equip="Weapon"] { grid-column:1; grid-row:2; }
    [data-screen="Inventory"] .equip-slot[data-equip="Gloves"] { grid-column:1; grid-row:3; }
    [data-screen="Inventory"] #inv-info { padding:12px; background: rgba(241,229,207,0.88); border:1px solid var(--tsic-border); min-height: 140px; flex: 1 1 auto; overflow:auto; }
    [data-screen="Inventory"] #inv-info img { width:72px !important; height:72px !important; margin:0 auto 8px !important; }
    [data-screen="Inventory"] #inv-info h3 { font-size: 16px; }
    [data-screen="Inventory"] #inv-info p { margin: 4px 0; }
    [data-screen="Inventory"] #inv-equip-row { display:flex; gap:6px; padding:6px; background: rgba(184,170,145,0.35); border:1px solid var(--tsic-border); flex-wrap: wrap; flex: 0 0 auto; }
    [data-screen="Inventory"] .equip-slot {
      width:48px; height:48px;
      background: rgba(241,229,207,0.55);
      border:1px solid var(--tsic-border);
      display:flex; align-items:center; justify-content:center;
      font-size:9px; letter-spacing:1px; text-transform:uppercase;
      color: var(--cat-ink-soft);
      cursor:pointer;
      position: relative;
    }
    [data-screen="Inventory"] .equip-slot.is-empty {
      background: rgba(241,229,207,0.15);
      border-style: dashed;
      border-color: rgba(184,170,145,0.75);
      color: rgba(81,71,57,0.75);
    }
    [data-screen="Inventory"] .equip-slot:hover { background: rgba(241,229,207,0.88); }
    [data-screen="Inventory"] .equip-slot.is-empty:hover { background: rgba(241,229,207,0.45); color: var(--cat-ink-muted, var(--cat-ink-soft)); border-color: var(--cat-border); }
    [data-screen="Inventory"] .equip-slot img { width:100%; height:100%; object-fit:contain; pointer-events:none; }
    [data-screen="Inventory"] .equip-slot.is-drop-target { outline: 2px solid var(--cat-green); outline-offset: -2px; }
    [data-screen="Inventory"] #inv-char-preview { min-height: 120px; background: rgba(241,229,207,0.92); border:1px solid var(--tsic-border); display:flex; align-items:center; justify-content:center; overflow:hidden; }
    [data-screen="Inventory"] #inv-char-preview img { width:100%; height:100%; object-fit:contain; transform:scale(2); transform-origin:50% 42%; }
  `;

  const TEMPLATE = `
    <div id="inv-root" class="tsic-modal-scrim">
      <div id="inv-panel" class="tsic-panel tsic-panel--screen">
        <div id="inv-header">
          <h2 class="tsic-title" style="margin:0;">Inventory</h2>
          <div id="inv-tabs" data-tsic-tab-bar></div>
          <div class="spacer"></div>
          <div id="inv-capacity">
            <div id="inv-capacity-line">
              <span id="inv-capacity-text">CAPACITY: —</span>
              <span id="inv-capacity-overburdened">OVERBURDENED</span>
            </div>
            <div id="inv-capacity-bar"><div id="inv-capacity-fill"></div></div>
          </div>
        </div>

        <div class="tsic-split">
          <div class="tsic-split-col">
            <div class="tsic-eyebrow">Items</div>
            <div id="inv-grid"></div>
          </div>
          <div class="tsic-split-col">
            <div class="tsic-eyebrow">Character</div>
            <div id="inv-doll"><div id="inv-char-preview"><img id="inv-char-img" alt=""></div></div>
            <div class="tsic-eyebrow" style="margin-top:6px;">Selected</div>
            <div id="inv-info" class="tsic-empty">Hover an item to see details</div>
          </div>
        </div>

        <div class="tsic-close-row">
          <button class="tsic-button" id="btn-close" data-tsic-initial-focus>Close (Esc)</button>
        </div>
      </div>
    </div>
  `;

  // Tabs FILTER the grid in place: non-matching items dim (.is-filtered) but
  // never move — hand-placed positions are sacred.
  const TAB_FILTERS = {
    'All':           null,
    'Equipment':     (d) => d.Category === 'Equipment',
    'Consumables':   (d) => d.Category === 'Consumable',
    'Constructable': (d) => d.Category === 'Constructable',
    'Ammo':          (d) => d.Category === 'Ammo',
    'Materials':     (d) => d.Category === 'CraftingMaterial',
  };
  const TAB_DEFS = Object.keys(TAB_FILTERS).map((id) => ({ id, label: id }));

  function injectStyleOnce() {
    if (document.getElementById('screen-inventory-style')) return;
    const s = document.createElement('style');
    s.id = 'screen-inventory-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  // Default equipment slot order — shown even before the server's first
  // UI.Equipment.Updated arrives so the row isn't blank on first open.
  const DEFAULT_EQUIP_SLOTS = [
    'Entity.Inventory.Item.Equipment.Slot.Head',
    'Entity.Inventory.Item.Equipment.Slot.Body',
    'Entity.Inventory.Item.Equipment.Slot.Legs',
    'Entity.Inventory.Item.Equipment.Slot.Shoes',
    'Entity.Inventory.Item.Equipment.Slot.Weapon',
    'Entity.Inventory.Item.Equipment.Slot.Gloves',
  ];

  TSIC.registerScreen('Inventory', {
    inputModeTag: 'InputMode.Menu.Inventory',
    cancelCmd: 'UI.Cmd.Pause.Resume',
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();

      // Per-mount state (closed over by the helpers below). Lives for the
      // lifetime of the SPA shell — the inventory module is mounted once.
      let tabFilter = null;
      let lastUpdate = null;
      let lastEquipment = null;
      let hoveredItem = null;
      let selectedSlot = -1;
      this._state = { get hoveredItem() { return hoveredItem; } };

      // Slot tag of the equipment slot currently holding this item instance, or
      // null if it isn't worn. The equipment snapshot reports InternalInventoryId
      // (== the row's stable InstanceId) per slot, so we match on that.
      function equippedSlotTagFor(instanceId) {
        if (instanceId == null) return null;
        const target = String(instanceId);
        for (const s of ((lastEquipment && lastEquipment.Slots) || [])) {
          if (s && s.ItemId != null && s.ItemId !== '' && String(s.ItemId) === target) return s.SlotTag;
        }
        return null;
      }

      function publishHoverContext(it) {
        if (!window.tsic || !window.tsic.setMenuActionContext) return;
        const cat = window.tsic.itemCatalog || {};
        if (!it) { window.tsic.setMenuActionContext([]); return; }
        const desc = cat[it.ItemId];
        const category = desc && desc.Category;
        const entries = [];
        if (category === 'Equipment') {
          const equipLabel = equippedSlotTagFor(it.InstanceId) ? 'Unequip' : 'Equip';
          entries.push({ ActionName: 'IA_UI_ConfirmAccept', Label: equipLabel,      Priority: 10 });
          entries.push({ ActionName: 'IA_UI_AddToHotbar',   Label: 'Assign Hotbar', Priority: 20 });
          entries.push({ ActionName: 'IA_UI_DropItem',      Label: 'Drop',          Priority: 30 });
        } else if (category === 'Consumable') {
          entries.push({ ActionName: 'IA_UI_ConfirmAccept', Label: 'Use',  Priority: 10 });
          entries.push({ ActionName: 'IA_UI_DropItem',      Label: 'Drop', Priority: 30 });
        } else {
          entries.push({ ActionName: 'IA_UI_DropItem', Label: 'Drop', Priority: 30 });
        }
        window.tsic.setMenuActionContext(entries);
      }

      function renderInfo(desc, instance) {
        const host = root.querySelector('#inv-info');
        host.classList.remove('tsic-empty');
        host.innerHTML = '';
        if (!desc) {
          host.classList.add('tsic-empty');
          host.textContent = 'Hover an item to see details';
          return;
        }
        window.TSICInventory.renderInfoPanel(host, desc, instance);
      }

      function refresh() {
        if (!lastUpdate) return;
        const cat = window.tsic.itemCatalog || {};
        const activeTab = tabFilter ? tabFilter.getActive() : 'All';
        const filter = TAB_FILTERS[activeTab] || null;
        // Stable instance ids of currently-equipped items, so worn cells render an
        // outline + badge. The equipment snapshot reports InternalInventoryId per slot.
        const equippedIds = new Set(
          ((lastEquipment && lastEquipment.Slots) || [])
            .map((s) => s && s.ItemId)
            .filter((id) => id != null && id !== '')
            .map((id) => String(id))
        );
        const opts = {
          catalog: cat,
          gridWidth: lastUpdate.GridWidth > 0 ? lastUpdate.GridWidth : 8,
          gridHeight: lastUpdate.GridHeight > 0 ? lastUpdate.GridHeight : 6,
          ownerId: 'Player',
          selectedGridSlot: selectedSlot,
          equippedIds,
          // Tabs dim non-matching items in place; unknown-category items only
          // light up under All.
          filterFn: filter ? (it) => {
            const desc = cat[it.ItemId];
            return desc ? filter(desc) : false;
          } : null,
          onHover: (it) => {
            hoveredItem = it || hoveredItem;
            if (it) {
              renderInfo(cat[it.ItemId] || null, it);
              publishHoverContext(it);
            }
          },
          onLeave: () => { /* sticky — keep last preview */ },
          onClick: (it, cellIndex) => {
            selectedSlot = cellIndex;
            window.TSICInventory.updateSelectedSlot(root.querySelector('#inv-grid'), selectedSlot);
            if (!it) return;
            const desc = cat[it.ItemId];
            if (desc && desc.Category === 'Equipment') {
              // Toggle: clicking a worn item takes it off, an unworn one puts it on.
              // Equip keys off the stable InstanceId (InternalInventoryId); unequip keys
              // off the slot tag it occupies, since C++ resolves unequip by SlotTag.
              const slotTag = equippedSlotTagFor(it.InstanceId);
              if (slotTag) {
                ctx.publish('UI.Cmd.Equipment.Unequip', { ItemId: '', SlotTag: slotTag });
              } else {
                ctx.publish('UI.Cmd.Equipment.Equip', { ItemId: String(it.InstanceId), SlotTag: '' });
              }
            } else if (desc && desc.Category === 'Consumable') {
              ctx.publish('UI.Cmd.Inventory.Use', { OwnerId: 'Player', SlotIndex: it.SlotIndex });
            }
            // Equip/use roundtrips back through Inventory.Updated /
            // Equipment.Updated which refresh whatever changed.
          },
          onRMB: (it, cellIndex, e) => {
            if (!it) return;
            selectedSlot = cellIndex;
            window.TSICInventory.updateSelectedSlot(root.querySelector('#inv-grid'), selectedSlot);
            if (!window.TSICContextMenu) return;
            const entries = window.TSICInventory.buildItemContextMenu({
              it,
              desc: cat[it.ItemId],
              storageOpen: false,
              fromOwnerId: 'Player',
              equippedSlotTag: equippedSlotTagFor(it.InstanceId),
            });
            window.TSICContextMenu.open({ x: e.clientX, y: e.clientY, entries });
          },
          onDrop: (src, cellIndex) => {
            // Paper-doll slot dragged into the grid: take it off, then place it.
            if (src.equipSlotTag) {
              ctx.publish('UI.Cmd.Equipment.Unequip', { ItemId: '', SlotTag: src.equipSlotTag });
              const worn = (lastUpdate.Items || []).find(
                (i) => String(i.InstanceId) === String(src.instanceId));
              if (worn && worn.GridSlot >= 0 && worn.GridSlot !== cellIndex) {
                ctx.publish('UI.Cmd.Inventory.Move', {
                  FromOwnerId: 'Player', ToOwnerId: 'Player',
                  FromSlot: worn.GridSlot, ToSlot: cellIndex,
                });
              }
              return;
            }
            if (src.gridSlot == null || src.gridSlot < 0) return;
            const fromOwner = src.ownerId || 'Player';
            if (fromOwner === 'Player' && src.gridSlot === cellIndex) return;
            ctx.publish('UI.Cmd.Inventory.Move', {
              FromOwnerId: fromOwner, ToOwnerId: 'Player',
              FromSlot: src.gridSlot, ToSlot: cellIndex,
            });
            tsic.playSound('Inventory.Transfer');
          },
        };
        window.TSICInventory.renderGrid(root.querySelector('#inv-grid'), lastUpdate.Items || [], opts);

        const used = (lastUpdate.Items || []).length;
        const cur = lastUpdate.CurrentWeight || 0;
        const max = lastUpdate.MaxWeight || 0;
        const ratio = max > 0 ? cur / max : 0;
        const cap = root.querySelector('#inv-capacity');
        root.querySelector('#inv-capacity-text').textContent =
          `CAPACITY: ${used} items · ${cur.toFixed(2)}/${max.toFixed(2)} kg`;
        root.querySelector('#inv-capacity-fill').style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
        cap.dataset.state = ratio >= 1.05 ? 'overburdened'
          : ratio >= 1.0  ? 'full'
          : ratio >= 0.75 ? 'warning'
          : 'normal';
      }

      function renderEquipment() {
        const host = root.querySelector('#inv-doll');
        // Rebuild only the equip slots — the char preview (and its streaming
        // <img>) stays put so the stream isn't torn down on every update.
        for (const old of host.querySelectorAll('.equip-slot')) old.remove();
        const byTag = new Map();
        const serverSlots = (lastEquipment && lastEquipment.Slots) || [];
        for (const s of serverSlots) if (s && s.SlotTag) byTag.set(s.SlotTag, s);
        const tagOrder = DEFAULT_EQUIP_SLOTS.slice();
        for (const s of serverSlots) {
          if (s && s.SlotTag && tagOrder.indexOf(s.SlotTag) === -1) tagOrder.push(s.SlotTag);
        }
        for (const tag of tagOrder) {
          const s = byTag.get(tag) || { SlotTag: tag, ItemId: '' };
          const div = document.createElement('div');
          const isEmpty = !s.ItemId;
          div.className = 'equip-slot' + (isEmpty ? ' is-empty' : '');
          const label = (s.SlotTag || '').split('.').pop();
          // Anchors the paper-doll grid position (see [data-equip] CSS).
          div.dataset.equip = label;
          div.setAttribute('data-tsic-focusable', '');
          div.tabIndex = -1;
          if (!isEmpty) {
            // iconImg retries the cold-cache 404 and serves the in-data fallback
            // on miss, so equipment slots no longer show the broken-image glyph.
            const img = TSIC.iconImg(TSIC.itemIconUrl(s.ItemId));
            div.appendChild(img);
            div.title = `${label} — click to unequip, drag into the grid to stow`;
            div.addEventListener('click', () => {
              if (window.TSICInventory.clickSuppressed()) return;
              ctx.publish('UI.Cmd.Equipment.Unequip', { ItemId: '', SlotTag: s.SlotTag });
            });
            // Drag a worn item off the doll: the grid's onDrop unequips and
            // places it in the release cell.
            div.addEventListener('pointerdown', (e) => {
              window.TSICInventory.beginPointerDrag(div, {
                equipSlotTag: s.SlotTag, instanceId: s.ItemId, ownerId: 'Player',
              }, TSIC.itemIconUrl(s.ItemId), e);
            });
          } else {
            div.textContent = label;
            div.title = `${label} (empty)`;
          }
          // Pointer-drag release target: any doll slot drop = "try to equip"
          // (the backend routes the item to its matching slot).
          div._tsicEquipDrop = (src) => {
            if (src.instanceId == null || src.equipSlotTag) return;
            ctx.publish('UI.Cmd.Equipment.Equip', { ItemId: String(src.instanceId), SlotTag: '' });
          };
          host.appendChild(div);
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
        // Render empty slot squares immediately so the row isn't blank
        // before UI.Equipment.Updated arrives.
        renderEquipment();
      })();

      // Exposed for onShow: live inventory/equipment broadcasts are received even while
      // the overlay is hidden (sticky replay sets lastUpdate/lastEquipment), but their
      // render is skipped because the screen isn't visible. Re-render from that cached
      // state every time the screen opens so a pickup made before opening shows at once.
      this._renderAll = () => {
        renderEquipment();
        if (window.TSICInventory) refresh();
      };

      ctx.on('tsic.msg.UI.Inventory.Updated', (p) => {
        if (!p || p.OwnerId !== 'Player') return;
        lastUpdate = p;
        if (ctx.isVisible()) refresh();
      });
      ctx.on('tsic.msg.UI.Equipment.Updated', (p) => {
        if (!p || p.OwnerId !== 'Player') return;
        lastEquipment = p;
        if (!ctx.isVisible()) return;
        renderEquipment();
        // Equipped badges/outlines on inventory rows: partial update only,
        // toggling the .is-equipped class on the affected rows. The full refresh
        // path (rebuilds every row + refetches every icon) only kicks in if the
        // helper isn't available.
        const eqIds = new Set(
          (p.Slots || []).map((s) => s && s.ItemId)
            .filter((id) => id != null && id !== '')
            .map((id) => String(id))
        );
        const gridHost = root.querySelector('#inv-grid');
        if (window.TSICInventory && typeof window.TSICInventory.updateEquippedClasses === 'function') {
          window.TSICInventory.updateEquippedClasses(gridHost, eqIds);
        } else if (window.TSICInventory) {
          refresh();
        }
      });
      ctx.on('tsic.msg.UI.CharacterPreview.Ready', (p) => {
        if (!p || !p.bReady) return;
        const img = root.querySelector('#inv-char-img');
        if (!img) return;
        // Stream the capture so the character's idle animation plays live.
        if (this._previewStream) this._previewStream();
        this._previewStream = TSIC.startRuntimeImgStream(img, 'character-preview');
      });
      // BH_ItemOptions: open the item context menu (drop / split / assign-hotbar / transfer)
      // for the focused/hovered item. Replaces the per-action IA_UI_AddToHotbar / DropItem
      // gamepad shortcuts — those verbs now live inside this one options modal.
      ctx.on('tsic.msg.UI.Behavior.ItemOptions', (e) => {
        if (!ctx.isVisible() || e.Phase !== 'Started' || !hoveredItem || !window.TSICInventory || !window.TSICContextMenu) return;
        const it = hoveredItem;
        const cellEl = root.querySelector(`#inv-grid .tsic-slot[data-instance="${it.InstanceId}"]`);
        if (cellEl) {
          selectedSlot = parseInt(cellEl.dataset.grid, 10);
          window.TSICInventory.updateSelectedSlot(root.querySelector('#inv-grid'), selectedSlot);
        }
        const entries = window.TSICInventory.buildItemContextMenu({
          it, desc: (window.tsic.itemCatalog || {})[it.ItemId], storageOpen: false, fromOwnerId: 'Player',
          equippedSlotTag: equippedSlotTagFor(it.InstanceId),
        });
        // Anchor the menu to the focused row if we can find it, else screen centre.
        const focused = document.querySelector('[data-tsic-focused]');
        const r = focused && focused.getBoundingClientRect ? focused.getBoundingClientRect() : null;
        const x = r ? r.right : (window.innerWidth / 2);
        const y = r ? r.top : (window.innerHeight / 2);
        window.TSICContextMenu.open({ x, y, entries });
      });

      window.addEventListener('tsic-item-catalog', () => { if (ctx.isVisible()) refresh(); });

      root.querySelector('#btn-close').addEventListener('click', () => {
        ctx.publish('UI.Cmd.CharacterPreview.Hide');
        ctx.publish('UI.Cmd.Pause.Resume');
      });

      // Hotbar number-key shortcut: only fires while the inventory is the
      // active overlay, so a stray "5" press elsewhere doesn't reassign a
      // hotbar slot.
      document.addEventListener('keydown', (e) => {
        if (!ctx.isVisible()) return;
        if (/^[0-9]$/.test(e.key) && hoveredItem) {
          const slotIndex = e.key === '0' ? 9 : (parseInt(e.key, 10) - 1);
          ctx.publish('UI.Cmd.Hotbar.Assign', {
            SlotIndex: slotIndex,
            ItemId: String(hoveredItem.InstanceId),
          });
        }
      });
    },

    onShow(/* params, ctx */) {
      // Paint the latest known inventory + equipment immediately (see _renderAll).
      if (this._renderAll) this._renderAll();
      // Server-side character preview render: tell the renderer to spin
      // up its texture target. CharacterPreview.Ready will arrive once the
      // texture is bound, and the existing listener swaps the img src.
      window.tsic.publishMessage('UI.Cmd.CharacterPreview.Show', {});
    },

    onHide(/* ctx */) {
      if (this._previewStream) { this._previewStream(); this._previewStream = null; }
      window.tsic.publishMessage('UI.Cmd.CharacterPreview.Hide', {});
    },
  });
})();
