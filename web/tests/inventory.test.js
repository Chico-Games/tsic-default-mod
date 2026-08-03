// Inventory screen scenarios — grid design §10.1 "Split Page" layout over the
// SHARED screen module (screens/inventory.html only boots screen-manager +
// shared/screens/inventory.js). Covers §9: 28 (Q drop), 48 (filter dims in
// place), §10.1 (slots text, weight bar + reserved chip, locked preview),
// hover+number swap, and shift-click.
//
// The grid's first row IS the hotbar (docs/plans/2026-08-01-slot-backed-hotbar.md): those
// cells are ordinary inventory cells, so anything asserting a separate in-screen hotbar
// widget, an assignment command or a reserved fists cell is testing a model that no longer
// exists.

async function showInventory(ctx, payload) {
    ctx.screen('Inventory');
    ctx.inject('tsic.msg.UI.Inventory.Updated', Object.assign({
        OwnerId: 'Player', Items: [], MaxSlots: 32, GridWidth: 8,
        GridHeight: 4, MaxWeight: 80, CurrentWeight: 0,
    }, payload || {}));
    await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot'));
}

TSICTestHarness.register({
    name: 'Inventory: renders SlotCount live cells + locked preview cells',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable', Weight: 0.2 } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Bread', Count: 3, InstanceId: 1, GridSlot: 0 }],
            MaxSlots: 32, CurrentWeight: 0.6,
        });
        // 32 live + 16 greyed preview (up to the 48-slot bag tier).
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-grid .tsic-slot').length === 48);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#inv-grid .tsic-slot.is-locked', 16));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-grid="0"][data-instance="1"] img'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-slots-text', /1\/32 SLOTS/));
    },
});

TSICTestHarness.register({
    name: 'Inventory: backpack equip shrinks the locked preview band (32 -> 40 live)',
    file: '/screens/inventory.html',
    async run(ctx) {
        await showInventory(ctx, { MaxSlots: 40 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-grid .tsic-slot').length === 48);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#inv-grid .tsic-slot.is-locked', 8));
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-slots-text', /0\/40 SLOTS/));
    },
});

TSICTestHarness.register({
    name: 'Inventory: weight bar pegs at 100% while the number counts past the soft cap',
    file: '/screens/inventory.html',
    async run(ctx) {
        await showInventory(ctx, { MaxWeight: 10, CurrentWeight: 12 });
        await ctx.waitFor(() => ctx.doc.getElementById('inv-meter').dataset.state === 'overburdened');
        ctx.expect(ctx.assert.eq(parseFloat(ctx.doc.getElementById('inv-weight-fill').style.width), 100));
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-weight-text', /12\.0\/10 kg/));
    },
});

