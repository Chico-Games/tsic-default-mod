// Unit tests for shared/recipe-info.js.
TSICTestHarness.register({
    name: 'Unit/RecipeInfo: render emits heading + ingredients + outputs',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.getElementById('host');
        host.innerHTML = '';
        ctx.win.TSICRecipeInfo.render(host, {
            RecipeId: 'R_Bread', Name: 'Bread',
            bDiscovered: true, bStationLevelSufficient: true,
            Ingredients: [{ ItemId: 'ID_Wheat', Count: 3 }],
            Outputs:     [{ ItemId: 'ID_Bread', Count: 1 }],
        }, { ID_Wheat: 5 });
        ctx.expect(ctx.assert.domExists(ctx.doc, '#host h3'));
        const text = host.textContent;
        ctx.expect(ctx.assert.truthy(/Bread/.test(text)));
        ctx.expect(ctx.assert.truthy(/ID_Wheat x3|Wheat x3/.test(text)));
        ctx.expect(ctx.assert.truthy(/have 5/.test(text)));
    },
});

TSICTestHarness.register({
    name: 'Unit/RecipeInfo: canCraft handles every gating path',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const ok = { RecipeId: 'R', bDiscovered: true, bStationLevelSufficient: true, Ingredients: [{ ItemId: 'ID_X', Count: 1 }] };
        ctx.expect(ctx.assert.eq(ctx.win.TSICRecipeInfo.canCraft(ok, { ID_X: 1 }), true));
        ctx.expect(ctx.assert.eq(ctx.win.TSICRecipeInfo.canCraft(ok, { ID_X: 0 }), false));
        ctx.expect(ctx.assert.eq(ctx.win.TSICRecipeInfo.canCraft({ ...ok, bDiscovered: false }, { ID_X: 1 }), false));
        ctx.expect(ctx.assert.eq(ctx.win.TSICRecipeInfo.canCraft({ ...ok, bStationLevelSufficient: false }, { ID_X: 1 }), false));
        ctx.expect(ctx.assert.eq(ctx.win.TSICRecipeInfo.canCraft(null, {}), false));
        // No ingredients = always craftable when discovered + level OK.
        ctx.expect(ctx.assert.eq(ctx.win.TSICRecipeInfo.canCraft({ bDiscovered: true, bStationLevelSufficient: true }, {}), true));
    },
});

TSICTestHarness.register({
    name: 'Unit/RecipeInfo: missing recipe renders nothing',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.getElementById('host');
        host.innerHTML = 'previous';
        ctx.win.TSICRecipeInfo.render(host, null, {});
        ctx.expect(ctx.assert.eq(host.innerHTML, ''));
    },
});

TSICTestHarness.register({
    name: 'Unit/RecipeInfo: locked badge surfaces on undiscovered recipes',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.getElementById('host');
        host.innerHTML = '';
        ctx.win.TSICRecipeInfo.render(host, { Name: 'Secret', bDiscovered: false, bStationLevelSufficient: true }, {});
        ctx.expect(ctx.assert.truthy(/\(locked\)/.test(host.textContent)));
    },
});

TSICTestHarness.register({
    name: 'Unit/RecipeInfo: station-level badge surfaces when level insufficient',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.getElementById('host');
        host.innerHTML = '';
        ctx.win.TSICRecipeInfo.render(host, { Name: 'Hat', bDiscovered: true, bStationLevelSufficient: false, RequiredStationLevel: 3 }, {});
        ctx.expect(ctx.assert.truthy(/\(lvl 3\)/.test(host.textContent)));
    },
});
