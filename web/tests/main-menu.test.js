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
    name: 'NewStore: Durham Furniture is pinned first and preselected, Dev maps last',
    file: '/screens/new-store.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Menu.Layouts', { Layouts: [
            { LayoutId: 'DevBlankFloor',    DisplayName: 'DevBlankFloor',    ThumbnailUrl: '' },
            { LayoutId: 'Abandoned Mall',   DisplayName: 'Abandoned Mall',   ThumbnailUrl: '' },
            { LayoutId: 'Durham Furniture', DisplayName: 'Durham Furniture', ThumbnailUrl: '' },
        ]});
        await new Promise(r => setTimeout(r, 120));
        const dd = ctx.doc.getElementById('layout-dd');
        const opts = JSON.parse(dd.getAttribute('data-tsic-options') || '[]');
        ctx.expect(ctx.assert.eq(opts.map(o => o.value).join('|'),
            'Durham Furniture|Abandoned Mall|DevBlankFloor'));
        ctx.expect(ctx.assert.eq(dd.getAttribute('data-tsic-value'), 'Durham Furniture'));
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
