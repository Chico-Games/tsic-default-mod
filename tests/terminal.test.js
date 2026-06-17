// Functional tests for the Terminal screen (DOM-level; no live sandbox needed).
// Loads the SPA shell page and drives it through the screen manager.
function termScreenFile() { return '/screens/terminal.html'; }

// Open a tier-1 terminal and wait until the BIOS boot animation has handed off
// to the prompt (data-term-ready). Boot is forced instant via charDelayMs = 0.
async function openTier1Ready(ctx, opts) {
    opts = opts || {};
    await TSICTestHarness.waitFor(() => ctx.win.TSICTerminal && ctx.win.TSICTerminal.shells && ctx.win.TSICTerminal.shells.tier1);
    ctx.win.TSICTerminal.shells.tier1.charDelayMs = 0;
    if (opts.programs) ctx.inject('tsic.msg.UI.Terminal.Catalog', { Programs: opts.programs });
    if (opts.unlocked) ctx.inject('tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: opts.unlocked });
    ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: opts.id || 't1', Tier: 1, AutoRun: opts.autoRun || null });
    await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.tsic-term--t1[data-term-ready]'));
}

TSICTestHarness.register({
    name: 'Terminal: boots the Durham BIOS sequence for a tier-1 terminal',
    file: termScreenFile(),
    async run(ctx) {
        await openTier1Ready(ctx);
        const out = ctx.doc.querySelector('#term-out').textContent;
        ctx.expect(ctx.assert.truthy(/DURHAM SYSTEMS BIOS/.test(out), 'types the first BIOS line'));
        ctx.expect(ctx.assert.truthy(/CONNECTION ESTABLISHED/.test(out), 'reaches CONNECTION ESTABLISHED'));
        ctx.expect(ctx.assert.truthy(/INTERNAL TERMINAL/.test(out), 'prints the logo'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: LS lists unlocked programs and marks tier-locked ones',
    file: termScreenFile(),
    async run(ctx) {
        await openTier1Ready(ctx, {
            programs: [
                { id: 'com.tsic.hello',  name: 'HELLO',    minTier: 1, entry: 'main.js' },
                { id: 'com.tsic.scphint', name: 'SCP-HINT', minTier: 3, entry: 'main.js' },
            ],
            unlocked: ['com.tsic.hello', 'com.tsic.scphint'],
        });
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
        await openTier1Ready(ctx, {
            programs: [{ id: 'com.tsic.scphint', name: 'SCP-HINT', minTier: 3, entry: 'main.js' }],
            unlocked: ['com.tsic.scphint'],
        });
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
    name: 'Terminal: running a program with no floppy shows UNKNOWN APPLICATION',
    file: termScreenFile(),
    async run(ctx) {
        // HELLO exists in the catalog but is NOT in the unlocked set (no floppy).
        await openTier1Ready(ctx, {
            programs: [{ id: 'com.tsic.hello', name: 'HELLO', minTier: 1, entry: 'main.js' }],
            unlocked: [],
        });
        const inp = ctx.doc.querySelector('#term-input');
        inp.value = 'run hello';
        TSICTestHarness.events.keyOn(inp, 'Enter', { code: 'Enter' });
        await TSICTestHarness.waitFor(() => /UNKNOWN APPLICATION/.test(ctx.doc.querySelector('#term-out').textContent));
        const out = ctx.doc.querySelector('#term-out').textContent;
        ctx.expect(ctx.assert.truthy(/NOT FOUND ON THIS UNIT/.test(out), 'states the app is not on this unit'));
        ctx.expect(ctx.assert.truthy(/DID YOU INSERT THE FLOPPY DISK\?/.test(out), 'prompts to insert the floppy'));
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
        await openTier1Ready(ctx);
        ctx.clearPublishes();
        const inp = ctx.doc.querySelector('#term-input');
        inp.value = 'exit';
        TSICTestHarness.events.keyOn(inp, 'Enter', { code: 'Enter' });
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Terminal.Close'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: AutoRun launches a program once booted',
    file: termScreenFile(),
    async run(ctx) {
        // A tier-locked auto-run exercises the wiring (Open.AutoRun -> launch)
        // without needing the live sandbox: it resolves to the tier error.
        await openTier1Ready(ctx, {
            programs: [{ id: 'com.tsic.scphint', name: 'SCP-HINT', minTier: 3, entry: 'main.js' }],
            unlocked: ['com.tsic.scphint'],
            autoRun: 'com.tsic.scphint',
        });
        await TSICTestHarness.waitFor(() => /INCOMPATIBLE HARDWARE/.test(ctx.doc.querySelector('#term-out').textContent));
        const out = ctx.doc.querySelector('#term-out').textContent;
        ctx.expect(ctx.assert.truthy(/> run com\.tsic\.scphint/.test(out), 'auto-run echoes the launch'));
        ctx.expect(ctx.assert.truthy(/requires SCP Restricted-Access Terminal/.test(out), 'auto-run attempted and rendered the tier error'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: a keypress fast-forwards the boot animation',
    file: termScreenFile(),
    async run(ctx) {
        await TSICTestHarness.waitFor(() => ctx.win.TSICTerminal && ctx.win.TSICTerminal.shells && ctx.win.TSICTerminal.shells.tier1);
        ctx.win.TSICTerminal.shells.tier1.charDelayMs = 50; // slow boot so we can interrupt it
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't1', Tier: 1 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.tsic-term--t1.is-booting'));
        const inp = ctx.doc.querySelector('#term-input');
        TSICTestHarness.events.keyOn(inp, 'Enter', { code: 'Enter' }); // any key skips
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.tsic-term--t1[data-term-ready]'));
        ctx.expect(ctx.assert.truthy(/INTERNAL TERMINAL/.test(ctx.doc.querySelector('#term-out').textContent),
            'skipping flushes the full boot including the logo'));
    },
});
