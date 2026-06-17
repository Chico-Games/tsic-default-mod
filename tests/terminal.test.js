// Functional tests for the Terminal screen (DOM-level; no live sandbox needed).
// Loads the SPA shell page and drives it through the screen manager.
function termScreenFile() { return '/screens/terminal.html'; }

TSICTestHarness.register({
    name: 'Terminal: boots the Durham banner for a tier-1 terminal',
    file: termScreenFile(),
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't1', Tier: 1 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.tsic-term-banner'));
        ctx.expect(ctx.assert.domText(ctx.doc, '.tsic-term-banner', /DURHAM INTERNAL TERMINAL/));
    },
});

TSICTestHarness.register({
    name: 'Terminal: LS lists unlocked programs and marks tier-locked ones',
    file: termScreenFile(),
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't1', Tier: 1 });
        ctx.inject('tsic.msg.UI.Terminal.Catalog', { Programs: [
            { id: 'com.tsic.hello',  name: 'HELLO',   minTier: 1, entry: 'main.js' },
            { id: 'com.tsic.scphint',name: 'SCP-HINT', minTier: 3, entry: 'main.js' },
        ]});
        ctx.inject('tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: ['com.tsic.hello', 'com.tsic.scphint'] });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('#term-input'));
        TSICTestHarness.events.keyOn(ctx.doc.querySelector('#term-input'), 'l'); // ensure focus path
        const inp = ctx.doc.querySelector('#term-input');
        inp.value = 'ls';
        TSICTestHarness.events.keyOn(inp, 'Enter', { code: 'Enter' });
        await TSICTestHarness.waitFor(() => /SCP-HINT/.test(ctx.doc.querySelector('#term-out').textContent));
        const outText = ctx.doc.querySelector('#term-out').textContent;
        ctx.expect(ctx.assert.truthy(/HELLO/.test(outText), 'lists HELLO'));
        ctx.expect(ctx.assert.truthy(/LOCKED/.test(outText) && /SCP Restricted-Access Terminal/.test(outText),
            'marks SCP-HINT locked with the required hardware name'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: running a tier-locked program shows INCOMPATIBLE HARDWARE',
    file: termScreenFile(),
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't1', Tier: 1 });
        ctx.inject('tsic.msg.UI.Terminal.Catalog', { Programs: [
            { id: 'com.tsic.scphint', name: 'SCP-HINT', minTier: 3, entry: 'main.js' },
        ]});
        ctx.inject('tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: ['com.tsic.scphint'] });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('#term-input'));
        const inp = ctx.doc.querySelector('#term-input');
        inp.value = 'run com.tsic.scphint';
        TSICTestHarness.events.keyOn(inp, 'Enter', { code: 'Enter' });
        await TSICTestHarness.waitFor(() => /INCOMPATIBLE HARDWARE/.test(ctx.doc.querySelector('#term-out').textContent));
        const outText = ctx.doc.querySelector('#term-out').textContent;
        ctx.expect(ctx.assert.truthy(/requires SCP Restricted-Access Terminal \(tier 3\)/.test(outText), 'names required hardware + tier'));
        ctx.expect(ctx.assert.truthy(/This unit is Durham Internal Terminal \(tier 1\)/.test(outText), 'names current hardware + tier'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: a tier-2 terminal mounts the windowed stub shell',
    file: termScreenFile(),
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't2', Tier: 2 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.tsic-term--t2'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '.tsic-term--t2'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: EXIT publishes UI.Cmd.Terminal.Close',
    file: termScreenFile(),
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't1', Tier: 1 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('#term-input'));
        ctx.clearPublishes();
        const inp = ctx.doc.querySelector('#term-input');
        inp.value = 'exit';
        TSICTestHarness.events.keyOn(inp, 'Enter', { code: 'Enter' });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Terminal.Close'));
    },
});
