// Playground fixture: Terminal — Tier 2 (Durham GUI Terminal, Experimental).
// The grey-system desktop: program icons, draggable windows, and the built-in
// command console. Projects Open(Tier 2) + Catalog + UnlockedList.
(function () {
  const PROGRAMS = [
    { id: 'com.tsic.logs2',   name: 'LOGS_V2',  minTier: 2, entry: 'main.js', icon: 'logs',  capabilities: ['gfx.canvas','storage.local'] },
    { id: 'com.tsic.stock2',  name: 'STOCK_V2', minTier: 2, entry: 'main.js', icon: 'stock', capabilities: ['gfx.canvas'] },
    { id: 'com.tsic.hello',   name: 'HELLO',    minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print','term.input','storage.local'] },
    { id: 'com.tsic.logs',    name: 'LOGS',     minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print','term.input'] },
    { id: 'com.tsic.stock',   name: 'STOCK',    minTier: 1, entry: 'main.js', folder: 'V1', capabilities: ['term.print','term.input'] },
    { id: 'com.tsic.scphint', name: 'SCP-HINT',  minTier: 3, entry: 'main.js', capabilities: ['term.print','world.read','world.mutate'] },
    { id: 'com.tsic.scp3008', name: 'SCP3008',   minTier: 1, entry: 'main.js', hidden: true, capabilities: ['term.print','term.input'] },
  ];
  // Fresh object each call — onPublish mutates s.badges (MarkSeen deletes keys),
  // so scenarios must never share one badge object.
  function v2Badges() { return { 'com.tsic.logs2': 'NEW', 'com.tsic.stock2': 'NEW' }; }

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
      s.badges[payload.ProgramId] = 'NEW';   // a freshly-inserted floppy arrives flagged
    }
    // The operator opened a flagged program — clear its NEW sticker.
    if (channel === 'UI.Cmd.Terminal.MarkSeen' && payload && payload.ProgramId) {
      delete s.badges[payload.ProgramId];
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
        // Clean desktop by default — the NEW-items preview lives in its own
        // scenario (below) so it's one click, not a click-through every time.
        badges: {},
        autoRun: null,
      };
    },
    project: project,
    scenarios: [
      // One-click NEW-items preview: boots straight into LOGS_V2 so the per-log
      // "NEW" markers show without opening it by hand; desktop badges set too.
      { label: 'NEW items · unread logs', apply(s) { s.badges = v2Badges(); s.autoRun = 'com.tsic.logs2'; } },
      // The desktop side of NEW items: icon starbursts, nothing auto-opened.
      { label: 'NEW items · desktop badges', apply(s) { s.badges = v2Badges(); s.autoRun = null; } },
      { label: 'LOGS_V2 (GUI)', apply(s) { s.badges = {}; s.autoRun = 'com.tsic.logs2'; } },
      { label: 'STOCK_V2 (GUI)', apply(s) { s.badges = {}; s.autoRun = 'com.tsic.stock2'; } },
      { label: 'STOCK v1 (text, in a window)', apply(s) { s.badges = {}; s.autoRun = 'com.tsic.stock'; } },
      { label: 'Nothing unlocked', apply(s) { s.unlocked = []; s.badges = {}; s.autoRun = null; } },
    ],
    onPublish: onPublish,
  });
})();
