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
        { id: 'All',   filter: null },
        { id: 'Tools', filter: c => c === 'Equipment' },
        { id: 'Cons.', filter: c => c === 'Consumable' },
        { id: 'Mats',  filter: c => c === 'CraftingMaterial' },
        { id: 'Other', filter: c => !['Equipment','Consumable','CraftingMaterial'].includes(c) },
    ];

    function categoryFor(itemId) {
        const cat = (window.tsic && window.tsic.itemCatalog) || {};
        const desc = cat[itemId];
        return desc ? desc.Category : null;
    }
    function applyFilter(items, tabId) {
        const tab = TABS.find(t => t.id === tabId);
        if (!tab || !tab.filter) return items || [];
        return (items || []).filter(it => tab.filter(categoryFor(it.ItemId)));
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
                    <div id="ss-player-list" class="tsic-list-pane"></div>
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
                    <div id="ss-container-list" class="tsic-list-pane"></div>
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
            playerMaxWeight: 0,
            playerWeight: 0,
            containerMaxWeight: 0,
            containerWeight: 0,
            playerSelectedSlot: -1,
            containerSelectedSlot: -1,
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
        // lists without re-rendering either side. Used by click/RMB; the full
        // rebuild only fires when item data, tab filter, or weight changes.
        function syncSelectionClasses() {
            const playerHost    = panel.querySelector('#ss-player-list');
            const containerHost = panel.querySelector('#ss-container-list');
            const updater = window.TSICInventory && window.TSICInventory.updateSelectedSlot;
            if (!updater) { renderAll(); return; }
            updater(playerHost,    state.playerSelectedSlot);
            updater(containerHost, state.containerSelectedSlot);
        }

        function renderAll() {
            syncTabs();
            renderCapacity('player');
            renderCapacity('container');
            const cat = (window.tsic && window.tsic.itemCatalog) || {};
            const playerHost    = panel.querySelector('#ss-player-list');
            const containerHost = panel.querySelector('#ss-container-list');

            window.TSICInventory.renderList(playerHost, applyFilter(state.playerItems, state.playerTab), {
                catalog: cat,
                emptyLabel: 'You have nothing to deposit.',
                selectedIdx: state.playerSelectedSlot,
                onHover: (it) => renderInfo(it),
                onClick: (it) => {
                    if (!it) return;
                    state.playerSelectedSlot = it.SlotIndex;
                    state.containerSelectedSlot = -1;
                    syncSelectionClasses();
                },
                onDblClick: (it) => {
                    if (!it) return;
                    transfer(it, state.playerOwnerId, state.containerOwnerId, it.Count || 1);
                },
                onRMB: (it, e) => {
                    if (!it) return;
                    state.playerSelectedSlot = it.SlotIndex;
                    state.containerSelectedSlot = -1;
                    syncSelectionClasses();
                    openContextMenuFor('player', it, e);
                },
            });
            window.TSICInventory.renderList(containerHost, applyFilter(state.containerItems, state.containerTab), {
                catalog: cat,
                emptyLabel: opts.emptyContainer || 'Container is empty.',
                selectedIdx: state.containerSelectedSlot,
                onHover: (it) => renderInfo(it),
                onClick: (it) => {
                    if (!it) return;
                    state.containerSelectedSlot = it.SlotIndex;
                    state.playerSelectedSlot = -1;
                    syncSelectionClasses();
                },
                onDblClick: (it) => {
                    if (!it) return;
                    transfer(it, state.containerOwnerId, state.playerOwnerId, it.Count || 1);
                },
                onRMB: (it, e) => {
                    if (!it) return;
                    state.containerSelectedSlot = it.SlotIndex;
                    state.playerSelectedSlot = -1;
                    syncSelectionClasses();
                    openContextMenuFor('container', it, e);
                },
            });
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
            } else if (p.OwnerId === state.playerOwnerId) {
                state.playerItems    = p.Items || [];
                state.playerMaxSlots = p.MaxSlots || state.playerMaxSlots;
                state.playerWeight   = typeof p.CurrentWeight === 'number' ? p.CurrentWeight : 0;
                state.playerMaxWeight = typeof p.MaxWeight === 'number' ? p.MaxWeight : 0;
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
            if (state.playerSelectedSlot >= 0) {
                const it = state.playerItems.find(i => i.SlotIndex === state.playerSelectedSlot);
                return it ? { it, from: state.playerOwnerId, to: state.containerOwnerId } : null;
            }
            if (state.containerSelectedSlot >= 0) {
                const it = state.containerItems.find(i => i.SlotIndex === state.containerSelectedSlot);
                return it ? { it, from: state.containerOwnerId, to: state.playerOwnerId } : null;
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
