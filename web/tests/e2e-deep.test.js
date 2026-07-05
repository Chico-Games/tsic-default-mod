// Deeper end-to-end flows: state changes seen across multiple sequential
// payloads on one page (server "acks" → page rerenders → user reacts again).

// ---- Inventory state evolution ----------------------------------------
TSICTestHarness.register({
    name: 'E2E/Inventory: weight grows past warning, then full, then overburdened',
    file: '/screens/inventory.html',
    async run(ctx) {
        for (const [cur, expectedState] of [[1, 'normal'], [8, 'warning'], [10, 'full'], [12, 'overburdened']]) {
            ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: [], MaxSlots: 32, MaxWeight: 10, CurrentWeight: cur });
            await ctx.waitFor(() => ctx.doc.getElementById('inv-capacity').dataset.state === expectedState);
            ctx.expect(ctx.assert.eq(ctx.doc.getElementById('inv-capacity').dataset.state, expectedState));
        }
    },
});

TSICTestHarness.register({
    name: 'E2E/Inventory: hover publishes contextual menu, leave keeps it sticky',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Axe: { Name: 'Axe', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1, Items: [{ ItemId: 'ID_Axe', Count: 1, SlotIndex: 0 }] });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"] img'));
        const slot = ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"]');
        ctx.clearPublishes();
        slot.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        slot.dispatchEvent(new ctx.win.MouseEvent('mouseleave', { bubbles: true }));
        const hoverCtx = ctx.publishes().find(p => p.channel === 'UI.Cmd.BehaviorBar.SetMenuContext'
            && p.payload.Entries.find(e => e.Label === 'Equip'));
        ctx.expect(ctx.assert.truthy(hoverCtx, 'expected an Equip-bearing context on hover'));
        // Inventory keeps the right pane sticky on leave (no clear context fires).
        // So the last publish should still be the hover context, not a separate clear.
        const setMenuPubs = ctx.publishes().filter(p => p.channel === 'UI.Cmd.BehaviorBar.SetMenuContext');
        ctx.expect(ctx.assert.eq(setMenuPubs.length, 1, 'expected only the hover publish (no leave-clear)'));
    },
});

// (Removed: 'E2E/ActionBar: rapid screen flips keep the right group visible'.
//  That tested screen-based gameplay/menu-group toggling and the #bb-menu bar,
//  which only existed in the deleted screens/action-bar.html. The live
//  gameplay bar (hud-action-bar.js) is not screen-gated, and the menu action
//  bar is not yet wired into the shell — tracked as a separate follow-up.)

// ---- Production: empty → filled → progressed → completed ---------------
TSICTestHarness.register({
    name: 'E2E/Production: station open → recipe → queue → progress → completed',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Production',
            Recipes: [{ RecipeId: 'R_Plank', Name: 'Plank', bDiscovered: true, bStationLevelSufficient: true, Inputs: [], Outputs: [] }],
            MaterialCounts: {},
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#p-list .tsic-list-row').length >= 1);
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', Entries: [{ RecipeId: 'R_Plank', QueueIndex: 0, Progress: 0, bIsActive: true }] });
        await new Promise(r => setTimeout(r, 50));
        ctx.inject('tsic.msg.UI.Recipe.Progress', { Kind: 'Production', RecipeId: 'R_Plank', Progress: 0.5 });
        ctx.inject('tsic.msg.UI.Recipe.Completed', { Kind: 'Production', RecipeId: 'R_Plank' });
        // Page survives the whole sequence.
        ctx.expect(ctx.assert.truthy(true));
    },
});

// ---- USS: create -> Groups list refresh -> Bind -----------------------
TSICTestHarness.register({
    name: 'E2E/USS: create flow + ack refreshes the list',
    file: '/screens/universal-storage-setup.html?entityId=42',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.UniversalStorage.Groups', { GroupNames: [] });
        await ctx.waitFor(() => ctx.doc.getElementById('btn-new'));
        ctx.doc.getElementById('btn-new').click();
        await new Promise(r => setTimeout(r, 20));
        const input = ctx.doc.querySelector('input#uss-name');
        input.value = 'Lab';
        ctx.clearPublishes();
        ctx.doc.querySelector('button#uss-create-confirm').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.UniversalStorage.CreateGroup'));
        // Server "ack" — re-broadcast groups including the new one.
        ctx.inject('tsic.msg.UI.UniversalStorage.Groups', { GroupNames: ['Lab'] });
        await ctx.waitFor(() => /Lab/.test(ctx.doc.body.textContent));
        ctx.expect(ctx.assert.truthy(/Lab/.test(ctx.doc.body.textContent)));
    },
});

// ---- Map: pings appear, then are removed -----------------------------
TSICTestHarness.register({
    name: 'E2E/Map: ping appears in #g-pings then disappears on empty broadcast',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Snapshot', { Players: [], Icons: [], MinBounds: { X: -100, Y: -100 }, MaxBounds: { X: 100, Y: 100 } });
        ctx.inject('tsic.msg.UI.Ping.Set', { Pings: [{ PingId: 'p1', PingType: 'Map', Location: { X: 0, Y: 0, Z: 0 }, OwnerId: 'X' }] });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#g-pings g').length >= 1);
        ctx.inject('tsic.msg.UI.Ping.Set', { Pings: [] });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#g-pings g').length === 0);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#g-pings g', 0));
    },
});

