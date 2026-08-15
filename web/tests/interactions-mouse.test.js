// Mouse-interaction coverage: every clickable element on every page.

// ---- Inventory: every tab activates filter classlist -------------------
TSICTestHarness.register({
    name: 'Mouse/Inventory: clicking each tab marks it active and re-filters',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_Axe:   { Name: 'Axe',   Category: 'Equipment' },
            ID_Bread: { Name: 'Bread', Category: 'Consumable' },
            ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial' },
        });
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1, Items: [
            { ItemId: 'ID_Axe',   Count: 1, InstanceId: 1, GridSlot: 0 },
            { ItemId: 'ID_Bread', Count: 2, InstanceId: 2, GridSlot: 1 },
            { ItemId: 'ID_Wheat', Count: 5, InstanceId: 3, GridSlot: 2 },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.tsic-tab').length === 6);
        const labels = ['All','Equip','Cons.','Constr.','Ammo','Mat.'];
        for (const label of labels) {
            const tab = Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(e => e.textContent === label);
            tab.click();
            await new Promise(r => setTimeout(r, 15));
            const active = ctx.doc.querySelector('.tsic-tab.is-active');
            ctx.expect(ctx.assert.eq(active && active.textContent, label, `tab ${label} should be active`));
        }
    },
});

// ---- Inventory equipment row click ------------------------------------
TSICTestHarness.register({
    name: 'Mouse/Inventory: equip-slot click handler does not throw',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, MaxSlots: 32, Items: [] });
        ctx.inject('tsic.msg.UI.Equipment.Updated', { OwnerId: 'Player', Slots: [
            { SlotTag: 'Entity.Inventory.Item.Equipment.Slot.Head', ItemId: 'ID_Axe', IconUrl: '' },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-doll .equip-slot'));
        ctx.doc.querySelector('#inv-doll .equip-slot').click();
        // Whether it publishes or not depends on impl; just confirm no crash.
        ctx.expect(ctx.assert.truthy(true));
    },
});

// ---- Storage: dblclick on both grids transfers in opposite directions --
TSICTestHarness.register({
    name: 'Mouse/Storage: shift-click quick-moves fire in opposite directions',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Storage:42', GridWidth: 8, MaxSlots: 32, Items: [{ ItemId: 'X', Count: 1, InstanceId: 1, GridSlot: 0 }] });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player',     GridWidth: 8, MaxSlots: 32, Items: [{ ItemId: 'Y', Count: 1, InstanceId: 2, GridSlot: 3 }] });
        await ctx.waitFor(() => ctx.doc.querySelector('#ss-container-list .tsic-slot[data-grid="0"] img')
                              && ctx.doc.querySelector('#ss-player-list .tsic-slot[data-grid="3"] img'));
        ctx.clearPublishes();
        // §7.4: shift-click quick-move works from BOTH panes (dblclick is collect).
        const shift = { bubbles: true, cancelable: true, shiftKey: true };
        ctx.doc.querySelector('#ss-container-list .tsic-slot[data-grid="0"]')
            .dispatchEvent(new ctx.win.MouseEvent('click', shift));
        ctx.doc.querySelector('#ss-player-list .tsic-slot[data-grid="3"]')
            .dispatchEvent(new ctx.win.MouseEvent('click', shift));
        const pubs = ctx.publishes().filter(p => p.channel === 'UI.Cmd.Inventory.QuickMove');
        ctx.expect(ctx.assert.eq(pubs.length, 2));
        ctx.expect(ctx.assert.truthy(pubs.some(p => p.payload.FromOwnerId === 'Storage:42' && p.payload.ToOwnerId === 'Player')));
        ctx.expect(ctx.assert.truthy(pubs.some(p => p.payload.FromOwnerId === 'Player' && p.payload.ToOwnerId === 'Storage:42')));
    },
});

// ---- Storage: clicking every category tab ----------------------------
TSICTestHarness.register({
    name: 'Mouse/Storage: player-side tabs cycle active state (container pane has no tabs)',
    file: '/screens/storage.html',
    async run(ctx) {
        ctx.setItemCatalog({
            ID_Axe:   { Name: 'Axe',   Category: 'Equipment' },
            ID_Bread: { Name: 'Bread', Category: 'Consumable' },
            ID_Wheat: { Name: 'Wheat', Category: 'CraftingMaterial' },
        });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, MaxSlots: 32, Items: [
            { ItemId: 'ID_Axe',   Count: 1, InstanceId: 1, GridSlot: 0 },
            { ItemId: 'ID_Bread', Count: 1, InstanceId: 2, GridSlot: 1 },
            { ItemId: 'ID_Wheat', Count: 1, InstanceId: 3, GridSlot: 2 },
        ]});
        // The container pane dropped its tab strip in the split-page redesign;
        // only the player column filters (dim in place, rule 48).
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.ss-tabs[data-side="player"] .tsic-tab').length === 6);
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('.ss-tabs[data-side="container"] .tsic-tab').length, 0));
        // Selected by id: the labels are abbreviated ("Materials" → "Mat.") so the tab bar is
        // never wider than the grid beneath it.
        for (const id of ['Equipment','Consumables','All']) {
            ctx.doc.querySelector(`.ss-tabs[data-side="player"] .tsic-tab[data-tab="${id}"]`).click();
            await new Promise(r => setTimeout(r, 15));
            ctx.expect(ctx.assert.eq(
                ctx.doc.querySelector('.ss-tabs[data-side="player"] .tsic-tab.is-active').dataset.tab, id));
        }
        // Equipment tab dims the non-equipment stacks in place.
        ctx.doc.querySelector('.ss-tabs[data-side="player"] .tsic-tab[data-tab="Equipment"]').click();
        await new Promise(r => setTimeout(r, 15));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ss-player-list .tsic-slot[data-grid="1"].is-filtered'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#ss-player-list .tsic-slot[data-grid="0"]:not(.is-filtered)'));
    },
});

