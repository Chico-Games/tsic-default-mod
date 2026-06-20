// Playground fixture: Terminal — Tier 2 (Durham GUI Terminal, Experimental).
// The grey-system desktop: program icons, draggable windows, and the built-in
// command console. Projects Open(Tier 2) + Catalog + UnlockedList.
(function () {
  const PROGRAMS = [
    { id: 'com.tsic.logs2',   name: 'LOGS_V2',  minTier: 2, entry: 'main.js', capabilities: ['gfx.canvas'] },
    { id: 'com.tsic.stock2',  name: 'STOCK_V2', minTier: 2, entry: 'main.js', capabilities: ['gfx.canvas'] },
    { id: 'com.tsic.hello',   name: 'HELLO',    minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print','term.input','storage.local'] },
    { id: 'com.tsic.logs',    name: 'LOGS',     minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print','term.input'] },
    { id: 'com.tsic.stock',   name: 'STOCK',    minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print','term.input'] },
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
    id: 'terminal-tier2',
    label: 'Terminal · Tier 2 (GUI)',
    screen: '/screens/terminal.html',
    initialState() {
      return {
        tier: 2,
        programs: PROGRAMS.map(function (p) { return Object.assign({}, p); }),
        unlocked: ['com.tsic.logs2', 'com.tsic.stock2', 'com.tsic.hello', 'com.tsic.logs', 'com.tsic.stock', 'com.tsic.scp3008'],
        autoRun: null,
      };
    },
    project: project,
    scenarios: [
      { label: 'LOGS_V2 (GUI)', apply(s) { s.autoRun = 'com.tsic.logs2'; } },
      { label: 'STOCK_V2 (GUI)', apply(s) { s.autoRun = 'com.tsic.stock2'; } },
      { label: 'STOCK v1 (text, in a window)', apply(s) { s.autoRun = 'com.tsic.stock'; } },
      { label: 'Nothing unlocked', apply(s) { s.unlocked = []; s.autoRun = null; } },
    ],
    onPublish: onPublish,
  });
})();
