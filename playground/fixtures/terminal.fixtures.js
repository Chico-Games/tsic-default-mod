// Playground fixture for the Terminal screen.
// Projects Open(Tier) + Catalog + UnlockedList; simulates floppy inserts by
// mutating the unlocked set in onPublish (stands in for the future C++ side).
TSICPlayground.register({
    id: 'terminal',
    label: 'Terminal',
    screen: '/screens/terminal.html',
    initialState() {
        return {
            tier: 1,
            programs: [
                { id: 'com.tsic.hello',   name: 'HELLO',    minTier: 1, entry: 'main.js', capabilities: ['term.print','term.input','storage.local'] },
                { id: 'com.tsic.logs',    name: 'LOGS',     minTier: 1, entry: 'main.js', capabilities: ['term.print','term.input'] },
                { id: 'com.tsic.stock',   name: 'STOCK',    minTier: 1, entry: 'main.js', capabilities: ['term.print','term.input'] },
                { id: 'com.tsic.scphint', name: 'SCP-HINT',  minTier: 3, entry: 'main.js', capabilities: ['term.print','world.read','world.mutate'] },
                { id: 'com.tsic.scp3008', name: 'SCP3008',   minTier: 1, entry: 'main.js', hidden: true, capabilities: ['term.print','term.input'] },
            ],
            unlocked: ['com.tsic.hello', 'com.tsic.logs', 'com.tsic.stock', 'com.tsic.scp3008'],
            autoRun: null,   // program id the terminal boots straight into, if any
        };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Terminal.Open',         { TerminalId: 'pg', Tier: state.tier, AutoRun: state.autoRun || null }],
            ['tsic.msg.UI.Terminal.Catalog',      { Programs: state.programs }],
            ['tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: state.unlocked }],
        ];
    },
    scenarios: [
        { label: 'Tier 1 — HELLO unlocked', apply(s) { s.autoRun = null; } },
        { label: 'Tier 1 — HELLO running', apply(s) { s.tier = 1; s.unlocked = ['com.tsic.hello']; s.autoRun = 'com.tsic.hello'; } },
        { label: 'Tier 1 — LOGS running', apply(s) { s.tier = 1; s.unlocked = ['com.tsic.logs']; s.autoRun = 'com.tsic.logs'; } },
        { label: 'Tier 1 — STOCK running', apply(s) { s.tier = 1; s.unlocked = ['com.tsic.stock']; s.autoRun = 'com.tsic.stock'; } },
        { label: 'Tier 1 — SCP3008 (secret)', apply(s) { s.tier = 1; s.unlocked = ['com.tsic.scp3008']; s.autoRun = 'com.tsic.scp3008'; } },
        { label: 'Tier 1 — nothing unlocked', apply(s) { s.unlocked = []; s.autoRun = null; } },
        { label: 'Tier 1 — all unlocked (SCP locked)', apply(s) { s.unlocked = ['com.tsic.hello','com.tsic.scphint']; s.autoRun = null; } },
        { label: 'Tier 2 — GUI desktop', apply(s) { s.tier = 2; s.autoRun = null; } },
        { label: 'Tier 3 — SCP stub (SCP runnable)', apply(s) { s.tier = 3; s.unlocked = ['com.tsic.hello','com.tsic.scphint']; s.autoRun = null; } },
        { label: 'Insert SCP-HINT floppy', apply(s) { if (s.unlocked.indexOf('com.tsic.scphint') === -1) s.unlocked.push('com.tsic.scphint'); } },
    ],
    onPublish(state, channel, payload) {
        // Simulate the future C++ floppy handler: an InsertDisk unlocks for the save.
        if (channel === 'UI.Cmd.Terminal.InsertDisk' && payload && payload.ProgramId) {
            if (state.unlocked.indexOf(payload.ProgramId) === -1) state.unlocked.push(payload.ProgramId);
        }
    },
});
