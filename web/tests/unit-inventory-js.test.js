// Unit tests for shared/inventory.js — grid renderer v2 + the Minecraft-style
// cursor ("held stack") engine. Covers §9: 1-3 (half pickup / place-one), 11
// (no-op moves never sent), 40 (mid-gesture reconcile), §14.5 cursor-model
// publishes. The deleted context menu / quantity modal must STAY deleted.

function cellAt(ctx, grid) {
    return ctx.doc.querySelector('#host .tsic-slot[data-grid="' + grid + '"]');
}
function renderHost(ctx, items, extra) {
    const host = ctx.doc.getElementById('host');
    host.innerHTML = '';
    ctx.win.TSICInventory.cancelHeld();
    ctx.win.TSICInventory.renderGrid(host, items, Object.assign({
        gridWidth: 4, slotCount: 8, ownerId: 'Player',
    }, extra || {}));
    return host;
}
function click(ctx, el, opts) {
    el.dispatchEvent(new ctx.win.MouseEvent('click', Object.assign({ bubbles: true, cancelable: true }, opts || {})));
}
function rmb(ctx, el) {
    el.dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
}

TSICTestHarness.register({
    name: 'Unit/InventoryJs: TSICInventory v2 namespace — cursor engine installed, legacy widgets gone',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const inv = ctx.win.TSICInventory;
        ctx.expect(ctx.assert.truthy(inv, 'expected window.TSICInventory'));
        ctx.expect(ctx.assert.truthy(typeof inv.renderGrid === 'function'));
        ctx.expect(ctx.assert.truthy(typeof inv.renderInfoPanel === 'function'));
        ctx.expect(ctx.assert.truthy(typeof inv.cancelHeld === 'function'));
        ctx.expect(ctx.assert.truthy(typeof inv.reconcileHeld === 'function'));
        // §7.6: no context menu, no quantity modal, no armed-move path.
        ctx.expect(ctx.assert.eq(typeof inv.openQuantityModal, 'undefined', 'quantity modal deleted'));
        ctx.expect(ctx.assert.eq(typeof inv.buildItemContextMenu, 'undefined', 'context menu deleted'));
        ctx.expect(ctx.assert.eq(typeof inv.armMove, 'undefined', 'armMove deleted'));
        ctx.expect(ctx.assert.eq(typeof ctx.win.TSICContextMenu, 'undefined', 'context-menu module deleted'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: renderGrid lays out slotCount cells and places items by GridSlot',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        renderHost(ctx, [
            { ItemId: 'ID_A', Count: 2, InstanceId: 1, GridSlot: 0 },
            { ItemId: 'ID_B', Count: 7, InstanceId: 2, GridSlot: 5 },
        ]);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#host .tsic-slot', 8));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#host .tsic-slot[data-grid="0"][data-instance="1"] img'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#host .tsic-slot[data-grid="5"][data-instance="2"]'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#host .count').length, 2));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: locked preview cells render greyed and are never targets',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        renderHost(ctx, [], { slotCount: 8, lockedPreviewCells: 4 });
        ctx.expect(ctx.assert.domCount(ctx.doc, '#host .tsic-slot', 12));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#host .tsic-slot.is-locked', 4));
        // Locked cells are not focusable and carry the hover explanation.
        const locked = cellAt(ctx, 8);
        ctx.expect(ctx.assert.eq(locked.hasAttribute('data-tsic-focusable'), false));
        ctx.expect(ctx.assert.eq(locked.title, 'Requires backpack'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: parked overflow items extend the grid by whole rows',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        renderHost(ctx, [
            { ItemId: 'ID_A', Count: 1, InstanceId: 1, GridSlot: 9 }, // past slotCount 8
        ]);
        // Cell 9 needs row 3 → 12 cells (4 wide).
        ctx.expect(ctx.assert.domCount(ctx.doc, '#host .tsic-slot', 12));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#host .tsic-slot[data-grid="9"][data-instance="1"]'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: LMB click picks up the whole stack; same-cell click returns it',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        renderHost(ctx, [{ ItemId: 'ID_A', Count: 6, InstanceId: 1, GridSlot: 2 }]);
        click(ctx, cellAt(ctx, 2));
        const held = ctx.win.TSICInventory.getHeld();
        ctx.expect(ctx.assert.truthy(held, 'stack held after click'));
        ctx.expect(ctx.assert.eq(held.count, 6));
        ctx.expect(ctx.assert.eq(held.fromSlot, 2));
        ctx.expect(ctx.assert.truthy(ctx.doc.querySelector('.tsic-drag-ghost'), 'ghost follows the cursor'));
        // Rule 11: releasing over the source cancels — nothing is ever sent.
        click(ctx, cellAt(ctx, 2));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'same-cell click returns the stack'));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.Move'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: click-move-click commits ONE atomic id+slot-addressed Move',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        renderHost(ctx, [{ ItemId: 'ID_A', Count: 6, InstanceId: 7, GridSlot: 0 }]);
        click(ctx, cellAt(ctx, 0));
        click(ctx, cellAt(ctx, 3));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.ItemId === 7 && p.FromSlot === 0 && p.ToSlot === 3 &&
                p.Count === 0 && p.FromOwnerId === 'Player' && p.ToOwnerId === 'Player',
        }));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'gesture completed'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: RMB picks up the larger half (7 -> hold 4, leave 3)',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        renderHost(ctx, [{ ItemId: 'ID_A', Count: 7, InstanceId: 1, GridSlot: 0 }]);
        rmb(ctx, cellAt(ctx, 0));
        const held = ctx.win.TSICInventory.getHeld();
        ctx.expect(ctx.assert.truthy(held, 'half-stack held'));
        ctx.expect(ctx.assert.eq(held.count, 4, 'larger half held (rule 1)'));
        ctx.expect(ctx.assert.eq(held.sourceCount, 7));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: RMB with a held stack places ONE per click and decrements the ghost',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        renderHost(ctx, [{ ItemId: 'ID_A', Count: 5, InstanceId: 1, GridSlot: 0 }]);
        click(ctx, cellAt(ctx, 0)); // hold all 5
        rmb(ctx, cellAt(ctx, 2));   // place one
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.ItemId === 1 && p.ToSlot === 2 && p.Count === 1,
        }));
        const held = ctx.win.TSICInventory.getHeld();
        ctx.expect(ctx.assert.truthy(held, 'still holding the remainder'));
        ctx.expect(ctx.assert.eq(held.count, 4, 'held count decremented'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: partial hold commits with its exact count (split semantics)',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        renderHost(ctx, [{ ItemId: 'ID_A', Count: 7, InstanceId: 1, GridSlot: 0 }]);
        rmb(ctx, cellAt(ctx, 0));  // hold 4 of 7
        click(ctx, cellAt(ctx, 3));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.ItemId === 1 && p.FromSlot === 0 && p.ToSlot === 3 && p.Count === 4,
        }));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: shift-click routes to the pane quick-move handler',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        let quick = null;
        renderHost(ctx, [{ ItemId: 'ID_A', Count: 3, InstanceId: 1, GridSlot: 1 }], {
            onQuickMove: (it) => { quick = it; },
        });
        click(ctx, cellAt(ctx, 1), { shiftKey: true });
        ctx.expect(ctx.assert.eq(quick && quick.InstanceId, 1, 'quick-move fired'));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'shift-click never holds'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: double-click publishes Collect for the held full stack',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        renderHost(ctx, [{ ItemId: 'ID_A', Count: 3, InstanceId: 9, GridSlot: 1 }], {
            otherOwnerId: () => 'Storage:5',
        });
        const cell = cellAt(ctx, 1);
        click(ctx, cell); // first click of the double-click picks up
        cell.dispatchEvent(new ctx.win.MouseEvent('dblclick', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Collect', {
            where: p => p.ItemId === 9 && p.Slot === 1 && p.OwnerId === 'Player' && p.OtherOwnerId === 'Storage:5',
        }));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: dropHovered publishes DropFromSlot (Q = one, Ctrl+Q = stack)',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        const item = { ItemId: 'ID_A', Count: 5, InstanceId: 3, GridSlot: 2 };
        ctx.win.TSICInventory.dropHovered({ ownerId: 'Player' }, item, false);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot', {
            where: p => p.ItemId === 3 && p.Slot === 2 && p.Count === 1,
        }));
        ctx.clearPublishes();
        ctx.win.TSICInventory.dropHovered({ ownerId: 'Storage:4' }, item, true);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot', {
            where: p => p.OwnerId === 'Storage:4' && p.Count === 0,
        }));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: reconcileHeld keeps a matching gesture, cancels a stale one (rule 40)',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        renderHost(ctx, [{ ItemId: 'ID_A', Count: 6, InstanceId: 1, GridSlot: 2 }]);
        click(ctx, cellAt(ctx, 2)); // hold all 6
        // Matching broadcast (co-op partner added elsewhere): ghost survives,
        // full-stack hold tracks the entry's count.
        ctx.win.TSICInventory.reconcileHeld('Player', [
            { ItemId: 'ID_A', Count: 8, InstanceId: 1, GridSlot: 2 },
        ]);
        let held = ctx.win.TSICInventory.getHeld();
        ctx.expect(ctx.assert.truthy(held, 'ghost preserved'));
        ctx.expect(ctx.assert.eq(held.count, 8, 'full-stack hold tracks the new count'));
        // The source entry moved cells — the gesture dissolves.
        ctx.win.TSICInventory.reconcileHeld('Player', [
            { ItemId: 'ID_A', Count: 8, InstanceId: 1, GridSlot: 5 },
        ]);
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'stale gesture cancelled'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: cross-pane commit publishes Move with both owner ids',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        const host = renderHost(ctx, [{ ItemId: 'ID_A', Count: 2, InstanceId: 1, GridSlot: 0 }]);
        // Second pane in the same fixture doc.
        const host2 = ctx.doc.createElement('div');
        host2.id = 'host2';
        ctx.doc.body.appendChild(host2);
        ctx.win.TSICInventory.renderGrid(host2, [], { gridWidth: 4, slotCount: 4, ownerId: 'Storage:9' });
        click(ctx, host.querySelector('.tsic-slot[data-grid="0"]'));
        click(ctx, host2.querySelector('.tsic-slot[data-grid="1"]'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromOwnerId === 'Player' && p.ToOwnerId === 'Storage:9' &&
                p.ItemId === 1 && p.ToSlot === 1,
        }));
        host2.remove();
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: held source cell dims and shows the remaining count',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        renderHost(ctx, [{ ItemId: 'ID_A', Count: 7, InstanceId: 1, GridSlot: 0 }]);
        rmb(ctx, cellAt(ctx, 0)); // hold 4, leave 3
        const cell = cellAt(ctx, 0);
        ctx.expect(ctx.assert.truthy(cell.classList.contains('is-held-source'), 'source dimmed'));
        ctx.expect(ctx.assert.eq(cell.querySelector('.count').textContent, '3', 'badge shows the remainder'));
        ctx.win.TSICInventory.cancelHeld();
        ctx.expect(ctx.assert.eq(cell.classList.contains('is-held-source'), false, 'restored on cancel'));
    },
});
