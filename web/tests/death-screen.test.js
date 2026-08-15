TSICTestHarness.register({
    name: 'DeathScreen: Respawn publishes Death.Respawn',
    file: '/screens/death-screen.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('btn-respawn'));
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-respawn').click();
        // Pause.Resume used to sit here: it pushed the SPA back to the HUD and left the
        // corpse standing, because the respawn itself is server-authoritative.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Death.Respawn'));
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

TSICTestHarness.register({
    name: 'DeathScreen: shows how the player died',
    file: '/screens/death-screen.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('death-cause'));
        ctx.inject('tsic.msg.UI.DeathScreen.Shown', { DeathMessage: 'You were killed by Janitor' });
        await ctx.waitFor(() => ctx.doc.getElementById('death-cause').textContent.includes('Janitor'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#death-cause', 'You were killed by Janitor'));
    },
});

TSICTestHarness.register({
    name: 'DeathScreen: keeps its flavour line when the cause is empty',
    file: '/screens/death-screen.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('death-cause'));
        const before = ctx.doc.getElementById('death-cause').textContent;
        ctx.inject('tsic.msg.UI.DeathScreen.Shown', { DeathMessage: '' });
        await new Promise(r => setTimeout(r, 40));
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('death-cause').textContent, before));
    },
});
