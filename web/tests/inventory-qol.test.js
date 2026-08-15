// Tests for the inventory quality-of-life layer: exact-amount split,
// durability/NEW cell overlays, comparison deltas in the info card, and the
// storage shell's bulk ops + container capacity meter.
//
// These cover the gaps that made the inventory feel dated next to the genre:
// no way to split an exact count, no visible reason for a container refusing
// an item.

function qolCell(ctx, grid) {
    return ctx.doc.querySelector('#host .tsic-slot[data-grid="' + grid + '"]');
}
function qolLayout(ctx) {
    if (ctx.doc.getElementById('zz-qol-style')) return;
    const s = ctx.doc.createElement('style');
    s.id = 'zz-qol-style';
    s.textContent = '#host{display:grid;grid-template-columns:repeat(4,48px);grid-auto-rows:48px;gap:4px;width:max-content;} .tsic-slot{width:48px;height:48px;}';
    ctx.doc.head.appendChild(s);
}
function qolRender(ctx, items, extra) {
    qolLayout(ctx);
    const host = ctx.doc.getElementById('host');
    host.innerHTML = '';
    ctx.win.TSICInventory.cancelHeld();
    ctx.win.TSICInventory.renderGrid(host, items, Object.assign({
        gridWidth: 4, slotCount: 8, ownerId: 'Player',
    }, extra || {}));
    return host;
}
function qolContextMenu(ctx, el, opts) {
    el.dispatchEvent(new ctx.win.MouseEvent('contextmenu',
        Object.assign({ bubbles: true, cancelable: true, button: 2 }, opts || {})));
}
function qolHover(ctx, el) {
    el.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: false }));
}

// ---- Durability / lock / NEW cell overlays -------------------------------

TSICTestHarness.register({
    name: 'QoL/Cells: durability renders a wear bar; items without durability render none',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        qolRender(ctx, [
            { ItemId: 'ID_Worn', Count: 1, InstanceId: 1, GridSlot: 0, Durability: 20, MaxDurability: 100 },
            { ItemId: 'ID_Plain', Count: 1, InstanceId: 2, GridSlot: 1, Durability: -1, MaxDurability: -1 },
        ]);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#host .tsic-slot[data-grid="0"] .wear', 1));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#host .tsic-slot[data-grid="1"] .wear', 0));
        // 20% remaining is critical, not merely warning.
        const bar = ctx.doc.querySelector('#host .tsic-slot[data-grid="0"] .wear');
        ctx.expect(ctx.assert.truthy(bar.classList.contains('warn') || bar.classList.contains('crit'),
            'low durability should be flagged'));
    },
});

TSICTestHarness.register({
    name: 'QoL/Cells: NEW badge marks arrivals only after a baseline, and clears on hover',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const inv = ctx.win.TSICInventory;
        const first = [{ ItemId: 'ID_A', Count: 1, InstanceId: 1, GridSlot: 0 }];
        // First snapshot is the baseline — nothing is "new" on a fresh look.
        inv.noteSnapshot('Player', first);
        qolRender(ctx, first);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#host .new-badge', 0));

        const second = first.concat([{ ItemId: 'ID_B', Count: 1, InstanceId: 2, GridSlot: 1 }]);
        inv.noteSnapshot('Player', second);
        qolRender(ctx, second);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#host .tsic-slot[data-grid="1"] .new-badge', 1));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#host .tsic-slot[data-grid="0"] .new-badge', 0));

        // Looking at it acknowledges it.
        qolHover(ctx, qolCell(ctx, 1));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#host .tsic-slot[data-grid="1"] .new-badge', 0));
    },
});

// ---- Exact-amount split --------------------------------------------------

TSICTestHarness.register({
    name: 'QoL/Split: shift+RMB opens the dialog; plain RMB still takes the larger half',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        qolRender(ctx, [{ ItemId: 'ID_A', Count: 7, InstanceId: 1, GridSlot: 0 }]);

        // Plain RMB keeps the fast path and opens no dialog.
        qolContextMenu(ctx, qolCell(ctx, 0));
        ctx.expect(ctx.assert.domCount(ctx.doc, '.tsic-split-dialog', 0));
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld().count, 4, 'RMB holds the larger half'));
        ctx.win.TSICInventory.cancelHeld();

        qolContextMenu(ctx, qolCell(ctx, 0), { shiftKey: true });
        ctx.expect(ctx.assert.domCount(ctx.doc, '.tsic-split-dialog', 1));
        // Opening the dialog must not also pick the stack up.
        ctx.expect(ctx.assert.eq(ctx.win.TSICInventory.getHeld(), null, 'dialog does not hold the stack'));
        ctx.win.TSICInventory.closeSplit();
        ctx.expect(ctx.assert.domCount(ctx.doc, '.tsic-split-dialog', 0));
    },
});

