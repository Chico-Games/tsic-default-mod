// com.tsic.stock/main.js — STOCK: Durham's "live" units-on-hand readout.
//
// Tier-1 program. Each furniture item has a static, semi-random rate (0.5-5.5
// units/second, seeded from its name; bigger items trend low, smaller trend
// high). Stock = rate * seconds elapsed since 01/01/1984 — so the numbers are
// absurdly large and grow every time you look. R refreshes, Q quits.
//
// The item list is baked in for now; a later tier-3 build could feed the real
// furniture catalog via term.world.read.
(async function () {
  const term = await TSICProgram.connect();

  const EPOCH = Date.UTC(1984, 0, 1);

  // size -> [minRate, maxRate]. Big furniture trends to the low end, small
  // accessories to the high end (per the spec). Overall span: 0.5 .. 5.5.
  const RATE = { big: [0.5, 2.0], med: [2.0, 3.5], small: [3.8, 5.5] };

  const ITEMS = [
    { name: 'PINE DROP-LEAF TABLE', size: 'big' },
    { name: 'OAK WARDROBE', size: 'big' },
    { name: '3-SEAT SOFA', size: 'big' },
    { name: 'DOUBLE BED FRAME', size: 'big' },
    { name: 'DINING TABLE', size: 'big' },
    { name: 'BOOKCASE', size: 'big' },
    { name: 'CHEST OF DRAWERS', size: 'big' },
    { name: 'OFFICE DESK', size: 'big' },
    { name: 'ARMCHAIR', size: 'med' },
    { name: 'COFFEE TABLE', size: 'med' },
    { name: 'NIGHTSTAND', size: 'med' },
    { name: 'BAR STOOL', size: 'med' },
    { name: 'FLOOR LAMP', size: 'med' },
    { name: 'OTTOMAN', size: 'med' },
    { name: 'TABLE LAMP', size: 'small' },
    { name: 'PICTURE FRAME', size: 'small' },
    { name: 'SCATTER CUSHION', size: 'small' },
    { name: 'CANDLE HOLDER', size: 'small' },
    { name: 'DRAWER HANDLE', size: 'small' },
    { name: 'KEY HOOK', size: 'small' },
    { name: 'COASTER', size: 'small' },
    { name: 'NAPKIN RING', size: 'small' },
  ];

  // Deterministic 0..1 from a string (djb2). Same item -> same rate, always.
  function hash01(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return (h % 100000) / 100000;
  }
  function rateFor(item) {
    const r = RATE[item.size] || RATE.med;
    return r[0] + hash01(item.name) * (r[1] - r[0]);
  }
  function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function render() {
    const secs = Math.floor((Date.now() - EPOCH) / 1000);
    const RULE = '='.repeat(46);
    term.print('');
    term.print(RULE);
    term.print('  DURHAM LIVE STOCK - UNITS ON HAND');
    term.print(RULE);
    let total = 0;
    ITEMS.forEach(function (it) {
      const count = Math.floor(rateFor(it) * secs);
      total += count;
      term.print('  ' + it.name.padEnd(26) + commas(count).padStart(16));
    });
    term.print('  ' + '-'.repeat(44));
    term.print('  ' + 'TOTAL UNITS'.padEnd(26) + commas(total).padStart(16));
    term.print('');
    term.print('  R) REFRESH   Q) QUIT');
  }

  for (;;) {
    render();
    const ans = (await term.readLine('STOCK> ')).trim().toLowerCase();
    if (ans === 'q' || ans === 'quit' || ans === 'exit') break;
    // anything else (incl. R) re-renders with fresh, larger counts
  }

  term.exit();
})();
