TSICTestHarness.register({
    name: 'StaminaBar: subscribes to stamina attribute',
    file: '/screens/stamina-bar.html',
    async run(ctx) {
        ctx.inject('tsic.attr.player.stamina', { Current: 50, Max: 100 });
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.truthy(
            (ctx.doc.body.textContent || '').match(/\b50\b|\b100\b|0\.5/),
            'expected the stamina bar to surface 50 or 100 somewhere'));
    },
});
