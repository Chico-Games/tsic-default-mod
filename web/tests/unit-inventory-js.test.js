// Unit tests for shared/inventory.js — grid renderer v2 + the Minecraft-style
// cursor ("held stack") engine. Covers §9: 1-3 (half pickup / place-one), 11
// (no-op moves never sent), 40 (mid-gesture reconcile), §14.5 cursor-model
// publishes. The deleted context menu / quantity modal must STAY deleted.

function cellAt(ctx, grid) {
    return ctx.doc.querySelector('#host .tsic-slot[data-grid="' + grid + '"]');
}
function renderHost(ctx, items, extra) {
    ensureLayout(ctx);
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
// Held commits ride the global pointerdown/pointerup tracker, which resolves
// the RELEASE POINT via elementFromPoint — so tests must press at real
// coordinates over the target cell.
function pressReleaseOn(ctx, el) {
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0 };
    el.dispatchEvent(new ctx.win.PointerEvent('pointerdown', o));
    el.dispatchEvent(new ctx.win.PointerEvent('pointerup', o));
}
// The fixture page has no screen CSS; give the grid real cell geometry so
// elementFromPoint-based commits resolve.
function ensureLayout(ctx) {
    if (ctx.doc.getElementById('zz-grid-style')) return;
    const s = ctx.doc.createElement('style');
    s.id = 'zz-grid-style';
    s.textContent = '#host,#host2{display:grid;grid-template-columns:repeat(4,48px);grid-auto-rows:48px;gap:4px;width:max-content;} .tsic-slot{width:48px;height:48px;}';
    ctx.doc.head.appendChild(s);
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
        // Rule 11: releasing over the source returns the stack (after the
        // double-click grace window) — nothing is ever sent.
        const cell2 = cellAt(ctx, 2);
        const r2 = cell2.getBoundingClientRect();
        const pOpts = { bubbles: true, cancelable: true, clientX: r2.x + 4, clientY: r2.y + 4, button: 0 };
        cell2.dispatchEvent(new ctx.win.PointerEvent('pointerdown', pOpts));
        cell2.dispatchEvent(new ctx.win.PointerEvent('pointerup', pOpts));
        await ctx.waitFor(() => ctx.win.TSICInventory.getHeld() === null);
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
        pressReleaseOn(ctx, cellAt(ctx, 3));
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
        pressReleaseOn(ctx, cellAt(ctx, 3));
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
        // Pin the second pane away from the first so elementFromPoint-based
        // release resolution can't land on the wrong grid.
        host2.style.cssText = 'position:fixed;left:420px;top:8px;';
        ctx.doc.body.appendChild(host2);
        ctx.win.TSICInventory.renderGrid(host2, [], { gridWidth: 4, slotCount: 4, ownerId: 'Storage:9' });
        click(ctx, host.querySelector('.tsic-slot[data-grid="0"]'));
        pressReleaseOn(ctx, host2.querySelector('.tsic-slot[data-grid="1"]'));
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

// ---- Drag-distribute (§6 P2) -----------------------------------------------

function pointerAt(ctx, el, type, buttons, button) {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new ctx.win.PointerEvent(type, {
        bubbles: true, cancelable: true,
        clientX: r.x + r.width / 2, clientY: r.y + r.height / 2,
        button: button == null ? 0 : button, buttons: buttons || 0,
    }));
}

