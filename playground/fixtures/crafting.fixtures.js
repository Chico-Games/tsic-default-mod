// /screens/crafting.html subscribes to:
//   tsic.msg.UI.Recipe.StationOpened (Kind === 'Crafting')
//   tsic.msg.UI.Toast.Show
// Publishes:
//   UI.Cmd.Recipe.Start    { Kind, StationId, RecipeId, Count }
//   UI.Cmd.Sound.Play, UI.Cmd.Pause.Resume
TSICPlayground.register({
    id: 'crafting',
    label: 'Crafting',
    screen: '/screens/crafting.html',
    catalogs: {
        items: {
            ID_Wood:  { Name: 'Wood',  Category: 'CraftingMaterial', Weight: 1 },
            ID_Stone: { Name: 'Stone', Category: 'CraftingMaterial', Weight: 2 },
            ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial', Weight: 0.1 },
            ID_Bread: { Name: 'Bread', Category: 'Consumable',       Weight: 0.2 },
            ID_Axe:   { Name: 'Axe',   Category: 'Equipment',        Weight: 1.2 },
            ID_Hammer:{ Name: 'Hammer',Category: 'Equipment',        Weight: 1.5 },
        },
    },
    initialState() {
        return {
            stationId: 'S_Workbench',
            materialCounts: { ID_Wheat: 5, ID_Wood: 6, ID_Stone: 2 },
            recipes: [
                { RecipeId: 'R_Bread', Name: 'Bread', bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Wheat', Count: 2 }], Outputs: [{ ItemId: 'ID_Bread', Count: 1 }], Duration: 3 },
                { RecipeId: 'R_Axe',   Name: 'Axe',   bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Wood', Count: 3 }, { ItemId: 'ID_Stone', Count: 1 }],
                  Outputs: [{ ItemId: 'ID_Axe', Count: 1 }], Duration: 5 },
                { RecipeId: 'R_Hammer',Name: 'Hammer',bDiscovered: false, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Wood', Count: 4 }, { ItemId: 'ID_Stone', Count: 2 }],
                  Outputs: [{ ItemId: 'ID_Hammer', Count: 1 }], Duration: 7 },
            ],
        };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Recipe.StationOpened', {
                Kind: 'Crafting', StationId: state.stationId,
                Recipes: state.recipes, MaterialCounts: state.materialCounts,
            }],
        ];
    },
    scenarios: [
        { label: 'Plenty of materials',   apply(s) { s.materialCounts = { ID_Wheat: 99, ID_Wood: 99, ID_Stone: 99 }; } },
        { label: 'Insufficient',          apply(s) { s.materialCounts = { ID_Wheat: 1 }; } },
        { label: 'All locked',            apply(s) { s.recipes = s.recipes.map(r => ({ ...r, bDiscovered: false })); } },
        { label: 'Station level too low', apply(s) { s.recipes = s.recipes.map(r => ({ ...r, bStationLevelSufficient: false, RequiredStationLevel: 3 })); } },
        { label: 'Empty list',            apply(s) { s.recipes = []; } },
        { label: 'Craft failed toast',    apply() {} /* button doesn't mutate state; project emits StationOpened, toast injected by Input tab */ },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Recipe.Start' && payload.Kind === 'Crafting') {
            const recipe = state.recipes.find(r => r.RecipeId === payload.RecipeId);
            TSICPlaygroundSim.applyRecipeStart(state, payload.RecipeId, recipe, payload.Count || 1);
        }
    },
});
