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
            // Also push inventory so the inventory screen stays in sync if
            // you swap to it via the screen picker without resetting state.
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
        { label: 'Insufficient', apply() {
            TSICPlaygroundInventory.reset({ items: [{ ItemId: 'ID_Wheat', Count: 1, SlotIndex: 0 }], maxSlots: 32, maxWeight: 30 });
        } },
        { label: 'Just enough for bread', apply() {
            TSICPlaygroundInventory.reset({ items: [{ ItemId: 'ID_Wheat', Count: 2, SlotIndex: 0 }], maxSlots: 32, maxWeight: 30 });
        } },
        { label: 'All locked',            apply(s) { s.recipes = s.recipes.map(r => ({ ...r, bDiscovered: false })); } },
        { label: 'Station level too low', apply(s) { s.recipes = s.recipes.map(r => ({ ...r, bStationLevelSufficient: false, RequiredStationLevel: 3 })); } },
        { label: 'Empty list',            apply(s) { s.recipes = []; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Recipe.Start' && payload.Kind === 'Crafting') {
            const recipe = state.recipes.find(r => r.RecipeId === payload.RecipeId);
            TSICPlaygroundInventory.applyRecipe(recipe, payload.Count || 1);
        }
    },
});
