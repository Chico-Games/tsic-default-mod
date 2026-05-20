// /screens/production.html subscribes to:
//   tsic.msg.UI.Recipe.StationOpened  (Kind === 'Production')
//   tsic.msg.UI.Recipe.QueueChanged   (Entries: [{ QueueIndex, RecipeId, bIsActive, Progress }])
//   tsic.msg.UI.Recipe.Progress       (Progress for active entry)
//   tsic.msg.UI.Recipe.Completed      (signals sound)
TSICPlayground.register({
    id: 'production',
    label: 'Production',
    screen: '/screens/production.html',
    catalogs: { items: TSICPlaygroundInventory.catalog },
    initialState() {
        TSICPlaygroundInventory.reset({
            items: [
                { ItemId: 'ID_Wheat', Count: 12, SlotIndex: 0 },
                { ItemId: 'ID_Iron',  Count: 4,  SlotIndex: 1 },
            ],
            maxSlots: 32, maxWeight: 50,
        });
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
            queue: [],
        };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Recipe.StationOpened', {
                Kind: 'Production', StationId: state.stationId,
                Recipes: state.recipes,
                MaterialCounts: TSICPlaygroundInventory.materialCounts(),
            }],
            ['tsic.msg.UI.Recipe.QueueChanged', {
                Kind: 'Production', StationId: state.stationId, Entries: state.queue,
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
        { label: 'Idle',                apply(s) { s.queue = []; }, expect: { visualChange: false } },
        { label: 'One starting',        apply(s) { s.queue = [
            { QueueIndex: 0, RecipeId: 'R_Bread', Progress: 0.05, bIsActive: true },
        ]; } },
        { label: 'One running',         apply(s) { s.queue = [
            { QueueIndex: 0, RecipeId: 'R_Bread', Progress: 0.42, bIsActive: true },
        ]; } },
        { label: 'About to finish',     apply(s) { s.queue = [
            { QueueIndex: 0, RecipeId: 'R_Bread', Progress: 0.95, bIsActive: true },
        ]; } },
        { label: 'Three queued',        apply(s) { s.queue = [
            { QueueIndex: 0, RecipeId: 'R_Bread', Progress: 0.75, bIsActive: true },
            { QueueIndex: 1, RecipeId: 'R_Bread', Progress: 0,    bIsActive: false },
            { QueueIndex: 2, RecipeId: 'R_Nail',  Progress: 0,    bIsActive: false },
        ]; } },
        { label: 'Full queue (6)',      apply(s) { s.queue = Array.from({length: 6}, (_, i) => ({
            QueueIndex: i,
            RecipeId: i % 2 === 0 ? 'R_Bread' : 'R_Nail',
            Progress: i === 0 ? 0.6 : 0,
            bIsActive: i === 0,
        })); } },
        { label: 'Mixed types',         apply(s) { s.queue = [
            { QueueIndex: 0, RecipeId: 'R_Nail',  Progress: 0.3, bIsActive: true  },
            { QueueIndex: 1, RecipeId: 'R_Bread', Progress: 0,   bIsActive: false },
            { QueueIndex: 2, RecipeId: 'R_Nail',  Progress: 0,   bIsActive: false },
            { QueueIndex: 3, RecipeId: 'R_Bread', Progress: 0,   bIsActive: false },
        ]; } },
        { label: 'Insufficient (empty inv)', apply() {
            TSICPlaygroundInventory.reset({ items: [], maxSlots: 32, maxWeight: 30 });
        } },
        // Tick/Complete operate on the queue, but with reset-before-each the
        // queue is empty when these run, so they're no-ops against initial.
        // Useful in interactive playground; visualChange:false in sweep.
        { label: 'Tick +20% prog',      apply(s) {
            const active = s.queue.find(e => e.bIsActive);
            if (active) active.Progress = Math.min(1.0, (active.Progress || 0) + 0.2);
        }, expect: { visualChange: false } },
        { label: 'Complete active',     apply(s) {
            const active = s.queue.find(e => e.bIsActive);
            if (!active) return;
            const recipe = s.recipes.find(r => r.RecipeId === active.RecipeId);
            for (const out of (recipe && recipe.Outputs) || []) {
                TSICPlaygroundInventory.add(out.ItemId, out.Count);
            }
            s.queue.splice(s.queue.indexOf(active), 1);
            s.queue.forEach((e, i) => { e.QueueIndex = i; });
            if (s.queue.length) s.queue[0].bIsActive = true;
        }, expect: { visualChange: false } },
        { label: 'Recipes locked',      apply(s) { s.recipes = s.recipes.map(r => ({ ...r, bStationLevelSufficient: false, RequiredStationLevel: 5 })); } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Recipe.Start' && payload.Kind === 'Production') {
            const recipe = state.recipes.find(r => r.RecipeId === payload.RecipeId);
            if (!recipe || !TSICPlaygroundInventory.canAfford(recipe)) return;
            for (const ing of recipe.Ingredients || []) {
                TSICPlaygroundInventory.consume(ing.ItemId, ing.Count);
            }
            state.queue.push({
                QueueIndex: state.queue.length, RecipeId: recipe.RecipeId,
                Progress: 0, bIsActive: state.queue.length === 0,
            });
        } else if (channel === 'UI.Cmd.Recipe.Cancel' && payload.Kind === 'Production') {
            const idx = state.queue.findIndex(e => e.QueueIndex === payload.QueueIndex);
            if (idx >= 0) {
                const recipe = state.recipes.find(r => r.RecipeId === state.queue[idx].RecipeId);
                for (const ing of (recipe && recipe.Ingredients) || []) {
                    TSICPlaygroundInventory.add(ing.ItemId, ing.Count);
                }
                state.queue.splice(idx, 1);
            }
            state.queue.forEach((e, i) => { e.QueueIndex = i; });
            if (state.queue.length && !state.queue.some(e => e.bIsActive)) state.queue[0].bIsActive = true;
        }
    },
});