TSICTestHarness.register({
    name: 'Unit/InventoryJs: LMB drag-distribute splits the held count evenly, remainder stays on the cursor',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        renderHost(ctx, [{ ItemId: 'ID_A', Count: 25, InstanceId: 9, GridSlot: 0 }]);
        click(ctx, cellAt(ctx, 0)); // hold 25
        // Press on cell 1, sweep 2 and 3 with LMB down, release.
        pointerAt(ctx, cellAt(ctx, 1), 'pointerdown', 1, 0);
        pointerAt(ctx, cellAt(ctx, 2), 'pointermove', 1);
        pointerAt(ctx, cellAt(ctx, 3), 'pointermove', 1);
        pointerAt(ctx, cellAt(ctx, 3), 'pointerup', 0, 0);
        // 25 across 3 cells → 8 each, 1 stays held.
        for (const slot of [1, 2, 3]) {
            ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
                where: p => p.ItemId === 9 && p.FromSlot === 0 && p.ToSlot === slot && p.Count === 8,
            }));
        }
        const held = ctx.win.TSICInventory.getHeld();
        ctx.expect(ctx.assert.truthy(held, 'remainder stays held'));
        ctx.expect(ctx.assert.eq(held && held.count, 1, 'remainder is 1'));
        ctx.win.TSICInventory.cancelHeld();
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: drag-distribute skips the source cell and foreign-item cells',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        renderHost(ctx, [
            { ItemId: 'ID_A', Count: 10, InstanceId: 9, GridSlot: 0 },
            { ItemId: 'ID_B', Count: 1, InstanceId: 5, GridSlot: 2 },
        ]);
        click(ctx, cellAt(ctx, 0)); // hold 10
        pointerAt(ctx, cellAt(ctx, 1), 'pointerdown', 1, 0);
        pointerAt(ctx, cellAt(ctx, 0), 'pointermove', 1); // source — skipped
        pointerAt(ctx, cellAt(ctx, 2), 'pointermove', 1); // foreign item — skipped
        pointerAt(ctx, cellAt(ctx, 3), 'pointermove', 1);
        pointerAt(ctx, cellAt(ctx, 3), 'pointerup', 0, 0);
        // Valid targets: 1 and 3 → 5 each, nothing held.
        for (const slot of [1, 3]) {
            ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
                where: p => p.ToSlot === slot && p.Count === 5,
            }));
        }
        const bad = ctx.handle.publishes().filter(p =>
            p.channel === 'UI.Cmd.Inventory.Move' && (p.payload.ToSlot === 2 || p.payload.ToSlot === 0));
        ctx.expect(ctx.assert.eq(bad.length, 0, 'source and foreign cells never targeted'));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'nothing left held'));
    },
});

// ---- The in-panel hotbar strip ----------------------------------------------

// The hotbar is player grid cells 0..7, drawn as a SEPARATE STRIP along the bottom of the
// panel that shows the bag (Minecraft's layout). Two renderGrid hosts, one inventory: the bag
// takes startSlot..end and the strip takes 0..endSlot. These scenarios pin the seam between
// them — a stack dragged across it must commit as an ordinary Move, never as a world drop.
//
// Laid out beside the fixture grid, not over it, so every hit test is unambiguous.
function ensureHotbarFixture(ctx, items) {
    let strip = ctx.doc.getElementById('hotbar-strip');
    if (!strip) {
        strip = ctx.doc.createElement('div');
        strip.id = 'hotbar-strip';
        strip.style.cssText = 'position:fixed;left:420px;top:80px;display:grid;'
            + 'grid-template-columns:repeat(8,48px);grid-auto-rows:48px;gap:4px;';
        ctx.doc.body.appendChild(strip);
    }
    ctx.win.TSICInventory.renderGrid(strip, items || [], {
        gridWidth: 8, slotCount: 8, endSlot: 8, hotbarSlots: 8, ownerId: 'Player',
    });
    return strip;
}
function hudSlot(ctx, i) { return ctx.doc.querySelector('#hotbar-strip .tsic-slot[data-grid="' + i + '"]'); }

