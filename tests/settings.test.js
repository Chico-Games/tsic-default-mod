TSICTestHarness.register({
    name: 'Settings: renders catalog groups inside active page',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', {
            Json: JSON.stringify({
                Pages: [{
                    Id: 'VideoCollection',
                    Title: 'Video',
                    Groups: [{
                        Id: 'DisplayGroup',
                        Title: 'Display',
                        Settings: [
                            { Key: 'fov', Label: 'Field of View', Type: 'range', Min: 60, Max: 120, Step: 1, Value: 90 },
                            { Key: 'vsync', Label: 'V-Sync', Type: 'bool', Value: true },
                            { Key: 'preset', Label: 'Preset', Type: 'enum',
                              Options: [{Value:'Low',Label:'Low'},{Value:'Med',Label:'Med'},{Value:'High',Label:'High'}], Value: 'Med' },
                        ],
                    }],
                }],
                Footer: { AnyDirty: false, RestartRequired: false, ApplyCountdownSeconds: -1 },
            }),
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.group').length >= 1);
        ctx.expect(ctx.assert.domText(ctx.doc, '.group h3', 'Display'));
        ctx.expect(ctx.assert.domExists(ctx.doc, 'input[type="range"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '.field-toggle'));
        ctx.expect(ctx.assert.domExists(ctx.doc, 'select'));
    },
});

TSICTestHarness.register({
    name: 'Settings: slider change publishes UI.Cmd.Settings.Set',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', {
            Json: JSON.stringify({
                Pages: [{ Id: 'AudioCollection', Title: 'Audio', Groups: [{ Id: 'Audio', Title: 'Audio',
                    Settings: [{ Key: 'master', Label: 'Master', Type: 'range', Min: 0, Max: 1, Step: 0.05, Value: 0.5 }] }] }],
                Footer: {},
            }),
        });
        await ctx.waitFor(() => ctx.doc.querySelector('input[type="range"]'));
        ctx.clearPublishes();
        const slider = ctx.doc.querySelector('input[type="range"]');
        slider.value = '0.8';
        slider.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set', { where: p => p.Key === 'master' }));
    },
});
