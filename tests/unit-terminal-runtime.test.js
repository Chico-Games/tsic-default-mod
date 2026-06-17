// Unit tests for the PURE parts of shared/terminal/runtime.js.
// (The live iframe round-trip is verified manually in the playground.)
TSICTestHarness.register({
    name: 'Unit/Terminal/Runtime: buildProgramDoc inlines the shim and the program source',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const R = ctx.win.TSICTerminal.runtime;
        const doc = R.buildProgramDoc('PROGRAM_MARKER_123();');
        ctx.expect(ctx.assert.truthy(doc.indexOf('PROGRAM_MARKER_123();') !== -1, 'program source inlined'));
        ctx.expect(ctx.assert.truthy(doc.indexOf('TSICProgram') !== -1, 'shim inlined'));
        ctx.expect(ctx.assert.truthy(/<script>/.test(doc), 'has inline script tags'));
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal/Runtime: validateRequest enforces granted capabilities',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const R = ctx.win.TSICTerminal.runtime;
        const ERR = ctx.win.TSICTerminal.ERR;
        ctx.expect(ctx.assert.eq(R.validateRequest('storage.get', ['storage.local']).ok, true));
        const denied = R.validateRequest('world.mutate', ['storage.local']);
        ctx.expect(ctx.assert.eq(denied.ok, false));
        ctx.expect(ctx.assert.eq(denied.code, ERR.CAP_DENIED));
        // Unknown op (no cap mapping) is denied too.
        ctx.expect(ctx.assert.eq(R.validateRequest('bogus.op', ['storage.local']).ok, false));
    },
});
