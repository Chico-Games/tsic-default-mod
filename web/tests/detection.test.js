TSICTestHarness.register({
    name: 'Detection: renders per-enemy edge threats',
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
        const threats = ctx.doc.querySelectorAll('#threats .arc');
        ctx.expect(ctx.assert.truthy(threats.length >= 1, `expected enemy markers, got ${threats.length}`));
    },
});

TSICTestHarness.register({
    name: 'Detection: empty state clears markers',
    file: '/screens/detection.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Detection.State', { Enemies: [], ScreenMist: 0 });
        await new Promise(r => setTimeout(r, 80));
        const threats = ctx.doc.querySelectorAll('#threats .arc');
        ctx.expect(ctx.assert.eq(threats.length, 0));
    },
});
