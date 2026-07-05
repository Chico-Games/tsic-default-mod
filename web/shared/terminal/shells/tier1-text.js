// shared/terminal/shells/tier1-text.js
//
// Tier-1 "Durham Internal Terminal" shell: an 80s green-phosphor CRT command
// line. It owns ONLY the chrome — the command interpreter, typewriter output
// queue, boot sequence and program-I/O all live in the shared console engine
// (shared/terminal/console-core.js). This file builds the CRT DOM, exposes it
// to the engine as a `view` adapter, and wires the keyboard.
(function (global) {
  const NS = global.TSICTerminal = global.TSICTerminal || {};
  NS.shells = NS.shells || {};

  function create(container, host) {
    container.innerHTML =
      '<div class="tsic-term tsic-term--t1">' +
      '  <div class="tsic-term-out" id="term-out">' +
      '    <div class="tsic-term-line" id="term-line">' +
      '      <span class="tsic-term-prompt">&gt;</span>' +
      '      <span class="tsic-term-mirror" id="term-mirror"></span>' +
      '      <span class="tsic-term-cursor" id="term-cursor"></span>' +
      '      <input class="tsic-term-input" id="term-input" autocomplete="off" spellcheck="false" data-tsic-initial-focus>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    const doc = container.ownerDocument;
    const out = container.querySelector('#term-out');
    const line = container.querySelector('#term-line');
    const promptEl = container.querySelector('.tsic-term-prompt');
    const mirror = container.querySelector('#term-mirror');
    const input = container.querySelector('#term-input');
    const rootEl = container.querySelector('.tsic-term--t1');
    let destroyed = false;

    function alive() { return !destroyed && doc && doc.defaultView; }
    // The visible input is an uppercased mirror of the (invisible) real input.
    function syncMirror() { mirror.textContent = input.value.toUpperCase(); }
    function focusInput() { try { input.focus({ preventScroll: true }); } catch (e) {} }

    // CRT chrome exposed to the shared console engine.
    const view = {
      appendRow: function (cls) {
        const div = doc.createElement('div');
        div.className = 'tsic-term-row' + (cls ? ' ' + cls : '');
        out.insertBefore(div, line);   // output rows flow above the prompt line
        return { setText: function (s) { div.textContent = s; } };
      },
      clearRows: function () {
        const rows = out.querySelectorAll('.tsic-term-row');
        for (let i = 0; i < rows.length; i++) rows[i].remove();
      },
      scrollToEnd: function () { out.scrollTop = out.scrollHeight; },
      setBooting: function (b) { rootEl.classList.toggle('is-booting', !!b); },
      setReady: function (b) { if (b) rootEl.setAttribute('data-term-ready', '1'); else rootEl.removeAttribute('data-term-ready'); },
      setPromptVisible: function (b) { promptEl.style.visibility = b ? '' : 'hidden'; },
      clearInput: function () { input.value = ''; syncMirror(); },
      focusInput: focusInput,
      applyTheme: function (name) { rootEl.classList.toggle('tsic-term--theme-red', name === 'red'); },
      alive: alive,
      getCharDelay: function () { return NS.shells.tier1.charDelayMs; },
      getCharsPerTick: function () { return NS.shells.tier1.charsPerTick; },
    };

    const core = NS.createConsole(view, host);

    input.addEventListener('input', syncMirror);
    function onPointerDown(ev) { ev.preventDefault(); focusInput(); }
    container.addEventListener('mousedown', onPointerDown);
    function onKey(ev) {
      if (core.isBooting()) { ev.preventDefault(); core.skipBoot(); return; } // any key fast-forwards boot
      if (ev.key !== 'Enter') return;
      const value = input.value;
      input.value = ''; syncMirror();
      core.submitLine(value);
    }
    input.addEventListener('keydown', onKey);
    focusInput();

    return {
      onPrograms: core.onPrograms,
      printToProgram: core.printToProgram,
      clearScreen: core.clearScreen,
      beginProgramInput: core.beginProgramInput,
      setTheme: core.setTheme,
      reboot: core.reboot,
      endProgram: core.endProgram,
      destroy: function () {
        destroyed = true;
        core.destroy();
        input.removeEventListener('keydown', onKey);
        input.removeEventListener('input', syncMirror);
        container.removeEventListener('mousedown', onPointerDown);
        container.innerHTML = '';
      },
    };
  }

  // Typewriter speed for ALL terminal output (boot intro + shell + programs).
  // Read live by the engine, so tests can set charDelayMs = 0 for instant output.
  NS.shells.tier1 = { create: create, charDelayMs: 7, charsPerTick: 3 };
})(window);
