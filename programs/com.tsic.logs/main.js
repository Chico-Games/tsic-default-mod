// com.tsic.logs/main.js — LOGS: a paginated system-log viewer.
//
// Tier-1 program. Pure text I/O via the terminal shim (term.print / readLine).
// Shows a paginated list of logs; pick a number to read one (its body paginates
// too); B returns to the list, Q quits. Log content is baked in here — a later
// tier-3 build could swap this for live store logs via term.world.read.
(async function () {
  const term = await TSICProgram.connect();

  // Each log: a title + body as an array of lines (paginated by line).
  const LOGS = [
    {
      title: 'DURHAM OS v1.0.0 - SYSTEM INITIALIZATION LOG 001',
      body: [
        'DATE: 12/14/1983    TIME: 08:30 AM',
        'SYSADMIN: KATIE',
        '',
        'Welcome everyone! This is the very first log of the very',
        'first version of DURHAM OS. I just finished wiring the',
        'back office, and we are officially online!',
        '',
        "I'm so excited to get everything running smoothly for the",
        'store. If you see any bugs, glitches, or a blinking cursor',
        "that won't go away, please remember to come speak to me!",
        "(I'm usually at the desk surrounded by cables).",
        '',
        'Happy typing!',
        '- Katie (Head of IT)',
      ],
    },
    {
      title: 'DURHAM OS // UNTITLED LOG ENTRY 002',
      body: [
        'USER: GARY',
        'TIMESTAMP: 12/18/1983 - 10:14 AM',
        '',
        'SEARCH INVENTORY',
        'WHERE ARE THE PINE DROP-LEAF TABLES',
        'LOCATE PINE TABLE SHOWROOM C',
        'HELLO COMPUTER PLEASE FIND PINE TABLE',
        'katie if you see this i am trying to find the PINE DROP-LEAF TABLES from showroom c',
        'ENTER',
        'SEARCH',
        'PINE TALE',
        'DELETEBACKSPACE',
      ],
    },
  ];

  const LIST_PER_PAGE = 5;
  const BODY_PER_PAGE = 14;
  const RULE = '========================================';

  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }

  // List view. Returns when the user quits.
  async function viewList() {
    if (!LOGS.length) {
      term.print('');
      term.print(RULE);
      term.print('  DURHAM SYSTEM LOGS');
      term.print(RULE);
      term.print('  NO LOGS ON FILE.');
      await term.readLine('LOGS>  (any key to quit)');
      return;
    }
    let page = 0;
    const pages = Math.max(1, Math.ceil(LOGS.length / LIST_PER_PAGE));
    for (;;) {
      page = clamp(page, 0, pages - 1);
      term.print('');
      term.print(RULE);
      term.print('  DURHAM SYSTEM LOGS   (' + LOGS.length + ' ENTRIES)');
      term.print(RULE);
      const start = page * LIST_PER_PAGE;
      LOGS.slice(start, start + LIST_PER_PAGE).forEach(function (log, i) {
        term.print('  [' + (start + i + 1) + ']  ' + log.title);
      });
      term.print('');
      term.print('  PAGE ' + (page + 1) + '/' + pages + '   #) READ   N) NEXT   P) PREV   Q) QUIT');
      const ans = (await term.readLine('LOGS> ')).trim().toLowerCase();
      if (ans === 'q' || ans === 'quit' || ans === 'exit') return;
      if (ans === 'n') { page += 1; continue; }
      if (ans === 'p') { page -= 1; continue; }
      const num = parseInt(ans, 10);
      if (num >= 1 && num <= LOGS.length) {
        const quit = await viewLog(LOGS[num - 1]);
        if (quit) return;
        continue;
      }
      term.print('  ?? UNKNOWN COMMAND. TYPE A NUMBER, N, P OR Q.');
    }
  }

  // Single-log reader. Returns true if the user chose to quit the program.
  async function viewLog(log) {
    let page = 0;
    const pages = Math.max(1, Math.ceil(log.body.length / BODY_PER_PAGE));
    for (;;) {
      page = clamp(page, 0, pages - 1);
      // Standard log header: title framed by '=' rules, sized to the title.
      const bar = '='.repeat(log.title.length + 4);
      term.print('');
      term.print(bar);
      term.print('* ' + log.title + ' *');
      term.print(bar);
      const start = page * BODY_PER_PAGE;
      log.body.slice(start, start + BODY_PER_PAGE).forEach(function (line) { term.print('  ' + line); });
      term.print('');
      term.print('  PAGE ' + (page + 1) + '/' + pages + '   N) NEXT   P) PREV   B) BACK   Q) QUIT');
      const ans = (await term.readLine('READ> ')).trim().toLowerCase();
      if (ans === 'q' || ans === 'quit') return true;
      if (ans === 'b' || ans === 'back') return false;
      if (ans === 'n') { page += 1; continue; }
      if (ans === 'p') { page -= 1; continue; }
      term.print('  ?? UNKNOWN COMMAND. TYPE N, P, B OR Q.');
    }
  }

  term.print('LOGS v1.0 — DURHAM SYSTEM LOG VIEWER');
  await viewList();
  term.print('LOGS TERMINATED.');
  term.exit();
})();
