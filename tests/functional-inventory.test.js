// Functional coverage for the inventory screen — edge cases + flows.
TSICTestHarness.register({
    name: 'Inventory: empty payload renders the empty-state message',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32, MaxWeight: 50, CurrentWeight: 0 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-empty'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-capacity-text', /CAPACITY: 0 items/));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#inv-list .tsic-list-row').length, 0));
    },
});

TSICTestHarness.register({
    name: 'Inventory: ignores updates for non-Player owners',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:1', Items: [{ ItemId: 'X', Count: 1, SlotIndex: 0 }], MaxSlots: 32 });
        await new Promise(r => setTimeout(r, 80));
        // Inventory list should not show the storage item.
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#inv-list .tsic-list-row').length, 0));
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
    name: 'Inventory: dblclick on equipment row publishes UI.Cmd.Equipment.Equip',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_X: { Name: 'X', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [{ ItemId: 'ID_X', Count: 1, SlotIndex: 3 }], MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="3"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="3"]')
            .dispatchEvent(new ctx.win.MouseEvent('dblclick', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Equipment.Equip', { where: p => p.ItemId === '3' }));
    },
});

TSICTestHarness.register({
    name: 'Inventory: tab filter "Tools" hides non-Equipment items',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_Axe:   { Name: 'Axe',   Category: 'Equipment' },
            ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial' },
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [
            { ItemId: 'ID_Axe',   Count: 1, SlotIndex: 0 },
            { ItemId: 'ID_Wheat', Count: 5, SlotIndex: 1 },
        ], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]'));
        const tools = Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(t => t.textContent === 'Tools');
        tools.click();
        await new Promise(r => setTimeout(r, 30));
        // Axe stays at slot 0; Wheat is filtered out of slot 1.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-list .tsic-list-row[data-slot="0"]'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="1"]'), null));
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
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [{ ItemId: 'ID_W', Count: 8, SlotIndex: 0 }], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]'));
        ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await ctx.waitFor(() => Array.from(ctx.doc.querySelectorAll('.tsic-context-menu .tsic-context-item')).some(e => (e.textContent || '').trim() === 'Drop…'));
        Array.from(ctx.doc.querySelectorAll('.tsic-context-menu .tsic-context-item'))
            .find(e => (e.textContent || '').trim() === 'Drop…').click();
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domExists(ctx.doc, 'input[type="range"]'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: equipment payload renders slots in the equip row',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Equipment.Updated', {
            OwnerId: 'Player',
            Slots: [
                { SlotTag: 'Equip.Head',  ItemId: 'ID_Helmet', IconUrl: '' },
                { SlotTag: 'Equip.Body',  ItemId: '',          IconUrl: '' },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-equip-row .equip-slot').length >= 2);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#inv-equip-row .equip-slot', 2));
    },
});
