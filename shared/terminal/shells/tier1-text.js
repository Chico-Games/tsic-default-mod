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
    let printQueue = [];      // program output, typed one line at a time, in order
    let draining = false;
    let drainWaiters = [];
    let programActive = false; // a program owns the screen (suppress shell commands)

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
    function type(text, cls, delayMs, charsPerStep) {
      const div = document.createElement('div');
      div.className = 'tsic-term-row' + (cls ? ' ' + cls : '');
      out.appendChild(div);
      return new Promise(function (resolve) {
        const delay = (delayMs != null) ? delayMs : NS.shells.tier1.charDelayMs;
        // Reveal multiple chars per tick when asked — the ~4ms setTimeout floor
        // means per-char stepping can't go faster than ~4ms/char otherwise.
        const step = (charsPerStep > 0) ? charsPerStep : 1;
        if (skipped || !(delay > 0)) { div.textContent = text; out.scrollTop = out.scrollHeight; resolve(); return; }
        let i = 0;
        (function tick() {
          if (skipped) { div.textContent = text; out.scrollTop = out.scrollHeight; resolve(); return; }
          i += step;
          div.textContent = text.slice(0, i);
          out.scrollTop = out.scrollHeight;
          if (i >= text.length) { resolve(); return; }
          setTimeout(tick, delay);
        })();
      });
    }

    // Program output (term.print) types out fast, queued so the rapid-fire
    // prints a program emits stay in order. readLine/exit wait for the queue to
    // drain (see whenDrained) so prompts and theme resets don't race the text.
    function pumpQueue() {
      if (draining) return;
      draining = true;
      (function next() {
        if (!printQueue.length) {
          draining = false;
          const waiters = drainWaiters; drainWaiters = [];
          waiters.forEach(function (w) { w(); });
          return;
        }
        type(printQueue.shift(), null, NS.shells.tier1.progCharDelayMs, NS.shells.tier1.progCharsPerTick).then(next);
      })();
    }
    function whenDrained() {
      if (!draining && !printQueue.length) return Promise.resolve();
      return new Promise(function (res) { drainWaiters.push(res); });
    }

    // Mark the terminal ready: reveal the prompt and accept commands. Called
    // once the boot animation completes (or is skipped / unavailable).
    function finishBoot() {
      booting = false;
      skipped = false; // boot-only flag; clear it so program output still types
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
      if (programActive) return; // a program owns the screen but isn't at a prompt
      doCommand(value);
    }
    input.addEventListener('keydown', onKey);
    focusInput();

    return {
      onPrograms: function (entries) { programList = entries || []; },
      printToProgram: function (text) { programActive = true; printQueue.push(String(text)); pumpQueue(); },
      beginProgramInput: function (prompt) {
        programActive = true;
        input.value = ''; syncMirror();  // discard anything typed while text was still printing
        return whenDrained().then(function () {
          const typedPrompt = prompt ? type(String(prompt), null, NS.shells.tier1.progCharDelayMs, NS.shells.tier1.progCharsPerTick) : Promise.resolve();
          return typedPrompt.then(function () {
            promptEl.style.visibility = 'hidden';
            return new Promise(function (res) { inputResolver = res; });
          });
        });
      },
      setTheme: applyTheme,
      endProgram: function () {
        inputResolver = null;
        whenDrained().then(function () {
          programActive = false;
          promptEl.style.visibility = '';
          applyTheme(null);
          focusInput();
        });
      },
      destroy: function () {
        input.removeEventListener('keydown', onKey);
        input.removeEventListener('input', syncMirror);
        container.removeEventListener('mousedown', onPointerDown);
        container.innerHTML = '';
      },
    };
  }

  // charDelayMs      — tick interval of the BIOS boot animation (tests set 0).
  // progCharDelayMs  — tick interval for program output (term.print).
  // progCharsPerTick — chars revealed per tick for program output. The two
  //   together make program text type out near-instantly while still revealing.
  NS.shells.tier1 = { create: create, charDelayMs: 14, progCharDelayMs: 4, progCharsPerTick: 16 };
})(window);
