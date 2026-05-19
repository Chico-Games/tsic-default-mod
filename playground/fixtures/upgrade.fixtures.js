// /screens/upgrade.html subscribes to:
//   tsic.msg.UI.Recipe.StationOpened (Kind === 'Upgrade')
TSICPlayground.register({
    id: 'upgrade',
    label: 'Upgrade',
    screen: '/screens/upgrade.html',
    catalogs: { items: {
        ID_Iron: { Name: 'Iron', Category: 'CraftingMaterial', Weight: 1.5 },
        ID_Gold: { Name: 'Gold', Category: 'CraftingMaterial', Weight: 1.5 },
    } },
    initialState() {
        return {
            stationId: 'F_Workbench_01',
            recipes: [
                { RecipeId: 'U_Tier2', Name: 'Tier 2', bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Iron', Count: 4 }] },
                { RecipeId: 'U_Tier3', Name: 'Tier 3', bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Iron', Count: 8 }, { ItemId: 'ID_Gold', Count: 2 }] },
            ],
            materialCounts: { ID_Iron: 6, ID_Gold: 0 },
        };
    },
    project(state) {
        return [['tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Upgrade', StationId: state.stationId,
            Recipes: state.recipes, MaterialCounts: state.materialCounts,
        }]];
    },
    scenarios: [
        { label: 'Plenty',           apply(s) { s.materialCounts = { ID_Iron: 99, ID_Gold: 99 }; } },
        { label: 'Tier 2 ready',     apply(s) { s.materialCounts = { ID_Iron: 8, ID_Gold: 0 }; } },
        { label: 'Insufficient',     apply(s) { s.materialCounts = {}; } },
        { label: 'Maxed (no list)',  apply(s) { s.recipes = []; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Recipe.Start' && payload.Kind === 'Upgrade') {
            const recipe = state.recipes.find(r => r.RecipeId === payload.RecipeId);
            if (!recipe) return;
            for (const ing of recipe.Ingredients || []) {
                state.materialCounts[ing.ItemId] = Math.max(0, (state.materialCounts[ing.ItemId] || 0) - ing.Count);
            }
            const idx = state.recipes.indexOf(recipe);
            state.recipes.splice(idx, 1);
        }
    },
});
