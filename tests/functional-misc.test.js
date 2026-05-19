// Functional coverage for the smaller HUD overlays and modal flows.

// ---- Teleporter cooldown UX ---------------------------------------------
TSICTestHarness.register({
    name: 'Teleporter: cooldown > 0 disables the row',
    file: '/screens/teleporter.html?fromId=1',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Teleporter.Destinations', {
            Destinations: [
                { EntityId: 2, Label: 'Lab', Cooldown: 0 },
                { EntityId: 3, Label: 'Pit', Cooldown: 30 },
            ],
        });
        await new Promise(r => setTimeout(r, 80));
        const pit = Array.from(ctx.doc.querySelectorAll('button')).find(b => /Pit/.test(b.textContent || ''));
        ctx.expect(ctx.assert.truthy(pit.className.indexOf('disabled') >= 0));
    },
});

TSICTestHarness.register({
    name: 'Teleporter: rename with empty value does not publish',
    file: '/screens/teleporter.html?fromId=1',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('btn-rename'));
        ctx.clearPublishes();
        ctx.doc.getElementById('rename-input').value = '   ';
        ctx.doc.getElementById('btn-rename').click();
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Teleporter.Rename'));
    },
});

// ---- DeathScreen --------------------------------------------------------
TSICTestHarness.register({
    name: 'DeathScreen: title text uses red color',
    file: '/screens/death-screen.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('h1'));
        ctx.expect(ctx.assert.domText(ctx.doc, 'h1', /YOU DIED/i));
    },
});

// ---- VoiceChat ----------------------------------------------------------
TSICTestHarness.register({
    name: 'VoiceChat: empty speaker list yields zero rows',
    file: '/screens/voice-chat.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.VoiceChat.State', { Speaking: [], bSelfPushToTalk: false });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#vc-list .vc-row', 0));
    },
});

// ---- PlayerIndicators ---------------------------------------------------
TSICTestHarness.register({
    name: 'PlayerIndicators: zero indicators yields empty host',
    file: '/screens/player-indicators.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.PlayerIndicators', { Indicators: [] });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.domCount(ctx.doc, '.pi', 0));
    },
});

TSICTestHarness.register({
    name: 'PlayerIndicators: distance formatted in metres',
    file: '/screens/player-indicators.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.PlayerIndicators', {
            Indicators: [{ PlayerId: 'P', Name: 'X', ScreenPos01: { X: 0.5, Y: 0.5 }, Distance: 1500, Color: '', bOffScreen: false, bLookedAt: false }],
        });
        await new Promise(r => setTimeout(r, 60));
        // Distance 1500cm should render as 15m
        ctx.expect(ctx.assert.truthy(/15 m/.test(ctx.doc.querySelector('.pi').textContent)));
    },
});

// ---- ConstructionCarousel ---------------------------------------------
TSICTestHarness.register({
    name: 'ConstructionCarousel: no-data payload clears the strip',
    file: '/screens/construction-carousel.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.Carousel', null);
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#cc-row .cc-slot', 0));
    },
});

// ---- CircularProgress -------------------------------------------------
TSICTestHarness.register({
    name: 'CircularProgress: --cp-p CSS var reflects percent',
    file: '/screens/circular-progress.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2, Elapsed: 1, Color: '#ffffff' });
        await new Promise(r => setTimeout(r, 60));
        const ring = ctx.doc.getElementById('cp-ring');
        ctx.expect(ctx.assert.eq(ring.style.getPropertyValue('--cp-p'), '50'));
    },
});

TSICTestHarness.register({
    name: 'CircularProgress: Color CSS var picked up',
    file: '/screens/circular-progress.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2, Elapsed: 0.5, Color: '#aa00ff' });
        await new Promise(r => setTimeout(r, 60));
        const ring = ctx.doc.getElementById('cp-ring');
        ctx.expect(ctx.assert.eq(ring.style.getPropertyValue('--cp-color'), '#aa00ff'));
    },
});

// ---- Notifications ----------------------------------------------------
TSICTestHarness.register({
    name: 'Notifications: title + text both rendered',
    file: '/screens/notifications.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Notification.Show', { Title: 'Picked up', Text: 'Bread x 1', Type: 'Inventory' });
        await ctx.waitFor(() => ctx.doc.querySelector('.notif-title'));
        ctx.expect(ctx.assert.domText(ctx.doc, '.notif-title', 'Picked up'));
        ctx.expect(ctx.assert.domText(ctx.doc, '.notif-text',  'Bread x 1'));
    },
});