TSICTestHarness.register({
    name: 'Inventory: hovered-stack weight chip reserves space in the bar',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Brick: { Name: 'Brick', Category: 'CraftingMaterial', Weight: 0.5 } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Brick', Count: 10, InstanceId: 1, GridSlot: 0 }],
            MaxWeight: 80, CurrentWeight: 5,
        });
        const chip = ctx.doc.getElementById('inv-stackw');
        // Space reserved (hidden, not removed) while nothing is hovered.
        ctx.expect(ctx.assert.truthy(chip.classList.contains('none'), 'chip hidden but present'));
        const before = chip.getBoundingClientRect().width;
        // Hovering the stack fills the chip without moving the bar labels.
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        await ctx.waitFor(() => !chip.classList.contains('none'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-stackw', /5\.0 kg/));
        ctx.expect(ctx.assert.eq(Math.abs(chip.getBoundingClientRect().width - before) < 12, true,
            'reserved space: hover does not deform the bar'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: tabs dim non-matching cells without moving them (rule 48)',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_Axe: { Name: 'Axe', Category: 'Equipment' },
            ID_Bread: { Name: 'Bread', Category: 'Consumable' },
        });
        await showInventory(ctx, {
            Items: [
                { ItemId: 'ID_Axe', Count: 1, InstanceId: 1, GridSlot: 0 },
                { ItemId: 'ID_Bread', Count: 2, InstanceId: 2, GridSlot: 5 },
            ],
        });
        const tab = Array.from(ctx.doc.querySelectorAll('#inv-tabs .tsic-tab'))
            .find(t => /Cons/.test(t.textContent || ''));
        tab.click();
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-instance="1"].is-filtered'));
        // Positions unchanged — the axe still sits in cell 0, just dimmed.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-grid="0"][data-instance="1"].is-filtered'));
        ctx.expect(ctx.assert.eq(
            ctx.doc.querySelector('#inv-grid .tsic-slot[data-instance="2"]').classList.contains('is-filtered'),
            false, 'matching item stays lit'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: hover + number key swaps the hovered stack into that hotbar cell',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 5, GridSlot: 20 }],
        });
        const cell = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="20"]');
        cell.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.clearPublishes();
        // A number key is Minecraft's swap: an ordinary grid move into that cell.
        ctx.events.key(ctx.doc, '2');
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.ToSlot === 1 && p.FromSlot === 20 && p.ItemId === 5,
        }));
        // "0" is not a hotbar key any more — the bar is eight cells.
        ctx.clearPublishes();
        ctx.events.key(ctx.doc, '0');
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.Move'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: any item can go on the hotbar, including crafting materials',
    file: '/screens/inventory.html',
    async run(ctx) {
        // The old model gated the bar to equipment/consumables because an assignment to
        // anything else was dead. Cells are cells now, so a stack of bricks is welcome.
        ctx.setItemCatalog({ ID_Brick: { Name: 'Brick', Category: 'CraftingMaterial' } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Brick', Count: 12, InstanceId: 9, GridSlot: 17 }],
        });
        const cell = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="17"]');
        cell.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.clearPublishes();
        ctx.events.key(ctx.doc, '4');
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.ToSlot === 3 && p.FromSlot === 17 && p.ItemId === 9,
        }));
    },
});

TSICTestHarness.register({
    name: 'Inventory: G drops one from the hovered stack, Ctrl+G the whole stack (rule 28)',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Brick: { Name: 'Brick', Category: 'CraftingMaterial' } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Brick', Count: 5, InstanceId: 3, GridSlot: 2 }],
        });
        const cell = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="2"]');
        cell.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.clearPublishes();
        ctx.events.key(ctx.doc, 'g');
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot', {
            where: p => p.ItemId === 3 && p.Slot === 2 && p.Count === 1,
        }));
        ctx.clearPublishes();
        ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot', {
            where: p => p.ItemId === 3 && p.Count === 0,
        }));
    },
});

TSICTestHarness.register({
    name: 'Inventory: shift-click on an equippable equips it (armor quick-move parity)',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Helmet: {
            Name: 'Helmet', Category: 'Equipment',
            EquipmentSlot: 'Entity.Inventory.Item.Equipment.Slot.Head',
        } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Helmet', Count: 1, InstanceId: 4, GridSlot: 1 }],
        });
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="1"]')
            .dispatchEvent(new ctx.win.MouseEvent('click', { bubbles: true, shiftKey: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Equipment.Equip', {
            where: p => p.ItemId === '4',
        }));
        // Armour goes to the doll, never to the other band.
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.Move'));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'quick-move never holds'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: doll is armor-only + Backpack — no Weapon cell (§10.1)',
    file: '/screens/inventory.html',
    async run(ctx) {
        await showInventory(ctx, {});
        // Head/Body/Outfit/Backpack + Gloves/Legs/Shoes. Outfit joined the doll
        // in ff76517; this count was left at the old 6.
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-doll .equip-slot').length === 7);
        const labels = Array.from(ctx.doc.querySelectorAll('#inv-doll .equip-slot'))
            .map(d => d.dataset.equip);
        ctx.expect(ctx.assert.eq(labels.includes('Backpack'), true, 'Backpack doll cell present'));
        ctx.expect(ctx.assert.eq(labels.includes('Weapon'), false, 'Weapon stays off the doll'));
        ctx.expect(ctx.assert.eq(labels.includes('Gloves'), true));
    },
});

