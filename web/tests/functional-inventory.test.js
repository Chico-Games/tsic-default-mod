// Functional coverage for the inventory screen — edge cases + flows
// (grid model: cells carry data-grid always, data-instance when occupied).
TSICTestHarness.register({
    name: 'Inventory: empty payload renders an empty grid',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32, MaxWeight: 50, CurrentWeight: 0 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-grid .tsic-slot').length > 0);
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-slots-text', /0\/32 SLOTS/));
        // Cells render, but none is occupied (occupied cells carry data-instance).
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#inv-grid .tsic-slot[data-instance]').length, 0));
    },
});

TSICTestHarness.register({
    name: 'Inventory: ignores updates for non-Player owners',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:1', GridWidth: 8, Items: [{ ItemId: 'X', Count: 1, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        await new Promise(r => setTimeout(r, 80));
        // Inventory grid should not show the storage item.
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#inv-grid .tsic-slot[data-instance]').length, 0));
    },
});

TSICTestHarness.register({
    name: 'Inventory: zero MaxWeight does not divide-by-zero',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32, MaxWeight: 0, CurrentWeight: 0 });
        await ctx.waitFor(() => ctx.doc.getElementById('inv-meter'));
        // dataset.state should default to 'normal' when MaxWeight=0.
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('inv-meter').dataset.state, 'normal'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: 75% is warning; overburdened only strictly past the cap',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32, MaxWeight: 10, CurrentWeight: 7.5 });
        await ctx.waitFor(() => ctx.doc.getElementById('inv-meter').dataset.state === 'warning');
        // Exactly AT the cap is still the soft warning; only past it overburdens.
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32, MaxWeight: 10, CurrentWeight: 10 });
        await ctx.waitFor(() => ctx.doc.getElementById('inv-meter').dataset.state === 'warning');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32, MaxWeight: 10, CurrentWeight: 10.1 });
        await ctx.waitFor(() => ctx.doc.getElementById('inv-meter').dataset.state === 'overburdened');
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('inv-meter').dataset.state, 'overburdened'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: tab filter dims non-matching items in place',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.setItemCatalog({
            ID_Axe:   { Name: 'Axe',   Category: 'Equipment' },
            ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial' },
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [
            { ItemId: 'ID_Axe',   Count: 1, InstanceId: 1, GridSlot: 0 },
            { ItemId: 'ID_Wheat', Count: 5, InstanceId: 2, GridSlot: 1 },
        ], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-instance="1"]'));
        const tab = Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(t => (t.textContent || '').trim() === 'Equip');
        tab.click();
        await new Promise(r => setTimeout(r, 30));
        // Rule 48: Axe stays lit at cell 0; Wheat stays IN cell 1 but is dimmed.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-grid="0"]:not(.is-filtered)'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-grid="1"].is-filtered'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: Back closes the screen — Pause.Resume + CharacterPreview.Hide',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot'));
        ctx.clearPublishes();
        // No close button on the screen — Esc/B goes through the router's Back.
        ctx.inject('tsic.msg.UI.Behavior.Back', { Phase: 'Started' });
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
        // The unmount fires the preview teardown.
        ctx.screen('None');
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.CharacterPreview.Hide'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: opens CharacterPreview.Show automatically on activate',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        await new Promise(r => setTimeout(r, 120));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.CharacterPreview.Show'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: G on a hovered stack publishes DropFromSlot (modal flow deleted)',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.setItemCatalog({ ID_W: { Name: 'Wheat', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [{ ItemId: 'ID_W', Count: 8, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-instance="1"]'));
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        ctx.clearPublishes();
        ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'g', bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.DropFromSlot',
            { where: p => p.ItemId === 1 && p.Slot === 0 && p.Count === 1 }));
        // §7.6: the RMB context menu + quantity modal are gone for good.
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('.tsic-context-menu').length, 0));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('input[type="range"]').length, 0));
        ctx.win.TSICInventory.cancelHeld();
    },
});

TSICTestHarness.register({
    name: 'Inventory: equipment payload renders slots in the paper doll',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Equipment.Updated', {
            OwnerId: 'Player',
            Slots: [
                { SlotTag: 'Entity.Inventory.Item.Equipment.Slot.Head', ItemId: 'ID_Helmet', IconUrl: '' },
                { SlotTag: 'Entity.Inventory.Item.Equipment.Slot.Body', ItemId: '',          IconUrl: '' },
            ],
        });
        // The doll always shows the six canonical armor+backpack slots.
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-doll .equip-slot').length >= 6);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#inv-doll .equip-slot', 6));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-doll .equip-slot[data-equip="Head"] img'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-doll .equip-slot[data-equip="Body"]:not(.is-full)'));
    },
});
