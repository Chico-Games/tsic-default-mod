TSICTestHarness.register({
    name: 'HealthBar: numbers div renders "current / max"',
    file: '/screens/health-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Player.Attribute', { Channel: 'Health', Current: 70, Max: 100 });
        await ctx.waitFor(() => /70 \/ 100/.test(ctx.doc.getElementById('numbers').textContent), { timeout: 2000 });
        ctx.expect(ctx.assert.domText(ctx.doc, '#numbers', /70 \/ 100/));
    },
});

TSICTestHarness.register({
    name: 'HealthBar: zero current still renders 0 / max',
    file: '/screens/health-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Player.Attribute', { Channel: 'Health', Current: 0, Max: 100 });
        await ctx.waitFor(() => /0 \/ 100/.test(ctx.doc.getElementById('numbers').textContent), { timeout: 2000 });
        ctx.expect(ctx.assert.domText(ctx.doc, '#numbers', /0 \/ 100/));
    },
});
