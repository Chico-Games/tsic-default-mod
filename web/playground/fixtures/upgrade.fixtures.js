// /screens/upgrade.html subscribes to:
//   tsic.msg.UI.Recipe.StationOpened (Kind === 'Upgrade')
// Materials come from the shared TSICPlaygroundInventory.
TSICPlayground.register({
    id: 'upgrade',
    label: 'Upgrade',
    screen: '/screens/upgrade.html',
    catalogs: { items: TSICPlaygroundInventory.catalog },
    initialState() {
        TSICPlaygroundInventory.reset({
            items: [{ ItemId: 'ID_Iron', Count: 6, SlotIndex: 0 }],
            maxSlots: 32, maxWeight: 30,
        });
        return {
            stationId: 'F_Workbench_01',
            recipes: [
                { RecipeId: 'U_Tier2', Name: 'Tier 2', bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Iron', Count: 4 }] },
                { RecipeId: 'U_Tier3', Name: 'Tier 3', bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Iron', Count: 8 }, { ItemId: 'ID_Gold', Count: 2 }] },
            ],
        };
    },
    project(state) {
        return [['tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Upgrade', StationId: state.stationId,
            Recipes: state.recipes,
            MaterialCounts: TSICPlaygroundInventory.materialCounts(),
        }]];
    },
    scenarios: [
        { label: 'Plenty',          apply() {
            TSICPlaygroundInventory.reset({ items: [
                { ItemId: 'ID_Iron', Count: 99, SlotIndex: 0 },
                { ItemId: 'ID_Gold', Count: 99, SlotIndex: 1 },
            ], maxSlots: 32, maxWeight: 999 });
        } },
        { label: 'Tier 2 only ready', apply() {
            TSICPlaygroundInventory.reset({ items: [{ ItemId: 'ID_Iron', Count: 4, SlotIndex: 0 }], maxSlots: 32, maxWeight: 50 });
        } },
        { label: 'Tier 2 + partial Tier 3', apply() {
            TSICPlaygroundInventory.reset({ items: [
                { ItemId: 'ID_Iron', Count: 8, SlotIndex: 0 },
                { ItemId: 'ID_Gold', Count: 1, SlotIndex: 1 },
            ], maxSlots: 32, maxWeight: 50 });
        } },
        { label: 'Insufficient',    apply() {
            TSICPlaygroundInventory.reset({ items: [], maxSlots: 32, maxWeight: 30 });
        } },
        { label: 'Wrong materials', apply() {
            TSICPlaygroundInventory.reset({ items: [
                { ItemId: 'ID_Wood', Count: 99, SlotIndex: 0 },
                { ItemId: 'ID_Stone', Count: 99, SlotIndex: 1 },
            ], maxSlots: 32, maxWeight: 50 });
        } },
        { label: 'Big tier ladder',  apply(s) { s.recipes = [
            { RecipeId: 'U_Tier2', Name: 'Tier 2', bDiscovered: true, bStationLevelSufficient: true,
              Ingredients: [{ ItemId: 'ID_Iron', Count: 4 }] },
            { RecipeId: 'U_Tier3', Name: 'Tier 3', bDiscovered: true, bStationLevelSufficient: true,
              Ingredients: [{ ItemId: 'ID_Iron', Count: 8 }, { ItemId: 'ID_Gold', Count: 2 }] },
            { RecipeId: 'U_Tier4', Name: 'Tier 4', bDiscovered: true, bStationLevelSufficient: true,
              Ingredients: [{ ItemId: 'ID_Iron', Count: 16 }, { ItemId: 'ID_Gold', Count: 6 }] },
            { RecipeId: 'U_Tier5', Name: 'Tier 5 (locked)', bDiscovered: false, bStationLevelSufficient: true,
              Ingredients: [{ ItemId: 'ID_Gold', Count: 20 }] },
        ]; } },
        { label: 'Maxed (no list)', apply(s) { s.recipes = []; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Recipe.Start' && payload.Kind === 'Upgrade') {
            const recipe = state.recipes.find(r => r.RecipeId === payload.RecipeId);
            if (!recipe || !TSICPlaygroundInventory.canAfford(recipe)) return;
            for (const ing of recipe.Ingredients || []) {
                TSICPlaygroundInventory.consume(ing.ItemId, ing.Count);
            }
            const idx = state.recipes.indexOf(recipe);
            state.recipes.splice(idx, 1);
        }
    },
});
