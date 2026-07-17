// Unit tests for shared/inventory.js (window.TSICInventory namespace).
TSICTestHarness.register({
    name: 'Unit/InventoryJs: TSICInventory namespace is installed',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.expect(ctx.assert.truthy(ctx.win.TSICInventory, 'expected window.TSICInventory'));
        ctx.expect(ctx.assert.truthy(typeof ctx.win.TSICInventory.renderGrid === 'function'));
        ctx.expect(ctx.assert.truthy(typeof ctx.win.TSICInventory.renderInfoPanel === 'function'));
        ctx.expect(ctx.assert.truthy(typeof ctx.win.TSICInventory.openQuantityModal === 'function'));
        ctx.expect(ctx.assert.truthy(typeof ctx.win.TSICInventory.openHotbarSlotModal === 'function'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: renderGrid lays out N slots and places items by SlotIndex',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.getElementById('host');
        host.innerHTML = '';
        ctx.win.TSICInventory.renderGrid(host, [
            { ItemId: 'ID_A', Count: 2, SlotIndex: 0 },
            { ItemId: 'ID_B', Count: 7, SlotIndex: 5 },
        ], { maxSlots: 8 });
        ctx.expect(ctx.assert.domCount(ctx.doc, '#host .tsic-slot', 8));
        // Counts appear when Count > 1
        const counts = ctx.doc.querySelectorAll('#host .count');
        ctx.expect(ctx.assert.eq(counts.length, 2));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: onHover / onClick / onRMB callbacks fire',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const host = ctx.doc.getElementById('host');
        host.innerHTML = '';
        let hovered = null, clicked = null, rmb = null;
        ctx.win.TSICInventory.renderGrid(host, [{ ItemId: 'ID_X', Count: 1, SlotIndex: 0 }], {
            maxSlots: 4,
            onHover: (it) => { hovered = it; },
            onClick: (it) => { clicked = it; },
            onRMB:   (it) => { rmb = it; },
        });
        const slot = ctx.doc.querySelector('#host .tsic-slot[data-slot="0"]');
        slot.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        slot.click();
        slot.dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.eq(hovered && hovered.ItemId, 'ID_X'));
        ctx.expect(ctx.assert.eq(clicked && clicked.ItemId, 'ID_X'));
        ctx.expect(ctx.assert.eq(rmb && rmb.ItemId, 'ID_X'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: openHotbarSlotModal renders 10 buttons + Esc dismisses without picking',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        let picked = null;
        ctx.win.TSICInventory.openHotbarSlotModal('ID_X', (slotIndex) => { picked = slotIndex; });
        // Modal renders 10 buttons in an overlay.
        const buttons = ctx.doc.querySelectorAll('body > div button.tsic-button');
        ctx.expect(ctx.assert.eq(buttons.length, 10));
        // Esc dismisses
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.eq(picked, null));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('body > div button.tsic-button').length, 0));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: openHotbarSlotModal accepts 0-9 keypress',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        let picked = null;
        ctx.win.TSICInventory.openHotbarSlotModal('ID_X', (slotIndex) => { picked = slotIndex; });
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: '0', bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.eq(picked, 9));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: openQuantityModal slider + Drop calls onConfirm',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        let count = null;
        ctx.win.TSICInventory.openQuantityModal(5, (n) => { count = n; });
        const slider = ctx.doc.querySelector('input[type="range"]');
        slider.value = '3';
        slider.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        const ok = Array.from(ctx.doc.querySelectorAll('button')).find(b => /drop/i.test(b.textContent || ''));
        ok && ok.click();
        ctx.expect(ctx.assert.eq(count, 3));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: openQuantityModal honors opts.initial and clamps it',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.win.TSICInventory.openQuantityModal(9, () => {}, { initial: 4 });
        let slider = ctx.doc.querySelector('input[type="range"]');
        ctx.expect(ctx.assert.eq(slider.value, '4'));
        Array.from(ctx.doc.querySelectorAll('button')).find(b => /cancel/i.test(b.textContent || '')).click();
        // Out-of-range initial clamps to the max.
        ctx.win.TSICInventory.openQuantityModal(3, () => {}, { initial: 99 });
        slider = ctx.doc.querySelector('input[type="range"]');
        ctx.expect(ctx.assert.eq(slider.value, '3'));
        Array.from(ctx.doc.querySelectorAll('button')).find(b => /cancel/i.test(b.textContent || '')).click();
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: context menu on a stack offers Split…, Drop, and Drop X…',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const entries = ctx.win.TSICInventory.buildItemContextMenu({
            it: { ItemId: 'ID_W', InstanceId: 4, SlotIndex: 0, Count: 6, GridSlot: 2 },
            desc: { Name: 'Wood', Category: 'CraftingMaterial' },
        });
        const labels = entries.map(e => e.label);
        ctx.expect(ctx.assert.eq(labels.includes('Split…'), true, 'Split entry on a stack'));
        ctx.expect(ctx.assert.eq(labels.includes('Drop'), true, 'whole-stack Drop entry'));
        ctx.expect(ctx.assert.eq(labels.includes('Drop X…'), true, 'amount-picker Drop X entry'));

        const single = ctx.win.TSICInventory.buildItemContextMenu({
            it: { ItemId: 'ID_W', InstanceId: 5, SlotIndex: 1, Count: 1, GridSlot: 3 },
            desc: { Name: 'Wood', Category: 'CraftingMaterial' },
        }).map(e => e.label);
        ctx.expect(ctx.assert.eq(single.includes('Split…'), false, 'no Split on a single item'));
        ctx.expect(ctx.assert.eq(single.includes('Drop'), true, 'Drop still offered'));
        ctx.expect(ctx.assert.eq(single.includes('Drop X…'), false, 'no Drop X on a single item'));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: Drop entry publishes a whole-stack Drop (Count 0)',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        const entries = ctx.win.TSICInventory.buildItemContextMenu({
            it: { ItemId: 'ID_W', InstanceId: 4, SlotIndex: 7, Count: 6, GridSlot: 2 },
            desc: { Name: 'Wood', Category: 'CraftingMaterial' },
        });
        entries.find(e => e.label === 'Drop').onClick();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Drop',
            { where: p => p.SlotIndex === 7 && p.Count === 0 }));
    },
});

TSICTestHarness.register({
    name: 'Unit/InventoryJs: Split… modal maxes at Count-1 and publishes UI.Cmd.Inventory.Split',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        const entries = ctx.win.TSICInventory.buildItemContextMenu({
            it: { ItemId: 'ID_W', InstanceId: 4, SlotIndex: 0, Count: 6, GridSlot: 2 },
            desc: { Name: 'Wood', Category: 'CraftingMaterial' },
        });
        entries.find(e => e.label === 'Split…').onClick();
        const slider = ctx.doc.querySelector('input[type="range"]');
        ctx.expect(ctx.assert.truthy(slider, 'quantity modal opened'));
        ctx.expect(ctx.assert.eq(slider.max, '5'));
        ctx.expect(ctx.assert.eq(slider.value, '3'));
        const ok = Array.from(ctx.doc.querySelectorAll('button')).find(b => /^split$/i.test((b.textContent || '').trim()));
        ok && ok.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Split',
            { where: p => p.FromSlot === 2 && p.ToSlot === -1 && p.Count === 3 }));
    },
});
