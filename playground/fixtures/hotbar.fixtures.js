// /screens/hotbar.html subscribes to:
//   tsic.msg.UI.Hotbar.Changed       { SlotIndices, SelectedSlot }
//   tsic.msg.UI.Inventory.Updated    (OwnerId === 'Player')
// Reads inventory state from the shared TSICPlaygroundInventory.
TSICPlayground.register({
    id: 'hotbar',
    label: 'Hotbar',
    screen: '/screens/hotbar.html',
    catalogs: { items: TSICPlaygroundInventory.catalog },
    initialState() {
        TSICPlaygroundInventory.reset({
            items: [
                { ItemId: 'ID_Axe',    Count: 1, SlotIndex: 0 },
                { ItemId: 'ID_Hammer', Count: 1, SlotIndex: 1 },
                { ItemId: 'ID_Bread',  Count: 5, SlotIndex: 2 },
            ],
            maxSlots: 32, maxWeight: 50,
        });
        return { hotbar: { SlotIndices: [0, 1, 2, -1, -1, -1, -1, -1, -1, -1], SelectedSlot: 0 } };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Inventory.Updated', {
                OwnerId: 'Player',
                Items: TSICPlaygroundInventory.items(),
                MaxSlots: TSICPlaygroundInventory.maxSlots(),
                MaxWeight: TSICPlaygroundInventory.maxWeight(),
                CurrentWeight: TSICPlaygroundInventory.currentWeight(),
            }],
            ['tsic.msg.UI.Hotbar.Changed', state.hotbar],
        ];
    },
    scenarios: [
        { label: 'Empty',         apply(s) { s.hotbar.SlotIndices = Array(10).fill(-1); } },
        { label: 'Full',          apply(s) {
            TSICPlaygroundInventory.reset({
                items: Array.from({length: 10}, (_, i) => ({
                    ItemId: ['ID_Axe','ID_Hammer','ID_Bread'][i % 3], Count: i + 1, SlotIndex: i,
                })),
                maxSlots: 32, maxWeight: 50,
            });
            s.hotbar.SlotIndices = Array.from({length: 10}, (_, i) => i);
        } },
        { label: 'Select slot 4', apply(s) { s.hotbar.SelectedSlot = 4; } },
        { label: 'Select slot 0', apply(s) { s.hotbar.SelectedSlot = 0; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Hotbar.Select') state.hotbar.SelectedSlot = payload.SlotIndex;
        if (channel === 'UI.Cmd.Hotbar.Assign') {
            const inventorySlot = parseInt(payload.ItemId, 10);
            if (!Number.isNaN(inventorySlot)) state.hotbar.SlotIndices[payload.SlotIndex] = inventorySlot;
        }
    },
});
