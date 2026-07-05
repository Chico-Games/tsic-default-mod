TSICTestHarness.register({
    name: 'MainMenu: Start button publishes Menu.Navigate',
    file: '/screens/main-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        ctx.clearPublishes();
        const start = Array.from(ctx.doc.querySelectorAll('button')).find(b => /start|new/i.test(b.textContent || ''));
        ctx.expect(ctx.assert.truthy(start));
        start && start.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.Navigate', { where: p => /NewStore|Store/i.test(p.Screen || '') }));
    },
});

TSICTestHarness.register({
    name: 'MainMenu: Exit publishes Menu.Exit',
    file: '/screens/main-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        ctx.clearPublishes();
        const exit = Array.from(ctx.doc.querySelectorAll('button')).find(b => /exit|quit/i.test(b.textContent || ''));
        ctx.expect(ctx.assert.truthy(exit));
        exit && exit.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.Exit'));
    },
});
