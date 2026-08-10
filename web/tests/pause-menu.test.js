TSICTestHarness.register({
    name: 'PauseMenu: renders player list',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Players.List', {
            Players: [
                { Id: '1', Name: 'Host',  bIsHost: true  },
                { Id: '2', Name: 'Guest', bIsHost: false },
            ],
        });
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.truthy(ctx.doc.body.textContent.indexOf('Host')  >= 0));
        ctx.expect(ctx.assert.truthy(ctx.doc.body.textContent.indexOf('Guest') >= 0));
    },
});

// The live module (shared/screens/pause-menu.js) mounted in the real in-game
// shell — /screens/pause-menu.html is a standalone mirror, not what ships.
TSICTestHarness.register({
    name: 'PauseMenu: Save and Quit publishes Menu.Exit',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.screen('PauseMenu');
        await ctx.waitFor(() => ctx.doc.querySelector('[data-screen="PauseMenu"] button'));
        ctx.clearPublishes();
        const quit = Array.from(ctx.doc.querySelectorAll('[data-screen="PauseMenu"] button'))
            .find(b => /save and quit/i.test(b.textContent || ''));
        ctx.expect(ctx.assert.truthy(quit, 'pause menu has a Save and Quit button'));
        quit && quit.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.Exit'));
    },
});

TSICTestHarness.register({
    name: 'PauseMenu: Resume button publishes Pause.Resume',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        ctx.clearPublishes();
        const resume = Array.from(ctx.doc.querySelectorAll('button')).find(b => /resume/i.test(b.textContent || ''));
        ctx.expect(ctx.assert.truthy(resume));
        resume && resume.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
});
