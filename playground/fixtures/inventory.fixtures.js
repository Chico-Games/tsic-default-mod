// /screens/inventory.html subscribes to:
//   tsic.msg.UI.Inventory.Updated  (OwnerId === 'Player' filter)
//   tsic.msg.UI.Equipment.Updated  (OwnerId === 'Player' filter)
//   tsic.msg.UI.CharacterPreview.Ready
//   tsic.msg.UI.Input.IA_UI_AddToHotbar  (hover + IA press → hotbar modal)
//
// Outgoing it publishes:
//   UI.Cmd.Inventory.Use     { OwnerId, SlotIndex }
//   UI.Cmd.Inventory.Drop    { OwnerId, SlotIndex, Count }
//   UI.Cmd.Inventory.Transfer{ FromOwnerId, ToOwnerId, FromSlot, ToSlot, Count }
//   UI.Cmd.Equipment.Unequip { ItemId, SlotTag }
//   UI.Cmd.Hotbar.Assign     { SlotIndex:<hotbarIndex>, ItemId:String(<inventorySlot>) }
//   UI.Cmd.CharacterPreview.{Show,Hide}
//   UI.Cmd.Pause.Resume
TSICPlayground.register({
    id: 'inventory',
    label: 'Inventory',
    screen: '/screens/inventory.html',
    catalogs: {
        items: {
            ID_Bread:  { Name: 'Bread',  Category: 'Consumable',       Weight: 0.2, Description: 'Filling, dry.' },
            ID_Wood:   { Name: 'Wood',   Category: 'CraftingMaterial', Weight: 1.0 },
            ID_Stone:  { Name: 'Stone',  Category: 'CraftingMaterial', Weight: 2.0 },
            ID_Axe:    { Name: 'Axe',    Category: 'Equipment',        Weight: 1.2 },
            ID_Hammer: { Name: 'Hammer', Category: 'Equipment',        Weight: 1.5 },
            ID_Rope:   { Name: 'Rope',   Category: 'CraftingMaterial', Weight: 0.3 },
            ID_Coin:   { Name: 'Coin',   Category: 'CraftingMaterial', Weight: 0.01 },
        },
    },
    initialState() {
        return {
            items: [
                { ItemId: 'ID_Bread', Count: 3, SlotIndex: 0 },
                { ItemId: 'ID_Wood',  Count: 8, SlotIndex: 1 },
                { ItemId: 'ID_Axe',   Count: 1, SlotIndex: 2 },
            ],
            maxSlots: 32,
            maxWeight: 30,
            hotbar: { SlotIndices: [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1], SelectedSlot: 0 },
            equipment: { OwnerId: 'Player', Slots: [] },
        };
    },
    project(state) {
        const items = this.catalogs.items;
        const cw = TSICPlaygroundSim.recomputeWeight(state.items, items);
        return [
            ['tsic.msg.UI.Inventory.Updated', {
                OwnerId: 'Player', Items: state.items,
                MaxSlots: state.maxSlots, MaxWeight: state.maxWeight, CurrentWeight: cw,
            }],
            ['tsic.msg.UI.Equipment.Updated', { OwnerId: 'Player', Slots: state.equipment.Slots }],
            ['tsic.msg.UI.Hotbar.Changed', state.hotbar],
        ];
    },
    scenarios: [
        { label: 'Empty',         apply(s) { s.items = []; } },
        { label: 'One item',      apply(s) { s.items = [{ ItemId: 'ID_Bread', Count: 3, SlotIndex: 0 }]; } },
        { label: 'Mixed stacks',  apply(s) { s.items = [
            { ItemId: 'ID_Bread', Count: 5,  SlotIndex: 0 },
            { ItemId: 'ID_Wood',  Count: 12, SlotIndex: 1 },
            { ItemId: 'ID_Stone', Count: 7,  SlotIndex: 2 },
            { ItemId: 'ID_Rope',  Count: 2,  SlotIndex: 3 },
            { ItemId: 'ID_Hammer',Count: 1,  SlotIndex: 4 },
            { ItemId: 'ID_Coin',  Count: 42, SlotIndex: 5 },
        ]; } },
        { label: '75% capacity',  apply(s) { s.maxWeight = 30; s.items = [
            { ItemId: 'ID_Stone', Count: 11, SlotIndex: 0 },
        ]; } },
        { label: 'Overburdened',  apply(s) { s.maxWeight = 10; s.items = Array.from({length: 8}, (_, i) => ({
            ItemId: 'ID_Axe', Count: 1, SlotIndex: i,
        })); } },
        { label: 'Pickup +bread', apply(s) {
            const slot = TSICPlaygroundSim.firstFreeSlot(s.items);
            s.items.push({ ItemId: 'ID_Bread', Count: 1, SlotIndex: slot });
        } },
        { label: 'Equip axe', apply(s) {
            s.equipment.Slots = [{ SlotTag: 'Equipment.MainHand', ItemId: 'ID_Axe' }];
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Inventory.Drop') {
            TSICPlaygroundSim.applyConsume(state, payload.SlotIndex, payload.Count || 1);
        } else if (channel === 'UI.Cmd.Inventory.Use') {
            TSICPlaygroundSim.applyConsume(state, payload.SlotIndex, 1);
        } else if (channel === 'UI.Cmd.Hotbar.Assign') {
            const inventorySlot = parseInt(payload.ItemId, 10);
            const hotbarIndex = payload.SlotIndex;
            if (!Number.isNaN(inventorySlot)) {
                TSICPlaygroundSim.applyHotbarAssign(state, hotbarIndex, inventorySlot);
            }
        } else if (channel === 'UI.Cmd.Equipment.Unequip') {
            state.equipment.Slots = state.equipment.Slots.filter(s => s.SlotTag !== payload.SlotTag);
        }
    },
});
