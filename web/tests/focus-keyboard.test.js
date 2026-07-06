// Keyboard navigation in MouseAndKeyboard mode — the engine stays dormant
// for mouse users until an arrow key (UI.Behavior.Nav*) is pressed, then
// drives focus exactly like gamepad: spatial steps, visible ring via
// html[data-tsic-kbnav], Accept clicks, Back pops modal scopes. Mouse
// activity disengages it and hands highlighting back to :hover.

TSICTestHarness.register({
    name: 'Focus/Keyboard: arrow press in KBM engages kbnav and focuses initial',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        ctx.focus.disableSmoothScroll();
        ctx.focus.resetMemory();
        ctx.inject('tsic.msg.UI.Players.List', { Players: [] });
        ctx.mode('MouseAndKeyboard');
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.truthy(
            !ctx.doc.documentElement.hasAttribute('data-tsic-kbnav'),
            'kbnav must NOT be engaged before any nav keypress'));
        ctx.inject('tsic.msg.UI.Behavior.NavDown', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(
            ctx.doc.documentElement.hasAttribute('data-tsic-kbnav'),
            'first nav keypress should stamp data-tsic-kbnav on <html>'));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'btn-resume',
            'first nav keypress should land on the initial-focus element'));
        ctx.expect(ctx.assert.truthy(
            ctx.doc.activeElement.hasAttribute('data-tsic-focused'),
            'focused element should carry the ring marker'));
    },
    tags: ['focus', 'keyboard'],
});

TSICTestHarness.register({
    name: 'Focus/Keyboard: subsequent arrows navigate spatially',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        ctx.focus.disableSmoothScroll();
        ctx.focus.resetMemory();
        ctx.inject('tsic.msg.UI.Players.List', { Players: [] });
        ctx.mode('MouseAndKeyboard');
        await new Promise(r => setTimeout(r, 60));
        ctx.inject('tsic.msg.UI.Behavior.NavDown', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'btn-resume'));
        ctx.inject('tsic.msg.UI.Behavior.NavDown', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        const a = ctx.doc.activeElement;
        ctx.expect(ctx.assert.truthy(a && a.id !== 'btn-resume',
            'second down-press should move focus off the initial element; still on ' + (a && a.id)));
    },
    tags: ['focus', 'keyboard'],
});

TSICTestHarness.register({
    name: 'Focus/Keyboard: Accept clicks the keyboard-focused element',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        ctx.focus.disableSmoothScroll();
        ctx.focus.resetMemory();
        ctx.inject('tsic.msg.UI.Players.List', { Players: [] });
        ctx.mode('MouseAndKeyboard');
        await new Promise(r => setTimeout(r, 60));
        ctx.inject('tsic.msg.UI.Behavior.NavDown', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'btn-resume'));
        ctx.clearPublishes();
        ctx.inject('tsic.msg.UI.Behavior.Accept', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
    tags: ['focus', 'keyboard'],
});

