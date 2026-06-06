TSICTestHarness.register({
    name: 'Construction: renders item list and tabs',
    file: '/screens/construction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.Available', {
            Items: [
                { EntityDefId: 'FD_Table',   Name: 'Table',   Category: 'Furniture', IconUrl: '', bAffordable: true },
                { EntityDefId: 'FD_Chair',   Name: 'Chair',   Category: 'Furniture', IconUrl: '', bAffordable: false },
                { EntityDefId: 'FD_Walling', Name: 'Wall',    Category: 'Structure', IconUrl: '', bAffordable: true },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#c-tabs .tsic-tab').length >= 2);
        const tabs = ctx.doc.querySelectorAll('#c-tabs .tsic-tab');
        ctx.expect(ctx.assert.truthy(tabs.length >= 3, `expected ≥3 tabs (All + 2 categories), got ${tabs.length}`));
    },
});

TSICTestHarness.register({
    name: 'Construction: clicking an item publishes Construction.Begin',
    file: '/screens/construction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.Available', { Items: [{ EntityDefId: 'FD_Table', Name: 'Table', Category: 'Furniture', bAffordable: true }] });
        await ctx.waitFor(() => ctx.doc.querySelector('#items .c-row'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#items .c-row').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Construction.Begin', { where: p => p.EntityDefId === 'FD_Table' }));
    },
});

TSICTestHarness.register({
    name: 'Construction: preview state pill shows READY when bCanPlace',
    file: '/screens/construction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.PreviewState', { bCanPlace: true, RotationAxis: 'Z' });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.domText(ctx.doc, '#preview-text', 'READY'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#rotation-axis', /axis: Z/));
    },
});
