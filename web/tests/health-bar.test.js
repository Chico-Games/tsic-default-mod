TSICTestHarness.register({
    name: 'HealthBar: readout renders "current / max"',
    file: '/screens/test-health-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Player.Attribute', { Channel: 'Health', Current: 70, Max: 100 });
        await ctx.waitFor(() => /70 \/ 100/.test((ctx.doc.querySelector('.tlb-readout') || {}).textContent || ''), { timeout: 2000 });
        ctx.expect(ctx.assert.domText(ctx.doc, '.tlb-readout', /70 \/ 100/));
    },
});

TSICTestHarness.register({
    name: 'HealthBar: zero current still renders 0 / max',
    file: '/screens/test-health-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Player.Attribute', { Channel: 'Health', Current: 0, Max: 100 });
        await ctx.waitFor(() => /0 \/ 100/.test((ctx.doc.querySelector('.tlb-readout') || {}).textContent || ''), { timeout: 2000 });
        ctx.expect(ctx.assert.domText(ctx.doc, '.tlb-readout', /0 \/ 100/));
    },
});
