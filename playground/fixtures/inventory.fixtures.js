// /screens/inventory.html subscribes to:
//   tsic.msg.UI.Inventory.Updated  (OwnerId === 'Player' filter)
//   tsic.msg.UI.Equipment.Updated  (OwnerId === 'Player' filter)
//   tsic.msg.UI.CharacterPreview.Ready
//   tsic.msg.UI.Input.IA_UI_AddToHotbar  (hover + IA press → hotbar modal)
//
// This fixture seeds the shared TSICPlaygroundInventory store. The crafting
// / production / repair / upgrade fixtures all read from the same store, so
// crafting bread here actually changes what you see when you reopen the
// inventory screen.
TSICPlayground.register({
    id: 'inventory',
    label: 'Inventory',
    screen: '/screens/inventory.html',
    catalogs: { items: TSICPlaygroundInventory.catalog },
    initialState() {
        TSICPlaygroundInventory.reset({
            items: [
                { ItemId: 'ID_Bread', Count: 3, SlotIndex: 0 },
                { ItemId: 'ID_Wood',  Count: 8, SlotIndex: 1 },
                { ItemId: 'ID_Wheat', Count: 6, SlotIndex: 2 },
                { ItemId: 'ID_Stone', Count: 2, SlotIndex: 3 },
                { ItemId: 'ID_Axe',   Count: 1, SlotIndex: 4 },
            ],
            maxSlots: 32, maxWeight: 30,
        });
        return {
            hotbar: { SlotIndices: [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1], SelectedSlot: 0 },
            equipment: { OwnerId: 'Player', Slots: [] },
        };
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
            ['tsic.msg.UI.Equipment.Updated', { OwnerId: 'Player', Slots: state.equipment.Slots }],
            ['tsic.msg.UI.Hotbar.Changed', state.hotbar],
        ];
    },
    scenarios: [
        { label: 'Empty', apply() { TSICPlaygroundInventory.reset({ items: [], maxSlots: 32, maxWeight: 30 }); } },
        { label: 'One item', apply() {
            TSICPlaygroundInventory.reset({ items: [{ ItemId: 'ID_Bread', Count: 3, SlotIndex: 0 }], maxSlots: 32, maxWeight: 30 });
        } },
        { label: 'Mixed stacks', apply() {
            TSICPlaygroundInventory.reset({ items: [
                { ItemId: 'ID_Bread', Count: 5,  SlotIndex: 0 },
                { ItemId: 'ID_Wood',  Count: 12, SlotIndex: 1 },
                { ItemId: 'ID_Stone', Count: 7,  SlotIndex: 2 },
                { ItemId: 'ID_Wheat', Count: 8,  SlotIndex: 3 },
                { ItemId: 'ID_Rope',  Count: 2,  SlotIndex: 4 },
                { ItemId: 'ID_Hammer',Count: 1,  SlotIndex: 5 },
                { ItemId: 'ID_Coin',  Count: 42, SlotIndex: 6 },
            ], maxSlots: 32, maxWeight: 50 });
        } },
        { label: 'Big stacks (99)', apply() {
            TSICPlaygroundInventory.reset({ items: [
                { ItemId: 'ID_Wood',  Count: 99, SlotIndex: 0 },
                { ItemId: 'ID_Stone', Count: 99, SlotIndex: 1 },
                { ItemId: 'ID_Bread', Count: 99, SlotIndex: 2 },
                { ItemId: 'ID_Wheat', Count: 99, SlotIndex: 3 },
            ], maxSlots: 32, maxWeight: 999 });
        } },
        { label: 'Mostly full grid', apply() {
            TSICPlaygroundInventory.reset({
                items: Array.from({length: 24}, (_, i) => ({
                    ItemId: ['ID_Wood','ID_Stone','ID_Bread','ID_Wheat','ID_Coin','ID_Rope'][i % 6],
                    Count: 1 + (i * 3) % 9,
                    SlotIndex: i,
                })),
                maxSlots: 32, maxWeight: 200,
            });
        } },
        { label: 'Full grid (32/32)', apply() {
            TSICPlaygroundInventory.reset({
                items: Array.from({length: 32}, (_, i) => ({
                    ItemId: ['ID_Wood','ID_Stone','ID_Bread','ID_Wheat','ID_Coin','ID_Iron','ID_Rope','ID_Nail'][i % 8],
                    Count: 1 + (i * 7) % 13,
                    SlotIndex: i,
                })),
                maxSlots: 32, maxWeight: 999,
            });
        } },
        { label: '75% capacity', apply() {
            TSICPlaygroundInventory.reset({ items: [{ ItemId: 'ID_Stone', Count: 11, SlotIndex: 0 }], maxSlots: 32, maxWeight: 30 });
        } },
        { label: 'Overburdened', apply() {
            TSICPlaygroundInventory.reset({
                items: Array.from({length: 8}, (_, i) => ({ ItemId: 'ID_Axe', Count: 1, SlotIndex: i })),
                maxSlots: 32, maxWeight: 10,
            });
        } },
        { label: 'Tiny capacity', apply() {
            TSICPlaygroundInventory.reset({
                items: [
                    { ItemId: 'ID_Bread', Count: 1, SlotIndex: 0 },
                    { ItemId: 'ID_Wood',  Count: 1, SlotIndex: 1 },
                ],
                maxSlots: 4, maxWeight: 3,
            });
        } },
        { label: 'Sparse gaps', apply() {
            TSICPlaygroundInventory.reset({ items: [
                { ItemId: 'ID_Bread', Count: 1,  SlotIndex: 0 },
                { ItemId: 'ID_Wood',  Count: 2,  SlotIndex: 5 },
                { ItemId: 'ID_Stone', Count: 3,  SlotIndex: 10 },
                { ItemId: 'ID_Axe',   Count: 1,  SlotIndex: 31 },
            ], maxSlots: 32, maxWeight: 30 });
        } },
        { label: 'Pickup +bread', apply() { TSICPlaygroundInventory.add('ID_Bread', 1); } },
        { label: 'Equip axe', apply(s) {
            s.equipment.Slots = [{ SlotTag: 'Equipment.MainHand', ItemId: 'ID_Axe' }];
        } },
        { label: 'Equip full kit', apply(s) {
            s.equipment.Slots = [
                { SlotTag: 'Equipment.MainHand', ItemId: 'ID_Axe' },
                { SlotTag: 'Equipment.OffHand',  ItemId: 'ID_Hammer' },
                { SlotTag: 'Equipment.Head',     ItemId: 'ID_Hammer' },
            ];
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Inventory.Drop') {
            TSICPlaygroundInventory.consume(
                (TSICPlaygroundInventory.items().find(i => i.SlotIndex === payload.SlotIndex) || {}).ItemId || '',
                payload.Count || 1
            );
        } else if (channel === 'UI.Cmd.Inventory.Use') {
            TSICPlaygroundInventory.consume(
                (TSICPlaygroundInventory.items().find(i => i.SlotIndex === payload.SlotIndex) || {}).ItemId || '',
                1
            );
        } else if (channel === 'UI.Cmd.Hotbar.Assign') {
            const inventorySlot = parseInt(payload.ItemId, 10);
            const hotbarIndex = payload.SlotIndex;
            if (!Number.isNaN(inventorySlot)) {
                state.hotbar.SlotIndices[hotbarIndex] = inventorySlot;
            }
        } else if (channel === 'UI.Cmd.Equipment.Unequip') {
            state.equipment.Slots = state.equipment.Slots.filter(s => s.SlotTag !== payload.SlotTag);
        }
    },
});
