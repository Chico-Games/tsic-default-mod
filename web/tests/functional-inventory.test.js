// Functional coverage for the inventory screen — edge cases + flows.
TSICTestHarness.register({
    name: 'Inventory: empty payload renders an empty grid',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32, MaxWeight: 50, CurrentWeight: 0 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-grid .tsic-slot').length > 0);
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-capacity-text', /CAPACITY: 0 items/));
        // Cells render, but none is occupied (occupied cells carry data-slot).
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#inv-grid .tsic-slot[data-slot]').length, 0));
    },
});

TSICTestHarness.register({
    name: 'Inventory: ignores updates for non-Player owners',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:1', Items: [{ ItemId: 'X', Count: 1, SlotIndex: 0, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        await new Promise(r => setTimeout(r, 80));
        // Inventory grid should not show the storage item.
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#inv-grid .tsic-slot[data-slot]').length, 0));
    },
});

TSICTestHarness.register({
    name: 'Inventory: zero MaxWeight does not divide-by-zero',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32, MaxWeight: 0, CurrentWeight: 0 });
        await new Promise(r => setTimeout(r, 80));
        // dataset.state should default to 'normal' when MaxWeight=0.
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('inv-capacity').dataset.state, 'normal'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: ratio at exactly 75% is warning, exactly 100% is full',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32, MaxWeight: 10, CurrentWeight: 7.5 });
        await ctx.waitFor(() => ctx.doc.getElementById('inv-capacity').dataset.state === 'warning');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32, MaxWeight: 10, CurrentWeight: 10 });
        await ctx.waitFor(() => ctx.doc.getElementById('inv-capacity').dataset.state === 'full');
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('inv-capacity').dataset.state, 'full'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: tab filter dims non-matching items in place',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_Axe:   { Name: 'Axe',   Category: 'Equipment' },
            ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial' },
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [
            { ItemId: 'ID_Axe',   Count: 1, SlotIndex: 0, InstanceId: 1, GridSlot: 0 },
            { ItemId: 'ID_Wheat', Count: 5, SlotIndex: 1, InstanceId: 2, GridSlot: 1 },
        ], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]'));
        const tab = Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(t => (t.textContent || '').trim() === 'Equipment');
        tab.click();
        await new Promise(r => setTimeout(r, 30));
        // Axe stays lit at cell 0; Wheat stays IN cell 1 but is dimmed.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-grid="0"]:not(.is-filtered)'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-grid="1"].is-filtered'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: Close button publishes Pause.Resume and CharacterPreview.Hide',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.getElementById('btn-close'));
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-close').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.CharacterPreview.Hide'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: opens CharacterPreview.Show automatically on activate',
    file: '/screens/inventory.html',
    async run(ctx) {
        await new Promise(r => setTimeout(r, 120));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.CharacterPreview.Show'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: stack > 1 RMB → context menu → Drop entry → opens drop quantity modal',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_W: { Name: 'Wheat', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [{ ItemId: 'ID_W', Count: 8, SlotIndex: 0, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]'));
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await ctx.waitFor(() => Array.from(ctx.doc.querySelectorAll('.tsic-context-menu .tsic-context-item')).some(e => (e.textContent || '').trim() === 'Drop…'));
        Array.from(ctx.doc.querySelectorAll('.tsic-context-menu .tsic-context-item'))
            .find(e => (e.textContent || '').trim() === 'Drop…').click();
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domExists(ctx.doc, 'input[type="range"]'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: equipment payload renders slots in the paper doll',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Equipment.Updated', {
            OwnerId: 'Player',
            Slots: [
                { SlotTag: 'Entity.Inventory.Item.Equipment.Slot.Head', ItemId: 'ID_Helmet', IconUrl: '' },
                { SlotTag: 'Entity.Inventory.Item.Equipment.Slot.Body', ItemId: '',          IconUrl: '' },
            ],
        });
        // The doll always shows the six canonical slots; server data fills them.
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-doll .equip-slot').length >= 6);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#inv-doll .equip-slot', 6));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-doll .equip-slot[data-equip="Head"] img'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-doll .equip-slot[data-equip="Body"].is-empty'));
    },
});
