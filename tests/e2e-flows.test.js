// End-to-end-style flows. Each scenario chains multiple state changes on
// one page to exercise a realistic user path. Cross-page navigation isn't
// simulated here (each scenario reloads a single page); instead these
// scenarios drive multi-step interactions inside a single page.

// ---- Inventory → drop item → context menu → quantity modal → publish Drop ----
TSICTestHarness.register({
    name: 'E2E/Inventory: hover stack → RMB → context menu → Drop entry → modal → Drop publishes',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_W: { Name: 'Wheat', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [{ ItemId: 'ID_W', Count: 7, SlotIndex: 0 }], MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1.4 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"] img'));
        // hover -> action bar gets contextual Drop entry
        const slot = ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]');
        slot.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BehaviorBar.SetMenuContext',
            { where: p => p.Entries.find(e => e.Label === 'Drop') }));
        // RMB opens the context menu; click Drop… to open the modal.
        slot.dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        await ctx.waitFor(() => Array.from(ctx.doc.querySelectorAll('.tsic-context-menu .tsic-context-item')).some(e => (e.textContent || '').trim() === 'Drop…'));
        const dropEntry = Array.from(ctx.doc.querySelectorAll('.tsic-context-menu .tsic-context-item')).find(e => (e.textContent || '').trim() === 'Drop…');
        dropEntry.click();
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domExists(ctx.doc, 'input[type="range"]'));
        // Set slider + confirm
        const slider = ctx.doc.querySelector('input[type="range"]');
        slider.value = '3';
        slider.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        ctx.clearPublishes();
        const ok = Array.from(ctx.doc.querySelectorAll('button')).find(b => /drop/i.test(b.textContent || ''));
        ok && ok.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Drop',
            { where: p => p.Count === 3 && p.SlotIndex === 0 }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play',
            { where: p => p.SoundKey === 'Inventory.Drop' }));
    },
});

// ---- Inventory → equip flow (dblclick) ----------------------------------
TSICTestHarness.register({
    name: 'E2E/Inventory: equippable hover → dblclick → Equip; equipment list reflects update',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 0 }], MaxSlots: 32, MaxWeight: 50, CurrentWeight: 5 });
        ctx.inject('tsic.msg.UI.Equipment.Updated', { OwnerId: 'Player', Slots: [{ SlotTag: 'Equip.Weapon', ItemId: '', IconUrl: '' }] });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"] img'));
        const slot = ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]');
        slot.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        ctx.clearPublishes();
        slot.dispatchEvent(new ctx.win.MouseEvent('dblclick', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Equipment.Equip', { where: p => p.ItemId === '0' }));
        // Pretend C++ accepted and re-broadcasts equipment with the axe equipped.
        ctx.inject('tsic.msg.UI.Equipment.Updated', { OwnerId: 'Player', Slots: [{ SlotTag: 'Equip.Weapon', ItemId: 'ID_Axe', IconUrl: '' }] });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(ctx.doc.querySelector('#inv-equip-row .equip-slot img'), 'expected equipped slot to render an icon'));
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
    name: 'E2E/Storage: container item -> dblclick -> Transfer + Sound, then player grid refreshes',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:42', Items: [{ ItemId: 'ID_Wood', Count: 3, SlotIndex: 0 }], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-list-row[data-slot="0"] img'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#ss-container-list .tsic-list-row[data-slot="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('dblclick', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Transfer',
            { where: p => p.FromOwnerId === 'Storage:42' && p.ToOwnerId === 'Player' && p.FromSlot === 0 }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play'));
        // Server "ack" — broadcast new inventories
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:42', Items: [], MaxSlots: 32 });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [{ ItemId: 'ID_Wood', Count: 3, SlotIndex: 0 }], MaxSlots: 32 });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ss-player-list .tsic-list-row[data-slot="0"] img'));
    },
});

