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

TSICTestHarness.register({
    name: 'SaveLoad: mode stamp reads the resolved definition; Classic shows none; a missing mod shows the raw id',
    file: '/screens/save-load.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Save.Slots', { Slots: [
            { SlotId: 'a', Label: 'A', TimestampIso: '', PlaytimeSeconds: 0, GameModeId: 'GM_Snail', GameModeDisplayName: 'Snail', bEndsRunOnDeath: true },
            { SlotId: 'b', Label: 'B', TimestampIso: '', PlaytimeSeconds: 0, GameModeId: 'GM_Classic', GameModeDisplayName: 'Classic', bEndsRunOnDeath: false },
            { SlotId: 'c', Label: 'C', TimestampIso: '', PlaytimeSeconds: 0, GameModeId: 'GM_Hound', GameModeDisplayName: '', bEndsRunOnDeath: false },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.slot-mode').length >= 2);
        const stamps = Array.from(ctx.doc.querySelectorAll('.slot-mode')).map(e => e.textContent);
        ctx.expect(ctx.assert.eq(stamps.length, 2, 'Classic carries no stamp'));
        ctx.expect(ctx.assert.eq(stamps[0], 'Snail · Ironman'));
        ctx.expect(ctx.assert.eq(stamps[1], 'GM_Hound · mod missing'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('.slot-mode').dataset.endsRun, 'true'));
    },
});
