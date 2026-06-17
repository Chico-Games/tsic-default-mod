// com.tsic.stock/main.js — STOCK: Durham's "live" inventory database.
//
// Tier-1 program. Each item has a static, semi-random rate (0.5-5.5 units/sec,
// seeded from its SKU; bigger items trend low, smaller trend high). QTY = rate
// * seconds since 01/01/1984 — absurdly large, growing every render. Commands:
// N/P paginate, FIND <sku> searches, ALL clears the search, R refreshes, Q quits.
//
// The item list is baked in (vaguely representative of store furniture), not the
// real game catalog — a later tier-3 build could feed it via term.world.read.
(async function () {
  const term = await TSICProgram.connect();

  const EPOCH = Date.UTC(1984, 0, 1);
  const PER_PAGE = 8;
  const RATE = { big: [0.5, 2.0], med: [2.0, 3.5], small: [3.8, 5.5] };

  const ITEMS = [
    { sku: '442-PT', desc: 'PINE DROP-LEAF TABLE',        loc: 'SHOWROOM C',      size: 'big' },
    { sku: '819-LS', desc: 'LEATHER SECTIONAL (BROWN)',   loc: 'WAREHOUSE SEC 1', size: 'big' },
    { sku: '290-LC', desc: 'LIVING ROOM CARPET (BEIGE)',  loc: 'MARKETPLACE',     size: 'med' },
    { sku: '883-MW', desc: 'MODULAR WARDROBE FRAME',      loc: 'WAREHOUSE SEC 4', size: 'big' },
    { sku: '112-FL', desc: 'FLOOR LAMP (BRUSHED STEEL)',  loc: 'SHOWROOM A',      size: 'med' },
    { sku: '550-OC', desc: 'OFFICE CHAIR (BLACK/MESH)',   loc: 'WAREHOUSE SEC 2', size: 'med' },
    { sku: '304-BS', desc: 'BOOKSHELF (OAK FINISH)',      loc: 'SHOWROOM B',      size: 'big' },
    { sku: '991-MP', desc: 'MATTRESS (QUEEN FIRM)',       loc: 'WAREHOUSE SEC 3', size: 'big' },
    { sku: '201-TL', desc: 'TABLE LAMP (CERAMIC)',        loc: 'SHOWROOM A',      size: 'small' },
    { sku: '727-PF', desc: 'PICTURE FRAME (GILT)',        loc: 'MARKETPLACE',     size: 'small' },
    { sku: '615-SC', desc: 'SCATTER CUSHION (TEAL)',      loc: 'SHOWROOM B',      size: 'small' },
    { sku: '348-CH', desc: 'CANDLE HOLDER (BRASS)',       loc: 'MARKETPLACE',     size: 'small' },
    { sku: '462-DH', desc: 'DRAWER HANDLE (CHROME)',      loc: 'WAREHOUSE SEC 5', size: 'small' },
    { sku: '909-KH', desc: 'KEY HOOK (CAST IRON)',        loc: 'MARKETPLACE',     size: 'small' },
    { sku: '173-CT', desc: 'COFFEE TABLE (GLASS)',        loc: 'SHOWROOM C',      size: 'med' },
    { sku: '538-NS', desc: 'NIGHTSTAND (WALNUT)',         loc: 'WAREHOUSE SEC 3', size: 'med' },
    { sku: '660-BR', desc: 'BAR STOOL (CHROME/VINYL)',    loc: 'SHOWROOM A',      size: 'med' },
    { sku: '284-OT', desc: 'OTTOMAN (GREY FELT)',         loc: 'SHOWROOM B',      size: 'med' },
    { sku: '775-DT', desc: 'DINING TABLE (BEECH 6-SEAT)', loc: 'SHOWROOM C',      size: 'big' },
    { sku: '130-CD', desc: 'CHEST OF DRAWERS (PINE)',     loc: 'WAREHOUSE SEC 4', size: 'big' },
    { sku: '056-DB', desc: 'DOUBLE BED FRAME (OAK)',      loc: 'WAREHOUSE SEC 1', size: 'big' },
    { sku: '421-DK', desc: 'OFFICE DESK (LAMINATE)',      loc: 'WAREHOUSE SEC 2', size: 'big' },
  ];

  function hash01(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return (h % 100000) / 100000; }
  function rateFor(it) { const r = RATE[it.size] || RATE.med; return r[0] + hash01(it.sku) * (r[1] - r[0]); }
  function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function qtyFor(it, secs) { return Math.floor(rateFor(it) * secs); }

  const SKU_W = 7, DESC_W = 27, QTY_W = 13, LOC_W = 15;
  const HEADER = 'SKU'.padEnd(SKU_W) + ' | ' + 'ITEM DESCRIPTION'.padEnd(DESC_W) + ' | ' + 'QTY'.padEnd(QTY_W) + ' | ' + 'LOCATION'.padEnd(LOC_W);
  const RULE = '='.repeat(HEADER.length);
  const DASH = '-'.repeat(HEADER.length);

  function rowOf(it, secs) {
    return it.sku.padEnd(SKU_W) + ' | ' + it.desc.padEnd(DESC_W) + ' | ' + commas(qtyFor(it, secs)).padStart(QTY_W) + ' | ' + it.loc;
  }
  function matches(it, q) {
    q = q.toLowerCase();
    return it.sku.toLowerCase().indexOf(q) !== -1 || it.desc.toLowerCase().indexOf(q) !== -1;
  }

  async function showHelp() {
    term.clear();
    term.print('');
    term.print(DASH);
    term.print('  INVENTORY DATABASE — COMMANDS');
    term.print(DASH);
    term.print('  N            NEXT PAGE');
    term.print('  P            PREV PAGE');
    term.print('  F <SKU>      FIND BY SKU OR DESCRIPTION');
    term.print('  ALL          CLEAR SEARCH / SHOW ALL ITEMS');
    term.print('  R            REFRESH QUANTITIES');
    term.print('  H            THIS HELP');
    term.print('  Q            QUIT');
    term.print(DASH);
    await term.readLine('> PRESS ENTER TO RETURN ');
  }

  let filter = null;
  let page = 0;

  for (;;) {
    const secs = Math.floor((Date.now() - EPOCH) / 1000);
    const visible = filter ? ITEMS.filter(function (it) { return matches(it, filter); }) : ITEMS;
    const pages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
    page = page < 0 ? 0 : (page > pages - 1 ? pages - 1 : page);

    term.clear();
    term.print(RULE);
    term.print(' DURHAM OS // INVENTORY DATABASE // MAIN TERMINAL');
    term.print(RULE);
    term.print('FILE: INVENTORY_DB.DAT');
    term.print('STATUS: ONLINE');
    term.print('LAST UPDATED: 11/04/1986');
    if (filter) term.print('SEARCH: "' + filter + '"   (' + visible.length + (visible.length === 1 ? ' MATCH)' : ' MATCHES)'));
    term.print(DASH);
    term.print(HEADER);
    term.print(DASH);
    if (!visible.length) {
      term.print('  NO RECORDS MATCH.');
    } else {
      const start = page * PER_PAGE;
      visible.slice(start, start + PER_PAGE).forEach(function (it) { term.print(rowOf(it, secs)); });
    }
    term.print(DASH);
    term.print('PAGE ' + (page + 1) + '/' + pages + '   N)EXT  P)REV  F)IND <SKU>  H)ELP  Q)UIT');

    const ans = (await term.readLine('')).trim();
    const lc = ans.toLowerCase();
    if (lc === '') continue;
    if (lc === 'q' || lc === 'quit' || lc === 'exit') break;
    if (lc === 'h' || lc === 'help' || lc === '?') { await showHelp(); continue; }
    if (lc === 'n' || lc === 'next') { page += 1; continue; }
    if (lc === 'p' || lc === 'prev') { page -= 1; continue; }
    if (lc === 'r' || lc === 'refresh') { continue; }
    if (lc === 'all' || lc === 'clear' || lc === 'b' || lc === 'back') { filter = null; page = 0; continue; }
    const m = ans.match(/^(?:f|find|search)\s+(.+)$/i);
    filter = (m ? m[1] : ans).trim();
    page = 0;
  }

  term.exit();
})();
