TSICTestHarness.register({
    name: 'HealthBar: numbers div renders "current / max"',
    file: '/screens/health-bar.html',
    async run(ctx) {
        // The page reads p.current / p.max (lowercase) from the attribute channel.
        ctx.inject('tsic.attr.player.health', { current: 70, max: 100 });
        // jsdom doesn't tick requestAnimationFrame, so manually advance via the
        // page's internal frame() invocation. Easier: wait + read post-tick.
        await ctx.waitFor(() => /70 \/ 100/.test(ctx.doc.getElementById('numbers').textContent), { timeout: 2000 });
        ctx.expect(ctx.assert.domText(ctx.doc, '#numbers', /70 \/ 100/));
    },
});

TSICTestHarness.register({
    name: 'HealthBar: zero current still renders 0 / max',
    file: '/screens/health-bar.html',
    async run(ctx) {
        ctx.inject('tsic.attr.player.health', { current: 0, max: 100 });
        await ctx.waitFor(() => /0 \/ 100/.test(ctx.doc.getElementById('numbers').textContent), { timeout: 2000 });
        ctx.expect(ctx.assert.domText(ctx.doc, '#numbers', /0 \/ 100/));
    },
});
