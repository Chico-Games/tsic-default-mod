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
      '    <input class="tsic-term-input" id="term-input" autocomplete="off" spellcheck="false" data-tsic-initial-focus>' +
      '  </div>' +
      '</div>';

    const out = container.querySelector('#term-out');
    const line = container.querySelector('#term-line');
    const input = container.querySelector('#term-input');
    let programList = [];
    let inputResolver = null; // set while a running program awaits readLine

    function write(text, cls) {
      const div = document.createElement('div');
      div.className = 'tsic-term-row' + (cls ? ' ' + cls : '');
      div.textContent = text;
      out.appendChild(div);
      out.scrollTop = out.scrollHeight;
    }

    // Boot banner.
    write(hw.toUpperCase(), 'tsic-term-banner');
    write('TSIC-DOS v1.0  —  type HELP', 'tsic-term-banner');
    write('READY', 'tsic-term-banner');

    function renderError(res, programId) {
      if (res.code === NS.ERR.TIER_TOO_LOW) {
        write('ERROR 0x02: INCOMPATIBLE HARDWARE', 'tsic-term-err');
        write('  ' + programId.toUpperCase() + ' requires ' + NS.hardwareName(res.info.required) + ' (tier ' + res.info.required + ').', 'tsic-term-err');
        write('  This unit is ' + NS.hardwareName(res.info.current) + ' (tier ' + res.info.current + '). Upgrade hardware to run.', 'tsic-term-err');
        return;
      }
      write('ERROR: ' + res.code, 'tsic-term-err');
    }

    function doCommand(raw) {
      const text = raw.trim();
      write('> ' + text, 'tsic-term-echo');
      if (!text) return;
      const parts = text.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      if (cmd === 'help') {
        write('Commands: HELP  LS  RUN <id>  CLEAR  EXIT');
        write('  (or just type a program id to run it)');
        return;
      }
      if (cmd === 'clear') { out.innerHTML = ''; return; }
      if (cmd === 'exit') { host.close(); return; }
      if (cmd === 'ls' || cmd === 'dir') {
        if (!programList.length) { write('No programs installed. Find a floppy disk.'); return; }
        programList.forEach(function (e) {
          const tag = e.locked ? '  [LOCKED — req. ' + NS.hardwareName(e.program.minTier) + ']' : '';
          write(e.program.name + '  (' + e.program.id + ')' + tag);
        });
        return;
      }
      const id = (cmd === 'run') ? parts[1] : parts[0];
      if (!id) { write('Usage: RUN <id>', 'tsic-term-err'); return; }
      host.run(id).then(function (res) {
        if (!res.ok) renderError(res, id);
      });
    }

    function onKey(ev) {
      if (ev.key !== 'Enter') return;
      const value = input.value;
      input.value = '';
      if (inputResolver) { // program is awaiting input
        const r = inputResolver; inputResolver = null;
        write('> ' + value, 'tsic-term-echo');
        r(value);
        return;
      }
      doCommand(value);
    }
    input.addEventListener('keydown', onKey);

    return {
      onPrograms: function (entries) { programList = entries || []; },
      printToProgram: function (text) { write(text); },
      beginProgramInput: function (prompt) {
        if (prompt) write(prompt);
        line.style.display = 'none';
        return new Promise(function (res) { inputResolver = res; });
      },
      endProgram: function () { inputResolver = null; line.style.display = ''; input.focus(); },
      destroy: function () { input.removeEventListener('keydown', onKey); container.innerHTML = ''; },
    };
  }

  NS.shells.tier1 = { create: create };
})(window);
