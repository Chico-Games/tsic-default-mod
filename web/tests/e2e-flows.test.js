// End-to-end-style flows. Each scenario chains multiple state changes on
// one page to exercise a realistic user path. Cross-page navigation isn't
// simulated here (each scenario reloads a single page); instead these
// scenarios drive multi-step interactions inside a single page.

// ---- Inventory → RMB half-pick → place: the §6 cursor model end to end ----
TSICTestHarness.register({
    name: 'E2E/Inventory: RMB picks the larger half, release places a count-limited Move',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.setItemCatalog({ ID_W: { Name: 'Wheat', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8,
            Items: [{ ItemId: 'ID_W', Count: 7, InstanceId: 3, GridSlot: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1.4 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"] img'));
        const slot = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]');
        slot.dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
        const held = ctx.win.TSICInventory.getHeld();
        ctx.expect(ctx.assert.truthy(held && held.count === 4, 'RMB holds the larger half (7 -> 4)'));
        ctx.clearPublishes();
        const target = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="3"]');
        const r = target.getBoundingClientRect();
        const o = { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0 };
        target.dispatchEvent(new ctx.win.PointerEvent('pointerdown', o));
        target.dispatchEvent(new ctx.win.PointerEvent('pointerup', o));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move',
            { where: p => p.ItemId === 3 && p.FromSlot === 0 && p.ToSlot === 3 && p.Count === 4 }));
    },
});

// ---- Inventory → equip flow (shift-click = quick action) -----------------
// Minecraft's shift-click resolution with no container open: ARMOUR goes to the paper doll,
// everything else band-swaps between the hotbar row and the bag.
TSICTestHarness.register({
    name: 'E2E/Inventory: armour shift-click → Equip; paper doll reflects update',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.setItemCatalog({ ID_Helmet: {
            Name: 'Helmet', Category: 'Equipment',
            EquipmentSlot: 'Entity.Inventory.Item.Equipment.Slot.Head',
        } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [{ ItemId: 'ID_Helmet', Count: 1, InstanceId: 4, GridSlot: 0 }], MaxSlots: 32, MaxWeight: 50, CurrentWeight: 5 });
        ctx.inject('tsic.msg.UI.Equipment.Updated', { OwnerId: 'Player', Slots: [{ SlotTag: 'Entity.Inventory.Item.Equipment.Slot.Head', ItemId: '', IconUrl: '' }] });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"] img'));
        const cell = ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]');
        cell.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        ctx.clearPublishes();
        // Plain click picks the stack up; SHIFT-click is the quick action.
        cell.dispatchEvent(new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Equipment.Equip', { where: p => p.ItemId === '4' }));
        // Armour never band-swaps — the doll is its destination.
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Inventory.Move'));
        // Pretend C++ accepted and re-broadcasts equipment with the helmet worn.
        ctx.inject('tsic.msg.UI.Equipment.Updated', { OwnerId: 'Player', Slots: [{ SlotTag: 'Entity.Inventory.Item.Equipment.Slot.Head', ItemId: 'ID_Helmet', IconUrl: '' }] });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(ctx.doc.querySelector('#inv-doll .equip-slot img'), 'expected equipped slot to render an icon'));
    },
});

TSICTestHarness.register({
    name: 'E2E/Inventory: shift-click band-swaps a weapon between the hotbar and the bag',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.setItemCatalog({ ID_Axe: {
            Name: 'Axe', Category: 'Equipment',
            EquipmentSlot: 'Entity.Inventory.Item.Equipment.Slot.Weapon',
        } });
        // Axe on the bar (cell 1), cells 0 and 2..7 free, cell 8 free in the bag.
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 1 }], MaxSlots: 32, MaxWeight: 50, CurrentWeight: 5 });
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: 1, SelectedSlotPending: -1 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="1"] img'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="1"]')
            .dispatchEvent(new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
        // On the bar -> first free bag cell (8). A weapon is not armour, so no Equip.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromSlot === 1 && p.ToSlot === 8 && p.ItemId === 4,
        }));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Equipment.Equip'));

        // Now the other way: from the bag it goes to the first free bar cell (0).
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 8 }], MaxSlots: 32, MaxWeight: 50, CurrentWeight: 5 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="8"] img'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="8"]')
            .dispatchEvent(new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Move', {
            where: p => p.FromSlot === 8 && p.ToSlot === 0 && p.ItemId === 4,
        }));
    },
});

