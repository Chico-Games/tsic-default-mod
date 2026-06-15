TSICTestHarness.register({
    name: 'Settings: renders tab strip with one button per page',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', {
            Json: JSON.stringify({
                Pages: [
                    { Id: 'VideoCollection', Title: 'Video', Groups: [{ Id: 'V', Title: 'V',
                        Settings: [{ Key: 'fov', Label: 'FOV', Type: 'range', Min: 60, Max: 120, Step: 1, Value: 90 }] }] },
                    { Id: 'AudioCollection', Title: 'Audio', Groups: [{ Id: 'A', Title: 'A',
                        Settings: [{ Key: 'master', Label: 'Master', Type: 'range', Min: 0, Max: 1, Step: 0.05, Value: 0.5 }] }] },
                ],
                Footer: {},
            }),
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.tsic-tab').length >= 2);
        const tabs = Array.from(ctx.doc.querySelectorAll('.tsic-tab'));
        ctx.expect(tabs.length === 2 ? null : `expected 2 tabs, got ${tabs.length}`);
        ctx.expect(tabs[0].classList.contains('is-active') ? null : 'first tab should be active by default');
    },
});

TSICTestHarness.register({
    name: 'Settings: clicking a tab switches the visible page',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', {
            Json: JSON.stringify({
                Pages: [
                    { Id: 'VideoCollection', Title: 'Video', Groups: [{ Id: 'V', Title: 'Display',
                        Settings: [{ Key: 'fov', Label: 'FOV', Type: 'range', Min: 60, Max: 120, Step: 1, Value: 90 }] }] },
                    { Id: 'AudioCollection', Title: 'Audio', Groups: [{ Id: 'A', Title: 'Mix',
                        Settings: [{ Key: 'master', Label: 'Master', Type: 'range', Min: 0, Max: 1, Step: 0.05, Value: 0.5 }] }] },
                ],
                Footer: {},
            }),
        });
        await ctx.waitFor(() => ctx.doc.querySelector('.tsic-tab'));
        ctx.expect(ctx.assert.domText(ctx.doc, '.group h3', 'Display'));
        const audioTab = Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(b => b.textContent === 'Audio');
        audioTab.click();
        await ctx.waitFor(() => {
            const h = ctx.doc.querySelector('.group h3');
            return h && h.textContent === 'Mix';
        });
        ctx.expect(ctx.assert.domText(ctx.doc, '.group h3', 'Mix'));
    },
});

TSICTestHarness.register({
    name: 'Settings: footer shows restart-required when set',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', {
            Json: JSON.stringify({
                Pages: [{ Id: 'V', Title: 'V', Groups: [{ Id: 'V', Title: 'V',
                    Settings: [{ Key: 'k', Label: 'K', Type: 'bool', Value: false }] }] }],
                Footer: { bAnyDirty: true, bRestartRequired: true, ApplyCountdownSeconds: -1 },
            }),
        });
        await ctx.waitFor(() => {
            const el = ctx.doc.getElementById('restart-required');
            return el && !el.hidden;
        });
        const el = ctx.doc.getElementById('restart-required');
        ctx.expect(el && !el.hidden ? null : 'restart-required should be visible');
    },
});

TSICTestHarness.register({
    name: 'Settings: Reset to Defaults publishes UI.Cmd.Settings.ResetDefaults with PageId',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', {
            Json: JSON.stringify({
                Pages: [{ Id: 'VideoCollection', Title: 'Video', Groups: [{ Id: 'V', Title: 'V',
                    Settings: [{ Key: 'k', Label: 'K', Type: 'bool', Value: false }] }] }],
                Footer: {},
            }),
        });
        await ctx.waitFor(() => ctx.doc.getElementById('btn-reset'));
        ctx.clearPublishes();
        ctx.doc.getElementById('btn-reset').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.ResetDefaults',
            { where: p => p.PageId === 'VideoCollection' }));
    },
});
