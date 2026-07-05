// shared/terminal/shells/tier2-windowed.js
//
// Tier-2 "Durham GUI Terminal (Experimental)" shell: an early-1980s graphical
// desktop (GEM / Amiga Workbench era) re-skinned as RetroOS '84 with the store's
// Durham red as accent. Unlocked programs render as desktop icons; launching one
// opens a draggable, resizable window.
//
// MULTI-WINDOW: several windows live on the desktop at once — the command
// console, GUI programs (LOGS_V2 / STOCK_V2), text apps, folders and the About
// box can all be open together. pointerdown raises a window to the front
// (click-to-focus); each window owns its own drag / resize / maximise / close.
// A window is keyed (app:<id> / console / folder:<name> / about) so re-opening an
// already-open thing just raises its existing window instead of duplicating it.
//
// Each launched program gets a per-window "sink" (its container + print / input /
// theme / lifecycle), so closing one window kills only that program. Chrome lives
// here; wiring lives in shared/screens/terminal.js.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};
  NS.shells = NS.shells || {};

  // Robust app glyph: a beveled letter tile (Susan-Kare-ish) keyed off the
  // program name's initial — always renders regardless of bitmap-font coverage.
  function glyphFor(name) {
    return (String(name || '?').trim()[0] || '?').toUpperCase();
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // The console boots to a short banner — no full BIOS (the GUI is already up).
  const CONSOLE_BANNER = [
    { text: 'DURHAM-OS COMMAND CONSOLE  v2.0' },
    { text: '(C) 1986 DURHAM HOME FURNISHINGS' },
    { text: 'Type HELP for a list of commands.' },
    { text: '' },
  ];
  // Map the engine's CRT row classes onto the grey-GUI console's row classes.
  function mapCls(cls) {
    if (cls === 'tsic-term-echo') return 't2-echo';
    if (cls === 'tsic-term-err') return 't2-err';
    return cls || '';
  }

  // Monochrome RetroOS line-icons (stroke=currentColor so they dim when locked).
  // GUI programs pick one via their manifest `icon`; text/v1 apps + the console
  // all use `terminal`. Static literals — no user data in the markup.
  const ICONS = {
    terminal:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">' +
      '<rect x="2" y="3" width="20" height="14"/>' +
      '<path d="M6 7.5 l3 2.5 -3 2.5"/>' +
      '<line x1="12" y1="12.5" x2="16" y2="12.5"/>' +
      '<line x1="12" y1="17" x2="12" y2="20"/><line x1="8" y1="20" x2="16" y2="20"/></svg>',
    logs:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">' +
      '<path d="M5 2 h9 l5 5 v15 H5 Z"/><path d="M14 2 v5 h5"/>' +
      '<line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="8" y1="18" x2="13" y2="18"/></svg>',
    stock:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter">' +
      '<rect x="3" y="4" width="18" height="16"/>' +
      '<line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="14.5" x2="21" y2="14.5"/>' +
      '<line x1="11" y1="9" x2="11" y2="20"/></svg>',
  };

  function create(container, host) {
    const doc = container.ownerDocument;
    const hw = NS.hardwareName(host.tier);

    container.innerHTML =
      '<div class="tsic-term tsic-term--t2">' +
      '  <div class="t2-menubar">' +
      '    <span class="t2-brand"><span class="t2-brand-mark">▤</span>Durham OS</span>' +
      '    <button class="t2-menu-item" id="t2-about-btn" type="button">About</button>' +
      '    <span class="t2-clock" id="t2-clock"></span>' +
      '  </div>' +
      '  <div class="t2-desktop">' +
      '    <div class="t2-icons" id="t2-icons"></div>' +
      '  </div>' +
      '  <div class="t2-statusbar">' +
      '    <span class="t2-status-hw">' + hw.toUpperCase() + '</span>' +
      '    <span class="t2-status-right">' +
      '      <span class="t2-disk">DISK A:</span><span class="t2-disk-led"></span>' +
      '      <span class="t2-tier">TIER ' + host.tier + '</span>' +
      '    </span>' +
      '  </div>' +
      '</div>';

    const rootEl = container.querySelector('.tsic-term--t2');
    const desktop = container.querySelector('.t2-desktop');
    const iconsEl = container.querySelector('#t2-icons');
    const clockEl = container.querySelector('#t2-clock');
    const aboutBtn = container.querySelector('#t2-about-btn');

    let programList = [];
    let destroyed = false;
    const windows = [];        // open window records: { el, content, key, onCloseFns }
    let zTop = 10;             // running z-index handed out on focus
    let openCount = 0;         // cascade slot counter for placing new windows
    let dragState = null;      // one pointer drag at a time across all windows
    let consoleRef = null;     // the open console's engine (single instance)

    // ── Menu-bar clock ─────────────────────────────────────────────
    function tickClock() {
      if (destroyed || !clockEl) return;
      const d = new Date();
      let h = d.getHours();
      const ap = h < 12 ? 'AM' : 'PM';
      h = h % 12; if (h === 0) h = 12;
      clockEl.textContent = pad2(h) + ':' + pad2(d.getMinutes()) + ' ' + ap;
    }
    tickClock();
    const clockTimer = setInterval(tickClock, 15000);

    // ── Desktop icons ──────────────────────────────────────────────
    function nameFor(id) {
      for (let i = 0; i < programList.length; i++) {
        if (programList[i].program.id === id) return programList[i].program.name;
      }
      return id;
    }
    function entryFor(id) {
      for (let i = 0; i < programList.length; i++) {
        if (programList[i].program.id === id) return programList[i];
      }
      return null;
    }
    // A program renders its own UI (in-window) when its granted caps include
    // gfx.canvas; otherwise it's a text app streaming into the window scrollback.
    function isGui(program) {
      const granted = NS.grantedCaps ? NS.grantedCaps(host.tier, (program && program.capabilities) || []) : [];
      return granted.indexOf('gfx.canvas') !== -1;
    }

    function makeTerminalIcon() {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 't2-icon t2-icon-system';
      btn.title = 'Terminal — command console';
      const tile = doc.createElement('span');
      tile.className = 't2-icon-tile';
      tile.innerHTML = ICONS.terminal;
      const label = doc.createElement('span');
      label.className = 't2-icon-label';
      label.textContent = 'Terminal';
      btn.appendChild(tile);
      btn.appendChild(label);
      btn.addEventListener('click', openConsole);
      return btn;
    }

    // A catalogue-style "NEW!" starburst sticker, perched on a flagged icon tile.
    function makeBadge(label) {
      const b = doc.createElement('span');
      b.className = 't2-icon-badge';
      b.textContent = String(label || 'NEW');
      return b;
    }

    function makeProgramIcon(entry) {
      const p = entry.program;
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 't2-icon' + (entry.locked ? ' is-locked' : '');
      btn.title = entry.locked ? (p.name + ' — requires ' + NS.hardwareName(p.minTier)) : p.name;
      const tile = doc.createElement('span');
      tile.className = 't2-icon-tile';
      if (!isGui(p)) tile.innerHTML = ICONS.terminal;            // text / v1 apps look like the terminal
      else if (p.icon && ICONS[p.icon]) tile.innerHTML = ICONS[p.icon];
      else tile.textContent = glyphFor(p.name);                  // fallback: lettered tile
      if (entry.badge) tile.appendChild(makeBadge(entry.badge));
      btn.appendChild(tile);
      const label = doc.createElement('span');
      label.className = 't2-icon-label';
      label.textContent = p.name;
      btn.appendChild(label);
      if (entry.locked) {
        const lock = doc.createElement('span');
        lock.className = 't2-icon-lock';
        lock.textContent = 'LOCKED';
        btn.appendChild(lock);
      }
      btn.addEventListener('click', function () { launch(p.id); });
      return btn;
    }

    // A folder groups programs whose manifest declares folder:"<name>" (e.g. the
    // legacy "V1" text apps). Opening it shows those programs as icons in a window.
    function makeFolderIcon(name, entries) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 't2-icon t2-icon-folder';
      btn.title = name + ' (' + entries.length + ' item' + (entries.length === 1 ? '' : 's') + ')';
      const tile = doc.createElement('span');
      tile.className = 't2-icon-tile';
      if (entries.some(function (e) { return e.badge; })) tile.appendChild(makeBadge('NEW'));   // folder flags if any item inside is new
      btn.appendChild(tile);
      const label = doc.createElement('span');
      label.className = 't2-icon-label';
      label.textContent = name;
      btn.appendChild(label);
      btn.addEventListener('click', function () { openFolder(name, entries); });
      return btn;
    }

    function openFolder(name, entries) {
      if (raiseIfOpen('folder:' + name)) return;
      const rec = makeWindow(name, { key: 'folder:' + name });
      rec.content.classList.add('t2-folder-view');
      const grid = doc.createElement('div');
      grid.className = 't2-icons';
      entries.forEach(function (e) { grid.appendChild(makeProgramIcon(e)); });
      rec.content.appendChild(grid);
    }

    function renderIcons() {
      iconsEl.innerHTML = '';
      iconsEl.appendChild(makeTerminalIcon());   // built-in system console — always present
      if (!programList.length) {
        const empty = doc.createElement('div');
        empty.className = 't2-empty';
        empty.textContent = 'No programs installed. Insert a floppy disk.';
        iconsEl.appendChild(empty);
        return;
      }
      // Root programs render on the desktop; foldered ones collect into folders.
      const folders = new Map();
      programList.forEach(function (entry) {
        const folder = entry.program.folder;
        if (folder) {
          if (!folders.has(folder)) folders.set(folder, []);
          folders.get(folder).push(entry);
          return;
        }
        iconsEl.appendChild(makeProgramIcon(entry));
      });
      folders.forEach(function (entries, folderName) {
        iconsEl.appendChild(makeFolderIcon(folderName, entries));
      });
    }

    // ── Window manager ─────────────────────────────────────────────
    function bringToFront(rec) {
      zTop += 1;
      rec.el.style.zIndex = String(zTop);
      windows.forEach(function (w) { w.el.classList.toggle('is-focused', w === rec); });
    }
    function focusTopmost() {
      let top = null, max = -1;
      windows.forEach(function (w) {
        const z = parseInt(w.el.style.zIndex || '0', 10);
        if (z > max) { max = z; top = w; }
      });
      if (top) bringToFront(top);
    }
    function findByKey(key) {
      if (!key) return null;
      for (let i = 0; i < windows.length; i++) if (windows[i].key === key) return windows[i];
      return null;
    }
    function raiseIfOpen(key) {
      const rec = findByKey(key);
      if (!rec) return false;
      bringToFront(rec);
      return true;
    }

    // Cascade new windows down-right from the top-left so they don't stack
    // exactly on top of each other; clamp to keep them on the desktop.
    function positionWindow(w) {
      const dr = desktop.getBoundingClientRect();
      const step = 24, slot = openCount % 6;
      openCount += 1;
      let left = 24 + slot * step;
      let top = 16 + slot * step;
      const maxL = Math.max(8, dr.width - w.offsetWidth - 8);
      const maxT = Math.max(8, dr.height - w.offsetHeight - 8);
      if (left > maxL) left = maxL;
      if (top > maxT) top = maxT;
      w.style.left = left + 'px';
      w.style.top = top + 'px';
    }

    function makeWindow(title, opts) {
      opts = opts || {};
      const w = doc.createElement('div');
      w.className = 't2-window';
      w.innerHTML =
        '<div class="t2-titlebar">' +
        '  <span class="t2-title"></span>' +
        '  <button class="t2-zoom" type="button" title="Full size"></button>' +
        '  <button class="t2-close" type="button" title="Close">×</button>' +
        '</div>' +
        '<div class="t2-window-body"><div class="t2-content"></div></div>' +
        '<span class="t2-resize" title="Resize"></span>';
      w.querySelector('.t2-title').textContent = (title || 'PROGRAM');
      const rec = { el: w, content: w.querySelector('.t2-content'), key: opts.key || null, onCloseFns: [] };
      if (opts.gui) rec.content.classList.add('t2-content--gui');
      if (opts.width && opts.height) {
        w.style.width = opts.width + 'px';
        w.style.height = opts.height + 'px';
        w.classList.add('is-sized');
      }

      w.querySelector('.t2-close').addEventListener('click', function () { closeWindowRec(rec); });
      w.querySelector('.t2-zoom').addEventListener('click', function () { toggleMax(w); });
      w.addEventListener('pointerdown', function () { bringToFront(rec); }, true);   // click-to-focus
      enableDrag(w.querySelector('.t2-titlebar'), w);
      enableResize(w.querySelector('.t2-resize'), w);

      desktop.appendChild(w);
      windows.push(rec);
      positionWindow(w);
      bringToFront(rec);
      return rec;
    }

    function closeWindowRec(rec) {
      if (!rec) return;
      const fns = rec.onCloseFns; rec.onCloseFns = [];
      fns.forEach(function (fn) { try { fn(); } catch (e) {} });   // kill the program / tear down the console
      if (rec.el && rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
      const i = windows.indexOf(rec); if (i >= 0) windows.splice(i, 1);
      focusTopmost();
    }
    function closeAllWindows() { windows.slice().forEach(closeWindowRec); }

    // Drag the window by its title bar, clamped inside the desktop.
    function enableDrag(handle, w) {
      handle.addEventListener('pointerdown', function (ev) {
        if (ev.target.closest('.t2-close') || ev.target.closest('.t2-zoom')) return;
        if (w.classList.contains('is-max')) return;   // don't drag a maximised window
        const wr = w.getBoundingClientRect();
        dragState = { dx: ev.clientX - wr.left, dy: ev.clientY - wr.top };
        w.classList.add('is-dragging');
        try { handle.setPointerCapture(ev.pointerId); } catch (e) {}
      });
      handle.addEventListener('pointermove', function (ev) {
        if (!dragState) return;
        const dr = desktop.getBoundingClientRect();
        let left = ev.clientX - dr.left - dragState.dx;
        let top = ev.clientY - dr.top - dragState.dy;
        const maxL = dr.width - w.offsetWidth - 4;
        const maxT = dr.height - w.offsetHeight - 4;
        left = left < 4 ? 4 : (left > maxL ? maxL : left);
        top = top < 4 ? 4 : (top > maxT ? maxT : top);
        w.style.left = left + 'px';
        w.style.top = top + 'px';
      });
      function end(ev) {
        if (!dragState) return;
        dragState = null;
        w.classList.remove('is-dragging');
        try { handle.releasePointerCapture(ev.pointerId); } catch (e) {}
      }
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    }

    // Lock the window to an explicit size so resize/maximize have a base to work
    // from (windows otherwise hug their content).
    function ensureSized(w) {
      if (w.classList.contains('is-sized')) return;
      w.style.width = w.offsetWidth + 'px';
      w.style.height = w.offsetHeight + 'px';
      w.classList.add('is-sized');
    }

    // Zoom box: toggle between the window's size and filling the desktop work area.
    function toggleMax(w) {
      if (w.classList.contains('is-max')) {
        const r = w.__restore || {};
        w.style.left = r.left || ''; w.style.top = r.top || '';
        w.style.width = r.width || ''; w.style.height = r.height || '';
        w.classList.remove('is-max');
        return;
      }
      ensureSized(w);
      w.__restore = { left: w.style.left, top: w.style.top, width: w.style.width, height: w.style.height };
      w.style.left = '0px';
      w.style.top = '0px';
      w.style.width = desktop.clientWidth + 'px';
      w.style.height = desktop.clientHeight + 'px';
      w.classList.add('is-max');
    }

    // Bottom-right grow box (GEM / Amiga style): drag to resize, clamped to the desktop.
    function enableResize(grip, w) {
      let rs = null;
      grip.addEventListener('pointerdown', function (ev) {
        if (w.classList.contains('is-max')) return;
        ev.preventDefault();
        ensureSized(w);
        rs = { x: ev.clientX, y: ev.clientY, w: w.offsetWidth, h: w.offsetHeight, left: w.offsetLeft, top: w.offsetTop };
        try { grip.setPointerCapture(ev.pointerId); } catch (e) {}
      });
      grip.addEventListener('pointermove', function (ev) {
        if (!rs) return;
        let width = rs.w + (ev.clientX - rs.x);
        let height = rs.h + (ev.clientY - rs.y);
        const maxW = desktop.clientWidth - rs.left - 2;
        const maxH = desktop.clientHeight - rs.top - 2;
        width = width < 240 ? 240 : (width > maxW ? maxW : width);
        height = height < 130 ? 130 : (height > maxH ? maxH : height);
        w.style.width = width + 'px';
        w.style.height = height + 'px';
      });
      function rend(ev) { if (!rs) return; rs = null; try { grip.releasePointerCapture(ev.pointerId); } catch (e) {} }
      grip.addEventListener('pointerup', rend);
      grip.addEventListener('pointercancel', rend);
    }

    // ── Per-window program I/O ─────────────────────────────────────
    function appendRowTo(content, text, cls) {
      if (!content) return;
      const row = doc.createElement('div');
      row.className = 't2-row' + (cls ? ' ' + cls : '');
      row.textContent = text;
      content.appendChild(row);
      content.scrollTop = content.scrollHeight;
      return row;
    }

    function windowReadLine(content, prompt) {
      if (!content) return Promise.resolve('');
      return new Promise(function (resolve) {
        const row = doc.createElement('div');
        row.className = 't2-inputline';
        const pr = doc.createElement('span');
        pr.className = 't2-input-prompt';
        pr.textContent = prompt || '';
        const inp = doc.createElement('input');
        inp.className = 't2-input';
        inp.setAttribute('autocomplete', 'off');
        inp.setAttribute('spellcheck', 'false');
        row.appendChild(pr);
        row.appendChild(inp);
        content.appendChild(row);
        content.scrollTop = content.scrollHeight;
        try { inp.focus({ preventScroll: true }); } catch (e) {}
        inp.addEventListener('keydown', function (ev) {
          if (ev.key !== 'Enter') return;
          const v = inp.value;
          row.removeChild(inp);                          // freeze the answered line as echoed text
          pr.textContent = (prompt ? prompt + ' ' : '') + v;
          row.className = 't2-row t2-echo';
          resolve(v);
        });
      });
    }

    function showWindowError(rec, res, name) {
      const content = rec.content;
      content.classList.remove('t2-content--gui');   // read the error on a normal scrollback
      if (res.code === NS.ERR.TIER_TOO_LOW) {
        appendRowTo(content, 'CANNOT OPEN ' + String(name || '').toUpperCase(), 't2-err');
        appendRowTo(content, 'Requires ' + NS.hardwareName(res.info.required) + ' (tier ' + res.info.required + ').', 't2-err');
        appendRowTo(content, 'This unit is ' + NS.hardwareName(res.info.current) + ' (tier ' + res.info.current + ').', 't2-err');
        return;
      }
      if (res.code === NS.ERR.NOT_UNLOCKED || res.code === NS.ERR.NOT_FOUND) {
        appendRowTo(content, 'PROGRAM NOT FOUND ON THIS UNIT.', 't2-err');
        appendRowTo(content, 'Did you insert the floppy disk?', 't2-err');
        return;
      }
      appendRowTo(content, 'ERROR: ' + res.code, 't2-err');
    }

    // A program window's sink: where its I/O and lifecycle land. The screen binds
    // the runtime's callbacks to this, and onClose lets the close box kill it.
    function makeWindowSink(rec) {
      return {
        container: rec.content,
        print: function (text) { appendRowTo(rec.content, String(text)); },
        clear: function () { rec.content.innerHTML = ''; },
        requestInput: function (prompt) { return windowReadLine(rec.content, prompt); },
        setTheme: function (name) { rootEl.classList.toggle('tsic-term--theme-red', name === 'red'); },
        reboot: function () { closeWindowRec(rec); },
        endProgram: function () { closeWindowRec(rec); },
        onClose: function (fn) { rec.onCloseFns.push(fn); },
      };
    }

    // ── Launch a program into its own window ───────────────────────
    function launch(id) {
      const entry = entryFor(id);
      const program = entry ? entry.program : { id: id, name: nameFor(id), capabilities: [] };
      if (raiseIfOpen('app:' + id)) return;   // single instance — raise the open one
      const gui = isGui(program);
      const rec = makeWindow(program.name || nameFor(id),
        gui ? { key: 'app:' + id, gui: true, width: 620, height: 430 } : { key: 'app:' + id });
      const sink = makeWindowSink(rec);
      host.run(id, { sink: sink }).then(function (res) {
        if (res && !res.ok) showWindowError(rec, res, program.name || nameFor(id));
      });
    }

    function showAbout() {
      if (raiseIfOpen('about')) return;
      const rec = makeWindow('About Durham OS', { key: 'about' });
      const c = rec.content;
      appendRowTo(c, 'DURHAM-OS  GRAPHICAL ENVIRONMENT');
      appendRowTo(c, 'VERSION 2.0  (EXPERIMENTAL BUILD)');
      appendRowTo(c, '');
      appendRowTo(c, '© 1986 DURHAM HOME FURNISHINGS');
      appendRowTo(c, 'ALL FLOORS. ALL HOURS. ALWAYS OPEN.');
      appendRowTo(c, '');
      appendRowTo(c, 'Report faults to KATIE (IT) in the back office.');
    }
    aboutBtn.addEventListener('click', showAbout);

    // ── Terminal console (the shared command-line engine, in a window) ──
    function openConsole() {
      if (raiseIfOpen('console')) return;   // single console window
      const rec = makeWindow('Terminal', { key: 'console' });
      const cContent = rec.content;
      cContent.classList.add('t2-console');
      const line = doc.createElement('div');
      line.className = 't2-console-line';
      line.innerHTML =
        '<span class="t2-console-prompt">A&gt;</span>' +
        '<span class="t2-console-mirror"></span>' +
        '<span class="t2-console-cursor"></span>' +
        '<input class="t2-console-input" autocomplete="off" spellcheck="false" data-tsic-initial-focus>';
      cContent.appendChild(line);
      const promptEl = line.querySelector('.t2-console-prompt');
      const mirror = line.querySelector('.t2-console-mirror');
      const cInput = line.querySelector('.t2-console-input');
      function syncMirror() { mirror.textContent = cInput.value; }
      cInput.addEventListener('input', syncMirror);

      const view = {
        appendRow: function (cls) {
          const div = doc.createElement('div');
          div.className = 't2-row' + (cls ? ' ' + mapCls(cls) : '');
          cContent.insertBefore(div, line);   // output flows above the command line
          return { setText: function (s) { div.textContent = s; } };
        },
        clearRows: function () {
          const rows = cContent.querySelectorAll('.t2-row');
          for (let i = 0; i < rows.length; i++) rows[i].remove();
        },
        scrollToEnd: function () { cContent.scrollTop = cContent.scrollHeight; },
        setBooting: function (b) { line.style.visibility = b ? 'hidden' : ''; },
        setReady: function () { try { cInput.focus({ preventScroll: true }); } catch (e) {} },
        setPromptVisible: function (b) { promptEl.style.visibility = b ? '' : 'hidden'; },
        clearInput: function () { cInput.value = ''; syncMirror(); },
        focusInput: function () { try { cInput.focus({ preventScroll: true }); } catch (e) {} },
        applyTheme: function (name) { rootEl.classList.toggle('tsic-term--theme-red', name === 'red'); },
        alive: function () { return !destroyed && !!cContent && cContent.isConnected; },
        getCharDelay: function () { return NS.shells.tier2.charDelayMs; },
        getCharsPerTick: function () { return NS.shells.tier2.charsPerTick; },
      };

      // Text programs RUN from the console stream inline (this sink wraps the
      // engine's program-I/O); GUI programs get their own window (see run below).
      const consoleKillFns = [];
      const consoleSink = {
        print: function (t, o) { if (consoleCore) consoleCore.printToProgram(t, o); },
        clear: function () { if (consoleCore) consoleCore.clearScreen(); },
        requestInput: function (p) { return consoleCore ? consoleCore.beginProgramInput(p) : Promise.resolve(''); },
        setTheme: function (n) { if (consoleCore) consoleCore.setTheme(n); },
        reboot: function () { if (consoleCore) consoleCore.reboot(); },
        endProgram: function () { if (consoleCore) consoleCore.endProgram(); },
        onClose: function (fn) { consoleKillFns.push(fn); },
      };

      const consoleHost = {
        tier: host.tier,
        run: function (id) {
          const e = entryFor(id);
          if (e && isGui(e.program)) { launch(id); return Promise.resolve({ ok: true }); }   // GUI → its own window
          return host.run(id, { sink: consoleSink });                                          // text → inline
        },
        close: function () { closeWindowRec(rec); },   // EXIT closes the console, back to the desktop
        autoRun: null,
      };

      const consoleCore = NS.createConsole(view, consoleHost, { prompt: 'A>', bootLines: CONSOLE_BANNER, bootLogo: null });
      consoleRef = consoleCore;
      consoleCore.onPrograms(programList);   // so HELP / DIR lists the installed programs
      rec.onCloseFns.push(function () {
        consoleCore.destroy();
        consoleKillFns.forEach(function (f) { try { f(); } catch (e) {} });   // kill a program running inline
        if (consoleRef === consoleCore) consoleRef = null;
      });

      cInput.addEventListener('keydown', function (ev) {
        if (consoleCore.isBooting()) { ev.preventDefault(); consoleCore.skipBoot(); return; }
        if (ev.key !== 'Enter') return;
        const v = cInput.value;
        cInput.value = ''; syncMirror();
        consoleCore.submitLine(v);
      });
      try { cInput.focus({ preventScroll: true }); } catch (e) {}
    }

    // Auto-launch a program on first boot (deep-link / scripted entry).
    if (host.autoRun) {
      setTimeout(function () { if (!destroyed) launch(host.autoRun); }, 0);
    }

    // ── Shell contract consumed by shared/screens/terminal.js ──────
    return {
      onPrograms: function (entries) {
        programList = entries || [];
        renderIcons();
        if (consoleRef) consoleRef.onPrograms(programList);
      },
      destroy: function () {
        destroyed = true;
        clearInterval(clockTimer);
        closeAllWindows();
        container.innerHTML = '';
      },
    };
  }

  NS.shells.tier2 = { create: create, charDelayMs: 6, charsPerTick: 3 };
})(window);