TSICTestHarness.register({
    name: 'Focus/Keyboard: Accept before any nav keypress is inert in KBM',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        ctx.focus.disableSmoothScroll();
        ctx.focus.resetMemory();
        ctx.inject('tsic.msg.UI.Players.List', { Players: [] });
        ctx.mode('MouseAndKeyboard');
        await new Promise(r => setTimeout(r, 60));
        ctx.clearPublishes();
        ctx.inject('tsic.msg.UI.Behavior.Accept', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
    tags: ['focus', 'keyboard'],
});

TSICTestHarness.register({
    name: 'Focus/Keyboard: mouse movement disengages, arrows re-engage from same spot',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        ctx.focus.disableSmoothScroll();
        ctx.focus.resetMemory();
        ctx.inject('tsic.msg.UI.Players.List', { Players: [] });
        ctx.mode('MouseAndKeyboard');
        await new Promise(r => setTimeout(r, 60));
        ctx.inject('tsic.msg.UI.Behavior.NavDown', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(ctx.doc.documentElement.hasAttribute('data-tsic-kbnav')));
        // Two mousemoves at different coordinates = real motion.
        ctx.doc.dispatchEvent(new ctx.win.MouseEvent('mousemove', { clientX: 10, clientY: 10, bubbles: true }));
        ctx.doc.dispatchEvent(new ctx.win.MouseEvent('mousemove', { clientX: 40, clientY: 40, bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(
            !ctx.doc.documentElement.hasAttribute('data-tsic-kbnav'),
            'mouse movement should disengage keyboard-nav'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('[data-tsic-focused]').length, 0,
            'ring markers should clear on disengage'));
        // DOM focus is left alone, so the next arrow resumes from there.
        ctx.expect(ctx.assert.eq(ctx.doc.activeElement.id, 'btn-resume',
            'DOM focus should survive disengage'));
        ctx.inject('tsic.msg.UI.Behavior.NavUp', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(
            ctx.doc.documentElement.hasAttribute('data-tsic-kbnav'),
            'arrow press should re-engage keyboard-nav'));
    },
    tags: ['focus', 'keyboard'],
});

TSICTestHarness.register({
    name: 'Focus/Keyboard: Back pops an open scope without closing the screen',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        ctx.focus.disableSmoothScroll();
        ctx.focus.resetMemory();
        ctx.inject('tsic.msg.UI.Players.List', { Players: [] });
        ctx.mode('MouseAndKeyboard');
        await new Promise(r => setTimeout(r, 60));
        ctx.inject('tsic.msg.UI.Behavior.NavDown', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        // Simulate a dropdown: a portal with one option, pushed as a scope.
        const portal = ctx.doc.createElement('div');
        const opt = ctx.doc.createElement('button');
        opt.textContent = 'Option';
        portal.appendChild(opt);
        ctx.doc.body.appendChild(portal);
        ctx.win.tsic.focus.pushScope(portal, opt);
        ctx.expect(ctx.assert.eq(ctx.win.tsic.focus.snapshot().scope, 1));
        ctx.clearPublishes();
        ctx.inject('tsic.msg.UI.Behavior.Back', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.eq(ctx.win.tsic.focus.snapshot().scope, 0,
            'Back should pop the scope'));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Pause.Resume'));
        // With no scope open, the next Back closes the screen as usual.
        ctx.inject('tsic.msg.UI.Behavior.Back', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
    tags: ['focus', 'keyboard'],
});

TSICTestHarness.register({
    name: 'Focus/Keyboard: every focus-enabled page declares an input-mode tag',
    file: '/screens/main-menu.html',
    async run(ctx) {
        // A page that opts into the focus engine but never appends an
        // input-mode tag gets NO input situation in-game, so UI.Behavior.*
        // (nav/accept/back) never fire there — the engine is dead weight.
        // main-menu.html shipped with exactly this bug; assert it stays fixed.
        const focusMeta = ctx.doc.querySelector('meta[name="tsic-focus"]');
        const modeMeta = ctx.doc.querySelector('meta[name="tsic-input-mode"]');
        ctx.expect(ctx.assert.truthy(focusMeta, 'main-menu should opt into the focus engine'));
        ctx.expect(ctx.assert.truthy(modeMeta && (modeMeta.getAttribute('content') || '').length > 0,
            'main-menu must declare tsic-input-mode or no input situation is active in-game'));
    },
    tags: ['focus', 'keyboard'],
});

TSICTestHarness.register({
    name: 'Focus/Keyboard: switching to Gamepad clears the kbnav attribute',
    file: '/screens/pause-menu.html',
    async run(ctx) {
        ctx.focus.disableSmoothScroll();
        ctx.focus.resetMemory();
        ctx.inject('tsic.msg.UI.Players.List', { Players: [] });
        ctx.mode('MouseAndKeyboard');
        await new Promise(r => setTimeout(r, 60));
        ctx.inject('tsic.msg.UI.Behavior.NavDown', { Phase: 'Started' });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(ctx.doc.documentElement.hasAttribute('data-tsic-kbnav')));
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.truthy(
            !ctx.doc.documentElement.hasAttribute('data-tsic-kbnav'),
            'Gamepad mode should clear kbnav — its ring is gated on data-tsic-input'));
    },
    tags: ['focus', 'keyboard'],
});
