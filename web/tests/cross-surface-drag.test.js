// Cross-surface scenarios — the HUD and a menu screen mounted TOGETHER.
//
// Every other screen suite loads an isolated /screens/<name>.html page, which does not boot the
// HUD. That makes a whole class of behaviour unrepresentable, and this is where it lives: while
// the storage screen is up, its player pane draws the hotbar strip under the bag and the HUD bar
// stands down, so the cells are drawn in exactly one place (issue #203).
//
// Loading /screens/in-game.html and calling ctx.screen(...) gives the real shell: HUD
// components, screen-manager, real CSS, real stacking.

TSICTestHarness.register({
    name: 'CrossSurface: a container screen carries the hotbar strip under its player pane',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Storage' });
        await ctx.waitFor(() => ctx.doc.getElementById('ss-panel'), { timeout: 4000 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', GridWidth: 8, MaxSlots: 32, MaxWeight: 80, CurrentWeight: 1,
            Items: [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 2 }],
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Storage:77', GridWidth: 8, MaxSlots: 32, Items: [],
        });
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: 0, SelectedSlotPending: -1 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-player-list .tsic-slot')
            && ctx.doc.querySelector('#ss-player-hotbar .tsic-slot'), { timeout: 4000 });

        ctx.expect(ctx.assert.eq(
            ctx.doc.querySelectorAll('#ss-player-bag .tsic-slot[data-grid="2"]').length, 0,
            'the player pane does not redraw a hotbar cell'));
        ctx.expect(ctx.assert.eq(
            ctx.doc.querySelector('#ss-player-bag .tsic-slot').dataset.grid, '8',
            'the player pane starts after the hotbar'));

        // Shift-click on the strip transfers into the container, exactly as it does on the
        // cells above it — the strip is a player-pane cell in every respect.
        ctx.clearPublishes();
        const cell = ctx.doc.querySelector('#ss-player-hotbar .tsic-slot[data-grid="2"]');
        cell.dispatchEvent(new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.QuickMove', {
            where: p => p.FromOwnerId === 'Player' && p.ToOwnerId === 'Storage:77' && p.FromSlot === 2,
        }));

        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'InGame' });
        await ctx.waitFor(() => !ctx.doc.body.classList.contains('tsic-bag-open'), { timeout: 4000 });
    },
});
