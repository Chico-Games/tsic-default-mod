// /screens/production.html subscribes to:
//   tsic.msg.UI.Recipe.StationOpened  (Kind === 'Production')
//   tsic.msg.UI.Recipe.QueueChanged   (Entries: [{ QueueIndex, RecipeId, bIsActive, Progress }])
//   tsic.msg.UI.Recipe.Progress       (Progress for active entry)
//   tsic.msg.UI.Recipe.Completed      (signals sound)
// Publishes:
//   UI.Cmd.Recipe.Start   { Kind:'Production', StationId, RecipeId, Count }
//   UI.Cmd.Recipe.Cancel  { Kind:'Production', StationId, QueueIndex }
TSICPlayground.register({
    id: 'production',
    label: 'Production',
    screen: '/screens/production.html',
    catalogs: {
        items: {
            ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial', Weight: 0.1 },
            ID_Bread: { Name: 'Bread', Category: 'Consumable',       Weight: 0.2 },
            ID_Iron:  { Name: 'Iron',  Category: 'CraftingMaterial', Weight: 1.5 },
            ID_Nail:  { Name: 'Nail',  Category: 'CraftingMaterial', Weight: 0.05 },
        },
    },
    initialState() {
        return {
            stationId: 'S_Oven',
            recipes: [
                { RecipeId: 'R_Bread', Name: 'Bread', bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Wheat', Count: 2 }],
                  Outputs:     [{ ItemId: 'ID_Bread', Count: 1 }], Duration: 6 },
                { RecipeId: 'R_Nail',  Name: 'Nail',  bDiscovered: true, bStationLevelSufficient: true,
                  Ingredients: [{ ItemId: 'ID_Iron', Count: 1 }],
                  Outputs:     [{ ItemId: 'ID_Nail', Count: 4 }], Duration: 12 },
            ],
            materialCounts: { ID_Wheat: 12, ID_Iron: 4 },
            queue: [],
        };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Recipe.StationOpened', {
                Kind: 'Production', StationId: state.stationId,
                Recipes: state.recipes, MaterialCounts: state.materialCounts,
            }],
            ['tsic.msg.UI.Recipe.QueueChanged', {
                Kind: 'Production', StationId: state.stationId, Entries: state.queue,
            }],
        ];
    },
    scenarios: [
        { label: 'Idle',           apply(s) { s.queue = []; } },
        { label: 'One running',    apply(s) { s.queue = [
            { QueueIndex: 0, RecipeId: 'R_Bread', Progress: 0.42, bIsActive: true },
        ]; } },
        { label: 'Three queued',   apply(s) { s.queue = [
            { QueueIndex: 0, RecipeId: 'R_Bread', Progress: 0.75, bIsActive: true },
            { QueueIndex: 1, RecipeId: 'R_Bread', Progress: 0,    bIsActive: false },
            { QueueIndex: 2, RecipeId: 'R_Nail',  Progress: 0,    bIsActive: false },
        ]; } },
        { label: 'Insufficient',   apply(s) { s.materialCounts = {}; } },
        { label: 'Tick +20% prog', apply(s) {
            const active = s.queue.find(e => e.bIsActive);
            if (active) active.Progress = Math.min(1.0, (active.Progress || 0) + 0.2);
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Recipe.Start' && payload.Kind === 'Production') {
            const recipe = state.recipes.find(r => r.RecipeId === payload.RecipeId);
            if (!recipe) return;
            for (const ing of recipe.Ingredients || []) {
                state.materialCounts[ing.ItemId] = Math.max(0, (state.materialCounts[ing.ItemId] || 0) - ing.Count);
            }
            state.queue.push({
                QueueIndex: state.queue.length, RecipeId: recipe.RecipeId,
                Progress: 0, bIsActive: state.queue.length === 0,
            });
        } else if (channel === 'UI.Cmd.Recipe.Cancel' && payload.Kind === 'Production') {
            const idx = state.queue.findIndex(e => e.QueueIndex === payload.QueueIndex);
            if (idx >= 0) state.queue.splice(idx, 1);
            state.queue.forEach((e, i) => { e.QueueIndex = i; });
            if (state.queue.length && !state.queue.some(e => e.bIsActive)) state.queue[0].bIsActive = true;
        }
    },
});
