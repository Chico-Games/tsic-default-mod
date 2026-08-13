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
        await ctx.waitFor(() => ctx.doc.querySelector('button.tsic-dropdown[data-key="video.resolution"]'));
        ctx.expect(ctx.assert.eq(
            ctx.win.tsic.dropdown.get(ctx.doc.querySelector('button.tsic-dropdown[data-key="video.resolution"]')),
            '2560x1440'));
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

// ---- Graphics: NVIDIA upscaler / frame-gen / Reflex rows ----
// These run against the page's REAL static catalog (no injected Catalog), so they
// pin the shipped rows to the exact key/value vocabulary HandleCmdSettingsSet
// accepts. A mismatch here is invisible at runtime: C++ drops the unknown value
// and the control silently snaps back.

async function openGraphicsTab(ctx) {
    await ctx.waitFor(() => Array.from(ctx.doc.querySelectorAll('.tsic-tab')).some(b => b.textContent === 'Video'));
    Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(b => b.textContent === 'Video').click();
    await ctx.waitFor(() => ctx.doc.querySelector('button.tsic-dropdown[data-key="graphics.upscaler"]'));
}

TSICTestHarness.register({
    name: 'Settings: graphics tab exposes upscaler / render-scale / frame-gen / reflex rows',
    file: '/screens/settings.html',
    async run(ctx) {
        await openGraphicsTab(ctx);
        ctx.expect(ctx.assert.domExists(ctx.doc, 'button.tsic-dropdown[data-key="graphics.upscaler"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, 'input[type="range"][data-key="graphics.resolution_scale"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, 'button.tsic-dropdown[data-key="graphics.frame_gen"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '[data-key="graphics.fsr_frame_gen"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, 'button.tsic-dropdown[data-key="graphics.reflex"]'));
        // The int-era row is gone — C++ has no graphics.upscaler_quality handler.
        ctx.expect(ctx.doc.querySelector('[data-key="graphics.upscaler_quality"]')
            ? 'graphics.upscaler_quality has no C++ handler and must not be offered' : null);
        // 'native' is likewise rejected by the handler's allow-list.
        const opts = JSON.parse(ctx.doc.querySelector('button.tsic-dropdown[data-key="graphics.upscaler"]')
            .getAttribute('data-tsic-options')).map(o => o.Value || o.value);
        ctx.expect(opts.indexOf('native') === -1 ? null : '"native" is not in the C++ allow-list');
        for (const want of ['tsr', 'dlaa', 'dlss_quality', 'dlss_balanced', 'dlss_performance', 'dlss_ultra_performance',
                            'fsr_native_aa', 'fsr_quality', 'fsr_balanced', 'fsr_performance', 'fsr_ultra_performance']) {
            ctx.expect(opts.indexOf(want) !== -1 ? null : 'missing upscaler option ' + want);
        }
    },
});

TSICTestHarness.register({
    name: 'Settings: picking a DLSS mode publishes the exact C++ enum string',
    file: '/screens/settings.html',
    async run(ctx) {
        await openGraphicsTab(ctx);
        ctx.clearPublishes();
        ctx.win.tsic.dropdown.set(ctx.doc.querySelector('button.tsic-dropdown[data-key="graphics.upscaler"]'), 'dlss_balanced');
        // Deliberately deferred by a frame so the "Applying" overlay is composited before the
        // game thread stalls compiling DLSS shaders (#152) — see the ordering scenario below.
        await ctx.waitFor(() => ctx.publishes().some(p => p.channel === 'UI.Cmd.Settings.Set'),
            { timeout: 3000 });
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set',
            { where: p => p.Key === 'graphics.upscaler' && p.ValueJson === '"dlss_balanced"' }));
        // graphics.* is not a display-mode change — no keep/revert countdown.
        ctx.expect(ctx.doc.getElementById('settings-popover') ? 'graphics keys must not open the countdown' : null);
    },
});

TSICTestHarness.register({
    name: 'Settings: auto-detect button publishes graphics.autodetect as an action',
    file: '/screens/settings.html',
    async run(ctx) {
        await openGraphicsTab(ctx);
        // Action row, not a value row: it publishes UI.Cmd.Settings.Action and C++
        // echoes back every quality row the benchmark moved.
        const detect = Array.from(ctx.doc.querySelectorAll('#page button.tsic-button'))
            .find(b => b.textContent === 'Detect');
        ctx.expect(detect ? null : 'missing hardware auto-detect button');
        ctx.clearPublishes();
        detect.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Action',
            { where: p => p.Key === 'graphics.autodetect' }));
        // graphics.* is not a display-mode change — no keep/revert countdown.
        ctx.expect(ctx.doc.getElementById('settings-popover') ? 'auto-detect must not open the countdown' : null);
    },
});

