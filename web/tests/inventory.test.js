// Inventory scenarios (grid-based — items land in persistent GridSlot cells).

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
    name: 'Inventory: renders items in grid cells',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable', Weight: 0.2 } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player',
            Items: [{ ItemId: 'ID_Bread', Count: 3, SlotIndex: 0, InstanceId: 1, GridSlot: 0 }],
            MaxSlots: 48, GridWidth: 8, GridHeight: 6, MaxWeight: 50, CurrentWeight: 0.6,
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-grid .tsic-slot').length === 48);
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-grid="0"][data-slot="0"] img'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-capacity-text', /CAPACITY: 1 items · 0\.60/));
    },
});

TSICTestHarness.register({
    name: 'Inventory: GridSlot places items, legacy items flow into free cells',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_A: { Name: 'A', Category: 'CraftingMaterial' },
            ID_B: { Name: 'B', Category: 'CraftingMaterial' },
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player',
            Items: [
                { ItemId: 'ID_A', Count: 1, SlotIndex: 0, InstanceId: 1, GridSlot: 10 },
                { ItemId: 'ID_B', Count: 1, SlotIndex: 1, InstanceId: 2, GridSlot: -1 },
            ],
            MaxSlots: 48, GridWidth: 8, GridHeight: 6, MaxWeight: 50, CurrentWeight: 0.2,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="10"][data-instance="1"]'));
        // The unassigned item flows into the first free cell (cell 0).
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-grid="0"][data-instance="2"]'));
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
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 0, InstanceId: 5, GridSlot: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 5,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]'));
        const slot = ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]');
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

// ---- Single-click on Equipment publishes Equip (cell IS the action) -----
TSICTestHarness.register({
    name: 'Inventory/Click: equipment click publishes UI.Cmd.Equipment.Equip',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 3, InstanceId: 3, GridSlot: 3 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="3"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="3"]').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Equipment.Equip',
            { where: p => p.ItemId === '3' }));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-slot="3"].is-selected'));
    },
});

// ---- Single-click on Consumable publishes Use ----
TSICTestHarness.register({
    name: 'Inventory/Click: consumable click publishes UI.Cmd.Inventory.Use',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Bread', Count: 1, SlotIndex: 0, InstanceId: 1, GridSlot: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 0.2,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]').click();
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
            OwnerId: 'Player', Items: [{ ItemId: 'ID_W', Count: 5, SlotIndex: 0, InstanceId: 1, GridSlot: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 0.5,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]').click();
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.Use'));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Equipment.Equip'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-slot="0"].is-selected'));
    },
});

// ---- Drag cell → cell publishes UI.Cmd.Inventory.Move -------------------
TSICTestHarness.register({
    name: 'Inventory/Drag: dropping cell A onto cell B publishes UI.Cmd.Inventory.Move',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_W: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player',
            Items: [{ ItemId: 'ID_W', Count: 5, SlotIndex: 0, InstanceId: 1, GridSlot: 2 }],
            MaxSlots: 48, GridWidth: 8, GridHeight: 6, MaxWeight: 50, CurrentWeight: 0.5,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="2"][data-instance="1"]'));
        ctx.clearPublishes();
        const dt = makeDataTransferStub({
            'application/tsic-item': JSON.stringify({ slot: 0, gridSlot: 2, instanceId: 1, itemId: 'ID_W', ownerId: 'Player' }),
        });
        const target = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="9"]');
        dispatchDragOn(ctx.win, target, 'dragover', dt);
        dispatchDragOn(ctx.win, target, 'drop',     dt);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromOwnerId === 'Player' && p.ToOwnerId === 'Player'
                && p.FromSlot === 2 && p.ToSlot === 9,
        }));
    },
});

// ---- Tab filter dims non-matching items in place ------------------------
TSICTestHarness.register({
    name: 'Inventory/Tabs: filter dims non-matching cells without moving them',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_Axe:   { Name: 'Axe',   Category: 'Equipment' },
            ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial' },
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player',
            Items: [
                { ItemId: 'ID_Axe',   Count: 1, SlotIndex: 0, InstanceId: 1, GridSlot: 0 },
                { ItemId: 'ID_Wheat', Count: 5, SlotIndex: 1, InstanceId: 2, GridSlot: 1 },
            ],
            MaxSlots: 48, GridWidth: 8, GridHeight: 6, MaxWeight: 50, CurrentWeight: 1,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-instance="2"]'));
        const equipTab = Array.from(ctx.doc.querySelectorAll('.tsic-tab'))
            .find(t => (t.textContent || '').trim() === 'Equipment');
        ctx.expect(ctx.assert.truthy(equipTab, 'Equipment tab exists'));
        equipTab.click();
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-instance="2"].is-filtered'));
        // Both items still occupy their cells — the non-matching one is dimmed.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-grid="0"][data-instance="1"]:not(.is-filtered)'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-grid="1"][data-instance="2"].is-filtered'));
    },
});

