// /screens/hotbar.html subscribes to:
//   tsic.msg.UI.Hotbar.Changed       { NumSlots, SelectedSlot, SelectedSlotPending }
//   tsic.msg.UI.Inventory.Updated    (OwnerId === 'Player')
//
// The hotbar is player grid cells 0..NumSlots-1, so its CONTENTS come from the inventory
// snapshot — there is nothing to assign, and a scenario changes the bar by putting items in
// (or out of) the leading cells. Reads inventory state from the shared TSICPlaygroundInventory.
const HOTBAR_SLOTS = 8;

function hotbarItems(list) {
    TSICPlaygroundInventory.reset({ items: list, maxSlots: 32, maxWeight: 50 });
}

TSICPlayground.register({
    id: 'hotbar',
    label: 'Hotbar',
    screen: '/screens/hotbar.html',
    catalogs: { items: TSICPlaygroundInventory.catalog },
    initialState() {
        hotbarItems([
            { ItemId: 'ID_Axe',    Count: 1, SlotIndex: 0 },
            { ItemId: 'ID_Hammer', Count: 1, SlotIndex: 1 },
            { ItemId: 'ID_Bread',  Count: 5, SlotIndex: 2 },
        ]);
        return { hotbar: { NumSlots: HOTBAR_SLOTS, SelectedSlot: 0, SelectedSlotPending: -1 } };
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
        { label: 'Empty', apply() { hotbarItems([]); } },
        { label: 'One item', apply() {
            hotbarItems([{ ItemId: 'ID_Bread', Count: 3, SlotIndex: 0 }]);
        } },
        { label: 'Half-filled', apply() {
            hotbarItems([
                { ItemId: 'ID_Axe',    Count: 1,  SlotIndex: 0 },
                { ItemId: 'ID_Hammer', Count: 1,  SlotIndex: 1 },
                { ItemId: 'ID_Bread',  Count: 5,  SlotIndex: 2 },
                { ItemId: 'ID_Apple',  Count: 2,  SlotIndex: 3 },
                { ItemId: 'ID_Wood',   Count: 10, SlotIndex: 4 },
            ]);
        } },
        { label: 'Full', apply() {
            hotbarItems(Array.from({ length: HOTBAR_SLOTS }, (_, i) => ({
                ItemId: ['ID_Axe', 'ID_Hammer', 'ID_Bread'][i % 3], Count: i + 1, SlotIndex: i,
            })));
        } },
        { label: 'Big stacks', apply() {
            TSICPlaygroundInventory.reset({
                items: [
                    { ItemId: 'ID_Bread', Count: 99, SlotIndex: 0 },
                    { ItemId: 'ID_Wood',  Count: 64, SlotIndex: 1 },
                    { ItemId: 'ID_Stone', Count: 42, SlotIndex: 2 },
                ],
                maxSlots: 32, maxWeight: 200,
            });
        } },
        // Items past the bar must NOT show up on it — the commonest way to break the renderer.
        { label: 'Bag items stay off the bar', apply() {
            hotbarItems([
                { ItemId: 'ID_Axe',   Count: 1,  SlotIndex: 0 },
                { ItemId: 'ID_Wood',  Count: 30, SlotIndex: 12 },
                { ItemId: 'ID_Stone', Count: 8,  SlotIndex: 19 },
            ]);
        } },
        { label: 'Select slot 4', apply(s) { s.hotbar.SelectedSlot = 4; s.hotbar.SelectedSlotPending = -1; } },
        { label: 'Select slot 8 (last)', apply(s) {
            hotbarItems(Array.from({ length: HOTBAR_SLOTS }, (_, i) => ({
                ItemId: ['ID_Axe', 'ID_Hammer', 'ID_Bread'][i % 3], Count: 1, SlotIndex: i,
            })));
            s.hotbar.SelectedSlot = HOTBAR_SLOTS - 1;
            s.hotbar.SelectedSlotPending = -1;
        } },
        { label: 'Select slot 0', apply(s) { s.hotbar.SelectedSlot = 0; s.hotbar.SelectedSlotPending = -1; },
          expect: { visualChange: false } },
        // Stowed: the cell is current but the hands are empty, so it renders muted.
        { label: 'Stowed (fists out)', apply(s) { s.hotbar.SelectedSlot = -1; s.hotbar.SelectedSlotPending = 0; } },
        { label: 'Gaps between items', apply() {
            hotbarItems([
                { ItemId: 'ID_Axe',    Count: 1, SlotIndex: 0 },
                { ItemId: 'ID_Bread',  Count: 3, SlotIndex: 2 },
                { ItemId: 'ID_Hammer', Count: 1, SlotIndex: 5 },
            ]);
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel !== 'UI.Cmd.Hotbar.Select') return;
        // Re-selecting the current cell toggles stow/draw, the way C++ does.
        const current = (state.hotbar.SelectedSlot >= 0) ? state.hotbar.SelectedSlot : state.hotbar.SelectedSlotPending;
        const stowed = state.hotbar.SelectedSlot < 0;
        if (payload.SlotIndex === current && !stowed) {
            state.hotbar.SelectedSlot = -1;
            state.hotbar.SelectedSlotPending = payload.SlotIndex;
            return;
        }
        state.hotbar.SelectedSlot = payload.SlotIndex;
        state.hotbar.SelectedSlotPending = -1;
    },
    // Mouse wheel cycles the selected slot, as it does in game.
    onWheel(state, deltaY) {
        const n = state.hotbar.NumSlots || HOTBAR_SLOTS;
        const dir = deltaY > 0 ? 1 : -1;   // wheel down → next slot
        const cur = (state.hotbar.SelectedSlot >= 0) ? state.hotbar.SelectedSlot
            : (state.hotbar.SelectedSlotPending >= 0 ? state.hotbar.SelectedSlotPending : 0);
        state.hotbar.SelectedSlot = ((cur + dir) % n + n) % n;
        state.hotbar.SelectedSlotPending = -1;
    },
});
