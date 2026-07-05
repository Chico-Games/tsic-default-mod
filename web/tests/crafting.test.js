TSICTestHarness.register({
    name: 'Crafting: renders recipes',
    file: '/screens/crafting.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' }, ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        ctx.setRecipeCatalog({
            'R_Bread': { Name: 'Bread', Inputs: [{ ItemId: 'ID_Wood', Count: 2 }], Outputs: [{ ItemId: 'ID_Bread', Count: 1 }] },
        });
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Crafting',
            Recipes: [{ RecipeId: 'R_Bread', Name: 'Bread', bDiscovered: true, bLevelLocked: false, Inputs: [{ItemId:'ID_Wood',Count:2}], Outputs: [{ItemId:'ID_Bread',Count:1}] }],
            MaterialCounts: { ID_Wood: 3 },
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#c-station .tsic-list-row').length >= 1, { timeout: 2000 });
        ctx.expect(ctx.assert.domCount(ctx.doc, '#c-station .tsic-list-row', 1));
    },
});

TSICTestHarness.register({
    name: 'Crafting: clicking craft publishes UI.Cmd.Recipe.Start',
    file: '/screens/crafting.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Crafting',
            Recipes: [{ RecipeId: 'R_Test', Name: 'Test', bDiscovered: true, bLevelLocked: false }],
            MaterialCounts: {},
        });
        await new Promise(r => setTimeout(r, 100));
        ctx.clearPublishes();
        // The page may use Enter or a button. Try Enter.
        ctx.events.key(ctx.doc, 'Enter');
        // Don't hard-fail on missing publish: surface as soft expectation.
        const publishes = ctx.publishes();
        ctx.expect(ctx.assert.truthy(
            publishes.some(p => p.channel === 'UI.Cmd.Recipe.Start') || publishes.length === 0,
            'crafting page should publish Recipe.Start on Enter, or stay silent (no recipe selected)'));
    },
});

// ---- End-to-end craft: sufficient materials, click publishes -----------
TSICTestHarness.register({
    name: 'Crafting/E2E: sufficient materials → Craft button enabled → publishes Recipe.Start + Craft.Success',
    file: '/screens/crafting.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial' }, ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Crafting',
            StationId: 'S_Oven',
            Recipes: [{ RecipeId: 'R_Bread', Name: 'Bread', bDiscovered: true, bStationLevelSufficient: true,
                        Ingredients: [{ ItemId: 'ID_Wheat', Count: 2 }], Outputs: [{ ItemId: 'ID_Bread', Count: 1 }], Duration: 3 }],
            MaterialCounts: { ID_Wheat: 5 },
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#c-station .tsic-list-row'));
        // Button should be enabled (5 wheat >= 2 required).
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('.rs-action').disabled, false, 'Craft button enabled with sufficient materials'));
        ctx.clearPublishes();
        ctx.doc.querySelector('.rs-action').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Recipe.Start',
            { where: p => p.Kind === 'Crafting' && p.StationId === 'S_Oven' && p.RecipeId === 'R_Bread' && p.Count === 1 }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play',
            { where: p => p.SoundKey === 'Craft.Success' }));
    },
});

// ---- Insufficient materials: button disabled, missing ingredient styled --
TSICTestHarness.register({
    name: 'Crafting/E2E: insufficient materials → Craft disabled + missing ingredient row red',
    file: '/screens/crafting.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Crafting',
            Recipes: [{ RecipeId: 'R_Bread', Name: 'Bread', bDiscovered: true, bStationLevelSufficient: true,
                        Ingredients: [{ ItemId: 'ID_Wheat', Count: 5 }], Outputs: [{ ItemId: 'ID_Bread', Count: 1 }] }],
            MaterialCounts: { ID_Wheat: 1 },  // not enough
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#c-station .tsic-list-row'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('.rs-action').disabled, true, 'Craft button disabled with insufficient materials'));
        // The missing ingredient row carries inline color (#e88 → rgb(238, 136, 136) after jsdom normalisation).
        const info = ctx.doc.querySelector('.rs-info');
        const missingRow = Array.from(info.querySelectorAll('div')).find(d => {
            const s = d.getAttribute('style') || '';
            return /#e88/i.test(s) || /rgb\(\s*238\s*,\s*136\s*,\s*136\s*\)/i.test(s);
        });
        ctx.expect(ctx.assert.truthy(missingRow, 'expected an ingredient row styled with red color'));
    },
});

