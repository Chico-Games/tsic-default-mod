TSICTestHarness.register({
    name: 'MainMenu: Start button publishes Menu.Navigate',
    file: '/screens/main-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        ctx.clearPublishes();
        const start = Array.from(ctx.doc.querySelectorAll('button')).find(b => /start|new/i.test(b.textContent || ''));
        ctx.expect(ctx.assert.truthy(start));
        start && start.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.Navigate', { where: p => /NewStore|Store/i.test(p.Screen || '') }));
    },
});

TSICTestHarness.register({
    name: 'NewStore: Durham Furniture is pinned first and preselected, Dev maps last',
    file: '/screens/new-store.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Menu.Layouts', { Layouts: [
            { LayoutId: 'DevBlankFloor',    DisplayName: 'DevBlankFloor',    ThumbnailUrl: '' },
            { LayoutId: 'Abandoned Mall',   DisplayName: 'Abandoned Mall',   ThumbnailUrl: '' },
            { LayoutId: 'Durham Furniture', DisplayName: 'Durham Furniture', ThumbnailUrl: '' },
        ]});
        await new Promise(r => setTimeout(r, 120));
        const dd = ctx.doc.getElementById('layout-dd');
        const opts = JSON.parse(dd.getAttribute('data-tsic-options') || '[]');
        ctx.expect(ctx.assert.eq(opts.map(o => o.value).join('|'),
            'Durham Furniture|Abandoned Mall|DevBlankFloor'));
        ctx.expect(ctx.assert.eq(dd.getAttribute('data-tsic-value'), 'Durham Furniture'));
    },
});

TSICTestHarness.register({
    name: 'MainMenu: Exit publishes Menu.Exit',
    file: '/screens/main-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('button'));
        ctx.clearPublishes();
        const exit = Array.from(ctx.doc.querySelectorAll('button')).find(b => /exit|quit/i.test(b.textContent || ''));
        ctx.expect(ctx.assert.truthy(exit));
        exit && exit.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.Exit'));
    },
});


TSICTestHarness.register({
    name: 'MenuStage: the paper wash is opaque from the FIRST paint, not once script runs',
    file: '/screens/settings.html',
    async run(ctx) {
        // REGRESSION (#150, report 23 — "one frame of the store"). The stage's cream wash
        // used to default to 0.35 in CSS and be corrected to 0.92 by store-maze-stage.js,
        // which is deferred AND polls for the maze module. Every menu page therefore painted
        // 65% see-through for several frames, and the game world behind CEF showed through on
        // every navigation between menus. A backdrop cannot be authored in a script that runs
        // after the backdrop is on screen, so the value lives in base.css now.
        const stage = ctx.doc.querySelector('.tsic-stage--magazine-gradient');
        ctx.expect(ctx.assert.truthy(stage, 'the settings page is built on the gradient stage'));
        const alpha = parseFloat(
            ctx.win.getComputedStyle(stage).getPropertyValue('--tsic-stage-paper-alpha'));
        ctx.expect(ctx.assert.truthy(alpha >= 0.9,
            'paper wash is near-opaque before any script touched it (got ' + alpha + ')'));
        // ...and it is CSS, not an inline style the script wrote.
        ctx.expect(ctx.assert.falsy(stage.style.getPropertyValue('--tsic-stage-paper-alpha'),
            'nothing sets the wash from script any more'));
    },
});

TSICTestHarness.register({
    name: 'MenuStage: the title screen stays fully solid',
    file: '/screens/main-menu.html',
    async run(ctx) {
        // The title screen is a backdrop, not an overlay — the menu level must never show
        // through it at all. data-paper-alpha="1" is an authored attribute, so it applies at
        // parse time like every other rule on the stage.
        const stage = ctx.doc.querySelector('.tsic-stage--magazine-gradient');
        ctx.expect(ctx.assert.eq(stage.getAttribute('data-paper-alpha'), '1'));
        ctx.expect(ctx.assert.eq(
            parseFloat(ctx.win.getComputedStyle(stage).getPropertyValue('--tsic-stage-paper-alpha')),
            1, 'solid'));
    },
});

// ── Boot splash (issue #226) ────────────────────────────────────────────────
//
// "add splash screen to hide loading at the start before the main menu". The
// title screen does not arrive finished — webfonts swap, the kicker line is
// replaced once the bridge is up, dev-only buttons appear — and the player
// watched it assemble. A cover hides that and lifts once.
//
// Structure is asserted on computed style rather than on a measured rect,
// deliberately: by the time a scenario runs the cover has usually already
// lifted (display:none, so every rect is zero), and an assertion that only
// passes before the lift would be a race. What matters is that the rules make
// it opaque and full-viewport whenever it IS shown.

