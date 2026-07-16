// Shared two-pane inventory-transfer view used by both /screens/storage.html
// (regular storage containers) and /screens/universal-storage.html (universal
// inventory). Mirrors the UMG UStorageScreen widget: PlayerInventoryList +
// StorageInventoryList side-by-side, each with its own category tabs and
// capacity bar, plus a shared item-info strip for the hovered selection.
//
// Mount it from a page body once tsic + TSICInventory are ready:
//   TSICStorageShell.mount({
//     title: 'Storage',
//     containerEyebrow: 'Container',
//     containerOwnerIdMatch: id => typeof id === 'string' && id.indexOf('Storage:') === 0,
//     containerInitialOwnerId: null,
//     containerMaxSlots: 32,
//   });
(function () {
    const TABS = [
        { id: 'All',           filter: null },
        { id: 'Equipment',     filter: c => c === 'Equipment' },
        { id: 'Consumables',   filter: c => c === 'Consumable' },
        { id: 'Constructable', filter: c => c === 'Constructable' },
        { id: 'Ammo',          filter: c => c === 'Ammo' },
        { id: 'Materials',     filter: c => c === 'CraftingMaterial' },
    ];

    function categoryFor(itemId) {
        const cat = (window.tsic && window.tsic.itemCatalog) || {};
        const desc = cat[itemId];
        return desc ? desc.Category : null;
    }
    // Tabs dim non-matching items in place (renderGrid .is-filtered) — grid
    // positions never change under a filter.
    function filterFnFor(tabId) {
        const tab = TABS.find(t => t.id === tabId);
        if (!tab || !tab.filter) return null;
        return (it) => tab.filter(categoryFor(it.ItemId));
    }

    const GRID_STYLE = [
        '#ss-panel .ss-grid {',
        '  display:grid; grid-template-columns: repeat(var(--grid-cols, 8), 46px);',
        '  gap:5px; align-content:start; overflow:auto; padding:8px;',
        '  background: rgba(184,170,145,0.30); border:1px solid var(--tsic-border);',
        '  box-shadow: inset 0 1px 4px rgba(37,33,25,0.18);',
        '}',
        '#ss-panel .tsic-slot {',
        '  width:46px; height:46px; position:relative; cursor:pointer; padding:3px;',
        '  background: rgba(241,229,207,0.55); border:1px solid rgba(37,33,25,0.28);',
        '  box-shadow: inset 0 1px 2px rgba(37,33,25,0.14);',
        '  transition: background-color 90ms ease, border-color 90ms ease,',
        '              opacity 160ms ease, filter 160ms ease, transform 90ms ease;',
        '}',
        '#ss-panel .tsic-slot:hover,',
        '#ss-panel .tsic-slot[data-tsic-focused] {',
        '  background: rgba(241,229,207,0.95);',
        '  border-color: rgba(37,33,25,0.55);',
        '}',
        '#ss-panel .tsic-slot.is-selected { outline:2px solid var(--cat-ink-soft, #514739); outline-offset:-2px; }',
        '#ss-panel .tsic-slot.is-dragging { opacity:0.35; }',
        '#ss-panel .tsic-slot.is-drop-target {',
        '  outline:2px solid var(--cat-green, #3f7d4f); outline-offset:-2px;',
        '  background: rgba(63,125,79,0.18);',
        '}',
        '#ss-panel .tsic-slot.is-filtered { opacity:0.18; filter:grayscale(0.8); }',
        '#ss-panel .tsic-slot .count {',
        '  position:absolute; right:2px; bottom:2px; min-width:14px; height:14px;',
        '  line-height:14px; padding:0 3px; font-size:10px; font-weight:700;',
        '  text-align:center; color:#f6efdf; background:rgba(37,33,25,0.82);',
        '  border-radius:7px; pointer-events:none;',
        '}',
    ].join('\n');

    function injectGridStyleOnce() {
        if (document.getElementById('ss-grid-style')) return;
        const s = document.createElement('style');
        s.id = 'ss-grid-style';
        s.textContent = GRID_STYLE;
        document.head.appendChild(s);
    }
    function playTransferSound() {
        try { tsic.playSound('Inventory.Transfer'); } catch {}
    }

    function describe(it) {
        const cat = (window.tsic && window.tsic.itemCatalog) || {};
        return cat[it && it.ItemId] || null;
    }

    function totalWeight(items) {
        const cat = (window.tsic && window.tsic.itemCatalog) || {};
        let w = 0;
        for (const it of (items || [])) {
            const d = cat[it.ItemId];
            if (d && typeof d.Weight === 'number') w += d.Weight * (it.Count || 1);
        }
        return w;
    }

    function buildLayout(host, opts) {
        host.innerHTML = `
            <div id="ss-header">
                <h2 class="tsic-title" style="margin:0;">${opts.title}</h2>
                <div class="spacer"></div>
                <button class="tsic-button cancel" id="ss-take-all" type="button">Take All</button>
            </div>
            <div class="tsic-split">
                <div class="tsic-split-col" data-tsic-tab-context="player">
                    <div class="ss-col-head">
                        <div class="tsic-eyebrow">Your Inventory</div>
                        <div class="ss-tabs" data-side="player" data-tsic-tab-bar></div>
                    </div>
                    <div id="ss-player-list" class="ss-grid"></div>
                    <div class="ss-capacity" data-side="player">
                        <div class="ss-capacity-line"><span class="ss-capacity-text">—</span></div>
                        <div class="ss-capacity-bar"><div class="ss-capacity-fill"></div></div>
                    </div>
                </div>
                <div class="tsic-split-col" data-tsic-tab-context="container">
                    <div class="ss-col-head">
                        <div class="tsic-eyebrow" id="ss-container-eyebrow">${opts.containerEyebrow || 'Container'}</div>
                        <div class="ss-tabs" data-side="container" data-tsic-tab-bar></div>
                    </div>
                    <div id="ss-container-list" class="ss-grid"></div>
                    <div class="ss-capacity" data-side="container">
                        <div class="ss-capacity-line"><span class="ss-capacity-text">—</span></div>
                        <div class="ss-capacity-bar"><div class="ss-capacity-fill"></div></div>
                    </div>
                </div>
            </div>
            <div id="ss-info" class="tsic-empty">Hover an item to see details</div>
            <div class="tsic-close-row">
                <button class="tsic-button" id="ss-close" type="button" data-tsic-initial-focus>Close (Esc)</button>
            </div>
        `;
    }

    function mount(opts) {
        opts = opts || {};
        const root = document.getElementById(opts.rootId || 'ss-root');
        if (!root) return null;

        injectGridStyleOnce();
        const panel = document.createElement('div');
        panel.className = 'tsic-panel tsic-panel--screen';
        panel.id = 'ss-panel';
        root.appendChild(panel);
        buildLayout(panel, opts);

        const state = {
            playerItems: [],
            containerItems: [],
            playerOwnerId: opts.playerOwnerId || 'Player',
            containerOwnerId: opts.containerInitialOwnerId || null,
            playerTab: 'All',
            containerTab: 'All',
            playerMaxSlots: opts.playerMaxSlots || 32,
            containerMaxSlots: opts.containerMaxSlots || 32,
            playerGrid: { w: 8, h: 6 },
            containerGrid: { w: 8, h: Math.ceil((opts.containerMaxSlots || 32) / 8) },
            playerMaxWeight: 0,
            playerWeight: 0,
            containerMaxWeight: 0,
            containerWeight: 0,
            // Selection is { cell, it } per side — cells are grid positions.
            playerSelected: null,
            containerSelected: null,
        };

        function transfer(it, fromOwnerId, toOwnerId, count) {
            if (!toOwnerId) return;
            const num = (typeof count === 'number') ? count : (it.Count || 1);
            tsic.publishMessage('UI.Cmd.Inventory.Transfer', {
                FromOwnerId: fromOwnerId,
                ToOwnerId: toOwnerId,
                FromSlot: it.SlotIndex,
                ToSlot: -1,
                Count: num
            });
            playTransferSound();
        }

        // Drag/drop between cells — same pane re-places, cross-pane moves the
        // whole stack into the release cell.
        function moveTo(src, toOwnerId, cellIndex) {
            if (!toOwnerId || src.gridSlot == null || src.gridSlot < 0) return;
            const fromOwnerId = src.ownerId || state.playerOwnerId;
            if (fromOwnerId === toOwnerId && src.gridSlot === cellIndex) return;
            tsic.publishMessage('UI.Cmd.Inventory.Move', {
                FromOwnerId: fromOwnerId,
                ToOwnerId: toOwnerId,
                FromSlot: src.gridSlot,
                ToSlot: cellIndex,
            });
            if (fromOwnerId !== toOwnerId) playTransferSound();
        }

        function openContextMenuFor(side, it, e) {
            if (!window.TSICContextMenu || !window.TSICInventory) return;
            const fromOwnerId = side === 'player' ? state.playerOwnerId : state.containerOwnerId;
            const toOwnerId   = side === 'player' ? state.containerOwnerId : state.playerOwnerId;
            const desc = describe(it);
            const entries = window.TSICInventory.buildItemContextMenu({
                it, desc,
                storageOpen: true,
                fromOwnerId, toOwnerId,
            });
            window.TSICContextMenu.open({ x: e.clientX, y: e.clientY, entries });
        }

        const tabDefs = TABS.map(t => ({ id: t.id, label: t.id }));
        const playerTabFilter = TSIC.TabFilter.create(
            panel.querySelector('.ss-tabs[data-side="player"]'),
            tabDefs,
            function (id) { state.playerTab = id; renderAll(); }
        );
        const containerTabFilter = TSIC.TabFilter.create(
            panel.querySelector('.ss-tabs[data-side="container"]'),
            tabDefs,
            function (id) { state.containerTab = id; renderAll(); }
        );
        function syncTabs() {
            playerTabFilter.setActive(state.playerTab);
            containerTabFilter.setActive(state.containerTab);
        }

        function renderCapacity(side) {
            const host = panel.querySelector(`.ss-capacity[data-side="${side}"]`);
            const text = host.querySelector('.ss-capacity-text');
            const fill = host.querySelector('.ss-capacity-fill');
            let used, max, weight, maxWeight;
            if (side === 'player') {
                used = state.playerItems.length;
                max  = state.playerMaxSlots;
                weight = state.playerWeight || totalWeight(state.playerItems);
                maxWeight = state.playerMaxWeight;
            } else {
                used = state.containerItems.length;
                max  = state.containerMaxSlots;
                weight = state.containerWeight || totalWeight(state.containerItems);
                maxWeight = state.containerMaxWeight;
            }
            const slotRatio   = max > 0 ? used / max : 0;
            const weightRatio = maxWeight > 0 ? weight / maxWeight : 0;
            const ratio = Math.max(slotRatio, weightRatio);
            const weightStr = maxWeight > 0
                ? ` · ${weight.toFixed(2)}/${maxWeight.toFixed(2)} kg`
                : (weight > 0 ? ` · ${weight.toFixed(2)} kg` : '');
            text.textContent = `${used}/${max} slots${weightStr}`;
            fill.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
            host.dataset.state = ratio >= 1.05 ? 'overburdened'
                               : ratio >= 1.0  ? 'full'
                               : ratio >= 0.75 ? 'warning'
                               : 'normal';
        }

        function renderInfo(it) {
            const host = panel.querySelector('#ss-info');
            host.innerHTML = '';
            host.classList.remove('tsic-empty');
            const desc = describe(it);
            if (!desc) {
                host.classList.add('tsic-empty');
                host.textContent = 'Hover an item to see details';
                return;
            }
            const head = document.createElement('div');
            head.style.cssText = 'display:flex;align-items:center;gap:10px;';
            const icon = document.createElement('div');
            icon.style.cssText = 'width:42px;height:42px;background:rgba(241,229,207,0.55);border:1px solid var(--tsic-border);display:flex;align-items:center;justify-content:center;flex:0 0 auto;';
            const img = TSIC.iconImg(TSIC.itemIconUrl(desc.ItemId));
            img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
            icon.appendChild(img);
            head.appendChild(icon);
            const meta = document.createElement('div');
            meta.style.cssText = 'flex:1 1 auto;min-width:0;';
            const name = document.createElement('div');
            name.style.cssText = 'font-weight:700;font-size:13px;';
            name.textContent = desc.Name || it.ItemId;
            const sub = document.createElement('div');
            sub.style.cssText = 'font-size:11px;color:rgba(37,33,25,0.75);';
            const parts = [];
            if (desc.Category) parts.push(desc.Category);
            if (typeof desc.Weight === 'number') parts.push(`${desc.Weight.toFixed(2)} kg`);
            if (it.Count > 1) parts.push(`stack ×${it.Count}`);
            sub.textContent = parts.join(' · ');
            meta.appendChild(name);
            meta.appendChild(sub);
            if (desc.Description) {
                const body = document.createElement('div');
                body.style.cssText = 'font-size:11px;color:rgba(37,33,25,0.85);margin-top:2px;';
                body.textContent = desc.Description;
                meta.appendChild(body);
            }
            head.appendChild(meta);
            host.appendChild(head);
        }

        // Selection-only update: writes the selected/deselected marker to both
        // grids without re-rendering either side. Used by click/RMB; the full
        // rebuild only fires when item data, tab filter, or weight changes.
        function syncSelectionClasses() {
            const playerHost    = panel.querySelector('#ss-player-list');
            const containerHost = panel.querySelector('#ss-container-list');
            const updater = window.TSICInventory && window.TSICInventory.updateSelectedSlot;
            if (!updater) { renderAll(); return; }
            updater(playerHost,    state.playerSelected ? state.playerSelected.cell : null);
            updater(containerHost, state.containerSelected ? state.containerSelected.cell : null);
        }

        function paneOpts(side) {
            const isPlayer = side === 'player';
            const ownerId = isPlayer ? state.playerOwnerId : state.containerOwnerId;
            const grid    = isPlayer ? state.playerGrid : state.containerGrid;
            const other   = isPlayer ? state.containerOwnerId : state.playerOwnerId;
            return {
                catalog: (window.tsic && window.tsic.itemCatalog) || {},
                gridWidth: grid.w,
                gridHeight: grid.h,
                ownerId: ownerId || (isPlayer ? 'Player' : ''),
                selectedGridSlot: (isPlayer ? state.playerSelected : state.containerSelected)?.cell,
                filterFn: filterFnFor(isPlayer ? state.playerTab : state.containerTab),
                onHover: (it) => { if (it) renderInfo(it); },
                onClick: (it, cellIndex) => {
                    if (isPlayer) {
                        state.playerSelected = it ? { cell: cellIndex, it } : null;
                        state.containerSelected = null;
                    } else {
                        state.containerSelected = it ? { cell: cellIndex, it } : null;
                        state.playerSelected = null;
                    }
                    syncSelectionClasses();
                },
                onDblClick: (it) => {
                    if (!it) return;
                    transfer(it, ownerId, other, it.Count || 1);
                },
                onRMB: (it, cellIndex, e) => {
                    if (!it) return;
                    if (isPlayer) {
                        state.playerSelected = { cell: cellIndex, it };
                        state.containerSelected = null;
                    } else {
                        state.containerSelected = { cell: cellIndex, it };
                        state.playerSelected = null;
                    }
                    syncSelectionClasses();
                    openContextMenuFor(side, it, e);
                },
                onDrop: (src, cellIndex) => moveTo(src, ownerId, cellIndex),
            };
        }

        function renderAll() {
            syncTabs();
            renderCapacity('player');
            renderCapacity('container');
            const playerHost    = panel.querySelector('#ss-player-list');
            const containerHost = panel.querySelector('#ss-container-list');
            window.TSICInventory.renderGrid(playerHost, state.playerItems, paneOpts('player'));
            window.TSICInventory.renderGrid(containerHost, state.containerItems, paneOpts('container'));
        }

        function takeAll() {
            if (!state.containerOwnerId) return;
            for (const it of state.containerItems) {
                tsic.publishMessage('UI.Cmd.Inventory.Transfer', {
                    FromOwnerId: state.containerOwnerId,
                    ToOwnerId:   state.playerOwnerId,
                    FromSlot:    it.SlotIndex,
                    ToSlot:      -1,
                    Count:       it.Count || 1,
                });
            }
            if (state.containerItems.length > 0) playTransferSound();
        }

        function applyInventoryMessage(p) {
            if (!p || !p.OwnerId) return;
            const isContainer = opts.containerOwnerIdMatch
                ? opts.containerOwnerIdMatch(p.OwnerId)
                : false;
            if (isContainer) {
                state.containerOwnerId  = p.OwnerId;
                state.containerItems    = p.Items || [];
                state.containerMaxSlots = p.MaxSlots || state.containerMaxSlots;
                state.containerWeight   = typeof p.CurrentWeight === 'number' ? p.CurrentWeight : 0;
                state.containerMaxWeight = typeof p.MaxWeight === 'number' ? p.MaxWeight : 0;
                if (p.GridWidth > 0 && p.GridHeight > 0) {
                    state.containerGrid = { w: p.GridWidth, h: p.GridHeight };
                }
            } else if (p.OwnerId === state.playerOwnerId) {
                state.playerItems    = p.Items || [];
                state.playerMaxSlots = p.MaxSlots || state.playerMaxSlots;
                state.playerWeight   = typeof p.CurrentWeight === 'number' ? p.CurrentWeight : 0;
                state.playerMaxWeight = typeof p.MaxWeight === 'number' ? p.MaxWeight : 0;
                if (p.GridWidth > 0 && p.GridHeight > 0) {
                    state.playerGrid = { w: p.GridWidth, h: p.GridHeight };
                }
            } else {
                return;
            }
            renderAll();
        }

        tsic.on('tsic.msg.UI.Inventory.Updated', applyInventoryMessage);
        window.addEventListener('tsic-item-catalog', renderAll);

        panel.querySelector('#ss-close').addEventListener('click', () => {
            tsic.publishMessage('UI.Cmd.Pause.Resume', {});
        });
        // The currently-selected item + its transfer direction (player<->container).
        function selectedTransfer() {
            if (state.playerSelected && state.playerSelected.it) {
                return { it: state.playerSelected.it, from: state.playerOwnerId, to: state.containerOwnerId };
            }
            if (state.containerSelected && state.containerSelected.it) {
                return { it: state.containerSelected.it, from: state.containerOwnerId, to: state.playerOwnerId };
            }
            return null;
        }

        panel.querySelector('#ss-take-all').addEventListener('click', takeAll);
        // BH_TakeAll — same effect as the button.
        tsic.on('tsic.msg.UI.Behavior.TakeAll', (e) => {
            if (e && e.Phase === 'Started') takeAll();
        });
        // BH_TransferAmount — open the quantity slider for the selected item, then transfer.
        tsic.on('tsic.msg.UI.Behavior.TransferAmount', (e) => {
            if (!e || e.Phase !== 'Started') return;
            const sel = selectedTransfer();
            if (!sel || !sel.to) return;
            const max = sel.it.Count || 1;
            if (max > 1 && window.TSICInventory && window.TSICInventory.openQuantityModal) {
                window.TSICInventory.openQuantityModal(max,
                    (count) => transfer(sel.it, sel.from, sel.to, count),
                    { title: 'Transfer amount', confirmLabel: 'Transfer' });
            } else {
                transfer(sel.it, sel.from, sel.to, 1);
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') panel.querySelector('#ss-close').click();
        });

        renderAll();
        return { state, refresh: renderAll };
    }

    window.TSICStorageShell = { mount };
})();
