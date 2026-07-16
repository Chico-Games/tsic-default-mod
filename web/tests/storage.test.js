TSICTestHarness.register({
    name: 'Storage: renders container + player lists',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Storage:42', Items: [{ ItemId: 'ID_Wood', Count: 4, SlotIndex: 0 }], MaxSlots: 32,
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [], MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-slot="0"]'));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#ss-container-list .tsic-slot[data-slot]', 1));
        // Player pane renders an empty grid — cells exist, none occupied.
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#ss-player-list .tsic-slot[data-slot]').length, 0));
    },
});

TSICTestHarness.register({
    name: 'Storage: transfer dblclick publishes Inventory.Transfer + Sound.Play',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Storage:42', Items: [{ ItemId: 'ID_Wood', Count: 4, SlotIndex: 0 }], MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-slot="0"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#ss-container-list .tsic-slot[data-slot="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('dblclick', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Transfer', { where: p => p.FromOwnerId === 'Storage:42' }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play', { where: p => p.SoundKey === 'Inventory.Transfer' }));
    },
});

TSICTestHarness.register({
    name: 'Storage: category tab filters container list',
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
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.ss-tabs[data-side="container"] .tsic-tab').length === 6);
        // Click "Equipment" tab on the container side
        const equipTab = Array.from(ctx.doc.querySelectorAll('.ss-tabs[data-side="container"] .tsic-tab'))
            .find(e => (e.textContent || '').trim() === 'Equipment');
        equipTab.click();
        await new Promise(r => setTimeout(r, 30));
        // Wood (CraftingMaterial) dims in place; Axe (Equipment) stays lit.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ss-container-list .tsic-slot[data-slot="1"]:not(.is-filtered)'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ss-container-list .tsic-slot[data-slot="0"].is-filtered'));
    },
});
