// Playground fixture: Terminal — Tier 3 (SCiPnet, Katie's hacked OS).
// The next step up from v2: same programs/console/windows, but the desktop is a
// network topology map in amber tactical CRT. Projects Open(Tier 3) + Catalog +
// UnlockedList + Badges.
(function () {
  const PROGRAMS = [
    { id: 'com.tsic.logs2',   name: 'LOGS_V2_DARKMODE',  minTier: 2, entry: 'main.js', icon: 'logs',  capabilities: ['gfx.canvas', 'storage.local'] },
    { id: 'com.tsic.stock2',  name: 'STOCK_V2_DARKMODE', minTier: 2, entry: 'main.js', icon: 'stock', capabilities: ['gfx.canvas'] },
    { id: 'com.tsic.hello',   name: 'HELLO',    minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print', 'term.input', 'storage.local'] },
    { id: 'com.tsic.logs',    name: 'LOGS',     minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print', 'term.input'] },
    { id: 'com.tsic.stock',   name: 'STOCK',    minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print', 'term.input'] },
    { id: 'com.tsic.scp3008', name: 'SCP3008',  minTier: 1, entry: 'main.js', hidden: true, capabilities: ['term.print', 'term.input'] },
  ];
  function project(s) {
    return [
      ['tsic.msg.UI.Terminal.Open',         { TerminalId: 'pg', Tier: s.tier, AutoRun: s.autoRun || null }],
      ['tsic.msg.UI.Terminal.Catalog',      { Programs: s.programs }],
      ['tsic.msg.UI.Terminal.UnlockedList', { ProgramIds: s.unlocked }],
      ['tsic.msg.UI.Terminal.Badges',       { Badges: s.badges || {} }],
    ];
  }
  function onPublish(s, channel, payload) {
    if (channel === 'UI.Cmd.Terminal.InsertDisk' && payload && payload.ProgramId) {
      if (s.unlocked.indexOf(payload.ProgramId) === -1) s.unlocked.push(payload.ProgramId);
      s.badges[payload.ProgramId] = 'NEW';
    }
    if (channel === 'UI.Cmd.Terminal.MarkSeen' && payload && payload.ProgramId) {
      delete s.badges[payload.ProgramId];
    }
  }

  TSICPlayground.register({
    id: 'terminal-tier3',
    label: 'Terminal · Tier 3 (SCiPnet)',
    screen: '/screens/terminal.html',
    initialState() {
      return {
        tier: 3,
        programs: PROGRAMS.map(function (p) { return Object.assign({}, p); }),
        // Katie unlocked everything — the whole v2 program set, plus the hidden
        // SCP3008 (no node; run it by name in the TERMINAL shell).
        unlocked: ['com.tsic.logs2', 'com.tsic.stock2', 'com.tsic.hello', 'com.tsic.logs', 'com.tsic.stock', 'com.tsic.scp3008'],
        badges: {},
        autoRun: null,
      };
    },
    project: project,
    scenarios: [
      { label: 'Topology (everything unlocked)', apply(s) { s.autoRun = null; s.badges = {}; } },
      { label: 'NEW node arrival', apply(s) { s.badges = { 'com.tsic.logs2': 'NEW' }; s.autoRun = null; } },
      { label: 'Open LOGS_V2 over the map', apply(s) { s.autoRun = 'com.tsic.logs2'; } },
    ],
    onPublish: onPublish,
  });
})();
