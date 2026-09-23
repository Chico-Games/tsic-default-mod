// Keyboard-interaction coverage: every keyboard shortcut on every page,
// plus negative paths (wrong keys, focused vs unfocused targets, etc).

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
