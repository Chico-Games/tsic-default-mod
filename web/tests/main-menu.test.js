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


TSICTestHarness.register({
    name: 'MenuStage: the paper wash is opaque from the FIRST paint, not once script runs',
    file: '/screens/settings.html',
    async run(ctx) {
        // REGRESSION (#150, report 23 — "one frame of the store"). The stage's cream wash
        // used to default to 0.35 in CSS and be corrected to 0.92 by store-maze-stage.js,
        // which is deferred AND polls for the maze module. Every menu page therefore painted
        // 65% see-through for several frames, and the game world behind CEF showed through on
        // every navigation between menus. A backdrop cannot be authored in a script that runs
        // after the backdrop is on screen, so the value lives in base.css now.
        const stage = ctx.doc.querySelector('.tsic-stage--magazine-gradient');
        ctx.expect(ctx.assert.truthy(stage, 'the settings page is built on the gradient stage'));
        const alpha = parseFloat(
            ctx.win.getComputedStyle(stage).getPropertyValue('--tsic-stage-paper-alpha'));
        ctx.expect(ctx.assert.truthy(alpha >= 0.9,
            'paper wash is near-opaque before any script touched it (got ' + alpha + ')'));
        // ...and it is CSS, not an inline style the script wrote.
        ctx.expect(ctx.assert.falsy(stage.style.getPropertyValue('--tsic-stage-paper-alpha'),
            'nothing sets the wash from script any more'));
    },
});

TSICTestHarness.register({
    name: 'MenuStage: the title screen stays fully solid',
    file: '/screens/main-menu.html',
    async run(ctx) {
        // The title screen is a backdrop, not an overlay — the menu level must never show
        // through it at all. data-paper-alpha="1" is an authored attribute, so it applies at
        // parse time like every other rule on the stage.
        const stage = ctx.doc.querySelector('.tsic-stage--magazine-gradient');
        ctx.expect(ctx.assert.eq(stage.getAttribute('data-paper-alpha'), '1'));
        ctx.expect(ctx.assert.eq(
            parseFloat(ctx.win.getComputedStyle(stage).getPropertyValue('--tsic-stage-paper-alpha')),
            1, 'solid'));
    },
});
