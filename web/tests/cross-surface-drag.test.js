// Cross-surface drag scenarios — the HUD and a menu screen mounted TOGETHER.
//
// Every other screen suite loads an isolated /screens/<name>.html page, which does not boot the
// HUD. That made a whole class of bug unrepresentable: anything involving two surfaces at once,
// or the real z-order between them. The inventory screen mounts inside #screen-overlay-host, a
// full-viewport z-index:50 pointer-events:auto layer sitting ABOVE the HUD — so a drop target
// on the HUD is unreachable by elementFromPoint while a screen is open. That shipped, and it
// silently threw dragged stacks on the floor.
//
// Loading /screens/in-game.html and calling ctx.screen(...) gives the real shell: HUD
// components, screen-manager, real CSS, real stacking. Gestures come from ctx.gesture
// (shared/test-input.js) — the same module the live page loads, so these drags are the drags a
// Gauntlet node performs against a packaged build.

async function showInGameInventory(ctx, items, hotbar) {
    ctx.screen('Inventory');
    ctx.inject('tsic.msg.UI.Inventory.Updated', {
        OwnerId: 'Player', GridWidth: 8, GridHeight: 4, MaxSlots: 32,
        MaxWeight: 80, CurrentWeight: 1, Items: items || [],
    });
    ctx.inject('tsic.msg.UI.Hotbar.Changed', Object.assign(
        { NumSlots: 8, SelectedSlot: 0, SelectedSlotPending: -1 }, hotbar || {}));
    await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot')
        && ctx.doc.querySelector('#hotbar-row .tsic-slot'), { timeout: 4000 });
}

TSICTestHarness.register({
    name: 'CrossSurface: the screen overlay really does cover the HUD (the trap this suite exists for)',
    file: '/screens/in-game.html',
    async run(ctx) {
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 12 }]);

        const bar = ctx.doc.querySelector('#hotbar-row .tsic-slot[data-slot="3"]');
        const r = bar.getBoundingClientRect();
        const hit = ctx.doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        // If this ever starts returning the bar itself, the overlay stopped covering the HUD
        // and the geometric hit test in shared/inventory.js can be reconsidered.
        ctx.expect(ctx.assert.truthy(hit && !hit.closest('#hotbar-row'),
            'elementFromPoint at the HUD bar must NOT reach it while a screen is open'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: dragging a bag stack onto the live HUD hotbar moves it, never drops it',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 12 }]);
        ctx.clearPublishes();

        ctx.gesture.drag('#inv-grid .tsic-slot[data-grid="12"]', '#hotbar-row .tsic-slot[data-slot="3"]');

        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromSlot === 12 && p.ToSlot === 3 && p.ItemId === 4,
        }));
        // The regression: the release used to fall through to the world-drop branch.
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot'));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'gesture completed'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: dragging within the grid still works with the HUD mounted',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        await showInGameInventory(ctx, [{ ItemId: 'ID_Bread', Count: 3, InstanceId: 7, GridSlot: 2 }]);
        ctx.clearPublishes();

        // Hotbar row -> bag, entirely inside the panel. Guards against a "fix" that routes
        // every release to the bar.
        ctx.gesture.drag('#inv-grid .tsic-slot[data-grid="2"]', '#inv-grid .tsic-slot[data-grid="14"]');

        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromSlot === 2 && p.ToSlot === 14 && p.ItemId === 7,
        }));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'gesture completed'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: releasing on open world space still drops, with the HUD mounted',
    file: '/screens/in-game.html',
    async run(ctx) {
        // The counterpart to the bug: a release that is genuinely outside every pane MUST still
        // drop, or the fix would have traded one silent failure for another.
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 12 }]);
        ctx.clearPublishes();

        const panel = ctx.doc.getElementById('inv-panel').getBoundingClientRect();
        const bar = ctx.doc.getElementById('hotbar-row').getBoundingClientRect();
        // Top-left corner: clear of the panel AND clear of the bar.
        const target = { x: Math.max(4, panel.left / 2), y: Math.max(4, panel.top / 2) };
        ctx.expect(ctx.assert.truthy(target.y < bar.top, 'probe point is clear of the hotbar'));

        const src = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="12"]');
        const s = src.getBoundingClientRect();
        const T = ctx.win.TSIC.testInput;
        T.pointer(src, 'pointerdown', s.left + s.width / 2, s.top + s.height / 2, 1, 0);
        T.pointer(ctx.doc, 'pointermove', target.x, target.y, 1, 0);
        T.pointer(ctx.doc.body, 'pointerup', target.x, target.y, 0, 0);

        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot', {
            where: p => p.Slot === 12,
        }));
    },
});
