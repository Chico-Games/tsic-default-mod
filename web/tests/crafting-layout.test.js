// Crafting panel LAYOUT — the panel is a fixed slab and the recipe list scrolls inside it.
//
// Issue #228: "i opened the crafting and it's resizing the panel depending on what recipe is
// selected. there STILL isn't a scroll bar when there are too many recipes, its just extending
// it down." Both halves are layout, not content, and both are measurable — so they are measured
// here, in the REAL shell (/screens/in-game.html + ctx.screen), because the standalone
// /screens/crafting.html page has no #screen-overlay-host above it and therefore does not
// reproduce the stacking the player sees.

function recipes(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
        out.push({
            RecipeId: 'R_' + i,
            Name: 'Recipe ' + i,
            bDiscovered: true,
            bStationLevelSufficient: true,
            Ingredients: [{ ItemId: 'ID_Wood', Count: 1 }],
            Outputs: [{ ItemId: 'ID_Plank', Count: 1 }],
        });
    }
    return out;
}

async function openCrafting(ctx, list) {
    ctx.screen('Crafting');
    ctx.setItemCatalog({
        ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' },
        ID_Plank: { Name: 'Plank', Category: 'CraftingMaterial' },
        ID_Nail: { Name: 'Nail', Category: 'CraftingMaterial' },
    });
    ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
        Kind: 'Crafting',
        StationId: 'S_Bench',
        StationName: 'Weapon Bench',
        Recipes: list,
        MaterialCounts: { ID_Wood: 99 },
    });
    await ctx.waitFor(() => ctx.doc.querySelectorAll('#c-station .tsic-list-row').length >= 1,
        { timeout: 4000 });
}

TSICTestHarness.register({
    name: 'Crafting/Layout: a long recipe list scrolls inside the panel instead of growing it',
    file: '/screens/in-game.html',
    async run(ctx) {
        await openCrafting(ctx, recipes(60));

        const pane = ctx.doc.querySelector('#c-station .tsic-list-pane');
        const panel = ctx.doc.querySelector('#c-panel');
        const panelRect = panel.getBoundingClientRect();

        // The list overflows its pane — that is the whole point of 60 rows — and the pane is
        // the thing that scrolls, so the overflow stays inside the panel.
        ctx.expect(ctx.assert.truthy(pane.scrollHeight > pane.clientHeight + 1,
            `recipe list overflows its pane (scrollHeight ${pane.scrollHeight} > clientHeight ${pane.clientHeight})`));
        ctx.expect(ctx.assert.truthy(
            ctx.win.getComputedStyle(pane).overflowY === 'auto' || ctx.win.getComputedStyle(pane).overflowY === 'scroll',
            'recipe list pane is the scroll container'));

        // ...and the panel itself still ends on screen. A panel that runs off the bottom is
        // what "it's just extending it down" looks like from the player's chair: the list IS
        // scrolling, inside a slab whose end nobody can see.
        ctx.expect(ctx.assert.truthy(panelRect.bottom <= ctx.win.innerHeight + 1,
            `panel bottom ${Math.round(panelRect.bottom)} is within the viewport (${ctx.win.innerHeight})`));
        ctx.expect(ctx.assert.truthy(panelRect.top >= -1,
            `panel top ${Math.round(panelRect.top)} is within the viewport`));

        // The close button is the only visible way out, so it has to be reachable.
        const close = ctx.doc.querySelector('#c-panel .tsic-close-row .tsic-button');
        const closeRect = close.getBoundingClientRect();
        ctx.expect(ctx.assert.truthy(closeRect.bottom <= ctx.win.innerHeight + 1,
            `close button is on screen (bottom ${Math.round(closeRect.bottom)})`));
    },
});

TSICTestHarness.register({
    name: 'Crafting/Layout: selecting a recipe never resizes the panel',
    file: '/screens/in-game.html',
    async run(ctx) {
        // Two recipes with WILDLY different detail-pane heights: one ingredient vs twelve.
        const many = [];
        for (let i = 0; i < 12; i++) many.push({ ItemId: 'ID_Wood', Count: i + 1 });
        await openCrafting(ctx, [
            { RecipeId: 'R_Short', Name: 'Short', bDiscovered: true, bStationLevelSufficient: true,
              Ingredients: [{ ItemId: 'ID_Wood', Count: 1 }], Outputs: [{ ItemId: 'ID_Plank', Count: 1 }] },
            { RecipeId: 'R_Tall', Name: 'Tall', bDiscovered: true, bStationLevelSufficient: true,
              Ingredients: many, Outputs: [{ ItemId: 'ID_Plank', Count: 1 }],
              Description: 'A very long description '.repeat(20) },
        ]);

        const panel = ctx.doc.querySelector('#c-panel');
        const rows = ctx.doc.querySelectorAll('#c-station .tsic-list-row');

        rows[0].click();
        await ctx.waitFor(() => ctx.doc.querySelector('#c-station .rs-info').textContent.length > 0);
        const shortRect = panel.getBoundingClientRect();

        rows[1].click();
        await ctx.waitFor(() => ctx.doc.querySelector('#c-station .rs-info').textContent.indexOf('12') !== -1
            || ctx.doc.querySelectorAll('#c-station .rs-info *').length > 5);
        const tallRect = panel.getBoundingClientRect();

        ctx.expect(ctx.assert.eq(Math.round(tallRect.height), Math.round(shortRect.height),
            'panel height is identical for a 1-ingredient and a 12-ingredient recipe'));
        ctx.expect(ctx.assert.eq(Math.round(tallRect.width), Math.round(shortRect.width),
            'panel width is identical for both recipes'));
        ctx.expect(ctx.assert.eq(Math.round(tallRect.top), Math.round(shortRect.top),
            'panel does not move when the selection changes'));

        // The detail pane, not the panel, absorbs the extra content.
        const info = ctx.doc.querySelector('#c-station .rs-info');
        ctx.expect(ctx.assert.truthy(
            ctx.win.getComputedStyle(info).overflowY === 'auto' || ctx.win.getComputedStyle(info).overflowY === 'scroll',
            'the details pane is its own scroll container'));
    },
});

