// Mods screen — two-column library (Stockroom = inactive, Shop Floor = active).
// Column moves publish UI.Cmd.Mod.SetEnabled; the active column owns load order.

function modsFixture(ctx) {
    ctx.inject('tsic.msg.UI.Mod.InstalledList', { Mods: [
        { ModId: 'com.chicogames.default', DisplayName: 'Base Game', Version: '1.0', bEnabled: true,  bLocked: true,  bShipped: true },
        { ModId: 'mod.a', DisplayName: 'Alpha Mod',   Version: '1.0', bEnabled: true,  bLocked: false, bShipped: false },
        { ModId: 'mod.b', DisplayName: 'Beta Mod',    Version: '2.0', bEnabled: false, bLocked: false, bShipped: false },
        { ModId: 'mod.s', DisplayName: 'Shipped Mod', Version: '1.0', bEnabled: false, bLocked: false, bShipped: true },
    ] });
    ctx.inject('tsic.msg.UI.Mod.LoadOrder', { Order: ['com.chicogames.default', 'mod.a', 'mod.b', 'mod.s'] });
}
function rowIds(ctx, listId) {
    return Array.from(ctx.doc.querySelectorAll('#' + listId + ' .lib-row'))
        .map(r => r.dataset.modId);
}

TSICTestHarness.register({
    name: 'Mods: library splits into active and inactive columns',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('list-active'));
        modsFixture(ctx);
        await ctx.waitFor(() => ctx.doc.querySelector('#list-active .lib-row'));
        ctx.expect(ctx.assert.eq(rowIds(ctx, 'list-active').join(','), 'com.chicogames.default,mod.a'));
        ctx.expect(ctx.assert.eq(rowIds(ctx, 'list-inactive').join(','), 'mod.b,mod.s'));
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('count-active').textContent, '2'));
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('count-inactive').textContent, '2'));
    },
});

TSICTestHarness.register({
    name: 'Mods: right arrow activates — publishes SetEnabled true and moves the row',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('list-inactive'));
        modsFixture(ctx);
        await ctx.waitFor(() => ctx.doc.querySelector('#list-inactive .lib-row .btn-move--right'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#list-inactive .lib-row[data-mod-id="mod.b"] .btn-move--right').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Mod.SetEnabled',
            { where: p => p.ModId === 'mod.b' && p.Enabled === true }));
        ctx.expect(ctx.assert.truthy(rowIds(ctx, 'list-active').includes('mod.b')));
        ctx.expect(ctx.assert.truthy(!rowIds(ctx, 'list-inactive').includes('mod.b')));
    },
});

TSICTestHarness.register({
    name: 'Mods: left arrow deactivates — publishes SetEnabled false and moves the row',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('list-active'));
        modsFixture(ctx);
        await ctx.waitFor(() => ctx.doc.querySelector('#list-active .lib-row .btn-move--left'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#list-active .lib-row[data-mod-id="mod.a"] .btn-move--left').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Mod.SetEnabled',
            { where: p => p.ModId === 'mod.a' && p.Enabled === false }));
        ctx.expect(ctx.assert.truthy(rowIds(ctx, 'list-inactive').includes('mod.a')));
    },
});

TSICTestHarness.register({
    name: 'Mods: reorder swaps within the active subset and publishes the full order',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('list-active'));
        modsFixture(ctx);
        await ctx.waitFor(() => ctx.doc.querySelector('#list-active .lib-row[data-mod-id="mod.a"]'));
        ctx.clearPublishes();
        const upBtn = ctx.doc.querySelectorAll('#list-active .lib-row[data-mod-id="mod.a"] .btn-step')[0];
        upBtn.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Mod.SetLoadOrder',
            { where: p => Array.isArray(p.Order)
                && p.Order.join(',') === 'mod.a,com.chicogames.default,mod.b,mod.s' }));
        ctx.expect(ctx.assert.eq(rowIds(ctx, 'list-active').join(','), 'mod.a,com.chicogames.default'));
    },
});

TSICTestHarness.register({
    name: 'Mods: locked mod is pinned — no move arrow, reorder and uninstall disabled',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('list-active'));
        modsFixture(ctx);
        await ctx.waitFor(() => ctx.doc.querySelector('#list-active .lib-row'));
        const locked = ctx.doc.querySelector('#list-active .lib-row[data-mod-id="com.chicogames.default"]');
        ctx.expect(ctx.assert.truthy(!locked.querySelector('.btn-move')));
        ctx.expect(ctx.assert.truthy(locked.querySelector('.lock')));
        ctx.expect(ctx.assert.truthy(!locked.querySelector('.btn-uninstall')));
        for (const step of locked.querySelectorAll('.btn-step')) {
            ctx.expect(ctx.assert.truthy(step.disabled));
        }
    },
});

