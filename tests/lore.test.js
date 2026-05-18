TSICTestHarness.register({
    name: 'Paper: renders text + arrow keys publish Select',
    file: '/screens/paper.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.LoreScreen.Opened', {
            ScreenKind: 'Paper',
            Texts: [
                { Heading: 'Day 1',  Body: 'The store is closed.', GroupTitle: 'Journal' },
                { Heading: 'Day 2',  Body: 'It opened again.',     GroupTitle: 'Journal' },
            ],
            InitialIndex: 0,
        });
        await ctx.waitFor(() => ctx.doc.getElementById('lore-heading').textContent.length > 0);
        ctx.expect(ctx.assert.domText(ctx.doc, '#lore-heading', 'Day 1'));
        ctx.clearPublishes();
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domText(ctx.doc, '#lore-heading', 'Day 2'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.LoreScreen.Select', { where: p => p.Index === 1 }));
    },
});

TSICTestHarness.register({
    name: 'Screen lore: filters by kind=Screen',
    file: '/screens/screen.html',
    async run(ctx) {
        // Paper kind should be ignored.
        ctx.inject('tsic.msg.UI.LoreScreen.Opened', {
            ScreenKind: 'Paper', Texts: [{ Heading: 'Wrong kind', Body: 'no', GroupTitle: '' }], InitialIndex: 0,
        });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.eq((ctx.doc.getElementById('lore-heading').textContent || '').trim(), ''));
        // Screen kind should render.
        ctx.inject('tsic.msg.UI.LoreScreen.Opened', {
            ScreenKind: 'Screen', Texts: [{ Heading: 'OK', Body: 'right kind', GroupTitle: '' }], InitialIndex: 0,
        });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.domText(ctx.doc, '#lore-heading', 'OK'));
    },
});

TSICTestHarness.register({
    name: 'Tablet: Close publishes LoreScreen.Close + Pause.Resume',
    file: '/screens/tablet.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.LoreScreen.Opened', { ScreenKind: 'Tablet', Texts: [{ Heading: 'x', Body: 'y', GroupTitle: '' }], InitialIndex: 0 });
        await new Promise(r => setTimeout(r, 60));
        ctx.clearPublishes();
        ctx.doc.getElementById('lore-close').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.LoreScreen.Close'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
});
