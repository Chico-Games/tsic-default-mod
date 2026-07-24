// Unit tests for shared/terminal/boot-graphical.js — the pure tier-2/tier-3 boot
// orchestrators, driven against fake views (cf. unit-terminal-boot.test.js).
function fakeT2View() {
    const calls = [];
    return {
        calls,
        line(t) { calls.push(['line', t]); },
        addModule(n) { calls.push(['addModule', n]); },
        setProgress(f) { calls.push(['setProgress', f]); },
        blinkDisk() { calls.push(['blinkDisk']); },
        alive() { return true; },
        done() { calls.push(['done']); },
    };
}
function fakeT3View() {
    const calls = [], lines = [];
    return {
        calls, lines,
        line(t, o) { calls.push(['line', t, o && o.cls]); lines.push(t); },
        glitch() { calls.push(['glitch']); },
        breach(on) { calls.push(['breach', on]); },
        alive() { return true; },
        done() { calls.push(['done']); },
    };
}

TSICTestHarness.register({
    name: 'Unit/Terminal/BootGraphical: tier2 loads every module then done',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const B = ctx.win.TSICTerminal.boot.tier2;
        const v = fakeT2View();
        await B.run(v, { instant: true });
        const mods = v.calls.filter(c => c[0] === 'addModule').map(c => c[1]);
        ctx.expect(ctx.assert.eq(mods.length, B.MODULES.length));
        ctx.expect(ctx.assert.eq(mods[0], B.MODULES[0]));
        const lastProg = v.calls.filter(c => c[0] === 'setProgress').pop();
        ctx.expect(ctx.assert.eq(lastProg[1], 1));
        ctx.expect(ctx.assert.truthy(v.calls.some(c => c[0] === 'done'), 'calls done'));
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal/BootGraphical: tier2 skip jumps to done',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const B = ctx.win.TSICTerminal.boot.tier2;
        const v = fakeT2View();
        await B.run(v, { skip: () => true });
        ctx.expect(ctx.assert.truthy(v.calls.some(c => c[0] === 'done'), 'done on skip'));
        const mods = v.calls.filter(c => c[0] === 'addModule');
        ctx.expect(ctx.assert.truthy(mods.length < B.MODULES.length, 'skips remaining modules'));
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal/BootGraphical: tier3 plays hijack acts then grants access',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const B = ctx.win.TSICTerminal.boot.tier3;
        const v = fakeT3View();
        await B.run(v, { instant: true });
        ctx.expect(ctx.assert.truthy(v.lines.some(l => l.indexOf('KATIE//ROOT') !== -1), 'override line'));
        ctx.expect(ctx.assert.truthy(v.lines.some(l => l.indexOf('ACCESS GRANTED') !== -1), 'access granted'));
        ctx.expect(ctx.assert.truthy(v.calls.some(c => c[0] === 'breach' && c[1] === true), 'breach on'));
        ctx.expect(ctx.assert.truthy(v.calls.some(c => c[0] === 'breach' && c[1] === false), 'breach off'));
        const last = v.calls[v.calls.length - 1];
        ctx.expect(ctx.assert.eq(last[0], 'done'));
    },
});

TSICTestHarness.register({
    name: 'Unit/Terminal/BootGraphical: tier3 skip jumps to done',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const B = ctx.win.TSICTerminal.boot.tier3;
        const v = fakeT3View();
        await B.run(v, { skip: () => true });
        ctx.expect(ctx.assert.truthy(v.calls.some(c => c[0] === 'done'), 'done on skip'));
    },
});
