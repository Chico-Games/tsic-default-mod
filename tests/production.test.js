TSICTestHarness.register({
    name: 'Production: renders recipes + queue',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production',
            Recipes: [{ RecipeId: 'R_Plank', Name: 'Plank', bDiscovered: true, bLevelLocked: false }],
            MaterialCounts: {},
        });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', {
            Queue: [{ RecipeId: 'R_Plank', Name: 'Plank' }],
        });
        await new Promise(r => setTimeout(r, 100));
        // Don't assert specific selectors — production layouts vary by build.
        ctx.expect(ctx.assert.truthy(ctx.doc.body.textContent.indexOf('Plank') >= 0));
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
