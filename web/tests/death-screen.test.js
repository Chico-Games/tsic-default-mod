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

TSICTestHarness.register({
    name: 'DeathScreen: an end-run death hides Respawn and shows the mode\'s line',
    file: '/screens/death-screen.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('btn-respawn'));
        ctx.inject('tsic.msg.UI.DeathScreen.Shown', {
            DeathMessage: 'You were killed by the Snail', bRunEnded: true,
            RunEndedMessage: 'The snail got you. This store is gone for good.' });
        await ctx.waitFor(() => ctx.doc.getElementById('btn-respawn').hidden);
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('btn-respawn').hidden, 'Respawn hidden'));
        ctx.expect(ctx.assert.truthy(!ctx.doc.getElementById('btn-menu').hidden, 'Quit stays'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#run-ended', 'The snail got you. This store is gone for good.'));
        // A normal death afterwards brings Respawn back.
        ctx.inject('tsic.msg.UI.DeathScreen.Shown', { DeathMessage: 'You were killed by Janitor', bRunEnded: false, RunEndedMessage: '' });
        await ctx.waitFor(() => !ctx.doc.getElementById('btn-respawn').hidden);
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('run-ended').hidden, 'run-ended line hidden again'));
    },
});
