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
      title: 'STARTUP DIAGNOSTIC — 03:00',
      body: [
        'POWER-ON SELF TEST .......... OK',
        'REGISTER LINK (x6) .......... OK',
        'COLD STORAGE SENSORS ........ OK',
        'BACK ROOM CAMERA 4 .......... NO SIGNAL',
        'NIGHT LIGHTING .............. OK',
        'ALL CRITICAL SYSTEMS NOMINAL.',
      ],
    },
    {
      title: 'INVENTORY RECONCILIATION',
      body: [
        'EXPECTED SKUS: 4,118',
        'COUNTED SKUS:  4,121',
        'DELTA: +3 (UNLISTED)',
        'FLAG: 3 ITEMS PRESENT WITH NO CATALOG ENTRY.',
        'AISLE 7, SHELF C. SUPERVISOR REVIEW ADVISED.',
      ],
    },
    {
      title: 'INCIDENT 0473 — NIGHT SHIFT',
      body: [
        '23:14  STOCKER REPORTS "HUMMING" FROM AISLE 7.',
        '23:31  AISLE 7 CAMERA RESTORED. FEED UNSTABLE.',
        '23:32  MOTION DETECTED. NO STAFF ON FLOOR.',
        '23:40  PRODUCT FOUND REARRANGED INTO A SPIRAL.',
        '23:41  REARRANGEMENT NOT ON CAMERA. TIMESTAMP GAP.',
        '23:55  HUMMING CEASES.',
        '00:02  STOCKER DOES NOT RESPOND TO PAGE.',
        '00:03  STOCKER BADGE LAST READ: AISLE 7.',
        '00:18  BADGE READS AISLE 7 AGAIN. AND AGAIN.',
        '00:18  BADGE READS AISLE 7 x214 IN ONE SECOND.',
        '00:19  FEED CUTS.',
        '06:00  DAY SHIFT ARRIVES. AISLE 7 IS CLEAN.',
        '06:00  STOCKER PRESENT. NO MEMORY OF NIGHT.',
        '06:01  SPIRAL DRAWN ON THE BREAK ROOM WHITEBOARD.',
        'STATUS: UNRESOLVED. ESCALATED TO SITE CONTROL.',
        'DO NOT RESTOCK AISLE 7 ALONE.',
      ],
    },
    {
      title: 'MAINTENANCE: AISLE 7 LIGHTING',
      body: [
        'TICKET #8841 — LIGHTS FLICKER AT 23:00 NIGHTLY.',
        'ELECTRICIAN: WIRING NOMINAL. NO FAULT FOUND.',
        'RECOMMENDATION: REPLACE FIXTURE ANYWAY.',
        'NOTE: NEW FIXTURE ALSO FLICKERS AT 23:00.',
      ],
    },
    {
      title: 'CUSTOMER FEEDBACK LOG',
      body: [
        '"GREAT PRICES, ODD MUSIC." — 4 STARS',
        '"THE GUY IN AISLE 7 NEVER BLINKS." — 2 STARS',
        '"I WAS ONLY GONE A MINUTE. IT WAS DARK OUT." — 1 STAR',
        '"CLEAN STORE. CLEAN STORE. CLEAN STORE." — 5 STARS',
      ],
    },
    {
      title: 'SECURITY OVERRIDE — UNAUTHORIZED',
      body: [
        'CLEARANCE LEVEL REQUESTED: SITE.',
        'CREDENTIALS: NOT ON FILE.',
        'OVERRIDE GRANTED ANYWAY. SOURCE UNKNOWN.',
        'A DIFFERENT TERMINAL IS LISTENING.',
      ],
    },
  ];

  const LIST_PER_PAGE = 5;
  const BODY_PER_PAGE = 14;
  const RULE = '========================================';

  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }

  // List view. Returns when the user quits.
  async function viewList() {
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
      term.print('');
      term.print(RULE);
      term.print('  ' + log.title);
      term.print(RULE);
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