// ── Cross-screen contamination (issue #273, and the real cause of #228) ────────────────
//
// The station panels measured perfectly stable on their own. They only broke AFTER the
// player had opened their bag: shared/inventory.js injected a global, unscoped `.tsic-split`
// rule for its stack-split dialog, and `.tsic-split` is also the shared panel scaffold in
// tsic-ui.css — the two-column body every station screen mounts. One class name, two
// unrelated components. From the first bag render onward, every station body inherited
// `position:fixed` and left the panel: out of flow, sized to its content, escaping the
// panel's overflow:hidden, so the recipe list ran down the screen instead of scrolling.
//
// This scenario is the cheap standing guard. The full sweep is
// Scripts/webui-bench/layout.mjs, which measures every screen this way.

TSICTestHarness.register({
    name: 'Crafting/Layout: opening the inventory first does not resize the crafting panel',
    file: '/screens/in-game.html',
    async run(ctx) {
        // Visit the bag, which is what injects the global grid stylesheet.
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', GridWidth: 8, GridHeight: 4, MaxSlots: 32,
            MaxWeight: 80, CurrentWeight: 4,
            Items: [{ InstanceId: 1, ItemId: 'ID_Wood', Count: 3, GridSlot: 0 }],
        });
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: 0, SelectedSlotPending: -1 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot'), { timeout: 4000 });

        await openCrafting(ctx, recipes(60));

        const split = ctx.doc.querySelector('#c-station .tsic-split');
        const pane = ctx.doc.querySelector('#c-station .tsic-list-pane');
        const panel = ctx.doc.querySelector('#c-panel');

        // The scaffold must stay in flow. `position:fixed` here is the exact leak.
        ctx.expect(ctx.assert.eq(ctx.win.getComputedStyle(split).position, 'static',
            'the panel body stays in flow after the inventory has been opened'));

        // ...which is what keeps the list inside the panel and scrolling.
        ctx.expect(ctx.assert.truthy(pane.scrollHeight > pane.clientHeight + 1,
            `list still scrolls inside its pane (scrollHeight ${pane.scrollHeight} > clientHeight ${pane.clientHeight})`));
        ctx.expect(ctx.assert.truthy(
            split.getBoundingClientRect().bottom <= panel.getBoundingClientRect().bottom + 1,
            'the panel body ends inside the panel, not below it'));
        ctx.expect(ctx.assert.truthy(
            panel.getBoundingClientRect().bottom <= ctx.win.innerHeight + 1,
            'the panel still ends on screen'));
    },
});

TSICTestHarness.register({
    name: 'Crafting/Layout: the stack-split dialog does not share a class with the panel scaffold',
    file: '/screens/in-game.html',
    async run(ctx) {
        // The bag has to render first: the offending stylesheet is injected lazily by the
        // first grid render, so scanning before that would scan a document that cannot fail.
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', GridWidth: 8, GridHeight: 4, MaxSlots: 32,
            MaxWeight: 80, CurrentWeight: 1, Items: [],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot'), { timeout: 4000 });
        await openCrafting(ctx, recipes(4));
        // One .tsic-split on screen: the crafting panel's own body. The inventory's split
        // dialog is .tsic-split-dialog and must never match this.
        ctx.expect(ctx.assert.domCount(ctx.doc, '.tsic-split', 1));
        // And no stylesheet anywhere may take the scaffold out of flow.
        const offenders = ctx.win.eval(`(function(){
            var out = [];
            for (var i = 0; i < document.styleSheets.length; i++) {
                var rules; try { rules = document.styleSheets[i].cssRules; } catch (e) { continue; }
                for (var k = 0; k < rules.length; k++) {
                    var r = rules[k];
                    if (!r.selectorText || !r.style || !r.style.position) continue;
                    if (/(^|[^-\w])\.tsic-split([^-\w]|$)/.test(r.selectorText)) {
                        out.push(r.selectorText + ' => ' + r.style.position);
                    }
                }
            }
            return out.join(' | ');
        })()`);
        ctx.expect(ctx.assert.eq(offenders, '',
            'no stylesheet sets `position` on the shared .tsic-split scaffold'));
    },
});