TSICTestHarness.register({
    name: 'Settings: render-scale slider publishes graphics.resolution_scale',
    file: '/screens/settings.html',
    async run(ctx) {
        await openGraphicsTab(ctx);
        const slider = ctx.doc.querySelector('input[type="range"][data-key="graphics.resolution_scale"]');
        // Range must cover the old quality tiers (performance 50 .. ultra 100).
        ctx.expect(ctx.assert.eq(slider.min, '50'));
        ctx.expect(ctx.assert.eq(slider.max, '100'));
        ctx.clearPublishes();
        slider.value = '85';
        slider.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set',
            { where: p => p.Key === 'graphics.resolution_scale' && p.ValueJson === '85' }));
    },
});

TSICTestHarness.register({
    name: 'Settings: graphics.nvidia_caps prunes unsupported upscaler options and rows',
    file: '/screens/settings.html',
    async run(ctx) {
        await openGraphicsTab(ctx);
        ctx.inject('tsic.msg.UI.Settings.Value',
            { Key: 'graphics.nvidia_caps', ValueJson: '{"dlss":false,"frame_gen":false,"reflex":false,"fsr":false}' });
        // Frame-gen (both vendors) and Reflex rows go wholesale.
        await ctx.waitFor(() => !ctx.doc.querySelector('[data-key="graphics.frame_gen"]'));
        ctx.expect(ctx.doc.querySelector('[data-key="graphics.reflex"]')
            ? 'reflex row must be pruned when unsupported' : null);
        ctx.expect(ctx.doc.querySelector('[data-key="graphics.fsr_frame_gen"]')
            ? 'fsr frame-gen row must be pruned without the FSR plugin' : null);
        // The upscaler row stays, reduced to TSR — every GPU can run it.
        const dd = ctx.doc.querySelector('button.tsic-dropdown[data-key="graphics.upscaler"]');
        ctx.expect(dd ? null : 'upscaler row must survive: TSR works everywhere');
        const opts = JSON.parse(dd.getAttribute('data-tsic-options')).map(o => o.Value || o.value);
        ctx.expect(ctx.assert.eq(opts.length, 1));
        ctx.expect(ctx.assert.eq(opts[0], 'tsr'));
        // The render-scale row is not NVIDIA-gated.
        ctx.expect(ctx.assert.domExists(ctx.doc, 'input[type="range"][data-key="graphics.resolution_scale"]'));
    },
});

