// com.tsic.stock2/main.js — STOCK_V2: a Tier-2 GUI inventory database.
//
// A "gfx.canvas" program: it renders its OWN RetroOS-styled table inside the
// program window — click a column header to SORT, type to SEARCH, mouse-scroll
// the rows, and quantities tick up live (same absurd growth as the v1 STOCK).
// Self-contained; the title bar + close box are the shell's window chrome.
(async function () {
  await TSICProgram.connect();   // handshake; the UI is self-rendered

  const EPOCH = Date.UTC(1984, 0, 1);
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
  function qtyFor(it, secs) { return Math.floor(rateFor(it) * secs); }
  function commas(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  const CSS =
    '*{box-sizing:border-box}' +
    'html,body{margin:0;height:100%}' +
    'body{font-family:"VT323","Cascadia Mono","Courier New",monospace;font-size:18px;color:#000;background:#fff;display:flex;flex-direction:column}' +
    '.bar{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:2px solid #000}' +
    '.bar .t{color:#000;letter-spacing:1px}' +
    '.bar .search{margin-left:auto;width:42%;min-width:120px;font:inherit;padding:1px 5px;border:2px solid #000;background:#fff;outline:none}' +
    '.wrap{flex:1;overflow:auto}' +
    'table{border-collapse:collapse;width:100%}' +
    'th,td{border:2px dashed #000;padding:2px 8px;text-align:left;white-space:nowrap}' +
    'th{position:sticky;top:0;background:#e60000;color:#fff;cursor:pointer;letter-spacing:1px;border-color:#000}' +
    'th .ar{float:right;margin-left:8px}' +
    'th.num,td.num{text-align:right}' +
    'td.num{position:relative;padding-left:20px}' +           /* reserved gutter for the arrow */
    'td.sku{font-weight:bold;background:#eee}' +
    'tbody tr:hover td{background:#ffe9e9}' +
    'tbody tr:hover td.sku{background:#f4d9d9}' +
    'td.num.bump{animation:stk-bump .8s ease-out}' +
    /* absolute → out of flow, so it never changes the column width or shifts the number */
    'td.num .up{position:absolute;left:5px;top:50%;transform:translateY(-50%);font-size:.85em;font-weight:bold}' +
    '@keyframes stk-bump{from{background:#e60000;color:#fff}to{background:transparent;color:#000}}' +
    '@media(prefers-reduced-motion:reduce){td.num.bump{animation:none}}' +
    '.status{flex:0 0 auto;border-top:2px solid #000;padding:2px 8px;color:#555}' +
    '::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-thumb{background:#000}';

  document.head.insertAdjacentHTML('beforeend',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=VT323&display=swap">' +
    '<style>' + CSS + '</style>');
  document.body.innerHTML =
    '<div class="bar"><span class="t">DURHAM OS // INVENTORY DATABASE v2</span>' +
    '<input id="q" class="search" placeholder="search SKU or item…" autocomplete="off" spellcheck="false"></div>' +
    '<div class="wrap" id="wrap"><table>' +
    '<thead><tr>' +
    '<th data-k="sku">SKU</th><th data-k="desc">ITEM DESCRIPTION</th>' +
    '<th data-k="qty" class="num">QTY</th><th data-k="loc">LOCATION</th>' +
    '</tr></thead><tbody id="tb"></tbody></table></div>' +
    '<div class="status" id="st"></div>';

  const wrap = document.getElementById('wrap');
  const tb = document.getElementById('tb');
  const st = document.getElementById('st');
  const heads = document.querySelectorAll('th');
  let sortKey = 'sku', sortDir = 1, filter = '';

  // Live inventory: each item carries its own quantity + a randomised "next
  // update" time, so stock ticks up at staggered moments all over the table —
  // each bump flashes its own cell — rather than one synchronised refresh.
  function randDelay() { return 2000 + Math.random() * 8000; }                 // 2–10s per item
  function bumpAmount(it) { return 1 + Math.floor(rateFor(it) * (2 + Math.random() * 10)); }
  const now0 = Date.now();
  const STATE = ITEMS.map(function (it) {
    return { it: it, qty: qtyFor(it, (now0 - EPOCH) / 1000), nextAt: now0 + randDelay() };
  });
  let cellBySku = {};

  function render() {
    let rows = STATE.slice();
    if (filter) {
      const q = filter.toLowerCase();
      rows = rows.filter(function (r) { return r.it.sku.toLowerCase().indexOf(q) !== -1 || r.it.desc.toLowerCase().indexOf(q) !== -1; });
    }
    rows.sort(function (a, b) {
      let av, bv;
      if (sortKey === 'qty') { av = a.qty; bv = b.qty; }
      else { av = a.it[sortKey].toLowerCase(); bv = b.it[sortKey].toLowerCase(); }
      if (av < bv) return -sortDir;
      if (av > bv) return sortDir;
      return 0;
    });
    const keep = wrap.scrollTop;
    tb.innerHTML = rows.map(function (r) {
      return '<tr><td class="sku">' + esc(r.it.sku) + '</td><td>' + esc(r.it.desc) + '</td>' +
        '<td class="num" data-sku="' + esc(r.it.sku) + '">' + commas(r.qty) + '</td><td>' + esc(r.it.loc) + '</td></tr>';
    }).join('');
    wrap.scrollTop = keep;
    cellBySku = {};
    Array.prototype.forEach.call(tb.querySelectorAll('td.num[data-sku]'), function (c) { cellBySku[c.getAttribute('data-sku')] = c; });
    st.textContent = rows.length + ' RECORDS · LIVE · click a column to sort';
    heads.forEach(function (h) {
      const k = h.getAttribute('data-k');
      const base = h.textContent.replace(/[ ▲▼].*$/, '');
      h.innerHTML = esc(base) + (k === sortKey ? '<span class="ar">' + (sortDir === 1 ? '▲' : '▼') + '</span>' : '');
    });
  }

  // Re-trigger the flash animation on a cell (remove → reflow → re-add).
  function flash(cell) { cell.classList.remove('bump'); void cell.offsetWidth; cell.classList.add('bump'); }

  function tick() {
    const now = Date.now();
    STATE.forEach(function (r) {
      if (now < r.nextAt) return;
      r.qty += bumpAmount(r.it);
      r.nextAt = now + randDelay();
      const cell = cellBySku[r.it.sku];   // null while filtered out — state still advances
      if (cell) {
        cell.textContent = '';
        const up = document.createElement('span');   // ▲ to the left of the qty while it flashes
        up.className = 'up';
        up.textContent = '▲';
        cell.appendChild(up);
        cell.appendChild(document.createTextNode(commas(r.qty)));
        flash(cell);
        setTimeout(function () { if (up.parentNode) up.parentNode.removeChild(up); }, 900);
      }
    });
  }

  heads.forEach(function (h) {
    h.addEventListener('click', function () {
      const k = h.getAttribute('data-k');
      if (k === sortKey) sortDir = -sortDir; else { sortKey = k; sortDir = 1; }
      render();
    });
  });
  document.getElementById('q').addEventListener('input', function (e) { filter = e.target.value.trim(); render(); });

  render();
  setInterval(tick, 400);   // staggered live updates; dies with the iframe when the window closes
})();
