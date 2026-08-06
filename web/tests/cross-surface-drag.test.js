// Cross-surface scenarios — the HUD and a menu screen mounted TOGETHER.
//
// Every other screen suite loads an isolated /screens/<name>.html page, which does not boot the
// HUD. That makes a whole class of behaviour unrepresentable, and this is where it lives: the
// HUD hotbar IS the inventory's first row. The panel starts its grid at cell 8 and the live bar
// draws cells 0..7, taking the same gestures every in-panel cell takes.
//
// The bar therefore has to sit ABOVE #screen-overlay-host (a full-viewport z-index:50
// pointer-events:auto layer) or its cells are dead — elementFromPoint would return the overlay
// at every point on screen. That lift is what these scenarios pin down; before it existed the
// bar was unreachable and drags aimed at it silently threw stacks on the floor.
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

/** A viewport point that is genuinely outside every registered pane — below the panel and
 *  clear of the bar. Computed rather than guessed at: the panel's size follows the grid, so
 *  any fixed corner is one layout change away from being inside it. */
function openWorldPoint(ctx) {
    const panel = ctx.doc.getElementById('inv-panel').getBoundingClientRect();
    const bar = ctx.doc.getElementById('hotbar-row').getBoundingClientRect();
    const y = Math.min(ctx.win.innerHeight - 4, panel.bottom + 8);
    const x = Math.max(4, Math.min(panel.left, bar.left) / 2);
    return { x, y, clear: y > panel.bottom && (y < bar.top || y > bar.bottom || x < bar.left) };
}

