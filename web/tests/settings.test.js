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
        // Enum fields render as tsic-dropdown triggers, never native <select>
        // (CEF's native select popup misrenders under accelerated paint).
        ctx.expect(ctx.assert.domExists(ctx.doc, 'button.tsic-dropdown[data-tsic-options]'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('select').length, 0));
        ctx.expect(ctx.assert.eq(ctx.win.tsic.dropdown.get(ctx.doc.querySelector('button.tsic-dropdown')), 'Med'));
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

TSICTestHarness.register({
    name: 'Settings: UI.Settings.Value moves controls',
    file: '/screens/settings.html',
    async run(ctx) {
        // The page boots with its static catalog (Audio tab active, master at 0.8).
        await ctx.waitFor(() => ctx.doc.querySelector('input[type="range"]'));
        const slider = ctx.doc.querySelector('input[type="range"]');
        ctx.expect(ctx.assert.eq(slider.value, '0.8'));
        // Saved values arrive per key (sticky replay in-game). Rendered control
        // moves; a not-yet-rendered key (video tab) lands in state for later.
        ctx.inject('tsic.msg.UI.Settings.Value', { Key: 'audio.master', ValueJson: '0.23' });
        ctx.inject('tsic.msg.UI.Settings.Value', { Key: 'video.resolution', ValueJson: '"2560x1440"' });
        await ctx.waitFor(() => slider.value === '0.23');
        ctx.expect(ctx.doc.getElementById('settings-popover') ? 'saved values must not open the countdown' : null);
        // The video value applies when its tab first renders.
        Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(b => b.textContent === 'Video').click();
        await ctx.waitFor(() => ctx.doc.querySelector('button.tsic-dropdown'));
        ctx.expect(ctx.assert.eq(ctx.win.tsic.dropdown.get(ctx.doc.querySelector('button.tsic-dropdown')), '2560x1440'));
    },
});

// ---- Instant apply + video keep-countdown ----

const INSTANT_CATALOG = {
    Pages: [
        { Id: 'AudioCollection', Title: 'Audio', Groups: [{ Id: 'Audio', Title: 'Audio',
            Settings: [{ Key: 'audio.master', Label: 'Master', Type: 'range', Min: 0, Max: 1, Step: 0.05, Value: 0.5 }] }] },
        { Id: 'VideoCollection', Title: 'Video', Groups: [{ Id: 'Display', Title: 'Display',
            Settings: [{ Key: 'video.resolution', Label: 'Resolution', Type: 'enum',
                Options: [{Value:'1920x1080',Label:'1920x1080'},{Value:'2560x1440',Label:'2560x1440'}], Value: '1920x1080' }] }] },
    ],
    Footer: { RestartRequired: false },
};

async function openVideoTab(ctx) {
    ctx.inject('tsic.msg.UI.Settings.Catalog', { Json: JSON.stringify(INSTANT_CATALOG) });
    await ctx.waitFor(() => Array.from(ctx.doc.querySelectorAll('.tsic-tab')).some(b => b.textContent === 'Video'));
    Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(b => b.textContent === 'Video').click();
    await ctx.waitFor(() => ctx.doc.querySelector('button.tsic-dropdown'));
}

TSICTestHarness.register({
    name: 'Settings: audio edits apply instantly with no popover or action buttons',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', { Json: JSON.stringify(INSTANT_CATALOG) });
        await ctx.waitFor(() => ctx.doc.querySelector('input[type="range"]'));
        // The staged Apply/Revert pair is gone — settings are instant.
        ctx.expect(ctx.doc.getElementById('btn-apply') ? 'Apply button should not exist' : null);
        ctx.expect(ctx.doc.getElementById('btn-revert') ? 'Revert button should not exist' : null);
        ctx.clearPublishes();
        const slider = ctx.doc.querySelector('input[type="range"]');
        slider.value = '0.8';
        slider.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set',
            { where: p => p.Key === 'audio.master' && p.ValueJson === '0.8' }));
        ctx.expect(ctx.doc.getElementById('settings-popover') ? 'non-video keys must not open the countdown' : null);
    },
});

TSICTestHarness.register({
    name: 'Settings: video change applies instantly and opens the keep-countdown; Keep closes it',
    file: '/screens/settings.html',
    async run(ctx) {
        await openVideoTab(ctx);
        const dd = ctx.doc.querySelector('button.tsic-dropdown');
        ctx.clearPublishes();
        ctx.win.tsic.dropdown.set(dd, '2560x1440');
        // Instant apply: the change reaches C++ immediately...
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set',
            { where: p => p.Key === 'video.resolution' && p.ValueJson.includes('2560x1440') }));
        // ...and the keep/revert escape hatch opens at once.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#settings-popover'));
        ctx.expect(ctx.assert.domText(ctx.doc, '#popover-countdown', '10'));
        ctx.clearPublishes();
        ctx.doc.getElementById('popover-keep').click();
        ctx.expect(ctx.doc.getElementById('settings-popover') ? 'popover should close on Keep' : null);
        ctx.expect(ctx.publishes().some(p => p.channel === 'UI.Cmd.Settings.Set')
            ? 'Keep must not republish anything' : null);
    },
});

TSICTestHarness.register({
    name: 'Settings: keep-countdown ticks; Revert restores the pre-change value',
    file: '/screens/settings.html',
    async run(ctx) {
        await openVideoTab(ctx);
        const dd = ctx.doc.querySelector('button.tsic-dropdown');
        ctx.win.tsic.dropdown.set(dd, '2560x1440');
        await ctx.waitFor(() => ctx.doc.getElementById('popover-countdown'));
        // The countdown is a real timer — one tick moves 10 -> 9.
        await ctx.waitFor(() => ctx.doc.getElementById('popover-countdown').textContent === '9', { timeout: 2500 });
        ctx.clearPublishes();
        ctx.doc.getElementById('popover-revert').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set',
            { where: p => p.Key === 'video.resolution' && p.ValueJson.includes('1920x1080') }));
        ctx.expect(ctx.assert.eq(ctx.win.tsic.dropdown.get(dd), '1920x1080'));
        ctx.expect(ctx.doc.getElementById('settings-popover') ? 'popover should close on Revert' : null);
    },
});
