TSICTestHarness.register({
    name: 'StaminaBar: numbers reflect current / max via attribute channel',
    file: '/screens/stamina-bar.html',
    async run(ctx) {
        ctx.inject('tsic.attr.player.stamina', { current: 50, max: 100 });
        await ctx.waitFor(() => /50 \/ 100/.test(ctx.doc.body.textContent), { timeout: 2000 });
        ctx.expect(ctx.assert.truthy(/50 \/ 100/.test(ctx.doc.body.textContent)));
    },
});