TSICTestHarness.register({
    name: 'Settings: video tab exposes quality preset, scalability, display and HDR rows',
    file: '/screens/settings.html',
    async run(ctx) {
        await openGraphicsTab(ctx);
        // Overall preset pins the C++ vocabulary; "custom" is echo-only but must
        // be present so a mixed state has a label to land on.
        const preset = ctx.doc.querySelector('button.tsic-dropdown[data-key="graphics.quality"]');
        ctx.expect(preset ? null : 'missing graphics.quality preset row');
        const presetOpts = JSON.parse(preset.getAttribute('data-tsic-options')).map(o => o.value);
        for (const want of ['low', 'medium', 'high', 'epic', 'custom']) {
            ctx.expect(presetOpts.indexOf(want) !== -1 ? null : 'missing preset option ' + want);
        }
        // Per-category scalability rows (GI/AA/resolution deliberately absent —
        // owned by the Lumen / upscaler rows).
        for (const cat of ['view_distance', 'shadows', 'textures', 'effects',
                           'post_processing', 'foliage', 'shading', 'reflections']) {
            const dd = ctx.doc.querySelector('button.tsic-dropdown[data-key="graphics.' + cat + '"]');
            ctx.expect(dd ? null : 'missing scalability row graphics.' + cat);
            const opts = JSON.parse(dd.getAttribute('data-tsic-options')).map(o => o.value);
            ctx.expect(ctx.assert.eq(opts.join(','), 'low,medium,high,epic'));
        }
        // Display rows.
        const wm = ctx.doc.querySelector('button.tsic-dropdown[data-key="video.window_mode"]');
        ctx.expect(wm ? null : 'missing video.window_mode row');
        ctx.expect(ctx.assert.eq(
            JSON.parse(wm.getAttribute('data-tsic-options')).map(o => o.value).join(','),
            'fullscreen,borderless,windowed'));
        ctx.expect(ctx.doc.querySelector('[data-key="video.fullscreen"]')
            ? 'video.fullscreen was replaced by video.window_mode and must not be offered' : null);
        ctx.expect(ctx.assert.domExists(ctx.doc, 'button.tsic-dropdown[data-key="graphics.fps_limit"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, 'input[type="range"][data-key="graphics.brightness"]'));
        const fpsOpts = JSON.parse(ctx.doc.querySelector('button.tsic-dropdown[data-key="graphics.fps_limit"]')
            .getAttribute('data-tsic-options')).map(o => o.value);
        ctx.expect(fpsOpts.indexOf('0') !== -1 ? null : 'fps_limit must offer Unlimited ("0")');
        // Toggles: motion blur + vsync render as field-toggles with no data-key,
        // so assert via their group rows' labels.
        const labels = Array.from(ctx.doc.querySelectorAll('#page .field > label')).map(l => l.textContent);
        ctx.expect(labels.indexOf('Motion blur') !== -1 ? null : 'missing motion blur toggle');
        ctx.expect(labels.indexOf('VSync') !== -1 ? null : 'missing VSync toggle');
        ctx.expect(labels.indexOf('HDR output') !== -1 ? null : 'missing HDR toggle');
    },
});

TSICTestHarness.register({
    name: 'Settings: window-mode pick publishes the C++ enum and opens the countdown',
    file: '/screens/settings.html',
    async run(ctx) {
        await openGraphicsTab(ctx);
        ctx.clearPublishes();
        ctx.win.tsic.dropdown.set(
            ctx.doc.querySelector('button.tsic-dropdown[data-key="video.window_mode"]'), 'windowed');
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set',
            { where: p => p.Key === 'video.window_mode' && p.ValueJson === '"windowed"' }));
        // video.* is a display-mode change — the keep/revert countdown must open.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#settings-popover'));
        ctx.doc.getElementById('popover-keep').click();
    },
});

TSICTestHarness.register({
    name: 'Settings: video.hdr_supported=false prunes the HDR row only',
    file: '/screens/settings.html',
    async run(ctx) {
        await openGraphicsTab(ctx);
        ctx.inject('tsic.msg.UI.Settings.Value', { Key: 'video.hdr_supported', ValueJson: 'false' });
        await ctx.waitFor(() => {
            const labels = Array.from(ctx.doc.querySelectorAll('#page .field > label')).map(l => l.textContent);
            return labels.indexOf('HDR output') === -1;
        });
        // Neighbours survive the prune.
        ctx.expect(ctx.assert.domExists(ctx.doc, 'button.tsic-dropdown[data-key="video.window_mode"]'));
        ctx.expect(ctx.assert.domExists(ctx.doc, 'button.tsic-dropdown[data-key="graphics.fps_limit"]'));
    },
});

