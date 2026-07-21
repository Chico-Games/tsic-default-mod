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
        // Commits ride the global pointer tracker — press/release at the
        // target cell's real coordinates.
        const dst = ctx.doc.querySelector('#ss-player-list .tsic-slot[data-grid="5"]');
        const r = dst.getBoundingClientRect();
        const o = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0 };
        dst.dispatchEvent(new ctx.win.PointerEvent('pointerdown', o));
        dst.dispatchEvent(new ctx.win.PointerEvent('pointerup', o));
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

TSICTestHarness.register({
    name: 'Storage: Tab and NextPage switch focus to the other pane',
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
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot'));
        ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        await new Promise(r => setTimeout(r, 50));
        const focused1 = ctx.doc.querySelector('.tsic-slot[data-tsic-focused]');
        ctx.expect(ctx.assert.truthy(focused1 && focused1.closest('#ss-container-list'),
            'Tab lands in the container pane'));
        ctx.inject('tsic.msg.UI.Behavior.NextPage', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 50));
        const focused2 = ctx.doc.querySelector('.tsic-slot[data-tsic-focused]');
        ctx.expect(ctx.assert.truthy(focused2 && focused2.closest('#ss-player-list'),
            'NextPage jumps back to the player pane'));
    },
});

TSICTestHarness.register({
    name: 'Storage: pane switch restores each pane\'s last-focused cell (focus memory)',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Storage:42', GridWidth: 8,
            Items: [{ ItemId: 'ID_Wood', Count: 4, InstanceId: 1, GridSlot: 5 }], MaxSlots: 32,
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-player-list .tsic-slot'));
        // Focus player cell 3, hop to the container, then hop back.
        const playerCell = ctx.doc.querySelector('#ss-player-list .tsic-slot[data-grid="3"]');
        ctx.win.tsic.focus.focus(playerCell);
        ctx.inject('tsic.msg.UI.Behavior.NextPage', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        // Move within the container so its memory is a non-first cell too.
        const contCell = ctx.doc.querySelector('#ss-container-list .tsic-slot[data-grid="5"]');
        ctx.win.tsic.focus.focus(contCell);
        ctx.inject('tsic.msg.UI.Behavior.NextPage', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        const back = ctx.doc.querySelector('.tsic-slot[data-tsic-focused]');
        ctx.expect(ctx.assert.truthy(back && back.closest('#ss-player-list'), 'back in the player pane'));
        ctx.expect(ctx.assert.eq(back && back.dataset.grid, '3', 'player pane restored cell 3'));
        ctx.inject('tsic.msg.UI.Behavior.NextPage', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        const cont = ctx.doc.querySelector('.tsic-slot[data-tsic-focused]');
        ctx.expect(ctx.assert.truthy(cont && cont.closest('#ss-container-list'), 'over to the container pane'));
        ctx.expect(ctx.assert.eq(cont && cont.dataset.grid, '5', 'container pane restored cell 5'));
    },
});

TSICTestHarness.register({
    name: 'Storage: per-pane Sort buttons publish UI.Cmd.Inventory.Sort with the right owner',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Storage:42', GridWidth: 8, Items: [], MaxSlots: 32,
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-player-list .tsic-slot'));
        ctx.clearPublishes();
        ctx.doc.getElementById('ss-sort-player').dispatchEvent(
            new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true }));
        ctx.doc.getElementById('ss-sort-container').dispatchEvent(
            new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Sort', {
            where: p => p.OwnerId === 'Player',
        }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Sort', {
            where: p => p.OwnerId === 'Storage:42',
        }));
    },
});
