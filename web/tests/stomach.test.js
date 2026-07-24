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

TSICTestHarness.register({
    name: 'Stomach: the slot matching the selected hotbar food is highlighted',
    file: '/screens/stomach.html',
    async run(ctx) {
        // C++ sets bSelected on the digesting slot whose food is in the selected hotbar
        // slot; the component gives exactly that slot the gold highlight.
        ctx.inject('tsic.msg.UI.Stomach.State', {
            Slots: [
                { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 60, RemainingTime: 40, bSelected: false },
                { ItemId: 'ID_Apple', IconUrl: '/tex/item-icon/ID_Apple', Duration: 30, RemainingTime: 20, bSelected: true },
                { ItemId: '', IconUrl: '', Duration: 0, RemainingTime: 0, bSelected: false },
            ],
        });
        await new Promise(r => setTimeout(r, 80));
        const slots = ctx.doc.querySelectorAll('.stomach-slot');
        ctx.expect(ctx.assert.truthy(slots.length >= 2, 'expected the stomach slots rendered'));
        ctx.expect(ctx.assert.truthy(!slots[0].classList.contains('selected'),
            'a slot whose food is not selected stays un-highlighted'));
        ctx.expect(ctx.assert.truthy(slots[1].classList.contains('selected'),
            'the slot matching the selected hotbar food is highlighted'));

        // Selecting nothing (or a different item) clears the highlight.
        ctx.inject('tsic.msg.UI.Stomach.State', {
            Slots: [
                { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 60, RemainingTime: 39, bSelected: false },
                { ItemId: 'ID_Apple', IconUrl: '/tex/item-icon/ID_Apple', Duration: 30, RemainingTime: 19, bSelected: false },
                { ItemId: '', IconUrl: '', Duration: 0, RemainingTime: 0, bSelected: false },
            ],
        });
        await new Promise(r => setTimeout(r, 80));
        const cleared = ctx.doc.querySelectorAll('.stomach-slot');
        ctx.expect(ctx.assert.truthy(!cleared[1].classList.contains('selected'),
            'deselecting the food clears the slot highlight'));
    },
});
