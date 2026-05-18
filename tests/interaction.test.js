TSICTestHarness.register({
    name: 'Interaction: splits primary vs alt groups',
    file: '/screens/interaction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', {
            Targets: [
                { EntityId: 1, Label: 'Open Storage', bIsPrimary: true },
                { EntityId: 1, Label: 'Inspect',      bIsPrimary: false },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.row').length >= 2);
        ctx.expect(ctx.assert.domExists(ctx.doc, '.row.primary'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '.row.alt'));
    },
});

TSICTestHarness.register({
    name: 'Interaction: clicking primary publishes bPrimary=true',
    file: '/screens/interaction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [{ EntityId: 7, Label: 'Use', bIsPrimary: true }] });
        await ctx.waitFor(() => ctx.doc.querySelector('.row.primary'));
        ctx.clearPublishes();
        ctx.doc.querySelector('.row.primary').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Interaction.Activate', { where: p => p.bPrimary === true && p.EntityId === 7 }));
    },
});
