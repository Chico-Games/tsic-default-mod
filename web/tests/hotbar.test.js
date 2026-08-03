// The hotbar IS player grid cells 0..NumSlots-1. Its contents therefore come from the
// inventory snapshot (Items[].GridSlot), and the Hotbar.Changed payload only carries the
// selection. There is no assignment, no fists cell and no slot-to-slot drag: rearranging the
// bar is rearranging the grid, which the inventory screen does with ordinary moves.

function hotbarSnapshot(items) {
    return { OwnerId: 'Player', MaxSlots: 32, GridWidth: 8, Items: items };
}

TSICTestHarness.register({
    name: 'Hotbar: renders NumSlots cells from the inventory snapshot',
    file: '/screens/hotbar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', hotbarSnapshot([
            { InstanceId: 101, ItemId: 'ID_Axe', Count: 1, GridSlot: 0 },
            { InstanceId: 102, ItemId: 'ID_Bread', Count: 4, GridSlot: 1 },
            // Past the bar — must not appear on it.
            { InstanceId: 103, ItemId: 'ID_Nail', Count: 9, GridSlot: 12 },
        ]));
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: 1, SelectedSlotPending: -1 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length === 8);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#hotbar-row .tsic-slot', 8));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#hotbar-row .tsic-slot.selected'));
        const slots = ctx.doc.querySelectorAll('#hotbar-row .tsic-slot');
        ctx.expect(ctx.assert.truthy(slots[1].classList.contains('selected'),
            'the drawn cell is the one Hotbar.Changed named'));
        ctx.expect(ctx.assert.truthy(slots[0].querySelector('img'), 'cell 0 draws its item'));
        ctx.expect(ctx.assert.falsy(slots[3].querySelector('img'), 'an empty cell draws nothing'));
    },
});

TSICTestHarness.register({
    name: 'Hotbar: the stowed cell renders muted, not drawn',
    file: '/screens/hotbar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', hotbarSnapshot([
            { InstanceId: 101, ItemId: 'ID_Axe', Count: 1, GridSlot: 2 },
        ]));
        // Empty hands on cell 2: stowed, or holding something unholdable.
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: -1, SelectedSlotPending: 2 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length === 8);
        const slots = ctx.doc.querySelectorAll('#hotbar-row .tsic-slot');
        ctx.expect(ctx.assert.truthy(slots[2].classList.contains('selected-inactive'),
            'cell 2 is current but muted'));
        ctx.expect(ctx.assert.falsy(slots[2].classList.contains('selected'),
            'nothing renders as drawn while the hands are empty'));
    },
});

TSICTestHarness.register({
    name: 'Hotbar: clicking a cell publishes Hotbar.Select',
    file: '/screens/hotbar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', hotbarSnapshot([
            { InstanceId: 10, ItemId: 'ID_Axe', Count: 1, GridSlot: 0 },
        ]));
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: 0, SelectedSlotPending: -1 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length === 8);
        ctx.clearPublishes();
        ctx.doc.querySelectorAll('#hotbar-row .tsic-slot')[2].click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Select', { where: p => p.SlotIndex === 2 }));
    },
});

TSICTestHarness.register({
    name: 'Hotbar: clicking the current cell again publishes the same Select (C++ toggles the stow)',
    file: '/screens/hotbar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', hotbarSnapshot([
            { InstanceId: 10, ItemId: 'ID_Axe', Count: 1, GridSlot: 3 },
        ]));
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: 3, SelectedSlotPending: -1 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length === 8);
        ctx.clearPublishes();
        ctx.doc.querySelectorAll('#hotbar-row .tsic-slot')[3].click();
        // The UI never decides stow vs draw — it just names the cell and the server toggles.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Select', { where: p => p.SlotIndex === 3 }));
    },
});

TSICTestHarness.register({
    name: 'Hotbar: cells are not HTML5 drag sources (rearranging is a grid move)',
    file: '/screens/hotbar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', hotbarSnapshot([
            { InstanceId: 10, ItemId: 'ID_Axe', Count: 1, GridSlot: 2 },
        ]));
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: 0, SelectedSlotPending: -1 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length === 8);
        const slots = ctx.doc.querySelectorAll('#hotbar-row .tsic-slot');
        ctx.expect(ctx.assert.falsy(slots[2].draggable, 'a filled cell is not draggable'));
        ctx.expect(ctx.assert.falsy(slots[5].draggable, 'an empty cell is not draggable'));
    },
});

TSICTestHarness.register({
    name: 'Hotbar: a stack count renders, and moving the item off the bar clears the cell',
    file: '/screens/hotbar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', hotbarSnapshot([
            { InstanceId: 77, ItemId: 'ID_Bread', Count: 6, GridSlot: 4 },
        ]));
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: 4, SelectedSlotPending: -1 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot')[4].querySelector('.count'));
        ctx.expect(ctx.assert.eq(
            ctx.doc.querySelectorAll('#hotbar-row .tsic-slot')[4].querySelector('.count').textContent, '6'));

        // Same item, now living in the bag: the bar must empty without any hotbar command.
        ctx.inject('tsic.msg.UI.Inventory.Updated', hotbarSnapshot([
            { InstanceId: 77, ItemId: 'ID_Bread', Count: 6, GridSlot: 19 },
        ]));
        await ctx.waitFor(() => !ctx.doc.querySelectorAll('#hotbar-row .tsic-slot')[4].querySelector('img'));
        ctx.expect(ctx.assert.falsy(
            ctx.doc.querySelectorAll('#hotbar-row .tsic-slot')[4].querySelector('.count'),
            'the cell empties when the stack moves out of it'));
    },
});
