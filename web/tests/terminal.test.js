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
        ctx.expect(ctx.assert.truthy(/Commands: HELP/.test(out), 'shows the HELP screen on load'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: HELP lists installed programs and marks tier-locked ones',
    file: termScreenFile(),
    async run(ctx) {
        await openTier1Ready(ctx, {
            programs: [
                { id: 'com.tsic.hello',  name: 'HELLO',     minTier: 1, entry: 'main.js' },
                { id: 'com.tsic.logs',   name: 'LOGS',      minTier: 1, entry: 'main.js' },
                { id: 'com.tsic.scphint', name: 'SCP-HINT', minTier: 3, entry: 'main.js' },
            ],
            unlocked: ['com.tsic.hello', 'com.tsic.logs', 'com.tsic.scphint'],
        });
        const inp = ctx.doc.querySelector('#term-input');
        inp.value = 'help';
        TSICTestHarness.events.keyOn(inp, 'Enter', { code: 'Enter' });
        await TSICTestHarness.waitFor(() => /Installed programs:/.test(ctx.doc.querySelector('#term-out').textContent));
        const out = ctx.doc.querySelector('#term-out').textContent;
        ctx.expect(ctx.assert.truthy(/Commands: HELP/.test(out) && !/\bLS\b/.test(out), 'shows the command list without LS'));
        ctx.expect(ctx.assert.truthy(/HELLO/.test(out) && /LOGS/.test(out), 'lists every installed program'));
        ctx.expect(ctx.assert.truthy(/LOCKED/.test(out) && /SCP Restricted-Access Terminal/.test(out),
            'marks tier-locked programs with the required hardware'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: HELP omits hidden (secret) programs',
    file: termScreenFile(),
    async run(ctx) {
        await openTier1Ready(ctx, {
            programs: [
                { id: 'com.tsic.hello',   name: 'HELLO',   minTier: 1, entry: 'main.js' },
                { id: 'com.tsic.scp3008', name: 'SCP3008',  minTier: 1, entry: 'main.js', hidden: true },
            ],
            unlocked: ['com.tsic.hello', 'com.tsic.scp3008'],
        });
        const inp = ctx.doc.querySelector('#term-input');
        inp.value = 'help';
        TSICTestHarness.events.keyOn(inp, 'Enter', { code: 'Enter' });
        await TSICTestHarness.waitFor(() => /Installed programs:/.test(ctx.doc.querySelector('#term-out').textContent));
        const out = ctx.doc.querySelector('#term-out').textContent;
        ctx.expect(ctx.assert.truthy(/HELLO/.test(out), 'lists visible programs'));
        ctx.expect(ctx.assert.truthy(!/SCP3008/.test(out), 'never reveals the hidden program'));
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
        ctx.expect(ctx.assert.truthy(/PROGRAM HELLO NOT FOUND ON THIS UNIT/.test(out), 'states the program is not on this unit'));
        ctx.expect(ctx.assert.truthy(/DID YOU INSERT THE FLOPPY DISK\?/.test(out), 'prompts to insert the floppy'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: a tier-2 terminal mounts the windowed GUI shell',
    file: termScreenFile(),
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't2', Tier: 2 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.tsic-term--t2'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '.tsic-term--t2'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: the tier-2 desktop opens a working command console',
    file: termScreenFile(),
    async run(ctx) {
        await TSICTestHarness.waitFor(() => ctx.win.TSICTerminal && ctx.win.TSICTerminal.shells && ctx.win.TSICTerminal.shells.tier2);
        ctx.win.TSICTerminal.shells.tier2.charDelayMs = 0; // instant output
        ctx.win.TSICTerminal.shells.tier2.instantBoot = true;
        ctx.inject('tsic.msg.UI.Terminal.Catalog', { Programs: [
            { id: 'com.tsic.hello',   name: 'HELLO',    minTier: 1, entry: 'main.js' },
            { id: 'com.tsic.scphint', name: 'SCP-HINT', minTier: 3, entry: 'main.js' },
        ]});
        ctx.inject('tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: ['com.tsic.hello', 'com.tsic.scphint'] });
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't2', Tier: 2 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.t2-icon-system'));
        ctx.doc.querySelector('.t2-icon-system').click(); // open the Terminal console
        await TSICTestHarness.waitFor(() => {
            const c = ctx.doc.querySelector('.tsic-term--t2 .t2-content');
            return c && /Installed programs:/.test(c.textContent) && /HELLO/.test(c.textContent);
        });
        const banner = ctx.doc.querySelector('.tsic-term--t2 .t2-content').textContent;
        ctx.expect(ctx.assert.truthy(/DURHAM-OS COMMAND CONSOLE/.test(banner), 'console boots with its banner'));
        ctx.expect(ctx.assert.truthy(/Commands: HELP/.test(banner), 'shows the command list'));

        // Commands route through the same engine as tier 1 — a tier-locked launch
        // renders the INCOMPATIBLE HARDWARE error inline (no sandbox needed).
        const cin = ctx.doc.querySelector('.t2-console-input');
        cin.value = 'run com.tsic.scphint';
        TSICTestHarness.events.keyOn(cin, 'Enter', { code: 'Enter' });
        await TSICTestHarness.waitFor(() => /INCOMPATIBLE HARDWARE/.test(ctx.doc.querySelector('.tsic-term--t2 .t2-content').textContent));
        const out = ctx.doc.querySelector('.tsic-term--t2 .t2-content').textContent;
        ctx.expect(ctx.assert.truthy(/requires SCP Restricted-Access Terminal \(tier 3\)/.test(out), 'runs commands and renders the tier error inline'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: tier-2 desktop hides foldered programs and groups them in a folder',
    file: termScreenFile(),
    async run(ctx) {
        await TSICTestHarness.waitFor(() => ctx.win.TSICTerminal && ctx.win.TSICTerminal.shells && ctx.win.TSICTerminal.shells.tier2);
        ctx.inject('tsic.msg.UI.Terminal.Catalog', { Programs: [
            { id: 'com.tsic.logs2', name: 'LOGS_V2', minTier: 2, entry: 'main.js', capabilities: ['gfx.canvas'] },
            { id: 'com.tsic.logs',  name: 'LOGS',    minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print', 'term.input'] },
        ]});
        ctx.inject('tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: ['com.tsic.logs2', 'com.tsic.logs'] });
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't2', Tier: 2 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.t2-icon-folder'));
        const rootLabels = Array.from(ctx.doc.querySelectorAll('#t2-icons > .t2-icon > .t2-icon-label')).map(function (n) { return n.textContent; });
        ctx.expect(ctx.assert.truthy(rootLabels.indexOf('LOGS_V2') !== -1, 'a root (v2) program shows on the desktop'));
        ctx.expect(ctx.assert.truthy(rootLabels.indexOf('LOGS') === -1, 'a foldered (v1) program is hidden from the desktop root'));
        ctx.expect(ctx.assert.truthy(rootLabels.indexOf('V1') !== -1, 'the V1 folder appears on the desktop'));
        ctx.doc.querySelector('.t2-icon-folder').click();   // open the folder
        await TSICTestHarness.waitFor(() => {
            const c = ctx.doc.querySelector('.tsic-term--t2 .t2-folder-view');
            return c && /LOGS/.test(c.textContent);
        });
        ctx.expect(ctx.assert.truthy(/LOGS/.test(ctx.doc.querySelector('.t2-folder-view').textContent), 'the V1 folder window contains the v1 program'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: tier-2 desktop keeps several windows open and closes them independently',
    file: termScreenFile(),
    async run(ctx) {
        await TSICTestHarness.waitFor(() => ctx.win.TSICTerminal && ctx.win.TSICTerminal.shells && ctx.win.TSICTerminal.shells.tier2);
        ctx.win.TSICTerminal.shells.tier2.charDelayMs = 0; // instant console boot
        ctx.win.TSICTerminal.shells.tier2.instantBoot = true;
        ctx.inject('tsic.msg.UI.Terminal.Catalog', { Programs: [
            { id: 'com.tsic.logs2', name: 'LOGS_V2', minTier: 2, entry: 'main.js', capabilities: ['gfx.canvas'] },
            { id: 'com.tsic.logs',  name: 'LOGS',    minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print', 'term.input'] },
        ]});
        ctx.inject('tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: ['com.tsic.logs2', 'com.tsic.logs'] });
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't2', Tier: 2 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.t2-icon-system') && ctx.doc.querySelector('.t2-icon-folder'));

        const count = () => ctx.doc.querySelectorAll('.tsic-term--t2 .t2-window').length;
        ctx.doc.querySelector('.t2-icon-system').click();   // console window
        await TSICTestHarness.waitFor(() => count() === 1);
        ctx.doc.querySelector('.t2-icon-folder').click();   // V1 folder window
        await TSICTestHarness.waitFor(() => count() === 2);
        ctx.doc.querySelector('#t2-about-btn').click();     // About window
        await TSICTestHarness.waitFor(() => count() === 3);
        ctx.expect(ctx.assert.truthy(count() === 3, 'three windows coexist on the desktop'));

        // Single instance: re-clicking the Terminal icon raises, never duplicates.
        ctx.doc.querySelector('.t2-icon-system').click();
        await new Promise(r => setTimeout(r, 20));
        ctx.expect(ctx.assert.truthy(count() === 3, 'a second click on an open program raises it, not a duplicate'));

        // Closing one window leaves the others standing.
        const folder = ctx.doc.querySelector('.tsic-term--t2 .t2-window .t2-folder-view');
        folder.closest('.t2-window').querySelector('.t2-close').click();
        await TSICTestHarness.waitFor(() => count() === 2);
        ctx.expect(ctx.assert.truthy(!ctx.doc.querySelector('.t2-folder-view'), 'the folder window is gone'));
        ctx.expect(ctx.assert.truthy(/DURHAM-OS COMMAND CONSOLE/.test(ctx.doc.querySelector('.t2-console').textContent),
            'the console window survives closing another window'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: tier-2 flags new programs with a NEW badge that clears on open',
    file: termScreenFile(),
    async run(ctx) {
        await TSICTestHarness.waitFor(() => ctx.win.TSICTerminal && ctx.win.TSICTerminal.shells && ctx.win.TSICTerminal.shells.tier2);
        ctx.win.TSICTerminal.shells.tier2.charDelayMs = 0;
        ctx.win.TSICTerminal.shells.tier2.instantBoot = true;
        ctx.inject('tsic.msg.UI.Terminal.Catalog', { Programs: [
            { id: 'com.tsic.logs2', name: 'LOGS_V2', minTier: 2, entry: 'main.js', capabilities: ['gfx.canvas'] },
            { id: 'com.tsic.logs',  name: 'LOGS',    minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print', 'term.input'] },
        ]});
        ctx.inject('tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: ['com.tsic.logs2', 'com.tsic.logs'] });
        ctx.inject('tsic.msg.UI.Terminal.Badges', { Badges: { 'com.tsic.logs2': 'NEW', 'com.tsic.logs': 'NEW' } });
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't2', Tier: 2 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.t2-icon-folder'));

        function iconByLabel(label) {
            return Array.from(ctx.doc.querySelectorAll('.t2-icon')).find(function (i) {
                const l = i.querySelector('.t2-icon-label');
                return l && l.textContent === label;
            });
        }
        const logs2 = iconByLabel('LOGS_V2');
        ctx.expect(ctx.assert.truthy(logs2 && logs2.querySelector('.t2-icon-badge'), 'a newly-arrived root program shows a NEW badge'));
        ctx.expect(ctx.assert.truthy(ctx.doc.querySelector('.t2-icon-folder .t2-icon-badge'),
            'the V1 folder aggregates the NEW badge of a program inside it'));

        // Opening it publishes MarkSeen and the badge clears immediately.
        ctx.clearPublishes();
        logs2.click();
        await TSICTestHarness.waitFor(function () {
            const i = iconByLabel('LOGS_V2');
            return i && !i.querySelector('.t2-icon-badge');
        });
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Terminal.MarkSeen',
            { where: function (p) { return p && p.ProgramId === 'com.tsic.logs2'; } }));
        ctx.expect(ctx.assert.truthy(ctx.doc.querySelector('.t2-icon-folder .t2-icon-badge'),
            'the folder badge persists while its V1 program is still unopened'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: re-receiving Open for the same tier keeps open windows (idempotent)',
    file: termScreenFile(),
    async run(ctx) {
        await TSICTestHarness.waitFor(() => ctx.win.TSICTerminal && ctx.win.TSICTerminal.shells && ctx.win.TSICTerminal.shells.tier2);
        ctx.win.TSICTerminal.shells.tier2.charDelayMs = 0;
        ctx.win.TSICTerminal.shells.tier2.instantBoot = true;
        ctx.inject('tsic.msg.UI.Terminal.Catalog', { Programs: [{ id: 'com.tsic.hello', name: 'HELLO', minTier: 1, entry: 'main.js' }] });
        ctx.inject('tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: ['com.tsic.hello'] });
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't2', Tier: 2 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.t2-icon-system'));
        const count = () => ctx.doc.querySelectorAll('.tsic-term--t2 .t2-window').length;
        ctx.doc.querySelector('.t2-icon-system').click();   // open the console window
        await TSICTestHarness.waitFor(() => count() === 1);

        // The playground re-projects (re-sends Open) after every publish. A repeated
        // same-tier Open must NOT tear the desktop down and close the window.
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't2', Tier: 2 });
        await new Promise(r => setTimeout(r, 40));
        ctx.expect(ctx.assert.truthy(count() === 1, 'a repeated same-tier Open leaves the open window standing'));

        // A genuine tier change still rebuilds the shell.
        ctx.win.TSICTerminal.shells.tier1.charDelayMs = 0;
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't2', Tier: 1 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.tsic-term--t1'));
        ctx.expect(ctx.assert.truthy(!ctx.doc.querySelector('.tsic-term--t2'), 'switching tier rebuilds into the new shell'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: a tier-3 SCiPnet terminal renders the network topology desktop',
    file: termScreenFile(),
    async run(ctx) {
        await TSICTestHarness.waitFor(() => ctx.win.TSICTerminal && ctx.win.TSICTerminal.shells && ctx.win.TSICTerminal.shells.tier3);
        ctx.win.TSICTerminal.shells.tier3.charDelayMs = 0;
        ctx.win.TSICTerminal.shells.tier3.instantBoot = true;
        ctx.inject('tsic.msg.UI.Terminal.Catalog', { Programs: [
            { id: 'com.tsic.logs2', name: 'LOGS_V2', minTier: 2, entry: 'main.js', capabilities: ['gfx.canvas'] },
            { id: 'com.tsic.logs',  name: 'LOGS',    minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print', 'term.input'] },
        ]});
        ctx.inject('tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: ['com.tsic.logs2', 'com.tsic.logs'] });
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't3', Tier: 3 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.tsic-term--t3 .t3-node'));
        const labels = Array.from(ctx.doc.querySelectorAll('.tsic-term--t3 .t3-node-label')).map(function (n) { return n.textContent; });
        ctx.expect(ctx.assert.truthy(labels.indexOf('ROOT_NODE') !== -1, 'the ROOT node anchors the topology'));
        ctx.expect(ctx.assert.truthy(labels.indexOf('TERMINAL') !== -1, 'the SCiPnet shell is a TERMINAL node in the web'));
        ctx.expect(ctx.assert.truthy(labels.indexOf('LOGS_V2') !== -1, 'unlocked programs appear as nodes (backwards compatible)'));
        ctx.expect(ctx.assert.truthy(labels.indexOf('V1') !== -1, 'a folder appears as an anchor node'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '.tsic-term--t3 .t3-net-canvas'));   // topology links draw on the 3D canvas
    },
});

TSICTestHarness.register({
    name: 'Terminal: a tier-3 program node opens its window; TERMINAL opens the console',
    file: termScreenFile(),
    async run(ctx) {
        await TSICTestHarness.waitFor(() => ctx.win.TSICTerminal && ctx.win.TSICTerminal.shells && ctx.win.TSICTerminal.shells.tier3);
        ctx.win.TSICTerminal.shells.tier3.charDelayMs = 0;
        ctx.win.TSICTerminal.shells.tier3.instantBoot = true;
        ctx.inject('tsic.msg.UI.Terminal.Catalog', { Programs: [{ id: 'com.tsic.hello', name: 'HELLO', minTier: 1, entry: 'main.js', capabilities: ['term.print', 'term.input'] }] });
        ctx.inject('tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: ['com.tsic.hello'] });
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't3', Tier: 3 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.tsic-term--t3 .t3-node'));
        function nodeByLabel(label) {
            return Array.from(ctx.doc.querySelectorAll('.tsic-term--t3 .t3-node')).find(function (n) {
                const l = n.querySelector('.t3-node-label'); return l && l.textContent === label;
            });
        }
        const winCount = () => ctx.doc.querySelectorAll('.tsic-term--t3 .t3-window').length;
        // The TERMINAL node opens Katie's SCiPnet console.
        nodeByLabel('TERMINAL').click();
        await TSICTestHarness.waitFor(() => {
            const c = ctx.doc.querySelector('.tsic-term--t3 .t3-console');
            return c && /KATIE\/\/ROOT/.test(c.textContent);
        });
        ctx.expect(ctx.assert.truthy(winCount() === 1, 'TERMINAL opens the console window'));
        // A program node opens that program in its own window.
        nodeByLabel('HELLO').click();
        await TSICTestHarness.waitFor(() => winCount() === 2);
        ctx.expect(ctx.assert.truthy(winCount() === 2, 'a program node opens its own window (same programs as v2)'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: tier-3 windows maximize and close independently',
    file: termScreenFile(),
    async run(ctx) {
        await TSICTestHarness.waitFor(() => ctx.win.TSICTerminal && ctx.win.TSICTerminal.shells && ctx.win.TSICTerminal.shells.tier3);
        ctx.win.TSICTerminal.shells.tier3.charDelayMs = 0;
        ctx.win.TSICTerminal.shells.tier3.instantBoot = true;
        ctx.inject('tsic.msg.UI.Terminal.Catalog', { Programs: [{ id: 'com.tsic.hello', name: 'HELLO', minTier: 1, entry: 'main.js', capabilities: ['term.print', 'term.input'] }] });
        ctx.inject('tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: ['com.tsic.hello'] });
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't3', Tier: 3 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.tsic-term--t3 .t3-node'));
        function nodeByLabel(label) {
            return Array.from(ctx.doc.querySelectorAll('.tsic-term--t3 .t3-node')).find(function (n) {
                const l = n.querySelector('.t3-node-label'); return l && l.textContent === label;
            });
        }
        const wins = () => ctx.doc.querySelectorAll('.tsic-term--t3 .t3-window');
        nodeByLabel('TERMINAL').click();
        await TSICTestHarness.waitFor(() => wins().length === 1);
        nodeByLabel('HELLO').click();
        await TSICTestHarness.waitFor(() => wins().length === 2);

        const w = wins()[1];
        w.querySelector('.t3-zoom').click();
        ctx.expect(ctx.assert.truthy(w.classList.contains('is-max'), 'zoom maximizes the window'));
        w.querySelector('.t3-zoom').click();
        ctx.expect(ctx.assert.truthy(!w.classList.contains('is-max'), 'zoom restores the window'));

        w.querySelector('.t3-close').click();
        await TSICTestHarness.waitFor(() => wins().length === 1);
        ctx.expect(ctx.assert.truthy(wins().length === 1, 'closing one window leaves the other open'));
    },
});

TSICTestHarness.register({
    name: 'Terminal: clicking a console body refocuses its input (tier 2 + tier 3)',
    file: termScreenFile(),
    async run(ctx) {
        await TSICTestHarness.waitFor(() => ctx.win.TSICTerminal && ctx.win.TSICTerminal.shells && ctx.win.TSICTerminal.shells.tier2 && ctx.win.TSICTerminal.shells.tier3);
        ctx.win.TSICTerminal.shells.tier2.charDelayMs = 0;
        ctx.win.TSICTerminal.shells.tier2.instantBoot = true;
        ctx.win.TSICTerminal.shells.tier3.charDelayMs = 0;
        ctx.win.TSICTerminal.shells.tier3.instantBoot = true;

        // Tier 2: open the console, blur the input, click the body → refocused.
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't2', Tier: 2 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.t2-icon-system'));
        ctx.doc.querySelector('.t2-icon-system').click();
        // Wait for readiness, not just for the input to exist: the prompt line is
        // visibility:hidden until boot finishes, and focus() on a hidden input is a no-op.
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.t2-console[data-term-ready] .t2-console-input'));
        const c2 = ctx.doc.querySelector('.t2-console-input');
        c2.blur();
        ctx.doc.querySelector('.t2-content.t2-console').dispatchEvent(new ctx.win.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.truthy(ctx.doc.activeElement === c2, 'tier-2 console click refocuses its input'));

        // Tier 3: same — open the TERMINAL console, blur, click body → refocused.
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't3', Tier: 3 });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.tsic-term--t3 .t3-node'));
        Array.from(ctx.doc.querySelectorAll('.tsic-term--t3 .t3-node')).find(function (n) {
            const l = n.querySelector('.t3-node-label'); return l && l.textContent === 'TERMINAL';
        }).click();
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.t3-console[data-term-ready] .t3-console-input'));
        const c3 = ctx.doc.querySelector('.t3-console-input');
        c3.blur();
        ctx.doc.querySelector('.t3-console').dispatchEvent(new ctx.win.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        ctx.expect(ctx.assert.truthy(ctx.doc.activeElement === c3, 'tier-3 console click refocuses its input'));
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

TSICTestHarness.register({
    name: 'Terminal: the game catalog arrives as raw program.json text',
    file: termScreenFile(),
    async run(ctx) {
        // C++ sends the on-disk manifests verbatim on ProgramsJson (the bridge would
        // rename every key if they round-tripped through a USTRUCT). Parsing that shape
        // has to leave the shell with exactly the same catalog the fixtures produce.
        await TSICTestHarness.waitFor(() => ctx.win.TSICTerminal && ctx.win.TSICTerminal.shells && ctx.win.TSICTerminal.shells.tier1);
        ctx.win.TSICTerminal.shells.tier1.charDelayMs = 0;
        ctx.inject('tsic.msg.UI.Terminal.Catalog', {
            ProgramsJson: [
                '{"id":"com.tsic.hello","name":"HELLO","minTier":1,"entry":"main.js"}',
                '{"id":"com.tsic.scphint","name":"SCP-HINT","minTier":3,"entry":"main.js"}',
                'not json at all',
            ],
        });
        ctx.inject('tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: ['com.tsic.hello', 'com.tsic.scphint'] });
        ctx.inject('tsic.msg.UI.Terminal.Open', { TerminalId: 't1', Tier: 1, AutoRun: null });
        await TSICTestHarness.waitFor(() => ctx.doc.querySelector('.tsic-term--t1[data-term-ready]'));
        const inp = ctx.doc.querySelector('#term-input');
        inp.value = 'help';
        TSICTestHarness.events.keyOn(inp, 'Enter', { code: 'Enter' });
        await TSICTestHarness.waitFor(() => /Installed programs:/.test(ctx.doc.querySelector('#term-out').textContent));
        const out = ctx.doc.querySelector('#term-out').textContent;
        ctx.expect(ctx.assert.truthy(/HELLO/.test(out), 'parses a manifest sent as text'));
        ctx.expect(ctx.assert.truthy(/LOCKED/.test(out), 'keeps minTier, so the tier-3 program still reads as locked'));
    },
});
