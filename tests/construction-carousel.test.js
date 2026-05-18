TSICTestHarness.register({
    name: 'ConstructionCarousel: renders 9-slot strip with current highlighted',
    file: '/screens/construction-carousel.html',
    async run(ctx) {
        const slot = (id, label, ok = true) => ({ FurnitureId: id, IconUrl: '', Label: label, bAffordable: ok });
        ctx.inject('tsic.msg.UI.Construction.Carousel', {
            Prev: [slot('A','A'), slot('B','B'), slot('C','C'), slot('D','D')],
            Current: slot('E','E'),
            Next: [slot('F','F'), slot('G','G'), slot('H','H', false), slot('I','I')],
            RotationAxis: 'Z',
            BlockedReason: '',
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#cc-row .cc-slot').length === 9);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#cc-row .cc-slot.current', 1));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#cc-row .cc-slot.unafford', 1));
        ctx.expect(ctx.assert.domText(ctx.doc, '#cc-rotation', 'ROTATION: Z'));
    },
});

TSICTestHarness.register({
    name: 'ConstructionCarousel: blocked reason surfaces',
    file: '/screens/construction-carousel.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.Carousel', {
            Prev: [], Current: { FurnitureId: 'X', Label: 'X', bAffordable: false }, Next: [],
            BlockedReason: 'no clearance',
        });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.domText(ctx.doc, '#cc-blocked', /NO CLEARANCE/));
    },
});
