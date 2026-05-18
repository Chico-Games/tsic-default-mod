TSICTestHarness.register({
    name: 'Production: renders recipes + queue',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production',
            Recipes: [{ RecipeId: 'R_Plank', Name: 'Plank', bDiscovered: true, bStationLevelSufficient: true, Inputs: [], Outputs: [{ ItemId: 'ID_Plank', Count: 1 }] }],
            MaterialCounts: {},
        });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', {
            Queue: [{ RecipeId: 'R_Plank', Name: 'Plank' }],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#p-list .p-row').length >= 1, { timeout: 2000 });
        ctx.expect(ctx.assert.domExists(ctx.doc, '#p-list .p-row'));
    },
});

TSICTestHarness.register({
    name: 'Production: progress updates do not crash',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production', Recipes: [], MaterialCounts: {},
        });
        ctx.inject('tsic.msg.UI.Recipe.Progress', { RecipeId: 'R_Plank', Fraction: 0.5 });
        ctx.inject('tsic.msg.UI.Recipe.Completed', { RecipeId: 'R_Plank' });
        ctx.expect(ctx.assert.truthy(true));
    },
});
