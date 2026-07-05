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