TSICTestHarness.register({
    name: 'Mods: shipped mod offers activate/deactivate but no uninstall',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('list-inactive'));
        modsFixture(ctx);
        await ctx.waitFor(() => ctx.doc.querySelector('#list-inactive .lib-row[data-mod-id="mod.s"]'));
        const shipped = ctx.doc.querySelector('#list-inactive .lib-row[data-mod-id="mod.s"]');
        ctx.expect(ctx.assert.truthy(shipped.querySelector('.btn-move--right')));
        ctx.expect(ctx.assert.truthy(!shipped.querySelector('.btn-uninstall')));
        const normal = ctx.doc.querySelector('#list-inactive .lib-row[data-mod-id="mod.b"]');
        ctx.expect(ctx.assert.truthy(normal.querySelector('.btn-uninstall')));
    },
});

TSICTestHarness.register({
    name: 'Mods: uninstall publishes and the row leaves the library',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('list-inactive'));
        modsFixture(ctx);
        await ctx.waitFor(() => ctx.doc.querySelector('#list-inactive .lib-row[data-mod-id="mod.b"]'));
        ctx.clearPublishes();
        ctx.doc.querySelector('#list-inactive .lib-row[data-mod-id="mod.b"] .btn-uninstall').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Mod.Uninstall',
            { where: p => p.NameId === 'mod.b' }));
        await ctx.waitFor(() => !rowIds(ctx, 'list-inactive').includes('mod.b'), { timeout: 2000 });
        ctx.expect(ctx.assert.truthy(!rowIds(ctx, 'list-inactive').includes('mod.b')));
    },
});

TSICTestHarness.register({
    name: 'Mods: install-failed broadcast surfaces the Reason',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('install-error'));
        ctx.inject('tsic.msg.UI.Mod.InstallFailed', { ModId: 'mod.x', Reason: 'Disk full' });
        await ctx.waitFor(() => (ctx.doc.getElementById('install-error').textContent || '').includes('Disk full'));
        ctx.expect(ctx.assert.truthy(
            ctx.doc.getElementById('install-error').textContent.includes('mod.x')));
    },
});

// ---- typing guard (tsic-focus.js isTypingContext) -------------------------

TSICTestHarness.register({
    name: 'Mods: typing in a text input blocks tab-switch and nav shortcuts',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('search') && ctx.win.tsic && ctx.win.tsic.focus);
        modsFixture(ctx);
        const activeTabLabel = () => {
            const t = ctx.doc.querySelector('#mods-tabs .active, #mods-tabs [aria-selected="true"]');
            return t ? t.textContent.trim() : '';
        };
        const startTab = activeTabLabel();

        const search = ctx.doc.getElementById('search');
        search.focus();
        ctx.expect(ctx.assert.truthy(ctx.win.tsic.focus.isTypingContext()));

        ctx.inject('tsic.msg.UI.Behavior.NextTab', { Phase: 'Started' });
        ctx.inject('tsic.msg.UI.Behavior.PrevTab', { Phase: 'Started' });
        ctx.expect(ctx.assert.eq(activeTabLabel(), startTab));

        ctx.inject('tsic.msg.UI.Behavior.NavDown', { Phase: 'Started' });
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement, search));

        // Blurring the input releases the guard.
        search.blur();
        ctx.expect(ctx.assert.truthy(!ctx.win.tsic.focus.isTypingContext()));
        ctx.inject('tsic.msg.UI.Behavior.NavDown', { Phase: 'Started' });
        ctx.expect(ctx.assert.truthy(ctx.doc.documentElement.hasAttribute('data-tsic-kbnav')));
    },
});

TSICTestHarness.register({
    name: 'Mods: gamepad nav is exempt from the typing guard (can step off an input)',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('search') && ctx.win.tsic && ctx.win.tsic.focus);
        modsFixture(ctx);
        ctx.mode('Gamepad');
        const search = ctx.doc.getElementById('search');
        search.focus();
        ctx.expect(ctx.assert.truthy(!ctx.win.tsic.focus.isTypingContext()));
        ctx.inject('tsic.msg.UI.Behavior.NavDown', { Phase: 'Started' });
        ctx.expect(ctx.assert.truthy(ctx.doc.activeElement !== search));
    },
});

