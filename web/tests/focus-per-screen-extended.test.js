// Focus reachability tests for the menu screens opted into the focus engine in
// the 2026-05-19 expansion that still exist: cheat-menu, mods, death-screen, paper.
//
// Each fixture seeds the channels the page needs to render its interactive
// content (so reachability has something to BFS across), then asserts:
//   A) every focusable element is reachable via 4-way nav from initial focus
//   B) every focus group is reachable from every other group
//   C) any dropdowns round-trip cleanly

function focusOpts(extraTags) {
    return { tags: ['focus', 'reachability'].concat(extraTags || []) };
}

// -- upgrade ---------------------------------------------------------------
// The Upgrade SCREEN was removed 2026-07-25: furniture upgrades now happen by looking at
// the target with a hammer equipped (UScpGameplayAbility_Upgrade), with the cost shown on
// the HUD instead of in a menu. Its focus-reachability test went with the page; the
// replacement readout is covered by tests/upgrade-hud.test.js.

// -- cheat-menu ------------------------------------------------------------
TSICTestHarness.register(Object.assign({
    name: 'Focus/CheatMenu: reachable + groups mutually reachable',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        ctx.inject('tsic.msg.UI.Cheat.Catalog', {
            Items: [
                { InternalName: 'ID_Bread', DisplayName: 'Bread' },
                { InternalName: 'ID_Wood',  DisplayName: 'Wood' },
            ],
            Creatures: [{ InternalName: 'CH_Mimic', DisplayName: 'Mimic' }],
            FurnitureDefault:     [{ InternalName: 'FD_Table',     DisplayName: 'Table' }],
            FurnitureConstructed: [{ InternalName: 'FD_TableCnstr',DisplayName: 'Constr Table' }],
            ConstructionItems:    [{ InternalName: 'CI_Table',     DisplayName: 'CI Table' }],
            Equippables:          [{ InternalName: 'ID_Axe',       DisplayName: 'Axe' }],
            Weapons:              [{ InternalName: 'ID_Axe',       DisplayName: 'Axe' }],
            HeadGear:             [{ InternalName: 'ID_Hat',       DisplayName: 'Hat' }],
            BodyArmor:            [{ InternalName: 'ID_Coat',      DisplayName: 'Coat' }],
            LegArmor:             [{ InternalName: 'ID_Pants',     DisplayName: 'Pants' }],
            Shoes:                [{ InternalName: 'ID_Boots',     DisplayName: 'Boots' }],
            Gloves:               [{ InternalName: 'ID_Gloves',    DisplayName: 'Gloves' }],
        });
        ctx.inject('tsic.msg.UI.Players.List', { Players: [
            { PlayerId: 1, Name: 'Ziggy',  bIsHost: true },
            { PlayerId: 2, Name: 'Friend', bIsHost: false },
        ] });
        await TSICTestHarness.fx.runReachability(ctx);
    },
}, focusOpts()));

// -- mods ------------------------------------------------------------------
TSICTestHarness.register(Object.assign({
    name: 'Focus/Mods: reachable + groups mutually reachable',
    file: '/screens/mods.html',
    async run(ctx) {
        // Mods page disables auth flow when no IoConfig — keeps the test
        // focused on the static button rows.
        ctx.inject('tsic.msg.UI.Mod.IoConfig', { /* empty => disabled state */ });
        ctx.inject('tsic.msg.UI.Mod.InstalledList', { Mods: [] });
        ctx.inject('tsic.msg.UI.Mod.LoadOrder', { Order: [] });
        await TSICTestHarness.fx.runReachability(ctx);
    },
}, focusOpts()));

// -- death-screen ----------------------------------------------------------
TSICTestHarness.register(Object.assign({
    name: 'Focus/DeathScreen: reachable + groups mutually reachable',
    file: '/screens/death-screen.html',
    async run(ctx) { await TSICTestHarness.fx.runReachability(ctx); },
}, focusOpts()));

// (No interaction entry: the live interaction prompt (hud-interaction.js) is
// a display-only label inside the behavior-bar panel — nothing focusable.)

// -- paper (uses lore.js, label "Lore / Paper" in the playground) ---------
TSICTestHarness.register(Object.assign({
    name: 'Focus/Paper: reachable + groups mutually reachable',
    file: '/screens/paper.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.LoreScreen.Opened', {
            ScreenKind: 'Paper',
            Texts: [
                { Heading: 'The Store', Body: 'In the beginning…' },
                { Heading: 'The Stock', Body: 'Items drift…' },
            ],
            InitialIndex: 0,
        });
        await TSICTestHarness.fx.runReachability(ctx);
    },
}, focusOpts()));
