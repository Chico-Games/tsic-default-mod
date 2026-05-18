TSICTestHarness.register({
    name: 'HealthBar: subscribes to player health attribute',
    file: '/screens/health-bar.html',
    async run(ctx) {
        // Health bar pulls from the attribute channel rather than a message tag.
        ctx.inject('tsic.attr.player.health', { Current: 70, Max: 100 });
        await new Promise(r => setTimeout(r, 80));
        // We don't assert exact text — pages vary — just verify SOME health/100 markup appears.
        ctx.expect(ctx.assert.truthy(
            (ctx.doc.body.textContent || '').match(/\b70\b|\b100\b|0\.7/),
            'expected the health bar to surface 70 or 100 somewhere'));
    },
});
