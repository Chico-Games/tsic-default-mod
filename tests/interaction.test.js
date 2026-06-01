TSICTestHarness.register({
    name: 'Interaction: renders a row per target',
    file: '/screens/interaction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', {
            Targets: [
                { EntityId: 1, Label: 'Open Storage' },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.row').length >= 1);
        ctx.expect(ctx.assert.domExists(ctx.doc, '.row'));
    },
});

TSICTestHarness.register({
    name: 'Interaction: clicking a row publishes Activate with its EntityId',
    file: '/screens/interaction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [{ EntityId: 7, Label: 'Use' }] });
        await ctx.waitFor(() => ctx.doc.querySelector('.row'));
        ctx.clearPublishes();
        ctx.doc.querySelector('.row').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Interaction.Activate', { where: p => p.EntityId === 7 }));
    },
});
