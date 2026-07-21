// Shared storage view (grid design §10.2): THE INVENTORY SCREEN PLUS A
// CONTAINER COLUMN. The player column (tabs + grid + weight bar) and the
// info rail keep the inventory screen's layout; the container pane (header +
// slot-count + grid) is appended to the right. Containers show no weight
// (§3.4 — slots are their only limit). Both grids render with the same
// component and every interaction rides the shared cursor engine
// (shared/inventory.js): pickup, RMB half/place-one, shift-click quick-move
// across panes, double-click collect across both panes, Q / Ctrl+Q drops.
//
// Used by /screens/storage.html and /screens/universal-storage.html:
//   TSICStorageShell.mount({
//     title: 'Storage',
//     containerEyebrow: 'Container',
//     containerOwnerIdMatch: id => id.indexOf('Storage:') === 0,
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
    // Tabs dim non-matching items in place — a filter never changes slot
    // geometry (rule 48).
    function filterFnFor(tabId) {
        const tab = TABS.find(t => t.id === tabId);
        if (!tab || !tab.filter) return null;
        return (it) => tab.filter(categoryFor(it.ItemId));
    }

    const STYLE = [
        '#ss-panel .ss-band { display:flex; align-items:baseline; gap:12px; border-bottom:3px solid rgba(10,10,10,0.85); margin-bottom:10px; padding-bottom:5px; }',
        '#ss-panel .ss-band h2 { margin:0; }',
        '#ss-panel .ss-band .spacer { flex:1; }',
        '#ss-panel .ss-band .slots-text { font-size:14px; letter-spacing:0.08em; color:rgba(37,33,25,0.65); }',
        '#ss-panel .ss-sort-mini { font-size:11px; padding:1px 8px; }',
        '#ss-panel .ss-cols { display:grid; gap:10px; grid-template-columns:auto 236px auto; align-items:start; }',
        '#ss-panel .ss-tabs { display:flex; gap:0; margin-bottom:8px; }',
        '#ss-panel .ss-grid {',
        '  display:grid; grid-template-columns: repeat(var(--grid-cols, 8), 46px);',
        '  grid-auto-rows: 46px; gap:4px; width:max-content;',
        '  max-height: calc(6 * 50px); overflow-y:auto;',
        '}',
        '#ss-panel .tsic-slot {',
        '  width:46px; height:46px; position:relative; cursor:pointer; padding:3px;',
        '  background: rgba(255,253,243,0.96); border:2px solid rgba(10,10,10,0.85);',
        '  display:flex; align-items:center; justify-content:center;',
        '  transition: background-color 90ms ease, opacity 160ms ease, filter 160ms ease, transform 90ms ease, box-shadow 90ms ease;',
        '}',
        '#ss-panel .tsic-slot.is-empty { background: rgba(237,228,203,0.85); border-color: rgba(10,10,10,0.45); }',
        '#ss-panel .tsic-slot:hover:not(.is-locked),',
        '#ss-panel .tsic-slot[data-tsic-focused] { border-color: rgba(10,10,10,1); background:#fffdf3; }',
        '#ss-panel .tsic-slot.is-held-source img { opacity:0.35; }',
        '#ss-panel .tsic-slot.is-drop-target { outline:2px solid var(--buff-green, #1e8f3e); outline-offset:-2px; }',
        '#ss-panel .tsic-slot.is-filtered { opacity:0.2; filter:grayscale(0.8); }',
        '#ss-panel .tsic-slot.is-locked { background: rgba(227,216,184,0.7); border-style:dashed; border-color: rgba(10,10,10,0.35); cursor:default; opacity:0.75; }',
        '#ss-panel .tsic-slot .count { position:absolute; bottom:1px; right:2px; padding:1px 3px; line-height:1; font-size:10px; font-weight:700; color:#1a1612; background:var(--mag-yellow, #ffcc00); border:1px solid rgba(10,10,10,0.85); pointer-events:none; }',
        '#ss-panel .tsic-slot .equip-badge { position:absolute; top:1px; left:2px; padding:1px 3px; line-height:1; font-size:9px; font-weight:700; color:#fff; background:var(--mag-red, #e60000); border:1px solid rgba(10,10,10,0.85); pointer-events:none; }',
        '#ss-panel .tsic-slot .hotbar-badge { position:absolute; top:1px; right:2px; padding:1px 3px; line-height:1; font-size:9px; font-weight:700; color:var(--mag-yellow, #ffcc00); background:rgba(10,10,10,0.9); border:1px solid rgba(10,10,10,0.85); pointer-events:none; }',
        '#ss-panel .ss-panehdr { display:flex; align-items:baseline; gap:8px; border-bottom:2px solid rgba(10,10,10,0.85); margin-bottom:6px; padding-bottom:3px; }',
        '#ss-panel .ss-panehdr h4 { margin:0; font-size:16px; letter-spacing:0.06em; text-transform:uppercase; }',
        '#ss-panel .ss-panehdr .cnt { font-size:12px; color:rgba(108,99,87,0.95); }',
        '#ss-panel .ss-panehdr.on h4::before { content:">> "; color:var(--mag-red, #e60000); font-weight:900; }',
        '#ss-panel .ss-meter { margin-top:8px; min-width:200px; }',
        '#ss-panel .ss-meter .lab { display:flex; justify-content:space-between; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(37,33,25,0.8); }',
        '#ss-panel .ss-meter .track { height:14px; border:2px solid rgba(10,10,10,0.85); background:rgba(227,216,184,0.9); position:relative; overflow:hidden; }',
        '#ss-panel .ss-meter .fill { height:100%; background:var(--mag-red, #e60000); transition:width 120ms linear; }',
        '#ss-panel .ss-info { padding:9px 11px; background:#fffdf3; border:2px solid rgba(10,10,10,0.85); min-height:120px; overflow:auto; font-size:13px; }',
        '#ss-panel .ss-info .info-eyebrow { font-size:10px; letter-spacing:0.18em; color:var(--mag-red, #e60000); text-transform:uppercase; }',
        '#ss-panel .ss-info .statline { display:flex; justify-content:space-between; border-top:1px dashed rgba(10,10,10,0.3); padding:2px 0; }',
        '#ss-panel .ss-hints { display:flex; gap:14px; justify-content:flex-start; margin-top:10px; border-top:2px dashed rgba(10,10,10,0.3); padding-top:8px; flex-wrap:wrap; }',
        '#ss-panel .ss-hints .hint { display:flex; align-items:center; gap:5px; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(74,66,57,0.9); }',
        '#ss-panel .ss-hints .kbd { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:20px; padding:0 4px; background:#fffdf3; border:2px solid rgba(10,10,10,0.85); box-shadow:2px 2px 0 rgba(10,10,10,0.85); font-size:9px; font-weight:700; color:#1a1612; }',
    ].join('\n');

    function injectStyleOnce() {
        if (document.getElementById('ss-grid-style')) return;
        const s = document.createElement('style');
        s.id = 'ss-grid-style';
        s.textContent = STYLE;
        document.head.appendChild(s);
    }
    function playTransferSound() {
        try { tsic.playSound('Inventory.Transfer', 0.33); } catch {}
    }

    function describe(it) {
        const cat = (window.tsic && window.tsic.itemCatalog) || {};
        return cat[it && it.ItemId] || null;
    }

    function buildLayout(host, opts) {
        host.innerHTML = `
            <div class="ss-band">
                <h2 class="tsic-title">${opts.title}</h2>
                <span class="spacer"></span>
                <span class="slots-text" id="ss-player-slots">—</span>
                <button class="tsic-button cancel" id="ss-sort-player" type="button">Sort</button>
                <button class="tsic-button cancel" id="ss-take-all" type="button">Take All</button>
            </div>
            <div class="ss-cols">
                <div data-tsic-tab-context="player">
                    <div class="ss-tabs" data-side="player" data-tsic-tab-bar></div>
                    <div id="ss-player-list" class="ss-grid"></div>
                    <div class="ss-meter">
                        <div class="lab"><span>Weight</span><span class="val" id="ss-weight-text">—</span></div>
                        <div class="track"><div class="fill" id="ss-weight-fill"></div></div>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    <div id="ss-info" class="ss-info tsic-empty">Hover an item to see details</div>
                    <div class="tsic-close-row" style="margin:0;">
                        <button class="tsic-button" id="ss-close" type="button" data-tsic-initial-focus>Close (Esc)</button>
                    </div>
                </div>
                <div data-tsic-tab-context="container">
                    <div class="ss-panehdr" id="ss-container-hdr">
                        <h4 id="ss-container-eyebrow">${opts.containerEyebrow || 'Container'}</h4>
                        <button class="tsic-button cancel ss-sort-mini" id="ss-sort-container" type="button">Sort</button>
                        <span class="cnt" id="ss-container-slots">—</span>
                    </div>
                    <div id="ss-container-list" class="ss-grid"></div>
                </div>
            </div>
            <div class="ss-hints" id="ss-hints"></div>
        `;
    }

    function hintChip(parent, keys, label) {
        const hint = document.createElement('span');
        hint.className = 'hint';
        keys.forEach((k, i) => {
            if (i > 0) hint.appendChild(document.createTextNode('+'));
            const kbd = document.createElement('span');
            kbd.className = 'kbd';
            kbd.textContent = k;
            hint.appendChild(kbd);
        });
        hint.appendChild(document.createTextNode(' ' + label));
        parent.appendChild(hint);
    }

    function mount(opts) {
        opts = opts || {};
        const root = document.getElementById(opts.rootId || 'ss-root');
        if (!root) return null;

        injectStyleOnce();
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
            playerMaxSlots: opts.playerMaxSlots || 32,
            containerMaxSlots: opts.containerMaxSlots || 32,
            playerGridW: 8,
            containerGridW: 8,
            playerWeight: 0,
            playerMaxWeight: 0,
            // Active pane for the >> header marker (last pointer interaction).
            activePane: 'player',
            hovered: null,  // { side, it }
        };

        const tabDefs = TABS.map(t => ({ id: t.id, label: t.id }));
        const playerTabFilter = TSIC.TabFilter.create(
            panel.querySelector('.ss-tabs[data-side="player"]'),
            tabDefs,
            function (id) { state.playerTab = id; renderAll(); }
        );

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
            window.TSICInventory.renderInfoPanel(host, Object.assign({ ItemId: it.ItemId }, desc), it);
        }

        function renderMeterAndCounts() {
            const cur = state.playerWeight || 0;
            const max = state.playerMaxWeight || 0;
            panel.querySelector('#ss-weight-text').textContent = max > 0
                ? `${cur.toFixed(1)}/${max.toFixed(0)} kg` : `${cur.toFixed(1)} kg`;
            const ratio = max > 0 ? Math.min(1, cur / max) : 0;
            panel.querySelector('#ss-weight-fill').style.width = `${(ratio * 100).toFixed(1)}%`;
            panel.querySelector('#ss-player-slots').textContent =
                `${state.playerItems.length}/${state.playerMaxSlots} SLOTS`;
            panel.querySelector('#ss-container-slots').textContent =
                `${state.containerItems.length}/${state.containerMaxSlots}`;
            panel.querySelector('#ss-container-hdr').classList.toggle('on', state.activePane === 'container');
        }

        function setActivePane(side) {
            if (state.activePane === side) return;
            state.activePane = side;
            renderMeterAndCounts();
        }

        function paneOpts(side) {
            const isPlayer = side === 'player';
            const ownerId = isPlayer ? state.playerOwnerId : state.containerOwnerId;
            const otherId = isPlayer ? state.containerOwnerId : state.playerOwnerId;
            return {
                catalog: (window.tsic && window.tsic.itemCatalog) || {},
                gridWidth: isPlayer ? state.playerGridW : state.containerGridW,
                slotCount: isPlayer ? state.playerMaxSlots : state.containerMaxSlots,
                ownerId: ownerId || (isPlayer ? 'Player' : ''),
                focusGroup: isPlayer ? 'ss-player' : 'ss-container',
                panelEl: panel,
                filterFn: isPlayer ? filterFnFor(state.playerTab) : null,
                onHover: (it) => {
                    state.hovered = it ? { side, it } : null;
                    setActivePane(side);
                    if (it) renderInfo(it);
                },
                onLeave: () => { state.hovered = null; },
                // Shift-click quick-move: into the OTHER pane, auto-placed
                // (stack-fill then empty cells), partial allowed (§7.4).
                onQuickMove: (it) => {
                    if (!otherId || it.GridSlot == null || it.GridSlot < 0) return;
                    tsic.publishMessage('UI.Cmd.Inventory.QuickMove', {
                        FromOwnerId: ownerId, ToOwnerId: otherId,
                        ItemId: it.InstanceId, FromSlot: it.GridSlot,
                    });
                    playTransferSound();
                },
                otherOwnerId: () => otherId || '',
            };
        }

        function renderAll() {
            playerTabFilter.setActive(state.playerTab);
            renderMeterAndCounts();
            window.TSICInventory.renderGrid(panel.querySelector('#ss-player-list'), state.playerItems, paneOpts('player'));
            window.TSICInventory.renderGrid(panel.querySelector('#ss-container-list'), state.containerItems, paneOpts('container'));
            renderHints();
        }

        function renderHints() {
            const host = panel.querySelector('#ss-hints');
            host.innerHTML = '';
            const held = window.TSICInventory.getHeld();
            if (held) {
                hintChip(host, ['LMB'], 'Place');
                hintChip(host, ['RMB'], 'Place one');
                hintChip(host, ['ESC'], 'Return');
            } else {
                hintChip(host, ['LMB'], 'Take');
                hintChip(host, ['RMB'], 'Split');
                hintChip(host, ['SHIFT', 'LMB'], 'Quick-move');
                hintChip(host, ['LMB', 'LMB'], 'Collect');
                hintChip(host, ['G'], 'Drop 1');
            }
        }

        // Take All: quick-move every container stack into the player grid —
        // auto-placed with partials allowed; what doesn't fit stays put.
        function takeAll() {
            if (!state.containerOwnerId) return;
            for (const it of state.containerItems) {
                if (it.GridSlot == null || it.GridSlot < 0) continue;
                tsic.publishMessage('UI.Cmd.Inventory.QuickMove', {
                    FromOwnerId: state.containerOwnerId,
                    ToOwnerId: state.playerOwnerId,
                    ItemId: it.InstanceId, FromSlot: it.GridSlot,
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
                state.containerOwnerId = p.OwnerId;
                state.containerItems = p.Items || [];
                state.containerMaxSlots = p.MaxSlots || state.containerMaxSlots;
                if (p.GridWidth > 0) state.containerGridW = p.GridWidth;
            } else if (p.OwnerId === state.playerOwnerId) {
                state.playerItems = p.Items || [];
                state.playerMaxSlots = p.MaxSlots || state.playerMaxSlots;
                state.playerWeight = typeof p.CurrentWeight === 'number' ? p.CurrentWeight : 0;
                state.playerMaxWeight = typeof p.MaxWeight === 'number' ? p.MaxWeight : 0;
                if (p.GridWidth > 0) state.playerGridW = p.GridWidth;
            } else {
                return;
            }
            // Rule 40: keep the held ghost only while its source still matches.
            if (window.TSICInventory) window.TSICInventory.reconcileHeld(p.OwnerId, p.Items);
            renderAll();
        }

        tsic.on('tsic.msg.UI.Inventory.Updated', applyInventoryMessage);
        window.addEventListener('tsic-item-catalog', renderAll);

        panel.querySelector('#ss-close').addEventListener('click', () => {
            window.TSICInventory.cancelHeld();
            tsic.publishMessage('UI.Cmd.Pause.Resume', {});
        });
        panel.querySelector('#ss-take-all').addEventListener('click', takeAll);
        // §5 P2 SortInventory — per pane.
        panel.querySelector('#ss-sort-player').addEventListener('click', () => {
            window.TSICInventory.cancelHeld();
            tsic.publishMessage('UI.Cmd.Inventory.Sort', { OwnerId: 'Player' });
            tsic.playSound('Inventory.Transfer');
        });
        panel.querySelector('#ss-sort-container').addEventListener('click', () => {
            if (!state.containerOwnerId) return;
            window.TSICInventory.cancelHeld();
            tsic.publishMessage('UI.Cmd.Inventory.Sort', { OwnerId: state.containerOwnerId });
            tsic.playSound('Inventory.Transfer');
        });
        // BH_TakeAll — same effect as the button.
        tsic.on('tsic.msg.UI.Behavior.TakeAll', (e) => {
            if (e && e.Phase === 'Started') takeAll();
        });
        // Gamepad grid actions (§8.2) on the focused cell.
        tsic.on('tsic.msg.UI.Behavior.InvSplit', (e) => {
            if (e && e.Phase === 'Started') { window.TSICInventory.behaviorOnFocused('split'); renderHints(); }
        });
        tsic.on('tsic.msg.UI.Behavior.InvQuickMove', (e) => {
            if (e && e.Phase === 'Started') window.TSICInventory.behaviorOnFocused('quickmove');
        });
        tsic.on('tsic.msg.UI.Behavior.InvDrop', (e) => {
            if (e && e.Phase === 'Started') window.TSICInventory.behaviorOnFocused('drop');
        });

        // Held commits and outside-drops ride the engine's global gesture
        // tracker; the hint row follows the held state.
        window.TSICInventory.onHeldChanged(() => renderHints());
        document.addEventListener('contextmenu', (e) => {
            if (window.TSICInventory.getHeld()) e.preventDefault();
        });

        // Pane switching (§8.1): Tab and PageUp/PageDown (gamepad LT/RT via
        // Prev/NextPage) jump focus to the other pane, landing on the cell it
        // last had focused (per-pane focus memory, P2) or its first cell.
        const paneFocusMemory = { player: null, container: null };
        function switchPane() {
            const focused = panel.querySelector('.tsic-slot[data-tsic-focused]');
            const inContainer = !!(focused && focused.closest('#ss-container-list'));
            if (focused && focused.dataset && focused.dataset.grid != null) {
                paneFocusMemory[inContainer ? 'container' : 'player'] = focused.dataset.grid;
            }
            const targetSide = inContainer ? 'player' : 'container';
            const targetHost = panel.querySelector(inContainer ? '#ss-player-list' : '#ss-container-list');
            let cell = null;
            if (targetHost && paneFocusMemory[targetSide] != null) {
                cell = targetHost.querySelector(
                    '.tsic-slot[data-tsic-focusable][data-grid="' + paneFocusMemory[targetSide] + '"]');
            }
            if (!cell) cell = targetHost && targetHost.querySelector('.tsic-slot[data-tsic-focusable]');
            if (cell && window.tsic.focus && window.tsic.focus.focus) {
                window.tsic.focus.focus(cell);
            } else if (cell && cell.focus) {
                cell.focus();
            }
            setActivePane(inContainer ? 'player' : 'container');
        }
        tsic.on('tsic.msg.UI.Behavior.NextPage', (e) => { if (e && e.Phase === 'Started') switchPane(); });
        tsic.on('tsic.msg.UI.Behavior.PrevPage', (e) => { if (e && e.Phase === 'Started') switchPane(); });

        // Keyboard (hover-based, §7.3).
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                switchPane();
                return;
            }
            if (e.key === 'Escape') {
                if (window.TSICInventory.getHeld()) {
                    window.TSICInventory.cancelHeld();
                    renderHints();
                    return;
                }
                panel.querySelector('#ss-close').click();
                return;
            }
            const hovered = state.hovered;
            if ((e.key === 'g' || e.key === 'G') && hovered && hovered.it && !window.TSICInventory.getHeld()) {
                const ownerId = hovered.side === 'player' ? state.playerOwnerId : state.containerOwnerId;
                window.TSICInventory.dropHovered({ ownerId }, hovered.it, e.ctrlKey);
            }
        });

        renderAll();
        return { state, refresh: renderAll };
    }

    window.TSICStorageShell = { mount };
})();