TSICTestHarness.register({
    name: 'Inventory: the first grid row is the hotbar, marked and numbered',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Bread', Count: 3, InstanceId: 7, GridSlot: 0 }],
        });
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: 0, SelectedSlotPending: -1 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-grid .tsic-slot.is-hotbar').length === 8);

        // There is no separate in-screen widget any more — the mirror is gone for good.
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#inv-hotbar').length, 0,
            'the in-screen hotbar mirror is deleted'));

        const first = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]');
        ctx.expect(ctx.assert.truthy(first.classList.contains('is-hotbar'), 'cell 0 is on the bar'));
        ctx.expect(ctx.assert.eq(first.querySelector('.hotbar-key').textContent, '1',
            'the cell position IS the hotbar number'));
        ctx.expect(ctx.assert.truthy(first.classList.contains('is-held'),
            'the drawn cell wears the selection frame'));
        // Cell 8 starts the bag.
        ctx.expect(ctx.assert.falsy(
            ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="8"]').classList.contains('is-hotbar'),
            'the bag starts at cell 8'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: hotbar cells are ordinary grid cells (pick up, place, move)',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Bread', Count: 3, InstanceId: 7, GridSlot: 2 }],
        });
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: 0, SelectedSlotPending: -1 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-grid .tsic-slot.is-hotbar').length === 8);

        // Pick a stack up OFF the bar and put it down in the bag — the same click-move-click
        // gesture any other pair of cells takes, with no hotbar command anywhere in sight.
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="2"]').click();
        ctx.expect(ctx.assert.truthy(ctx.win.TSICInventory.getHeld(), 'a hotbar cell is a drag source'));
        ctx.clearPublishes();
        // Commits ride the engine's global pointerup tracker, not the click event.
        const target = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="14"]');
        const r = target.getBoundingClientRect();
        const at = (type) => target.dispatchEvent(new ctx.win.PointerEvent(type, {
            bubbles: true, cancelable: true, button: 0,
            clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
        }));
        at('pointerdown');
        at('pointerup');
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromSlot === 2 && p.ToSlot === 14 && p.ItemId === 7,
        }));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'the placement releases the hold'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: picking a stack up does not resize the panel (hint row reserves its height)',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Bread', Count: 3, InstanceId: 7, GridSlot: 0 }],
        });
        const panel = ctx.doc.getElementById('inv-panel');
        const hints = ctx.doc.getElementById('inv-hints');
        const size = () => {
            const r = panel.getBoundingClientRect();
            return Math.round(r.width) + 'x' + Math.round(r.height);
        };
        const hintH = () => Math.round(hints.getBoundingClientRect().height);

        // The idle render measures itself and pins that height. Asserting the
        // reserve exists is what makes this test bite: at a wide enough width
        // the idle chips fit on one line, so comparing heights alone would pass
        // even with the reserve removed.
        const reserved = hints.style.minHeight;
        ctx.expect(ctx.assert.truthy(reserved, 'idle render reserves the hint-row height'));
        const idle = size();
        const idleHints = hintH();

        // Pick the stack up — the hint row swaps to the shorter held set.
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]').click();
        ctx.expect(ctx.assert.truthy(ctx.win.TSICInventory.getHeld(), 'stack held'));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.eq(hints.style.minHeight, reserved, 'reserve survives the held render'));
        ctx.expect(ctx.assert.eq(hintH(), idleHints, 'hint row keeps its height while dragging'));
        ctx.expect(ctx.assert.eq(size(), idle, 'panel must not resize while dragging'));

        // And back again when the stack is returned.
        ctx.win.TSICInventory.cancelHeld();
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.eq(size(), idle, 'panel returns to the same size'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: no context menu — RMB on a stack picks up half instead (§7.6)',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Brick: { Name: 'Brick', Category: 'CraftingMaterial' } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Brick', Count: 7, InstanceId: 1, GridSlot: 0 }],
        });
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('.tsic-context-menu').length, 0, 'no menu opens'));
        const held = ctx.win.TSICInventory.getHeld();
        ctx.expect(ctx.assert.eq(held && held.count, 4, 'larger half held instead'));
        ctx.win.TSICInventory.cancelHeld();
    },
});

