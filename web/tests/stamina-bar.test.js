TSICTestHarness.register({
    name: 'StaminaBar: numbers reflect current / max via attribute channel',
    file: '/screens/test-stamina-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Player.Attribute', { Channel: 'Stamina', Current: 50, Max: 100 });
        await ctx.waitFor(() => /50 \/ 100/.test(ctx.doc.body.textContent), { timeout: 2000 });
        ctx.expect(ctx.assert.truthy(/50 \/ 100/.test(ctx.doc.body.textContent)));
    },
});
