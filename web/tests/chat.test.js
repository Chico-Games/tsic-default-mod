TSICTestHarness.register({
    name: 'Chat: renders history lines',
    file: '/screens/chat.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Chat.History', {
            Messages: [
                { Sender: 'Alex', Text: 'hello world' },
                { Sender: 'Sam',  Text: 'gg' },
            ],
        });
        await new Promise(r => setTimeout(r, 80));
        const lines = ctx.doc.querySelectorAll('#chat-log .cm-row');
        ctx.expect(ctx.assert.truthy(lines.length >= 1, `expected at least one .cm-row, got ${lines.length}`));
    },
});

TSICTestHarness.register({
    name: 'Chat: pressing Enter publishes UI.Cmd.Chat.Send',
    file: '/screens/chat.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('input, [contenteditable]'));
        const input = ctx.doc.querySelector('input, [contenteditable]');
        if (input.tagName === 'INPUT') { input.value = 'hi'; }
        else { input.textContent = 'hi'; }
        input.focus();
        input.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        // The page should publish UI.Cmd.Chat.Send. If it doesn't, the test surfaces
        // an authoring gap to be fixed in the page itself.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Chat.Send'));
    },
});
