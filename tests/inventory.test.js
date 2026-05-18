// Inventory scenarios.
TSICTestHarness.register({
    name: 'Inventory: renders items in grid',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable', Weight: 0.2 } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player',
            Items: [{ ItemId: 'ID_Bread', Count: 3, SlotIndex: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 0.6,
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.tsic-slot').length >= 32);
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-capacity-text', /CAPACITY: 1 items · 0\.60/));
    },
});

TSICTestHarness.register({
    name: 'Inventory: capacity bar turns orange at 75%',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [], MaxSlots: 32, MaxWeight: 10, CurrentWeight: 8,
        });
        await ctx.waitFor(() => ctx.doc.getElementById('inv-capacity').dataset.state === 'warning');
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('inv-capacity').dataset.state, 'warning'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: overburdened state when over 105%',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [], MaxSlots: 32, MaxWeight: 10, CurrentWeight: 12,
        });
        await ctx.waitFor(() => ctx.doc.getElementById('inv-capacity').dataset.state === 'overburdened');
        ctx.expect(ctx.assert.domVisible(ctx.doc, '#inv-capacity-overburdened'));
    },
});

TSICTestHarness.register({
    name: 'Inventory: hotbar quick-assign 1..9 + 0 maps to slots 0..9',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 5,
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.tsic-slot').length >= 1);
        const slot = ctx.doc.querySelector('.tsic-slot[data-slot="0"]');
        slot.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.clearPublishes();
        ctx.events.key(ctx.doc, '1');
        ctx.events.key(ctx.doc, '0');
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Assign', {
            where: p => p.SlotIndex === 0,
        }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Assign', {
            where: p => p.SlotIndex === 9,
        }));
    },
});

TSICTestHarness.register({
    name: 'Inventory: drop publishes UI.Cmd.Inventory.Drop',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Bread', Count: 1, SlotIndex: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 0.2,
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.tsic-slot').length >= 1);
        const slot = ctx.doc.querySelector('.tsic-slot[data-slot="0"]');
        slot.dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Drop'));
    },
});
