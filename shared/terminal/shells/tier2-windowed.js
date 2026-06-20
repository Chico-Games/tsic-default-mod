// shared/terminal/shells/tier2-windowed.js
//
// Tier-2 "Durham GUI Terminal (Experimental)" shell: an early-1980s graphical
// desktop (GEM / Amiga Workbench era) skinned in the store's magazine-catalogue
// livery — cream paper, heavy black borders, hard offset block shadows, a
// mag-red title bar, mag-yellow selection. Unlocked programs render as desktop
// icons; launching one opens a draggable beveled window that hosts the
// program's text I/O (the same print / readLine / clear contract tier-1 uses).
// A subtle CRT overlay is retained from tier-1 (see terminal.css) for
// continuity. Chrome lives here; wiring lives in shared/screens/terminal.js.
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

  function create(container, host) {
    const doc = container.ownerDocument;
    const hw = NS.hardwareName(host.tier);

    container.innerHTML =
      '<div class="tsic-term tsic-term--t2">' +
      '  <div class="t2-menubar">' +
      '    <span class="t2-brand"><span class="t2-brand-mark">▤</span>DURHAM</span>' +
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
    let win = null;            // current window element (single-window model)
    let content = null;        // window's scrollable content well
    let dragState = null;
    let destroyed = false;
    let consoleCore = null;    // shared console engine while the Terminal is open
    let activeSink = null;     // where a running program's I/O goes: 'console' | 'window'

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

    function makeTerminalIcon() {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 't2-icon t2-icon-system';
      btn.title = 'Terminal — command console';
      const tile = doc.createElement('span');
      tile.className = 't2-icon-tile';
      tile.textContent = '>_';
      const label = doc.createElement('span');
      label.className = 't2-icon-label';
      label.textContent = 'Terminal';
      btn.appendChild(tile);
      btn.appendChild(label);
      btn.addEventListener('click', openConsole);
      return btn;
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
      programList.forEach(function (entry) {
        const p = entry.program;
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 't2-icon' + (entry.locked ? ' is-locked' : '');
        btn.title = entry.locked
          ? (p.name + ' — requires ' + NS.hardwareName(p.minTier))
          : p.name;

        const tile = doc.createElement('span');
        tile.className = 't2-icon-tile';
        tile.textContent = glyphFor(p.name);
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
        iconsEl.appendChild(btn);
      });
    }

    // ── Window lifecycle ───────────────────────────────────────────
    function closeWindow() {
      if (consoleCore) { consoleCore.destroy(); consoleCore = null; }
      activeSink = null;
      if (win && win.parentNode) win.parentNode.removeChild(win);
      win = null;
      content = null;
    }

    function centerWindow(w) {
      const dr = desktop.getBoundingClientRect();
      let left = Math.round((dr.width - w.offsetWidth) / 2);
      let top = Math.round((dr.height - w.offsetHeight) / 2.6);
      if (left < 8) left = 8;
      if (top < 8) top = 8;
      w.style.left = left + 'px';
      w.style.top = top + 'px';
    }

    function openWindow(title) {
      closeWindow();
      win = doc.createElement('div');
      win.className = 't2-window';
      win.innerHTML =
        '<div class="t2-titlebar">' +
        '  <button class="t2-close" type="button" title="Close">×</button>' +
        '  <span class="t2-title"></span>' +
        '  <span class="t2-titlebar-grip"></span>' +
        '</div>' +
        '<div class="t2-window-body"><div class="t2-content"></div></div>';
      win.querySelector('.t2-title').textContent = (title || 'PROGRAM');
      content = win.querySelector('.t2-content');

      win.querySelector('.t2-close').addEventListener('click', function () {
        if (host.stop) host.stop();   // terminate the running program
        closeWindow();
      });
      enableDrag(win.querySelector('.t2-titlebar'), win);
      desktop.appendChild(win);
      centerWindow(win);
    }

    // Drag the window by its title bar, clamped inside the desktop.
    function enableDrag(handle, w) {
      handle.addEventListener('pointerdown', function (ev) {
        if (ev.target.closest('.t2-close')) return;
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

    // ── Program text I/O (GUIs render instantly — no typewriter queue) ──
    function appendRow(text, cls) {
      if (!content) return;
      const row = doc.createElement('div');
      row.className = 't2-row' + (cls ? ' ' + cls : '');
      row.textContent = text;
      content.appendChild(row);
      content.scrollTop = content.scrollHeight;
      return row;
    }

    function showError(res, name) {
      if (!content) openWindow(name);
      if (res.code === NS.ERR.TIER_TOO_LOW) {
        appendRow('CANNOT OPEN ' + String(name || '').toUpperCase(), 't2-err');
        appendRow('Requires ' + NS.hardwareName(res.info.required) + ' (tier ' + res.info.required + ').', 't2-err');
        appendRow('This unit is ' + NS.hardwareName(res.info.current) + ' (tier ' + res.info.current + ').', 't2-err');
        return;
      }
      if (res.code === NS.ERR.NOT_UNLOCKED || res.code === NS.ERR.NOT_FOUND) {
        appendRow('PROGRAM NOT FOUND ON THIS UNIT.', 't2-err');
        appendRow('Did you insert the floppy disk?', 't2-err');
        return;
      }
      appendRow('ERROR: ' + res.code, 't2-err');
    }

    function launch(id) {
      openWindow(nameFor(id));
      activeSink = 'window';
      host.run(id).then(function (res) {
        if (!res || res.ok) return;
        showError(res, nameFor(id));
      });
    }

    function showAbout() {
      openWindow('About Durham OS');
      appendRow('DURHAM-OS  GRAPHICAL ENVIRONMENT');
      appendRow('VERSION 2.0  (EXPERIMENTAL BUILD)');
      appendRow('');
      appendRow('© 1986 DURHAM HOME FURNISHINGS');
      appendRow('ALL FLOORS. ALL HOURS. ALWAYS OPEN.');
      appendRow('');
      appendRow('Report faults to KATIE (IT) in the back office.');
    }
    aboutBtn.addEventListener('click', showAbout);

    // ── Terminal console (the shared command-line engine, in a window) ──
    function openConsole() {
      openWindow('Terminal');
      const cContent = content;             // stable ref for the engine's view
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

      // The console can launch the other apps: its host.run is the real one, but
      // it marks the console as the sink so program I/O routes back here (inline).
      const consoleHost = {
        tier: host.tier,
        run: function (id) {
          activeSink = 'console';
          return host.run(id).then(function (res) { if (!res || !res.ok) activeSink = null; return res; });
        },
        close: function () { closeWindow(); },   // EXIT closes the console, back to the desktop
        autoRun: null,
      };

      consoleCore = NS.createConsole(view, consoleHost, { prompt: 'A>', bootLines: CONSOLE_BANNER, bootLogo: null });
      consoleCore.onPrograms(programList);   // so HELP / DIR lists the installed programs

      cInput.addEventListener('keydown', function (ev) {
        if (consoleCore && consoleCore.isBooting()) { ev.preventDefault(); consoleCore.skipBoot(); return; }
        if (ev.key !== 'Enter') return;
        const v = cInput.value;
        cInput.value = ''; syncMirror();
        if (consoleCore) consoleCore.submitLine(v);
      });
      try { cInput.focus({ preventScroll: true }); } catch (e) {}
    }

    // Auto-launch a program on first boot (deep-link / scripted entry).
    if (host.autoRun) {
      setTimeout(function () { if (!destroyed) launch(host.autoRun); }, 0);
    }

    // ── Shell contract consumed by shared/screens/terminal.js ──────
    return {
      onPrograms: function (entries) { programList = entries || []; renderIcons(); if (consoleCore) consoleCore.onPrograms(programList); },
      printToProgram: function (text, opts) {
        if (activeSink === 'console' && consoleCore) { consoleCore.printToProgram(text, opts); return; }
        appendRow(String(text));
      },
      clearScreen: function () {
        if (activeSink === 'console' && consoleCore) { consoleCore.clearScreen(); return; }
        if (content) content.innerHTML = '';
      },
      beginProgramInput: function (prompt) {
        if (activeSink === 'console' && consoleCore) return consoleCore.beginProgramInput(prompt);
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
            // Freeze the answered line as echoed text.
            row.removeChild(inp);
            pr.textContent = (prompt ? prompt + ' ' : '') + v;
            row.className = 't2-row t2-echo';
            resolve(v);
          });
        });
      },
      setTheme: function (name) {
        if (activeSink === 'console' && consoleCore) { consoleCore.setTheme(name); return; }
        rootEl.classList.toggle('tsic-term--theme-red', name === 'red');
      },
      reboot: function () {
        if (activeSink === 'console' && consoleCore) { activeSink = null; consoleCore.reboot(); return; }
        closeWindow();
      },
      endProgram: function () {
        if (activeSink === 'console' && consoleCore) { activeSink = null; consoleCore.endProgram(); return; }
        closeWindow();
      },
      destroy: function () {
        destroyed = true;
        clearInterval(clockTimer);
        closeWindow();
        container.innerHTML = '';
      },
    };
  }

  NS.shells.tier2 = { create: create, charDelayMs: 6, charsPerTick: 3 };
})(window);
