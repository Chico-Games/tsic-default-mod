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
            ID_Iron:  { Name: 'Iron',  Category: 'CraftingMaterial', Weight: 1.5 },
            ID_Bread: { Name: 'Bread', Category: 'Consumable',       Weight: 0.2 },
            ID_Axe:   { Name: 'Axe',   Category: 'Equipment',        Weight: 1.2 },
            ID_Hammer:{ Name: 'Hammer',Category: 'Equipment',        Weight: 1.5 },
            ID_Coin:  { Name: 'Coin',  Category: 'CraftingMaterial', Weight: 0.01 },
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
        { label: 'Default',          apply() {}, expect: { visualChange: false } },
        { label: 'Empty chest',      apply(s) { s.containers['Storage:Chest01'].items = []; } },
        { label: 'Full chest (24)',  apply(s) {
            s.containers['Storage:Chest01'].items = Array.from({length: 24}, (_, i) => ({
                ItemId: ['ID_Wood','ID_Stone','ID_Iron','ID_Bread'][i % 4],
                Count: 1 + (i % 9),
                SlotIndex: i,
            }));
        } },
        { label: 'Player empty',     apply(s) { s.containers['Player'].items = []; } },
        { label: 'Player full',      apply(s) {
            s.containers['Player'].items = Array.from({length: 12}, (_, i) => ({
                ItemId: ['ID_Bread','ID_Wood','ID_Stone'][i % 3], Count: 1, SlotIndex: i,
            }));
        } },
        { label: 'Both stocked',     apply(s) {
            s.containers['Player'].items = [
                { ItemId: 'ID_Bread', Count: 5, SlotIndex: 0 },
                { ItemId: 'ID_Wood',  Count: 2, SlotIndex: 1 },
            ];
            s.containers['Storage:Chest01'].items = [
                { ItemId: 'ID_Stone', Count: 10, SlotIndex: 0 },
                { ItemId: 'ID_Axe',   Count: 1,  SlotIndex: 1 },
                { ItemId: 'ID_Iron',  Count: 6,  SlotIndex: 2 },
                { ItemId: 'ID_Coin',  Count: 42, SlotIndex: 3 },
            ];
        } },
        { label: 'Tiny chest (4)',   apply(s) {
            s.containers['Storage:Chest01'] = {
                items: [
                    { ItemId: 'ID_Bread', Count: 1, SlotIndex: 0 },
                    { ItemId: 'ID_Wood',  Count: 1, SlotIndex: 1 },
                ],
                maxSlots: 4, maxWeight: 10,
            };
        } },
        { label: 'Player overburdened', apply(s) {
            s.containers['Player'].items = Array.from({length: 6}, (_, i) => ({ ItemId: 'ID_Axe', Count: 1, SlotIndex: i }));
            s.containers['Player'].maxWeight = 4;
        } },
        { label: 'Chest near-cap weight', apply(s) {
            s.containers['Storage:Chest01'].items = Array.from({length: 12}, (_, i) => ({
                ItemId: 'ID_Stone', Count: 8, SlotIndex: i,
            }));
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Inventory.Transfer') {
            TSICPlaygroundSim.applyTransfer(state, payload.FromOwnerId, payload.ToOwnerId, payload.FromSlot, payload.Count);
        }
    },
});
