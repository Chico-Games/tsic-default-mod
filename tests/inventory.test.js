// Inventory scenarios.

// Helper: find a .tsic-context-item by visible label text. Returns null if missing.
function findContextMenuEntry(doc, label) {
    const items = Array.from(doc.querySelectorAll('.tsic-context-menu .tsic-context-item'));
    return items.find(el => (el.textContent || '').trim() === label) || null;
}

// jsdom doesn't expose a DragEvent / DataTransfer constructor — emulate via a plain stub.
function makeDataTransferStub(initialMap) {
    const data = Object.assign({}, initialMap || {});
    return {
        _data: data,
        setData(k, v) { data[k] = v; },
        getData(k) { return data[k] || ''; },
    };
}
function dispatchDragOn(win, target, type, dataTransfer) {
    const ev = new win.Event(type, { bubbles: true, cancelable: true });
    ev.dataTransfer = dataTransfer;
    target.dispatchEvent(ev);
}

TSICTestHarness.register({
    name: 'Inventory: renders items in list',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable', Weight: 0.2 } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player',
            Items: [{ ItemId: 'ID_Bread', Count: 3, SlotIndex: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 0.6,
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-list .tsic-list-row').length === 1);
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
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('inv-capacity').dataset.state, 'overburdened'));
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
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]'));
        const slot = ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]');
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

// ---- Single-click on Equipment publishes Equip (row IS the action) -----
TSICTestHarness.register({
    name: 'Inventory/Click: equipment click publishes UI.Cmd.Equipment.Equip',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 3 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="3"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="3"]').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Equipment.Equip',
            { where: p => p.ItemId === '3' }));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-list .tsic-list-row[data-slot="3"].is-selected'));
    },
});

// ---- Single-click on Consumable publishes Use ----
TSICTestHarness.register({
    name: 'Inventory/Click: consumable click publishes UI.Cmd.Inventory.Use',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Bread', Count: 1, SlotIndex: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 0.2,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Use',
            { where: p => p.SlotIndex === 0 }));
    },
});

// ---- Single-click on Material is a no-op for actions (just selects) ----
TSICTestHarness.register({
    name: 'Inventory/Click: material click selects only — no Use or Equip',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_W: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_W', Count: 5, SlotIndex: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 0.5,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]').click();
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.Use'));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Equipment.Equip'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-list .tsic-list-row[data-slot="0"].is-selected'));
    },
});

// ---- Drop end-to-end via context menu: stack=1 publishes Drop ----
TSICTestHarness.register({
    name: 'Inventory/Drop: context-menu Drop on stack=1 publishes UI.Cmd.Inventory.Drop',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable', Weight: 0.2 } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Bread', Count: 1, SlotIndex: 0 }],
            MaxSlots: 32, MaxWeight: 30, CurrentWeight: 0.2,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await ctx.waitFor(() => findContextMenuEntry(ctx.doc, 'Drop…'));
        findContextMenuEntry(ctx.doc, 'Drop…').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Drop',
            { where: p => p.SlotIndex === 0 && p.Count === 1 }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play',
            { where: p => p.SoundKey === 'Inventory.Drop' }));
    },
});

// ---- Drop quantity flow via context menu: stack>1 opens modal ----
TSICTestHarness.register({
    name: 'Inventory/Drop: context-menu Drop on stack>1 opens modal, publishes selected Count',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_W: { Name: 'Wheat', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_W', Count: 8, SlotIndex: 0 }],
            MaxSlots: 32, MaxWeight: 30, CurrentWeight: 0.4,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]'));
        ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await ctx.waitFor(() => findContextMenuEntry(ctx.doc, 'Drop…'));
        findContextMenuEntry(ctx.doc, 'Drop…').click();
        await ctx.waitFor(() => ctx.doc.querySelector('input[type="range"]'));
        const slider = ctx.doc.querySelector('input[type="range"]');
        slider.value = '5';
        slider.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        ctx.clearPublishes();
        const confirm = Array.from(ctx.doc.querySelectorAll('button')).find(b => /^drop$/i.test((b.textContent || '').trim()));
        ctx.expect(ctx.assert.truthy(confirm, 'expected a Drop confirm button'));
        confirm && confirm.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Drop',
            { where: p => p.Count === 5 && p.SlotIndex === 0 }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play',
            { where: p => p.SoundKey === 'Inventory.Drop' }));
    },
});

