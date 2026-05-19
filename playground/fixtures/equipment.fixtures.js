// /screens/equipment.html subscribes to:
//   tsic.msg.UI.Equipment.Updated  { Slots:[{SlotTag, ItemId, IconUrl}] }
TSICPlayground.register({
    id: 'equipment',
    label: 'Equipment',
    screen: '/screens/equipment.html',
    catalogs: { items: {
        ID_Axe:    { Name: 'Axe',    Category: 'Equipment' },
        ID_Hammer: { Name: 'Hammer', Category: 'Equipment' },
        ID_Hat:    { Name: 'Hat',    Category: 'Equipment' },
    } },
    initialState() { return { slots: [
        { SlotTag: 'Equipment.MainHand', ItemId: 'ID_Axe' },
        { SlotTag: 'Equipment.OffHand',  ItemId: '' },
        { SlotTag: 'Equipment.Head',     ItemId: 'ID_Hat' },
    ] }; },
    project(s) { return [['tsic.msg.UI.Equipment.Updated', { Slots: s.slots }]]; },
    scenarios: [
        { label: 'Default',     apply() {} },
        { label: 'Dual wield',  apply(s) { s.slots[0].ItemId = 'ID_Axe'; s.slots[1].ItemId = 'ID_Hammer'; } },
        { label: 'Empty',       apply(s) { s.slots = s.slots.map(x => ({ ...x, ItemId: '' })); } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Equipment.Unequip') {
            const slot = state.slots.find(s => s.SlotTag === payload.SlotTag);
            if (slot) slot.ItemId = '';
        }
    },
});
