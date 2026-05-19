TSICTestHarness.register({
    name: 'Hotbar: renders 10 slots and selected highlight',
    file: '/screens/hotbar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Hotbar.Changed', {
            SlotIndices: [101, 102, -1, -1, -1, -1, -1, -1, -1, -1],
            SelectedSlot: 1,
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length === 10);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#hotbar-row .tsic-slot', 10));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#hotbar-row .tsic-slot.selected'));
    },
});

TSICTestHarness.register({
    name: 'Hotbar: clicking a slot publishes Hotbar.Select',
    file: '/screens/hotbar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { SlotIndices: [10, 20, -1, -1, -1, -1, -1, -1, -1, -1], SelectedSlot: 0 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length === 10);
        ctx.clearPublishes();
        const slots = ctx.doc.querySelectorAll('#hotbar-row .tsic-slot');
        slots[2].click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Select', { where: p => p.SlotIndex === 2 }));
    },
});

function makeDt(initialMap) {
    const data = Object.assign({}, initialMap || {});
    return { _data: data, setData(k, v) { data[k] = v; }, getData(k) { return data[k] || ''; } };
}
function dispatchDrag(win, target, type, dt) {
    const ev = new win.Event(type, { bubbles: true, cancelable: true });
    ev.dataTransfer = dt;
    target.dispatchEvent(ev);
}

TSICTestHarness.register({
    name: 'Hotbar/Drag: drop inventory row on a slot publishes Hotbar.Assign',
    file: '/screens/hotbar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { SlotIndices: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1], SelectedSlot: 0 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length === 10);
        ctx.clearPublishes();
        const dt = makeDt({ 'application/tsic-item': JSON.stringify({ slot: 11, itemId: 'ID_Axe' }) });
        const targetSlot = ctx.doc.querySelectorAll('#hotbar-row .tsic-slot')[4];
        dispatchDrag(ctx.win, targetSlot, 'dragover', dt);
        dispatchDrag(ctx.win, targetSlot, 'drop',     dt);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Assign',
            { where: p => p.SlotIndex === 4 && p.ItemId === '11' }));
    },
});

TSICTestHarness.register({
    name: 'Hotbar/Drag: dropping a hotbar slot on another publishes two Hotbar.Assign (swap)',
    file: '/screens/hotbar.html',
    async run(ctx) {
        // Slot 0 has inventory item 50, slot 3 has inventory item 70.
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { SlotIndices: [50, -1, -1, 70, -1, -1, -1, -1, -1, -1], SelectedSlot: 0 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length === 10);
        ctx.clearPublishes();
        // Drag source = slot 0 (inv item 50). Drop on slot 3.
        const dt = makeDt({ 'application/tsic-slot': JSON.stringify({ kind: 'hotbar', slot: 0, inventorySlot: 50 }) });
        const target = ctx.doc.querySelectorAll('#hotbar-row .tsic-slot')[3];
        dispatchDrag(ctx.win, target, 'dragover', dt);
        dispatchDrag(ctx.win, target, 'drop',     dt);
        // Expect: Assign(slot=3, ItemId='50') AND Assign(slot=0, ItemId='70')
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Assign',
            { where: p => p.SlotIndex === 3 && p.ItemId === '50' }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Assign',
            { where: p => p.SlotIndex === 0 && p.ItemId === '70' }));
    },
});

TSICTestHarness.register({
    name: 'Hotbar/Drag: dragging an empty slot does nothing (slot not draggable)',
    file: '/screens/hotbar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { SlotIndices: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1], SelectedSlot: 0 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length === 10);
        const slot = ctx.doc.querySelectorAll('#hotbar-row .tsic-slot')[2];
        ctx.expect(ctx.assert.eq(slot.draggable, false));
    },
});
