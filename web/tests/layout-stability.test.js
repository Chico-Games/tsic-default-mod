// Layout stability — standing guards for the boxes INSIDE a panel (issue #273).
//
// Scripts/webui-bench/layout.mjs is the instrument: it sweeps every screen at several
// viewport sizes and reports what moved. These are the cheap guards for the specific
// defects it found, so a regression fails the normal web suite rather than waiting for
// someone to remember to run the bench.
//
// All of them load /screens/in-game.html and go through ctx.screen(), because a panel's
// box comes from the shell's CSS and the standalone /screens/*.html pages do not have it.
//
// The shape of every assertion is the same: take the same measurement in two states that
// differ only in DATA, and require the box to be identical. A panel sized by its layout
// rules passes; a panel sized by whatever is in it this frame does not.

function box(el) {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}

function sameBox(ctx, a, b, label, dims) {
    for (const d of (dims || ['x', 'y', 'w', 'h'])) {
        ctx.expect(ctx.assert.eq(a[d], b[d], label + ' ' + d));
    }
}

const LONG_STATION = 'Reinforced Anomalous Containment Bench (Prototype Mk. IV)';

function recipes(n) {
    return Array.from({ length: n }, (_, i) => ({
        RecipeId: 'R_' + i,
        Name: 'Recipe ' + i,
        bDiscovered: true,
        bStationLevelSufficient: true,
        Ingredients: [{ ItemId: 'ID_Wood', Count: 1 + (i % 4) }],
        Outputs: [{ ItemId: 'ID_Plank', Count: 1 }],
        Duration: 6 + i,
    }));
}

function items(n) {
    const ids = ['ID_Wood', 'ID_Stone', 'ID_Bread', 'ID_Wheat'];
    return Array.from({ length: n }, (_, i) => ({
        ItemId: ids[i % ids.length], Count: 1 + (i % 9), InstanceId: 500 + i, GridSlot: i,
    }));
}

// ── Inventory / Storage: the weight readout ────────────────────────────────
//
// "12.3/200 kg" is wider than "—" and than "1.0/200 kg". The readout sits at the right of
// a space-between row with the yellow hovered-stack chip immediately left of it, so a
// readout sized by its digits pushed the chip sideways — the chip moving under a cursor
// that had not moved. The reservation is what this asserts.

TSICTestHarness.register({
    name: 'Layout/Inventory: the weight readout holds its box as the load changes',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' },
            ID_Stone: { Name: 'Stone', Category: 'CraftingMaterial' },
            ID_Bread: { Name: 'Bread', Category: 'Consumable' },
            ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial' },
        });
        ctx.screen('Inventory');
        const send = (list, weight) => ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', GridWidth: 8, GridHeight: 4, MaxSlots: 32,
            MaxWeight: 200, CurrentWeight: weight, Items: list,
        });

        send([], 0);
        await ctx.waitFor(() => ctx.doc.querySelector('[data-screen="Inventory"] #inv-weight-text'),
            { timeout: 4000 });
        await new Promise(r => setTimeout(r, 120));
        const emptyText = box(ctx.doc.querySelector('[data-screen="Inventory"] #inv-weight-text'));
        const emptyChip = box(ctx.doc.querySelector('[data-screen="Inventory"] #inv-stackw'));

        send(items(32), 128.4);
        await new Promise(r => setTimeout(r, 160));
        const fullText = box(ctx.doc.querySelector('[data-screen="Inventory"] #inv-weight-text'));
        const fullChip = box(ctx.doc.querySelector('[data-screen="Inventory"] #inv-stackw'));

        sameBox(ctx, emptyText, fullText, 'weight readout', ['x', 'w']);
        sameBox(ctx, emptyChip, fullChip, 'hovered-stack chip', ['x', 'w']);
    },
});

// ── Production: the details block ──────────────────────────────────────────
//
// Selecting a recipe used to grow #p-info from one line to ~219px and push the Add button
// and the whole queue down 197px. The queue row under the cursor became a different row
// between the press and the release.

