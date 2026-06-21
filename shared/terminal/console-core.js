// shared/terminal/console-core.js
//
// The interactive command-console engine shared by every terminal shell: the
// typewriter output queue, the command interpreter (HELP / RUN / CLEAR / EXIT +
// run-by-name), the boot sequence, launch-error rendering, and the program-I/O
// bridge that shared/screens/terminal.js drives (printToProgram / readLine /
// clear / theme / reboot / exit). Pure logic — every DOM/chrome detail lives
// behind the `view` adapter, so the green-CRT tier-1 shell and the grey-GUI
// tier-2 console render the SAME behaviour with different skins.
//
// view contract:
//   appendRow(cls) -> { setText(str) }   create a scrollback row; return a setter
//   clearRows()                          remove all scrollback rows
//   scrollToEnd()
//   setBooting(bool)                     toggle the booting state (hides the prompt)
//   setReady(bool)                       mark the prompt live (e.g. data-term-ready)
//   setPromptVisible(bool)               show/hide the command prompt (program readLine)
//   clearInput()                         clear the prompt's input field
//   focusInput()
//   applyTheme(name)                     null | 'red'
//   alive() -> bool                      false once torn down
//   getCharDelay() -> ms                 typewriter tick interval (read live)
//   getCharsPerTick() -> n               chars revealed per tick (read live)
//
// host contract (identical to what the shells received before):
//   tier, run(id) -> Promise<{ok}|{ok:false,code,info}>, close(), autoRun
//
// opts: { prompt: '>' , bootLines: [{text,className}], bootLogo: string|null }
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};

  function createConsole(view, host, opts) {
    opts = opts || {};
    const promptStr = opts.prompt || '>';

    let destroyed = false;
    let programList = [];
    let inputResolver = null;   // set while a running program awaits readLine
    let skipped = false;        // fast-forward the current typewriter / boot
    let booting = false;
    let programActive = false;  // a program owns the screen (suppress shell commands)
    let pendingAutoRun = host.autoRun || null;

    const printQueue = [];
    let draining = false;
    let drainWaiters = [];

    function alive() { return !destroyed && view.alive(); }

    // ── Typewriter ────────────────────────────────────────
    // Append `text` one tick at a time. Per-line opts {charDelay, jitter,
    // charsPerTick} let a program pick a custom (e.g. slow, uneven) cadence; a
    // set `skipped` flag (or charDelay <= 0) flushes the rest instantly.
    function type(text, cls, o) {
      if (!alive()) return Promise.resolve();
      o = o || {};
      const delay = (o.charDelay != null) ? o.charDelay : view.getCharDelay();
      const step = (o.charsPerTick > 0) ? o.charsPerTick
        : (view.getCharsPerTick() > 0 ? view.getCharsPerTick() : 1);
      const jitter = o.jitter || 0;
      const row = view.appendRow(cls);
      return new Promise(function (resolve) {
        if (skipped || !(delay > 0)) { row.setText(text); view.scrollToEnd(); resolve(); return; }
        let i = 0;
        (function tick() {
          if (skipped) { row.setText(text); view.scrollToEnd(); resolve(); return; }
          i += step;
          row.setText(text.slice(0, i));
          view.scrollToEnd();
          if (i >= text.length) { resolve(); return; }
          setTimeout(tick, delay + (jitter ? Math.random() * jitter : 0));
        })();
      });
    }
    function writeInstant(text, cls) { return type(text, cls, { charDelay: 0 }); }

    // ── Output queue ──────────────────────────────────────
    // ALL output — shell text AND program output — flows through one queue, so
    // everything types out in order. readLine / exit wait for the queue to
    // drain (whenDrained) so prompts and theme resets don't race the typing.
    function enqueue(text, cls, o) { printQueue.push({ kind: 'line', text: String(text), cls: cls || null, opts: o || null }); pumpQueue(); }
    function enqueueClear() { printQueue.push({ kind: 'clear' }); pumpQueue(); }
    function pumpQueue() {
      if (draining) return;
      draining = true;
      (function next() {
        if (destroyed || !printQueue.length) {
          draining = false;
          const waiters = drainWaiters; drainWaiters = [];
          waiters.forEach(function (w) { w(); });
          return;
        }
        const item = printQueue.shift();
        if (item.kind === 'clear') { if (alive()) view.clearRows(); next(); return; }
        type(item.text, item.cls, item.opts).then(next);
      })();
    }
    function whenDrained() {
      if (!draining && !printQueue.length) return Promise.resolve();
      return new Promise(function (res) { drainWaiters.push(res); });
    }
    function write(text, cls) { enqueue(text, cls); }

    // ── Boot ──────────────────────────────────────────────
    function finishBoot() {
      booting = false;
      skipped = false;
      view.setBooting(false);
      view.setReady(true);
      view.focusInput();
      // Boot straight into a program on the FIRST boot only; otherwise show HELP
      // so the operator sees what they can do.
      if (pendingAutoRun) {
        const id = pendingAutoRun; pendingAutoRun = null;
        write(promptStr + ' run ' + id, 'tsic-term-echo');
        host.run(id).then(function (res) { if (!res.ok) renderError(res, id); });
      } else {
        printHelp();
      }
    }
    function bootSequence() {
      skipped = false;
      const lines = opts.bootLines || (NS.boot && NS.boot.BOOT_LINES) || [];
      const logo = (opts.bootLogo !== undefined) ? opts.bootLogo : (NS.boot && NS.boot.DURHAM_LOGO);
      if (NS.boot && typeof NS.boot.runBoot === 'function') {
        booting = true;
        view.setBooting(true);
        NS.boot.runBoot(
          { type: function (t, o) { return type(t, o && o.className); },
            print: function (t, o) { writeInstant(t, o && o.className); } },
          { lines: lines, logo: logo }
        ).then(finishBoot, finishBoot);
      } else {
        finishBoot();
      }
    }

    // ── Launch errors / HELP ──────────────────────────────
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
    function printProgramList() {
      if (!programList.length) { write('  No programs installed. Find a floppy disk.'); return; }
      programList.forEach(function (e) {
        const tag = e.locked ? '  [LOCKED — req. ' + NS.hardwareName(e.program.minTier) + ']'
          : (e.badge ? '  * ' + String(e.badge) : '');
        write('  ' + e.program.name + tag);
      });
    }
    function printHelp() {
      write('Commands: HELP  RUN <name>  CLEAR  EXIT');
      write('  (or just type a program name to run it)');
      write('');
      write('Installed programs:');
      printProgramList();
    }

    // ── Command line ──────────────────────────────────────
    function doCommand(raw) {
      const text = raw.trim();
      write(promptStr + ' ' + text, 'tsic-term-echo');
      if (!text) return;
      const parts = text.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      if (cmd === 'help' || cmd === '?') { printHelp(); return; }
      if (cmd === 'clear' || cmd === 'cls') { printQueue.length = 0; if (alive()) view.clearRows(); return; }
      if (cmd === 'exit' || cmd === 'quit') { host.close(); return; }
      const id = (cmd === 'run') ? parts[1] : parts[0];
      if (!id) { write('Usage: RUN <name>', 'tsic-term-err'); return; }
      host.run(id).then(function (res) { if (!res.ok) renderError(res, id); });
    }

    // ── Input forwarded from the view ─────────────────────
    function submitLine(value) {
      if (inputResolver) { // a running program is awaiting readLine
        const r = inputResolver; inputResolver = null;
        write(promptStr + ' ' + value, 'tsic-term-echo');
        r(value);
        return;
      }
      if (programActive) return; // a program owns the screen but isn't at a prompt
      doCommand(value);
    }

    bootSequence();

    // ── Shell contract consumed by shared/screens/terminal.js ──
    return {
      onPrograms: function (entries) { programList = entries || []; },
      printToProgram: function (text, o) { programActive = true; enqueue(text, null, o); },
      clearScreen: function () { programActive = true; enqueueClear(); },
      beginProgramInput: function (prompt) {
        programActive = true;
        view.clearInput();   // discard anything typed while text was still printing
        return whenDrained().then(function () {
          const typed = prompt ? type(String(prompt), null) : Promise.resolve();
          return typed.then(function () {
            view.setPromptVisible(false);
            return new Promise(function (res) { inputResolver = res; });
          });
        });
      },
      setTheme: function (name) { view.applyTheme(name); },
      reboot: function () {
        printQueue.length = 0; draining = false; inputResolver = null; programActive = false;
        view.setPromptVisible(true); view.applyTheme(null);
        if (alive()) view.clearRows();
        view.setReady(false);
        bootSequence();
      },
      endProgram: function () {
        inputResolver = null;
        whenDrained().then(function () {
          programActive = false;
          view.setPromptVisible(true);
          view.applyTheme(null);
          view.focusInput();
        });
      },
      destroy: function () { destroyed = true; printQueue.length = 0; },

      // Consumed by the view's key handler.
      isBooting: function () { return booting; },
      skipBoot: function () { skipped = true; },
      submitLine: submitLine,
    };
  }

  NS.createConsole = createConsole;
})(window);
