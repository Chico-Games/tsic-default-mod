// Unit tests for shared/terminal/capabilities.js
TSICTestHarness.register({
    name: 'Unit/Terminal/Caps: capForOp maps ops to capability tokens',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const Caps = ctx.win.TSICTerminal.capabilities;
        ctx.expect(ctx.assert.eq(Caps.capForOp('storage.set'), 'storage.local'));
        ctx.expect(ctx.assert.eq(Caps.capForOp('world.mutate'), 'world.mutate'));
        ctx.expect(ctx.assert.eq(Caps.capForOp('bogus'), null));
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal/Caps: storage round-trips through the injected backend',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const Caps = ctx.win.TSICTerminal.capabilities;
        const store = new Map();
        const h = Caps.createHostHandlers({ publish() {}, storage: store, catalogSnapshot: () => [] });
        await h.dispatch('storage.set', { key: 'k', value: 42 });
        const got = await h.dispatch('storage.get', { key: 'k' });
        ctx.expect(ctx.assert.eq(got.value, 42));
        const missing = await h.dispatch('storage.get', { key: 'nope' });
        ctx.expect(ctx.assert.eq(missing.value, null));
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal/Caps: world ops are stubbed NOT_IMPLEMENTED and do not publish',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const Caps = ctx.win.TSICTerminal.capabilities;
        const ERR = ctx.win.TSICTerminal.ERR;
        let published = 0;
        const h = Caps.createHostHandlers({ publish: () => { published++; }, storage: new Map(), catalogSnapshot: () => [] });
        const r = await h.dispatch('world.mutate', { op: 'setTimeOfDay', args: { t: 0.5 } });
        ctx.expect(ctx.assert.eq(r.error, ERR.NOT_IMPLEMENTED));
        ctx.expect(ctx.assert.eq(published, 0));
    },
});