TSICTestHarness.register({
    name: 'Inventory: gamepad Y/X/d-pad-down act on the focused cell (§8.2)',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Brick: { Name: 'Brick', Category: 'CraftingMaterial' } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Brick', Count: 7, InstanceId: 1, GridSlot: 0 }],
        });
        const cell = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]');
        cell.setAttribute('data-tsic-focused', '');
        // Y: pick up the larger half onto the cursor.
        ctx.inject('tsic.msg.UI.Behavior.InvSplit', { Phase: 'Started' });
        const held = ctx.win.TSICInventory.getHeld();
        ctx.expect(ctx.assert.eq(held && held.count, 4, 'Y holds the larger half'));
        ctx.win.TSICInventory.cancelHeld();
        // D-pad down: drop one from the focused stack.
        ctx.clearPublishes();
        ctx.inject('tsic.msg.UI.Behavior.InvDrop', { Phase: 'Started' });
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot', {
            where: p => p.ItemId === 1 && p.Slot === 0 && p.Count === 1,
        }));
    },
});

TSICTestHarness.register({
    name: 'Inventory: closing the screen returns a held stack (nothing ever moved)',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Brick: { Name: 'Brick', Category: 'CraftingMaterial' } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Brick', Count: 5, InstanceId: 1, GridSlot: 0 }],
        });
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]').click();
        ctx.expect(ctx.assert.truthy(ctx.win.TSICInventory.getHeld(), 'stack held'));
        ctx.clearPublishes();
        ctx.screen('InGame'); // close the overlay
        await ctx.waitFor(() => !ctx.win.TSICInventory.getHeld());
        // The gesture dissolved without any server op.
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.Move'));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: press-drag-release commits an ALREADY-held stack (no gesture dead-end)',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Brick: { Name: 'Brick', Category: 'CraftingMaterial' } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Brick', Count: 5, InstanceId: 1, GridSlot: 0 }],
        });
        // Click picks the stack up (click-carry)...
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]').click();
        ctx.expect(ctx.assert.truthy(ctx.win.TSICInventory.getHeld(), 'held after click'));
        ctx.clearPublishes();
        // ...then a press over one cell RELEASED over another must still
        // commit at the release point (the old dead-end bug).
        const src = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]');
        const dst = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="9"]');
        const rs = src.getBoundingClientRect(), rd = dst.getBoundingClientRect();
        const o = (x, y) => ({ bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
        src.dispatchEvent(new ctx.win.PointerEvent('pointerdown', o(rs.x + 24, rs.y + 24)));
        ctx.doc.dispatchEvent(new ctx.win.PointerEvent('pointermove', o(rd.x + 24, rd.y + 24)));
        ctx.doc.dispatchEvent(new ctx.win.PointerEvent('pointerup', o(rd.x + 24, rd.y + 24)));
        await new Promise(r => setTimeout(r, 50));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.ItemId === 1 && p.FromSlot === 0 && p.ToSlot === 9,
        }));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'gesture completed'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: Back returns a held stack first; the screen closes on the next press',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Brick: { Name: 'Brick', Category: 'CraftingMaterial' } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Brick', Count: 5, InstanceId: 1, GridSlot: 0 }],
        });
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]').click();
        ctx.expect(ctx.assert.truthy(ctx.win.TSICInventory.getHeld(), 'stack held'));
        ctx.clearPublishes();
        ctx.inject('tsic.msg.UI.Behavior.Back', { Phase: 'Started' });
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'first Back returns the stack'));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Pause.Resume'));
        ctx.inject('tsic.msg.UI.Behavior.Back', { Phase: 'Started' });
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: clicking never leaves a lingering selected style (§10.3 simplification)',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Brick: { Name: 'Brick', Category: 'CraftingMaterial' } });
        await showInventory(ctx, {
            Items: [{ ItemId: 'ID_Brick', Count: 5, InstanceId: 1, GridSlot: 0 }],
        });
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]').click();
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#inv-grid .tsic-slot.is-selected').length, 0,
            'no selected styling anywhere'));
        ctx.win.TSICInventory.cancelHeld();
    },
});

TSICTestHarness.register({
    name: 'Inventory: SORT button publishes UI.Cmd.Inventory.Sort for the player pane',
    file: '/screens/inventory.html',
    async run(ctx) {
        await showInventory(ctx, {});
        ctx.clearPublishes();
        ctx.doc.getElementById('inv-sort').dispatchEvent(
            new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Sort', {
            where: p => p.OwnerId === 'Player',
        }));
    },
});
