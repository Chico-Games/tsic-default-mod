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
            ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial', Weight: 1 },
            ID_Iron: { Name: 'Iron', Category: 'CraftingMaterial', Weight: 1.5 },
            ID_Coin: { Name: 'Coin', Category: 'CraftingMaterial', Weight: 0.01 },
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
        { label: 'Default',         apply() {} },
        { label: 'Empty universal', apply(s) { s.containers['Universal'].items = []; } },
        { label: 'Full universal',  apply(s) {
            s.containers['Universal'].items = Array.from({length: 30}, (_, i) => ({
                ItemId: 'ID_Wood', Count: 1, SlotIndex: i,
            }));
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Inventory.Transfer') {
            TSICPlaygroundSim.applyTransfer(state, payload.FromOwnerId, payload.ToOwnerId, payload.FromSlot, payload.Count);
        }
    },
});
