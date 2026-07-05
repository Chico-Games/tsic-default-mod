// Unit tests for shared/terminal/constants.js
TSICTestHarness.register({
    name: 'Unit/Terminal: hardwareName maps each tier to its in-fiction name',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const T = ctx.win.TSICTerminal;
        ctx.expect(ctx.assert.eq(T.hardwareName(1), 'Durham Internal Terminal'));
        ctx.expect(ctx.assert.eq(T.hardwareName(2), 'Durham GUI Terminal (Experimental)'));
        ctx.expect(ctx.assert.eq(T.hardwareName(3), 'SCP Restricted-Access Terminal'));
        ctx.expect(ctx.assert.eq(T.hardwareName(9), 'Unknown Terminal'));
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal: allowedCaps is cumulative across tiers',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const T = ctx.win.TSICTerminal;
        ctx.expect(ctx.assert.eq(T.allowedCaps(1).sort(),
            ['catalog.read', 'storage.local', 'term.input', 'term.print']));
        const t3 = T.allowedCaps(3);
        ctx.expect(ctx.assert.truthy(t3.includes('term.print') && t3.includes('gfx.canvas') && t3.includes('world.mutate'),
            'tier 3 should include tier-1, tier-2 and tier-3 caps'));
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal: grantedCaps intersects requested with the tier allow-list',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const T = ctx.win.TSICTerminal;
        // tier-1 program asking for a tier-3 cap gets it stripped.
        ctx.expect(ctx.assert.eq(
            T.grantedCaps(1, ['term.print', 'world.mutate', 'storage.local']).sort(),
            ['storage.local', 'term.print']));
        // tier-3 keeps it.
        ctx.expect(ctx.assert.truthy(
            T.grantedCaps(3, ['world.mutate']).includes('world.mutate')));
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal: ERR + CHANNELS expose the verbatim contract strings',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const T = ctx.win.TSICTerminal;
        ctx.expect(ctx.assert.eq(T.ERR.TIER_TOO_LOW, 'ERR_TIER_TOO_LOW'));
        ctx.expect(ctx.assert.eq(T.ERR.CAP_DENIED, 'ERR_CAP_DENIED'));
        ctx.expect(ctx.assert.eq(T.CHANNELS.Open, 'UI.Terminal.Open'));
        ctx.expect(ctx.assert.eq(T.CHANNELS.WorldMutate, 'UI.Cmd.Terminal.WorldMutate'));
    },
});