// ---- Crafting → recipe info → craft -------------------------------------
TSICTestHarness.register({
    name: 'E2E/Crafting: open station → recipe row click → enter publishes Recipe.Start',
    file: '/screens/crafting.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial' }, ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Crafting',
            Recipes: [{ RecipeId: 'R_Bread', Name: 'Bread', bDiscovered: true, bStationLevelSufficient: true, bIsLevelLocked: false,
                        Ingredients: [{ ItemId: 'ID_Wheat', Count: 2 }], Outputs: [{ ItemId: 'ID_Bread', Count: 1 }] }],
            MaterialCounts: { ID_Wheat: 5 },
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#c-station .tsic-list-row').length >= 1, { timeout: 2000 });
        ctx.doc.querySelector('#c-station .tsic-list-row').click();
        await new Promise(r => setTimeout(r, 30));
        ctx.clearPublishes();
        // RecipeStation commits the selected recipe on a tsic:confirm event
        // (dispatched by the focus engine on confirm); raw Enter is not wired.
        ctx.doc.querySelector('#c-station .tsic-list-row.is-selected')
            .dispatchEvent(new ctx.win.CustomEvent('tsic:confirm', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Recipe.Start',
            { where: p => p.Kind === 'Crafting' && p.RecipeId === 'R_Bread' }));
    },
});

// ---- Universal Storage setup → create group → link ----------------------
TSICTestHarness.register({
    name: 'E2E/UniversalStorageSetup: create new -> name modal -> link',
    file: '/screens/universal-storage-setup.html?entityId=99',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.UniversalStorage.Groups', { GroupNames: [] });
        await ctx.waitFor(() => ctx.doc.getElementById('btn-new'));
        ctx.doc.getElementById('btn-new').click();
        await new Promise(r => setTimeout(r, 30));
        ctx.doc.querySelector('input#uss-name').value = 'Lab';
        ctx.clearPublishes();
        ctx.doc.querySelector('button#uss-create-confirm').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.UniversalStorage.CreateGroup',
            { where: p => p.GroupName === 'Lab' }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.UniversalStorage.LinkGroup',
            { where: p => p.GroupName === 'Lab' && p.EntityId === 99 }));
    },
});

TSICTestHarness.register({
    name: 'E2E/UniversalStorageSetup: duplicate name shows error and does not publish',
    file: '/screens/universal-storage-setup.html?entityId=99',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.UniversalStorage.Groups', { GroupNames: ['Vault'] });
        await ctx.waitFor(() => ctx.doc.getElementById('btn-new'));
        ctx.doc.getElementById('btn-new').click();
        await new Promise(r => setTimeout(r, 30));
        ctx.doc.querySelector('input#uss-name').value = 'Vault';
        ctx.clearPublishes();
        ctx.doc.querySelector('button#uss-create-confirm').click();
        ctx.expect(ctx.assert.truthy(/exists/i.test(ctx.doc.querySelector('#uss-err').textContent)));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.UniversalStorage.CreateGroup'));
    },
});

// ---- Storage transfer round trip ---------------------------------------
TSICTestHarness.register({
    name: 'E2E/Storage: shift-click quick-move -> QuickMove + Sound, then player grid refreshes',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:42', GridWidth: 8, Items: [{ ItemId: 'ID_Wood', Count: 3, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-grid="0"] img'));
        ctx.clearPublishes();
        // §7.4: shift-click quick-moves into the other pane (dblclick is COLLECT now).
        ctx.doc.querySelector('#ss-container-list .tsic-slot[data-grid="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.QuickMove',
            { where: p => p.FromOwnerId === 'Storage:42' && p.ToOwnerId === 'Player' && p.ItemId === 1 && p.FromSlot === 0 }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play'));
        // Server "ack" — broadcast new inventories
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:42', GridWidth: 8, Items: [], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [{ ItemId: 'ID_Wood', Count: 3, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ss-player-list .tsic-slot[data-grid="0"] img'));
    },
});

