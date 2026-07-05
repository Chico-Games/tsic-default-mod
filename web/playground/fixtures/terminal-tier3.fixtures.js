// Playground fixture: Terminal — Tier 3 (SCP Restricted-Access Terminal, stub).
// World-mutating capability tier; SCP-HINT is runnable here. Projects
// Open(Tier 3) + Catalog + UnlockedList.
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
    id: 'terminal-tier3',
    label: 'Terminal · Tier 3 (SCP)',
    screen: '/screens/terminal.html',
    initialState() {
      return {
        tier: 3,
        programs: PROGRAMS.map(function (p) { return Object.assign({}, p); }),
        unlocked: ['com.tsic.hello', 'com.tsic.scphint'],
        autoRun: null,
      };
    },
    project: project,
    scenarios: [
      { label: 'SCP-HINT runnable', apply(s) { s.unlocked = ['com.tsic.hello', 'com.tsic.scphint']; s.autoRun = null; } },
      { label: 'Insert SCP-HINT floppy', apply(s) { if (s.unlocked.indexOf('com.tsic.scphint') === -1) s.unlocked.push('com.tsic.scphint'); } },
    ],
    onPublish: onPublish,
  });
})();
