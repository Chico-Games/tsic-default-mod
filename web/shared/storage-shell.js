// Shared storage view (grid design §10.2): THE INVENTORY SCREEN PLUS A CONTAINER COLUMN.
//
// "Plus" is literal, and it is the constraint this file is built around: the panel is
// left-anchored and the player column (tabs + bag + weight bar) and the 300px rail beside it
// are drawn to the inventory screen's exact measurements — same slot size, same abbreviated
// tab labels, same greyed backpack-preview cells, same weight bar with its hovered-stack chip.
// Opening a container ADDS a third column on the right and moves nothing that was already on
// screen. Before that it scoped slots down to 54px and dropped the preview cells, so every
// cell in the bag changed size AND position the moment a crate was opened.
//
// The rail is the one deliberate difference: with a container open it drops the paper doll and
// character preview and carries the info card alone, grown to fill that height. The bulk
// transfers and Close live in the footer bar, right-aligned under both grids.
//
// Each pane states its own fill (a slot count in its header, a meter on the panel's bottom
// line); nothing about the two grids is described once in a shared band.
//
// Containers show weight only when it is a HARD block (§3.4 — slots are otherwise their only
// limit). Both grids render with the same component and every interaction rides the shared
// cursor engine (shared/inventory.js): pickup, RMB half/place-one, shift-click quick-move
// across panes, double-click collect across both panes, G / Ctrl+G drops.
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
    // Same ids AND the same abbreviated labels as the inventory screen — the tab row sits
    // directly above the bag, so a wider set of words here would shift the grid under it.
    const TABS = [
        { id: 'All',           label: 'All',      filter: null },
        { id: 'Equipment',     label: 'Equip',    filter: c => c === 'Equipment' },
        { id: 'Consumables',   label: 'Cons.',    filter: c => c === 'Consumable' },
        { id: 'Constructable', label: 'Constr.',  filter: c => c === 'Constructable' },
        { id: 'Ammo',          label: 'Ammo',     filter: c => c === 'Ammo' },
        { id: 'Materials',     label: 'Mat.',     filter: c => c === 'CraftingMaterial' },
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
        // THE INVENTORY SCREEN, PLUS A CONTAINER COLUMN ON THE RIGHT. Everything to the left of
        // the container — the panel's left edge, the tab row, the slot size, the bag's cells
        // including its greyed backpack-preview cells, the weight bar, the rail — is drawn to
        // the same measurements as screens/inventory.js, so opening a crate ADDS a column and
        // moves nothing. It used to scope --tsic-slot down to 54px and drop the preview cells,
        // which resized and reshaped the bag under the player's hands on every open.
        //
        // Panel hugs its content (like #inv-panel) instead of the inherited 60vw, which clipped
        // the container grid on narrower displays. max-height min(92vh, 100%): 92vh is the
        // look, 100% is the guarantee — a panel capped only against vh would run off the top
        // of a shorter overlay instead of scrolling.
        '#ss-panel { width:auto; height:auto; max-width:94vw; max-height:min(92vh, 100%); overflow:auto; }',
        '#ss-panel .ss-band { display:flex; align-items:baseline; gap:12px; border-bottom:3px solid rgba(10,10,10,0.85); margin-bottom:10px; padding-bottom:5px; }',
        '#ss-panel .ss-band h2 { margin:0; }',
        '#ss-panel .ss-band .spacer { flex:1; }',
        '#ss-panel .ss-band .slots-text { font-size:14px; letter-spacing:0.08em; color:rgba(37,33,25,0.65); }',
        // ONE sort plate, used twice — one per pane, sitting over the grid it sorts, at the
        // same offset from that column's right edge. Identical to the inventory screen's.
        // Sized in SLOTS, not pixels — see the matching note in screens/inventory.js. A fixed
        // pixel size fits at --tsic-slot 68px and overflows the grid as the clamp shrinks.
        '#ss-panel .ss-sort-btn {',
        '  box-sizing:border-box; align-self:center;',
        '  height: max(16px, calc(var(--tsic-slot) * 0.294));',
        '  padding: 0 max(5px, calc(var(--tsic-slot) * 0.147));',
        '  font:inherit; font-size: clamp(9px, calc(var(--tsic-slot) * 0.162), 11px);',
        '  line-height:1; letter-spacing:0.1em; cursor:pointer;',
        '  background:rgba(255,253,243,0.96); border:2px solid rgba(10,10,10,0.85); color:inherit;',
        '}',
        '#ss-panel .ss-sort-btn:hover, #ss-panel .ss-sort-btn[data-tsic-focused] { background:var(--mag-red, #e60000); color:#fff; }',
        // 300px middle column = the inventory screen's rail width, so the container lands at a
        // fixed offset from the bag rather than one that depends on what is in the rail.
        '#ss-panel .ss-cols { display:grid; gap:12px; grid-template-columns:max-content 300px max-content; align-items:stretch; }',
        // Flex columns so each pane's meter can sit on the panel's bottom line, level with
        // the other's, instead of wherever its own grid happens to end.
        '#ss-panel .ss-col { display:flex; flex-direction:column; min-width:0; }',
        // One tab per slot COLUMN — same width, same gap as the grid below, matching the
        // inventory screen exactly.
        '#ss-panel .ss-tabs { display:flex; flex-wrap:nowrap; flex:0 1 auto; min-width:0; gap:var(--tsic-slot-gap); border-bottom:0; margin-bottom:0; }',
        '#ss-panel .ss-tabs .tsic-tab {',
        '  box-sizing:border-box; flex:0 1 var(--tsic-slot); min-width:0; width:var(--tsic-slot);',
        '  padding:2px 0; font-size: clamp(9px, calc(var(--tsic-slot) * 0.162), 11px); overflow:hidden;',
        '  display:flex; align-items:center; justify-content:center;',
        '}',
        // Hover/focus reads as a lighter draft of the active state, same as the inventory.
        '#ss-panel .ss-tabs .tsic-tab:not(.is-active):hover,',
        '#ss-panel .ss-tabs .tsic-tab:not(.is-active)[data-tsic-focused] {',
        '  background: rgba(230,0,0,0.16); color: var(--ink-night);',
        '}',
        // The player's grid is ONE grid drawn as two bands (bag, then hotbar strip);
        // #ss-player-list is the pair. Each band is its own renderGrid host.
        '#ss-panel #ss-player-list { display:flex; flex-direction:column; gap:0; width:max-content; }',
        '#ss-panel .ss-grid {',
        '  display:grid; grid-template-columns: repeat(var(--grid-cols, 8), var(--tsic-slot));',
        '  grid-auto-rows: var(--tsic-slot); gap:var(--tsic-slot-gap); width:max-content;',
        '  max-height: calc(var(--tsic-slot-rows) * (var(--tsic-slot) + var(--tsic-slot-gap))); overflow-y:auto;',
        '}',
        '#ss-panel .tsic-slot {',
        '  width:var(--tsic-slot); height:var(--tsic-slot); position:relative; cursor:pointer; padding:4px;',
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
        '#ss-panel .tsic-slot.is-locked {',
        '  background: rgba(227,216,184,0.7); border-style:dashed; border-color: rgba(10,10,10,0.35);',
        '  cursor:default; font-size:15px; opacity:0.75;',
        '}',
        '#ss-panel .tsic-slot .lock-glyph { opacity:0.35; pointer-events:none; }',
        // Stack count — the same chip as the inventory screen, including the measured
        // geometry. See the long note in screens/inventory.js: this renders in Press Start 2P
        // (ascent = 1em, descent = 0), so the digits' ink hangs below the em box and normal
        // centring parks it on the chip's bottom edge. height + padding-bottom are what
        // actually centre it; line-height cancels out under align-items:center.
        '#ss-panel .tsic-slot .count {',
        '  position:absolute; bottom:1px; right:2px;',
        '  display:flex; align-items:center; justify-content:center;',
        '  min-width:17px; height:19px; padding:0 4px 6px;',
        '  font-size:14px; font-weight:700; color:#1a1612; background:var(--mag-yellow, #ffcc00);',
        '  border:1px solid rgba(10,10,10,0.85); pointer-events:none;',
        '}',
        '#ss-panel .tsic-slot .equip-badge { position:absolute; top:1px; left:2px; padding:1px 4px; line-height:1; font-size:11px; font-weight:700; color:#fff; background:var(--mag-red, #e60000); border:1px solid rgba(10,10,10,0.85); pointer-events:none; }',
        // The hotbar strip under the player's bag — the SAME band the inventory screen draws
        // (see screens/inventory.js), at the same offset, so opening a crate never moves it.
        '#ss-panel .ss-hotbar {',
        '  flex:0 0 auto; overflow:visible;',
        '  margin-top:12px; padding-top:12px; border-top:3px double rgba(10,10,10,0.5);',
        '}',
        '#ss-panel .tsic-slot.is-hotbar { border-bottom-width:4px; }',
        '#ss-panel .tsic-slot.is-hotbar .hotbar-key { position:absolute; top:1px; right:2px; padding:1px 4px; line-height:1; font-size:11px; font-weight:700; color:var(--mag-yellow, #ffcc00); background:rgba(10,10,10,0.9); border:1px solid rgba(10,10,10,0.85); pointer-events:none; }',
        '#ss-panel .tsic-slot.is-held { border-color:var(--mag-red, #e60000); box-shadow:0 0 0 2px var(--mag-red, #e60000) inset; }',
        '#ss-panel .tsic-slot.is-held .hotbar-key { color:#fff; background:var(--mag-red, #e60000); }',
        // Both panes carry the SAME header row — 23px, 8px below — so the two grids start on
        // one line, and on the same line as the inventory screen's. Anything that grows this
        // row (a taller font, a border rule, a second line) drops one grid below the other
        // and the panel stops reading as one surface.
        // The 4px rule lives on the HEADER, not on .ss-tabs — the tab strip is only as wide as
        // its tabs now, and its own underline would stop short of the grid. Both panes carry
        // it, so the two columns read as a matched pair.
        // width:0 + min-width:100% — the GRID decides each column's width, nothing else. The
        // header's own content (tabs + SORT + count) is ~14px wider than 8 slot columns, so
        // left to contribute it widened the column and pushed SORT past the grid's right edge,
        // by a different amount in each pane. Same trick on the meters and the footer.
        '#ss-panel .ss-panehdr {',
        '  box-sizing:border-box; height:26px; margin-bottom:8px;',
        '  width:0; min-width:100%;',
        '  display:flex; align-items:flex-end; gap: max(4px, calc(var(--tsic-slot) * 0.118));',
        '  border-bottom:4px solid var(--ink-night);',
        '}',
        '#ss-panel .ss-panehdr .spacer { flex:1; }',
        '#ss-panel .ss-panehdr > .ss-name-input { align-self:center; }',
        // Each pane states its OWN fill. One shared count in the title band could only ever
        // describe one of the two grids on screen. The fixed min-width is what puts the two
        // SORT plates at the same offset from their columns' right edges, whatever the digits.
        // Budget is tight: 6 slot-wide tabs + SORT + this must fit 8 slot columns, which is why
        // the count reads "19/32" and not "19/32 SLOTS" — the word cost 38px and the strip wrapped.
        '#ss-panel .ss-panehdr .slots-text {',
        '  align-self:center; min-width: max(40px, calc(var(--tsic-slot) * 0.912)); text-align:right;',
        '  font-size: clamp(9px, calc(var(--tsic-slot) * 0.162), 11px);',
        '  letter-spacing:0.1em; text-transform:uppercase; color:rgba(37,33,25,0.65); white-space:nowrap;',
        '}',
        // Active pane marker (last pointer interaction), on the header itself now that the
        // heading is an <input> rather than an <h4>.
        '#ss-panel .ss-panehdr.on::before { content:">>"; color:var(--mag-red, #e60000); font-weight:900; letter-spacing:-0.05em; }',
        // Reads as the pane heading until focused, then as a text field. Flexes to fill the
        // header rather than a fixed width — the container column is a full grid wide, and a
        // 150px field truncated most container names ("Back Room Cra…").
        '#ss-panel .ss-name-input {',
        '  font:inherit; font-size:14px; letter-spacing:0.06em; text-transform:uppercase; color:inherit;',
        '  background:transparent; border:2px solid transparent; padding:0 4px; flex:1 1 auto; min-width:0;',
        '}',
        '#ss-panel .ss-name-input::placeholder { color:inherit; opacity:0.75; }',
        '#ss-panel .ss-name-input:hover { border-color:rgba(10,10,10,0.35); }',
        '#ss-panel .ss-name-input:focus { outline:none; border-color:rgba(10,10,10,0.85); background:#fffdf3; text-transform:none; }',
        // margin-top:auto — both meters land on the panel's bottom line, so the bag's weight
        // and the container's capacity read as one row rather than stepping with whichever
        // grid happens to have more rows.
        '#ss-panel .ss-meter { margin-top:auto; padding-top:8px; width:0; min-width:100%; }',
        // min-height pins the label row so WEIGHT and CAPACITY sit on ONE line. The bag's row
        // carries the yellow hovered-stack chip and the container's does not, which made it
        // 1.8px taller — enough to read as two bars that don't line up, even though the tracks
        // underneath were always flush.
        '#ss-panel .ss-meter .lab { display:flex; justify-content:space-between; align-items:center; min-height:19px; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(37,33,25,0.8); }',
        '#ss-panel .ss-meter .val { font-size:13px; }',
        // Hovered-stack readout, identical to the inventory screen's: the chip's space is
        // ALWAYS reserved (.none only hides it) so the bar never shifts as the cursor moves,
        // and .fillsel is a zero-layout overlay on the fill's right end.
        '#ss-panel .ss-meter .stackw {',
        '  display:inline-block; min-width:58px; text-align:center; font-size:12px;',
        '  color:#1a1612; background:var(--mag-yellow, #ffcc00); border:1px solid rgba(10,10,10,0.85);',
        '  padding:0 4px; margin-right:6px; line-height:1.4;',
        '}',
        '#ss-panel .ss-meter .stackw.none { visibility:hidden; }',
        '#ss-panel .ss-meter .track { height:14px; border:2px solid rgba(10,10,10,0.85); background:rgba(227,216,184,0.9); position:relative; overflow:hidden; }',
        '#ss-panel .ss-meter .fill { height:100%; background:var(--mag-red, #e60000); transition:width 120ms linear; }',
        '#ss-panel .ss-meter .fillsel { position:absolute; top:0; bottom:0; background:var(--mag-yellow, #ffcc00); border-left:1px solid rgba(10,10,10,0.85); }',
        '#ss-panel #ss-player-meter[data-state="overburdened"] .fill { animation: ss-ob-pulse 900ms ease-in-out infinite; }',
        '@keyframes ss-ob-pulse { 50% { filter: brightness(1.5); } }',
        // Container capacity turns amber then red as the HARD weight cap closes in,
        // so "why won\'t it take this?" is answered before the refusal happens. Scoped to the
        // container meter: the player has no hard cap, only Overburdened, and recolouring
        // their bar at 75% would promise a refusal that never comes.
        '#ss-panel #ss-container-meter[data-state="warning"] .fill { background:var(--mag-yellow, #ffcc00); }',
        '#ss-panel #ss-container-meter[data-state="full"] .fill { background:#c11818; }',
        '#ss-panel .ss-meter .note { font-size:10px; letter-spacing:0.06em; color:#c11818; min-height:12px; }',
        // The middle column. On the inventory screen this rail carries the paper doll, the
        // character preview and the info card; with a container open it is the info card
        // alone, grown to fill the height the doll leaves behind.
        '#ss-panel .ss-rail { display:flex; flex-direction:column; gap:8px; }',
        '#ss-panel .ss-info { padding:9px 11px; background:#fffdf3; border:2px solid rgba(10,10,10,0.85); min-height:88px; flex:1 1 auto; overflow:auto; font-size:13px; }',
        '#ss-panel .ss-info .info-eyebrow { font-size:10px; letter-spacing:0.18em; color:var(--mag-red, #e60000); text-transform:uppercase; }',
        '#ss-panel .ss-info .statline { display:flex; justify-content:space-between; border-top:1px dashed rgba(10,10,10,0.3); padding:2px 0; }',
        // Footer bar: key hints on the left, every button on the right — the two bulk
        // transfers, Quick Stack and Close on one line, so the middle column can be the info
        // card and nothing else. Arrows point at the grid each button moves items TO, so
        // direction never has to be remembered: the bag is left, the container right.
        //
        // Same reserve as the inventory screen: the chip set shrinks while a stack is held,
        // and this panel is width:auto — so left alone this row resizes the whole panel
        // mid-drag. width:0 + min-width:100% keeps it out of the shrink-to-fit width so chips
        // wrap instead of stretching the panel; renderHints() reserves the tallest set's height.
        // min-height is shared with the inventory screen's footer and is what makes the two
        // PANELS the same height — everything above this row is already identical, so the
        // footer was the only difference (seven hint chips wrap to two rows over there, six
        // sit on one line under this much wider panel).
        '#ss-panel .ss-footer {',
        '  display:flex; align-items:flex-end; gap:16px;',
        '  width:0; min-width:100%; min-height:60px;',
        '  margin-top:10px; border-top:2px dashed rgba(10,10,10,0.3); padding-top:8px;',
        '}',
        '#ss-panel .ss-hints {',
        '  flex:1 1 auto; min-width:0;',
        '  display:flex; flex-wrap:wrap; align-content:flex-start; gap:10px 14px;',
        '}',
        '#ss-panel .ss-actions { flex:0 0 auto; display:flex; gap:8px; align-items:flex-end; }',
        '#ss-panel .ss-actions .tsic-button { font-size:12px; padding:4px 10px; }',
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
            </div>
            <div class="ss-cols">
                <div class="ss-col" data-tsic-tab-context="player">
                    <div class="ss-panehdr">
                        <div class="ss-tabs" data-side="player" data-tsic-tab-bar></div>
                        <span class="spacer"></span>
                        <button id="ss-sort-player" class="ss-sort-btn" type="button" data-tsic-focusable>SORT</button>
                        <span class="slots-text" id="ss-player-slots" title="Slots used">—</span>
                    </div>
                    <div id="ss-player-list">
                        <div id="ss-player-bag" class="ss-grid"></div>
                        <div id="ss-player-hotbar" class="ss-grid ss-hotbar" title="Hotbar — press 1-8 to draw these"></div>
                    </div>
                    <div class="ss-meter" id="ss-player-meter">
                        <div class="lab"><span>Weight</span>
                            <span class="val"><span class="stackw none" id="ss-stackw">0.0 kg</span><span id="ss-weight-text">—</span></span>
                        </div>
                        <div class="track"><div class="fill" id="ss-weight-fill"></div><div class="fillsel" id="ss-weight-sel" style="display:none"></div></div>
                    </div>
                </div>
                <div class="ss-rail">
                    <div id="ss-info" class="ss-info tsic-empty">Hover an item to see details</div>
                </div>
                <div class="ss-col" data-tsic-tab-context="container">
                    <div class="ss-panehdr" id="ss-container-hdr">
                        <!-- The heading IS the rename field: click and type. A
                             separate rename button would be one more thing to
                             find in a header that is already busy. -->
                        <input id="ss-container-name" class="ss-name-input" type="text" maxlength="24"
                               placeholder="${opts.containerEyebrow || 'Container'}"
                               title="Name this container" autocomplete="off" spellcheck="false">
                        <button class="ss-sort-btn" id="ss-sort-container" type="button" data-tsic-focusable>SORT</button>
                        <span class="slots-text" id="ss-container-slots" title="Slots used">—</span>
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
            <div class="ss-footer">
                <div class="ss-hints" id="ss-hints"></div>
                <div class="ss-actions">
                    <button class="tsic-button cancel" id="ss-take-all" type="button" title="Move everything the container holds into your bag">◀ Take All</button>
                    <button class="tsic-button cancel" id="ss-store-all" type="button" title="Store everything except locked and equipped items">Store All ▶</button>
                    <button class="tsic-button cancel" id="ss-quick-stack" type="button" title="Top up stacks this container already holds (locked items stay)">Quick Stack ▶</button>
                    <button class="tsic-button" id="ss-close" type="button" data-tsic-initial-focus>Close (Esc)</button>
                </div>
            </div>
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
            // Active pane for the >> header marker (last pointer interaction).
            activePane: 'player',
            hovered: null,  // { side, it }
            // The player's leading grid cells are the hotbar; C++ ships the real count on
            // UI.Hotbar.Changed and heldHotbarSlot is the cell currently in the player's hands.
            hotbarSlots: (window.TSICInventory && window.TSICInventory.HOTBAR_SLOTS) || 8,
            heldHotbarSlot: -1,
        };

        const tabDefs = TABS.map(t => ({ id: t.id, label: t.label || t.id }));
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
            // The bar PEGS at 100% while the number keeps counting (soft cap).
            const ratio = max > 0 ? Math.min(1, cur / max) : 0;
            panel.querySelector('#ss-weight-fill').style.width = `${(ratio * 100).toFixed(1)}%`;
            panel.querySelector('#ss-player-meter').dataset.state =
                max > 0 && cur > max ? 'overburdened' : (ratio >= 0.75 ? 'warning' : 'normal');

            // Hovered-stack readout, as on the inventory screen. Player-side hovers only: the
            // yellow segment marks the part of the load THIS stack accounts for, and a stack
            // still sitting in the container accounts for none of it.
            const chip = panel.querySelector('#ss-stackw');
            const seg = panel.querySelector('#ss-weight-sel');
            const sel = (state.hovered && state.hovered.side === 'player') ? state.hovered.it : null;
            const desc = sel ? describe(sel) : null;
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

            panel.querySelector('#ss-player-slots').textContent =
                `${state.playerItems.length}/${state.playerMaxSlots}`;
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

        // Null when the pane has no filter (container panes never do, and the player pane's
        // All tab doesn't either), so renderGrid can skip the per-cell test.
        function buildFilter(tabFn) {
            return tabFn || null;
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
                // The player's hotbar cells live in the strip under this grid, so the bag
                // starts after them. Containers have no hotbar band at all.
                startSlot: isPlayer ? state.hotbarSlots : 0,
                // The bag's greyed backpack-preview cells (§10.1) — the SAME ones the
                // inventory screen draws. Omitting them here was what made the bag two rows
                // shorter, and the whole panel a different shape, the instant a crate opened.
                lockedPreviewCells: isPlayer ? window.TSICInventory.lockedPreviewFor(state.playerMaxSlots) : 0,
                // Tabs are player-side only — the container pane never filters.
                filterFn: buildFilter(isPlayer ? filterFnFor(state.playerTab) : null),
                onHover: (it) => {
                    state.hovered = it ? { side, it } : null;
                    setActivePane(side);
                    // setActivePane no-ops when the pane hasn't changed, but the weight bar's
                    // hovered-stack readout follows the CELL, so it needs the call either way.
                    renderMeterAndCounts();
                    if (it) renderInfo(it, side);
                },
                onLeave: () => { state.hovered = null; renderMeterAndCounts(); /* info stays sticky */ },
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

        // The player's hotbar cells, drawn as their own strip under the bag. Same pane options
        // as the bag above it — same hover readout, same active-pane marker, same shift-click
        // into the container — bounded to cells 0..hotbarSlots-1 and marked with the number
        // chips. endSlot pins its length so overflow parked past the bag's cap extends the
        // BAG and never this row.
        function hotbarStripOpts() {
            return Object.assign(paneOpts('player'), {
                gridWidth: state.hotbarSlots,
                slotCount: state.hotbarSlots,
                endSlot: state.hotbarSlots,
                startSlot: 0,
                hotbarSlots: state.hotbarSlots,
                heldSlot: state.heldHotbarSlot,
                lockedPreviewCells: 0,
                focusGroup: 'ss-player',
            });
        }

        function renderAll() {
            playerTabFilter.setActive(state.playerTab);
            renderMeterAndCounts();
            window.TSICInventory.renderGrid(panel.querySelector('#ss-player-bag'), state.playerItems, paneOpts('player'));
            window.TSICInventory.renderGrid(panel.querySelector('#ss-player-hotbar'), state.playerItems, hotbarStripOpts());
            window.TSICInventory.renderGrid(panel.querySelector('#ss-container-list'), state.containerItems, paneOpts('container'));
            renderHints();
        }

        let hintMeasurePending = false;
        function renderHints() {
            const host = panel.querySelector('#ss-hints');
            const held = window.TSICInventory.getHeld();
            // A pickup can land before the deferred idle measurement below has
            // run (it is two frames out). The idle chips are still in the DOM,
            // so take the reserve off them now — cheap this far from mount —
            // before they are cleared.
            if (held && hintMeasurePending) {
                hintMeasurePending = false;
                host.style.minHeight = host.offsetHeight + 'px';
            }
            host.innerHTML = '';
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
            //
            // The measurement is deferred past the next frame's own layout:
            // renderAll() calls this right after rewriting all three grids, so a
            // synchronous offsetHeight here forced a full style+layout pass on
            // the dirty panel — profiled as the single biggest cost of opening
            // Storage (~45ms of its 47ms mount), and paid again on every
            // refresh. Two rAFs later the tree is clean and the read is free.
            // If a stack got picked up meanwhile, skip — the held set is on
            // screen, and the next idle render re-queues the measurement.
            if (!held) {
                host.style.minHeight = '';
                hintMeasurePending = true;
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (!hintMeasurePending) return;   // a pickup already took the measure
                    hintMeasurePending = false;
                    if (!host.isConnected) return;
                    host.style.minHeight = host.offsetHeight + 'px';
                }));
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

        panel.querySelector('#ss-close').addEventListener('click', () => {
            window.TSICInventory.cancelHeld();
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
        // screen module re-renders it from onShow and drops any held stack on onHide.
        function activate() {
            // This panel draws the hotbar cells, so the HUD bar stands down while it is up.
            if (window.TSICHotbar) window.TSICHotbar.setBagPanelOpen(true);
            renderAll();
        }
        function deactivate() {
            window.TSICInventory.cancelHeld();
            if (window.TSICHotbar) window.TSICHotbar.setBagPanelOpen(false);
        }

        renderAll();
        tsic.playSound('Container.Open', 0.4);
        return { state, refresh: renderAll, activate, deactivate };
    }

    window.TSICStorageShell = { mount };
})();