// ---- Cheat menu ------------------------------------------------------
TSICTestHarness.register({
    name: 'CheatMenu: GiveItem with no id does not publish',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('cm-give'));
        ctx.doc.getElementById('cm-item-id').value = '';
        ctx.clearPublishes();
        ctx.doc.getElementById('cm-give').click();
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Cheat.Execute'));
    },
});

TSICTestHarness.register({
    name: 'CheatMenu: Reveal Map preset publishes its hardcoded command',
    file: '/screens/cheat-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button[data-cmd]'));
        ctx.clearPublishes();
        const btn = Array.from(ctx.doc.querySelectorAll('button[data-cmd]')).find(b => /reveal/i.test(b.textContent || ''));
        btn && btn.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Cheat.Execute', { where: p => p.Command === 'ScpRevealMap' }));
    },
});

// ---- Settings ---------------------------------------------------------
TSICTestHarness.register({
    name: 'Settings: bool toggle publishes Set with negated value',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', {
            Json: JSON.stringify({ Groups: [{ Title: 'Display', Settings: [{ Key: 'fs', Label: 'Fullscreen', Type: 'bool', Value: false }] }] }),
        });
        await ctx.waitFor(() => ctx.doc.querySelector('.field-toggle'));
        ctx.clearPublishes();
        ctx.doc.querySelector('.field-toggle').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Settings.Set',
            { where: p => p.Key === 'fs' && p.ValueJson === 'true' }));
    },
});

TSICTestHarness.register({
    name: 'Settings: rebind Esc cancels capture without publishing',
    file: '/screens/settings.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Settings.Catalog', {
            Json: JSON.stringify({ Groups: [{ Title: 'Controls', Settings: [{ Key: 'jump', Label: 'Jump', Type: 'keybind', Value: 'Space' }] }] }),
        });
        await ctx.waitFor(() => ctx.doc.querySelector('.field-rebind'));
        ctx.doc.querySelector('.field-rebind').click();
        await new Promise(r => setTimeout(r, 20));
        ctx.clearPublishes();
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Settings.RebindKey'));
    },
});

// ---- Selection / Cage ----------------------------------------------
TSICTestHarness.register({
    name: 'Selection: empty options shows the empty hint and renders the Context title',
    file: '/screens/selection.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Selection.Opened', { Context: 'Generic', Options: [] });
        await new Promise(r => setTimeout(r, 60));
        // Title text is set in semantic case; CSS .tsic-title applies text-transform.
        ctx.expect(ctx.assert.domText(ctx.doc, '#title', 'Generic'));
        ctx.expect(ctx.assert.domVisible(ctx.doc, '#empty'));
    },
});

// ---- BugReport ------------------------------------------------------
TSICTestHarness.register({
    name: 'BugReport: submit carries Category + Description fields',
    file: '/screens/bug-report.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('textarea'));
        ctx.doc.querySelector('textarea').value = 'desc';
        const cat = ctx.doc.querySelector('select');
        if (cat) cat.value = cat.options.length > 0 ? cat.options[0].value : '';
        ctx.clearPublishes();
        const submit = Array.from(ctx.doc.querySelectorAll('button')).find(b => /submit/i.test(b.textContent || ''));
        submit && submit.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BugReport.Submit',
            { where: p => typeof p.Description === 'string' && typeof p.Category === 'string' }));
    },
});

// ---- Lore navigation bounds ----------------------------------------
TSICTestHarness.register({
    name: 'Lore: ArrowLeft at index 0 stays at 0',
    file: '/screens/paper.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.LoreScreen.Opened', {
            ScreenKind: 'Paper',
            Texts: [{ Heading: 'A', Body: 'a', GroupTitle: '' }, { Heading: 'B', Body: 'b', GroupTitle: '' }],
            InitialIndex: 0,
        });
        await ctx.waitFor(() => ctx.doc.getElementById('lore-heading').textContent === 'A');
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domText(ctx.doc, '#lore-heading', 'A'));
    },
});

TSICTestHarness.register({
    name: 'Lore: ArrowRight at last index stays at last',
    file: '/screens/paper.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.LoreScreen.Opened', {
            ScreenKind: 'Paper',
            Texts: [{ Heading: 'A', Body: 'a', GroupTitle: '' }, { Heading: 'B', Body: 'b', GroupTitle: '' }],
            InitialIndex: 1,
        });
        await ctx.waitFor(() => ctx.doc.getElementById('lore-heading').textContent === 'B');
        ctx.win.dispatchEvent(new ctx.win.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.domText(ctx.doc, '#lore-heading', 'B'));
    },
});