// ---- Drop end-to-end via context menu: stack=1 publishes Drop ----
TSICTestHarness.register({
    name: 'Inventory/Drop: context-menu Drop on stack=1 publishes UI.Cmd.Inventory.Drop',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable', Weight: 0.2 } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Bread', Count: 1, SlotIndex: 0, InstanceId: 1, GridSlot: 0 }],
            MaxSlots: 32, MaxWeight: 30, CurrentWeight: 0.2,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]')
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
            OwnerId: 'Player', Items: [{ ItemId: 'ID_W', Count: 8, SlotIndex: 0, InstanceId: 1, GridSlot: 0 }],
            MaxSlots: 32, MaxWeight: 30, CurrentWeight: 0.4,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]'));
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]')
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

// ---- Right-click on a cell opens the context menu ----
TSICTestHarness.register({
    name: 'Inventory/Context: right-click opens context menu with category-appropriate entries',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 0, InstanceId: 1, GridSlot: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]'));
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await ctx.waitFor(() => ctx.doc.querySelector('.tsic-context-menu'));
        ctx.expect(ctx.assert.truthy(findContextMenuEntry(ctx.doc, 'Equip'), 'Equip entry'));
        ctx.expect(ctx.assert.truthy(findContextMenuEntry(ctx.doc, 'Move…'), 'Move entry'));
        ctx.expect(ctx.assert.truthy(findContextMenuEntry(ctx.doc, 'Assign to Hotbar…'), 'Assign to Hotbar entry'));
        ctx.expect(ctx.assert.truthy(findContextMenuEntry(ctx.doc, 'Drop…'), 'Drop entry'));
        // Storage isn't open in plain inventory, so no Transfer entry.
        ctx.expect(ctx.assert.eq(findContextMenuEntry(ctx.doc, 'Transfer…'), null));
    },
});

// ---- Context menu: Equip vs. Unequip depends on whether the item is worn ----
// These hit the shared buildItemContextMenu directly (the live runtime code that
// the in-game overlay uses), hosted by test-fixtures.html.
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

// ---- Context menu: Move… arms the gamepad move for grid items ----
TSICTestHarness.register({
    name: 'Inventory/Context: Move… arms a payload that the next cell activation consumes',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        ctx.win.TSICInventory.disarmMove();
        const entries = ctx.win.TSICInventory.buildItemContextMenu({
            it: { ItemId: 'ID_W', InstanceId: 4, SlotIndex: 0, Count: 5, GridSlot: 2 },
            desc: { Name: 'Wood', Category: 'CraftingMaterial' },
        });
        const move = entries.find(e => e.label === 'Move…');
        ctx.expect(ctx.assert.truthy(move, 'expected a Move entry'));
        move.onClick();
        const armed = ctx.win.TSICInventory._armedMove;
        ctx.expect(ctx.assert.truthy(armed, 'armed payload set'));
        ctx.expect(ctx.assert.eq(armed.gridSlot, 2));
        ctx.win.TSICInventory.disarmMove();
    },
});

// ---- Drag inventory cell → equipment slot publishes Equip ----
TSICTestHarness.register({
    name: 'Inventory/Drag: drop on equipment slot publishes UI.Cmd.Equipment.Equip',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 7, InstanceId: 7, GridSlot: 7 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1,
        });
        ctx.inject('tsic.msg.UI.Equipment.Updated', {
            OwnerId: 'Player',
            Slots: [{ SlotTag: 'Equipment.Slot.Torso', ItemId: '' }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-doll .equip-slot'));
        const dt = makeDataTransferStub({
            'application/tsic-item': JSON.stringify({ slot: 7, gridSlot: 7, instanceId: 7, itemId: 'ID_Axe', ownerId: 'Player' }),
        });
        const equipSlot = ctx.doc.querySelector('#inv-doll .equip-slot');
        dispatchDragOn(ctx.win, equipSlot, 'dragover', dt);
        dispatchDragOn(ctx.win, equipSlot, 'drop',     dt);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Equipment.Equip',
            { where: p => p.ItemId === '7' }));
    },
});

