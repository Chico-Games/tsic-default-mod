TSICTestHarness.register({
    name: 'DeathScreen: Respawn publishes Pause.Resume',
    file: '/screens/death-screen.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('btn-respawn'));
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-respawn').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
});

TSICTestHarness.register({
    name: 'DeathScreen: Quit to Menu publishes Pause.QuitToMenu',
    file: '/screens/death-screen.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('btn-menu'));
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-menu').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.QuitToMenu'));
    },
});
