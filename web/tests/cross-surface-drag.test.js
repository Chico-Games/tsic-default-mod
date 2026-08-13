// Cross-surface scenarios — the HUD and a menu screen mounted TOGETHER.
//
// Every other screen suite loads an isolated /screens/<name>.html page, which does not boot the
// HUD. That makes a whole class of behaviour unrepresentable, and this is where it lives: the
// hotbar is player grid cells 0..7, and there are two surfaces in the shell that could claim
// them — the HUD bar at the bottom of the screen, and the strip inside the open panel.
//
// Exactly one of them owns the cells: THE STRIP. The panel draws its bag from cell 8 and the
// strip below it draws 0..7 (Minecraft's layout — same panel, set slightly apart), and the HUD
// bar stands down entirely while that panel is up. It used to be the other way round: the bar
// was lifted above #screen-overlay-host and bound as the panel's first row, so the cells the
// player edited sat outside the panel, at the bottom of the screen, next to a bar that was
// also "the hotbar". Players reported that as confusing (issue #203).
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
        && ctx.doc.querySelector('#inv-hotbar .tsic-slot'), { timeout: 4000 });
}

/** A viewport point that is genuinely outside every registered pane — below the panel.
 *  Computed rather than guessed at: the panel's size follows the grid, so any fixed corner is
 *  one layout change away from being inside it. */
function openWorldPoint(ctx) {
    const panel = ctx.doc.getElementById('inv-panel').getBoundingClientRect();
    const y = Math.min(ctx.win.innerHeight - 4, panel.bottom + 8);
    const x = Math.max(4, panel.left / 2);
    return { x, y, clear: y > panel.bottom };
}

