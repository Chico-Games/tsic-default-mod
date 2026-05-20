// /screens/crafting.html subscribes to:
//   tsic.msg.UI.Recipe.StationOpened (Kind === 'Crafting')
//   tsic.msg.UI.Toast.Show
//
// Material counts are derived from the shared TSICPlaygroundInventory store,
// so crafting an item visibly decrements ingredients and produces the
// output back into the player inventory.
TSICPlayground.register({
    id: 'crafting',
    label: 'Crafting',
    screen: '/screens/crafting.html',
    catalogs: { items: TSICPlaygroundInventory.catalog },
    initialState() {
        TSICPlaygroundInventory.reset({
            items: [
                { ItemId: 'ID_Wheat', Count: 5, SlotIndex: 0 },
                { ItemId: 'ID_Wood',  Count: 6, SlotIndex: 1 },
                { ItemId: 'ID_Stone', Count: 2, SlotIndex: 2 },
            ],
            maxSlots: 32, maxWeight: 50,
        });
        return {
            stationId: 'S_Workbench',
            recipes: [
                { RecipeId: 'R_Bread', Name: 'Bread', bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Wheat', Count: 2 }], Outputs: [{ ItemId: 'ID_Bread', Count: 1 }], Duration: 3 },
                { RecipeId: 'R_Axe', Name: 'Axe', bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Wood', Count: 3 }, { ItemId: 'ID_Stone', Count: 1 }],
                  Outputs: [{ ItemId: 'ID_Axe', Count: 1 }], Duration: 5 },
                { RecipeId: 'R_Hammer', Name: 'Hammer', bDiscovered: false, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Wood', Count: 4 }, { ItemId: 'ID_Stone', Count: 2 }],
                  Outputs: [{ ItemId: 'ID_Hammer', Count: 1 }], Duration: 7 },
            ],
        };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Recipe.StationOpened', {
                Kind: 'Crafting', StationId: state.stationId,
                Recipes: state.recipes,
                MaterialCounts: TSICPlaygroundInventory.materialCounts(),
            }],
            ['tsic.msg.UI.Inventory.Updated', {
                OwnerId: 'Player',
                Items: TSICPlaygroundInventory.items(),
                MaxSlots: TSICPlaygroundInventory.maxSlots(),
                MaxWeight: TSICPlaygroundInventory.maxWeight(),
                CurrentWeight: TSICPlaygroundInventory.currentWeight(),
            }],
        ];
    },
    scenarios: [
        { label: 'Plenty of materials', apply() {
            TSICPlaygroundInventory.reset({ items: [
                { ItemId: 'ID_Wheat', Count: 99, SlotIndex: 0 },
                { ItemId: 'ID_Wood',  Count: 99, SlotIndex: 1 },
                { ItemId: 'ID_Stone', Count: 99, SlotIndex: 2 },
            ], maxSlots: 32, maxWeight: 999 });
        } },
        { label: 'Insufficient (all)', apply() {
            TSICPlaygroundInventory.reset({ items: [{ ItemId: 'ID_Wheat', Count: 1, SlotIndex: 0 }], maxSlots: 32, maxWeight: 30 });
        } },
        { label: 'Just enough for bread', apply() {
            TSICPlaygroundInventory.reset({ items: [{ ItemId: 'ID_Wheat', Count: 2, SlotIndex: 0 }], maxSlots: 32, maxWeight: 30 });
        } },
        // Material counts shift but the recipe affordability flag is the same
        // as initial (both bread and axe affordable in both states), so the
        // visible list/buttons don't change. Inject still fires.
        { label: 'Bread + axe affordable', apply() {
            TSICPlaygroundInventory.reset({ items: [
                { ItemId: 'ID_Wheat', Count: 5, SlotIndex: 0 },
                { ItemId: 'ID_Wood',  Count: 3, SlotIndex: 1 },
                { ItemId: 'ID_Stone', Count: 1, SlotIndex: 2 },
            ], maxSlots: 32, maxWeight: 30 });
        }, expect: { visualChange: false } },
        { label: 'Most discovered',     apply(s) {
            s.recipes = s.recipes.map(r => ({ ...r, bDiscovered: true }));
        } },
        { label: 'All locked',          apply(s) { s.recipes = s.recipes.map(r => ({ ...r, bDiscovered: false })); } },
        { label: 'Station level too low', apply(s) { s.recipes = s.recipes.map(r => ({ ...r, bStationLevelSufficient: false, RequiredStationLevel: 3 })); } },
        { label: 'Big recipe list',     apply(s) {
            s.recipes = [
                ...s.recipes,
                { RecipeId: 'R_Apple',  Name: 'Apple Pie',  bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Apple', Count: 3 }], Outputs: [{ ItemId: 'ID_Bread', Count: 1 }], Duration: 4 },
                { RecipeId: 'R_Rope',   Name: 'Rope',       bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Wheat', Count: 3 }], Outputs: [{ ItemId: 'ID_Rope', Count: 1 }], Duration: 2 },
                { RecipeId: 'R_Nail',   Name: 'Nail x4',    bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Iron', Count: 1 }], Outputs: [{ ItemId: 'ID_Nail', Count: 4 }], Duration: 3 },
                { RecipeId: 'R_Coin',   Name: 'Coin',       bDiscovered: false, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Gold', Count: 1 }], Outputs: [{ ItemId: 'ID_Coin', Count: 10 }], Duration: 5 },
            ];
        } },
        { label: 'Empty list',          apply(s) { s.recipes = []; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Recipe.Start' && payload.Kind === 'Crafting') {
            const recipe = state.recipes.find(r => r.RecipeId === payload.RecipeId);
            TSICPlaygroundInventory.applyRecipe(recipe, payload.Count || 1);
        }
    },
});
