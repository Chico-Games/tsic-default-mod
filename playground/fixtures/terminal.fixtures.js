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
                { id: 'com.tsic.scphint', name: 'SCP-HINT',  minTier: 3, entry: 'main.js', capabilities: ['term.print','world.read','world.mutate'] },
            ],
            unlocked: ['com.tsic.hello'],
        };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Terminal.Open',         { TerminalId: 'pg', Tier: state.tier }],
            ['tsic.msg.UI.Terminal.Catalog',      { Programs: state.programs }],
            ['tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: state.unlocked }],
        ];
    },
    scenarios: [
        { label: 'Tier 1 — HELLO unlocked', apply() {} },
        { label: 'Tier 1 — nothing unlocked', apply(s) { s.unlocked = []; } },
        { label: 'Tier 1 — all unlocked (SCP locked)', apply(s) { s.unlocked = ['com.tsic.hello','com.tsic.scphint']; } },
        { label: 'Tier 2 — windowed stub', apply(s) { s.tier = 2; } },
        { label: 'Tier 3 — SCP stub (SCP runnable)', apply(s) { s.tier = 3; s.unlocked = ['com.tsic.hello','com.tsic.scphint']; } },
        { label: 'Insert SCP-HINT floppy', apply(s) { if (s.unlocked.indexOf('com.tsic.scphint') === -1) s.unlocked.push('com.tsic.scphint'); } },
    ],
    onPublish(state, channel, payload) {
        // Simulate the future C++ floppy handler: an InsertDisk unlocks for the save.
        if (channel === 'UI.Cmd.Terminal.InsertDisk' && payload && payload.ProgramId) {
            if (state.unlocked.indexOf(payload.ProgramId) === -1) state.unlocked.push(payload.ProgramId);
        }
    },
});