TSICTestHarness.register({
    name: 'MainMenu/Boot: the splash is the first thing in the body and covers the viewport',
    file: '/screens/main-menu.html',
    async run(ctx) {
        const el = ctx.doc.getElementById('boot-splash');
        ctx.expect(ctx.assert.truthy(el, 'the boot splash exists'));
        if (!el) return;

        // First element in the body, so it is part of the FIRST paint rather than
        // something that appears after the stage below it has already laid out.
        ctx.expect(ctx.assert.eq(ctx.doc.body.firstElementChild.id, 'boot-splash',
            'the splash is the first element in the body'));

        const cs = ctx.win.getComputedStyle(el);
        ctx.expect(ctx.assert.eq(cs.position, 'fixed', 'splash is fixed'));
        for (const side of ['top', 'right', 'bottom', 'left']) {
            ctx.expect(ctx.assert.eq(cs[side], '0px', 'splash ' + side + ' is 0'));
        }
        // Opaque. A translucent cover would show the very assembly it exists to hide.
        const bg = cs.backgroundColor;
        ctx.expect(ctx.assert.truthy(/^rgb\(/.test(bg) && !/rgba\(/.test(bg),
            'splash background is fully opaque, got ' + bg));
        // Above the stage and the panel, which are the things it must cover.
        ctx.expect(ctx.assert.truthy(parseInt(cs.zIndex, 10) >= 100,
            'splash sits above the page, z-index ' + cs.zIndex));
    },
});

TSICTestHarness.register({
    name: 'MainMenu/Boot: the splash lifts once the page has settled',
    file: '/screens/main-menu.html',
    async run(ctx) {
        const el = ctx.doc.getElementById('boot-splash');
        ctx.expect(ctx.assert.truthy(el, 'the boot splash exists'));
        if (!el) return;
        // A cover that never lifts is worse than no cover. The page waits on fonts
        // plus the bridge, and caps itself at 3s; give that cap room and then some.
        try {
            await ctx.waitFor(() => el.hidden === true, { timeout: 5000 });
        } catch (e) {
            ctx.expect('the boot splash never lifted (still hidden=' + el.hidden
                + ', class="' + el.className + '")');
            return;
        }
        ctx.expect(ctx.assert.domHidden(ctx.doc, '#boot-splash'));
        // ...and the menu underneath is the thing now on screen.
        ctx.expect(ctx.assert.domExists(ctx.doc, '#btn-start'));
    },
});

// ── Shader precompile gate (issue #230) ─────────────────────────────────────
//
// UScpShaderPrecompileSubsystem drains the bundled PSO cache at "Fast" batching
// while the front end is up. Starting a game before it finishes carries the
// per-frame compile budget into gameplay, which is the first-run stutter the
// issue is about. New Game is held until the bridge says precompilation is done.
//
// The contract asserted here is the one C++ has to publish:
//   tsic.msg.UI.Shaders.Progress { bPrecompiling: bool, Progress: 0..1,
//                                  Remaining: int, ElapsedSeconds: float }
// sticky, so the menu resolves as soon as it subscribes whichever order they boot in.

function shaderMsg(on, progress) {
    return { bPrecompiling: on, Progress: progress, Remaining: on ? 1000 : 0, ElapsedSeconds: 1.5 };
}

TSICTestHarness.register({
    name: 'MainMenu/Shaders: New Game is held while the PSO cache is compiling',
    file: '/screens/main-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('btn-start'));
        const start = ctx.doc.getElementById('btn-start');

        // No message yet: a build with no cache, or a machine already finished,
        // must get exactly the menu it gets today.
        ctx.expect(ctx.assert.falsy(start.disabled, 'New Game is live before any shader message'));

        ctx.inject('tsic.msg.UI.Shaders.Progress', shaderMsg(true, 0.42));
        await ctx.waitFor(() => start.disabled === true, { timeout: 2000 });
        ctx.expect(ctx.assert.eq(start.getAttribute('data-shader-gate'), 'on', 'gate is showing'));
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('shader-gate-pct').textContent, '42%',
            'the bar reports the real progress'));
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('shader-gate-fill').style.width, '42%',
            'the fill matches'));

        // Clicking a held row must not start a game.
        ctx.clearPublishes();
        start.click();
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Menu.Navigate'));

        ctx.inject('tsic.msg.UI.Shaders.Progress', shaderMsg(false, 1));
        await ctx.waitFor(() => start.disabled === false, { timeout: 2000 });
        ctx.expect(ctx.assert.falsy(start.hasAttribute('data-shader-gate'), 'gate is gone'));

        ctx.clearPublishes();
        start.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Menu.Navigate',
            { where: p => /NewStore|Store/i.test(p.Screen || '') }));
    },
});

TSICTestHarness.register({
    name: 'MainMenu/Shaders: the gate does not move the menu rows',
    file: '/screens/main-menu.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.getElementById('btn-start'));
        const rects = () => Array.from(ctx.doc.querySelectorAll('.tsic-cover-rows .tsic-row-button'))
            .map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; });

        await new Promise(r => setTimeout(r, 120));
        const before = JSON.stringify(rects());

        // Every state the gate can be in, including the widest caption.
        ctx.inject('tsic.msg.UI.Shaders.Progress', shaderMsg(true, 0));
        await new Promise(r => setTimeout(r, 140));
        ctx.expect(ctx.assert.eq(JSON.stringify(rects()), before, 'rows held their boxes at 0%'));

        ctx.inject('tsic.msg.UI.Shaders.Progress', shaderMsg(true, 1));
        await new Promise(r => setTimeout(r, 140));
        ctx.expect(ctx.assert.eq(JSON.stringify(rects()), before, 'rows held their boxes at 100%'));

        ctx.inject('tsic.msg.UI.Shaders.Progress', shaderMsg(false, 1));
        await new Promise(r => setTimeout(r, 140));
        ctx.expect(ctx.assert.eq(JSON.stringify(rects()), before, 'rows held their boxes once the gate lifted'));
    },
});