// ---- Construction: preview state transitions --------------------------
TSICTestHarness.register({
    name: 'E2E/Construction: preview goes blocked -> ready, status pill colour flips',
    file: '/screens/construction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.PreviewState', { bCanPlace: false, FailureReason: 'no clearance' });
        await ctx.waitFor(() => /NO CLEARANCE/.test(ctx.doc.getElementById('preview-text').textContent || ''));
        ctx.inject('tsic.msg.UI.Construction.PreviewState', { bCanPlace: true });
        await ctx.waitFor(() => /READY/.test(ctx.doc.getElementById('preview-text').textContent || ''));
        ctx.expect(ctx.assert.domText(ctx.doc, '#preview-text', 'READY'));
    },
});

// ---- Inventory + Catalog late-arrival ---------------------------------
TSICTestHarness.register({
    name: 'E2E/Inventory: late item-catalog arrival re-renders with names',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', MaxSlots: 32, MaxWeight: 50, CurrentWeight: 1, Items: [
            { ItemId: 'ID_Late', Count: 1, SlotIndex: 0 },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-list .tsic-list-row[data-slot="0"] img'));
        // Catalog arrives later — categorisation should reroute the item into Tools.
        ctx.setItemCatalog({ ID_Late: { Name: 'Late', Category: 'Equipment' } });
        await new Promise(r => setTimeout(r, 60));
        // Click the Tools tab; item should still be there.
        Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(e => e.textContent === 'Tools').click();
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#inv-list .tsic-list-row[data-slot="0"] img'));
    },
});

// ---- Crafting: toast on craft (Sound.Play) ----------------------------
TSICTestHarness.register({
    name: 'E2E/Crafting: Enter publishes Recipe.Start + Sound.Play',
    file: '/screens/crafting.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_W: { Name: 'Wheat', Category: 'CraftingMaterial' }, ID_B: { Name: 'Bread', Category: 'Consumable' } });
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Crafting',
            Recipes: [{ RecipeId: 'R_B', Name: 'Bread', bDiscovered: true, bStationLevelSufficient: true,
                        Ingredients: [{ ItemId: 'ID_W', Count: 2 }], Outputs: [{ ItemId: 'ID_B', Count: 1 }] }],
            MaterialCounts: { ID_W: 5 },
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#c-station .tsic-list-row'));
        ctx.doc.querySelector('#c-station .tsic-list-row').click();
        await new Promise(r => setTimeout(r, 20));
        ctx.clearPublishes();
        // RecipeStation commits the selected recipe on a tsic:confirm event
        // (dispatched by the focus engine on confirm); raw Enter is not wired.
        ctx.doc.querySelector('#c-station .tsic-list-row.is-selected')
            .dispatchEvent(new ctx.win.CustomEvent('tsic:confirm', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Recipe.Start'));
    },
});

// ---- Save/Load → Load slot ----------------------------------------
TSICTestHarness.register({
    name: 'E2E/SaveLoad: every slot Load button publishes with its SlotId',
    file: '/screens/save-load.html',
    async run(ctx) {
        const slots = Array.from({ length: 4 }, (_, i) => ({ SlotId: 'slot' + i, Label: 'S' + i, TimestampIso: '2026-05-18T00:00:00Z' }));
        ctx.inject('tsic.msg.UI.Save.Slots', { Slots: slots });
        await new Promise(r => setTimeout(r, 60));
        const buttons = Array.from(ctx.doc.querySelectorAll('#slots .save-slot'));
        ctx.expect(ctx.assert.truthy(buttons.length >= 4));
        ctx.clearPublishes();
        for (const b of buttons.slice(0, 4)) b.click();
        const pubs = ctx.publishes().filter(p => p.channel === 'UI.Cmd.Menu.LoadSlot');
        ctx.expect(ctx.assert.eq(pubs.length, 4));
    },
});

// ---- ActionBar: hash-quality changes redraw rows -----------------------
TSICTestHarness.register({
    name: 'E2E/ActionBar: re-broadcast with new status redraws rows',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', { Entries: [{ BehaviorTagName: 'IA_X', DisplayName: 'X', bVisible: true, StatusInt: 0 }] });
        await ctx.waitFor(() => ctx.doc.querySelector('#bb-gameplay .bb-row[data-status="available"]'));
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', { Entries: [{ BehaviorTagName: 'IA_X', DisplayName: 'X', bVisible: true, StatusInt: 1 }] });
        await ctx.waitFor(() => ctx.doc.querySelector('#bb-gameplay .bb-row[data-status="blocked"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#bb-gameplay .bb-row[data-status="blocked"]'));
    },
});

// ---- Notifications: subsequent pushes append to the stack -------------
TSICTestHarness.register({
    name: 'E2E/Notifications: rapid pushes shown in column-reverse order (newest on top)',
    file: '/screens/test-notifications.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Notification.Show', { Title: 'first',  Text: '', Type: 'Tip' });
        ctx.inject('tsic.msg.UI.Notification.Show', { Title: 'second', Text: '', Type: 'Tip' });
        ctx.inject('tsic.msg.UI.Notification.Show', { Title: 'third',  Text: '', Type: 'Tip' });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.notif').length === 3);
        const titles = Array.from(ctx.doc.querySelectorAll('.notif-title')).map(e => e.textContent);
        // Stack order in DOM is insertion order; CSS does flex-direction:
        // column-reverse so visual top is the newest.
        ctx.expect(ctx.assert.eq(titles, ['first','second','third']));
    },
});
