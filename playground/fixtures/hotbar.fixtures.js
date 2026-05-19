// /screens/hotbar.html subscribes to:
//   tsic.msg.UI.Hotbar.Changed       { SlotIndices, SelectedSlot }
//   tsic.msg.UI.Inventory.Updated    (OwnerId === 'Player')
// Clicks publish:
//   UI.Cmd.Hotbar.Select  { SlotIndex }
TSICPlayground.register({
    id: 'hotbar',
    label: 'Hotbar',
    screen: '/screens/hotbar.html',
    catalogs: { items: {
        ID_Axe:    { Name: 'Axe',    Category: 'Equipment' },
        ID_Hammer: { Name: 'Hammer', Category: 'Equipment' },
        ID_Bread:  { Name: 'Bread',  Category: 'Consumable' },
    } },
    initialState() {
        return {
            hotbar: { SlotIndices: [0, 1, 2, -1, -1, -1, -1, -1, -1, -1], SelectedSlot: 0 },
            items: [
                { ItemId: 'ID_Axe',    Count: 1, SlotIndex: 0 },
                { ItemId: 'ID_Hammer', Count: 1, SlotIndex: 1 },
                { ItemId: 'ID_Bread',  Count: 5, SlotIndex: 2 },
            ],
        };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Inventory.Updated', {
                OwnerId: 'Player', Items: state.items,
                MaxSlots: 32, MaxWeight: 50, CurrentWeight: 0,
            }],
            ['tsic.msg.UI.Hotbar.Changed', state.hotbar],
        ];
    },
    scenarios: [
        { label: 'Empty',         apply(s) { s.hotbar.SlotIndices = Array(10).fill(-1); } },
        { label: 'Full',          apply(s) {
            s.items = Array.from({length: 10}, (_, i) => ({
                ItemId: ['ID_Axe','ID_Hammer','ID_Bread'][i % 3], Count: i + 1, SlotIndex: i,
            }));
            s.hotbar.SlotIndices = Array.from({length: 10}, (_, i) => i);
        } },
        { label: 'Select slot 4', apply(s) { s.hotbar.SelectedSlot = 4; } },
        { label: 'Select slot 0', apply(s) { s.hotbar.SelectedSlot = 0; } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Hotbar.Select') TSICPlaygroundSim.applyHotbarSelect(state, payload.SlotIndex);
    },
});