TSICTestHarness.register({
    name: 'Mods: update progress marks the row downloading, done clears it',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('list-active'));
        modsFixture(ctx);
        await ctx.waitFor(() => ctx.doc.querySelector('#list-active .lib-row[data-mod-id="mod.a"]'));
        ctx.inject('tsic.msg.UI.Mod.UpdateProgress', { NameId: 'mod.a', State: 'downloading', Error: '' });
        const row = () => ctx.doc.querySelector('.lib-row[data-mod-id="mod.a"]');
        ctx.expect(ctx.assert.truthy(row().classList.contains('is-downloading')));
        // done plays a fill-to-100% + minimum-feedback beat before clearing.
        ctx.inject('tsic.msg.UI.Mod.UpdateProgress', { NameId: 'mod.a', State: 'done', Error: '' });
        ctx.expect(ctx.assert.truthy(row().classList.contains('is-downloading')));
        await ctx.waitFor(() => !row().classList.contains('is-downloading'), { timeout: 3000 });
        ctx.expect(ctx.assert.truthy(!row().classList.contains('is-downloading')));
    },
});

TSICTestHarness.register({
    name: 'Mods: download bar creeps up without sized progress and sweeps full on done',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('list-active'));
        modsFixture(ctx);
        await ctx.waitFor(() => ctx.doc.querySelector('.lib-row[data-mod-id="mod.a"]'));
        const fill = () => ctx.doc.querySelector('.lib-row[data-mod-id="mod.a"] .dl-fill');
        const width = () => parseFloat(fill().style.width) || 0;

        // No sized progress -> the simulated fill must visibly grow.
        ctx.inject('tsic.msg.UI.Mod.UpdateProgress', { NameId: 'mod.a', State: 'downloading', Progress: 0, Error: '' });
        await ctx.waitFor(() => width() > 0, { timeout: 2000 });
        const early = width();
        await ctx.waitFor(() => width() > early, { timeout: 2000 });

        // Real progress ahead of the creep takes over.
        ctx.inject('tsic.msg.UI.Mod.UpdateProgress', { NameId: 'mod.a', State: 'downloading', Progress: 0.5, Error: '' });
        ctx.expect(ctx.assert.truthy(width() >= 50));

        // done sweeps the fill to 100% and holds before clearing.
        ctx.inject('tsic.msg.UI.Mod.UpdateProgress', { NameId: 'mod.a', State: 'done', Error: '' });
        ctx.expect(ctx.assert.eq(fill().style.width, '100%'));
        await ctx.waitFor(() =>
            !ctx.doc.querySelector('.lib-row[data-mod-id="mod.a"]').classList.contains('is-downloading'),
            { timeout: 3000 });
    },
});

TSICTestHarness.register({
    name: 'Mods: a newly installed mod animates into the library list',
    file: '/screens/mods.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('list-inactive'));
        modsFixture(ctx);
        await ctx.waitFor(() => ctx.doc.querySelector('.lib-row[data-mod-id="mod.b"]'));
        // Fresh InstalledList lands with an extra mod — the install pipeline's
        // post-install broadcast. The new row must carry the entrance animation.
        ctx.inject('tsic.msg.UI.Mod.InstalledList', { Mods: [
            { ModId: 'com.chicogames.default', DisplayName: 'Base Game', Version: '1.0', bEnabled: true,  bLocked: true,  bShipped: true },
            { ModId: 'mod.a', DisplayName: 'Alpha Mod',   Version: '1.0', bEnabled: true,  bLocked: false, bShipped: false },
            { ModId: 'mod.b', DisplayName: 'Beta Mod',    Version: '2.0', bEnabled: false, bLocked: false, bShipped: false },
            { ModId: 'mod.s', DisplayName: 'Shipped Mod', Version: '1.0', bEnabled: false, bLocked: false, bShipped: true },
            { ModId: 'mod.new', DisplayName: 'Fresh Install', Version: '1.0', bEnabled: false, bLocked: false, bShipped: false },
        ] });
        const fresh = ctx.doc.querySelector('.lib-row[data-mod-id="mod.new"]');
        ctx.expect(ctx.assert.truthy(fresh));
        ctx.expect(ctx.assert.truthy(fresh.classList.contains('row-enter')));
        // Pre-existing rows must NOT replay the entrance.
        ctx.expect(ctx.assert.truthy(
            !ctx.doc.querySelector('.lib-row[data-mod-id="mod.b"]').classList.contains('row-enter')));
    },
});