// ---- New: right-click on a row opens the context menu ----
TSICTestHarness.register({
    name: 'Inventory/Context: right-click opens context menu with category-appropriate entries',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]'));
        ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await ctx.waitFor(() => ctx.doc.querySelector('.tsic-context-menu'));
        ctx.expect(ctx.assert.truthy(findContextMenuEntry(ctx.doc, 'Equip'), 'Equip entry'));
        ctx.expect(ctx.assert.truthy(findContextMenuEntry(ctx.doc, 'Assign to Hotbar…'), 'Assign to Hotbar entry'));
        ctx.expect(ctx.assert.truthy(findContextMenuEntry(ctx.doc, 'Drop…'), 'Drop entry'));
        // Storage isn't open in plain inventory, so no Transfer entry.
        ctx.expect(ctx.assert.eq(findContextMenuEntry(ctx.doc, 'Transfer…'), null));
    },
});

// ---- Context menu: Equip vs. Unequip depends on whether the item is worn ----
// These hit the shared buildItemContextMenu directly (the live runtime code that
// the in-game overlay uses), hosted by test-fixtures.html — the inventory screen
// page is a dead duplicate, so its render path isn't the one shipped.
TSICTestHarness.register({
    name: 'Inventory/Context: unworn equipment offers Equip (publishes Equip by InstanceId)',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        const entries = ctx.win.TSICInventory.buildItemContextMenu({
            it: { ItemId: 'ID_Axe', InstanceId: 7, SlotIndex: 0, Count: 1 },
            desc: { Name: 'Axe', Category: 'Equipment' },
        });
        const equip = entries.find(e => e.label === 'Equip');
        ctx.expect(ctx.assert.truthy(equip, 'expected an Equip entry'));
        ctx.expect(ctx.assert.eq(!!entries.find(e => e.label === 'Unequip'), false, 'no Unequip entry when unworn'));
        equip.onClick();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Equipment.Equip', { where: p => p.ItemId === '7' }));
    },
});

TSICTestHarness.register({
    name: 'Inventory/Context: worn equipment offers Unequip (publishes Unequip by SlotTag)',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.clearPublishes();
        const slotTag = 'Entity.Inventory.Item.Equipment.Slot.Weapon';
        const entries = ctx.win.TSICInventory.buildItemContextMenu({
            it: { ItemId: 'ID_Axe', InstanceId: 7, SlotIndex: 0, Count: 1 },
            desc: { Name: 'Axe', Category: 'Equipment' },
            equippedSlotTag: slotTag,
        });
        const unequip = entries.find(e => e.label === 'Unequip');
        ctx.expect(ctx.assert.truthy(unequip, 'expected an Unequip entry'));
        ctx.expect(ctx.assert.eq(!!entries.find(e => e.label === 'Equip'), false, 'no Equip entry when worn'));
        unequip.onClick();
        // C++ RequestUnequip resolves by SlotTag, so ItemId is intentionally empty.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Equipment.Unequip',
            { where: p => p.SlotTag === slotTag && p.ItemId === '' }));
    },
});

// ---- New: drag inventory row → equipment slot publishes Equip ----
TSICTestHarness.register({
    name: 'Inventory/Drag: drop on equipment slot publishes UI.Cmd.Equipment.Equip',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 7 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1,
        });
        ctx.inject('tsic.msg.UI.Equipment.Updated', {
            OwnerId: 'Player',
            Slots: [{ SlotTag: 'Equipment.Slot.Torso', ItemId: '' }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-equip-row .equip-slot'));
        const dt = makeDataTransferStub({ 'application/tsic-item': JSON.stringify({ slot: 7, itemId: 'ID_Axe' }) });
        const equipSlot = ctx.doc.querySelector('#inv-equip-row .equip-slot');
        dispatchDragOn(ctx.win, equipSlot, 'dragover', dt);
        dispatchDragOn(ctx.win, equipSlot, 'drop',     dt);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Equipment.Equip',
            { where: p => p.ItemId === '7' }));
    },
});

