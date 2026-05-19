// Per-screen focus reachability tests.
//
// For each opted-in menu screen, after seeding the page with whatever data
// makes its panels render, we assert:
//   A) every focusable element is reachable from the initial focus via 4-way
//      D-pad navigation (assertAllReachable).
//   B) every focus group is reachable from every other group
//      (assertAllGroupsMutuallyReachable).
//   C) dropdown round-trip: open, press Down, cancel, focus restored
//      (assertDropdownsRoundtrip).
//
// In jsdom these run against the engine's DOM-order fallback (no layout). In
// a Chromium runner (playwright) the spatial-nearest algorithm is exercised
// against real rects.

function focusOpts(extraTags) {
    return {
        tags: ['focus', 'reachability'].concat(extraTags || []),
    };
}

async function awaitInitialFocus(ctx, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < (timeoutMs || 2000)) {
        const active = ctx.doc.activeElement;
        if (active && active !== ctx.doc.body && active.matches && active.matches('[data-tsic-initial-focus]')) return active;
        await new Promise(r => setTimeout(r, 16));
    }
    return null;
}

async function runReachability(ctx) {
    ctx.focus.disableSmoothScroll();
    ctx.focus.resetMemory();
    ctx.mode('Gamepad');
    const got = await awaitInitialFocus(ctx);
    if (!got) {
        ctx.expect('initial focus never landed on [data-tsic-initial-focus]; activeElement=' +
            (ctx.doc.activeElement ? ctx.doc.activeElement.tagName + (ctx.doc.activeElement.id ? '#'+ctx.doc.activeElement.id : '') : 'null'));
        return;
    }
    await ctx.focus.assertAllReachable();
    await ctx.focus.assertAllGroupsMutuallyReachable();
    await ctx.focus.assertDropdownsRoundtrip();
}

// ---- Static screens (no seed data required) -----------------------------

TSICTestHarness.register(Object.assign({
    name: 'Focus/MainMenu: reachable + groups mutually reachable',
    file: '/screens/main-menu.html',
    async run(ctx) { await runReachability(ctx); },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/PauseMenu: reachable + groups mutually reachable',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Players.List', { Players: [{ Name: 'Player', bIsHost: true }] });
        await runReachability(ctx);
    },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/Credits: reachable + groups mutually reachable',
    file: '/screens/credits.html',
    async run(ctx) { await runReachability(ctx); },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/Settings: reachable + groups mutually reachable',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', { Settings: [
            { Key: 'video.fov', Label: 'FOV', Type: 'range', Min: 60, Max: 120, Step: 1, Value: 90 },
            { Key: 'audio.master', Label: 'Master Volume', Type: 'range', Min: 0, Max: 1, Step: 0.05, Value: 0.8 },
        ] });
        await runReachability(ctx);
    },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/SaveLoad: reachable + groups mutually reachable',
    file: '/screens/save-load.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Save.Slots', { Slots: [
            { SlotId: 's1', Label: 'Slot 1', TimestampIso: '2026-05-19T00:00:00Z' },
            { SlotId: 's2', Label: 'Slot 2', TimestampIso: '2026-05-19T01:00:00Z' },
        ] });
        await runReachability(ctx);
    },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/NewStore: reachable + groups mutually reachable',
    file: '/screens/new-store.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Menu.Layouts', { Layouts: [
            { LayoutId: 'a', Name: 'Layout A', ThumbnailUrl: '/__blank.png' },
            { LayoutId: 'b', Name: 'Layout B', ThumbnailUrl: '/__blank.png' },
        ] });
        ctx.inject('tsic.msg.UI.Mod.InstalledList', { Mods: [] });
        await runReachability(ctx);
    },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/QuantityPicker: reachable + groups mutually reachable',
    file: '/screens/quantity-picker.html',
    async run(ctx) { await runReachability(ctx); },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/BugReport: reachable + groups mutually reachable',
    file: '/screens/bug-report.html',
    async run(ctx) { await runReachability(ctx); },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/UniversalStorageSetup: reachable + groups mutually reachable',
    file: '/screens/universal-storage-setup.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.UniversalStorage.Groups', { GroupNames: ['Group A', 'Group B'] });
        await runReachability(ctx);
    },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/Selection: reachable + groups mutually reachable',
    file: '/screens/selection.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Selection.Opened', { Context: 'Pick', Options: [
            { OptionId: 'a', Label: 'A' },
            { OptionId: 'b', Label: 'B' },
        ] });
        await runReachability(ctx);
    },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/Cage: reachable + groups mutually reachable',
    file: '/screens/cage.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Selection.Opened', { Context: 'Cage', Options: [
            { OptionId: 'cap1', Label: 'Capture 1' },
            { OptionId: 'cap2', Label: 'Capture 2' },
        ] });
        await runReachability(ctx);
    },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/Teleporter: reachable + groups mutually reachable',
    file: '/screens/teleporter.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Teleporter.Destinations', { Destinations: [
            { EntityId: 1, Label: 'Hub', Cooldown: 0 },
            { EntityId: 2, Label: 'Far', Cooldown: 0 },
        ] });
        await runReachability(ctx);
    },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/BossSummoner: reachable + groups mutually reachable',
    file: '/screens/boss-summoner.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Boss', StationId: 1, Recipes: [
            { RecipeId: 'r1', Name: 'Ritual 1', Ingredients: [{ ItemId: 'ID_X', Count: 1 }] },
            { RecipeId: 'r2', Name: 'Ritual 2', Ingredients: [{ ItemId: 'ID_Y', Count: 1 }] },
        ] });
        await runReachability(ctx);
    },
}, focusOpts()));

TSICTestHarness.register(Object.assign({
    name: 'Focus/Construction: reachable + groups mutually reachable',
    file: '/screens/construction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.Available', { Items: [
            { Id: 'wall',  Name: 'Wall',  Category: 'Walls', Cost: [] },
            { Id: 'floor', Name: 'Floor', Category: 'Floors', Cost: [] },
        ] });
        await runReachability(ctx);
    },
}, focusOpts()));
