// Integration test: tier-3 shell plays the SCiPnet hijack boot on mount, then
// dismisses the overlay and brings the topology online.
TSICTestHarness.register({
    name: 'Unit/Terminal/Tier3Boot: hijack overlay then topology online',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const win = ctx.win, T = win.TSICTerminal;
        T.shells.tier3.instantBoot = true;
        const c = win.document.createElement('div');
        win.document.body.appendChild(c);
        const host = {
            tier: 3, autoRun: null,
            run: function () { return Promise.resolve({ ok: true }); },
            close: function () {}, publish: function () {},
        };
        const api = T.shells.tier3.create(c, host);
        ctx.expect(ctx.assert.truthy(c.querySelector('.t3-boot'), 'boot overlay present at mount'));
        await api.whenBooted;
        const net = c.querySelector('.t3-net');
        ctx.expect(ctx.assert.truthy(net && net.classList.contains('is-online'), 'topology powered on'));
        const ov = c.querySelector('.t3-boot');
        ctx.expect(ctx.assert.truthy(!ov || ov.classList.contains('is-done'), 'overlay dismissed'));
        api.destroy();
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal/Tier3Boot: autoRun launches only after boot completes',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const win = ctx.win, T = win.TSICTerminal;
        T.shells.tier3.instantBoot = true;
        const c = win.document.createElement('div');
        win.document.body.appendChild(c);
        const runCalls = [];
        const host = {
            tier: 3, autoRun: 'X',
            run: function (id) { runCalls.push(id); return Promise.resolve({ ok: true }); },
            close: function () {}, publish: function () {},
        };
        const api = T.shells.tier3.create(c, host);
        ctx.expect(ctx.assert.eq(runCalls.length, 0));
        await api.whenBooted;
        ctx.expect(ctx.assert.truthy(runCalls.indexOf('X') !== -1, 'autoRun launched after boot'));
        api.destroy();
    },
});