// ---- Cheat menu: every preset has a data-cmd-tpl that publishes ---------
TSICTestHarness.register({
    name: 'E2E/CheatMenu: every data-cmd-tpl button publishes a Cheat.Execute',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        ctx.screen('CheatMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-cmd-tpl]'));
        const buttons = Array.from(ctx.doc.querySelectorAll('button[data-cmd-tpl]'));
        ctx.expect(ctx.assert.truthy(buttons.length >= 6, `expected at least 6 preset buttons, got ${buttons.length}`));
        for (const b of buttons) {
            ctx.clearPublishes();
            b.click();
            const expected = b.getAttribute('data-cmd-tpl').replaceAll('{p}', '0').trim();
            ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
                { where: p => p.Command === expected }));
        }
    },
});

// ---- Map → place ping → ping markers flash ------------------------------

// ---- Map → R resets view ------------------------------------------------

// ---- Map → Esc closes -------------------------------------------------

// ---- ActionBar: live device-family swap ---------------------------------
TSICTestHarness.register({
    name: 'E2E/ActionBar: KBM-then-Gamepad swap re-renders icon family',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.mode('MouseAndKeyboard');
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', {
            Entries: [{ BehaviorTagName: 'IA_X', DisplayName: 'X', bVisible: true, StatusInt: 0,
                      KeyboardIconUrl: '/icons/keyboard/e.svg', GamepadIconUrl: '/icons/gamepad/face-bottom.svg' }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#bb-gameplay .bb-row .bb-key img'));
        ctx.expect(ctx.assert.truthy(/keyboard/.test(ctx.doc.querySelector('.bb-key img').src)));
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(/gamepad/.test(ctx.doc.querySelector('.bb-key img').src)));
    },
});

// ---- Inventory: hover feeds the info rail (the old hover context menu is gone) ----
TSICTestHarness.register({
    name: 'E2E/Inventory: hovering an item renders name + stats in the info rail',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment', Weight: 2.5 } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8,
            Items: [{ ItemId: 'ID_Axe', Count: 1, InstanceId: 4, GridSlot: 0 }],
            MaxSlots: 32, MaxWeight: 50, CurrentWeight: 5 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"] img'));
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        await ctx.waitFor(() => /Axe/.test(ctx.doc.getElementById('inv-info').textContent));
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-info', /Axe/));
        ctx.expect(ctx.assert.domText(ctx.doc, '#inv-info', /WEIGHT/));
    },
});

// ---- Construction → place flow ---------------------------------------
TSICTestHarness.register({
    name: 'E2E/Construction: select item → preview state → confirm publishes',
    file: '/screens/construction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.Available', {
            Items: [{ EntityDefId: 'FD_Table', Name: 'Table', Category: 'Furniture', bAffordable: true }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#items .c-row'));
        ctx.doc.querySelector('#items .c-row').click();
        await new Promise(r => setTimeout(r, 30));
        ctx.inject('tsic.msg.UI.Construction.PreviewState', { bCanPlace: true, RotationAxis: 'Z' });
        await new Promise(r => setTimeout(r, 30));
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-confirm').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Construction.Confirm'));
    },
});

// ---- Lore → arrow nav + close ---------------------------------------
TSICTestHarness.register({
    name: 'E2E/Lore: open paper → right twice → close → Pause.Resume',
    file: '/screens/paper.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.LoreScreen.Opened', {
            ScreenKind: 'Paper',
            Texts: [
                { Heading: 'A', Body: 'a', GroupTitle: '' },
                { Heading: 'B', Body: 'b', GroupTitle: '' },
                { Heading: 'C', Body: 'c', GroupTitle: '' },
            ],
            InitialIndex: 0,
        });
        await ctx.waitFor(() => ctx.doc.getElementById('lore-heading').textContent === 'A');
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domText(ctx.doc, '#lore-heading', 'C'));
        ctx.clearPublishes();
        ctx.doc.getElementById('lore-close').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.LoreScreen.Close'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
});
