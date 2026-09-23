// Unit tests for shared/catalog.js.
TSICTestHarness.register({
    name: 'Unit/Catalog: UI.Item.Catalog populates tsic.itemCatalog and fires event',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        let fired = false;
        ctx.win.addEventListener('tsic-item-catalog', () => { fired = true; });
        ctx.inject('tsic.msg.UI.Item.Catalog', {
            Items: [{ ItemId: 'ID_Bread', Name: 'Bread', Description: 'tasty', Category: 'Consumable', Weight: 0.2 }],
        });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(fired, 'expected tsic-item-catalog event'));
        ctx.expect(ctx.assert.eq(ctx.win.tsic.itemCatalog && ctx.win.tsic.itemCatalog.ID_Bread && ctx.win.tsic.itemCatalog.ID_Bread.Name, 'Bread'));
    },
});

TSICTestHarness.register({
    name: 'Unit/Catalog: itemName falls back to id when descriptor missing',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.expect(ctx.assert.eq(ctx.win.tsic.itemName('ID_Unknown'), 'ID_Unknown'));
    },
});
