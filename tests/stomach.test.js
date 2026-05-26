TSICTestHarness.register({
    name: 'Stomach: 3-slot belly with icons',
    file: '/screens/stomach.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Stomach.State', {
            Slots: [
                { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 60, RemainingTime: 40 },
                { ItemId: 'ID_Apple', IconUrl: '/tex/item-icon/ID_Apple', Duration: 30, RemainingTime: 5  },
                { ItemId: '', IconUrl: '', Duration: 0, RemainingTime: 0 },
            ],
        });
        await new Promise(r => setTimeout(r, 80));
        const slots = ctx.doc.querySelectorAll('.stomach-slot, .belly-slot, [data-slot]');
        ctx.expect(ctx.assert.truthy(slots.length >= 1, 'expected at least one stomach slot rendered'));
    },
});
