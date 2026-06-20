// Playground fixture: Terminal — Tier 1 (Durham Internal Terminal, green CRT).
// Projects Open(Tier 1) + Catalog + UnlockedList; floppy inserts are simulated
// by mutating the unlocked set in onPublish (stands in for the future C++ side).
(function () {
  const PROGRAMS = [
    { id: 'com.tsic.hello',   name: 'HELLO',    minTier: 1, entry: 'main.js', capabilities: ['term.print','term.input','storage.local'] },
    { id: 'com.tsic.logs',    name: 'LOGS',     minTier: 1, entry: 'main.js', capabilities: ['term.print','term.input'] },
    { id: 'com.tsic.stock',   name: 'STOCK',    minTier: 1, entry: 'main.js', capabilities: ['term.print','term.input'] },
    { id: 'com.tsic.scphint', name: 'SCP-HINT',  minTier: 3, entry: 'main.js', capabilities: ['term.print','world.read','world.mutate'] },
    { id: 'com.tsic.scp3008', name: 'SCP3008',   minTier: 1, entry: 'main.js', hidden: true, capabilities: ['term.print','term.input'] },
  ];
  function project(s) {
    return [
      ['tsic.msg.UI.Terminal.Open',         { TerminalId: 'pg', Tier: s.tier, AutoRun: s.autoRun || null }],
      ['tsic.msg.UI.Terminal.Catalog',      { Programs: s.programs }],
      ['tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: s.unlocked }],
    ];
  }
  function onPublish(s, channel, payload) {
    if (channel === 'UI.Cmd.Terminal.InsertDisk' && payload && payload.ProgramId) {
      if (s.unlocked.indexOf(payload.ProgramId) === -1) s.unlocked.push(payload.ProgramId);
    }
  }

  TSICPlayground.register({
    id: 'terminal-tier1',
    label: 'Terminal · Tier 1 (CRT)',
    screen: '/screens/terminal.html',
    initialState() {
      return {
        tier: 1,
        programs: PROGRAMS.map(function (p) { return Object.assign({}, p); }),
        unlocked: ['com.tsic.hello', 'com.tsic.logs', 'com.tsic.stock', 'com.tsic.scp3008'],
        autoRun: null,
      };
    },
    project: project,
    scenarios: [
      { label: 'HELLO running', apply(s) { s.unlocked = ['com.tsic.hello']; s.autoRun = 'com.tsic.hello'; } },
      { label: 'LOGS running', apply(s) { s.unlocked = ['com.tsic.logs']; s.autoRun = 'com.tsic.logs'; } },
      { label: 'STOCK running', apply(s) { s.unlocked = ['com.tsic.stock']; s.autoRun = 'com.tsic.stock'; } },
      { label: 'SCP3008 (secret)', apply(s) { s.unlocked = ['com.tsic.scp3008']; s.autoRun = 'com.tsic.scp3008'; } },
      { label: 'Nothing unlocked', apply(s) { s.unlocked = []; s.autoRun = null; } },
      { label: 'All unlocked (SCP locked)', apply(s) { s.unlocked = ['com.tsic.hello', 'com.tsic.scphint']; s.autoRun = null; } },
    ],
    onPublish: onPublish,
  });
})();
