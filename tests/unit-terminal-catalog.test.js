// Unit tests for shared/terminal/catalog.js
function mkState(win) {
    const C = win.TSICTerminal.catalog;
    const programs = [
        C.parseManifest({ id: 'com.tsic.hello',  name: 'HELLO',  minTier: 1, entry: 'main.js' }),
        C.parseManifest({ id: 'com.tsic.paint',  name: 'PAINT',  minTier: 2, entry: 'main.js' }),
        C.parseManifest({ id: 'com.tsic.scphint',name: 'SCPHINT',minTier: 3, entry: 'main.js' }),
    ];
    return { C, programs };
}

TSICTestHarness.register({
    name: 'Unit/Terminal/Catalog: parseManifest normalizes defaults and rejects junk',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const C = ctx.win.TSICTerminal.catalog;
        const p = C.parseManifest({ id: 'x', entry: 'm.js' });
        ctx.expect(ctx.assert.eq(p.minTier, 1));
        ctx.expect(ctx.assert.eq(p.name, 'x'));
        ctx.expect(ctx.assert.eq(p.capabilities, []));
        ctx.expect(ctx.assert.eq(C.parseManifest({ name: 'no id' }), null));
        ctx.expect(ctx.assert.eq(C.parseManifest({ id: 'y' }), null)); // no entry
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal/Catalog: listForTerminal shows unlocked only, marks locked, sorts by name',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const { C, programs } = mkState(ctx.win);
        const list = C.listForTerminal({
            programs,
            unlockedIds: ['com.tsic.scphint', 'com.tsic.hello'], // paint NOT unlocked
            tier: 1,
        });
        ctx.expect(ctx.assert.eq(list.length, 2));
        ctx.expect(ctx.assert.eq(list[0].program.name, 'HELLO'));   // sorted
        ctx.expect(ctx.assert.eq(list[0].locked, false));          // hello runnable on tier1
        ctx.expect(ctx.assert.eq(list[1].program.name, 'SCPHINT'));
        ctx.expect(ctx.assert.eq(list[1].locked, true));           // scphint needs tier3
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal/Catalog: resolveLaunch returns structured errors',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const { C, programs } = mkState(ctx.win);
        const ERR = ctx.win.TSICTerminal.ERR;
        const base = { programs, unlockedIds: ['com.tsic.hello', 'com.tsic.scphint'], tier: 1 };

        ctx.expect(ctx.assert.eq(C.resolveLaunch('nope', base).code, ERR.NOT_FOUND));
        ctx.expect(ctx.assert.eq(C.resolveLaunch('com.tsic.paint', base).code, ERR.NOT_UNLOCKED));

        const low = C.resolveLaunch('com.tsic.scphint', base);
        ctx.expect(ctx.assert.eq(low.code, ERR.TIER_TOO_LOW));
        ctx.expect(ctx.assert.eq(low.info, { required: 3, current: 1 }));

        const ok = C.resolveLaunch('com.tsic.hello', base);
        ctx.expect(ctx.assert.eq(ok.ok, true));
        ctx.expect(ctx.assert.eq(ok.program.id, 'com.tsic.hello'));
    },
});
