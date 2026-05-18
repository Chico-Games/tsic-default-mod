TSICTestHarness.register({
    name: 'SaveLoad: renders slots and Load publishes',
    file: '/screens/save-load.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Save.Slots', {
            Slots: [
                { SlotId: 's1', Label: 'Slot 1', TimestampIso: '2026-05-18T12:00:00Z' },
                { SlotId: 's2', Label: 'Slot 2', TimestampIso: '2026-05-17T18:30:00Z' },
            ],
        });
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.truthy(ctx.doc.body.textContent.indexOf('Slot 1') >= 0));
        ctx.clearPublishes();
        const load = Array.from(ctx.doc.querySelectorAll('button')).find(b => /load/i.test(b.textContent || ''));
        load && load.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.LoadSlot'));
    },
});
