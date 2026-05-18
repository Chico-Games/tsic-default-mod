TSICTestHarness.register({
    name: 'Detection: renders per-enemy rings',
    file: '/screens/detection.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Detection.State', {
            Enemies: [
                { EntityId: 1, DetectionScore: 0.4, BearingDeg: 30 },
                { EntityId: 2, DetectionScore: 0.9, BearingDeg: -120 },
            ],
            ScreenMist: 0.3,
        });
        await new Promise(r => setTimeout(r, 80));
        const eyes = ctx.doc.querySelectorAll('.det-eye, .det, [data-entity]');
        ctx.expect(ctx.assert.truthy(eyes.length >= 1, 'expected enemy markers in detection page'));
    },
});

TSICTestHarness.register({
    name: 'Detection: empty state clears markers',
    file: '/screens/detection.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Detection.State', { Enemies: [], ScreenMist: 0 });
        await new Promise(r => setTimeout(r, 80));
        const eyes = ctx.doc.querySelectorAll('.det-eye, .det');
        ctx.expect(ctx.assert.eq(eyes.length, 0));
    },
});