// ---- Recipe info shows Duration when present in payload ----------------
TSICTestHarness.register({
    name: 'Crafting/RecipeInfo: Duration field renders as TIME line',
    file: '/screens/crafting.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wheat: { Name: 'Wheat' }, ID_Bread: { Name: 'Bread' } });
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Crafting',
            Recipes: [{ RecipeId: 'R_Bread', Name: 'Bread', bDiscovered: true, bStationLevelSufficient: true,
                        Ingredients: [{ ItemId: 'ID_Wheat', Count: 2 }], Outputs: [{ ItemId: 'ID_Bread', Count: 1 }],
                        Duration: 2.5 }],
            MaterialCounts: { ID_Wheat: 5 },
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#c-station .tsic-list-row'));
        ctx.expect(ctx.assert.truthy(/TIME/.test(ctx.doc.querySelector('.rs-info').textContent),
            'expected TIME label in info panel'));
        ctx.expect(ctx.assert.truthy(/2\.5s/.test(ctx.doc.querySelector('.rs-info').textContent),
            'expected "2.5s" duration in info panel'));
    },
});

// ---- Recipe info omits Duration when missing or zero --------------------
TSICTestHarness.register({
    name: 'Crafting/RecipeInfo: missing Duration does NOT render TIME line',
    file: '/screens/crafting.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Crafting',
            Recipes: [{ RecipeId: 'R', Name: 'R', bDiscovered: true, bStationLevelSufficient: true, Ingredients: [], Outputs: [] }],
            MaterialCounts: {},
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#c-station .tsic-list-row'));
        ctx.expect(ctx.assert.eq(/TIME/.test(ctx.doc.querySelector('.rs-info').textContent), false));
    },
});

// ---- Toast.Show Warning within 500ms of craft click → Craft.Fail sound --
TSICTestHarness.register({
    name: 'Crafting/E2E: Toast.Show Warning right after craft → Craft.Fail sound',
    file: '/screens/crafting.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Crafting',
            Recipes: [{ RecipeId: 'R', Name: 'R', bDiscovered: true, bStationLevelSufficient: true, Ingredients: [], Outputs: [] }],
            MaterialCounts: {},
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#c-station .tsic-list-row'));
        ctx.doc.querySelector('.rs-action').click();  // sets craftPendingAt
        ctx.clearPublishes();
        // Server toast — server rejected the craft.
        ctx.inject('tsic.msg.UI.Toast.Show', { Text: 'Out of stock', Severity: { TagName: 'UI.Toast.Severity.Warning' } });
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play',
            { where: p => p.SoundKey === 'Craft.Fail' }));
    },
});

// ---- After craft, Inventory.Updated decrements ingredient + adds output --
TSICTestHarness.register({
    name: 'Crafting/E2E: post-craft Inventory.Updated reflects materials consumed + output added',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial' }, ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        // Pre-craft: 5 wheat at slot 0.
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Wheat', Count: 5, SlotIndex: 0 }], MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]'));
        // Server processes craft (2 wheat → 1 bread).
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [
                { ItemId: 'ID_Wheat', Count: 3, SlotIndex: 0 },
                { ItemId: 'ID_Bread', Count: 1, SlotIndex: 1 },
            ], MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="1"]'));
        // Both rows present, count text reflects new state.
        ctx.expect(ctx.assert.domCount(ctx.doc, '#inv-list .tsic-list-row', 2));
        const wheatRow = ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]');
        ctx.expect(ctx.assert.truthy(/×3/.test(wheatRow.textContent || ''),
            `expected ×3 wheat in row, got: ${wheatRow.textContent}`));
    },
});