TSICTestHarness.register({
    name: 'QoL/Split: dialog publishes Split with the typed count, clamped to the stack',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        qolRender(ctx, [{ ItemId: 'ID_A', Count: 20, InstanceId: 9, GridSlot: 2 }]);
        qolContextMenu(ctx, qolCell(ctx, 2), { shiftKey: true });

        const num = ctx.doc.querySelector('.tsic-split-dialog input[type=number]');
        ctx.expect(ctx.assert.truthy(num, 'expected an amount field'));
        // 999 must clamp to 19 — a split can never take the whole stack.
        num.value = '999';
        num.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        ctx.doc.querySelector('.tsic-split-dialog button.go').click();

        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Split', {
            where: p => p.OwnerId === 'Player' && p.FromSlot === 2 && p.ToSlot === -1 && p.Count === 19,
        }));
        ctx.expect(ctx.assert.domCount(ctx.doc, '.tsic-split-dialog', 0));
    },
});

TSICTestHarness.register({
    name: 'QoL/Split: a single-item stack has nothing to split',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        qolRender(ctx, [{ ItemId: 'ID_A', Count: 1, InstanceId: 1, GridSlot: 0 }]);
        qolContextMenu(ctx, qolCell(ctx, 0), { shiftKey: true });
        ctx.expect(ctx.assert.domCount(ctx.doc, '.tsic-split-dialog', 0));
    },
});

// ---- Info card comparison ------------------------------------------------

TSICTestHarness.register({
    name: 'QoL/Info: comparing against equipped gear shows signed stat deltas',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.createElement('div');
        ctx.doc.body.appendChild(host);
        const candidate = { ItemId: 'ID_BigPack', Name: 'Big Pack', Category: 'Equipment', Weight: 3, BonusInventorySlots: 16 };
        const worn = { ItemId: 'ID_SmallPack', Name: 'Small Pack', Weight: 2, BonusInventorySlots: 8 };
        ctx.win.TSICInventory.renderInfoPanel(host, candidate, { Count: 1 }, worn);

        const text = host.textContent;
        ctx.expect(ctx.assert.truthy(text.includes('SLOTS'), 'slots row present'));
        ctx.expect(ctx.assert.truthy(text.includes('+8'), 'slot delta shown, got: ' + text));
        ctx.expect(ctx.assert.truthy(text.includes('+1'), 'weight delta shown, got: ' + text));
        ctx.expect(ctx.assert.truthy(text.includes('Small Pack'), 'names the compared item'));
        host.remove();
    },
});

TSICTestHarness.register({
    name: 'QoL/Info: with nothing equipped in that slot the card shows no deltas',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.createElement('div');
        ctx.doc.body.appendChild(host);
        ctx.win.TSICInventory.renderInfoPanel(
            host, { ItemId: 'ID_BigPack', Name: 'Big Pack', Weight: 3, BonusInventorySlots: 16 }, { Count: 1 }, null);
        ctx.expect(ctx.assert.truthy(!host.textContent.includes('vs equipped'), 'no comparison line'));
        host.remove();
    },
});

TSICTestHarness.register({
    name: 'QoL/Info: condition renders as a percentage',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.createElement('div');
        ctx.doc.body.appendChild(host);
        ctx.win.TSICInventory.renderInfoPanel(
            host, { ItemId: 'ID_Axe', Name: 'Axe', Weight: 2 },
            { Count: 1, Durability: 45, MaxDurability: 100 }, null);
        ctx.expect(ctx.assert.truthy(host.textContent.includes('CONDITION'), 'condition row'));
        ctx.expect(ctx.assert.truthy(host.textContent.includes('45%'), 'condition percent'));
        host.remove();
    },
});
