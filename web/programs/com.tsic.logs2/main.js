// com.tsic.logs2/main.js — LOGS_V2: a Tier-2 GUI log browser.
//
// A "gfx.canvas" program: it renders its OWN RetroOS-styled UI inside the
// program window (clickable entry list + scrollable reader) and handles mouse
// natively, instead of the v1 text pager. Same Durham logs as the v1 LOGS.
// Self-contained: the sandboxed iframe can't fetch shared CSS, so styles are
// inlined; the title bar + close box are the shell's window chrome.
(async function () {
  const api = await TSICProgram.connect();   // handshake; the UI is self-rendered

  // Per-log "NEW" tracking. A log stays flagged NEW until it's been read; the
  // read set persists via storage.local, so re-opening LOGS_V2 only flags logs
  // the operator hasn't seen yet. (This is a v2-only browser — v1 LOGS has none.)
  let readSet = new Set();
  try {
    const r = await api.storage.get('readLogs');
    if (r && Array.isArray(r.value)) readSet = new Set(r.value);
  } catch (e) {}
  function markRead(log) {
    if (readSet.has(log.id)) return;
    readSet.add(log.id);
    try { api.storage.set('readLogs', Array.from(readSet)); } catch (e) {}
  }

  const LOGS = [
    { id: 'init-001', title: 'SYSTEM INITIALIZATION — LOG 001', meta: 'KATIE (HEAD OF IT) · 14/12/1983 08:30', body: [
      'Welcome everyone! This is the very first log of the very',
      'first version of DURHAM OS. I just finished wiring the back',
      'office, and we are officially online!',
      '',
      'If you see any bugs, glitches, or a blinking cursor that',
      "won't go away, please come speak to me (I'm usually at the",
      'desk surrounded by cables).',
      '',
      'Happy typing!   - Katie',
    ] },
    { id: 'gary-002', title: 'UNTITLED LOG ENTRY 002', meta: 'GARY · 18/12/1983 10:14', body: [
      'SEARCH INVENTORY',
      'WHERE ARE THE PINE DROP LEAF TABLES',
      'LOCATE PINE TABLE SHOWROOM C',
      'HELLO COMPUTER PLEASE FIND PINE TABLE',
      'ENTER',
      'SEARCH',
      'PINE TALEB',
      'DELETE',
      'KATIE IF YOU SEE THIS I AM TRYING TO FIND THE PINE DROP',
      'LEAF TABLES FROM SHOWROOM C',
    ] },
    { id: 'diary-01', title: 'SYSADMIN DIARY — LOG 01', meta: 'KATIE · 08/01/1984 17:30', body: [
      'I am officially set up in my own tech room and settled in!',
      '',
      'Still trying to get everyone up to speed on the new systems',
      "(Gary did find the table in the end). It's been hard to keep",
      'accurate stock counts, and I suspect some of the stock just',
      "isn't being inputted correctly.",
      '',
      "Turned out we had a whole floor section which didn't get",
      "logged in stocks! Everyone says they weren't the one who got",
      'the supply delivery in, so go figure.',
      '',
      'Computers only know what we tell them, guys!   - Katie',
    ] },
    { id: 'diary-02', title: 'SYSADMIN DIARY — LOG 02', meta: 'KATIE · 16/01/1984 21:48', body: [
      "I've decided to start keeping backup floppy disks for all",
      'programs and logs. For some reason, the main server data',
      'keeps getting corrupted overnight.',
      '',
      "It's like we're getting massive power surges? Half of my",
      'plugged-in testing devices are totally fried in the mornings.',
      'What could cause such a huge surge at night of all times?',
      '',
      "I'm going to ask management if I can be put on the night shift",
      'this week to investigate.   - Katie',
    ] },
    { id: 'diary-03', title: 'SYSADMIN DIARY — LOG 03', meta: 'KATIE · 19/01/1984 03:14', body: [
      'Who knew the store could be such a maze in the dark? I went',
      'to get a snack from the vending machines and got completely',
      'turned around. It felt like I was wandering around forever',
      'before I found my way back.',
      '',
      'Do you ever get that feeling that someone is watching you?',
      'Spooooooky.',
      '',
      'I must have missed whatever corrupted the data. The night',
      "wasn't a total waste though — I looked through some of the raw",
      "corrupted files, and here's the weird thing:",
      '',
      'The total stock data grew from roughly 48kb to over 300kb.',
      'Some of the data was repeating and duplicated. It was a mess',
      "and completely unrecoverable. I've never seen anything like",
      'that.   - Katie',
    ] },
  ];

  const CSS =
    '*{box-sizing:border-box}' +
    'html,body{margin:0;height:100%}' +
    'body{font-family:"VT323","Cascadia Mono","Courier New",monospace;font-size:18px;color:#000;background:#fff}' +
    '.app{display:flex;height:100vh}' +
    '.list{width:42%;min-width:150px;border-right:2px solid #000;overflow:auto}' +
    '.list .item{display:flex;align-items:center;gap:6px;padding:5px 9px;cursor:pointer;border-bottom:1px solid #000}' +
    '.list .item .t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.list .item .new{flex:0 0 auto;font-size:12px;font-weight:bold;letter-spacing:.02em;color:#fff;background:#e60000;padding:0 4px}' +
    '.list .item:hover{background:#eee}' +
    '.list .item.active{background:#000;color:#fff}' +
    '.reader{flex:1;overflow:auto;padding:10px 12px}' +
    '.reader h2{margin:0 0 2px;font-size:20px;font-weight:normal;letter-spacing:1px;color:#e60000}' +
    '.reader .meta{color:#555;margin-bottom:10px;border-bottom:2px dashed #000;padding-bottom:6px}' +
    '.reader .line{white-space:pre-wrap;min-height:1.1em;line-height:1.25}' +
    '::-webkit-scrollbar{width:10px}::-webkit-scrollbar-thumb{background:#000}';

  document.head.insertAdjacentHTML('beforeend',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=VT323&display=swap">' +
    '<style>' + CSS + '</style>');
  document.body.innerHTML = '<div class="app"><div class="list" id="list"></div><div class="reader" id="reader"></div></div>';

  const listEl = document.getElementById('list');
  const readerEl = document.getElementById('reader');
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function renderList(sel) {
    listEl.innerHTML = '';
    LOGS.forEach(function (log, i) {
      const d = document.createElement('div');
      d.className = 'item' + (i === sel ? ' active' : '');
      const t = document.createElement('span');
      t.className = 't';
      t.textContent = (i + 1) + '. ' + log.title;
      d.appendChild(t);
      if (!readSet.has(log.id)) {                 // unread → show a NEW tag
        const n = document.createElement('span');
        n.className = 'new';
        n.textContent = 'NEW';
        d.appendChild(n);
      }
      d.addEventListener('click', function () { select(i); });
      listEl.appendChild(d);
    });
  }
  function renderReader(i) {
    const log = LOGS[i];
    let html = '<h2>' + esc(log.title) + '</h2><div class="meta">' + esc(log.meta) + '</div>';
    log.body.forEach(function (ln) { html += '<div class="line">' + esc(ln || ' ') + '</div>'; });
    readerEl.innerHTML = html;
    readerEl.scrollTop = 0;
  }
  function select(i) { markRead(LOGS[i]); renderList(i); renderReader(i); }
  select(0);
})();