TSICTestHarness.register({
    name: 'Unit/InventoryJs: press-drag-release onto the hotbar strip moves into that grid cell',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        ctx.handle.setItemCatalog({ ID_Axe: { Category: 'Equipment' } });
        const items = [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 9, GridSlot: 12 }];
        renderHost(ctx, items);
        ensureHotbarFixture(ctx, items);
        pointerAt(ctx, cellAt(ctx, 12), 'pointerdown', 1, 0);
        pointerAt(ctx, hudSlot(ctx, 2), 'pointermove', 1);
        pointerAt(ctx, hudSlot(ctx, 2), 'pointerup', 0, 0);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.ToSlot === 2 && p.FromSlot === 12 && p.ItemId === 9,
        }));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot'));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'gesture completed'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: click-move-click onto the hotbar strip moves instead of dropping in the world',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        ctx.handle.setItemCatalog({ ID_Bread: { Category: 'Consumable' } });
        const items = [{ ItemId: 'ID_Bread', Count: 3, InstanceId: 5, GridSlot: 11 }];
        renderHost(ctx, items);
        ensureHotbarFixture(ctx, items);
        click(ctx, cellAt(ctx, 11)); // pick up
        pressReleaseOn(ctx, hudSlot(ctx, 2));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.ToSlot === 2 && p.FromSlot === 11 && p.ItemId === 5,
        }));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot'));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'gesture completed'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: the hotbar strip is bounded — parked overflow extends the bag, not the strip',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        // endSlot is what lets two hosts split one inventory. Without it, renderGrid's
        // load-overflow fallback (an item parked past the slot cap extends the grid by whole
        // rows) would grow the strip over the bag's cells too, and the player would see every
        // one of them twice.
        ctx.clearPublishes();
        const strip = ensureHotbarFixture(ctx, [
            { ItemId: 'ID_Axe', Count: 1, InstanceId: 9, GridSlot: 3 },
            { ItemId: 'ID_Axe', Count: 1, InstanceId: 11, GridSlot: 40 },
        ]);
        ctx.expect(ctx.assert.eq(strip.querySelectorAll('.tsic-slot').length, 8,
            'the strip is exactly the hotbar, whatever is parked past the bag cap'));
        ctx.expect(ctx.assert.eq(strip.querySelectorAll('.tsic-slot[data-grid="40"]').length, 0,
            'an overflow item never lands in the strip'));
        // The number chips are what mark the band as the hotbar rather than more bag.
        ctx.expect(ctx.assert.eq(strip.querySelectorAll('.tsic-slot.is-hotbar .hotbar-key').length, 8,
            'all eight cells are numbered'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: crafting materials go on the hotbar like anything else',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        // The old model refused non-equippables because an assignment to one was dead. A
        // hotbar cell is an inventory cell now, so a stack of scrap belongs there if the
        // player puts it there.
        ctx.clearPublishes();
        ctx.handle.setItemCatalog({ ID_Scrap: { Category: 'CraftingMaterial' } });
        const items = [{ ItemId: 'ID_Scrap', Count: 4, InstanceId: 7, GridSlot: 10 }];
        renderHost(ctx, items);
        ensureHotbarFixture(ctx, items);
        pointerAt(ctx, cellAt(ctx, 10), 'pointerdown', 1, 0);
        pointerAt(ctx, hudSlot(ctx, 1), 'pointermove', 1);
        pointerAt(ctx, hudSlot(ctx, 1), 'pointerup', 0, 0);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.ToSlot === 1 && p.FromSlot === 10 && p.ItemId === 7,
        }));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot'));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'gesture completed'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: RMB drag places ONE per swept cell without doubling on release',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        renderHost(ctx, [{ ItemId: 'ID_A', Count: 6, InstanceId: 9, GridSlot: 0 }]);
        click(ctx, cellAt(ctx, 0)); // hold 6
        pointerAt(ctx, cellAt(ctx, 1), 'pointerdown', 2, 2);
        pointerAt(ctx, cellAt(ctx, 1), 'pointermove', 2);
        pointerAt(ctx, cellAt(ctx, 2), 'pointermove', 2);
        pointerAt(ctx, cellAt(ctx, 3), 'pointermove', 2);
        pointerAt(ctx, cellAt(ctx, 3), 'pointerup', 0, 2);
        rmb(ctx, cellAt(ctx, 3)); // release contextmenu must NOT double-place
        const ones = ctx.handle.publishes().filter(p =>
            p.channel === 'UI.Cmd.Inventory.Move' && p.payload.Count === 1);
        ctx.expect(ctx.assert.eq(ones.length, 3, 'exactly one unit per swept cell'));
        const held = ctx.win.TSICInventory.getHeld();
        ctx.expect(ctx.assert.eq(held && held.count, 3, 'ghost decremented per placement'));
        ctx.win.TSICInventory.cancelHeld();
    },
});
