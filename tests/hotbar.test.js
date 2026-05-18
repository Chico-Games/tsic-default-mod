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
