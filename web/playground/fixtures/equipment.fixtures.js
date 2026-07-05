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
        ID_Coat:   { Name: 'Coat',   Category: 'Equipment' },
        ID_Boots:  { Name: 'Boots',  Category: 'Equipment' },
        ID_Ring:   { Name: 'Ring',   Category: 'Equipment' },
    } },
    initialState() { return { slots: [
        { SlotTag: 'Equipment.MainHand', ItemId: 'ID_Axe' },
        { SlotTag: 'Equipment.OffHand',  ItemId: '' },
        { SlotTag: 'Equipment.Head',     ItemId: 'ID_Hat' },
        { SlotTag: 'Equipment.Body',     ItemId: '' },
        { SlotTag: 'Equipment.Feet',     ItemId: '' },
    ] }; },
    project(s) { return [['tsic.msg.UI.Equipment.Updated', { Slots: s.slots }]]; },
    scenarios: [
        { label: 'Default',         apply() {}, expect: { visualChange: false } },
        { label: 'Dual wield',      apply(s) {
            const find = tag => s.slots.find(x => x.SlotTag === tag);
            find('Equipment.MainHand').ItemId = 'ID_Axe';
            find('Equipment.OffHand').ItemId  = 'ID_Hammer';
        } },
        { label: 'Two-handed (off empty)', apply(s) {
            const find = tag => s.slots.find(x => x.SlotTag === tag);
            find('Equipment.MainHand').ItemId = 'ID_Hammer';
            find('Equipment.OffHand').ItemId  = '';
        } },
        { label: 'Helmet only',     apply(s) { s.slots = s.slots.map(x => ({ ...x, ItemId: x.SlotTag === 'Equipment.Head' ? 'ID_Hat' : '' })); } },
        { label: 'Full kit',        apply(s) {
            s.slots = [
                { SlotTag: 'Equipment.MainHand', ItemId: 'ID_Axe' },
                { SlotTag: 'Equipment.OffHand',  ItemId: 'ID_Hammer' },
                { SlotTag: 'Equipment.Head',     ItemId: 'ID_Hat' },
                { SlotTag: 'Equipment.Body',     ItemId: 'ID_Coat' },
                { SlotTag: 'Equipment.Feet',     ItemId: 'ID_Boots' },
            ];
        } },
        { label: 'With accessory',  apply(s) {
            s.slots = [
                { SlotTag: 'Equipment.MainHand', ItemId: 'ID_Axe' },
                { SlotTag: 'Equipment.OffHand',  ItemId: '' },
                { SlotTag: 'Equipment.Head',     ItemId: 'ID_Hat' },
                { SlotTag: 'Equipment.Body',     ItemId: 'ID_Coat' },
                { SlotTag: 'Equipment.Feet',     ItemId: 'ID_Boots' },
                { SlotTag: 'Equipment.Ring',     ItemId: 'ID_Ring' },
            ];
        } },
        { label: 'Empty',           apply(s) { s.slots = s.slots.map(x => ({ ...x, ItemId: '' })); } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Equipment.Unequip') {
            const slot = state.slots.find(s => s.SlotTag === payload.SlotTag);
            if (slot) slot.ItemId = '';
        }
    },
});