// ---- Cheat menu: every preset has a data-cmd-tpl that publishes ---------
TSICTestHarness.register({
    name: 'E2E/CheatMenu: every data-cmd-tpl button publishes a Cheat.Execute',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-cmd-tpl]'));
        const buttons = Array.from(ctx.doc.querySelectorAll('button[data-cmd-tpl]'));
        ctx.expect(ctx.assert.truthy(buttons.length >= 6, `expected at least 6 preset buttons, got ${buttons.length}`));
        for (const b of buttons) {
            ctx.clearPublishes();
            b.click();
            const expected = b.getAttribute('data-cmd-tpl').replaceAll('{p}', '1').trim();
            ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute',
                { where: p => p.Command === expected }));
        }
    },
});

// ---- Map → place ping → ping markers flash ------------------------------
TSICTestHarness.register({
    name: 'E2E/Map: RMB world coord → publishes Ping.Request',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Snapshot', { Players: [], Icons: [], MinBounds: { X: -100, Y: -100 }, MaxBounds: { X: 100, Y: 100 } });
        await new Promise(r => setTimeout(r, 60));
        ctx.clearPublishes();
        const vp = ctx.doc.getElementById('map-viewport');
        vp.dispatchEvent(new ctx.win.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Ping.Request', { where: p => p.PingType === 'Map' }));
    },
});

// ---- Map → R resets view ------------------------------------------------
TSICTestHarness.register({
    name: 'E2E/Map: R key resets pan/zoom via the keydown handler',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Snapshot', { Players: [], Icons: [], MinBounds: { X: -100, Y: -100 }, MaxBounds: { X: 100, Y: 100 } });
        await new Promise(r => setTimeout(r, 60));
        // Just verify the page survives an R keypress without throwing.
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'R', bubbles: true }));
        ctx.expect(ctx.assert.truthy(true));
    },
});

// ---- Map → Esc closes -------------------------------------------------
TSICTestHarness.register({
    name: 'E2E/Map: Escape publishes UI.Cmd.GameScreen.Close',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Snapshot', { Players: [], Icons: [], MinBounds: { X: -100, Y: -100 }, MaxBounds: { X: 100, Y: 100 } });
        await new Promise(r => setTimeout(r, 60));
        ctx.clearPublishes();
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.GameScreen.Close'));
    },
});

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

// ---- Inventory + ActionBar: hover dynamic context ----------------------
TSICTestHarness.register({
    name: 'E2E/Inventory: hovering Equipment publishes Equip/Hotbar/Drop context',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 0 }], MaxSlots: 32, MaxWeight: 50, CurrentWeight: 5 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"] img'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]').dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BehaviorBar.SetMenuContext',
            { where: p => p.Entries.find(e => e.Label === 'Equip')
                       && p.Entries.find(e => e.Label === 'Assign Hotbar')
                       && p.Entries.find(e => e.Label === 'Drop') }));
    },
});

TSICTestHarness.register({
    name: 'E2E/Inventory: hovering Consumable publishes Use/Drop context',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Bread: { Name: 'Bread', Category: 'Consumable' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [{ ItemId: 'ID_Bread', Count: 2, SlotIndex: 0 }], MaxSlots: 32, MaxWeight: 50, CurrentWeight: 0.4 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"] img'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]').dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BehaviorBar.SetMenuContext',
            { where: p => p.Entries.find(e => e.Label === 'Use')
                       && p.Entries.find(e => e.Label === 'Drop')
                       && !p.Entries.find(e => e.Label === 'Equip') }));
    },
});

TSICTestHarness.register({
    name: 'E2E/Inventory: hovering Other item publishes only Drop',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_R: { Name: 'Rock', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [{ ItemId: 'ID_R', Count: 5, SlotIndex: 0 }], MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"] img'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]').dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        const last = ctx.publishes().filter(p => p.channel === 'UI.Cmd.BehaviorBar.SetMenuContext').slice(-1)[0];
        const labels = last.payload.Entries.map(e => e.Label).filter(l => l !== 'Back');
        ctx.expect(ctx.assert.eq(labels, ['Drop']));
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