TSICTestHarness.register({
    name: 'Settings: accessibility tab exposes motion-comfort and camera rows',
    file: '/screens/settings.html',
    async run(ctx) {
        await ctx.waitFor(() => Array.from(ctx.doc.querySelectorAll('.tsic-tab')).some(b => b.textContent === 'Accessibility'));
        Array.from(ctx.doc.querySelectorAll('.tsic-tab')).find(b => b.textContent === 'Accessibility').click();
        await ctx.waitFor(() => ctx.doc.querySelector('input[type="range"][data-key="gameplay.fov"]'));
        // Colorblind mode is deliberately absent — it drove Slate's colour-vision
        // filter, which has nothing to act on in a CEF/HTML UI, so it was removed
        // rather than shipped non-functional.
        ctx.expect(ctx.doc.querySelector('[data-key="accessibility.colorblind"]')
            ? 'colorblind was removed and must not reappear until it actually works' : null);

        // Motion & Comfort. gameplay.fov is a LIVE slider now: it shipped dead
        // once (the setter was never wired), so assert the control exists AND
        // that moving it publishes — a rendered row proves nothing on its own.
        const fov = ctx.doc.querySelector('input[type="range"][data-key="gameplay.fov"]');
        ctx.expect(fov ? null : 'missing gameplay.fov slider');
        ctx.expect(ctx.assert.eq(fov.min + '-' + fov.max, '60-120'));
        ctx.clearPublishes();
        fov.value = '105';
        fov.oninput();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set',
            { where: p => p.Key === 'gameplay.fov' && p.ValueJson === '105' }));

        const shake = ctx.doc.querySelector('input[type="range"][data-key="accessibility.shake_intensity"]');
        ctx.expect(shake ? null : 'missing accessibility.shake_intensity slider');
        ctx.expect(ctx.assert.eq(shake.min + '-' + shake.max, '0-100'));
        for (const key of ['accessibility.head_bob', 'accessibility.sprint_fov',
            'accessibility.motion_blur', 'accessibility.screen_pulse',
            'accessibility.reduce_motion', 'accessibility.sprint_vignette']) {
            ctx.expect(ctx.doc.querySelector('.field-toggle[data-key="' + key + '"]')
                ? null : 'missing ' + key + ' toggle');
        }

        // The one-click comfort preset is an action row, not a value row: it
        // publishes UI.Cmd.Settings.Action and C++ echoes every row it changed.
        const preset = Array.from(ctx.doc.querySelectorAll('#page button.tsic-button'))
            .find(b => b.textContent === 'Apply Reduce Motion');
        ctx.expect(preset ? null : 'missing Reduce Motion preset button');
        ctx.clearPublishes();
        preset.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Action',
            { where: p => p.Key === 'accessibility.reduce_motion_preset' }));

        // Accessibility keys apply instantly; only display-mode changes get the
        // keep/revert countdown, and nothing here can strand the player.
        ctx.expect(ctx.doc.getElementById('settings-popover') ? 'accessibility keys must not open the countdown' : null);
    },
});

TSICTestHarness.register({
    name: 'Settings: nvidia_caps pruning keeps already-received saved values',
    file: '/screens/settings.html',
    async run(ctx) {
        await openGraphicsTab(ctx);
        // Saved value lands first (sticky replay order is not guaranteed)...
        ctx.inject('tsic.msg.UI.Settings.Value', { Key: 'graphics.resolution_scale', ValueJson: '85' });
        await ctx.waitFor(() =>
            ctx.doc.querySelector('input[type="range"][data-key="graphics.resolution_scale"]').value === '85');
        // ...then the caps report forces a structural rebuild, which wipes
        // localState unless rebuildPreservingValues carries it across.
        ctx.inject('tsic.msg.UI.Settings.Value',
            { Key: 'graphics.nvidia_caps', ValueJson: '{"dlss":true,"frame_gen":false,"reflex":true}' });
        await ctx.waitFor(() => !ctx.doc.querySelector('[data-key="graphics.frame_gen"]'));
        ctx.expect(ctx.assert.eq(
            ctx.doc.querySelector('input[type="range"][data-key="graphics.resolution_scale"]').value, '85'));
        // A supported cap must not be pruned.
        ctx.expect(ctx.assert.domExists(ctx.doc, 'button.tsic-dropdown[data-key="graphics.reflex"]'));
    },
});

// ---- Motion & Comfort: the reduce-motion document flags ----------------
// shared/reduce-motion.js turns two settings into <html> attributes that CSS
// across the HUD and the menus keys off. It replaced prefers-reduced-motion,
// which CEF inherits from the host Windows session and which therefore froze
// menus for people who never asked for it — so the ONLY input is these keys.
TSICTestHarness.register({
    name: 'Settings/ReduceMotion: the game setting stamps the document flags',
    file: '/screens/settings.html',
    async run(ctx) {
        const html = ctx.doc.documentElement;
        await ctx.waitFor(() => ctx.win.TSIC && typeof ctx.win.TSIC.reduceMotion === 'function');

        // Nothing received yet: full motion, both flags clear.
        ctx.expect(html.hasAttribute('data-tsic-reduce-motion')
            ? 'reduce-motion must default off' : null);
        ctx.expect(html.hasAttribute('data-tsic-no-screen-pulse')
            ? 'screen-pulse must default on' : null);

        let observed = null;
        ctx.win.TSIC.onReduceMotion((on) => { observed = on; });
        ctx.expect(ctx.assert.eq(observed, false));

        ctx.inject('tsic.msg.UI.Settings.Value',
            { Key: 'accessibility.reduce_motion', ValueJson: 'true' });
        await ctx.waitFor(() => html.hasAttribute('data-tsic-reduce-motion'));
        ctx.expect(ctx.assert.eq(ctx.win.TSIC.reduceMotion(), true));
        // The JS-side subscribers (the store-maze backdrop) must hear it too —
        // a canvas rAF loop cannot be stopped from a stylesheet.
        ctx.expect(ctx.assert.eq(observed, true));

        // screen_pulse is inverted: the flag means "pulsing is OFF".
        ctx.inject('tsic.msg.UI.Settings.Value',
            { Key: 'accessibility.screen_pulse', ValueJson: 'false' });
        await ctx.waitFor(() => html.hasAttribute('data-tsic-no-screen-pulse'));
        ctx.inject('tsic.msg.UI.Settings.Value',
            { Key: 'accessibility.screen_pulse', ValueJson: 'true' });
        await ctx.waitFor(() => !html.hasAttribute('data-tsic-no-screen-pulse'));

        // Turning it back off has to clear the flag, or the setting is one-way.
        ctx.inject('tsic.msg.UI.Settings.Value',
            { Key: 'accessibility.reduce_motion', ValueJson: 'false' });
        await ctx.waitFor(() => !html.hasAttribute('data-tsic-reduce-motion'));
        ctx.expect(ctx.assert.eq(observed, false));
    },
});