TSICTestHarness.register({
    name: 'CrossSurface: the hotbar strip lives inside the panel and the HUD bar stands down',
    file: '/screens/in-game.html',
    async run(ctx) {
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 3 }]);

        const cell = ctx.doc.querySelector('#inv-hotbar .tsic-slot[data-grid="3"]');
        ctx.expect(ctx.assert.truthy(cell, 'cell 3 is drawn in the panel strip'));
        ctx.expect(ctx.assert.truthy(cell.closest('#inv-panel'),
            'the cells the player edits are inside the panel, not out at the screen edge'));
        const r = cell.getBoundingClientRect();
        const hit = ctx.doc.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        ctx.expect(ctx.assert.truthy(hit && hit.closest('#inv-hotbar'),
            'the strip wins its own hit test'));

        // The second copy is gone rather than merely covered: a visible bar under the scrim
        // reads as a drop target and is inert, which is the confusion this replaced.
        ctx.expect(ctx.assert.truthy(ctx.doc.body.classList.contains('tsic-bag-open'),
            'the shell knows a bag panel is up'));
        ctx.expect(ctx.assert.eq(
            ctx.win.getComputedStyle(ctx.doc.getElementById('hud-hotbar')).display, 'none',
            'the HUD bar is hidden while the panel draws these cells'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: every cell is drawn exactly once across the bag and the strip',
    file: '/screens/in-game.html',
    async run(ctx) {
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 3 }]);

        for (const slot of [0, 3, 7]) {
            ctx.expect(ctx.assert.eq(
                ctx.doc.querySelectorAll('#inv-bag .tsic-slot[data-grid="' + slot + '"]').length, 0,
                'cell ' + slot + ' is not drawn a second time in the bag'));
            ctx.expect(ctx.assert.domExists(ctx.doc,
                '#inv-hotbar .tsic-slot[data-grid="' + slot + '"]'));
        }
        const first = ctx.doc.querySelector('#inv-bag .tsic-slot');
        ctx.expect(ctx.assert.eq(first.dataset.grid, '8', 'the bag starts after the hotbar'));
        // The item lives on the hotbar, so its icon is there and nowhere else.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-hotbar .tsic-slot[data-grid="3"] img'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#inv-hotbar .tsic-slot').length, 8,
            'the strip is one hotbar long'));
        // The strip sits BELOW the bag — this is the layout the report asked for, and a
        // reordering would put the hotbar back above the bag it feeds from.
        const bag = ctx.doc.getElementById('inv-bag').getBoundingClientRect();
        const strip = ctx.doc.getElementById('inv-hotbar').getBoundingClientRect();
        ctx.expect(ctx.assert.truthy(strip.top >= bag.bottom,
            'the strip is under the bag, set slightly apart'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: dragging a bag stack onto the hotbar strip moves it, never drops it',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 12 }]);
        ctx.clearPublishes();

        ctx.gesture.drag('#inv-grid .tsic-slot[data-grid="12"]', '#inv-hotbar .tsic-slot[data-grid="3"]');

        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromSlot === 12 && p.ToSlot === 3 && p.ItemId === 4,
        }));
        // The regression the old model kept re-opening: a release aimed at the hotbar falling
        // through to the world-drop branch.
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot'));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'gesture completed'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: a hotbar cell is a drag SOURCE too — strip to bag',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 2 }]);
        ctx.clearPublishes();

        ctx.gesture.drag('#inv-hotbar .tsic-slot[data-grid="2"]', '#inv-grid .tsic-slot[data-grid="14"]');

        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromSlot === 2 && p.ToSlot === 14 && p.ItemId === 4,
        }));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'gesture completed'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: clicking a strip cell picks the stack up instead of selecting it',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 5 }]);
        ctx.clearPublishes();

        ctx.doc.querySelector('#inv-hotbar .tsic-slot[data-grid="5"]').click();

        ctx.expect(ctx.assert.truthy(ctx.win.TSICInventory.getHeld(), 'the stack is on the cursor'));
        // Drawing the slot mid-gesture would swap the player's hands out from under them.
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Hotbar.Select'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: closing the screen hands the HUD bar back to click-to-select',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 5 }]);
        ctx.screen('InGame');
        await ctx.waitFor(() => !ctx.doc.body.classList.contains('tsic-bag-open'), { timeout: 4000 });
        await ctx.waitFor(() => ctx.doc.querySelector('#hotbar-row .tsic-slot[data-slot="5"]'),
            { timeout: 4000 });
        ctx.clearPublishes();

        ctx.doc.querySelector('#hotbar-row .tsic-slot[data-slot="5"]').click();

        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Select', {
            where: p => p.SlotIndex === 5,
        }));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'no stack was picked up'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: hiding the HUD leaves the hotbar cells reachable in the panel',
    file: '/screens/in-game.html',
    async run(ctx) {
        // body.hud-hidden (the H toggle) blanks every piece of chrome, the hotbar bar with it.
        // That used to take eight inventory cells off screen, because the bar WAS those cells.
        // They live in the panel now, so the toggle is back to being purely about chrome.
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 3 }]);
        ctx.doc.body.classList.add('hud-hidden');
        try {
            ctx.expect(ctx.assert.truthy(
                ctx.doc.querySelector('#inv-hotbar .tsic-slot[data-grid="3"]').getBoundingClientRect().width > 0,
                'the hotbar cells still have geometry to hit'));
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
        // release to the hotbar.
        ctx.gesture.drag('#inv-grid .tsic-slot[data-grid="10"]', '#inv-grid .tsic-slot[data-grid="14"]');

        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromSlot === 10 && p.ToSlot === 14 && p.ItemId === 7,
        }));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'gesture completed'));
    },
});

TSICTestHarness.register({
    name: 'CrossSurface: a container screen carries the same hotbar strip under its player pane',
    file: '/screens/in-game.html',
    async run(ctx) {
        // Same contract as the inventory, driven by the storage shell — opening a crate adds a
        // column and moves nothing, the hotbar band included.
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

TSICTestHarness.register({
    name: 'CrossSurface: releasing on open world space still drops, with the HUD mounted',
    file: '/screens/in-game.html',
    async run(ctx) {
        // The counterpart to the strip being a pane: a release that is genuinely outside every
        // pane MUST still drop, or making the hotbar reachable would have traded one silent
        // failure for another.
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        await showInGameInventory(ctx, [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 12 }]);
        ctx.clearPublishes();

        const target = openWorldPoint(ctx);
        ctx.expect(ctx.assert.truthy(target.clear, 'probe point is clear of the panel'));

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
