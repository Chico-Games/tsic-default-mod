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
        { label: 'One item',      apply(s) {
            TSICPlaygroundInventory.reset({
                items: [{ ItemId: 'ID_Bread', Count: 3, SlotIndex: 0 }],
                maxSlots: 32, maxWeight: 50,
            });
            s.hotbar.SlotIndices = [0, -1, -1, -1, -1, -1, -1, -1, -1, -1];
        } },
        { label: 'Half-filled',   apply(s) {
            TSICPlaygroundInventory.reset({
                items: [
                    { ItemId: 'ID_Axe',    Count: 1, SlotIndex: 0 },
                    { ItemId: 'ID_Hammer', Count: 1, SlotIndex: 1 },
                    { ItemId: 'ID_Bread',  Count: 5, SlotIndex: 2 },
                    { ItemId: 'ID_Apple',  Count: 2, SlotIndex: 3 },
                    { ItemId: 'ID_Wood',   Count: 10,SlotIndex: 4 },
                ],
                maxSlots: 32, maxWeight: 50,
            });
            s.hotbar.SlotIndices = [0, 1, 2, 3, 4, -1, -1, -1, -1, -1];
        } },
        { label: 'Full',          apply(s) {
            TSICPlaygroundInventory.reset({
                items: Array.from({length: 10}, (_, i) => ({
                    ItemId: ['ID_Axe','ID_Hammer','ID_Bread'][i % 3], Count: i + 1, SlotIndex: i,
                })),
                maxSlots: 32, maxWeight: 50,
            });
            s.hotbar.SlotIndices = Array.from({length: 10}, (_, i) => i);
        } },
        { label: 'Big stacks',    apply(s) {
            TSICPlaygroundInventory.reset({
                items: [
                    { ItemId: 'ID_Bread', Count: 99, SlotIndex: 0 },
                    { ItemId: 'ID_Wood',  Count: 64, SlotIndex: 1 },
                    { ItemId: 'ID_Stone', Count: 42, SlotIndex: 2 },
                ],
                maxSlots: 32, maxWeight: 200,
            });
            s.hotbar.SlotIndices = [0, 1, 2, -1, -1, -1, -1, -1, -1, -1];
        } },
        { label: 'Select slot 4', apply(s) { s.hotbar.SelectedSlot = 4; } },
        { label: 'Select slot 9 (last)', apply(s) {
            TSICPlaygroundInventory.reset({
                items: Array.from({length: 10}, (_, i) => ({
                    ItemId: ['ID_Axe','ID_Hammer','ID_Bread'][i % 3], Count: 1, SlotIndex: i,
                })),
                maxSlots: 32, maxWeight: 50,
            });
            s.hotbar.SlotIndices = Array.from({length: 10}, (_, i) => i);
            s.hotbar.SelectedSlot = 9;
        } },
        { label: 'Select slot 0', apply(s) { s.hotbar.SelectedSlot = 0; }, expect: { visualChange: false } },
        { label: 'Gaps between items', apply(s) {
            TSICPlaygroundInventory.reset({
                items: [
                    { ItemId: 'ID_Axe',    Count: 1, SlotIndex: 0 },
                    { ItemId: 'ID_Bread',  Count: 3, SlotIndex: 2 },
                    { ItemId: 'ID_Hammer', Count: 1, SlotIndex: 5 },
                ],
                maxSlots: 32, maxWeight: 50,
            });
            s.hotbar.SlotIndices = [0, -1, 2, -1, -1, 5, -1, -1, -1, -1];
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Hotbar.Select') state.hotbar.SelectedSlot = payload.SlotIndex;
        if (channel === 'UI.Cmd.Hotbar.Assign') {
            const inventorySlot = parseInt(payload.ItemId, 10);
            if (!Number.isNaN(inventorySlot)) state.hotbar.SlotIndices[payload.SlotIndex] = inventorySlot;
        }
    },
    // Mouse wheel cycles the selected slot, as it does in game.
    onWheel(state, deltaY) {
        const n = (state.hotbar.SlotIndices || []).length || 10;
        const dir = deltaY > 0 ? 1 : -1;   // wheel down → next slot
        const cur = (typeof state.hotbar.SelectedSlot === 'number') ? state.hotbar.SelectedSlot : 0;
        state.hotbar.SelectedSlot = ((cur + dir) % n + n) % n;
    },
});
