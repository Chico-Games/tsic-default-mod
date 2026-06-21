// shared/screens/terminal.js
//
// Registers the 'Terminal' screen. Subscribes to the terminal bridge channels,
// keeps catalog + unlock state, selects a tier shell, and brokers program
// launches through the sandbox runtime. The shell owns chrome; this module
// owns wiring.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function' || !window.TSICTerminal) {
    setTimeout(register, 16);
    return;
  }
  const T = window.TSICTerminal;

  TSIC.registerScreen('Terminal', {
    inputModeTag: 'InputMode.Menu.Terminal',
    cancelCmd: 'UI.Cmd.Pause.Resume',
    template: '',

    mount(root, ctx) {
      const state = { tier: 1, programs: [], unlockedIds: [], badges: {}, storage: new Map(), shell: null, running: new Set() };

      function snapshot() {
        return T.catalog.listForTerminal({ programs: state.programs, unlockedIds: state.unlockedIds, tier: state.tier, badges: state.badges });
      }
      function refreshShellList() { if (state.shell) state.shell.onPrograms(snapshot()); }

      // Opening a flagged program clears its "NEW" badge: tell the source (which
      // owns cross-session persistence) and drop it locally so the sticker goes
      // immediately, without waiting on the rebroadcast.
      function markSeen(programId) {
        if (!state.badges[programId]) return;
        delete state.badges[programId];
        ctx.publish(T.CHANNELS.MarkSeen, { ProgramId: programId });
        refreshShellList();
      }

      function killAll() {
        state.running.forEach(function (h) { try { h.kill(); } catch (e) {} });
        state.running.clear();
      }

      // Single-surface shells (tier-1 CRT, tier-3 stub) route a program's I/O to
      // their one screen. The windowed tier-2 shell instead hands run() a
      // per-window sink (opts.sink), so closing a window kills only its program.
      function shellSink() {
        const s = state.shell || {};
        return {
          container: null,
          print: function (t, o) { if (s.printToProgram) s.printToProgram(t, o); },
          clear: function () { if (s.clearScreen) s.clearScreen(); },
          requestInput: function (p) { return s.beginProgramInput ? s.beginProgramInput(p) : Promise.resolve(''); },
          setTheme: function (n) { if (s.setTheme) s.setTheme(n); },
          reboot: function () { if (s.reboot) s.reboot(); },
          endProgram: function () { if (s.endProgram) s.endProgram(); },
        };
      }

      function run(programId, opts) {
        opts = opts || {};
        const res = T.catalog.resolveLaunch(programId, { programs: state.programs, unlockedIds: state.unlockedIds, tier: state.tier });
        if (!res.ok) return Promise.resolve(res);
        const program = res.program;
        markSeen(program.id);   // opening it (icon or RUN) clears the new-arrival flag
        return fetch('/programs/' + program.id + '/' + program.entry)
          .then(function (r) { if (!r.ok) throw new Error('fetch'); return r.text(); })
          .then(function (entrySrc) {
            const granted = T.grantedCaps(state.tier, program.capabilities);
            const handlers = T.capabilities.createHostHandlers({
              publish: ctx.publish, storage: state.storage, catalogSnapshot: snapshot,
            });
            // A windowed shell supplies the sink (one per window); single-surface
            // shells don't, so fall back to their one screen and — since they host
            // one program at a time — replace whatever was running.
            const sink = opts.sink || shellSink();
            if (!opts.sink) killAll();
            // GUI programs (granted gfx.canvas) render their own UI into the sink's
            // container; text programs mount off-screen and stream via onPrint.
            const gui = granted.indexOf('gfx.canvas') !== -1 && !!sink.container;
            const container = gui ? sink.container : root;
            let handle = null;
            function drop() { if (handle) state.running.delete(handle); }
            handle = T.runtime.launch({
              container: container,
              program: program,
              entrySrc: entrySrc,
              granted: granted,
              handlers: handlers,
              onPrint: function (txt, o) { sink.print(txt, o); },
              onTheme: function (name) { if (sink.setTheme) sink.setTheme(name); },
              onClear: function () { if (sink.clear) sink.clear(); },
              onReboot: function () { drop(); if (sink.reboot) sink.reboot(); },
              requestInput: function (prompt) { return sink.requestInput ? sink.requestInput(prompt) : Promise.resolve(''); },
              onExit: function () { drop(); if (sink.endProgram) sink.endProgram(); },
            });
            state.running.add(handle);
            if (sink.onClose) sink.onClose(function () { handle.kill(); drop(); });   // close box kills its program
            return { ok: true };
          })
          .catch(function () { return { ok: false, code: T.ERR.ENTRY_FAILED, info: { id: program.id } }; });
      }

      function buildShell(tier, autoRun) {
        killAll();
        if (state.shell) { state.shell.destroy(); state.shell = null; }
        state.tier = tier;
        const factory = T.shells['tier' + tier] || T.shells.tier1;
        state.shell = factory.create(root, {
          tier: tier,
          run: run,
          close: function () { ctx.publish(T.CHANNELS.Close); },
          autoRun: autoRun || null,   // program id to launch automatically once booted
        });
        refreshShellList();
      }

      ctx.on('tsic.msg.' + T.CHANNELS.Catalog, function (p) {
        state.programs = ((p && p.Programs) || []).map(T.catalog.parseManifest).filter(Boolean);
        refreshShellList();
      });
      ctx.on('tsic.msg.' + T.CHANNELS.UnlockedList, function (p) {
        state.unlockedIds = (p && p.ProgramIds) || [];
        refreshShellList();
      });
      ctx.on('tsic.msg.' + T.CHANNELS.Badges, function (p) {
        state.badges = (p && p.Badges) || {};
        refreshShellList();
      });
      let lastAutoRun = null;
      ctx.on('tsic.msg.' + T.CHANNELS.Open, function (p) {
        const tier = (p && p.Tier) || 1;
        const autoRun = (p && p.AutoRun) || null;
        // Re-receiving the same Open must NOT tear down the live desktop and its
        // open windows. (The playground re-projects every channel — including
        // Open — after any publish, e.g. MarkSeen when you open a flagged
        // program.) Rebuild only when the tier or the requested auto-run changes.
        if (state.shell && state.tier === tier && lastAutoRun === autoRun) return;
        lastAutoRun = autoRun;
        buildShell(tier, autoRun);
      });
    },
  });
})();
