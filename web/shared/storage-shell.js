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
        // Two grids side by side + the middle rail, so slots run smaller than
        // the inventory screen's — at the full --tsic-slot the pair overflows
        // even a wide panel. Panel hugs its content (like #inv-panel) instead
        // of the inherited 60vw, which clipped the container grid on narrower
        // displays.
        // max-height min(92vh, 100%): 92vh is the look, 100% is the guarantee — the overlay is
        // shorter than the viewport while the HUD hotbar acts as the player pane's first row,
        // and a panel capped only against vh would run off the top of it instead of scrolling.
        '#ss-panel { --tsic-slot:54px; --tsic-slot-gap:5px; width:auto; height:auto; max-width:94vw; max-height:min(92vh, 100%); overflow:auto; }',
        '#ss-panel .ss-band { display:flex; align-items:baseline; gap:12px; border-bottom:3px solid rgba(10,10,10,0.85); margin-bottom:10px; padding-bottom:5px; }',
        '#ss-panel .ss-band h2 { margin:0; }',
        '#ss-panel .ss-band .spacer { flex:1; }',
        '#ss-panel .ss-band .slots-text { font-size:14px; letter-spacing:0.08em; color:rgba(37,33,25,0.65); }',
        '#ss-panel .ss-sort-mini { font-size:11px; padding:1px 8px; }',
        '#ss-panel .ss-cols { display:grid; gap:10px; grid-template-columns:auto 236px auto; align-items:start; }',
        '#ss-panel .ss-tabs { display:flex; gap:0; margin-bottom:8px; }',
        '#ss-panel .ss-grid {',
        '  display:grid; grid-template-columns: repeat(var(--grid-cols, 8), var(--tsic-slot));',
        '  grid-auto-rows: var(--tsic-slot); gap:var(--tsic-slot-gap); width:max-content;',
        '  max-height: calc(var(--tsic-slot-rows) * (var(--tsic-slot) + var(--tsic-slot-gap))); overflow-y:auto;',
        '}',
        '#ss-panel .tsic-slot {',
        '  width:var(--tsic-slot); height:var(--tsic-slot); position:relative; cursor:pointer; padding:3px;',
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
        // Hotbar cells drawn IN the player pane — only on a host with no HUD bar to stand in
        // for them (the standalone /screens/storage.html dev page). Matches the inventory
        // screen so the same cells read the same way in both places.
        '#ss-panel .tsic-slot.is-hotbar { border-bottom-width:4px; }',
        '#ss-panel .tsic-slot.is-hotbar .hotbar-key { position:absolute; top:1px; right:2px; padding:1px 3px; line-height:1; font-size:9px; font-weight:700; color:var(--mag-yellow, #ffcc00); background:rgba(10,10,10,0.9); border:1px solid rgba(10,10,10,0.85); pointer-events:none; }',
        '#ss-panel .tsic-slot.is-held { border-color:var(--mag-red, #e60000); box-shadow:0 0 0 2px var(--mag-red, #e60000) inset; }',
        '#ss-panel .tsic-slot.is-held .hotbar-key { color:#fff; background:var(--mag-red, #e60000); }',
        '#ss-panel .ss-panehdr { display:flex; align-items:baseline; gap:8px; border-bottom:2px solid rgba(10,10,10,0.85); margin-bottom:6px; padding-bottom:3px; }',
        '#ss-panel .ss-panehdr h4 { margin:0; font-size:16px; letter-spacing:0.06em; text-transform:uppercase; }',
        // Reads as the pane heading until focused, then as a text field.
        '#ss-panel .ss-name-input {',
        '  font:inherit; font-size:16px; letter-spacing:0.06em; text-transform:uppercase; color:inherit;',
        '  background:transparent; border:2px solid transparent; padding:0 4px; width:150px; min-width:0;',
        '}',
        '#ss-panel .ss-name-input::placeholder { color:inherit; opacity:0.75; }',
        '#ss-panel .ss-name-input:hover { border-color:rgba(10,10,10,0.35); }',
        '#ss-panel .ss-name-input:focus { outline:none; border-color:rgba(10,10,10,0.85); background:#fffdf3; text-transform:none; }',
        '#ss-panel .ss-panehdr .cnt { font-size:12px; color:rgba(108,99,87,0.95); }',
        '#ss-panel .ss-auto-sort { display:inline-flex; align-items:center; gap:3px; font-size:10px;',
        '  letter-spacing:0.08em; text-transform:uppercase; color:rgba(74,66,57,0.9); cursor:pointer; }',
        '#ss-panel .ss-auto-sort input { accent-color:var(--mag-red,#e60000); margin:0; }',
        '#ss-panel .ss-panehdr.on h4::before { content:">> "; color:var(--mag-red, #e60000); font-weight:900; }',
        '#ss-panel .ss-meter { margin-top:8px; min-width:200px; }',
        '#ss-panel .ss-meter .lab { display:flex; justify-content:space-between; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(37,33,25,0.8); }',
        '#ss-panel .ss-meter .track { height:14px; border:2px solid rgba(10,10,10,0.85); background:rgba(227,216,184,0.9); position:relative; overflow:hidden; }',
        '#ss-panel .ss-meter .fill { height:100%; background:var(--mag-red, #e60000); transition:width 120ms linear; }',
        // Container capacity turns amber then red as the HARD weight cap closes in,
        // so "why won\'t it take this?" is answered before the refusal happens.
        '#ss-panel .ss-meter[data-state="warning"] .fill { background:var(--mag-yellow, #ffcc00); }',
        '#ss-panel .ss-meter[data-state="full"] .fill { background:#c11818; }',
        '#ss-panel .ss-meter .note { font-size:10px; letter-spacing:0.06em; color:#c11818; min-height:12px; }',
        '#ss-panel #ss-search { font:inherit; font-size:12px; width:120px; padding:2px 7px; background:rgba(255,253,243,0.96); border:2px solid rgba(10,10,10,0.85); color:inherit; }',
        '#ss-panel #ss-search::placeholder { color:rgba(37,33,25,0.45); letter-spacing:0.06em; }',
        '#ss-panel #ss-search:focus { outline:2px solid var(--mag-red, #e60000); outline-offset:-2px; }',
        '#ss-panel .ss-info { padding:9px 11px; background:#fffdf3; border:2px solid rgba(10,10,10,0.85); min-height:120px; overflow:auto; font-size:13px; }',
        '#ss-panel .ss-info .info-eyebrow { font-size:10px; letter-spacing:0.18em; color:var(--mag-red, #e60000); text-transform:uppercase; }',
        '#ss-panel .ss-info .statline { display:flex; justify-content:space-between; border-top:1px dashed rgba(10,10,10,0.3); padding:2px 0; }',
        // Same reserve as the inventory screen: the chip set shrinks while a
        // stack is held, and this panel is width:auto — so left alone the hint
        // row resizes the whole panel mid-drag. width:0 + min-width:100% keeps
        // it out of the shrink-to-fit width so chips wrap instead of stretching
        // the panel; renderHints() reserves the tallest set's height.
        '#ss-panel .ss-hints {',
        '  display:flex; flex-wrap:wrap; align-content:flex-start;',
        '  gap:10px 14px; justify-content:flex-start;',
        '  width:0; min-width:100%;',
        '  margin-top:10px; border-top:2px dashed rgba(10,10,10,0.3); padding-top:8px;',
        '}',
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
                <input id="ss-search" type="search" placeholder="Search…" autocomplete="off" spellcheck="false">
                <span class="slots-text" id="ss-player-slots">—</span>
                <button class="tsic-button cancel" id="ss-sort-player" type="button">Sort</button>
                <button class="tsic-button cancel" id="ss-quick-stack" type="button" title="Top up stacks this container already holds (locked items stay)">Quick Stack</button>
                <button class="tsic-button cancel" id="ss-store-all" type="button" title="Store everything except locked and equipped items">Store All</button>
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
                        <!-- The heading IS the rename field: click and type. A
                             separate rename button would be one more thing to
                             find in a header that is already busy. -->
                        <input id="ss-container-name" class="ss-name-input" type="text" maxlength="24"
                               placeholder="${opts.containerEyebrow || 'Container'}"
                               title="Name this container" autocomplete="off" spellcheck="false">
                        <button class="tsic-button cancel ss-sort-mini" id="ss-sort-container" type="button">Sort</button>
                        <label class="ss-auto-sort" title="Sort this container automatically when you close it">
                            <input type="checkbox" id="ss-auto-sort"> auto
                        </label>
                        <span class="cnt" id="ss-container-slots">—</span>
                    </div>
                    <div id="ss-container-list" class="ss-grid"></div>
                    <!-- Container weight meter. Containers enforce weight as a HARD
                         block on top of the slot grid, so without this a deposit can
                         be refused with visibly empty cells and no explanation. Shown
                         only when weight actually blocks (bCanExceedWeight false). -->
                    <div class="ss-meter" id="ss-container-meter" style="display:none;">
                        <div class="lab"><span>Capacity</span><span class="val" id="ss-cweight-text">—</span></div>
                        <div class="track"><div class="fill" id="ss-cweight-fill"></div></div>
                    </div>
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
            containerWeight: 0,
            containerMaxWeight: 0,
            // Containers block on weight; the player only slows down (Overburdened).
            containerCanExceedWeight: false,
            searchTerm: '',
            // Active pane for the >> header marker (last pointer interaction).
            activePane: 'player',
            hovered: null,  // { side, it }
            // The player's leading grid cells are the hotbar; C++ ships the real count on
            // UI.Hotbar.Changed and heldHotbarSlot is the cell currently in the player's hands.
            hotbarSlots: (window.TSICInventory && window.TSICInventory.HOTBAR_SLOTS) || 8,
            heldHotbarSlot: -1,
        };

        const tabDefs = TABS.map(t => ({ id: t.id, label: t.id }));
        const playerTabFilter = TSIC.TabFilter.create(
            panel.querySelector('.ss-tabs[data-side="player"]'),
            tabDefs,
            function (id) { state.playerTab = id; renderAll(); }
        );

        // What a shift-click would actually do with this stack. Answers "will
        // this fit?" BEFORE the transfer, which matters most on the container
        // side where weight is a hard block, not a slowdown.
        function transferPreview(it, side) {
            const desc = describe(it);
            if (!desc || !state.containerOwnerId) return null;
            const toContainer = side === 'player';
            const count = it.Count || 1;
            if (!toContainer) {
                return { fits: count, blocked: false, label: 'to backpack' };
            }
            const perUnit = desc.Weight || 0;
            const slotsFree = Math.max(0, state.containerMaxSlots - state.containerItems.length);
            // Weight only limits when the container can't exceed its capacity.
            let byWeight = count;
            if (!state.containerCanExceedWeight && state.containerMaxWeight > 0 && perUnit > 0) {
                const room = state.containerMaxWeight - state.containerWeight;
                byWeight = Math.max(0, Math.floor(room / perUnit));
            }
            // A stack merging into an existing one needs no new cell.
            const hasMatch = state.containerItems.some((c) => c && c.ItemId === it.ItemId);
            const bySlots = (hasMatch || slotsFree > 0) ? count : 0;
            const fits = Math.min(count, byWeight, bySlots);
            return {
                fits,
                blocked: fits < count,
                label: fits === 0 ? 'container full' : (fits < count ? `only ${fits} of ${count} fit` : 'to container'),
            };
        }

        function renderInfo(it, side) {
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

            const preview = transferPreview(it, side);
            if (!preview) return;
            const row = document.createElement('div');
            row.style.cssText = 'margin-top:7px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;'
                + 'color:' + (preview.blocked ? '#c11818' : 'rgba(37,33,25,0.6)') + ';';
            row.textContent = 'Shift-click: ' + preview.label;
            host.appendChild(row);
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

            // Container capacity. Only meaningful while weight is a hard block —
            // if the container can exceed it, the slot grid is the real limit and
            // a second bar would just be noise.
            const cmeter = panel.querySelector('#ss-container-meter');
            const showCapacity = !state.containerCanExceedWeight && state.containerMaxWeight > 0;
            cmeter.style.display = showCapacity ? '' : 'none';
            if (showCapacity) {
                const ccur = state.containerWeight || 0;
                const cmax = state.containerMaxWeight;
                const cratio = Math.min(1, ccur / cmax);
                panel.querySelector('#ss-cweight-text').textContent = `${ccur.toFixed(1)}/${cmax.toFixed(0)} kg`;
                panel.querySelector('#ss-cweight-fill').style.width = `${(cratio * 100).toFixed(1)}%`;
                cmeter.dataset.state = cratio >= 0.999 ? 'full' : (cratio >= 0.8 ? 'warning' : 'normal');
            }
        }

        function setActivePane(side) {
            if (state.activePane === side) return;
            state.activePane = side;
            renderMeterAndCounts();
        }

        // Compose the pane's tab filter with the shared search term. Returns null
        // when neither is active so renderGrid can skip the per-cell test.
        function buildFilter(tabFn) {
            const term = state.searchTerm;
            if (!tabFn && !term) return null;
            const cat = (window.tsic && window.tsic.itemCatalog) || {};
            return (it) => {
                if (tabFn && !tabFn(it)) return false;
                if (!term) return true;
                const desc = cat[it.ItemId];
                const haystack = (((desc && desc.Name) || '') + ' ' + (it.ItemId || '')).toLowerCase();
                return haystack.indexOf(term) !== -1;
            };
        }

        // True when the live HUD bar is standing in for the player's hotbar cells, so the
        // player pane must skip them. False on the standalone dev pages, which boot no HUD
        // and where this panel is those cells' only home.
        function barIsTheRow() {
            return !!(window.TSICHotbar && window.TSICHotbar.available());
        }

        function paneOpts(side) {
            const isPlayer = side === 'player';
            const ownerId = isPlayer ? state.playerOwnerId : state.containerOwnerId;
            const otherId = isPlayer ? state.containerOwnerId : state.playerOwnerId;
            const barIsRow = isPlayer && barIsTheRow();
            return {
                catalog: (window.tsic && window.tsic.itemCatalog) || {},
                gridWidth: isPlayer ? state.playerGridW : state.containerGridW,
                slotCount: isPlayer ? state.playerMaxSlots : state.containerMaxSlots,
                ownerId: ownerId || (isPlayer ? 'Player' : ''),
                focusGroup: isPlayer ? 'ss-player' : 'ss-container',
                panelEl: panel,
                // The player's first row is the hotbar: drawn by the live HUD bar and skipped
                // here, or drawn and marked here when there is no bar. Containers have neither.
                startSlot: barIsRow ? state.hotbarSlots : 0,
                hotbarSlots: (isPlayer && !barIsRow) ? state.hotbarSlots : 0,
                heldSlot: (isPlayer && !barIsRow) ? state.heldHotbarSlot : -1,
                // Tabs are player-side only; search dims across BOTH panes, which
                // is the point when you're hunting one item across two grids.
                filterFn: buildFilter(isPlayer ? filterFnFor(state.playerTab) : null),
                onHover: (it) => {
                    state.hovered = it ? { side, it } : null;
                    setActivePane(side);
                    if (it) renderInfo(it, side);
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

        // The pane contract handed to the live HUD bar so its cells act as the player pane's
        // first row: same hover readout and active-pane marker, and a shift-click that
        // transfers into the container, exactly like the cells above it. Every field that can
        // change while the screen is open (the container's id, the tab, the search term) is
        // read at call time — this pane is bound once and lives for the whole screen.
        const HOTBAR_PANE = {
            ownerId: state.playerOwnerId,
            focusGroup: 'ss-player',
            onHover: (it) => {
                state.hovered = it ? { side: 'player', it } : null;
                setActivePane('player');
                if (it) renderInfo(it, 'player');
            },
            onLeave: () => { state.hovered = null; },
            onQuickMove: (it) => {
                if (!state.containerOwnerId || it.GridSlot == null || it.GridSlot < 0) return;
                tsic.publishMessage('UI.Cmd.Inventory.QuickMove', {
                    FromOwnerId: state.playerOwnerId, ToOwnerId: state.containerOwnerId,
                    ItemId: it.InstanceId, FromSlot: it.GridSlot,
                });
                playTransferSound();
            },
            otherOwnerId: () => state.containerOwnerId || '',
            filterFor: () => buildFilter(filterFnFor(state.playerTab)),
            equippedIds: () => null,
        };

        function renderAll() {
            playerTabFilter.setActive(state.playerTab);
            renderMeterAndCounts();
            window.TSICInventory.renderGrid(panel.querySelector('#ss-player-list'), state.playerItems, paneOpts('player'));
            window.TSICInventory.renderGrid(panel.querySelector('#ss-container-list'), state.containerItems, paneOpts('container'));
            // The bar re-renders itself on inventory broadcasts; this covers what it cannot
            // see — a tab change, a search keystroke, a container swap.
            if (window.TSICHotbar) window.TSICHotbar.refresh();
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
                hintChip(host, ['RMB'], 'Half');
                hintChip(host, ['SHIFT', 'RMB'], 'Split…');
                hintChip(host, ['SHIFT', 'LMB'], 'Quick-move');
                hintChip(host, ['LMB', 'LMB'], 'Collect');
                hintChip(host, ['G'], 'Drop 1');
            }
            // The idle set is always the taller one — measure it and hold that
            // height so picking a stack up cannot shed a wrapped line.
            if (!held) {
                host.style.minHeight = '';
                host.style.minHeight = host.offsetHeight + 'px';
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

        // Store All / Quick Stack. Both are one server-side op rather than a
        // burst of per-item QuickMoves, so the skip rules (locked, equipped) are
        // enforced once on authority instead of trusted to the client.
        function depositAll(matchingOnly) {
            if (!state.containerOwnerId) return;
            tsic.publishMessage('UI.Cmd.Inventory.DepositAll', {
                FromOwnerId: state.playerOwnerId,
                ToOwnerId: state.containerOwnerId,
                bMatchingOnly: !!matchingOnly,
            });
            playTransferSound();
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
                state.containerWeight = typeof p.CurrentWeight === 'number' ? p.CurrentWeight : 0;
                state.containerMaxWeight = typeof p.MaxWeight === 'number' ? p.MaxWeight : 0;
                state.containerCanExceedWeight = !!p.bCanExceedWeight;
                // Don't yank the field out from under someone mid-rename.
                const nameInput = panel.querySelector('#ss-container-name');
                if (nameInput && document.activeElement !== nameInput) {
                    nameInput.value = p.CustomName || '';
                }
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
            if (window.TSICInventory) {
                window.TSICInventory.reconcileHeld(p.OwnerId, p.Items);
                window.TSICInventory.noteSnapshot(p.OwnerId, p.Items);
            }
            renderAll();
        }

        tsic.on('tsic.msg.UI.Inventory.Updated', applyInventoryMessage);
        tsic.on('tsic.msg.UI.Hotbar.Changed', (p) => {
            if (!p) return;
            if (typeof p.NumSlots === 'number' && p.NumSlots > 0) state.hotbarSlots = p.NumSlots;
            state.heldHotbarSlot = (typeof p.SelectedSlot === 'number') ? p.SelectedSlot : -1;
            renderAll();
        });
        window.addEventListener('tsic-item-catalog', renderAll);

        // Auto-sort on close: a per-client preference (no server state — it only
        // decides whether to send a Sort the player could send by hand anyway).
        const AUTO_SORT_KEY = 'tsic.storage.autoSortOnClose';
        function autoSortEnabled() {
            try { return localStorage.getItem(AUTO_SORT_KEY) === '1'; } catch { return false; }
        }
        const autoSortBox = panel.querySelector('#ss-auto-sort');
        autoSortBox.checked = autoSortEnabled();
        autoSortBox.addEventListener('change', () => {
            try { localStorage.setItem(AUTO_SORT_KEY, autoSortBox.checked ? '1' : '0'); } catch {}
        });

        panel.querySelector('#ss-close').addEventListener('click', () => {
            window.TSICInventory.cancelHeld();
            if (autoSortEnabled() && state.containerOwnerId) {
                tsic.publishMessage('UI.Cmd.Inventory.Sort', { OwnerId: state.containerOwnerId });
            }
            tsic.publishMessage('UI.Cmd.Pause.Resume', {});
            tsic.playSound('Container.Close', 0.4);
        });
        panel.querySelector('#ss-take-all').addEventListener('click', takeAll);
        panel.querySelector('#ss-store-all').addEventListener('click', () => {
            window.TSICInventory.cancelHeld();
            depositAll(false);
        });
        panel.querySelector('#ss-quick-stack').addEventListener('click', () => {
            window.TSICInventory.cancelHeld();
            depositAll(true);
        });

        // Container rename: commit on Enter or blur. Escape reverts and gives the
        // field up so the next Escape closes the screen as usual.
        const nameInput = panel.querySelector('#ss-container-name');
        let nameBeforeEdit = '';
        function commitRename() {
            if (!state.containerOwnerId) return;
            const next = nameInput.value.trim();
            if (next === nameBeforeEdit) return;
            nameBeforeEdit = next;
            tsic.publishMessage('UI.Cmd.Inventory.Rename', {
                OwnerId: state.containerOwnerId, Name: next,
            });
        }
        nameInput.addEventListener('focus', () => { nameBeforeEdit = nameInput.value.trim(); });
        nameInput.addEventListener('blur', commitRename);
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                nameInput.value = nameBeforeEdit;
                nameInput.blur();
                e.stopPropagation();
                e.preventDefault();
                return;
            }
            e.stopPropagation();
            if (e.key === 'Enter') {
                commitRename();
                nameInput.blur();
            }
        });

        const ssSearch = panel.querySelector('#ss-search');
        ssSearch.addEventListener('input', () => {
            state.searchTerm = ssSearch.value.trim().toLowerCase();
            renderAll();
        });
        // Typing must not reach the grid's own key handlers (G would drop an item).
        ssSearch.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') e.stopPropagation();
        });
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
                window.TSICInventory.closeSplit();
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
                return;
            }
        });

        // The shell is mounted once and reused for every container the player opens, so the
        // bar has to be claimed and handed back per showing — not at mount. The screen module
        // drives these from onShow/onHide; the standalone dev pages never call them and keep
        // drawing the hotbar cells in the panel instead.
        function activate() {
            if (window.TSICHotbar) window.TSICHotbar.setGridPane(HOTBAR_PANE);
            renderAll();
        }
        function deactivate() {
            window.TSICInventory.cancelHeld();
            if (window.TSICHotbar) window.TSICHotbar.setGridPane(null);
        }

        renderAll();
        tsic.playSound('Container.Open', 0.4);
        return { state, refresh: renderAll, activate, deactivate };
    }

    window.TSICStorageShell = { mount };
})();