TSICTestHarness.register({
    name: 'Layout/Production: selecting a recipe does not move the queue',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' },
            ID_Plank: { Name: 'Plank', Category: 'CraftingMaterial' },
        });
        ctx.screen('Production');
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production', StationId: 'S_Oven', StationName: 'Oven',
            Recipes: recipes(6), MaterialCounts: { ID_Wood: 99 },
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('[data-screen="Production"] #p-list .tsic-list-row').length >= 1,
            { timeout: 4000 });
        await new Promise(r => setTimeout(r, 120));

        const infoBefore = box(ctx.doc.querySelector('[data-screen="Production"] #p-info'));
        const queueBefore = box(ctx.doc.querySelector('[data-screen="Production"] #p-queue'));
        const addBefore = box(ctx.doc.querySelector('[data-screen="Production"] #p-add'));

        ctx.doc.querySelector('[data-screen="Production"] #p-list .tsic-list-row').click();
        await new Promise(r => setTimeout(r, 160));

        sameBox(ctx, infoBefore, box(ctx.doc.querySelector('[data-screen="Production"] #p-info')), 'details block');
        sameBox(ctx, addBefore, box(ctx.doc.querySelector('[data-screen="Production"] #p-add')), 'add button');
        sameBox(ctx, queueBefore, box(ctx.doc.querySelector('[data-screen="Production"] #p-queue')), 'queue pane');
    },
});

// ── BugReport: the furniture block ─────────────────────────────────────────
//
// The block starts as one line of "Looking for furniture…" and is replaced by the name
// plus four detail rows a frame or two later. The dialog is vertically centred, so that
// growth pushed its top edge up and took Submit and Cancel with it, while the player was
// already reaching for one.

TSICTestHarness.register({
    name: 'Layout/BugReport: the trace result does not move the dialog',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.screen('BugReport');
        await ctx.waitFor(() => ctx.doc.querySelector('[data-screen="BugReport"] #br-furniture'),
            { timeout: 4000 });
        await new Promise(r => setTimeout(r, 160));

        const panelSel = '[data-screen="BugReport"] .tsic-panel';
        const coldPanel = box(ctx.doc.querySelector(panelSel));
        const coldBlock = box(ctx.doc.querySelector('[data-screen="BugReport"] #br-furniture'));
        const coldSubmit = box(ctx.doc.querySelector('[data-screen="BugReport"] #btn-submit'));

        ctx.inject('tsic.msg.UI.BugReport.FurnitureTarget', {
            bHasTarget: true,
            DisplayName: 'Weapon Bench',
            DefinitionId: 'FD_WeaponBench_CS',
            MapName: 'Durham Furniture',
            TileIndex: 35192, TileCoord: '120,137', bMoved: false,
        });
        await new Promise(r => setTimeout(r, 160));

        sameBox(ctx, coldBlock, box(ctx.doc.querySelector('[data-screen="BugReport"] #br-furniture')),
            'furniture block');
        sameBox(ctx, coldPanel, box(ctx.doc.querySelector(panelSel)), 'dialog');
        sameBox(ctx, coldSubmit, box(ctx.doc.querySelector('[data-screen="BugReport"] #btn-submit')),
            'submit button');
    },
});

// ── Station titles: one line, whatever the station is called ───────────────
//
// The station names its own title. A long name wrapped to two lines and took 26px off the
// recipe list below it — at 1280x720, which is a window people play in, so the harness's
// default 1920x1080 sweep missed it entirely. Asserted on the title's own height, which is
// resolution-independent: one line or two.

TSICTestHarness.register({
    name: 'Layout/Crafting: a long station name does not grow the title row',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.screen('Crafting');
        const open = (name) => ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Crafting', StationId: 'S_Bench', StationName: name,
            Recipes: recipes(4), MaterialCounts: { ID_Wood: 99 },
        });

        open('Bench');
        await ctx.waitFor(() => ctx.doc.querySelectorAll('[data-screen="Crafting"] #c-station .tsic-list-row').length >= 1,
            { timeout: 4000 });
        await new Promise(r => setTimeout(r, 120));
        const shortTitle = box(ctx.doc.querySelector('[data-screen="Crafting"] #c-title'));
        const shortStation = box(ctx.doc.querySelector('[data-screen="Crafting"] #c-station'));

        open(LONG_STATION);
        await new Promise(r => setTimeout(r, 160));
        const longTitle = box(ctx.doc.querySelector('[data-screen="Crafting"] #c-title'));
        const longStation = box(ctx.doc.querySelector('[data-screen="Crafting"] #c-station'));

        ctx.expect(ctx.assert.truthy(
            ctx.doc.querySelector('[data-screen="Crafting"] #c-title').textContent.indexOf('Reinforced') === 0,
            'the title really did take the long station name'));
        sameBox(ctx, shortTitle, longTitle, 'station title', ['h']);
        sameBox(ctx, shortStation, longStation, 'station host', ['y', 'h']);
    },
});
