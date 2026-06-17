// shared/terminal/shells/tier1-text.js
//
// Tier-1 "Durham Internal Terminal" shell: an 80s text command line that
// doubles as the program launcher. Owns chrome + the prompt; delegates
// program execution to host.run (the screen wires that to the runtime).
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};
  NS.shells = NS.shells || {};

  function create(container, host) {
    const hw = NS.hardwareName(host.tier);
    container.innerHTML =
      '<div class="tsic-term tsic-term--t1">' +
      '  <div class="tsic-term-out" id="term-out"></div>' +
      '  <div class="tsic-term-line" id="term-line">' +
      '    <span class="tsic-term-prompt">&gt;</span>' +
      '    <span class="tsic-term-mirror" id="term-mirror"></span>' +
      '    <span class="tsic-term-cursor" id="term-cursor"></span>' +
      '    <input class="tsic-term-input" id="term-input" autocomplete="off" spellcheck="false" data-tsic-initial-focus>' +
      '  </div>' +
      '</div>';

    const out = container.querySelector('#term-out');
    const promptEl = container.querySelector('.tsic-term-prompt');
    const mirror = container.querySelector('#term-mirror');
    const input = container.querySelector('#term-input');
    const rootEl = container.querySelector('.tsic-term--t1');
    let programList = [];
    let inputResolver = null; // set while a running program awaits readLine
    let booting = false;      // true while the BIOS boot animation plays
    let skipped = false;      // set by a keypress to fast-forward the boot

    // The real <input> is invisible; the visible input is an uppercased mirror
    // of its value followed by the block cursor. Keep them in sync.
    function syncMirror() { mirror.textContent = input.value.toUpperCase(); }
    input.addEventListener('input', syncMirror);

    // The real input is off the visible flow, so clicking the green screen
    // can't focus it natively. Re-focus on any press, and once on mount, so the
    // user can actually type. preventDefault stops the browser's default
    // mousedown focus from moving focus to the (non-focusable) screen div and
    // overriding ours.
    function focusInput() { try { input.focus({ preventScroll: true }); } catch (e) {} }
    // Programs can recolour the terminal via term.theme(name); reset on exit.
    function applyTheme(name) { rootEl.classList.toggle('tsic-term--theme-red', name === 'red'); }
    function onPointerDown(ev) { ev.preventDefault(); focusInput(); }
    container.addEventListener('mousedown', onPointerDown);

    function write(text, cls) {
      const div = document.createElement('div');
      div.className = 'tsic-term-row' + (cls ? ' ' + cls : '');
      div.textContent = text;
      out.appendChild(div);
      out.scrollTop = out.scrollHeight;
    }

    // Typewriter: append `text` one character at a time into its own row, then
    // resolve. A set `skipped` flag (or a non-positive charDelayMs) flushes the
    // whole line instantly so the boot animation can be fast-forwarded.
    function type(text, cls) {
      const div = document.createElement('div');
      div.className = 'tsic-term-row' + (cls ? ' ' + cls : '');
      out.appendChild(div);
      return new Promise(function (resolve) {
        const delay = NS.shells.tier1.charDelayMs;
        if (skipped || !(delay > 0)) { div.textContent = text; out.scrollTop = out.scrollHeight; resolve(); return; }
        let i = 0;
        (function tick() {
          if (skipped) { div.textContent = text; out.scrollTop = out.scrollHeight; resolve(); return; }
          i += 1;
          div.textContent = text.slice(0, i);
          out.scrollTop = out.scrollHeight;
          if (i >= text.length) { resolve(); return; }
          setTimeout(tick, delay);
        })();
      });
    }

    // Mark the terminal ready: reveal the prompt and accept commands. Called
    // once the boot animation completes (or is skipped / unavailable).
    function finishBoot() {
      booting = false;
      rootEl.classList.remove('is-booting');
      rootEl.setAttribute('data-term-ready', '1');
      focusInput();
      // Optionally boot straight into a program (host.autoRun is a program id);
      // otherwise show the HELP screen so the operator sees what they can do.
      if (host.autoRun) {
        write('> run ' + host.autoRun, 'tsic-term-echo');
        host.run(host.autoRun).then(function (res) { if (!res.ok) renderError(res, host.autoRun); });
      } else {
        printHelp();
      }
    }

    // BIOS-style boot animation, then hand off to the prompt. The prompt is
    // hidden (via .is-booting) until the sequence finishes.
    if (NS.boot && typeof NS.boot.runBoot === 'function') {
      booting = true;
      rootEl.classList.add('is-booting');
      NS.boot.runBoot(
        { type: function (t, o) { return type(t, o && o.className); },
          print: function (t, o) { write(t, o && o.className); } },
        { logo: NS.boot.DURHAM_LOGO }
      ).then(finishBoot, finishBoot);
    } else {
      // Defensive fallback if the boot module didn't load.
      write(hw.toUpperCase(), 'tsic-term-banner');
      write('READY', 'tsic-term-banner');
      finishBoot();
    }

    function renderError(res, programId) {
      if (res.code === NS.ERR.TIER_TOO_LOW) {
        write('ERROR 0x02: INCOMPATIBLE HARDWARE', 'tsic-term-err');
        write('  ' + programId.toUpperCase() + ' requires ' + NS.hardwareName(res.info.required) + ' (tier ' + res.info.required + ').', 'tsic-term-err');
        write('  This unit is ' + NS.hardwareName(res.info.current) + ' (tier ' + res.info.current + '). Upgrade hardware to run.', 'tsic-term-err');
        return;
      }
      // No floppy inserted (NOT_UNLOCKED) or no such program (NOT_FOUND) read the
      // same to the operator: the app isn't on this unit.
      if (res.code === NS.ERR.NOT_UNLOCKED || res.code === NS.ERR.NOT_FOUND) {
        write('ERROR 0x03: UNKNOWN APPLICATION', 'tsic-term-err');
        write('  PROGRAM ' + programId.toUpperCase() + ' NOT FOUND ON THIS UNIT.', 'tsic-term-err');
        write('  DID YOU INSERT THE FLOPPY DISK?', 'tsic-term-err');
        return;
      }
      write('ERROR: ' + res.code, 'tsic-term-err');
    }

    // Renders the installed-program list for HELP.
    function printProgramList() {
      if (!programList.length) { write('  No programs installed. Find a floppy disk.'); return; }
      programList.forEach(function (e) {
        const tag = e.locked ? '  [LOCKED — req. ' + NS.hardwareName(e.program.minTier) + ']' : '';
        write('  ' + e.program.name + '  (' + e.program.id + ')' + tag);
      });
    }

    // The HELP screen: command list + installed programs. Shown on boot and on
    // the HELP command so it always reflects what's actually installed.
    function printHelp() {
      write('Commands: HELP  RUN <name>  CLEAR  EXIT');
      write('  (or just type a program name to run it)');
      write('');
      write('Installed programs:');
      printProgramList();
    }

    function doCommand(raw) {
      const text = raw.trim();
      write('> ' + text, 'tsic-term-echo');
      if (!text) return;
      const parts = text.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      if (cmd === 'help') { printHelp(); return; }
      if (cmd === 'clear') { out.innerHTML = ''; return; }
      if (cmd === 'exit') { host.close(); return; }
      const id = (cmd === 'run') ? parts[1] : parts[0];
      if (!id) { write('Usage: RUN <name>', 'tsic-term-err'); return; }
      host.run(id).then(function (res) {
        if (!res.ok) renderError(res, id);
      });
    }

    function onKey(ev) {
      if (booting) { ev.preventDefault(); skipped = true; return; } // any key fast-forwards the boot
      if (ev.key !== 'Enter') return;
      const value = input.value;
      input.value = '';
      syncMirror();
      if (inputResolver) { // program is awaiting input
        const r = inputResolver; inputResolver = null;
        write('> ' + value, 'tsic-term-echo');
        r(value);
        return;
      }
      doCommand(value);
    }
    input.addEventListener('keydown', onKey);
    focusInput();

    return {
      onPrograms: function (entries) { programList = entries || []; },
      printToProgram: function (text) { write(text); },
      beginProgramInput: function (prompt) {
        if (prompt) write(prompt);
        promptEl.style.visibility = 'hidden';
        return new Promise(function (res) { inputResolver = res; });
      },
      setTheme: applyTheme,
      endProgram: function () { inputResolver = null; promptEl.style.visibility = ''; applyTheme(null); input.focus(); },
      destroy: function () {
        input.removeEventListener('keydown', onKey);
        input.removeEventListener('input', syncMirror);
        container.removeEventListener('mousedown', onPointerDown);
        container.innerHTML = '';
      },
    };
  }

  // charDelayMs is the per-character typewriter speed for the boot animation;
  // tests set it to 0 to make boot instant.
  NS.shells.tier1 = { create: create, charDelayMs: 14 };
})(window);
