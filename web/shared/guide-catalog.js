// shared/guide-catalog.js — content for the Overview handbook (Tab).
//
// The C++ tutorial system owns WHETHER a step is done; this file owns what a
// step LOOKS like — which chapter it belongs to, how it is phrased, which
// picture stands for it, and what to go and find in the world. Splitting it
// that way keeps the wording, the grouping and the artwork editable inside the
// mod, with no engine build, while completion stays server-authoritative.
//
// Step ids are the Tutorial.Step.* tag leaves that arrive on UI.Tutorial.State.
// A step id listed here that the game never sends is skipped; a step the game
// sends that is listed nowhere lands in the "More to do" chapter rather than
// disappearing, so adding a step in C++ can never silently lose it from the
// handbook.
//
// Artwork per entry, in priority order:
//   item:  '<definition id>'  → the real item thumbnail, via /tex/item-icon
//   glyph: '<category key>'   → an inline stroke glyph from TSIC.CATEGORY_ICON_PATHS
// An item id with no authored thumbnail resolves to the cardboard-box fallback,
// which is why the two stations that have no icon yet (repair bench, teleporter)
// are drawn as glyphs instead.
(function () {
  window.TSIC = window.TSIC || {};

  var CHAPTERS = [
    {
      id: 'shift',
      title: 'Opening Shift',
      blurb: 'Get a tool in your hands before the lights go down.',
      steps: [
        {
          step: 'OpenCraftingBench',
          title: 'Find a crafting bench',
          hint: 'Benches are scattered through the back rooms and staff areas. Walk up and interact.',
          item: 'ID_CraftingTableTierOne_CI',
          find: ['ID_CraftingTableTierOne_CI', 'ID_WeaponBench_CI'],
        },
        {
          step: 'CraftWeapon',
          title: 'Craft your first weapon',
          hint: 'Anything is better than fists. A bat costs almost nothing and swings fast.',
          item: 'ID_DowelBat_EQ',
          find: ['ID_DowelBat_EQ', 'ID_PotMace_EQ', 'ID_SpoonSpear_EQ'],
        },
        {
          step: 'EquipWeapon',
          title: 'Put it on your hotbar',
          hint: 'Drag the weapon into a hotbar slot, then press that number to draw it.',
          item: 'ID_SledgeHammer_EQ',
        },
        {
          step: 'KillEnemy',
          title: 'Put something down',
          hint: 'Back away between swings. Almost everything in here hits harder than it looks.',
          glyph: 'summon',
        },
      ],
    },
    {
      id: 'movein',
      title: 'Move In',
      blurb: 'Pick a corner of the store and make it yours.',
      steps: [
        {
          step: 'DragFurniture',
          title: 'Drag furniture with right click',
          hint: 'Hold right click on a shelf or a crate and walk. Everything in the store moves.',
          glyph: 'cart',
        },
        {
          step: 'Construct',
          title: 'Build somewhere to hide',
          hint: 'Select a buildable from your hotbar and place it. Walls first, door second.',
          item: 'ID_Shelf_CI',
          find: ['ID_Shelf_CI', 'ID_Shelf_Double_CI'],
        },
        {
          step: 'SetSpawnPoint',
          title: 'Sleep in a bed to set your spawn',
          hint: 'Until you do, dying sends you back to where the shift started.',
          item: 'ID_Bed_Large_CI',
          find: ['ID_Bed_Large_CI', 'ID_KidsBed_CI'],
        },
      ],
    },
    {
      id: 'keeptrading',
      title: 'Keep Trading',
      blurb: 'Eat, store what you find, and live through the dark.',
      steps: [
        {
          step: 'EatFood',
          title: 'Eat something',
          hint: 'Food goes on the hotbar like a weapon — select it and use primary fire.',
          item: 'ID_Bread_CN',
        },
        {
          step: 'OpenStorage',
          title: 'Open a storage crate',
          hint: 'You are carrying too much already. Shelves, fridges and bookcases all hold stock.',
          item: 'ID_Fridge_CI',
          find: ['ID_Fridge_CI', 'ID_Shelf_CI', 'ID_TVShelf_CI'],
        },
        {
          step: 'SurviveNight',
          title: 'Survive until morning',
          hint: 'Be inside something with a door before the lights go out. Stay there.',
          glyph: 'toggle',
        },
      ],
    },
    {
      id: 'backofhouse',
      title: 'Back of House',
      blurb: 'Machines, crops and the benches that keep them running.',
      steps: [
        {
          step: 'ProduceRecipe',
          title: 'Run a recipe in a machine',
          hint: 'Ovens, furnaces and saw benches take raw stock in and give better stock back.',
          item: 'ID_Oven_CI',
          find: ['ID_Oven_CI', 'ID_Furnace_CI', 'ID_SawBench_CI', 'ID_Microwave_CI'],
        },
        {
          step: 'PlantSeed',
          title: 'Plant a seed',
          hint: 'A plant pot and a packet of seeds is a food supply that never stops.',
          item: 'ID_TomatoSeeds_SD',
          find: ['ID_TomatoSeeds_SD', 'ID_PotatoSeeds_SD', 'ID_Plant_CI'],
        },
        {
          step: 'UpgradeFurniture',
          title: 'Upgrade a piece of furniture',
          hint: 'Tier two holds more, works faster and takes more of a beating.',
          item: 'ID_Tier1Hammer_EQ',
        },
        {
          step: 'RepairItem',
          title: 'Repair your gear',
          hint: 'A repair bench trades scrap for the condition of everything you carry.',
          glyph: 'repair',
        },
        {
          step: 'UseTeleporter',
          title: 'Travel by teleporter',
          hint: 'Two linked teleporters turn the far end of the store into one step.',
          glyph: 'teleporter',
        },
      ],
    },
  ];

  // Reference cards — no completion state, always readable. These are the things
  // a player works out the hard way, written down.
  var NOTES = [
    {
      id: 'night',
      title: 'The dark is the clock',
      glyph: 'toggle',
      body: 'Everything dangerous gets braver at night. Treat sundown as a deadline: '
          + 'be behind a door you built, with light and a way out you know.',
    },
    {
      id: 'noise',
      title: 'Noise travels',
      glyph: 'production',
      body: 'Machines, dragging furniture and fighting all carry. If something is '
          + 'hunting you, stop making the sound that led it here.',
    },
    {
      id: 'weight',
      title: 'Carry less than you want to',
      glyph: 'cart',
      body: 'Weight slows you down long before it stops you. Trolleys and baskets '
          + 'exist so you can move a haul without wearing it.',
    },
    {
      id: 'death',
      title: 'Dying costs you the walk back',
      glyph: 'item',
      body: 'What you were carrying stays where you fell. Set a spawn point early '
          + 'so the walk back is short enough to survive twice.',
    },
    {
      id: 'together',
      title: 'Split up carefully',
      glyph: 'interact',
      body: 'Two players in the same room clear it in half the time. Two players on '
          + 'opposite sides of the store are two separate problems.',
    },
  ];

  TSIC.GuideCatalog = { chapters: CHAPTERS, notes: NOTES };

  /** Chapter id -> step ids, for the "unlisted steps" reconciliation the screen does. */
  TSIC.guideKnownStepIds = function () {
    var out = {};
    CHAPTERS.forEach(function (chapter) {
      chapter.steps.forEach(function (entry) { out[entry.step] = chapter.id; });
    });
    return out;
  };
})();
