// Text chat HUD component (shared/hud-chat.js, mounted by hud.js inside the
// in-game shell). Open with Input.Behavior.OpenChat (Enter), type, Enter sends
// via UI.Cmd.Chat.Send, Escape cancels. History renders from UI.Chat.History.

TSICTestHarness.register({
    name: 'Chat: renders history lines in the HUD log',
    tags: ['chat', 'hud'],
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#hud-chat-log'));
        ctx.inject('tsic.msg.UI.Chat.History', {
            Messages: [
                { SenderName: 'Alex', Text: 'hello world' },
                { SenderName: 'Sam',  Text: 'gg' },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#hud-chat-log .hc-row').length === 2);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#hud-chat-log .hc-row', 2));
        // A fresh history reveals the log (fade class removed).
        const root = ctx.doc.getElementById('hud-chat');
        ctx.expect(ctx.assert.truthy(!root.classList.contains('faded'), 'log should be revealed after new messages'));
    },
});

TSICTestHarness.register({
    name: 'Chat: OpenChat behavior opens the input and pushes the ChatInput overlay',
    tags: ['chat', 'hud'],
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#hud-chat-input'));
        ctx.inject('tsic.msg.UI.Behavior.OpenChat', { Phase: 'Started' });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-chat').classList.contains('open'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Overlay.Push',
            p => p && p.Name === 'ChatInput'));
    },
});

TSICTestHarness.register({
    name: 'Chat: Enter sends the message, closes, and pops the overlay',
    tags: ['chat', 'hud'],
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#hud-chat-input'));
        ctx.inject('tsic.msg.UI.Behavior.OpenChat', { Phase: 'Started' });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-chat').classList.contains('open'));
        const input = ctx.doc.getElementById('hud-chat-input');
        input.value = 'hi there';
        input.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Chat.Send',
            p => p && p.Text === 'hi there'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Overlay.Pop',
            p => p && p.Name === 'ChatInput'));
        ctx.expect(ctx.assert.truthy(!ctx.doc.getElementById('hud-chat').classList.contains('open'),
            'chat should close after sending'));
        ctx.expect(ctx.assert.truthy(input.value === '', 'input should clear after sending'));
    },
});

TSICTestHarness.register({
    name: 'Chat: Enter with empty text closes without sending',
    tags: ['chat', 'hud'],
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#hud-chat-input'));
        ctx.inject('tsic.msg.UI.Behavior.OpenChat', { Phase: 'Started' });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-chat').classList.contains('open'));
        const input = ctx.doc.getElementById('hud-chat-input');
        input.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Chat.Send'));
        ctx.expect(ctx.assert.truthy(!ctx.doc.getElementById('hud-chat').classList.contains('open'),
            'chat should close on empty Enter'));
    },
});

TSICTestHarness.register({
    name: 'Chat: Escape cancels without sending',
    tags: ['chat', 'hud'],
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#hud-chat-input'));
        ctx.inject('tsic.msg.UI.Behavior.OpenChat', { Phase: 'Started' });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-chat').classList.contains('open'));
        const input = ctx.doc.getElementById('hud-chat-input');
        input.value = 'typed but abandoned';
        input.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Chat.Send'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Overlay.Pop',
            p => p && p.Name === 'ChatInput'));
        ctx.expect(ctx.assert.truthy(!ctx.doc.getElementById('hud-chat').classList.contains('open'),
            'chat should close on Escape'));
    },
});

TSICTestHarness.register({
    name: 'Chat: message text opts into selection while open',
    tags: ['chat', 'hud'],
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#hud-chat-log'));
        ctx.inject('tsic.msg.UI.Chat.History', {
            Messages: [{ SenderName: 'Alex', Text: 'select me' }],
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#hud-chat-log .hc-text'));
        ctx.inject('tsic.msg.UI.Behavior.OpenChat', { Phase: 'Started' });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-chat').classList.contains('open'));
        const text = ctx.doc.querySelector('#hud-chat-log .hc-text');
        const sel = ctx.win.getComputedStyle(text).userSelect || ctx.win.getComputedStyle(text).webkitUserSelect;
        ctx.expect(ctx.assert.truthy(sel === 'text', `expected user-select:text while open, got '${sel}'`));
    },
});
