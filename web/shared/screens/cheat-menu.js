// CheatMenu screen module — registered with TSIC.registerScreen, mounted as an
// overlay by shared/screen-manager.js. Was the inline script in
// screens/cheat-menu.html, which as an unregistered screen fell through to
// screen-manager's window.location.replace fallback and navigated the whole
// Root view off the shell (taking the HUD with it).
//
// Dev only. Every button publishes UI.Cmd.Cheat.Execute, which C++ compiles out
// under !UE_WITH_CHEAT_MANAGER — in a Shipping build the panel is inert, so the
// F1 binding is harmless there rather than something to strip.
//
// Commands are authored as data (TABS below), not markup. Four button flavours,
// and the difference matters:
//
//   data-cmd-tpl        fires on click, substituting {p} only. An E2E test clicks
//                       EVERY one of these and asserts the exact published string,
//                       so they must never depend on an input or a confirm.
//   data-cmd-tpl-input  + data-input: pulls {v} from one input, skips when empty.
//   data-cmd-multi      substitutes {#some-id} from any number of inputs, plus
//                       {i}/{f}/{c} for the item/furniture/creature pickers.
//   data-cmd-danger     destructive — needs a second click within 2s to fire.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    // screen-manager.js installs TSIC.registerScreen — retry until ready.
    setTimeout(register, 16);
    return;
  }

  // ---------------------------------------------------------------- markup
  // Small builders so ~140 commands stay readable as data. All of them return
  // HTML strings; nothing here touches the DOM.

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function attr(name, value) { return value == null || value === '' ? '' : ` ${name}="${esc(value)}"`; }

  // One command button. `cmd` carries the template; which attribute it lands in
  // is decided by the extra fields (see the header comment).
  function btn(b) {
    const cls = 'tsic-button' + (b.danger ? ' cm-danger' : '');
    let cmdAttr;
    if (b.danger)       cmdAttr = attr('data-cmd-danger', b.cmd);
    else if (b.input)   cmdAttr = attr('data-cmd-tpl-input', b.cmd) + attr('data-input', b.input);
    else if (b.multi)   cmdAttr = attr('data-cmd-multi', b.cmd);
    else                cmdAttr = attr('data-cmd-tpl', b.cmd);
    // The warning glyph goes in the label, not a ::before — .tsic-button already
    // owns ::before for its inner border, and overriding it both drops that border
    // and drops the glyph on top of the text.
    const text = (b.danger ? '⚠ ' : '') + b.label;
    return `<button class="${cls}"${cmdAttr}${attr('data-state-key', b.state)}${attr('title', b.title)}>${esc(text)}</button>`;
  }

  const row = (...kids) => `<div class="cm-row">${kids.filter(Boolean).join('')}</div>`;
  // Resolves the entity under the crosshair into every entity-id field.
  const AIM_BTN = '<button class="cm-exec" data-aim-fill title="Fill from whatever the crosshair is on">⌖ aim</button>';
  const btnRow = (list) => row(...list.map(btn));
  const note = (text) => `<div class="cm-meta">${esc(text)}</div>`;
  const label = (text, forId) => `<label${attr('for', forId)}>${esc(text)}</label>`;

  function num(id, o) {
    o = o || {};
    return `<input class="cm-input cm-input--sm" id="${esc(id)}" type="number"` +
      attr('min', o.min) + attr('max', o.max) + attr('step', o.step) +
      attr('value', o.value) + attr('placeholder', o.placeholder) + '>';
  }
  function text(id, o) {
    o = o || {};
    return `<input class="cm-input${o.small ? ' cm-input--sm' : ''}" id="${esc(id)}" type="text"` +
      attr('value', o.value) + attr('placeholder', o.placeholder) + '>';
  }

  /** label + one or more inputs + one or more buttons, on a single line. */
  function inputRow(o) {
    return row(
      o.label ? label(o.label, o.labelFor) : '',
      (o.inputs || []).join(''),
      ...(o.btns || []).map(btn)
    );
  }

  // ------------------------------------------------------------------ tabs
  // Every exec cheat in Source/TSIC/*/Cheats/ (plus the GameWorldTimeManager
  // execs and a few useful console commands) has a home here.

  const TABS = [
    // =====================================================================
    {
      id: 'player', label: 'Player',
      sections: [
        {
          title: 'MODES',
          html:
            btnRow([
              { label: 'Toggle God', cmd: 'ScpGod {p}', state: 'bGod' },
              { label: 'Toggle Ghost', cmd: 'ScpGhost {p}', state: 'bGhost',
                title: 'Enemies ignore this player.' },
              { label: 'Toggle Fly', cmd: 'ScpFly {p}', state: 'bFly' },
              { label: 'Toggle Creative', cmd: 'Creative {p}', state: 'bCreative',
                title: 'Free crafting and building.' },
            ]) +
            btnRow([
              { label: 'Toggle Keep Items', cmd: 'KeepItems {p}', state: 'bKeepItems' },
              { label: 'Toggle Reveal Recipes', cmd: 'RevealAllRecipes', state: 'bRecipesRevealed' },
            ]) +
            note('"Keep Items" prevents tombstone spawn on next death for the target player.'),
        },
        {
          title: 'HEALTH',
          html:
            btnRow([
              { label: 'Heal', cmd: 'Heal {p}' },
              { label: 'Force Respawn', cmd: 'ForceRespawn {p}' },
              { label: 'Kill Player', cmd: 'KillPlayer {p}', danger: true },
            ]) +
            inputRow({
              label: 'Hurt', labelFor: 'cm-hurt',
              inputs: [num('cm-hurt', { value: 25, min: 1, step: 5 })],
              btns: [{ label: 'Damage', cmd: 'Hurt {v} {p}', input: 'cm-hurt',
                title: 'Runs the real damage pipeline — armour, cues, death and the post-damage regen block all apply.' }],
            }) +
            inputRow({
              label: 'Set HP', labelFor: 'cm-sethealth',
              inputs: [num('cm-sethealth', { value: 50, min: 1, step: 5 })],
              btns: [{ label: 'Set', cmd: 'SetHealth {v} {p}', input: 'cm-sethealth',
                title: 'Moves the bar with no armour maths, cues or regen block. Clamped to [1, Max].' }],
            }) +
            inputRow({
              label: 'Stagger', labelFor: 'cm-stagger',
              inputs: [num('cm-stagger', { value: 50, min: 1, step: 10 })],
              btns: [{ label: 'Stagger nearest', cmd: 'Stagger {v} {p}', input: 'cm-stagger',
                title: 'Applies to the nearest non-player ScpCharacter. Needs a StaggerProfile on the target.' }],
            }) +
            note('Hurt goes through armour and blocks regen; Set HP does not. Use Set HP to stage a healing test.'),
        },
        {
          title: 'HUNGER',
          html:
            btnRow([
              { label: 'Clear', cmd: 'Hunger 0 {p}' },
              { label: 'Hungry', cmd: 'Hunger 1 {p}' },
              { label: 'Starving', cmd: 'Hunger 2 {p}' },
            ]) +
            note('Skips the ~7 minute design window. Eating still clears it, so the full loop is testable in one sitting.'),
        },
        {
          title: 'READOUTS',
          html: btnRow([
            { label: 'Print Position', cmd: 'Pos {p}' },
            { label: 'Print Inventory', cmd: 'PrintInventory {p}' },
            { label: 'Dump Research Credits', cmd: 'DumpResearchCredits' },
          ]) + note('Output lands in the transcript below.'),
        },
      ],
    },

    // =====================================================================
    {
      id: 'items', label: 'Items',
      sections: [
        {
          title: 'ITEM GRANT',
          // Bespoke: the mode dropdown drives which catalogue the picker shows.
          html: `
          <div class="cm-row">
            <label for="cm-mode">Mode</label>
            <select class="cm-select" id="cm-mode">
              <option value="GiveItem">Give Item</option>
              <option value="EquipItem">Equip Item</option>
              <option value="GiveAllFurniture">Give All Furniture</option>
              <option value="GiveConstructionItem">Give Construction Item</option>
              <option value="GiveConstructionItemAndCost">Give CI + Cost</option>
              <option value="GiveRecipeIngredients">Give Recipe Ingredients</option>
              <option value="GiveEquippable">Give Equippable</option>
              <option value="GiveWeapon">Give Weapon</option>
              <option value="GiveHeadGear">Give Head Gear</option>
              <option value="GiveBodyArmor">Give Body Armor</option>
              <option value="GiveLegArmor">Give Leg Armor</option>
              <option value="GiveShoes">Give Shoes</option>
              <option value="GiveGloves">Give Gloves</option>
            </select>
          </div>
          <div class="cm-row">
            <label for="cm-item-filter">Filter</label>
            <input class="cm-input" id="cm-item-filter" placeholder="type to filter…">
          </div>
          <div class="cm-row">
            <label for="cm-item">Item</label>
            <select class="cm-select" id="cm-item"><option value="">(catalog loading…)</option></select>
          </div>
          <div class="cm-row">
            <label for="cm-item-count">Quantity</label>
            <input class="cm-input cm-input--sm" id="cm-item-count" type="number" min="1" value="1">
            <button class="cm-exec" id="cm-give">Execute</button>
            <span class="cm-readout" id="cm-item-readout">0 items</span>
          </div>`,
        },
        {
          title: 'SELECTED ITEM',
          html:
            btnRow([
              { label: 'Eat', cmd: 'Eat {i} {p}', multi: true },
              { label: 'Craft', cmd: 'CraftItem {i} {p}', multi: true },
            ]) +
            inputRow({
              label: 'Count', labelFor: 'cm-item-op-count',
              inputs: [num('cm-item-op-count', { value: 1, min: 1 })],
              btns: [
                { label: 'Drop', cmd: 'DropItem {i} {#cm-item-op-count} {p}', multi: true },
                { label: 'Remove', cmd: 'RemoveItem {i} {#cm-item-op-count} {p}', multi: true },
              ],
            }) +
            note('Acts on whatever the Item Grant picker above has selected.'),
        },
        {
          title: 'BULK',
          html:
            inputRow({
              label: 'Each', labelFor: 'cm-bulk-count',
              inputs: [num('cm-bulk-count', { value: 100, min: 1 })],
              btns: [
                { label: 'All Items', cmd: 'GiveAllItems {#cm-bulk-count} {p}', multi: true },
                { label: 'All Food', cmd: 'GiveAllFood {#cm-bulk-count} {p}', multi: true },
                { label: 'All Furniture', cmd: 'GiveAllFurniture {#cm-bulk-count} {p}', multi: true },
              ],
            }) +
            btnRow([
              { label: 'Construction Items', cmd: 'GiveConstructionItems' },
              { label: 'Test Crafting Mats', cmd: 'GiveTestCraftingMaterials' },
            ]) +
            inputRow({
              label: 'Item set', labelFor: 'cm-item-set',
              inputs: ['<select class="cm-select cm-input--sm" id="cm-item-set"><option value="">(none)</option></select>'],
              btns: [{ label: 'Give Set', cmd: 'GivePlayerItemsSet {v} {p}', input: 'cm-item-set' }],
            }) +
            btnRow([
              { label: 'Clear Inventory', cmd: 'ClearInventory {p}', danger: true },
            ]),
        },
      ],
    },

    // =====================================================================
    {
      id: 'build', label: 'Build',
      sections: [
        {
          title: 'SPAWN FURNITURE',
          html: `
          <div class="cm-row">
            <label class="cm-toggle"><input type="checkbox" id="cm-furn-constructed"> Show constructed variants</label>
          </div>
          <div class="cm-row">
            <label for="cm-furn-filter">Filter</label>
            <input class="cm-input" id="cm-furn-filter" placeholder="type to filter…">
          </div>
          <div class="cm-row">
            <label for="cm-furn">Furniture</label>
            <select class="cm-select" id="cm-furn"><option value="">(catalog loading…)</option></select>
          </div>
          <div class="cm-row">
            <button class="cm-exec" id="cm-spawn-furn">Spawn (place in front)</button>
            <button class="cm-exec" id="cm-construct-furn">Construct (carry)</button>
            <span class="cm-readout" id="cm-furn-readout">0 furniture</span>
          </div>`
            + btnRow([
              { label: 'Construct + place', cmd: 'ConstructAndPlace {f}', multi: true },
            ])
            + note('Placement needs traced ground under the crosshair — a floorless tile silently fails.'),
        },
        {
          title: 'AIMED FURNITURE',
          html:
            btnRow([
              { label: 'Deconstruct', cmd: 'Deconstruct', danger: true },
              { label: 'Upgrade', cmd: 'UpgradeFurniture {p}' },
              { label: 'Toggle Health Bars', cmd: 'ShowFurnitureHealth' },
            ]) +
            inputRow({
              label: 'Cost ×', labelFor: 'cm-upgrade-mult',
              inputs: [num('cm-upgrade-mult', { value: 1, min: 1 })],
              btns: [{ label: 'Give upgrade items', cmd: 'GiveUpgradeItems {v} {p}', input: 'cm-upgrade-mult',
                title: 'Ingredients for the next upgrade tier of the furniture you are looking at.' }],
            }) +
            note('These act on whatever the crosshair is pointing at.'),
        },
        {
          title: 'STATIONS',
          html: btnRow([
            { label: 'Spawn Test Crafting Bench', cmd: 'SpawnTestCraftingBench' },
          ]),
        },
      ],
    },

    // =====================================================================
    {
      id: 'world', label: 'World',
      sections: [
        {
          title: 'FOG OF WAR',
          html:
            btnRow([
              { label: 'Toggle Hide FOW', cmd: 'HideFOW {p}', state: 'bFogHidden',
                title: 'Server-side fog state for this player.' },
              { label: 'Reset FOW', cmd: 'ResetFOW', danger: true },
            ]) +
            btnRow([
              { label: 'Minimap fog off', cmd: 'SetFogOfWarVisible 0' },
              { label: 'Minimap fog on', cmd: 'SetFogOfWarVisible 1' },
            ]) +
            note('Hide/Reset change real server fog state. The minimap pair is local display only.'),
        },
        {
          title: 'INTERACT',
          html: inputRow({
            label: 'Entity', labelFor: 'cm-interact-entity',
            inputs: [num('cm-interact-entity', { placeholder: 'entity id' }), AIM_BTN],
            btns: [{ label: 'Interact with entity', cmd: 'InteractWithEntity {v} {p}', input: 'cm-interact-entity' }],
          }),
        },
        {
          title: 'SESSION',
          html: btnRow([
            { label: 'Hide Loading Screen', cmd: 'HideLoadingScreen' },
            { label: 'List Definition Packs', cmd: 'ListDefinitionPacks' },
            { label: 'Purge Mod Cache', cmd: 'ScpMods.PurgeCache' },
          ]),
        },
      ],
    },

    // =====================================================================
    {
      id: 'time', label: 'Time',
      sections: [
        {
          title: 'SKIP',
          html: `
          <div class="cm-row">
            <label for="cm-skip-days">Skip days</label>
            <input class="cm-input cm-input--sm" id="cm-skip-days" type="number" min="0" step="1" value="1">
            <button class="cm-exec" id="cm-do-skip-days">Skip</button>
          </div>
          <div class="cm-row">
            <label for="cm-skip-hours">Skip hours</label>
            <input class="cm-input cm-input--sm" id="cm-skip-hours" type="number" min="0" step="0.5" value="1">
            <button class="cm-exec" id="cm-do-skip-hours">Skip</button>
          </div>`
            + btnRow([
              { label: 'Skip to Open', cmd: 'SkipOpen' },
              { label: 'Skip to Closed', cmd: 'SkipClosed' },
            ]) + `
          <div class="cm-row">
            <label for="cm-set-time">Set hour</label>
            <input class="cm-input cm-input--sm" id="cm-set-time" type="number" min="0" max="23" step="0.25" value="12">
            <button class="cm-exec" id="cm-do-set-time">Set</button>
          </div>`,
        },
        {
          title: 'RATE',
          html: btnRow([
            { label: 'Speed × 0.25', cmd: 'slomo 0.25' },
            { label: 'Speed × 1', cmd: 'slomo 1' },
            { label: 'Speed × 2', cmd: 'slomo 2' },
            { label: 'Speed × 5', cmd: 'slomo 5' },
          ]),
        },
        {
          title: 'RAW CLOCK',
          html: inputRow({
            label: 'Seconds', labelFor: 'cm-time-seconds',
            inputs: [num('cm-time-seconds', { value: 0, min: 0, step: 60 })],
            btns: [
              { label: 'Set (no events)', cmd: 'SetTimeCheat {#cm-time-seconds} false', multi: true },
              { label: 'Set (fire events)', cmd: 'SetTimeCheat {#cm-time-seconds} true', multi: true },
            ],
          }) + note('SetTimeCheat takes seconds into the cycle; the events flag replays day-section transitions.'),
        },
        {
          title: 'READOUTS',
          html: btnRow([
            { label: 'Time', cmd: 'PrintTime' },
            { label: 'Day', cmd: 'PrintDay' },
            { label: 'Day Section', cmd: 'PrintDaySection' },
            { label: 'Section Remaining', cmd: 'PrintRemainingDaySectionTime' },
            { label: 'Cycle Remaining', cmd: 'PrintRemainingDayCycleTime' },
            { label: 'Cycle Duration', cmd: 'PrintCompleteCycleDuration' },
          ]),
        },
      ],
    },

    // =====================================================================
    {
      id: 'teleport', label: 'Teleport',
      sections: [
        {
          title: 'TO A PLAYER',
          html: `
          <div class="cm-row">
            <label for="cm-tp-subject">Move player</label>
            <select class="cm-select" id="cm-tp-subject"><option value="">(none)</option></select>
            <button class="cm-exec" id="cm-tp-player">Teleport to target</button>
          </div>
          <div class="cm-meta" id="cm-tp-meta">Sends the chosen player to whoever "Apply to" names.</div>`,
        },
        {
          title: 'TO A PLACE',
          html: `
          <div class="cm-row">
            <label>Tile</label>
            <input class="cm-input cm-input--sm" id="cm-tile-x" type="number" placeholder="East" value="128">
            <input class="cm-input cm-input--sm" id="cm-tile-y" type="number" placeholder="North" value="128">
            <button class="cm-exec" id="cm-tp-tile">Teleport</button>
          </div>
          <div class="cm-row">
            <label>World</label>
            <input class="cm-input cm-input--sm" id="cm-world-x" type="number" placeholder="X">
            <input class="cm-input cm-input--sm" id="cm-world-y" type="number" placeholder="Y">
            <input class="cm-input cm-input--sm" id="cm-world-z" type="number" placeholder="Z">
            <button class="cm-exec" id="cm-tp-world">Teleport</button>
          </div>`
            + note('World teleport with Z left blank traces down to the ground.'),
        },
        {
          title: 'BOOKMARKS',
          html:
            row(text('cm-bm-name', { placeholder: 'name this spot' }),
                '<button class="cm-exec" id="cm-bm-save">Save here</button>') +
            '<div id="cm-bm-list"></div>' +
            note('Saved per browser profile. "Save here" reads the current position of the '
               + 'target player out of the Pos transcript, so the world has to answer first.'),
        },
        {
          title: 'PICK ON MAP',
          html:
            `<div class="cm-row"><button class="cm-exec" id="cm-map-picker">Open map picker</button></div>` +
            note('Opens the world map with the fog revealed (view only — the real fog grid is untouched) '
               + 'and every POI showing. Click a tile to land on its centre; the layer buttons pick Ground, '
               + 'Sky or Underground, and a tile without that layer refuses rather than dropping you in fill.'),
        },
        {
          title: 'TO AN ENTITY',
          html: inputRow({
            label: 'Entity', labelFor: 'cm-tp-entity',
            inputs: [num('cm-tp-entity', { placeholder: 'id' }), AIM_BTN],
            btns: [{ label: 'Teleport to entity', cmd: 'TeleportToEntity {v} {p}', input: 'cm-tp-entity' }],
          }) + note('Use the Diagnostics tab to find entity ids near you.'),
        },
      ],
    },

    // =====================================================================
    {
      id: 'enemies', label: 'Enemies',
      // Everything about putting enemies in the world and taking them out again.
      // The AI gym (GymSpawn / GymAbility / GymForceIntent / …) is deliberately
      // absent: that is an AI-lab rig driven from the console during AI work, not
      // a "put the world in state X" cheat.
      sections: [
        {
          title: 'SPAWN',
          html: `
          <div class="cm-row">
            <label for="cm-creature-filter">Filter</label>
            <input class="cm-input" id="cm-creature-filter" placeholder="type to filter…">
          </div>
          <div class="cm-row">
            <label for="cm-creature">Enemy</label>
            <select class="cm-select" id="cm-creature"><option value="">(catalog loading…)</option></select>
          </div>
          <div class="cm-row">
            <button class="cm-exec" id="cm-spawn-creature">Spawn</button>
            <button class="cm-exec" id="cm-spawn-creature-5">Spawn ×5</button>
            <span class="cm-readout" id="cm-creature-readout">0 creatures</span>
          </div>`
            + note('Spawns in front of the target player.'),
        },
        {
          title: 'BEHAVIOUR',
          html:
            btnRow([
              // No {p}: Docile takes an ENABLED flag, not a player number, and
              // defaults to -1 = toggle. Passing the target player would read as
              // "1" and only ever turn it on. Labelled for what the pill reports:
              // ON means docile, i.e. no aggro.
              { label: 'Toggle No Aggro', cmd: 'Docile', state: 'bDocile',
                title: 'Enemies still patrol, investigate noises and turn to look at you, but never acquire a target, chase or attack. Session-wide — AI runs on the listen-server, so this affects everyone.' },
            ]) +
            btnRow([
              { label: 'Toggle HP Bars', cmd: 'EnemyHealthBars', state: 'bEnemyHealthBars' },
              { label: 'Toggle Nameplates', cmd: 'AIStateNameplates', state: 'bAiNameplates' },
            ]),
        },
        {
          title: 'DESTROY',
          html:
            btnRow([
              { label: 'Destroy aimed', cmd: 'DestroyTarget {p}', danger: true,
                title: 'Destroys whatever the crosshair is on.' },
            ]) +
            inputRow({
              label: 'Radius', labelFor: 'cm-kill-radius',
              inputs: [num('cm-kill-radius', { value: 2000, min: 100, step: 500 })],
              btns: [
                { label: 'Kill all in radius', cmd: 'KillAll {p} {#cm-kill-radius}', danger: true },
                { label: 'Remove drops', cmd: 'RemoveDrops {p} {#cm-kill-radius}', danger: true },
              ],
            }),
        },
        {
          title: 'DAMAGE',
          html:
            inputRow({
              label: 'Amount', labelFor: 'cm-damage',
              inputs: [num('cm-damage', { value: 25, min: 1, step: 25 })],
              btns: [
                { label: 'Damage aimed', cmd: 'DamageTarget {v} {p}', input: 'cm-damage' },
                { label: 'Damage nearest', cmd: 'DamageEntity {v} {p}', input: 'cm-damage' },
              ],
            }) +
            inputRow({
              label: 'Stagger', labelFor: 'cm-stagger-enemy',
              inputs: [num('cm-stagger-enemy', { value: 50, min: 1, step: 10 })],
              btns: [{ label: 'Stagger nearest', cmd: 'Stagger {v} {p}', input: 'cm-stagger-enemy',
                title: 'Nearest non-player character. Needs a StaggerProfile on the target.' }],
            }),
        },
        {
          title: 'BOTS',
          html: inputRow({
            label: 'Profile', labelFor: 'cm-bot-profile',
            inputs: [
              '<select class="cm-select cm-input--sm" id="cm-bot-profile"><option value="">(none)</option></select>',
              num('cm-bot-distance', { value: 1000, min: 100, step: 100, placeholder: 'distance' }),
            ],
            btns: [{ label: 'Spawn Bot', cmd: 'SpawnBot {#cm-bot-profile} {#cm-bot-distance}', multi: true }],
          }),
        },
      ],
    },

    // =====================================================================
    {
      id: 'diag', label: 'Diagnostics',
      sections: [
        {
          title: 'ENTITY DEBUG',
          html: `
          <div class="cm-row">
            <label for="cm-entity-id">Entity</label>
            <input class="cm-input cm-input--sm" id="cm-entity-id" type="number" placeholder="id">
            <button class="cm-exec" data-aim-fill title="Fill from whatever the crosshair is on">⌖ aim</button>
            <button class="cm-exec" data-cmd-tpl-input="FindEntity {v}" data-input="cm-entity-id">Find</button>
            <button class="cm-exec" data-cmd-tpl-input="InspectEntity {v}" data-input="cm-entity-id">Inspect</button>
            <button class="cm-exec" data-cmd-tpl-input="TeleportToEntity {v} {p}" data-input="cm-entity-id">Teleport To</button>
          </div>
          <div class="cm-row">
            <label for="cm-list-radius">List r</label>
            <input class="cm-input cm-input--sm" id="cm-list-radius" type="number" value="5000">
            <button class="cm-exec" data-cmd-tpl-input="ListEntities {v} {p}" data-input="cm-list-radius">List Nearby</button>
          </div>`,
        },
        {
          title: 'WORLD / CHUNKS',
          html:
            btnRow([
              { label: 'Chunk Info', cmd: 'ChunkInfo' },
              { label: 'Layout Diagnostic', cmd: 'LayoutDiagnostic' },
              { label: 'Print Entity Count', cmd: 'PrintEntityNum' },
            ]) +
            btnRow([
              { label: 'Toggle Entity Naming', cmd: 'EntityNaming', state: 'bEntityNaming' },
              { label: 'Toggle Chunk Debug', cmd: 'ToggleDebugChunks' },
              { label: 'Chunk debug on', cmd: 'DebugChunks true' },
              { label: 'Chunk debug off', cmd: 'DebugChunks false' },
            ]) +
            btnRow([
              { label: 'Fix Input Capture', cmd: 'FixInputCapture',
                title: 'Re-asserts input mode + viewport focus. Fixes lost mouse capture in scripted/MCP-launched PIE.' },
            ]),
        },
        {
          title: 'AI RECORDING',
          html:
            inputRow({
              label: 'Name', labelFor: 'cm-ai-rec-name',
              inputs: [text('cm-ai-rec-name', { placeholder: 'recording name' })],
              btns: [{ label: 'Start', cmd: 'AiDebugStartRecord {v}', input: 'cm-ai-rec-name' }],
            }) +
            inputRow({
              label: 'Seconds', labelFor: 'cm-ai-rec-secs',
              inputs: [num('cm-ai-rec-secs', { value: 10, min: 1 })],
              btns: [{ label: 'Record N sec', cmd: 'AiDebugRecord {#cm-ai-rec-secs} {#cm-ai-rec-name}', multi: true }],
            }) +
            btnRow([{ label: 'Stop', cmd: 'AiDebugStopRecord' }]) +
            inputRow({
              label: 'Detection', labelFor: 'cm-detect',
              inputs: [num('cm-detect', { value: 0.5, min: 0, max: 1, step: 0.1 })],
              btns: [
                { label: 'Test', cmd: 'TestDetection {v}', input: 'cm-detect' },
                { label: 'Sting', cmd: 'TestDetectionSting' },
              ],
            }) +
            note('Writes Saved/AiDebug/aidebug-<name>-<stamp>.html and opens it.'),
        },
        {
          title: 'BUG REPORTS',
          html:
            btnRow([
              { label: 'Open Bug Report', cmd: 'OpenBugReport' },
              { label: 'Test Bug Report', cmd: 'TestBugReport' },
              { label: 'Status', cmd: 'BugReportStatus' },
              { label: 'Update Crash Context', cmd: 'UpdateCrashContext' },
            ]) +
            inputRow({
              label: 'Action', labelFor: 'cm-record-action',
              inputs: [text('cm-record-action', { value: 'CheatCommand' })],
              btns: [{ label: 'Record test action', cmd: 'RecordTestAction {v}', input: 'cm-record-action' }],
            }),
        },
        {
          title: 'AUDIO',
          html:
            row(label('Filter', 'cm-audio-filter'), text('cm-audio-filter', { placeholder: 'type to filter…' })) +
            inputRow({
              label: 'Slot', labelFor: 'cm-audio-slot',
              inputs: ['<select class="cm-select" id="cm-audio-slot"><option value="">(catalog loading…)</option></select>'],
              btns: [{ label: 'Play slot', cmd: 'PlaySlot {v}', input: 'cm-audio-slot' }],
            }) +
            row('<span class="cm-readout" id="cm-audio-readout">0 slots</span>'),
        },
        {
          title: 'PERF / UI',
          html:
            btnRow([
              { label: 'stat fps', cmd: 'stat fps' },
              { label: 'stat unit', cmd: 'stat unit' },
              { label: 'Component Pool', cmd: 'TSIC.ComponentPool.Dump' },
              { label: 'Presence Dump', cmd: 'TSIC.Presence.Dump' },
              { label: 'Presence Refresh', cmd: 'TSIC.Presence.Refresh' },
            ]) +
            btnRow([
              { label: 'WebUI Reload', cmd: 'WebUI.Reload' },
              { label: 'WebUI Purge Cache', cmd: 'WebUI.PurgeCache' },
              { label: 'Screenshot', cmd: 'HighResShot 1920x1080' },
            ]),
        },
      ],
    },
  ];

  // ------------------------------------------------------------ F2-F5 keys
  // Clicking (or typing/selecting) anywhere in a section arms that section's
  // shortlist onto F2-F5, so the panel can be closed and the same four cheats
  // driven from the keyboard mid-play. Keyed by "<tab>/<SECTION TITLE>".
  //
  // `cmd` templates go through the same expandFull() as the buttons, so a bound
  // key picks up the current target player, the selected item/furniture/creature
  // and every input value at the moment it is pressed — not at bind time.
  // `run` names one of the bespoke handlers instead (the pickers whose commands
  // are assembled in JS rather than from a template).
  //
  // Destructive cheats are deliberately absent: an F-key is a one-press,
  // no-confirm surface, and the panel's own arm-then-fire guard cannot apply.
  const SECTION_KEYS = {
    'player/MODES': [
      { label: 'God', cmd: 'ScpGod {p}' },
      { label: 'Ghost', cmd: 'ScpGhost {p}' },
      { label: 'Fly', cmd: 'ScpFly {p}' },
      { label: 'Creative', cmd: 'Creative {p}' },
    ],
    'player/HEALTH': [
      { label: 'Heal', cmd: 'Heal {p}' },
      { label: 'Hurt', cmd: 'Hurt {#cm-hurt} {p}' },
      { label: 'Set HP', cmd: 'SetHealth {#cm-sethealth} {p}' },
      { label: 'Stagger', cmd: 'Stagger {#cm-stagger} {p}' },
    ],
    'player/HUNGER': [
      { label: 'Clear', cmd: 'Hunger 0 {p}' },
      { label: 'Hungry', cmd: 'Hunger 1 {p}' },
      { label: 'Starving', cmd: 'Hunger 2 {p}' },
    ],
    'player/READOUTS': [
      { label: 'Position', cmd: 'Pos {p}' },
      { label: 'Inventory', cmd: 'PrintInventory {p}' },
      { label: 'Credits', cmd: 'DumpResearchCredits' },
    ],
    'items/ITEM GRANT': [
      { label: 'Give selected', run: 'give' },
    ],
    'items/SELECTED ITEM': [
      { label: 'Eat', cmd: 'Eat {i} {p}' },
      { label: 'Craft', cmd: 'CraftItem {i} {p}' },
      { label: 'Drop', cmd: 'DropItem {i} {#cm-item-op-count} {p}' },
      { label: 'Remove', cmd: 'RemoveItem {i} {#cm-item-op-count} {p}' },
    ],
    'items/BULK': [
      { label: 'All items', cmd: 'GiveAllItems {#cm-bulk-count} {p}' },
      { label: 'All food', cmd: 'GiveAllFood {#cm-bulk-count} {p}' },
      { label: 'All furniture', cmd: 'GiveAllFurniture {#cm-bulk-count} {p}' },
      { label: 'Construction kit', cmd: 'GiveConstructionItems' },
    ],
    'build/SPAWN FURNITURE': [
      { label: 'Spawn', run: 'spawnFurniture' },
      { label: 'Carry', run: 'constructFurniture' },
      { label: 'Place', cmd: 'ConstructAndPlace {f}' },
    ],
    'build/AIMED FURNITURE': [
      { label: 'Upgrade', cmd: 'UpgradeFurniture {p}' },
      { label: 'Upgrade items', cmd: 'GiveUpgradeItems {#cm-upgrade-mult} {p}' },
      { label: 'Health bars', cmd: 'ShowFurnitureHealth' },
    ],
    'build/STATIONS': [
      { label: 'Crafting bench', cmd: 'SpawnTestCraftingBench' },
    ],
    'enemies/SPAWN': [
      { label: 'Spawn 1', run: 'spawnCreature' },
      { label: 'Spawn 5', run: 'spawnCreature5' },
    ],
    'enemies/BEHAVIOUR': [
      { label: 'No aggro', cmd: 'Docile' },
      { label: 'HP bars', cmd: 'EnemyHealthBars' },
      { label: 'Nameplates', cmd: 'AIStateNameplates' },
    ],
    'enemies/DESTROY': [
      { label: 'Destroy aimed', cmd: 'DestroyTarget {p}' },
      { label: 'Kill all', cmd: 'KillAll {p} {#cm-kill-radius}' },
      { label: 'Remove drops', cmd: 'RemoveDrops {p} {#cm-kill-radius}' },
    ],
    'enemies/DAMAGE': [
      { label: 'Damage aimed', cmd: 'DamageTarget {#cm-damage} {p}' },
      { label: 'Damage nearest', cmd: 'DamageEntity {#cm-damage} {p}' },
      { label: 'Stagger nearest', cmd: 'Stagger {#cm-stagger-enemy} {p}' },
    ],
    'enemies/BOTS': [
      { label: 'Spawn bot', cmd: 'SpawnBot {#cm-bot-profile} {#cm-bot-distance}' },
    ],
    'world/FOG OF WAR': [
      { label: 'Hide fog', cmd: 'HideFOW {p}' },
      { label: 'Minimap off', cmd: 'SetFogOfWarVisible 0' },
      { label: 'Minimap on', cmd: 'SetFogOfWarVisible 1' },
    ],
    'world/INTERACT': [
      { label: 'Interact', cmd: 'InteractWithEntity {#cm-interact-entity} {p}' },
    ],
    'world/SESSION': [
      { label: 'Hide loading', cmd: 'HideLoadingScreen' },
      { label: 'List packs', cmd: 'ListDefinitionPacks' },
    ],
    'time/SKIP': [
      { label: 'Skip hours', run: 'skipHours' },
      { label: 'Skip days', run: 'skipDays' },
      { label: 'To open', cmd: 'SkipOpen' },
      { label: 'To closed', cmd: 'SkipClosed' },
    ],
    'time/RATE': [
      { label: 'Quarter speed', cmd: 'slomo 0.25' },
      { label: 'Normal', cmd: 'slomo 1' },
      { label: 'Double', cmd: 'slomo 2' },
      { label: 'Five times', cmd: 'slomo 5' },
    ],
    'time/RAW CLOCK': [
      { label: 'Set quiet', cmd: 'SetTimeCheat {#cm-time-seconds} false' },
      { label: 'Set + events', cmd: 'SetTimeCheat {#cm-time-seconds} true' },
    ],
    'time/READOUTS': [
      { label: 'Time', cmd: 'PrintTime' },
      { label: 'Day', cmd: 'PrintDay' },
      { label: 'Section', cmd: 'PrintDaySection' },
      { label: 'Remaining', cmd: 'PrintRemainingDaySectionTime' },
    ],
    'teleport/TO A PLAYER': [
      { label: 'Move to target', run: 'teleportPlayer' },
    ],
    'teleport/TO A PLACE': [
      { label: 'To tile', run: 'teleportTile' },
      { label: 'To world XYZ', run: 'teleportWorld' },
    ],
    'teleport/TO AN ENTITY': [
      { label: 'To entity', cmd: 'TeleportToEntity {#cm-tp-entity} {p}' },
    ],
    'diag/ENTITY DEBUG': [
      { label: 'Find', cmd: 'FindEntity {#cm-entity-id}' },
      { label: 'Inspect', cmd: 'InspectEntity {#cm-entity-id}' },
      { label: 'Teleport to', cmd: 'TeleportToEntity {#cm-entity-id} {p}' },
      { label: 'List nearby', cmd: 'ListEntities {#cm-list-radius} {p}' },
    ],
    'diag/WORLD / CHUNKS': [
      { label: 'Chunk info', cmd: 'ChunkInfo' },
      { label: 'Layout', cmd: 'LayoutDiagnostic' },
      { label: 'Entity count', cmd: 'PrintEntityNum' },
      { label: 'Entity naming', cmd: 'EntityNaming' },
    ],
    'diag/AI RECORDING': [
      { label: 'Start', cmd: 'AiDebugStartRecord {#cm-ai-rec-name}' },
      { label: 'Stop', cmd: 'AiDebugStopRecord' },
      { label: 'Record N sec', cmd: 'AiDebugRecord {#cm-ai-rec-secs} {#cm-ai-rec-name}' },
      { label: 'Detection', cmd: 'TestDetection {#cm-detect}' },
    ],
    'diag/BUG REPORTS': [
      { label: 'Open form', cmd: 'OpenBugReport' },
      { label: 'Status', cmd: 'BugReportStatus' },
    ],
    'diag/AUDIO': [
      { label: 'Play slot', cmd: 'PlaySlot {#cm-audio-slot}' },
    ],
    'diag/PERF / UI': [
      { label: 'stat fps', cmd: 'stat fps' },
      { label: 'stat unit', cmd: 'stat unit' },
      { label: 'WebUI reload', cmd: 'WebUI.Reload' },
      { label: 'Screenshot', cmd: 'HighResShot 1920x1080' },
    ],
  };

  const KEY_LABELS = ['F2', 'F3', 'F4', 'F5'];

  // ------------------------------------------------- local console commands
  // A cheat declares for itself whether it is client-local: C++ marks the
  // machine-local ones BlueprintCosmetic and the router reads the flag off the
  // UFUNCTION, so the panel never has to know (and can never get it wrong).
  //
  // These are the lines that are NOT cheats — plain console commands and cvars,
  // with no UFUNCTION to carry a flag. Every one of them describes or acts on
  // the machine it runs on, so sent to the host a client got the host's frame
  // counter, purged the host's caches and screenshotted the host's screen.
  //
  // C++ treats the resulting bClientLocal as a hint and ignores it for anything
  // that does resolve to a cheat function, so a mistake here cannot pull a
  // server-authoritative cheat off the server.
  const LOCAL_CONSOLE_COMMANDS = [
    'stat ',                  // per-machine perf overlays
    'highresshot',            // screenshots this window
    'webui.',                 // this machine's CEF views and caches
    'scpmods.purgecache',     // this machine's mod cache
    'tsic.componentpool.',    // this machine's pools
    'tsic.presence.',         // this machine's rich presence
  ];

  function isLocalConsoleCommand(cmd) {
    const c = String(cmd || '').trim().toLowerCase();
    return LOCAL_CONSOLE_COMMANDS.some((p) => c === p.trim() || c.startsWith(p));
  }

  // ----------------------------------------------------------------- style
  const STYLE = `
    /* Side panel, not a full-screen wall: half the viewport so the world stays
       visible while you cheat at it, and no scrim over the other half.

       Clicks in the clear half still do NOT reach the game, which is the point:
       screen-manager's .tsic-overlay is inset:0 / pointer-events:auto, and on the
       Slate side SWebInterface::GetViewportVisibility only returns HitTestInvisible
       when mouse transparency is enabled — TSIC leaves UWebInterface's
       bEnableMouseTransparency at its false default, so the CEF layer is always
       EVisibility::Visible and swallows every button. Do not "fix" the clear half
       by putting pointer-events:none on the overlay or this root; that is what
       would let mouse buttons fall through to the world. */
    [data-screen="CheatMenu"] #cm-root {
      position:fixed; top:0; right:0; bottom:0;
      /* One section wide. Two columns made this a half-screen wall; a single
         column reads as a tool panel and leaves the game visible. */
      width: clamp(400px, 30vw, 560px);
      background: rgba(30,26,20,0.50);
      /* No backdrop-filter. It would only blur what is inside the CEF surface —
         the HUD — and never the world, which is composited underneath the web
         texture and is not available to the filter. It would cost a full-panel
         blur every frame to achieve almost nothing, and it makes any browser
         preview flatter this panel than the game does. Legibility comes from the
         section backing instead. */
      border-left: 3px solid var(--ink-night, #14110c);
      box-shadow: -8px 0 24px rgba(0,0,0,0.35);
      padding: 12px 16px 14px; overflow:hidden; color: var(--cat-ink-dark);
      pointer-events:auto; display:flex; flex-direction:column; gap:10px;
    }
    [data-screen="CheatMenu"] #cm-root h2 { color: #c2410c; margin: 0; }
    [data-screen="CheatMenu"] #cm-status { font-size: 12px; font-weight:bold; letter-spacing:2px; text-transform:uppercase; padding:4px 8px; border:1px solid var(--tsic-border); display:inline-block; }
    [data-screen="CheatMenu"] #cm-status.is-ready { color: #86efac; border-color:#86efac; }
    [data-screen="CheatMenu"] #cm-status.is-pending { color: #fca5a5; border-color:#fca5a5; }

    /* Header: title, live status and the target player, which every tab reads. */
    [data-screen="CheatMenu"] #cm-header { display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:0 0 auto; }
    [data-screen="CheatMenu"] #cm-header .cm-spacer { flex:1 1 auto; }
    [data-screen="CheatMenu"] #cm-header label { font-size: 11px; color: rgba(255,253,247,0.75); letter-spacing:1px; text-transform:uppercase; }
    /* Half-width leaves no room for the display face at full size. */
    [data-screen="CheatMenu"] #cm-header h2 { font-size: 26px; }
    [data-screen="CheatMenu"] #cm-header .cm-select { min-width: 150px; }
    [data-screen="CheatMenu"] #cm-header .tsic-button { min-height:0; padding: 4px 12px; font-size: 14px; border-width:2px; }

    /* Rail + panels fill the remaining height; only the panel scrolls. */
    [data-screen="CheatMenu"] #cm-body { flex:1 1 auto; display:flex; gap:12px; min-height:0; }
    [data-screen="CheatMenu"] #cm-tabs { flex:0 0 108px; display:flex; flex-direction:column; gap:3px; }
    [data-screen="CheatMenu"] .cm-tab {
      text-align:left; padding:6px 8px; font-size:12px; letter-spacing:1px; text-transform:uppercase;
      font-family: var(--font-display, inherit); cursor:pointer;
      background: rgba(255,253,247,0.62); color: var(--cat-ink-dark); border:1px solid var(--tsic-border);
    }
    [data-screen="CheatMenu"] .cm-tab:hover { background: rgba(255,253,247,0.92); }
    [data-screen="CheatMenu"] .cm-tab.is-active { background: var(--mag-yellow, #f5c518); font-weight:bold; }
    [data-screen="CheatMenu"] .cm-tab-count { float:right; opacity:0.5; font-size:11px; }

    /* The panel is the only scroller. Give it a visible track so it reads as
       scrollable at a glance — a hairline overlay bar over a translucent panel
       is easy to miss. */
    [data-screen="CheatMenu"] #cm-panels { flex:1 1 auto; overflow-y:scroll; min-width:0; padding-right:4px; }
    [data-screen="CheatMenu"] #cm-panels::-webkit-scrollbar { width: 10px; }
    [data-screen="CheatMenu"] #cm-panels::-webkit-scrollbar-track { background: rgba(20,17,12,0.35); border:1px solid rgba(20,17,12,0.5); }
    [data-screen="CheatMenu"] #cm-panels::-webkit-scrollbar-thumb { background: var(--mag-yellow, #f5c518); border:1px solid var(--ink-night, #14110c); }
    [data-screen="CheatMenu"] #cm-panels::-webkit-scrollbar-thumb:hover { background: #fff; }
    [data-screen="CheatMenu"] .cm-panel { display:none; }
    [data-screen="CheatMenu"] .cm-panel.is-active { display:block; }

    [data-screen="CheatMenu"] .cm-grid { display:grid; grid-template-columns: 1fr; gap: 10px; align-items:start; }
    /* Sections keep enough paper behind them to stay readable over a bright
       world; the panel's blur does the rest of the work. */
    [data-screen="CheatMenu"] .cm-section { border:1px solid var(--tsic-border); padding: 9px 11px; background: rgba(252,249,241,0.72); }
    [data-screen="CheatMenu"] .cm-section h3 { letter-spacing: 3px; color: rgba(59,47,28,0.7); font-size: 12px; margin: 0 0 8px; text-transform: uppercase; }
    [data-screen="CheatMenu"] .cm-section[data-keys] { cursor: pointer; }
    /* The armed section owns F2-F5. Outline + a lifted paper so it reads as
       "this one is live" from across the panel. */
    [data-screen="CheatMenu"] .cm-section.is-armed {
      outline: 3px solid var(--mag-yellow, #f5c518); outline-offset: -1px;
      background: rgba(255,252,238,0.9);
      box-shadow: 0 0 0 1px var(--ink-night, #14110c), 0 4px 14px rgba(0,0,0,0.35);
    }
    [data-screen="CheatMenu"] .cm-section.is-armed h3 { color: var(--ink-night, #14110c); }
    [data-screen="CheatMenu"] .cm-section.is-armed h3::after {
      content: ' — F2-F5'; color: #a16207; letter-spacing: 1px;
    }

    /* Which cheats the function keys currently fire. */
    [data-screen="CheatMenu"] #cm-keys {
      flex:0 0 auto; display:flex; gap:6px; align-items:center; flex-wrap:wrap;
      font-size: 11px; color: var(--paper-bright, #fffdf3);
      background: rgba(20,17,12,0.55); border:1px solid var(--ink-night, #14110c);
      padding: 4px 8px;
    }
    [data-screen="CheatMenu"] #cm-keys .cm-key-hint { opacity: 0.6; }
    [data-screen="CheatMenu"] #cm-keys .cm-key {
      display:inline-flex; gap:4px; align-items:baseline;
      border:1px solid rgba(255,253,247,0.35); padding: 1px 6px;
    }
    [data-screen="CheatMenu"] #cm-keys .cm-key b {
      font-family: var(--font-display, inherit); letter-spacing:1px; color: var(--mag-yellow, #f5c518); font-weight:400;
    }
    [data-screen="CheatMenu"] .cm-row { display:flex; flex-wrap:wrap; gap: 6px; align-items:center; margin-bottom: 6px; }
    [data-screen="CheatMenu"] .cm-row label { font-size: 11px; color: rgba(59,47,28,0.7); min-width: 62px; }
    /* Opaque, not transparent: these sit over a live game (and the header ones over
       a dark panel), where a see-through control is unreadable. */
    [data-screen="CheatMenu"] .cm-input { background: var(--paper-bright, #fffdf3); color: var(--ink-night, #14110c); border:1px solid var(--tsic-border); padding: 2px 6px; width: 132px; min-width: 0; flex: 0 0 auto; font-family: inherit; }
    [data-screen="CheatMenu"] .cm-input--sm { width: 64px; }
    [data-screen="CheatMenu"] .cm-select { background: var(--paper-bright, #fffdf3); color: var(--ink-night, #14110c); border:1px solid var(--tsic-border); padding: 2px 4px; width: 100%; max-width: 260px; min-width: 0; flex: 1 1 auto; font-family: inherit; }
    [data-screen="CheatMenu"] .cm-select option { background: var(--paper-bright, #fffdf3); color: var(--ink-night, #14110c); }
    [data-screen="CheatMenu"] .cm-exec { background:#7c2d12; color: #fdf6e3; border:1px solid #c2410c; padding: 3px 10px; cursor:pointer; font-size: 12px; }
    [data-screen="CheatMenu"] .cm-toggle { display:inline-flex; gap:4px; align-items:center; font-size: 12px; cursor:pointer; user-select:none; }
    [data-screen="CheatMenu"] .cm-toggle input { margin:0; }
    [data-screen="CheatMenu"] .cm-readout { font-size: 11px; color: rgba(59,47,28,0.7); margin-left:auto; }
    [data-screen="CheatMenu"] .cm-meta { font-size: 11px; color: rgba(59,47,28,0.6); margin-top: 6px; }

    /* The panel is dense enough now that .tsic-button's 40px controller size
       would cost more rows than it buys — dev density beats thumb targets here. */
    [data-screen="CheatMenu"] .cm-section .tsic-button {
      min-height: 0; padding: 4px 10px; font-size: 13px; gap: 5px; border-width: 2px;
    }

    /* Live toggle state (UI.Cheat.State). The indicator is a ::after pill rather
       than appended text so the buttons keep the label the tests match on. */
    [data-screen="CheatMenu"] button[data-state-key]::after {
      content: 'OFF'; margin-left: 6px; font-size: 9px; letter-spacing: 1px;
      padding: 0 4px; border:1px solid currentColor; opacity: 0.45;
    }
    /* The pill carries the state, not the label colour — .tsic-button is
       paper-on-red, so recolouring its text makes it unreadable. */
    [data-screen="CheatMenu"] button[data-state-key].cm-on::after {
      content: 'ON'; opacity: 1; background: var(--mag-yellow); color: var(--ink-night);
      border-color: var(--ink-night); font-weight: bold;
    }
    [data-screen="CheatMenu"] button[data-state-key].cm-on {
      box-shadow: inset 0 0 0 3px var(--mag-yellow), var(--shadow-block, 4px 4px 0 var(--ink-night));
    }
    [data-screen="CheatMenu"] button[data-state-key].cm-state-unknown::after { content: '?'; opacity: 0.3; }

    /* Destructive commands: one click arms, a second within 2s fires. The armed
       state has to be unmissable, since the second click is the irreversible one. */
    [data-screen="CheatMenu"] .cm-danger.cm-armed {
      background: var(--mag-yellow, #f5c518); color: var(--ink-night, #14110c);
    }
    [data-screen="CheatMenu"] .cm-danger.cm-armed::after {
      content: ' — click again'; font-size: 10px; letter-spacing: 0;
    }

    [data-screen="CheatMenu"] #cm-search-row { flex:0 0 auto; margin:0; }
    [data-screen="CheatMenu"] #cm-search { width: 100%; flex: 1 1 auto; }
    [data-screen="CheatMenu"] #cm-search-row .cm-readout { color: rgba(255,253,247,0.7); }
    [data-screen="CheatMenu"] #cm-search-results { flex:0 0 auto; max-height: 190px; overflow-y:auto; }
    [data-screen="CheatMenu"] #cm-search-results:empty { display:none; }
    [data-screen="CheatMenu"] .cm-hit {
      display:flex; gap:8px; align-items:baseline; width:100%; text-align:left;
      font: inherit; font-size: 12px; cursor:pointer; padding: 3px 6px;
      background: rgba(255,253,247,0.82); color: var(--ink-night, #14110c);
      border:1px solid var(--tsic-border); border-bottom:none;
    }
    [data-screen="CheatMenu"] .cm-hit:last-child { border-bottom:1px solid var(--tsic-border); }
    [data-screen="CheatMenu"] .cm-hit:hover { background: var(--mag-yellow, #f5c518); }
    [data-screen="CheatMenu"] .cm-hit .cm-hit-where { margin-left:auto; opacity:0.55; font-size: 10px; text-transform:uppercase; letter-spacing:1px; }
    [data-screen="CheatMenu"] #cm-header .cm-toggle { color: var(--paper-bright, #fffdf3); }

    [data-screen="CheatMenu"] .cm-bookmark { display:flex; gap:6px; align-items:center; margin-bottom:4px; }
    [data-screen="CheatMenu"] .cm-bookmark span { flex:1 1 auto; font-size:11px; }

    /* Console transcript (UI.Cheat.Log) — newest last, scrolled to the bottom. */
    [data-screen="CheatMenu"] #cm-log {
      flex:0 0 auto; max-height: 150px; overflow-y: auto; font-size: 11px;
      border:1px solid var(--tsic-border); background: rgba(28,25,20,0.82); color:#e7e2d4;
      padding: 6px 8px; white-space: pre-wrap; word-break: break-word;
    }
    [data-screen="CheatMenu"] #cm-log:empty { display:none; }
    [data-screen="CheatMenu"] .cm-log-cmd { color:#fb923c; }
    [data-screen="CheatMenu"] .cm-log-out { color:#cfd8c5; }
    [data-screen="CheatMenu"] .cm-log-entry { margin-bottom: 4px; }
  `;

  // Count the commands in a tab so the rail can show how much lives behind it.
  function countCommands(tab) {
    let n = 0;
    for (const s of tab.sections) {
      n += (s.html.match(/data-cmd-tpl=|data-cmd-tpl-input=|data-cmd-multi=|data-cmd-danger=|id="cm-give"|id="cm-spawn-|id="cm-construct-furn"|id="cm-tp-|id="cm-do-/g) || []).length;
    }
    return n;
  }

  const TEMPLATE = `
    <div id="cm-root">
      <div id="cm-header">
        <h2 class="tsic-title tsic-title--lg">Cheat Menu</h2>
        <div id="cm-status" class="is-pending">Loading cheats…</div>
        <span class="cm-spacer"></span>
        <label for="cm-target">Apply to</label>
        <select class="cm-select" id="cm-target" data-tsic-initial-focus><option value="0">Me</option></select>
        <label class="cm-toggle" id="cm-all-players-wrap" title="Run every command once per connected player instead of just the target.">
          <input type="checkbox" id="cm-all-players"> all
        </label>
        <button class="tsic-button" id="btn-back">Close</button>
      </div>

      <div class="cm-row" id="cm-search-row">
        <input class="cm-input" id="cm-search" type="search" placeholder="search all commands…">
        <span class="cm-readout" id="cm-search-readout"></span>
      </div>
      <div id="cm-search-results"></div>

      <div id="cm-keys"><span class="cm-key-hint">Click a section to bind its cheats to F2-F5.</span></div>

      <div id="cm-body">
        <div id="cm-tabs" role="tablist">
          ${TABS.map((t, i) => `<button class="cm-tab${i === 0 ? ' is-active' : ''}" role="tab" data-tab="${esc(t.id)}">${esc(t.label)}<span class="cm-tab-count">${countCommands(t)}</span></button>`).join('')}
        </div>
        <div id="cm-panels">
          ${TABS.map((t, i) => `
            <div class="cm-panel${i === 0 ? ' is-active' : ''}" data-panel="${esc(t.id)}">
              <div class="cm-grid">
                ${t.sections.map((s) => {
                  const key = `${t.id}/${s.title}`;
                  const hasKeys = Array.isArray(SECTION_KEYS[key]) && SECTION_KEYS[key].length > 0;
                  return `<div class="cm-section"${hasKeys ? ` data-keys="${esc(key)}"` : ''}><h3>${esc(s.title)}</h3>${s.html}</div>`;
                }).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div id="cm-log"></div>
    </div>
  `;

  function injectStyleOnce() {
    if (document.getElementById('screen-cheat-menu-style')) return;
    const s = document.createElement('style');
    s.id = 'screen-cheat-menu-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  const TAB_STORAGE_KEY = 'tsic.cheatMenu.tab';

  // Set by mount(), called by onShow() — see the note there.
  let pendingStateRefresh = null;

  TSIC.registerScreen('CheatMenu', {
    inputModeTag: 'InputMode.Menu.CheatMenu',
    // Not UI.Cmd.GameScreen.Close: that hardcodes InGame, which strands you in an
    // unloaded world when the panel was opened from the main menu. The toggle
    // command closes to wherever it was opened from.
    cancelCmd: 'UI.Cmd.Pause.CheatMenu',
    actionBarContext: [],
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();

      // Local state — populated from UI.Cheat.Catalog and UI.Players.List.
      const state = {
        catalog: null,       // FScpUICheatCatalog payload
        players: [],         // [{Id,Name,bIsHost}, ...]
        // 1-based player number, or 0 for "whoever is running this panel". 0 is the
        // default because the panel is open on clients too: a literal 1 means index 0
        // of the server's player array, so every cheat a client ran would land on the
        // host instead of on them.
        targetPlayer: 0,
      };

      const $ = (id) => root.querySelector('#' + id);
      const val = (id) => { const el = $(id); return el ? String(el.value).trim() : ''; };

      function shortName(full) {
        if (!full) return '';
        const i = full.lastIndexOf('/');
        return i >= 0 ? full.slice(i + 1) : full;
      }

      function formatEntry(item) {
        const short = shortName(item.InternalName);
        return item.DisplayName ? `${item.DisplayName} [${short}]` : short;
      }

      function exec(cmd) {
        if (!cmd) return;
        ctx.publish('UI.Cmd.Cheat.Execute', { Command: cmd, bClientLocal: isLocalConsoleCommand(cmd) });
      }

      // "all" re-runs the command once per connected player, substituting each in
      // turn. Only commands that actually carry a player number fan out — running
      // e.g. `SkipDays 1` four times would skip four days, so a template without
      // {p} is sent exactly once.
      function execForTargets(template, expand) {
        const all = $('cm-all-players') && $('cm-all-players').checked;
        const players = state.players || [];
        if (!all || players.length < 2 || template.indexOf('{p}') < 0) {
          exec(expand(template));
          return;
        }
        const saved = state.targetPlayer;
        for (let i = 1; i <= players.length; i++) {
          state.targetPlayer = i;
          exec(expand(template));
        }
        state.targetPlayer = saved;
      }

      // {p} target player. Only this token is allowed on data-cmd-tpl buttons —
      // an E2E test clicks every one and asserts the exact resulting string.
      function expandTemplate(tpl) {
        return tpl.replaceAll('{p}', String(state.targetPlayer)).trim();
      }

      // The richer token set, for buttons that read inputs and pickers. Empty
      // inputs collapse so a trailing optional argument just falls off the end
      // and the cheat's own default applies.
      function expandFull(tpl) {
        return tpl
          .replaceAll('{p}', String(state.targetPlayer))
          .replaceAll('{i}', shortName(val('cm-item')))
          .replaceAll('{f}', shortName(val('cm-furn')))
          .replaceAll('{c}', val('cm-creature'))
          .replace(/\{#([a-zA-Z0-9_-]+)\}/g, (m, id) => val(id))
          .replace(/\s+/g, ' ')
          .trim();
      }

      // Ask C++ for a fresh UI.Cheat.State. Also tells it which player the panel is
      // showing, so the re-broadcast after each cheat reads that same player.
      function requestState() {
        ctx.publish('UI.Cmd.Cheat.RequestState', { PlayerNum: state.targetPlayer });
      }

      // -------------- TABS --------------

      function selectTab(id) {
        let matched = false;
        root.querySelectorAll('.cm-tab').forEach((t) => {
          const on = t.getAttribute('data-tab') === id;
          t.classList.toggle('is-active', on);
          matched = matched || on;
        });
        if (!matched) return;
        root.querySelectorAll('.cm-panel').forEach((p) => {
          p.classList.toggle('is-active', p.getAttribute('data-panel') === id);
        });
        $('cm-panels').scrollTop = 0;
        try { localStorage.setItem(TAB_STORAGE_KEY, id); } catch (e) { /* private mode */ }
      }

      root.querySelectorAll('.cm-tab').forEach((t) => {
        t.addEventListener('click', () => selectTab(t.getAttribute('data-tab')));
      });

      // -------------- F2-F5 SECTION BINDING --------------

      // Bespoke commands the templates can't express — the pickers whose argument
      // order is assembled in JS. Declared before armSection so the banner can
      // name them; the functions themselves are hoisted below.
      const RUNNERS = {
        give:               () => onGive(),
        spawnCreature:      () => onSpawnCreature(),
        spawnCreature5:     () => { for (let n = 0; n < 5; n++) onSpawnCreature(); },
        spawnFurniture:     () => onSpawnFurniture('place'),
        constructFurniture: () => onSpawnFurniture('construct'),
        teleportPlayer:     () => onTeleportPlayer(),
        teleportTile:       () => onTeleportTile(),
        teleportWorld:      () => onTeleportWorld(),
        skipDays:           () => { const v = parseInt(val('cm-skip-days'), 10); if (Number.isFinite(v)) exec(`SkipDays ${v}`); },
        skipHours:          () => { const v = parseFloat(val('cm-skip-hours')); if (Number.isFinite(v)) exec(`SkipHours ${v}`); },
      };

      let armedKey = null;

      function renderKeyBar() {
        const bar = $('cm-keys');
        if (!bar) return;
        bar.innerHTML = '';
        const binds = armedKey ? SECTION_KEYS[armedKey] : null;
        if (!binds) {
          const hint = document.createElement('span');
          hint.className = 'cm-key-hint';
          hint.textContent = 'Click a section to bind its cheats to F2-F5.';
          bar.appendChild(hint);
          return;
        }
        const who = document.createElement('span');
        who.className = 'cm-key-hint';
        // Says what the bar IS, not which section armed it — the armed section is
        // already outlined and captioned "— F2-F5", so repeating its name here just
        // read as a stray word ("MODES:") with no obvious meaning.
        who.textContent = 'Hotkeys:';
        bar.appendChild(who);
        binds.slice(0, KEY_LABELS.length).forEach((bind, i) => {
          const chip = document.createElement('span');
          chip.className = 'cm-key';
          const k = document.createElement('b');
          k.textContent = KEY_LABELS[i];
          chip.appendChild(k);
          chip.appendChild(document.createTextNode(bind.label));
          bar.appendChild(chip);
        });
      }

      function armSection(key) {
        if (!key || !SECTION_KEYS[key]) return;
        armedKey = key;
        root.querySelectorAll('.cm-section[data-keys]').forEach((sec) => {
          sec.classList.toggle('is-armed', sec.getAttribute('data-keys') === key);
        });
        renderKeyBar();
      }

      // Arm on any interaction inside the section — a click, a dropdown change or
      // tabbing into a field all mean "I am working in here now".
      root.querySelectorAll('.cm-section[data-keys]').forEach((sec) => {
        const key = sec.getAttribute('data-keys');
        const arm = () => armSection(key);
        sec.addEventListener('mousedown', arm);
        sec.addEventListener('focusin', arm);
        sec.addEventListener('change', arm);
      });

      // The bound cheat resolves at PRESS time, so it picks up whatever the panel
      // is set to now — target player, selected creature, input values.
      function fireKeySlot(index) {
        const binds = armedKey ? SECTION_KEYS[armedKey] : null;
        const bind = binds && binds[index];
        if (!bind) return;
        if (bind.run) {
          const runner = RUNNERS[bind.run];
          if (runner) runner();
          return;
        }
        exec(expandFull(bind.cmd));
      }

      KEY_LABELS.forEach((_, i) => {
        ctx.on(`tsic.msg.UI.Behavior.CheatSlot${i + 1}`, (e) => {
          if (e && e.Phase !== 'Started') return;
          fireKeySlot(i);
        });
      });

      // -------------- SEARCH --------------

      // One box over every command in every tab. Built from the live DOM rather
      // than a parallel index, so a command can never be listed here and missing
      // from its section (or the reverse).
      function commandIndex() {
        const out = [];
        root.querySelectorAll('.cm-panel').forEach((panel) => {
          const tab = panel.getAttribute('data-panel');
          panel.querySelectorAll('button[data-cmd-tpl], button[data-cmd-tpl-input], button[data-cmd-multi], button[data-cmd-danger]')
            .forEach((btnEl) => {
              const cmd = btnEl.getAttribute('data-cmd-tpl') || btnEl.getAttribute('data-cmd-tpl-input')
                       || btnEl.getAttribute('data-cmd-multi') || btnEl.getAttribute('data-cmd-danger') || '';
              const section = btnEl.closest('.cm-section');
              out.push({
                label: (btnEl.textContent || '').trim(),
                cmd,
                tab,
                section: section ? (section.querySelector('h3').textContent || '').trim() : '',
                btn: btnEl,
              });
            });
        });
        return out;
      }

      function runSearch() {
        const box = $('cm-search');
        const host = $('cm-search-results');
        if (!box || !host) return;
        const q = box.value.trim().toLowerCase();
        host.innerHTML = '';
        if (!q) { $('cm-search-readout').textContent = ''; return; }
        const hits = commandIndex().filter((h) =>
          h.label.toLowerCase().includes(q) || h.cmd.toLowerCase().includes(q));
        $('cm-search-readout').textContent = hits.length + ' match' + (hits.length === 1 ? '' : 'es');
        hits.slice(0, 40).forEach((h) => {
          const b = document.createElement('button');
          b.className = 'cm-hit';
          b.type = 'button';
          const name = document.createElement('span');
          name.textContent = h.label;
          const where = document.createElement('span');
          where.className = 'cm-hit-where';
          where.textContent = h.tab + ' · ' + h.section;
          b.appendChild(name);
          b.appendChild(where);
          // Jump to it rather than firing from here: a search hit that runs a cheat
          // on click is one stray Enter away from an accident.
          b.addEventListener('click', () => {
            selectTab(h.tab);
            const sec = h.btn.closest('.cm-section');
            if (sec) {
              sec.scrollIntoView({ block: 'nearest' });
              if (sec.hasAttribute('data-keys')) armSection(sec.getAttribute('data-keys'));
            }
            h.btn.focus({ preventScroll: true });
          });
          host.appendChild(b);
        });
      }

      // -------------- BOOKMARKS --------------

      const BM_KEY = 'tsic.cheatMenu.bookmarks';

      function loadBookmarks() {
        try { return JSON.parse(localStorage.getItem(BM_KEY) || '[]') || []; }
        catch (e) { return []; }
      }
      function saveBookmarks(list) {
        try { localStorage.setItem(BM_KEY, JSON.stringify(list.slice(0, 40))); } catch (e) { /* private mode */ }
      }

      function renderBookmarks() {
        const host = $('cm-bm-list');
        if (!host) return;
        host.innerHTML = '';
        loadBookmarks().forEach((bm, i) => {
          const rowEl = document.createElement('div');
          rowEl.className = 'cm-bookmark';
          const label = document.createElement('span');
          label.textContent = `${bm.name} (${Math.round(bm.x)}, ${Math.round(bm.y)}, ${Math.round(bm.z)})`;
          const go = document.createElement('button');
          go.className = 'cm-exec';
          go.textContent = 'Go';
          go.addEventListener('click', () =>
            exec(`TeleportToLocation ${state.targetPlayer} ${bm.x} ${bm.y} ${bm.z}`));
          const del = document.createElement('button');
          del.className = 'tsic-button';
          del.textContent = '×';
          del.addEventListener('click', () => {
            const list = loadBookmarks();
            list.splice(i, 1);
            saveBookmarks(list);
            renderBookmarks();
          });
          rowEl.appendChild(label);
          rowEl.appendChild(go);
          rowEl.appendChild(del);
          host.appendChild(rowEl);
        });
      }

      // "Save here" runs Pos and waits for the transcript line it produces, because
      // the panel has no other view of where the player is. Armed for one reply
      // only, so an unrelated later Pos does not overwrite a name.
      let pendingBookmarkName = null;

      function tryCaptureBookmark(output) {
        if (!pendingBookmarkName || !output) return false;
        // "Player 1 position: X=182450.00, Y=241300.00, Z=1350.00"
        const m = /X=(-?[\d.]+),\s*Y=(-?[\d.]+),\s*Z=(-?[\d.]+)/i.exec(output);
        if (!m) return false;
        const list = loadBookmarks();
        list.unshift({
          name: pendingBookmarkName,
          x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]),
        });
        saveBookmarks(list);
        pendingBookmarkName = null;
        renderBookmarks();
        return true;
      }

      // -------------- TOGGLE STATE --------------

      // Buttons stay buttons (they run a toggle cheat); the ON/OFF pill beside the
      // label is the readback. Until the first UI.Cheat.State arrives every toggle
      // shows "?" rather than claiming OFF — an unknown state is not an off state.
      function applyCheatState(p) {
        root.querySelectorAll('button[data-state-key]').forEach((btn) => {
          const key = btn.getAttribute('data-state-key');
          const known = !!p && Object.prototype.hasOwnProperty.call(p, key);
          btn.classList.toggle('cm-state-unknown', !known);
          btn.classList.toggle('cm-on', known && !!p[key]);
        });
      }

      // -------------- CONSOLE LOG --------------

      const LOG_MAX_ENTRIES = 60;

      function appendLog(entry) {
        const pane = $('cm-log');
        if (!pane || !entry) return;
        const rowEl = document.createElement('div');
        rowEl.className = 'cm-log-entry';
        const cmd = document.createElement('div');
        cmd.className = 'cm-log-cmd';
        cmd.textContent = '> ' + (entry.Command || '');
        rowEl.appendChild(cmd);
        // Most cheats print nothing — a bare echo is the correct, quiet result.
        const output = (entry.Output || '').replace(/\s+$/, '');
        if (output) {
          const out = document.createElement('div');
          out.className = 'cm-log-out';
          out.textContent = output;
          rowEl.appendChild(out);
        }
        pane.appendChild(rowEl);
        while (pane.childElementCount > LOG_MAX_ENTRIES) pane.removeChild(pane.firstElementChild);
        pane.scrollTop = pane.scrollHeight;
      }

      // -------------- DROPDOWN POPULATION --------------

      function listForMode(mode) {
        const c = state.catalog;
        if (!c) return [];
        switch (mode) {
          case 'GiveItem':                    return c.Items || [];
          case 'EquipItem':                   return c.Items || [];
          case 'GiveAllFurniture':            return [];   // no item picker
          case 'GiveConstructionItem':        return c.ConstructionItems || [];
          case 'GiveConstructionItemAndCost': return c.ConstructionItems || [];
          case 'GiveRecipeIngredients':       return c.Recipes || [];
          case 'GiveEquippable':              return c.Equippables || [];
          case 'GiveWeapon':                  return c.Weapons || [];
          case 'GiveHeadGear':                return c.HeadGear || [];
          case 'GiveBodyArmor':               return c.BodyArmor || [];
          case 'GiveLegArmor':                return c.LegArmor || [];
          case 'GiveShoes':                   return c.Shoes || [];
          case 'GiveGloves':                  return c.Gloves || [];
          default:                            return [];
        }
      }

      function fillSelect(selectEl, items, filter) {
        const f = (filter || '').toLowerCase();
        selectEl.innerHTML = '';
        let visibleCount = 0;
        for (const it of items) {
          const display = it.DisplayName || '';
          const internal = it.InternalName || '';
          if (f && !display.toLowerCase().includes(f) && !shortName(internal).toLowerCase().includes(f)) {
            continue;
          }
          const opt = document.createElement('option');
          opt.value = internal;
          opt.textContent = formatEntry(it);
          selectEl.appendChild(opt);
          visibleCount++;
        }
        return { visibleCount, totalCount: items.length };
      }

      function refreshItemSelect() {
        const mode = $('cm-mode').value;
        const list = listForMode(mode);
        const filter = $('cm-item-filter').value;
        const { visibleCount, totalCount } = fillSelect($('cm-item'), list, filter);
        $('cm-item-readout').textContent = `${visibleCount} / ${totalCount} items`;
        $('cm-item').disabled = (mode === 'GiveAllFurniture');
        $('cm-item-filter').disabled = (mode === 'GiveAllFurniture');
      }

      function refreshCreatureSelect() {
        const list = (state.catalog && state.catalog.Creatures) || [];
        const filter = $('cm-creature-filter').value;
        const { visibleCount, totalCount } = fillSelect($('cm-creature'), list, filter);
        $('cm-creature-readout').textContent = `${visibleCount} / ${totalCount} creatures`;
      }

      // The three catalogues that aren't item/furniture lists. Each is a plain
      // name list — DisplayName and InternalName are the same string — so a
      // shared filler keeps them honest rather than three near-copies.
      function fillNameSelect(selectId, list, readoutId, noun, filterId) {
        const sel = $(selectId);
        if (!sel) return;
        const prev = sel.value;
        const filter = filterId ? ($(filterId) ? $(filterId).value : '') : '';
        const { visibleCount, totalCount } = fillSelect(sel, list || [], filter);
        if (prev) sel.value = prev;
        if (!sel.value && sel.options.length) sel.selectedIndex = 0;
        if (readoutId && $(readoutId)) {
          $(readoutId).textContent = filterId
            ? `${visibleCount} / ${totalCount} ${noun}`
            : `${totalCount} ${noun}`;
        }
        // An empty list means the settings/pack carry none — say so rather than
        // leaving a silently unusable dropdown.
        if (sel.options.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = `(no ${noun})`;
          sel.appendChild(opt);
        }
      }

      function refreshAuxSelects() {
        const c = state.catalog || {};
        fillNameSelect('cm-item-set', c.ItemSets, null, 'item sets');
        fillNameSelect('cm-bot-profile', c.BotProfiles, null, 'bot profiles');
        fillNameSelect('cm-audio-slot', c.AudioSlots, 'cm-audio-readout', 'slots', 'cm-audio-filter');
      }

      function refreshFurnitureSelect() {
        const wantConstructed = $('cm-furn-constructed').checked;
        const list = state.catalog
          ? (wantConstructed ? (state.catalog.FurnitureConstructed || []) : (state.catalog.FurnitureDefault || []))
          : [];
        const filter = $('cm-furn-filter').value;
        const { visibleCount, totalCount } = fillSelect($('cm-furn'), list, filter);
        $('cm-furn-readout').textContent = `${visibleCount} / ${totalCount} furniture`;
      }

      function playerLabel(pl, num) {
        return `${num}: ${pl.Name || pl.Id || '?'}${pl.bIsHost ? ' (host)' : ''}`;
      }

      function refreshTargetPlayerSelects() {
        const list = state.players || [];
        const targetSel = $('cm-target');
        // The subject is who gets MOVED; the destination is the "Apply to" target,
        // so the subject list drops the destination — nobody teleports to themselves.
        const subjectSel = $('cm-tp-subject');
        const prevTarget = targetSel.value;
        const prevSubject = subjectSel.value;
        targetSel.innerHTML = '';
        subjectSel.innerHTML = '';
        // "Me" is always first and is the default. It resolves server-side to the
        // controller that sent the cheat, which is the only way a client can target
        // itself — it has no way to know its own index in the server's player array.
        const me = document.createElement('option');
        me.value = '0';
        me.textContent = 'Me';
        targetSel.appendChild(me);
        if (list.length === 0) {
          const opt2 = document.createElement('option');
          opt2.value = '';
          opt2.textContent = '(no other players)';
          subjectSel.appendChild(opt2);
          refreshTeleportLabel();
          return;
        }
        list.forEach((pl, idx) => {
          const num = idx + 1;
          const opt = document.createElement('option');
          opt.value = String(num);
          opt.textContent = playerLabel(pl, num);
          targetSel.appendChild(opt);
          // Nobody teleports to themselves, so the subject list drops the destination.
          // With "Me" selected there is no index to drop — the panel cannot tell which
          // entry is itself — so every player stays available.
          if (num !== state.targetPlayer) {
            const opt2 = document.createElement('option');
            opt2.value = String(num);
            opt2.textContent = playerLabel(pl, num);
            subjectSel.appendChild(opt2);
          }
        });
        if (prevTarget) targetSel.value = prevTarget;
        if (prevSubject) subjectSel.value = prevSubject;
        if (!targetSel.value && targetSel.options.length) targetSel.selectedIndex = 0;
        refreshTeleportLabel();
      }

      // Name the destination on the button — with two dropdowns in play, "Teleport"
      // alone doesn't say which way round the move goes.
      function refreshTeleportLabel() {
        if (state.targetPlayer === 0) {
          $('cm-tp-player').textContent = 'Teleport to me';
          $('cm-tp-meta').textContent = 'Sends the chosen player to you.';
          return;
        }
        const dest = (state.players || [])[state.targetPlayer - 1];
        const name = dest && (dest.Name || dest.Id);
        $('cm-tp-player').textContent = name ? `Teleport to ${name}` : 'Teleport to target';
        $('cm-tp-meta').textContent = name
          ? `Sends the chosen player to ${name} (player ${state.targetPlayer}).`
          : 'Sends the chosen player to whoever "Apply to" names.';
      }

      // -------------- COMMAND HANDLERS --------------

      function onGive() {
        const mode = $('cm-mode').value;
        const qty = parseInt($('cm-item-count').value, 10) || 1;
        const p = state.targetPlayer;
        if (mode === 'GiveAllFurniture') {
          exec(`GiveAllFurniture ${qty} ${p}`);
          return;
        }
        const itemName = shortName($('cm-item').value);
        if (!itemName) return;
        switch (mode) {
          case 'GiveItem':                    exec(`GiveItem ${itemName} ${qty} ${p}`); break;
          case 'EquipItem':                   exec(`EquipItem ${itemName} ${p}`); break;
          case 'GiveConstructionItem':        exec(`GiveConstructionItem ${itemName} ${qty} ${p}`); break;
          case 'GiveConstructionItemAndCost': exec(`GiveConstructionItemAndCost ${itemName} ${qty} ${p}`); break;
          case 'GiveRecipeIngredients':       exec(`GiveRecipeIngredients ${itemName} ${qty} ${p}`); break;
          case 'GiveEquippable':              exec(`GiveEquippable ${itemName} ${qty} ${p}`); break;
          case 'GiveWeapon':                  exec(`GiveWeapon ${itemName} ${qty} ${p}`); break;
          case 'GiveHeadGear':                exec(`GiveHeadGear ${itemName} ${qty} ${p}`); break;
          case 'GiveBodyArmor':               exec(`GiveBodyArmor ${itemName} ${qty} ${p}`); break;
          case 'GiveLegArmor':                exec(`GiveLegArmor ${itemName} ${qty} ${p}`); break;
          case 'GiveShoes':                   exec(`GiveShoes ${itemName} ${qty} ${p}`); break;
          case 'GiveGloves':                  exec(`GiveGloves ${itemName} ${qty} ${p}`); break;
        }
      }

      function onSpawnCreature() {
        const name = $('cm-creature').value;
        if (!name) return;
        // WorldCheats::Spawn expects an FName, which can be the asset path.
        exec(`Spawn ${name} ${state.targetPlayer}`);
      }

      function onSpawnFurniture(kind) {
        const name = shortName($('cm-furn').value);
        if (!name) return;
        exec(kind === 'construct' ? `Construct ${name}` : `SpawnFurniture ${name}`);
      }

      // UTeleportCheats::TeleportPlayer(From, To) moves From to To, so the subject
      // dropdown is the first argument and the "Apply to" target is the second.
      function onTeleportPlayer() {
        const from = parseInt($('cm-tp-subject').value, 10);
        if (!Number.isFinite(from) || from === state.targetPlayer) return;
        exec(`TeleportPlayer ${from} ${state.targetPlayer}`);
      }

      function onTeleportTile() {
        const x = parseInt($('cm-tile-x').value, 10);
        const y = parseInt($('cm-tile-y').value, 10);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        exec(`TeleportToTile ${state.targetPlayer} ${x} ${y}`);
      }

      function onTeleportWorld() {
        const x = parseFloat($('cm-world-x').value);
        const y = parseFloat($('cm-world-y').value);
        const z = parseFloat($('cm-world-z').value) || 0;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        exec(`TeleportToLocation ${state.targetPlayer} ${x} ${y} ${z}`);
      }

      // -------------- BIND --------------

      // The catalogue only builds where the cheat manager exists and the pack is
      // loaded, so its arrival doubles as the "cheats are live here" signal. It reaches
      // clients too now — a client's buttons route to the host, so the panel no longer
      // has a disabled mode to sit in.
      ctx.on('tsic.msg.UI.Cheat.Catalog', (p) => {
        state.catalog = p || null;
        refreshItemSelect();
        refreshCreatureSelect();
        refreshFurnitureSelect();
        refreshAuxSelects();
        $('cm-status').textContent = 'Cheats active';
        $('cm-status').classList.remove('is-pending');
        $('cm-status').classList.add('is-ready');
      });
      ctx.on('tsic.msg.UI.Players.List', (p) => {
        state.players = (p && p.Players) || [];
        refreshTargetPlayerSelects();
      });
      ctx.on('tsic.msg.UI.Cheat.State', applyCheatState);
      ctx.on('tsic.msg.UI.Cheat.Log', (p) => {
        // A pending bookmark consumes the Pos reply; the line is still shown.
        tryCaptureBookmark(p && p.Output);
        appendLog(p);
      });

      // Item Grant — mode / filter / give.
      $('cm-mode').addEventListener('change', refreshItemSelect);
      $('cm-item-filter').addEventListener('input', refreshItemSelect);
      $('cm-give').addEventListener('click', onGive);

      // Target player.
      $('cm-target').addEventListener('change', (e) => {
        // Not `|| 0` after parseInt — "Me" is the value 0, and `0 || fallback` would
        // throw the selection away every time it is picked.
        const picked = parseInt(e.target.value, 10);
        state.targetPlayer = Number.isFinite(picked) ? picked : 0;
        refreshTargetPlayerSelects();
        requestState();
      });

      // Spawn creature.
      $('cm-creature-filter').addEventListener('input', refreshCreatureSelect);
      $('cm-spawn-creature').addEventListener('click', onSpawnCreature);
      if ($('cm-spawn-creature-5')) {
        $('cm-spawn-creature-5').addEventListener('click', () => {
          for (let n = 0; n < 5; n++) onSpawnCreature();
        });
      }

      // Spawn furniture.
      $('cm-furn-constructed').addEventListener('change', refreshFurnitureSelect);
      $('cm-furn-filter').addEventListener('input', refreshFurnitureSelect);
      $('cm-spawn-furn').addEventListener('click', () => onSpawnFurniture('place'));
      $('cm-construct-furn').addEventListener('click', () => onSpawnFurniture('construct'));

      const searchBox = $('cm-search');
      if (searchBox) searchBox.addEventListener('input', runSearch);

      const allPlayers = $('cm-all-players');
      if (allPlayers) allPlayers.addEventListener('change', () => {
        // Fanning out is only meaningful with somebody else in the session.
        if (allPlayers.checked && (state.players || []).length < 2) allPlayers.checked = false;
      });

      const bmSave = $('cm-bm-save');
      if (bmSave) {
        bmSave.addEventListener('click', () => {
          const name = val('cm-bm-name') || `Spot ${loadBookmarks().length + 1}`;
          pendingBookmarkName = name;
          $('cm-bm-name').value = '';
          exec(`Pos ${state.targetPlayer}`);
        });
      }

      // Aim-to-fill: ask what the crosshair is on and drop the id into every
      // entity field, so no id ever has to be read out of a log and retyped.
      root.querySelectorAll('button[data-aim-fill]').forEach((btnEl) => {
        btnEl.addEventListener('click', () => ctx.publish('UI.Cmd.Cheat.AimEntity', {}));
      });
      ctx.on('tsic.msg.UI.Cheat.AimTarget', (p) => {
        const id = p && p.EntityId;
        if (!id) {
          appendLog({ Command: '(aim)', Output: 'Nothing addressable under the crosshair.' });
          return;
        }
        ['cm-entity-id', 'cm-tp-entity', 'cm-interact-entity'].forEach((f) => {
          if ($(f)) $(f).value = String(id);
        });
        appendLog({ Command: '(aim)', Output: `Entity ${id}${p.Label ? ' — ' + p.Label : ''}` });
      });

      const audioFilter = $('cm-audio-filter');
      if (audioFilter) audioFilter.addEventListener('input', refreshAuxSelects);

      // Map teleport picker — C++ opens the map with {"mode":"teleport"} so the
      // whole decision of what that means stays on one side.
      const mapPicker = $('cm-map-picker');
      if (mapPicker) {
        mapPicker.addEventListener('click', () => ctx.publish('UI.Cmd.Cheat.MapPicker', {}));
      }

      // Teleport.
      $('cm-tp-player').addEventListener('click', onTeleportPlayer);
      $('cm-tp-tile').addEventListener('click', onTeleportTile);
      $('cm-tp-world').addEventListener('click', onTeleportWorld);

      // Time.
      $('cm-do-skip-days').addEventListener('click', () => {
        const v = parseInt($('cm-skip-days').value, 10);
        if (Number.isFinite(v)) exec(`SkipDays ${v}`);
      });
      $('cm-do-skip-hours').addEventListener('click', () => {
        const v = parseFloat($('cm-skip-hours').value);
        if (Number.isFinite(v)) exec(`SkipHours ${v}`);
      });
      $('cm-do-set-time').addEventListener('click', () => {
        const v = parseFloat($('cm-set-time').value);
        if (Number.isFinite(v)) exec(`SetTime ${v}`);
      });

      // Fixed-command buttons ({p} only — see expandTemplate).
      root.querySelectorAll('button[data-cmd-tpl]').forEach((btnEl) => {
        btnEl.addEventListener('click', () =>
          execForTargets(btnEl.getAttribute('data-cmd-tpl'), expandTemplate));
      });
      // Single-input buttons: skip silently when the input is empty, since the
      // command would otherwise run against a missing argument.
      root.querySelectorAll('button[data-cmd-tpl-input]').forEach((btnEl) => {
        btnEl.addEventListener('click', () => {
          const tpl = btnEl.getAttribute('data-cmd-tpl-input');
          const v = val(btnEl.getAttribute('data-input'));
          if (!v) return;
          execForTargets(tpl.replaceAll('{v}', v), expandTemplate);
        });
      });
      // Multi-input buttons: {#id} plus the picker tokens.
      root.querySelectorAll('button[data-cmd-multi]').forEach((btnEl) => {
        btnEl.addEventListener('click', () => {
          const cmd = expandFull(btnEl.getAttribute('data-cmd-multi'));
          // Every template starts with the verb, so a bare verb means every
          // argument resolved empty — running it would hit cheat defaults the
          // caller did not ask for.
          if (!cmd || cmd.indexOf(' ') < 0) {
            const tpl = btnEl.getAttribute('data-cmd-multi');
            if (/[{]/.test(tpl)) return;
          }
          execForTargets(btnEl.getAttribute('data-cmd-multi'), expandFull);
        });
      });
      // Destructive buttons: arm on first click, fire on the second within 2s.
      root.querySelectorAll('button[data-cmd-danger]').forEach((btnEl) => {
        let timer = null;
        const disarm = () => {
          btnEl.classList.remove('cm-armed');
          if (timer) { clearTimeout(timer); timer = null; }
        };
        btnEl.addEventListener('click', () => {
          if (btnEl.classList.contains('cm-armed')) {
            disarm();
            exec(expandFull(btnEl.getAttribute('data-cmd-danger')));
            return;
          }
          btnEl.classList.add('cm-armed');
          timer = setTimeout(disarm, 2000);
        });
      });

      // Close.
      $('btn-back').addEventListener('click', () => ctx.publish('UI.Cmd.Pause.CheatMenu', {}));

      // First paint — show placeholder lists until the broadcast lands.
      refreshItemSelect();
      refreshCreatureSelect();
      refreshFurnitureSelect();
      refreshAuxSelects();
      refreshTargetPlayerSelects();
      applyCheatState(null);
      renderKeyBar();
      renderBookmarks();
      try {
        const saved = localStorage.getItem(TAB_STORAGE_KEY);
        if (saved) selectTab(saved);
      } catch (e) { /* private mode */ }

      // onShow runs outside mount()'s closure; screen-manager always mounts before
      // the first show, so this is assigned by the time onShow needs it.
      pendingStateRefresh = requestState;
    },

    onShow(/* params, ctx */) {
      // Toggles can be flipped from the console while the panel is closed, so
      // re-read on every open rather than trusting the last broadcast.
      if (pendingStateRefresh) pendingStateRefresh();
    },
  });
})();