// ---- Pickup: a fresh item arriving via Inventory.Updated renders the row ---
TSICTestHarness.register({
    name: 'Inventory/Pickup: new item appears as a list row and capacity updates',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment', Weight: 1.2 } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32, MaxWeight: 30, CurrentWeight: 0 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-empty'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-capacity-text', /CAPACITY: 0 items/));
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player',
            Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 5 }],
            MaxSlots: 32, MaxWeight: 30, CurrentWeight: 1.2,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="5"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-list .tsic-list-row[data-slot="5"] img'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-capacity-text', /CAPACITY: 1 items · 1\.20/));
    },
});

// ---- Scroll: many stacks render and grid stays scrollable ---------------
TSICTestHarness.register({
    name: 'Inventory/Scroll: 80 stacks render, hotbar quick-assign still works for last row',
    file: '/screens/inventory.html',
    async run(ctx) {
        const items = [];
        const catalog = {};
        for (let i = 0; i < 80; i++) {
            items.push({ ItemId: `ID_${i}`, Count: 1, SlotIndex: i });
            catalog[`ID_${i}`] = { Name: `Item ${i}`, Category: 'Equipment' };
        }
        ctx.setItemCatalog(catalog);
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: items, MaxSlots: 128, MaxWeight: 200, CurrentWeight: 10 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-list .tsic-list-row').length === 80);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#inv-list .tsic-list-row', 80));
        const lastRow = ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="79"]');
        lastRow.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.clearPublishes();
        ctx.events.key(ctx.doc, '5');
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Assign',
            { where: p => p.SlotIndex === 4 && p.ItemId === '79' }));
    },
});

// ---- Storage round trip: paired Updated for source + dest renders both --
TSICTestHarness.register({
    name: 'Storage/Pickup: paired Updated for container + player renders both sides',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:42', Items: [{ ItemId: 'ID_Wood', Count: 5, SlotIndex: 0 }], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-list-row[data-slot="0"]'));
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:42', Items: [], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [{ ItemId: 'ID_Wood', Count: 5, SlotIndex: 0 }], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-player-list .tsic-list-row[data-slot="0"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ss-container-list .tsic-empty'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ss-player-list .tsic-list-row[data-slot="0"]'));
    },
});

// ---- Storage double-click transfers the whole stack ---------------------
TSICTestHarness.register({
    name: 'Storage/DblClick: double-click on a stack transfers whole stack to the other side',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_W: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:7', Items: [{ ItemId: 'ID_W', Count: 12, SlotIndex: 0 }], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-list-row[data-slot="0"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#ss-container-list .tsic-list-row[data-slot="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('dblclick', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Transfer',
            { where: p => p.FromOwnerId === 'Storage:7' && p.ToOwnerId === 'Player' && p.Count === 12 && p.FromSlot === 0 }));
    },
});

// ---- Storage right-click menu includes Transfer… -----------------------
TSICTestHarness.register({
    name: 'Storage/Context: right-click on a row offers Transfer… entry',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_W: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:7', Items: [{ ItemId: 'ID_W', Count: 4, SlotIndex: 0 }], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-list-row[data-slot="0"]'));
        ctx.doc.querySelector('#ss-container-list .tsic-list-row[data-slot="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await ctx.waitFor(() => ctx.doc.querySelector('.tsic-context-menu'));
        ctx.expect(ctx.assert.truthy(findContextMenuEntry(ctx.doc, 'Transfer…'), 'Transfer entry'));
        ctx.expect(ctx.assert.truthy(findContextMenuEntry(ctx.doc, 'Drop…'), 'Drop entry'));
    },
});
