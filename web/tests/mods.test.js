// Mods screen — two-column library (Stockroom = inactive, Shop Floor = active).
// Column moves publish UI.Cmd.Mod.SetEnabled; the active column owns load order.

function modsFixture(ctx) {
    ctx.inject('tsic.msg.UI.Mod.InstalledList', { Mods: [
        { ModId: 'com.chicogames.default', DisplayName: 'Base Game', Version: '1.0', bEnabled: true,  bLocked: true },
        { ModId: 'mod.a', DisplayName: 'Alpha Mod', Version: '1.0', bEnabled: true,  bLocked: false },
        { ModId: 'mod.b', DisplayName: 'Beta Mod',  Version: '2.0', bEnabled: false, bLocked: false },
    ] });
    ctx.inject('tsic.msg.UI.Mod.LoadOrder', { Order: ['com.chicogames.default', 'mod.a', 'mod.b'] });
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
        ctx.expect(ctx.assert.eq(rowIds(ctx, 'list-inactive').join(','), 'mod.b'));
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('count-active').textContent, '2'));
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('count-inactive').textContent, '1'));
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
                && p.Order.join(',') === 'mod.a,com.chicogames.default,mod.b' }));
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
        ctx.expect(ctx.assert.truthy(locked.querySelector('.btn-uninstall').disabled));
        for (const step of locked.querySelectorAll('.btn-step')) {
            ctx.expect(ctx.assert.truthy(step.disabled));
        }
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
        ctx.inject('tsic.msg.UI.Mod.UpdateProgress', { NameId: 'mod.a', State: 'done', Error: '' });
        ctx.expect(ctx.assert.truthy(!row().classList.contains('is-downloading')));
    },
});
