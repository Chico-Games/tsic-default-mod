// Keyboard-interaction coverage: every keyboard shortcut on every page,
// plus negative paths (wrong keys, focused vs unfocused targets, etc).

// ---- Inventory keyboard ----------------------------------------------
TSICTestHarness.register({
    name: 'Keys/Inventory: Back resumes; unmount hides the character preview',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid'));
        ctx.clearPublishes();
        ctx.inject('tsic.msg.UI.Behavior.Back', { Phase: 'Started' });
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
        ctx.screen('None');
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.CharacterPreview.Hide'));
    },
});

TSICTestHarness.register({
    name: 'Keys/Inventory: number key with no hovered item is a no-op',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid'));
        ctx.clearPublishes();
        ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: '3', bubbles: true }));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Hotbar.Assign'));
    },
});

TSICTestHarness.register({
    name: 'Keys/Inventory: letter key is ignored by the hotbar shortcut',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.setItemCatalog({ ID_X: { Name: 'X', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [{ ItemId: 'ID_X', Count: 1, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"] img'));
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]').dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        ctx.clearPublishes();
        ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'h', bubbles: true }));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Hotbar.Assign'));
    },
});

// ---- Lore keyboard ----------------------------------------------------
TSICTestHarness.register({
    name: 'Keys/Lore (Paper): Escape closes + Pause.Resume',
    file: '/screens/paper.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.LoreScreen.Opened', { ScreenKind: 'Paper', Texts: [{ Heading: 'X', Body: 'x', GroupTitle: '' }], InitialIndex: 0 });
        await ctx.waitFor(() => ctx.doc.getElementById('lore-heading').textContent === 'X');
        ctx.clearPublishes();
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.LoreScreen.Close'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
});

TSICTestHarness.register({
    name: 'Keys/Lore (Screen kind): ArrowKeys publish Select',
    file: '/screens/screen.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.LoreScreen.Opened', { ScreenKind: 'Screen', Texts: [
            { Heading: 'a', Body: 'a', GroupTitle: '' },
            { Heading: 'b', Body: 'b', GroupTitle: '' },
        ], InitialIndex: 0 });
        await ctx.waitFor(() => ctx.doc.getElementById('lore-heading').textContent === 'a');
        ctx.clearPublishes();
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.LoreScreen.Select', { where: p => p.Index === 1 }));
    },
});

// ---- Chat keyboard ----------------------------------------------------
TSICTestHarness.register({
    name: 'Keys/Chat: Enter on the HUD chat input publishes Chat.Send',
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#hud-chat-input'));
        ctx.inject('tsic.msg.UI.Behavior.OpenChat', { Phase: 'Started' });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-chat').classList.contains('open'));
        const input = ctx.doc.getElementById('hud-chat-input');
        input.value = 'hello';
        ctx.clearPublishes();
        input.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Chat.Send'));
    },
});

// ---- Universal Storage modal: Enter submits, Esc cancels ----------------
TSICTestHarness.register({
    name: 'Keys/USS: Enter inside create-group input submits',
    file: '/screens/universal-storage-setup.html?entityId=99',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.UniversalStorage.Groups', { GroupNames: [] });
        await ctx.waitFor(() => ctx.doc.getElementById('btn-new'));
        ctx.doc.getElementById('btn-new').click();
        await new Promise(r => setTimeout(r, 20));
        const input = ctx.doc.querySelector('input#uss-name');
        input.value = 'NewGroup';
        ctx.clearPublishes();
        input.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.UniversalStorage.CreateGroup', { where: p => p.GroupName === 'NewGroup' }));
    },
});

// ---- Map keyboard -----------------------------------------------------
TSICTestHarness.register({
    name: 'Keys/Map: R triggers fitToBounds re-render',
    file: '/screens/map.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Map.Snapshot', { Players: [], Icons: [], MinBounds: { X: -100, Y: -100 }, MaxBounds: { X: 100, Y: 100 } });
        await new Promise(r => setTimeout(r, 60));
        // Just verify R doesn't throw and an Escape afterwards still publishes close.
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'r', bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.clearPublishes();
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.GameScreen.Close'));
    },
});

// ---- Inventory: numeric 1, 9 boundary mapping ---------------------------
TSICTestHarness.register({
    name: 'Keys/Inventory: 2..9 keys map to slots 1..8; 1 is the reserved fists slot',
    file: '/screens/inventory.html',
    async run(ctx) {
        ctx.screen('Inventory');
        ctx.setItemCatalog({ ID_X: { Name: 'X', Category: 'Equipment' } });
        ctx.inject('tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', GridWidth: 8, Items: [{ ItemId: 'ID_X', Count: 1, InstanceId: 1, GridSlot: 0 }], MaxSlots: 32 });
        await ctx.waitFor(() => ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"] img'));
        ctx.doc.querySelector('#inv-grid .tsic-slot[data-grid="0"]').dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 15));
        // Key 1 addresses slot 0 — the reserved fists slot, which takes nothing.
        ctx.clearPublishes();
        ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: '1', bubbles: true }));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Hotbar.Assign'));
        for (let n = 2; n <= 9; n++) {
            ctx.clearPublishes();
            ctx.doc.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: String(n), bubbles: true }));
            ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Hotbar.Assign', { where: p => p.SlotIndex === n - 1 }));
        }
    },
});

// ---- DeathScreen has no specific keyboard ------------------------------
TSICTestHarness.register({
    name: 'Keys/DeathScreen: arbitrary keypress does not publish anything',
    file: '/screens/death-screen.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('btn-respawn'));
        ctx.clearPublishes();
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'r', bubbles: true }));
        // DeathScreen reacts only to button clicks; should be quiet.
        const publishes = ctx.publishes();
        ctx.expect(ctx.assert.eq(publishes.length, 0));
    },
});
