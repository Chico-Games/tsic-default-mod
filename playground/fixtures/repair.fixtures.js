// /screens/repair.html subscribes to:
//   tsic.msg.UI.Recipe.StationOpened (Kind === 'Repair')
// It reuses the Recipe envelope. Each "recipe" entry is an item being repaired,
// where the click → UI.Cmd.Recipe.Start with the item id.
TSICPlayground.register({
    id: 'repair',
    label: 'Repair',
    screen: '/screens/repair.html',
    catalogs: {
        items: {
            ID_Axe:    { Name: 'Axe',    Category: 'Equipment',        Weight: 1.2 },
            ID_Hammer: { Name: 'Hammer', Category: 'Equipment',        Weight: 1.5 },
            ID_Wood:   { Name: 'Wood',   Category: 'CraftingMaterial', Weight: 1.0 },
            ID_Iron:   { Name: 'Iron',   Category: 'CraftingMaterial', Weight: 1.5 },
        },
    },
    initialState() {
        return {
            stationId: 'S_RepairBench',
            recipes: [
                { RecipeId: 'ID_Axe',    Name: 'Axe',    bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Wood', Count: 2 }], Outputs: [], Durability: 0.45, MaxDurability: 1 },
                { RecipeId: 'ID_Hammer', Name: 'Hammer', bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Iron', Count: 1 }], Outputs: [], Durability: 0.85, MaxDurability: 1 },
            ],
            materialCounts: { ID_Wood: 5, ID_Iron: 3 },
        };
    },
    project(state) {
        return [['tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Repair', StationId: state.stationId,
            Recipes: state.recipes, MaterialCounts: state.materialCounts,
        }]];
    },
    scenarios: [
        { label: 'Damaged set',       apply(s) { s.recipes = s.recipes.map(r => ({ ...r, Durability: 0.4 })); } },
        { label: 'Pristine',          apply(s) { s.recipes = s.recipes.map(r => ({ ...r, Durability: r.MaxDurability })); } },
        { label: 'Almost broken',    apply(s) { s.recipes = s.recipes.map(r => ({ ...r, Durability: 0.08 })); } },
        { label: 'No materials',     apply(s) { s.materialCounts = {}; } },
        { label: 'Nothing to repair',apply(s) { s.recipes = []; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Recipe.Start' && payload.Kind === 'Repair') {
            const recipe = state.recipes.find(r => r.RecipeId === payload.RecipeId);
            if (!recipe) return;
            for (const ing of recipe.Ingredients || []) {
                state.materialCounts[ing.ItemId] = Math.max(0, (state.materialCounts[ing.ItemId] || 0) - ing.Count);
            }
            recipe.Durability = recipe.MaxDurability || 1;
        }
    },
});