// ---- Settings that freeze the game while they apply (#152) -----------------

TSICTestHarness.register({
    name: 'Settings: switching upscaler shows Applying BEFORE the change is published',
    file: '/screens/settings.html',
    async run(ctx) {
        // Picking a DLSS mode stalls the game thread for up to ~16s while NVIDIA JIT-compiles
        // the transformer cubins. A blocked game thread presents no frames, so the ORDER here
        // is the entire fix: if the overlay were shown in the same turn as the publish, it
        // would only be composited after the stall it exists to explain, and the player would
        // still be looking at a frozen game with no explanation.
        await openGraphicsTab(ctx);
        const dd = ctx.doc.querySelector('button.tsic-dropdown[data-key="graphics.upscaler"]');
        ctx.clearPublishes();

        ctx.win.tsic.dropdown.set(dd, 'dlss_quality');

        // Synchronously after the edit: overlay up, nothing published yet.
        const overlay = ctx.doc.getElementById('settings-applying');
        ctx.expect(ctx.assert.truthy(overlay && !overlay.hidden,
            'the applying overlay is up before anything is sent'));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Settings.Set'));
        ctx.expect(ctx.assert.truthy(
            /several seconds/i.test(ctx.doc.getElementById('settings-applying-msg').textContent),
            'it says why this takes a while'));

        // ...and the change does go out, once a frame carrying the overlay can have painted.
        await ctx.waitFor(() => ctx.publishes().some(p => p.channel === 'UI.Cmd.Settings.Set'
            && p.payload.Key === 'graphics.upscaler'), { timeout: 3000 });
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set',
            { where: p => p.Key === 'graphics.upscaler' && p.ValueJson.includes('dlss_quality') }));

        // It stays up across the stall — a publish returning proves nothing, the game thread
        // is blocked at that point — and comes down on the next message FROM C++, which can
        // only arrive once that thread is ticking again.
        ctx.expect(ctx.assert.truthy(!ctx.doc.getElementById('settings-applying').hidden,
            'still up while the game is applying'));
        ctx.inject('tsic.msg.UI.Settings.Value',
            { Key: 'graphics.upscaler', ValueJson: JSON.stringify('dlss_quality') });
        await ctx.waitFor(() => ctx.doc.getElementById('settings-applying').hidden, { timeout: 2000 });
    },
});

TSICTestHarness.register({
    name: 'Settings: an ordinary setting is not gated behind the applying overlay',
    file: '/screens/settings.html',
    async run(ctx) {
        // Only the two keys that genuinely stall pay this cost. A volume slider that waited a
        // frame per edit would be worse than the bug.
        await ctx.waitFor(() => ctx.doc.querySelector('input[type="range"]'), { timeout: 4000 });
        ctx.clearPublishes();
        const slider = ctx.doc.querySelector('input[type="range"]');
        slider.value = '0.4';
        slider.dispatchEvent(new ctx.win.Event('input', { bubbles: true }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set'));
        const overlay = ctx.doc.getElementById('settings-applying');
        ctx.expect(ctx.assert.truthy(!overlay || overlay.hidden,
            'no overlay for an instant setting'));
    },
});
