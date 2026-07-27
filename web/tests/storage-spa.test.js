// Regression guard for the migration of Storage into the SPA shell (2026-07-25).
//
// The bug: unregistered screens fall back to window.location.replace, and hud.js mounts its
// chrome only when the page declares <meta name="tsic-screen" content="InGame">. So opening
// any container navigated the whole shell away and blanked health / stamina / hotbar /
// minimap, while crafting and production — already registered — kept them. Containers are
// the most-opened screen in the game.
//
// These run against the real shell (/screens/in-game.html), so a regression that
// un-registers Storage, or drops its script tag from the shell, fails here.

TSICTestHarness.register({
    name: 'Storage/SPA: opening Storage mounts in the shell and keeps the HUD alive',
    file: '/screens/in-game.html',
    async run(ctx) {
        // The HUD must exist before we start, or the assertion below proves nothing.
        await ctx.waitFor(() => ctx.doc.getElementById('hud-chrome'));
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('hud-chrome'), 'HUD chrome present at rest'));

        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Storage' });
        await ctx.waitFor(() => ctx.doc.querySelector('[data-screen="Storage"]'));

        const container = ctx.doc.querySelector('[data-screen="Storage"]');
        ctx.expect(ctx.assert.truthy(container, 'Storage mounted as an SPA overlay'));
        ctx.expect(ctx.assert.eq(container.hidden, false, 'Storage overlay is visible'));

        // The whole point: we are still on the shell document, so the HUD survived.
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('hud-chrome'),
            'HUD chrome still present while a container is open'));

        // And the storage shell actually built its panel rather than mounting an empty host.
        await ctx.waitFor(() => ctx.doc.getElementById('ss-panel'));
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('ss-panel'), 'storage panel built'));
    },
});

TSICTestHarness.register({
    name: 'Storage/SPA: closing Storage returns to InGame and leaves the HUD intact',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'Storage' });
        await ctx.waitFor(() => {
            const c = ctx.doc.querySelector('[data-screen="Storage"]');
            return c && c.hidden === false;
        });

        ctx.inject('tsic.msg.UI.Screen.Changed', { Name: 'InGame' });
        await ctx.waitFor(() => {
            const c = ctx.doc.querySelector('[data-screen="Storage"]');
            return c && c.hidden === true;
        });

        ctx.expect(ctx.assert.eq(ctx.doc.querySelector('[data-screen="Storage"]').hidden, true,
            'Storage overlay hidden again'));
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('hud-chrome'),
            'HUD chrome still present after closing'));
    },
});

TSICTestHarness.register({
    name: 'Storage/SPA: Storage is registered, so it can never hit the page-navigation fallback',
    file: '/screens/in-game.html',
    async run(ctx) {
        // screenFileFor is what the fallback consults; a null result means the only path
        // available to screen-manager is the registered SPA module.
        await ctx.waitFor(() => ctx.win.TSIC && typeof ctx.win.TSIC.screenFileFor === 'function');
        ctx.expect(ctx.assert.eq(ctx.win.TSIC.screenFileFor('Storage'), null,
            'Storage has no legacy fallback file left in the router'));
        // Sanity: the router still maps a genuinely unmigrated screen, so this assertion
        // is testing the Storage entry specifically and not an empty table.
        ctx.expect(ctx.assert.truthy(ctx.win.TSIC.screenFileFor('Teleporter'),
            'an unmigrated screen still resolves, so the table is intact'));
    },
});
