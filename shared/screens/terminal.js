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
      const state = { tier: 1, programs: [], unlockedIds: [], storage: new Map(), shell: null, program: null };

      function snapshot() {
        return T.catalog.listForTerminal({ programs: state.programs, unlockedIds: state.unlockedIds, tier: state.tier });
      }
      function refreshShellList() { if (state.shell) state.shell.onPrograms(snapshot()); }

      function killProgram() { if (state.program) { state.program.kill(); state.program = null; } }

      function run(programId) {
        const res = T.catalog.resolveLaunch(programId, { programs: state.programs, unlockedIds: state.unlockedIds, tier: state.tier });
        if (!res.ok) return Promise.resolve(res);
        const program = res.program;
        return fetch('/programs/' + program.id + '/' + program.entry)
          .then(function (r) { if (!r.ok) throw new Error('fetch'); return r.text(); })
          .then(function (entrySrc) {
            killProgram();
            const granted = T.grantedCaps(state.tier, program.capabilities);
            const handlers = T.capabilities.createHostHandlers({
              publish: ctx.publish, storage: state.storage, catalogSnapshot: snapshot,
            });
            state.program = T.runtime.launch({
              container: root,
              program: program,
              entrySrc: entrySrc,
              granted: granted,
              handlers: handlers,
              onPrint: function (txt) { if (state.shell) state.shell.printToProgram(txt); },
              onTheme: function (name) { if (state.shell && state.shell.setTheme) state.shell.setTheme(name); },
              requestInput: function (prompt) { return state.shell ? state.shell.beginProgramInput(prompt) : Promise.resolve(''); },
              onExit: function () { if (state.shell) state.shell.endProgram(); },
            });
            return { ok: true };
          })
          .catch(function () { return { ok: false, code: T.ERR.ENTRY_FAILED, info: { id: program.id } }; });
      }

      function buildShell(tier, autoRun) {
        killProgram();
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
      ctx.on('tsic.msg.' + T.CHANNELS.Open, function (p) {
        buildShell((p && p.Tier) || 1, p && p.AutoRun);
      });
    },
  });
})();
