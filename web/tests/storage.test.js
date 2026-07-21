// Storage shell scenarios — §10.2: the inventory view plus a container column.
// Covers §9: 48 (filter dims in place), §7.4 (cross-pane quick-move).

TSICTestHarness.register({
    name: 'Storage: renders container + player grids from GridSlot placement',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Storage:42', GridWidth: 8,
            Items: [{ ItemId: 'ID_Wood', Count: 4, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32,
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-instance="1"]'));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#ss-container-list .tsic-slot[data-instance]', 1));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#ss-player-list .tsic-slot[data-instance]', 0));
        ctx.expect(ctx.assert.domText(ctx.doc, '#ss-container-slots', /1\/32/));
        ctx.expect(ctx.assert.domText(ctx.doc, '#ss-player-slots', /0\/32 SLOTS/));
    },
});

TSICTestHarness.register({
    name: 'Storage: shift-click quick-moves a container stack to the player (auto-place)',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Storage:42', GridWidth: 8,
            Items: [{ ItemId: 'ID_Wood', Count: 4, InstanceId: 9, GridSlot: 3 }], MaxSlots: 32,
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-instance="9"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#ss-container-list .tsic-slot[data-instance="9"]')
            .dispatchEvent(new ctx.win.MouseEvent('click', { bubbles: true, shiftKey: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.QuickMove', {
            where: p => p.FromOwnerId === 'Storage:42' && p.ToOwnerId === 'Player' &&
                p.ItemId === 9 && p.FromSlot === 3,
        }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play', {
            where: p => p.SoundKey === 'Inventory.Transfer',
        }));
    },
});

TSICTestHarness.register({
    name: 'Storage: cross-pane click-move commits an id+slot-addressed Move',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Storage:42', GridWidth: 8,
            Items: [{ ItemId: 'ID_Wood', Count: 4, InstanceId: 9, GridSlot: 0 }], MaxSlots: 32,
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-instance="9"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#ss-container-list .tsic-slot[data-instance="9"]').click();
        ctx.expect(ctx.assert.truthy(ctx.win.TSICInventory.getHeld(), 'stack held'));
        ctx.doc.querySelector('#ss-player-list .tsic-slot[data-grid="5"]').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromOwnerId === 'Storage:42' && p.ToOwnerId === 'Player' &&
                p.ItemId === 9 && p.FromSlot === 0 && p.ToSlot === 5,
        }));
    },
});

TSICTestHarness.register({
    name: 'Storage: player tab filter dims non-matching cells in place',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' },
            ID_Axe:  { Name: 'Axe',  Category: 'Equipment' },
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', GridWidth: 8,
            Items: [
                { ItemId: 'ID_Wood', Count: 4, InstanceId: 1, GridSlot: 0 },
                { ItemId: 'ID_Axe',  Count: 1, InstanceId: 2, GridSlot: 1 },
            ],
            MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.ss-tabs[data-side="player"] .tsic-tab').length === 6);
        const equipTab = Array.from(ctx.doc.querySelectorAll('.ss-tabs[data-side="player"] .tsic-tab'))
            .find(e => (e.textContent || '').trim() === 'Equipment');
        equipTab.click();
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ss-player-list .tsic-slot[data-instance="2"]:not(.is-filtered)'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ss-player-list .tsic-slot[data-instance="1"].is-filtered'));
    },
});
