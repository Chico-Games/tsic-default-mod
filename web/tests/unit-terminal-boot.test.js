// Unit tests for shared/terminal/boot.js (runBoot orchestration).
function bootFakeTerm() {
    const calls = [];
    return {
        calls,
        type(text, opts) { calls.push({ kind: 'type', text, opts }); return Promise.resolve(); },
        print(text, opts) { calls.push({ kind: 'print', text, opts }); },
        text() { return calls.map(c => c.text).join('\n'); },
    };
}

TSICTestHarness.register({
    name: 'Unit/Terminal/Boot: types every boot line in order',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const B = ctx.win.TSICTerminal.boot;
        const term = bootFakeTerm();
        await B.runBoot(term);
        const typed = term.calls.filter(c => c.kind === 'type').map(c => c.text);
        ctx.expect(ctx.assert.eq(typed[0], B.BOOT_LINES[0].text));
        ctx.expect(ctx.assert.eq(typed.length, B.BOOT_LINES.length));
        ctx.expect(ctx.assert.truthy(term.text().includes('CONNECTION ESTABLISHED'), 'reaches CONNECTION ESTABLISHED'));
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal/Boot: prints the logo when provided',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const B = ctx.win.TSICTerminal.boot;
        const term = bootFakeTerm();
        await B.runBoot(term, { logo: 'LOGO-HERE' });
        ctx.expect(ctx.assert.truthy(term.text().includes('LOGO-HERE'), 'prints logo'));
        const printed = term.calls.filter(c => c.kind === 'print');
        ctx.expect(ctx.assert.eq(printed.length, 1));
    },
});
