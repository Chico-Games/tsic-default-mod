// Inventory screen module — grid design §10.1 "Split Page" layout.
//
// Left column: a pane header (category tabs, each one slot-column wide, + this pane's slot
// count) over the player grid, with the weight bar on the panel's bottom line. Right rail:
// armor-only paper doll (+ Backpack), character preview, item info card. Bottom: a footer bar
// with the contextual hotkey hints on the left and the buttons hard right.
//
// Every measurement above the footer is shared with the storage screen (shared/storage-shell.js)
// so that opening a container ADDS a column and moves nothing. Changing the band, the 26px
// pane-header row or the tab metrics here means changing them there too.
//
// THE HOTBAR IS A STRIP ALONG THE BOTTOM OF THIS PANEL (Minecraft's layout). Cells 0..7 are
// the hotbar, so the bag grid starts at cell 8 and #inv-hotbar draws the eight below it, set
// slightly apart by a rule but wired as an ordinary pane: same pickup, same drags, same
// shift-click, same number chips. The player sees each cell exactly once.
//
// The live HUD bar at the bottom of the screen is a READ-ONLY MIRROR of the same cells, and
// the overlay covers it while this screen is open. It used to be the editing surface itself —
// lifted above the overlay and bound as this grid's first row — and having two places that
// both claimed to be "the hotbar", one of them outside the panel, is what players reported as
// confusing (issue #203).
//
// All interactions ride the shared cursor engine (shared/inventory.js):
// click/drag pickup, RMB half/place-one, shift-click quick-move (armour to the doll,
// everything else band-swaps hotbar <-> bag), double-click collect, G / Ctrl+G drops,
// click-outside world drops, 1-8 to swap the hovered stack onto the bar.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const STYLE = `
    /* Top-left anchored — .tsic-modal-scrim--left supplies the alignment and the insets. The
       storage screen is this screen plus a container column, so a centred panel would slide
       the bag sideways AND upward every time a crate was opened. inset:0 rather than the
       class's position:fixed keeps the panel inside the overlay. */
    [data-screen="Inventory"] #inv-root { position:absolute; inset:0; display:flex; pointer-events:auto; }
    /* min(92vh, 100%): 92vh is the look, 100% is the guarantee — a panel capped only against
       vh would run off the top of a shorter overlay instead of scrolling. */
    [data-screen="Inventory"] #inv-panel { width:auto; height:auto; max-width:92vw; max-height:min(92vh, 100%); overflow:auto; }
    [data-screen="Inventory"] #inv-band { display:flex; align-items:baseline; gap:12px; border-bottom:3px solid rgba(10,10,10,0.85); margin-bottom:10px; padding-bottom:5px; }
    [data-screen="Inventory"] #inv-band h2 { margin:0; }
    [data-screen="Inventory"] #inv-band .spacer { flex:1; }
    [data-screen="Inventory"] #inv-band .slots-text { font-size:14px; letter-spacing:0.08em; color:rgba(37,33,25,0.65); }
    /* Lives in the PANE header, over the grid it sorts — the storage screen has one of these
       per pane and they have to be the same plate at the same offset.
       Sized in SLOTS, not pixels. The header has to fit 6 slot-wide tabs + this + the slot
       count inside 8 slot columns; with a fixed pixel size that holds at --tsic-slot 68px and
       fails as the clamp shrinks, shoving both past the grid's right edge on a 1280 window.
       Scaling with the slot makes the budget a constant ratio, so it fits at every size. */
    [data-screen="Inventory"] .sort-btn {
      box-sizing:border-box; align-self:center;
      height: max(16px, calc(var(--tsic-slot) * 0.294));
      padding: 0 max(5px, calc(var(--tsic-slot) * 0.147));
      font: inherit; font-size: clamp(9px, calc(var(--tsic-slot) * 0.162), 11px);
      line-height:1; letter-spacing:0.1em; cursor:pointer;
      background: rgba(255,253,243,0.96); border:2px solid rgba(10,10,10,0.85); color:inherit;
    }
    [data-screen="Inventory"] .sort-btn:hover, [data-screen="Inventory"] .sort-btn[data-tsic-focused] { background: var(--mag-red, #e60000); color:#fff; }
    [data-screen="Inventory"] .inv-cols { display:grid; gap:12px; grid-template-columns:max-content 300px; align-items:stretch; }
    [data-screen="Inventory"] .inv-bagcol { display:flex; flex-direction:column; min-width:0; }

    /* Pane header — tabs on the left, then SORT and this pane's slot count. Pinned to exactly
       26px INCLUDING its 4px rule, because the storage screen pins its container header to the
       same box to put both grids on one line; changing this height moves the bag on BOTH
       screens. The rule lives here rather than on #inv-tabs: the strip is only as wide as its
       tabs now, so its own underline would stop short of the grid.

       width:0 + min-width:100% — the GRID decides this column's width, nothing else. The
       header's own content is ~14px wider than 8 slot columns, so left to contribute it
       widened the column and pushed SORT past the grid's right edge. Same trick on the meter
       and on the footer below. */
    [data-screen="Inventory"] .inv-panehdr {
      box-sizing:border-box; height:26px; margin-bottom:8px;
      width:0; min-width:100%;
      display:flex; align-items:flex-end; gap: max(4px, calc(var(--tsic-slot) * 0.118));
      border-bottom:4px solid var(--ink-night);
    }
    [data-screen="Inventory"] .inv-panehdr .spacer { flex:1; }
    /* Fixed min-width so SORT lands at the same offset from the column's right edge as the
       container pane's does on the storage screen, whatever the digits say. Budget is tight:
       6 slot-wide tabs + SORT + this must fit 8 slot columns, which is why the count reads
       "19/32" and not "19/32 SLOTS" — the word cost 38px and the strip wrapped. */
    [data-screen="Inventory"] .inv-panehdr .slots-text {
      align-self:center; min-width: max(40px, calc(var(--tsic-slot) * 0.912)); text-align:right;
      font-size: clamp(9px, calc(var(--tsic-slot) * 0.162), 11px);
      letter-spacing:0.1em; text-transform:uppercase; color:rgba(37,33,25,0.65); white-space:nowrap;
    }
    /* One tab per slot COLUMN: same width, same gap, so every tab sits squarely over the
       column it filters and the strip reads as part of the grid rather than a bar above it.
       bottom:-4px is the shared tab treatment — the active red block overlaps the rule. */
    [data-screen="Inventory"] #inv-tabs { display:flex; flex-wrap:nowrap; flex:0 1 auto; min-width:0; gap:var(--tsic-slot-gap); border-bottom:0; margin-bottom:0; }
    [data-screen="Inventory"] #inv-tabs .tsic-tab {
      box-sizing:border-box; flex:0 1 var(--tsic-slot); min-width:0; width:var(--tsic-slot);
      padding:2px 0; font-size: clamp(9px, calc(var(--tsic-slot) * 0.162), 11px); overflow:hidden;
      display:flex; align-items:center; justify-content:center;
    }
    /* Hover/focus reads as a lighter draft of the active state (a solid red block), so the
       cursor answers "what does clicking do?" before the click. :not(.is-active) keeps the
       selected tab from washing out when the pointer passes over it. */
    [data-screen="Inventory"] #inv-tabs .tsic-tab:not(.is-active):hover,
    [data-screen="Inventory"] #inv-tabs .tsic-tab:not(.is-active)[data-tsic-focused] {
      background: rgba(230,0,0,0.16); color: var(--ink-night);
    }

    /* The player's grid is ONE grid drawn as two bands: the bag, then the hotbar strip under
       it. #inv-grid is the pair; each band is its own renderGrid host, because they cover
       different cell ranges and the strip must not scroll with the bag. */
    [data-screen="Inventory"] #inv-grid { display:flex; flex-direction:column; gap:0; width:max-content; }
    [data-screen="Inventory"] .inv-grid {
      display:grid; grid-template-columns: repeat(var(--grid-cols, 8), var(--tsic-slot));
      grid-auto-rows: var(--tsic-slot); gap:var(--tsic-slot-gap); width:max-content;
      max-height: calc(var(--tsic-slot-rows) * (var(--tsic-slot) + var(--tsic-slot-gap))); overflow-y:auto;
    }
    /* No scrollbar-gutter here, deliberately. The bands DO scroll past their row cap, so they
       are a real gutter-reflow candidate — but this rule is scoped to the inventory screen
       and the storage screen builds its own bag pane (shared/storage-shell.js), so reserving
       15px on one of them and not the other breaks the pixel-for-pixel parity the two screens
       are required to hold (tests/bag-layout-parity.test.js). Reserving it here means
       reserving it there, in the same change. */
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
    /* Stack count — the yellow chip. 14px is ~15% up from the old 12px.
       The odd padding is deliberate and measured. This renders in Press Start 2P, a PIXEL
       font whose metrics are ascent = 1em, descent = 0 — so its digits' ink actually hangs a
       pixel BELOW the em box, and any normal centring parks them on the chip's bottom edge
       (measured: 8px of air above, 1px below). Note line-height cannot fix it: under
       align-items:center the line box is centred as a unit, so its height cancels out of the
       ink position entirely. Only the box height and the vertical padding move the glyphs.
       height:19 + padding-bottom:6 puts the ink at 4.5px from both edges — actually centred,
       not approximately. Re-measure if the font or font-size changes. */
    [data-screen="Inventory"] .tsic-slot .count {
      position:absolute; bottom:1px; right:2px;
      display:flex; align-items:center; justify-content:center;
      min-width:17px; height:19px; padding:0 4px 6px;
      font-size:14px; font-weight:700; color:#1a1612; background: var(--mag-yellow, #ffcc00);
      border:1px solid rgba(10,10,10,0.85); pointer-events:none;
    }
    [data-screen="Inventory"] .tsic-slot .equip-badge {
      position:absolute; top:1px; left:2px; padding:1px 4px; line-height:1;
      font-size:11px; font-weight:700; color:#fff; background: var(--mag-red, #e60000);
      border:1px solid rgba(10,10,10,0.85); pointer-events:none;
    }
    /* The hotbar strip — cells 0..7, on their own line under the bag with a gap and a rule
       between the two. "Slightly separate but still part of the panel" is the whole brief:
       far enough apart to read as its own band, close enough that a stack is dragged between
       the two without the pointer leaving the panel.

       Sized and gapped exactly like .inv-grid so every hotbar cell sits squarely under the
       bag column it shares a number with. width:max-content keeps the rule the grid's width
       rather than the panel's. */
    [data-screen="Inventory"] .inv-hotbar {
      flex:0 0 auto; overflow:visible;
      margin-top:12px; padding-top:12px; border-top:3px double rgba(10,10,10,0.5);
    }
    /* Ordinary cells in every respect; the heavier bottom rule and the number chip just mark
       which stacks are one keypress from being in the player's hands. */
    [data-screen="Inventory"] .tsic-slot.is-hotbar { border-bottom-width:4px; }
    [data-screen="Inventory"] .tsic-slot.is-hotbar .hotbar-key {
      position:absolute; top:1px; right:2px; padding:1px 4px; line-height:1;
      font-size:11px; font-weight:700; color: var(--mag-yellow, #ffcc00); background: rgba(10,10,10,0.9);
      border:1px solid rgba(10,10,10,0.85); pointer-events:none;
    }
    /* The cell whose item is actually in the player's hands, matching the HUD bar's selection
       frame so the screen and the bar never disagree. */
    [data-screen="Inventory"] .tsic-slot.is-held {
      border-color: var(--mag-red, #e60000); box-shadow: 0 0 0 2px var(--mag-red, #e60000) inset;
    }
    [data-screen="Inventory"] .tsic-slot.is-held .hotbar-key { color:#fff; background: var(--mag-red, #e60000); }

    /* Directly under the grid, NOT pushed to the column's bottom. The rail is taller than
       this column here (the paper doll runs past the grid), so margin-top:auto would drop the
       weight bar to the doll's bottom edge — 46px below where the storage screen puts it, and
       the bar is the one thing on this column that must not move between the two. Storage
       does use auto, because there it has a container capacity bar to line up with. */
    [data-screen="Inventory"] .inv-meter { margin-top:0; padding-top:8px; width:0; min-width:100%; }
    /* min-height matches the storage screen's, where the bag's weight label has to sit on one
       line with the container's capacity label. */
    [data-screen="Inventory"] .inv-meter .lab { display:flex; justify-content:space-between; align-items:center; min-height:19px; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(37,33,25,0.8); }
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

    /* The rail must never be TALLER than the bag column beside it, or the panel runs on past
       the weight bar and leaves dead space under the grid. Two things keep that true:
       the doll's cells are deliberately smaller than grid cells (--inv-equip-slot), and the
       info card's floor is low enough that doll + floor still fits the SHORTEST bag column
       (a 24-slot bag: 4 grid rows). The card then flexes to eat whatever is left over. */
    [data-screen="Inventory"] .inv-rail { --inv-equip-slot: calc(var(--tsic-slot) * 0.74); display:flex; flex-direction:column; gap:8px; }
    [data-screen="Inventory"] #inv-doll {
      position:relative; display:grid; grid-template-columns:var(--inv-equip-slot) 1fr var(--inv-equip-slot); gap:4px; padding:8px;
      flex:0 0 auto; background: rgba(255,253,243,0.96); border:2px solid rgba(10,10,10,0.85);
    }
    [data-screen="Inventory"] .doll-col { display:flex; flex-direction:column; justify-content:space-around; align-items:center; gap:14px; }
    [data-screen="Inventory"] .equip-slot {
      width:var(--inv-equip-slot); height:var(--inv-equip-slot); position:relative;
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

    /* min-height:0, deliberately — see the note on .inv-rail. This card is the rail's slack:
       it takes whatever height the doll leaves, so the rail can never be taller than the bag
       column and there is no dead space under the grid at ANY bag size. Any floor here is a
       floor on the rail, and on the starter bag (4 grid rows) even 88px re-opened a 28px gap.
       It scrolls, so a short card loses nothing. */
    [data-screen="Inventory"] #inv-info {
      padding:9px 11px; background:#fffdf3; border:2px solid rgba(10,10,10,0.85);
      min-height:0; flex:1 1 auto; overflow:auto; font-size:13px;
    }
    [data-screen="Inventory"] #inv-info .info-eyebrow { font-size:10px; letter-spacing:0.18em; color: var(--mag-red, #e60000); text-transform:uppercase; }
    [data-screen="Inventory"] #inv-info .statline { display:flex; justify-content:space-between; border-top:1px dashed rgba(10,10,10,0.3); padding:2px 0; }
    [data-screen="Inventory"] #inv-info .statline b { letter-spacing:0.06em; font-size:12px; }

    /* Footer bar: key hints on the left, buttons hard right. The chip set changes when a
       stack is picked up, and the panel is width:auto — so left to itself this row is the one
       child whose content can resize the whole panel mid-drag. width:0 + min-width:100% keeps
       it out of the panel's shrink-to-fit width (the grid and rail decide that), so the chips
       wrap onto as many lines as they need instead of stretching the panel to fit them on
       one. renderHints() then reserves the tallest set's height so swapping sets can't change
       it either. */
    /* min-height is shared with the storage screen's footer and is what makes the two PANELS
       the same height. Everything above this row is already identical, so the footer was the
       only difference: seven hint chips wrap to two rows here, while storage's six sit on one
       line under a much wider panel. Two chip rows (20px each + 10px gap) is the floor both
       reach, so both panels close at the same y. */
    [data-screen="Inventory"] .inv-footer {
      display:flex; align-items:flex-end; gap:16px;
      width:0; min-width:100%; min-height:60px;
      margin-top:10px; border-top:2px dashed rgba(10,10,10,0.3); padding-top:8px;
    }
    [data-screen="Inventory"] .inv-hints {
      flex:1 1 auto; min-width:0;
      display:flex; flex-wrap:wrap; align-content:flex-start;
      gap:10px 14px;
    }
    /* Same plate metrics as the storage screen's footer buttons — .tsic-button's default
       padding made Close visibly bigger here than the identical button over there. */
    [data-screen="Inventory"] .inv-actions { flex:0 0 auto; display:flex; gap:8px; align-items:flex-end; }
    [data-screen="Inventory"] .inv-actions .tsic-button { font-size:12px; padding:4px 10px; }
    [data-screen="Inventory"] .inv-hints .hint { display:flex; align-items:center; gap:5px; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:rgba(74,66,57,0.9); }
    [data-screen="Inventory"] .inv-hints .kbd {
      display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:20px; padding:0 4px;
      background:#fffdf3; border:2px solid rgba(10,10,10,0.85); box-shadow:2px 2px 0 rgba(10,10,10,0.85);
      font-size:9px; font-weight:700; color:#1a1612;
    }
  `;

  const TEMPLATE = `
    <div id="inv-root" class="tsic-modal-scrim tsic-modal-scrim--left">
      <div id="inv-panel" class="tsic-panel tsic-panel--screen">
        <div id="inv-band">
          <h2 class="tsic-title">Inventory</h2>
        </div>
        <div class="inv-cols">
          <div class="inv-bagcol">
            <div class="inv-panehdr">
              <div id="inv-tabs" data-tsic-tab-bar></div>
              <span class="spacer"></span>
              <button id="inv-sort" class="sort-btn" data-tsic-focusable>SORT</button>
              <span class="slots-text" id="inv-slots-text" title="Slots used">—</span>
            </div>
            <div id="inv-grid">
              <div id="inv-bag" class="inv-grid"></div>
              <div id="inv-hotbar" class="inv-grid inv-hotbar" title="Hotbar — press 1-8 to draw these"></div>
            </div>
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
        <div class="inv-footer">
          <div class="inv-hints" id="inv-hints"></div>
          <div class="inv-actions">
            <button class="tsic-button" id="inv-close" type="button">Close (Esc)</button>
          </div>
        </div>
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

      // Mirrors the storage screen's footer button, and gives the screen a visible way out
      // for anyone not reaching for Escape.
      root.querySelector('#inv-close').addEventListener('click', () => {
        window.TSICInventory.cancelHeld();
        ctx.publish('UI.Cmd.Pause.Resume', {});
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

      // Catalog entry for whatever is worn in the same equipment slot as `desc`,
      // so the info card can show upgrade/downgrade deltas. Null when the item
      // isn't equippable, the slot is empty, or it IS the equipped item.
      function equippedRivalFor(desc, item) {
        if (!desc || !desc.EquipmentSlot) return null;
        const cat = window.tsic.itemCatalog || {};
        for (const s of ((lastEquipment && lastEquipment.Slots) || [])) {
          if (!s || s.SlotTag !== desc.EquipmentSlot) continue;
          if (s.ItemId == null || s.ItemId === '') return null;
          if (item && String(s.ItemId) === String(item.InstanceId)) return null; // this one is worn
          const wornDefId = defIdForInstance(s.ItemId);
          const wornDesc = wornDefId ? cat[wornDefId] : null;
          return wornDesc ? Object.assign({ ItemId: wornDefId }, wornDesc) : null;
        }
        return null;
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
        const full = Object.assign({ ItemId: item.ItemId }, desc);
        window.TSICInventory.renderInfoPanel(host, full, item, equippedRivalFor(desc, item));
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

      // How many leading grid cells are the hotbar. C++ ships it on every hotbar broadcast;
      // the shared default covers the first render before one has arrived.
      function hotbarSlotCount() {
        const n = lastHotbar && lastHotbar.NumSlots;
        return (typeof n === 'number' && n > 0) ? n : window.TSICInventory.HOTBAR_SLOTS;
      }

      // The cell whose item is actually in the player's hands, or -1 for empty hands.
      function heldHotbarSlot() {
        const s = lastHotbar && lastHotbar.SelectedSlot;
        return (typeof s === 'number') ? s : -1;
      }

      // Armour is anything equippable that wants a slot OTHER than the weapon hand — those are
      // the only items the paper doll takes, and the only ones the hotbar can't hold.
      function isArmour(desc) {
        const slot = desc && desc.EquipmentSlot;
        return !!slot && !String(slot).endsWith('.Weapon');
      }

      /**
       * Minecraft's shift-click: an item on the hotbar row jumps to the bag, an item in the bag
       * jumps to the hotbar row. Lands on the first free cell of the target band; if that band
       * is full the click does nothing, rather than silently swapping something out.
       */
      function bandSwap(it) {
        if (!it || it.GridSlot < 0) return;
        const bar = hotbarSlotCount();
        const capacity = lastUpdate.MaxSlots > 0 ? lastUpdate.MaxSlots : 32;
        const occupied = new Set((lastUpdate.Items || []).map((row) => row.GridSlot));
        const onBar = it.GridSlot < bar;
        const from = onBar ? bar : 0;
        const to = onBar ? capacity : bar;
        let target = -1;
        for (let i = from; i < to; i++) {
          if (!occupied.has(i)) { target = i; break; }
        }
        if (target < 0) {
          tsic.playSound('Inventory.Invalid', 0.4);
          return;
        }
        ctx.publish('UI.Cmd.Inventory.Move', {
          FromOwnerId: 'Player', ToOwnerId: 'Player',
          ItemId: it.InstanceId, FromSlot: it.GridSlot,
          ToSlot: target, Count: 0,
        });
        tsic.playSound('Inventory.Transfer', 0.4);
      }

      function equippedIdSet() {
        return new Set(
          ((lastEquipment && lastEquipment.Slots) || [])
            .map((s) => s && s.ItemId)
            .filter((id) => id != null && id !== '')
            .map((id) => String(id))
        );
      }

      // Null when the All tab is active, so the grid can skip the per-cell test entirely.
      function buildFilterFn() {
        const cat = window.tsic.itemCatalog || {};
        const activeTab = tabFilter ? tabFilter.getActive() : 'All';
        const filter = TAB_FILTERS[activeTab] || null;
        if (!filter) return null;
        return (it) => {
          const desc = cat[it.ItemId];
          return !!desc && filter(desc);
        };
      }

      function onHoverCell(it) {
        hoveredItem = it || null;
        if (it) renderInfo(it);
        renderMeter();
      }
      function onLeaveCell() { hoveredItem = null; renderMeter(); /* info stays sticky */ }

      // Shift-click, Minecraft's resolution order with no container open:
      //   1. armour  -> the paper doll (equip, or unequip when already worn)
      //   2. anything else -> band-swap between the hotbar row and the bag
      // With a container open the storage shell handles the click first and transfers
      // instead, which is also what Minecraft does.
      function onQuickMoveCell(it) {
        const cat = window.tsic.itemCatalog || {};
        if (isArmour(cat[it.ItemId])) {
          const slotTag = equippedSlotTagFor(it.InstanceId);
          if (slotTag) {
            ctx.publish('UI.Cmd.Equipment.Unequip', { ItemId: '', SlotTag: slotTag });
            tsic.playSound('Inventory.Unequip', 0.45);
          } else {
            ctx.publish('UI.Cmd.Equipment.Equip', { ItemId: String(it.InstanceId), SlotTag: '' });
            tsic.playSound('Inventory.Equip', 0.45);
          }
          return;
        }
        bandSwap(it);
      }

      // Paper-doll item dragged into a grid cell: unequip, then place it in the release cell
      // (the item never left its cell — it was just marked worn).
      function onDollDropCell(src, cellIndex) {
        if (!src.equipSlotTag) return;
        ctx.publish('UI.Cmd.Equipment.Unequip', { ItemId: '', SlotTag: src.equipSlotTag });
        tsic.playSound('Inventory.Unequip', 0.45);
        const worn = itemByInstance(src.instanceId);
        if (worn && worn.GridSlot >= 0 && worn.GridSlot !== cellIndex) {
          ctx.publish('UI.Cmd.Inventory.Move', {
            FromOwnerId: 'Player', ToOwnerId: 'Player',
            ItemId: worn.InstanceId, FromSlot: worn.GridSlot,
            ToSlot: cellIndex, Count: 0,
          });
        }
      }

      // Everything the two grid hosts have in common — the bag and the hotbar strip are one
      // inventory split across two elements, so every interaction hook is shared and only the
      // cell range differs.
      function sharedPaneOpts() {
        return {
          catalog: window.tsic.itemCatalog || {},
          ownerId: 'Player',
          focusGroup: 'inv-grid',
          panelEl: root.querySelector('#inv-panel'),
          equippedIds: equippedIdSet(),
          filterFn: buildFilterFn(),
          onHover: onHoverCell,
          onLeave: onLeaveCell,
          onQuickMove: onQuickMoveCell,
          onDollDrop: onDollDropCell,
          otherOwnerId: () => '',
        };
      }

      function refresh() {
        if (!lastUpdate) return;
        const slotCount = lastUpdate.MaxSlots > 0 ? lastUpdate.MaxSlots : 32;
        // Shared with the storage screen so the bag is the same shape on both (§10.1).
        const lockedPreview = window.TSICInventory.lockedPreviewFor(slotCount);
        const bar = hotbarSlotCount();

        // The bag: everything AFTER the hotbar cells, which the strip below draws.
        window.TSICInventory.renderGrid(root.querySelector('#inv-bag'), lastUpdate.Items || [],
          Object.assign(sharedPaneOpts(), {
            gridWidth: lastUpdate.GridWidth > 0 ? lastUpdate.GridWidth : 8,
            slotCount,
            lockedPreviewCells: lockedPreview,
            startSlot: bar,
          }));

        // The hotbar strip: cells 0..bar-1, one row, numbered, with the drawn cell framed.
        // endSlot pins its length — overflow parked past the bag's cap must extend the bag,
        // never this.
        window.TSICInventory.renderGrid(root.querySelector('#inv-hotbar'), lastUpdate.Items || [],
          Object.assign(sharedPaneOpts(), {
            gridWidth: bar,
            slotCount: bar,
            endSlot: bar,
            hotbarSlots: bar,
            heldSlot: heldHotbarSlot(),
          }));

        // Gamepad landing: opening the screen puts focus on the first grid
        // cell (§8.1). Re-stamped on every re-render.
        const firstCell = root.querySelector('#inv-grid .tsic-slot[data-tsic-focusable]');
        if (firstCell) firstCell.setAttribute('data-tsic-initial-focus', '');

        const used = (lastUpdate.Items || []).length;
        root.querySelector('#inv-slots-text').textContent = `${used}/${slotCount}`;
        renderMeter();
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
                tsic.playSound('Inventory.Unequip', 0.45);
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

      let hintMeasurePending = false;
      function renderHints() {
        const host = root.querySelector('#inv-hints');
        const heldStack = window.TSICInventory.getHeld();
        // A pickup can land before the deferred idle measurement below has run
        // (it is two frames out). The idle chips are still in the DOM at this
        // point, so take the reserve off them now — the tree is clean this far
        // from mount, making the forced read cheap — before they are cleared.
        if (heldStack && hintMeasurePending) {
          hintMeasurePending = false;
          host.style.minHeight = host.offsetHeight + 'px';
        }
        host.innerHTML = '';
        if (heldStack) {
          host.appendChild(hintChip(['LMB'], 'Place'));
          host.appendChild(hintChip(['RMB'], 'Place one'));
          host.appendChild(hintChip(['ESC'], 'Return'));
        } else {
          host.appendChild(hintChip(['LMB'], 'Take'));
          host.appendChild(hintChip(['RMB'], 'Half'));
          host.appendChild(hintChip(['SHIFT', 'RMB'], 'Split…'));
          host.appendChild(hintChip(['SHIFT', 'LMB'], 'Equip / to hotbar'));
          host.appendChild(hintChip(['1', '8'], 'Swap to hotbar'));
          host.appendChild(hintChip(['G'], 'Drop 1'));
          host.appendChild(hintChip(['CTRL', 'G'], 'Drop stack'));
        }
        // Holding a stack swaps in a shorter chip set, which would otherwise
        // shed a wrapped line and shrink the panel out from under the drag.
        // The idle set is always the tallest, so measure it and hold that
        // height for the held set. Clearing first re-measures at the current
        // width, so a grid-width change (new bag tier) re-reserves correctly.
        //
        // Deferred past the next frame's own layout: a synchronous offsetHeight
        // right after the mount/refresh DOM writes forced a full style+layout
        // pass on the dirty overlay — profiled at ~25ms of Inventory's 28ms
        // mount. Two rAFs later the tree is clean and the read is free. If a
        // stack got picked up meanwhile, skip — the next idle render re-queues.
        if (!heldStack) {
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

      // ...and draw the empty grid at its DEFAULT shape while that request is in flight, so
      // the panel opens at the size it is about to be. The panel is content-sized on purpose
      // (width:auto/height:auto — the grid is the layout rule, and the top-left anchor is
      // what keeps a container column from shoving the bag around), which means an unrendered
      // grid opens it 224px short and the snapshot then grows it under a cursor that is
      // already on it. Measured with Scripts/webui-bench/layout.mjs: #inv-panel h 469 -> 693
      // between mount and data, at every window size. That is issue #273's "panels resize as
      // content arrives" exactly.
      //
      // The defaults are refresh()'s own (MaxSlots 32, GridWidth 8) rather than new
      // guesses, so the placeholder is the same shape the common case settles at. A bag with
      // a non-default capacity still resizes once — there is nothing to know its size from
      // before the snapshot — but that is rare where this was constant.
      lastUpdate = { OwnerId: 'Player', MaxSlots: 32, GridWidth: 8, Items: [], bPlaceholder: true };
      (function drawPlaceholderGrid() {
        if (!window.TSICInventory) { setTimeout(drawPlaceholderGrid, 16); return; }
        // The snapshot handler REPLACES lastUpdate wholesale, so a real one that landed
        // while we waited for the module has already cleared the flag — never draw over it.
        if (lastUpdate && lastUpdate.bPlaceholder) refresh();
      })();

      ctx.on('tsic.msg.UI.Inventory.Updated', (p) => {
        if (!p || p.OwnerId !== 'Player') return;
        lastUpdate = p;
        // Diff against the previous snapshot so arrivals can wear a NEW badge.
        if (window.TSICInventory) window.TSICInventory.noteSnapshot('Player', p.Items);
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
        // #inv-grid is both bands, so this reaches the hotbar strip's E badges too.
        window.TSICInventory.updateEquippedClasses(root.querySelector('#inv-grid'), eqIds);
      });
      ctx.on('tsic.msg.UI.Hotbar.Changed', (p) => {
        lastHotbar = p || null;
        if (!ctx.isVisible()) return;
        // The strip frames the drawn cell, so a selection change is a re-render.
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
        // 15fps, not the 30 default. Each frame of this stream is a fresh 512x512
        // PNG decoded on the renderer's MAIN thread — the same thread that services
        // pointermove — and the inventory is the screen where the player is dragging
        // things. Measured 2026-08-13 with WebUIInputLatencyTest: turning this stream
        // off entirely took the screen's ack latency from p50 52.0ms / p95 81.1ms to
        // p50 35.6 / p95 56.5, i.e. it was costing ~16ms at the median and ~25ms at
        // the tail. Halving the rate buys back most of that, and an idle-animation
        // doll is the cheapest thing in this UI to spend smoothness on.
        this._previewStream = TSIC.startRuntimeImgStream(img, 'character-preview', { fps: 15 });
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

      // Keyboard (hover-based, §7.3): number keys SWAP the hovered stack with that hotbar cell
      // — Minecraft's gesture, and the only one that makes sense once the bar is grid cells.
      // G drops one, Ctrl+G the whole hovered stack.
      document.addEventListener('keydown', (e) => {
        if (!ctx.isVisible()) return;
        if (/^[1-9]$/.test(e.key) && hoveredItem && hoveredItem.GridSlot >= 0) {
          const slotIndex = parseInt(e.key, 10) - 1;
          if (slotIndex >= hotbarSlotCount() || slotIndex === hoveredItem.GridSlot) return;
          // A plain grid move: an occupied target swaps, a mergeable one merges.
          ctx.publish('UI.Cmd.Inventory.Move', {
            FromOwnerId: 'Player', ToOwnerId: 'Player',
            ItemId: hoveredItem.InstanceId, FromSlot: hoveredItem.GridSlot,
            ToSlot: slotIndex, Count: 0,
          });
          tsic.playSound('Inventory.Transfer', 0.4);
          return;
        }
        if ((e.key === 'g' || e.key === 'G') && hoveredItem && !window.TSICInventory.getHeld()) {
          window.TSICInventory.dropHovered({ ownerId: 'Player' }, hoveredItem, e.ctrlKey);
          return;
        }
        if (e.key === 'Escape') {
          // bindEscape closes the screen; a held stack visually returns first.
          window.TSICInventory.closeSplit();
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
      // The strip below the bag is now the hotbar's only home on screen.
      if (window.TSICHotbar) window.TSICHotbar.setBagPanelOpen(true);
      if (this._renderAll) this._renderAll();
      window.tsic.publishMessage('UI.Cmd.CharacterPreview.Show', {});
    },

    onHide(/* ctx */) {
      // Closing with a held stack: nothing ever moved — the gesture dissolves.
      if (window.TSICInventory) window.TSICInventory.cancelHeld();
      // Hand the HUD bar back: from here it is chrome again, and a click on it draws a slot.
      if (window.TSICHotbar) window.TSICHotbar.setBagPanelOpen(false);
      if (this._previewStream) { this._previewStream(); this._previewStream = null; }
      window.tsic.publishMessage('UI.Cmd.CharacterPreview.Hide', {});
    },
  });
})();
