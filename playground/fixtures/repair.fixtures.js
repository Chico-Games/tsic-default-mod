// /screens/repair.html subscribes to:
//   tsic.msg.UI.Recipe.StationOpened (Kind === 'Repair')
// Material counts derive from the shared TSICPlaygroundInventory.
TSICPlayground.register({
    id: 'repair',
    label: 'Repair',
    screen: '/screens/repair.html',
    catalogs: { items: TSICPlaygroundInventory.catalog },
    initialState() {
        TSICPlaygroundInventory.reset({
            items: [
                { ItemId: 'ID_Wood', Count: 5, SlotIndex: 0 },
                { ItemId: 'ID_Iron', Count: 3, SlotIndex: 1 },
            ],
            maxSlots: 32, maxWeight: 30,
        });
        return {
            stationId: 'S_RepairBench',
            recipes: [
                { RecipeId: 'ID_Axe',    Name: 'Axe',    bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Wood', Count: 2 }], Outputs: [], Durability: 0.45, MaxDurability: 1 },
                { RecipeId: 'ID_Hammer', Name: 'Hammer', bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Iron', Count: 1 }], Outputs: [], Durability: 0.85, MaxDurability: 1 },
            ],
        };
    },
    project(state) {
        return [['tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Repair', StationId: state.stationId,
            Recipes: state.recipes,
            MaterialCounts: TSICPlaygroundInventory.materialCounts(),
        }]];
    },
    scenarios: [
        { label: 'Damaged set',     apply(s) { s.recipes = s.recipes.map(r => ({ ...r, Durability: 0.4 })); } },
        { label: 'Pristine',        apply(s) { s.recipes = s.recipes.map(r => ({ ...r, Durability: r.MaxDurability })); } },
        { label: 'Almost broken',   apply(s) { s.recipes = s.recipes.map(r => ({ ...r, Durability: 0.08 })); } },
        { label: 'No materials',    apply() {
            TSICPlaygroundInventory.reset({ items: [], maxSlots: 32, maxWeight: 30 });
        } },
        { label: 'Nothing to repair', apply(s) { s.recipes = []; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Recipe.Start' && payload.Kind === 'Repair') {
            const recipe = state.recipes.find(r => r.RecipeId === payload.RecipeId);
            if (!recipe || !TSICPlaygroundInventory.canAfford(recipe)) return;
            for (const ing of recipe.Ingredients || []) {
                TSICPlaygroundInventory.consume(ing.ItemId, ing.Count);
            }
            recipe.Durability = recipe.MaxDurability || 1;
        }
    },
});