// ---- Pickup: a fresh item arriving via Inventory.Updated renders its cell ---
TSICTestHarness.register({
    name: 'Inventory/Pickup: new item appears in its cell and capacity updates',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment', Weight: 1.2 } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32, MaxWeight: 30, CurrentWeight: 0 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-grid .tsic-slot').length > 0);
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot]'), null));
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-capacity-text', /CAPACITY: 0 items/));
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player',
            Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 0, InstanceId: 9, GridSlot: 5 }],
            MaxSlots: 32, MaxWeight: 30, CurrentWeight: 1.2,
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="5"][data-instance="9"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-grid .tsic-slot[data-grid="5"] img'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-capacity-text', /CAPACITY: 1 items · 1\.20/));
    },
});

// ---- Density: 80 stacks render into a large grid -------------------------
TSICTestHarness.register({
    name: 'Inventory/Scroll: 80 stacks render, hotbar quick-assign still works for last cell',
    file: '/screens/inventory.html',
    async run(ctx) {
        const items = [];
        const catalog = {};
        for (let i = 0; i < 80; i++) {
            items.push({ ItemId: `ID_${i}`, Count: 1, SlotIndex: i, InstanceId: i, GridSlot: i });
            catalog[`ID_${i}`] = { Name: `Item ${i}`, Category: 'Equipment' };
        }
        ctx.setItemCatalog(catalog);
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', Items: items,
            MaxSlots: 128, GridWidth: 8, GridHeight: 16, MaxWeight: 200, CurrentWeight: 10,
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#inv-grid .tsic-slot[data-slot]').length === 80);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#inv-grid .tsic-slot[data-slot]', 80));
        const lastCell = ctx.doc.querySelector('#inv-grid .tsic-slot[data-slot="79"]');
        lastCell.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
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
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:42', Items: [{ ItemId: 'ID_Wood', Count: 5, SlotIndex: 0, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-slot="0"]'));
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:42', Items: [], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [{ ItemId: 'ID_Wood', Count: 5, SlotIndex: 0, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-player-list .tsic-slot[data-slot="0"]'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('#ss-container-list .tsic-slot[data-slot]'), null));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ss-player-list .tsic-slot[data-slot="0"]'));
    },
});

// ---- Storage double-click transfers the whole stack ---------------------
TSICTestHarness.register({
    name: 'Storage/DblClick: double-click on a stack transfers whole stack to the other side',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_W: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:7', Items: [{ ItemId: 'ID_W', Count: 12, SlotIndex: 0, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-slot="0"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#ss-container-list .tsic-slot[data-slot="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('dblclick', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Transfer',
            { where: p => p.FromOwnerId === 'Storage:7' && p.ToOwnerId === 'Player' && p.Count === 12 && p.FromSlot === 0 }));
    },
});

// ---- Storage cross-pane drag publishes Move with both owners -------------
TSICTestHarness.register({
    name: 'Storage/Drag: container cell dropped on player cell publishes cross-owner Move',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_W: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:7', Items: [{ ItemId: 'ID_W', Count: 12, SlotIndex: 0, InstanceId: 1, GridSlot: 3 }], MaxSlots: 32, GridWidth: 8, GridHeight: 4 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 48, GridWidth: 8, GridHeight: 6 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-grid="3"][data-instance="1"]'));
        ctx.clearPublishes();
        const dt = makeDataTransferStub({
            'application/tsic-item': JSON.stringify({ slot: 0, gridSlot: 3, instanceId: 1, itemId: 'ID_W', ownerId: 'Storage:7' }),
        });
        const target = ctx.doc.querySelector('#ss-player-list .tsic-slot[data-grid="5"]');
        dispatchDragOn(ctx.win, target, 'dragover', dt);
        dispatchDragOn(ctx.win, target, 'drop',     dt);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromOwnerId === 'Storage:7' && p.ToOwnerId === 'Player'
                && p.FromSlot === 3 && p.ToSlot === 5,
        }));
    },
});

// ---- Storage right-click menu includes Transfer… -----------------------
TSICTestHarness.register({
    name: 'Storage/Context: right-click on a cell offers Transfer… entry',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_W: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:7', Items: [{ ItemId: 'ID_W', Count: 4, SlotIndex: 0, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-slot="0"]'));
        ctx.doc.querySelector('#ss-container-list .tsic-slot[data-slot="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await ctx.waitFor(() => ctx.doc.querySelector('.tsic-context-menu'));
        ctx.expect(ctx.assert.truthy(findContextMenuEntry(ctx.doc, 'Transfer…'), 'Transfer entry'));
        ctx.expect(ctx.assert.truthy(findContextMenuEntry(ctx.doc, 'Drop…'), 'Drop entry'));
    },
});
