// /screens/wardrobe.html subscribes to:
//   tsic.msg.UI.Equipment.Updated  { Slots:[{SlotTag, ItemId, IconUrl}] } - filters to cosmetic/wardrobe/outfit
//   tsic.msg.UI.CharacterPreview.Ready { bReady }
// Click → UI.Cmd.Equipment.Unequip { SlotTag, ItemId }
TSICPlayground.register({
    id: 'wardrobe',
    label: 'Wardrobe',
    screen: '/screens/wardrobe.html',
    catalogs: {
        items: {
            ID_HatBlue: { Name: 'Blue Cap', Category: 'Cosmetic' },
            ID_HatRed:  { Name: 'Red Cap',  Category: 'Cosmetic' },
            ID_Coat:    { Name: 'Coat',     Category: 'Cosmetic' },
        },
    },
    initialState() {
        return {
            slots: [
                { SlotTag: 'Equipment.Cosmetic.Head', ItemId: 'ID_HatBlue', IconUrl: '' },
                { SlotTag: 'Equipment.Cosmetic.Body', ItemId: 'ID_Coat',    IconUrl: '' },
                { SlotTag: 'Equipment.Cosmetic.Feet', ItemId: '',           IconUrl: '' },
            ],
        };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Equipment.Updated', { Slots: state.slots }],
            ['tsic.msg.UI.CharacterPreview.Ready', { bReady: true }],
        ];
    },
    scenarios: [
        { label: 'Default',         apply() {} },
        { label: 'Empty',           apply(s) { s.slots = s.slots.map(slot => ({ ...slot, ItemId: '' })); } },
        { label: 'Hat swap (red)',  apply(s) { s.slots[0].ItemId = 'ID_HatRed'; } },
        { label: 'Full set',        apply(s) {
            s.slots[0].ItemId = 'ID_HatBlue';
            s.slots[1].ItemId = 'ID_Coat';
            s.slots[2].ItemId = 'ID_HatRed'; // placeholder for feet
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Equipment.Unequip') {
            const slot = state.slots.find(s => s.SlotTag === payload.SlotTag);
            if (slot) slot.ItemId = '';
        }
    },
});
