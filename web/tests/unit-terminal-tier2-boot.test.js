// Integration test: tier-2 shell plays a boot splash on mount, then dismisses it
// and defers autoRun until boot completes. Drives create() directly with a fake
// host (cf. the shared engine's host contract).
TSICTestHarness.register({
    name: 'Unit/Terminal/Tier2Boot: splash overlay shows then dismisses',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const win = ctx.win, T = win.TSICTerminal;
        T.shells.tier2.instantBoot = true;
        const c = win.document.createElement('div');
        win.document.body.appendChild(c);
        const host = {
            tier: 2, autoRun: null,
            run: function () { return Promise.resolve({ ok: true }); },
            close: function () {}, publish: function () {},
        };
        const api = T.shells.tier2.create(c, host);
        ctx.expect(ctx.assert.truthy(c.querySelector('.t2-boot'), 'boot overlay present at mount'));
        await api.whenBooted;
        const ov = c.querySelector('.t2-boot');
        ctx.expect(ctx.assert.truthy(!ov || ov.classList.contains('is-done'), 'overlay dismissed after boot'));
        api.destroy();
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal/Tier2Boot: autoRun launches only after boot completes',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const win = ctx.win, T = win.TSICTerminal;
        T.shells.tier2.instantBoot = true;
        const c = win.document.createElement('div');
        win.document.body.appendChild(c);
        const runCalls = [];
        const host = {
            tier: 2, autoRun: 'X',
            run: function (id) { runCalls.push(id); return Promise.resolve({ ok: true }); },
            close: function () {}, publish: function () {},
        };
        const api = T.shells.tier2.create(c, host);
        ctx.expect(ctx.assert.eq(runCalls.length, 0));   // not launched during the synchronous mount
        await api.whenBooted;
        ctx.expect(ctx.assert.truthy(runCalls.indexOf('X') !== -1, 'autoRun launched after boot'));
        api.destroy();
    },
});
