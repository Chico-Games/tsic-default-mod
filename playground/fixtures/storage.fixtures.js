// /screens/storage.html mounts shared/storage-shell.js with:
//   containerOwnerIdMatch: id => id.startsWith('Storage:')
// Both panes are driven by tsic.msg.UI.Inventory.Updated, filtered by OwnerId.
// Player container OwnerId === 'Player'. Storage container any 'Storage:*'.
// Click an item → UI.Cmd.Inventory.Transfer.
TSICPlayground.register({
    id: 'storage',
    label: 'Storage',
    screen: '/screens/storage.html',
    catalogs: {
        items: {
            ID_Wood:  { Name: 'Wood',  Category: 'CraftingMaterial', Weight: 1 },
            ID_Stone: { Name: 'Stone', Category: 'CraftingMaterial', Weight: 2 },
            ID_Bread: { Name: 'Bread', Category: 'Consumable',       Weight: 0.2 },
            ID_Axe:   { Name: 'Axe',   Category: 'Equipment',        Weight: 1.2 },
        },
    },
    initialState() {
        return {
            containers: {
                'Player': {
                    items: [
                        { ItemId: 'ID_Bread', Count: 2, SlotIndex: 0 },
                        { ItemId: 'ID_Axe',   Count: 1, SlotIndex: 1 },
                    ],
                    maxSlots: 32, maxWeight: 30,
                },
                'Storage:Chest01': {
                    items: [
                        { ItemId: 'ID_Wood',  Count: 9, SlotIndex: 0 },
                        { ItemId: 'ID_Stone', Count: 4, SlotIndex: 1 },
                    ],
                    maxSlots: 24, maxWeight: 200,
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
        { label: 'Default',       apply() {} },
        { label: 'Empty chest',   apply(s) { s.containers['Storage:Chest01'].items = []; } },
        { label: 'Full chest',    apply(s) {
            s.containers['Storage:Chest01'].items = Array.from({length: 24}, (_, i) => ({
                ItemId: 'ID_Wood', Count: 1, SlotIndex: i,
            }));
        } },
        { label: 'Player empty',  apply(s) { s.containers['Player'].items = []; } },
        { label: 'Both stocked',  apply(s) {
            s.containers['Player'].items = [
                { ItemId: 'ID_Bread', Count: 5, SlotIndex: 0 },
                { ItemId: 'ID_Wood',  Count: 2, SlotIndex: 1 },
            ];
            s.containers['Storage:Chest01'].items = [
                { ItemId: 'ID_Stone', Count: 10, SlotIndex: 0 },
                { ItemId: 'ID_Axe',   Count: 1,  SlotIndex: 1 },
            ];
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Inventory.Transfer') {
            TSICPlaygroundSim.applyTransfer(state, payload.FromOwnerId, payload.ToOwnerId, payload.FromSlot, payload.Count);
        }
    },
});