TSICTestHarness.register({
    name: 'CrossSurface: the HUD hotbar is reachable through the screen overlay',
    file: '/screens/in-game.html',
    async run(ctx) {
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 12 }]);

        const bar = ctx.doc.querySelector('#hotbar-row .tsic-slot[data-slot="3"]');
        const r = bar.getBoundingClientRect();
        const hit = ctx.doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        // The bar is the open screen's first row, so it must win the hit test against the
        // overlay. If this starts returning the overlay again, every cell on the bar is dead.
        ctx.expect(ctx.assert.truthy(hit && hit.closest('#hotbar-row'),
            'elementFromPoint at the HUD bar must reach it while a screen is open'));
        ctx.expect(ctx.assert.truthy(ctx.doc.body.classList.contains('tsic-hotbar-grid'),
            'the screen claimed the bar as its grid row'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: the panel never redraws the hotbar cells the bar already shows',
    file: '/screens/in-game.html',
    async run(ctx) {
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 3 }]);

        // Cells 0..7 exist exactly once each, on the bar.
        for (const slot of [0, 3, 7]) {
            ctx.expect(ctx.assert.eq(
                ctx.doc.querySelectorAll('#inv-grid .tsic-slot[data-grid="' + slot + '"]').length, 0,
                'cell ' + slot + ' is not drawn a second time in the panel'));
            ctx.expect(ctx.assert.domExists(ctx.doc,
                '#hotbar-row .tsic-slot[data-grid="' + slot + '"]'));
        }
        const first = ctx.doc.querySelector('#inv-grid .tsic-slot');
        ctx.expect(ctx.assert.eq(first.dataset.grid, '8', 'the panel grid starts after the bar'));
        // The item lives on the bar, so its icon is there and nowhere else.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#hotbar-row .tsic-slot[data-grid="3"] img'));
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
    name: 'CrossSurface: a hotbar cell is a drag SOURCE too — bar to bag',
    file: '/screens/in-game.html',
    async run(ctx) {
        // The half the old geometric drop target could never do: the bar was a destination
        // only, because nothing on it could take a pointer event.
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 2 }]);
        ctx.clearPublishes();

        ctx.gesture.drag('#hotbar-row .tsic-slot[data-slot="2"]', '#inv-grid .tsic-slot[data-grid="14"]');

        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromSlot === 2 && p.ToSlot === 14 && p.ItemId === 4,
        }));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'gesture completed'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: clicking a hotbar cell picks the stack up instead of selecting it',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 5 }]);
        ctx.clearPublishes();

        ctx.doc.querySelector('#hotbar-row .tsic-slot[data-slot="5"]').click();

        ctx.expect(ctx.assert.truthy(ctx.win.TSICInventory.getHeld(), 'the stack is on the cursor'));
        // Drawing the slot mid-gesture would swap the player's hands out from under them.
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Hotbar.Select'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: closing the screen hands the bar back to click-to-select',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 5 }]);
        ctx.screen('InGame');
        await ctx.waitFor(() => !ctx.doc.body.classList.contains('tsic-hotbar-grid'), { timeout: 4000 });
        ctx.clearPublishes();

        ctx.doc.querySelector('#hotbar-row .tsic-slot[data-slot="5"]').click();

        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Select', {
            where: p => p.SlotIndex === 5,
        }));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'no stack was picked up'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: the bar survives a hidden HUD while it is acting as a grid row',
    file: '/screens/in-game.html',
    async run(ctx) {
        // body.hud-hidden (the H toggle) blanks every piece of chrome. In grid mode the bar
        // is not chrome — hiding it would take eight inventory cells with it and leave the
        // player unable to reach them from anywhere.
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 3 }]);
        ctx.doc.body.classList.add('hud-hidden');
        try {
            const bar = ctx.doc.getElementById('hud-hotbar');
            ctx.expect(ctx.assert.eq(ctx.win.getComputedStyle(bar).display, 'block',
                'the bar stays visible while it is the panel first row'));
            ctx.expect(ctx.assert.truthy(
                ctx.doc.querySelector('#hotbar-row .tsic-slot[data-grid="3"]').getBoundingClientRect().width > 0,
                'its cells still have geometry to hit'));
        } finally {
            ctx.doc.body.classList.remove('hud-hidden');
        }
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: dragging within the grid still works with the HUD mounted',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        // Count 1 on purpose: a sweep along a row is also a drag-DISTRIBUTE gesture, and a
        // stack too small to share falls through to the plain move this scenario is about.
        await showInGameInventory(ctx, [{ ItemId: 'ID_Bread', Count: 1, InstanceId: 7, GridSlot: 10 }]);
        ctx.clearPublishes();

        // Bag to bag, entirely inside the panel. Guards against a "fix" that routes every
        // release to the bar.
        ctx.gesture.drag('#inv-grid .tsic-slot[data-grid="10"]', '#inv-grid .tsic-slot[data-grid="14"]');

        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromSlot === 10 && p.ToSlot === 14 && p.ItemId === 7,
        }));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'gesture completed'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: a container screen uses the same bar as its player-pane first row',
    file: '/screens/in-game.html',
    async run(ctx) {
        // Same contract as the inventory, driven by the storage shell — the bar is claimed on
        // show and the player pane starts after it, so a container never draws a second copy
        // of the eight cells standing at the bottom of the screen.
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
            && ctx.doc.querySelector('#hotbar-row .tsic-slot'), { timeout: 4000 });

        ctx.expect(ctx.assert.truthy(ctx.doc.body.classList.contains('tsic-hotbar-grid'),
            'the container screen claimed the bar'));
        ctx.expect(ctx.assert.eq(
            ctx.doc.querySelectorAll('#ss-player-list .tsic-slot[data-grid="2"]').length, 0,
            'the player pane does not redraw a hotbar cell'));
        ctx.expect(ctx.assert.eq(
            ctx.doc.querySelector('#ss-player-list .tsic-slot').dataset.grid, '8',
            'the player pane starts after the bar'));

        // Shift-click on the bar transfers into the container, exactly as it does on the
        // cells above it — the bar is a player-pane cell in every respect.
        ctx.clearPublishes();
        const cell = ctx.doc.querySelector('#hotbar-row .tsic-slot[data-slot="2"]');
        cell.dispatchEvent(new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.QuickMove', {
            where: p => p.FromOwnerId === 'Player' && p.ToOwnerId === 'Storage:77' && p.FromSlot === 2,
        }));

        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'InGame' });
        await ctx.waitFor(() => !ctx.doc.body.classList.contains('tsic-hotbar-grid'), { timeout: 4000 });
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: releasing on open world space still drops, with the HUD mounted',
    file: '/screens/in-game.html',
    async run(ctx) {
        // The counterpart to the bar being a pane: a release that is genuinely outside every
        // pane MUST still drop, or making the bar reachable would have traded one silent
        // failure for another.
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 12 }]);
        ctx.clearPublishes();

        const target = openWorldPoint(ctx);
        ctx.expect(ctx.assert.truthy(target.clear, 'probe point is clear of the panel and the bar'));

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
