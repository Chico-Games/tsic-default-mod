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
            ID_HatBlue:  { Name: 'Blue Cap',   Category: 'Cosmetic' },
            ID_HatRed:   { Name: 'Red Cap',    Category: 'Cosmetic' },
            ID_HatGold:  { Name: 'Gold Crown', Category: 'Cosmetic' },
            ID_Coat:     { Name: 'Coat',       Category: 'Cosmetic' },
            ID_Robe:     { Name: 'Robe',       Category: 'Cosmetic' },
            ID_BootsBlk: { Name: 'Black Boots',Category: 'Cosmetic' },
            ID_BootsBrn: { Name: 'Brown Boots',Category: 'Cosmetic' },
            ID_Gloves:   { Name: 'Gloves',     Category: 'Cosmetic' },
        },
    },
    initialState() {
        return {
            slots: [
                { SlotTag: 'Equipment.Cosmetic.Head',  ItemId: 'ID_HatBlue',  IconUrl: '' },
                { SlotTag: 'Equipment.Cosmetic.Body',  ItemId: 'ID_Coat',     IconUrl: '' },
                { SlotTag: 'Equipment.Cosmetic.Feet',  ItemId: '',            IconUrl: '' },
                { SlotTag: 'Equipment.Cosmetic.Hands', ItemId: '',            IconUrl: '' },
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
        { label: 'Default',          apply() {}, expect: { visualChange: false } },
        { label: 'Empty',            apply(s) { s.slots = s.slots.map(slot => ({ ...slot, ItemId: '' })); } },
        { label: 'Hat swap (red)',   apply(s) {
            const head = s.slots.find(x => x.SlotTag === 'Equipment.Cosmetic.Head');
            if (head) head.ItemId = 'ID_HatRed';
        } },
        { label: 'Hat swap (gold)',  apply(s) {
            const head = s.slots.find(x => x.SlotTag === 'Equipment.Cosmetic.Head');
            if (head) head.ItemId = 'ID_HatGold';
        } },
        { label: 'Robe outfit',      apply(s) {
            const find = tag => s.slots.find(x => x.SlotTag === tag);
            find('Equipment.Cosmetic.Head').ItemId = 'ID_HatGold';
            find('Equipment.Cosmetic.Body').ItemId = 'ID_Robe';
            find('Equipment.Cosmetic.Feet').ItemId = 'ID_BootsBlk';
        } },
        { label: 'Full set',         apply(s) {
            const find = tag => s.slots.find(x => x.SlotTag === tag);
            find('Equipment.Cosmetic.Head').ItemId  = 'ID_HatBlue';
            find('Equipment.Cosmetic.Body').ItemId  = 'ID_Coat';
            find('Equipment.Cosmetic.Feet').ItemId  = 'ID_BootsBrn';
            find('Equipment.Cosmetic.Hands').ItemId = 'ID_Gloves';
        } },
        { label: 'Mismatched palette', apply(s) {
            const find = tag => s.slots.find(x => x.SlotTag === tag);
            find('Equipment.Cosmetic.Head').ItemId  = 'ID_HatRed';
            find('Equipment.Cosmetic.Body').ItemId  = 'ID_Robe';
            find('Equipment.Cosmetic.Feet').ItemId  = 'ID_BootsBrn';
            find('Equipment.Cosmetic.Hands').ItemId = 'ID_Gloves';
        } },
        { label: 'Hat only',         apply(s) {
            s.slots = s.slots.map(slot => ({ ...slot, ItemId: slot.SlotTag === 'Equipment.Cosmetic.Head' ? 'ID_HatBlue' : '' }));
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Equipment.Unequip') {
            const slot = state.slots.find(s => s.SlotTag === payload.SlotTag);
            if (slot) slot.ItemId = '';
        }
    },
});