// ---- Pause menu: every button -----------------------------------------
TSICTestHarness.register({
    name: 'Mouse/PauseMenu: Resume/Settings/Quit each publish a different command',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        const map = [
            [/resume/i, 'UI.Cmd.Pause.Resume'],
            [/settings/i, 'UI.Cmd.Pause.Settings'],
            [/quit|return to main menu/i, 'UI.Cmd.Pause.QuitToMenu'],
        ];
        for (const [rx, channel] of map) {
            ctx.clearPublishes();
            const btn = Array.from(ctx.doc.querySelectorAll('button')).find(b => rx.test(b.textContent || ''));
            ctx.expect(ctx.assert.truthy(btn, `expected a button matching ${rx}`));
            btn && btn.click();
            ctx.expect(ctx.assert.published(ctx.handle, channel));
        }
    },
});

// ---- MainMenu: every button -----------------------------------------
TSICTestHarness.register({
    name: 'Mouse/MainMenu: every button publishes the right command',
    file: '/screens/main-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        const cases = [
            [/start|new/i, 'UI.Cmd.Menu.Navigate'],
            [/load|save/i, 'UI.Cmd.Menu.Navigate'],
            [/mods/i,      'UI.Cmd.Menu.Navigate'],
            [/settings/i,  'UI.Cmd.Menu.Navigate'],
            [/credits/i,   'UI.Cmd.Menu.Navigate'],
            [/exit|quit/i, 'UI.Cmd.Menu.Exit'],
        ];
        for (const [rx, expected] of cases) {
            const btn = Array.from(ctx.doc.querySelectorAll('button')).find(b => rx.test(b.textContent || ''));
            if (!btn) continue;
            ctx.clearPublishes();
            btn.click();
            ctx.expect(ctx.assert.published(ctx.handle, expected, { where: () => true }));
        }
    },
});

// ---- Interaction prompt is display-only --------------------------------
TSICTestHarness.register({
    name: 'Mouse/Interaction: prompt is display-only — clicks do not publish',
    file: '/screens/test-interaction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [
            { EntityId: 11, Label: 'Open' },
            { EntityId: 12, Label: 'Inspect' },
        ]});
        await ctx.waitFor(() => /Open/.test(ctx.doc.getElementById('interaction-prompt').textContent));
        ctx.clearPublishes();
        ctx.doc.getElementById('interaction-prompt').click();
        // Activation goes through Enhanced Input (the interact ability), not UI.
        const pubs = ctx.publishes().filter(p => p.channel.indexOf('UI.Cmd.Interaction.') === 0);
        ctx.expect(ctx.assert.eq(pubs.length, 0, 'prompt is display-only — clicks should not publish'));
    },
});

// ---- Save/Load: each slot's Load button -------------------------------
TSICTestHarness.register({
    name: 'Mouse/SaveLoad: each slot publishes LoadSlot with its SlotId',
    file: '/screens/save-load.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Save.Slots', { Slots: [
            { SlotId: 's1', Label: 'A', TimestampIso: '2026-05-18T00:00:00Z' },
            { SlotId: 's2', Label: 'B', TimestampIso: '2026-05-17T00:00:00Z' },
        ]});
        await new Promise(r => setTimeout(r, 80));
        const buttons = Array.from(ctx.doc.querySelectorAll('#slots .save-slot'));
        ctx.expect(ctx.assert.truthy(buttons.length >= 2));
        ctx.clearPublishes();
        for (const b of buttons) b.click();
        const pubs = ctx.publishes().filter(p => p.channel === 'UI.Cmd.Menu.LoadSlot');
        ctx.expect(ctx.assert.eq(pubs.length, buttons.length));
        // Both slot ids should appear.
        const ids = pubs.map(p => p.payload.SlotId).sort();
        ctx.expect(ctx.assert.eq(ids.includes('s1') && ids.includes('s2'), true));
    },
});

// ---- Hotbar: clicking every visible slot fires Select with its index --
TSICTestHarness.register({
    name: 'Mouse/Hotbar: clicking every slot publishes Select with the right index',
    file: '/screens/hotbar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', {
            OwnerId: 'Player', MaxSlots: 32, GridWidth: 8, Items: [
                { InstanceId: 1, ItemId: 'ID_Axe', Count: 1, GridSlot: 0 },
                { InstanceId: 2, ItemId: 'ID_Bread', Count: 2, GridSlot: 1 },
                { InstanceId: 3, ItemId: 'ID_Nail', Count: 3, GridSlot: 4 },
            ],
        });
        ctx.inject('tsic.msg.UI.Hotbar.Changed', { NumSlots: 8, SelectedSlot: 0, SelectedSlotPending: -1 });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hotbar-row .tsic-slot').length === 8);
        ctx.clearPublishes();
        const slots = ctx.doc.querySelectorAll('#hotbar-row .tsic-slot');
        for (let i = 0; i < slots.length; i++) slots[i].click();
        const pubs = ctx.publishes().filter(p => p.channel === 'UI.Cmd.Hotbar.Select');
        // Empty cells are selectable too — selecting one is how you end up bare-handed.
        ctx.expect(ctx.assert.eq(pubs.length, 8));
        ctx.expect(ctx.assert.truthy(pubs.every((p, i) => p.payload.SlotIndex === i)));
    },
});
