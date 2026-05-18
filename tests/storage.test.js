TSICTestHarness.register({
    name: 'Storage: renders both grids',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Storage:42', Items: [{ ItemId: 'ID_Wood', Count: 4, SlotIndex: 0 }], MaxSlots: 32,
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [], MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#storage-grid .tsic-slot').length >= 32);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#storage-grid .tsic-slot', 32));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#player-grid .tsic-slot', 32));
    },
});

TSICTestHarness.register({
    name: 'Storage: transfer click publishes Inventory.Transfer + Sound.Play',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Storage:42', Items: [{ ItemId: 'ID_Wood', Count: 4, SlotIndex: 0 }], MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#storage-grid .tsic-slot[data-slot="0"] img'));
        ctx.clearPublishes();
        ctx.events.click(ctx.doc, '#storage-grid .tsic-slot[data-slot="0"]');
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Transfer', { where: p => p.FromOwnerId === 'Storage:42' }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play', { where: p => p.SoundKey === 'Inventory.Transfer' }));
    },
});

TSICTestHarness.register({
    name: 'Storage: category tab filters container grid',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' },
            ID_Axe:  { Name: 'Axe',  Category: 'Equipment' },
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Storage:42',
            Items: [
                { ItemId: 'ID_Wood', Count: 4, SlotIndex: 0 },
                { ItemId: 'ID_Axe',  Count: 1, SlotIndex: 1 },
            ],
            MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#storage-tabs .storage-tab').length === 5);
        // Click "Tools"
        const toolsTab = Array.from(ctx.doc.querySelectorAll('.storage-tab')).find(e => e.textContent === 'Tools');
        toolsTab.click();
        await new Promise(r => setTimeout(r, 30));
        // Wood (CraftingMaterial) should be filtered out; only Axe (Equipment) is in slot 1.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#storage-grid .tsic-slot[data-slot="1"] img'));
    },
});
