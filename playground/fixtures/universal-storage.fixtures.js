// /screens/universal-storage.html mounts storage-shell with:
//   containerOwnerIdMatch: id => id === 'Universal'
//   containerInitialOwnerId: 'Universal'
// So container OwnerId must be exactly 'Universal'.
TSICPlayground.register({
    id: 'universal-storage',
    label: 'Universal Storage',
    screen: '/screens/universal-storage.html',
    catalogs: {
        items: {
            ID_Wood:  { Name: 'Wood',  Category: 'CraftingMaterial', Weight: 1 },
            ID_Iron:  { Name: 'Iron',  Category: 'CraftingMaterial', Weight: 1.5 },
            ID_Stone: { Name: 'Stone', Category: 'CraftingMaterial', Weight: 2 },
            ID_Coin:  { Name: 'Coin',  Category: 'CraftingMaterial', Weight: 0.01 },
            ID_Bread: { Name: 'Bread', Category: 'Consumable',       Weight: 0.2 },
        },
    },
    initialState() {
        return {
            containers: {
                'Player':    {
                    items: [{ ItemId: 'ID_Coin', Count: 50, SlotIndex: 0 }],
                    maxSlots: 32, maxWeight: 30,
                },
                'Universal': {
                    items: [
                        { ItemId: 'ID_Wood', Count: 24, SlotIndex: 0 },
                        { ItemId: 'ID_Iron', Count: 6,  SlotIndex: 1 },
                    ],
                    maxSlots: 64, maxWeight: 500,
                },
            },
        };
    },
    project(state) {
        const items = this.catalogs.items;
        const out = [];
        for (const [ownerId, c] of Object.entries(state.containers)) {
            out.push(['tsic.msg.UI.Inventory.Updated', {
                OwnerId: ownerId, Items: c.items,
                MaxSlots: c.maxSlots, MaxWeight: c.maxWeight,
                CurrentWeight: TSICPlaygroundSim.recomputeWeight(c.items, items),
            }]);
        }
        return out;
    },
    scenarios: [
        { label: 'Default',          apply() {}, expect: { visualChange: false } },
        { label: 'Empty universal',  apply(s) { s.containers['Universal'].items = []; } },
        { label: 'Half-full universal', apply(s) {
            s.containers['Universal'].items = Array.from({length: 32}, (_, i) => ({
                ItemId: ['ID_Wood','ID_Iron','ID_Stone','ID_Coin','ID_Bread'][i % 5],
                Count: 1 + (i % 12), SlotIndex: i,
            }));
        } },
        { label: 'Full universal',   apply(s) {
            s.containers['Universal'].items = Array.from({length: 64}, (_, i) => ({
                ItemId: ['ID_Wood','ID_Iron','ID_Stone','ID_Coin','ID_Bread'][i % 5],
                Count: 1, SlotIndex: i,
            }));
        } },
        { label: 'Coin-only stash',  apply(s) {
            s.containers['Universal'].items = [
                { ItemId: 'ID_Coin', Count: 999, SlotIndex: 0 },
                { ItemId: 'ID_Coin', Count: 250, SlotIndex: 1 },
            ];
        } },
        { label: 'Player empty',     apply(s) { s.containers['Player'].items = []; } },
        { label: 'Player overflow',  apply(s) {
            s.containers['Player'].items = Array.from({length: 8}, (_, i) => ({ ItemId: 'ID_Stone', Count: 5, SlotIndex: i }));
            s.containers['Player'].maxWeight = 20;
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Inventory.Transfer') {
            TSICPlaygroundSim.applyTransfer(state, payload.FromOwnerId, payload.ToOwnerId, payload.FromSlot, payload.Count);
        }
    },
});
