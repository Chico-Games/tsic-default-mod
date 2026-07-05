// Plant / "growing" coverage. There is no dedicated growing screen — plant
// recipes (UPlantRecipeDefinition) flow through the Production station UI
// as long-Duration recipes. These tests verify that plant-shaped recipes
// render through the existing production pipeline correctly.

TSICTestHarness.register({
    name: 'Growing: plant recipe renders in production recipe list',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Tomato: { Name: 'Tomato', Category: 'Consumable' }, ID_TomatoSeed: { Name: 'Tomato Seed', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production',
            StationId: 'S_GardenBed',
            Recipes: [{
                RecipeId: 'R_Plant_Tomato',
                Name: 'Tomato',
                bDiscovered: true,
                bStationLevelSufficient: true,
                Ingredients: [{ ItemId: 'ID_TomatoSeed', Count: 1 }],
                Outputs: [{ ItemId: 'ID_Tomato', Count: 3 }],
                Duration: 180,  // plants take ages
            }],
            MaterialCounts: { ID_TomatoSeed: 5 },
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#p-list .tsic-list-row'));
        const nameEl = ctx.doc.querySelector('#p-list .tsic-list-row .name');
        ctx.expect(ctx.assert.eq(nameEl.textContent, 'Tomato'));
        // Duration shown in info panel (recipe-info.js).
        ctx.expect(ctx.assert.truthy(/180s/.test(ctx.doc.getElementById('p-info').textContent || ''),
            'expected duration 180s in info panel'));
    },
});

TSICTestHarness.register({
    name: 'Growing: plant recipe in queue at 30% progress renders bar at 30%',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Tomato: { Name: 'Tomato' } });
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production',
            Recipes: [{ RecipeId: 'R_Plant_Tomato', Name: 'Tomato', bDiscovered: true, bStationLevelSufficient: true,
                        Ingredients: [], Outputs: [{ ItemId: 'ID_Tomato', Count: 3 }], Duration: 180 }],
            MaterialCounts: {},
        });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', Entries: [
            { RecipeId: 'R_Plant_Tomato', QueueIndex: 0, Progress: 0.3, bIsActive: true },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelector('#p-queue .q-entry .q-bar > div'));
        const inner = ctx.doc.querySelector('#p-queue .q-entry .q-bar > div');
        ctx.expect(ctx.assert.truthy(/^30(\.0)?%$/.test(inner.style.width),
            `expected width 30%/30.0% for growing plant at 0.3, got: ${inner.style.width}`));
        // Active (growing) entry should carry .active class.
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('#p-queue .q-entry .q-bar').classList.contains('active'), true));
    },
});

TSICTestHarness.register({
    name: 'Growing: plant completion plays Recipe.Completed sound',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Production', Recipes: [], MaterialCounts: {} });
        ctx.clearPublishes();
        ctx.inject('tsic.msg.UI.Recipe.Completed', { Kind: 'Production', RecipeId: 'R_Plant_Tomato' });
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play',
            { where: p => p.SoundKey === 'Recipe.Completed' }));
    },
});

TSICTestHarness.register({
    name: 'Growing: post-harvest Inventory.Updated shows harvested crop in player inventory',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Tomato: { Name: 'Tomato', Category: 'Consumable', Weight: 0.1 } });
        // Before harvest: empty.
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32, MaxWeight: 30, CurrentWeight: 0 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-empty'));
        // Harvest fires: 3 tomatoes appear.
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player',
            Items: [{ ItemId: 'ID_Tomato', Count: 3, SlotIndex: 0 }],
            MaxSlots: 32, MaxWeight: 30, CurrentWeight: 0.3,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]'));
        const row = ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]');
        ctx.expect(ctx.assert.truthy(/×3/.test(row.textContent || ''),
            `expected ×3 in harvested row, got: ${row.textContent}`));
    },
});

TSICTestHarness.register({
    name: 'Growing: long-duration plant recipe at 0.001 progress still renders bar without layout glitch',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Production', Recipes: [], MaterialCounts: {} });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', Entries: [
            { RecipeId: 'R_LongPlant', QueueIndex: 0, Progress: 0.001, bIsActive: true },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelector('#p-queue .q-entry .q-bar > div'));
        const inner = ctx.doc.querySelector('#p-queue .q-entry .q-bar > div');
        // Width should be a tiny but non-zero value (clamped to [0, 100]).
        ctx.expect(ctx.assert.truthy(/^0\.[01]%$/.test(inner.style.width),
            `expected small but non-zero width, got: ${inner.style.width}`));
    },
});
