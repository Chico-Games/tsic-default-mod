TSICTestHarness.register({
    name: 'SaveLoad: renders slots and clicking the row publishes LoadSlot',
    file: '/screens/save-load.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Save.Slots', {
            Slots: [
                { SlotId: 's1', Label: 'Slot 1', TimestampIso: '2026-05-18T12:00:00Z' },
                { SlotId: 's2', Label: 'Slot 2', TimestampIso: '2026-05-17T18:30:00Z' },
            ],
        });
        await new Promise(r => setTimeout(r, 80));
        const rows = ctx.doc.querySelectorAll('#slots .save-slot');
        ctx.expect(ctx.assert.truthy(rows.length === 2));
        ctx.clearPublishes();
        rows[0].click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.LoadSlot',
            { where: p => p.SlotId === 's1' }));
    },
});
