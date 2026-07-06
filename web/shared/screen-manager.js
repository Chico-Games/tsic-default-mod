// shared/screen-manager.js
//
// SPA shell screen manager. Lives on in-game.html (the shell). Owns the
// menu overlay layer: lazily mounts registered screen modules into hidden
// containers, swaps which one is visible on UI.Screen.Changed, and handles
// the per-cycle lifecycle (onShow / onHide) including input-mode tag push,
// menu action-bar context, and Esc/IA_UI_CancelBack wiring.
//
// Unregistered screens fall back to window.location.replace so we can
// migrate one menu at a time without breaking the others. Once every menu
// is registered, the fallback (and router.js's redirect path) can go away.
//
// Screen modules register via:
//
//   TSIC.registerScreen('Inventory', {
//     template: '<div id="inv-root">...</div>',
//     inputModeTag: 'InputMode.Menu.Inventory',   // optional
//     cancelCmd:    'UI.Cmd.Pause.Resume',        // optional, default Pause.Resume
//     actionBarContext: [ ... ],                  // optional, static menu-context entries
//     mount(root, ctx)   { ... },                 // one-time, on first activation
//     onShow(params, ctx){ ... },                 // every time it becomes visible
//     onHide(ctx)        { ... },                 // every time it becomes hidden
//   });
//
// ctx is { publish, on, off, focus, isVisible }.
(function () {
  if (!window.TSIC) window.TSIC = {};
  if (TSIC.__screenManagerInstalled) return;
  TSIC.__screenManagerInstalled = true;

  // --- registry ----------------------------------------------------------

  const REGISTRY = new Map();             // name -> module
  const MOUNTED  = new Map();             // name -> { container, ctx, module }
  let   activeName = 'InGame';            // shell default

  TSIC.registerScreen = function (name, mod) {
    if (!name || !mod) return;
    REGISTRY.set(name, mod);
  };

  // --- host --------------------------------------------------------------

  function ensureHost() {
    let host = document.getElementById('screen-overlay-host');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'screen-overlay-host';
    // No styles here — see screen-manager.css for the host + overlay rules.
    document.body.appendChild(host);
    return host;
  }

  // --- per-screen context ------------------------------------------------

  function makeCtx(name, container) {
    return {
      name,
      root: container,
      publish: (ch, p) => window.tsic.publishMessage(ch, p || {}),
      on:      (ch, cb) => window.tsic.on(ch, cb),
      off:     (ch, cb) => window.tsic.off && window.tsic.off(ch, cb),
      focus: () => {
        // Re-trigger initial focus on the overlay's marked element.
        const target = container.querySelector('[data-tsic-initial-focus]');
        if (target && typeof target.focus === 'function') {
          try { target.focus({ preventScroll: true }); } catch (e) { /* noop */ }
        }
      },
      isVisible: () => activeName === name,
    };
  }

  // --- mount on demand ---------------------------------------------------

  function mountIfNeeded(name) {
    if (MOUNTED.has(name)) return MOUNTED.get(name);
    const mod = REGISTRY.get(name);
    if (!mod) return null;

    const host = ensureHost();
    const container = document.createElement('div');
    container.dataset.screen = name;
    container.className = 'tsic-overlay';
    container.hidden = true;
    if (mod.template) container.innerHTML = mod.template;
    host.appendChild(container);

    const ctx = makeCtx(name, container);
    const entry = { container, ctx, module: mod };
    MOUNTED.set(name, entry);

    if (typeof mod.mount === 'function') {
      try { mod.mount(container, ctx); }
      catch (e) { console.warn('[screen-manager] mount(' + name + ') failed', e); }
    }
    return entry;
  }

  // --- per-cycle lifecycle helpers --------------------------------------

  function pushInputMode(mod) {
    if (mod.inputModeTag) {
      window.tsic.publishMessage('UI.Cmd.Input.AppendModeTag', { Tag: mod.inputModeTag });
    }
  }

  function releaseInputMode(mod) {
    if (mod.inputModeTag) {
      window.tsic.publishMessage('UI.Cmd.Input.RemoveModeTag', { Tag: mod.inputModeTag });
    }
  }

  function publishMenuActionContext(mod) {
    // Publish either the module's declared static context, or an empty list
    // (which still gets an auto-Back row added by router's helper if present).
    if (!mod.actionBarContext) return;
    if (typeof window.__tsicPublishMenuActionContext === 'function') {
      window.__tsicPublishMenuActionContext(mod.actionBarContext);
    } else {
      // Best-effort direct publish if router helper isn't available yet.
      window.tsic.publishMessage('UI.Cmd.BehaviorBar.SetMenuContext', {
        Entries: mod.actionBarContext,
      });
    }
  }

  function clearMenuActionContext() {
    window.tsic.publishMessage('UI.Cmd.BehaviorBar.SetMenuContext', { Entries: [] });
  }

  // --- cancel/back wiring (single shared listener) ----------------------

  let cancelWired = false;
  function ensureCancelWired() {
    if (cancelWired) return;
    cancelWired = true;
    window.tsic.on('tsic.msg.UI.Behavior.Back', (p) => {
      if (!p || p.Phase !== 'Started') return;
      if (activeName === 'InGame') return;
      // A modal focus scope (open dropdown) consumes the Back press — the
      // engine pops it; this press must not also close the screen.
      const f = window.tsic.focus;
      if (f && f.backHandled && f.backHandled()) return;
      const entry = MOUNTED.get(activeName);
      if (!entry) return;
      // Modules that handle cancel themselves (e.g. Construction, whose
      // ability listens to the Back behaviour) opt out by setting cancelCmd
      // to null/'' — we then skip the auto-publish so the action only fires once.
      if (entry.module.cancelCmd === null || entry.module.cancelCmd === '') return;
      const cmd = entry.module.cancelCmd || 'UI.Cmd.Pause.Resume';
      window.tsic.publishMessage(cmd, {});
    });
  }

  // --- screen change handler --------------------------------------------

  function hideCurrent() {
    if (activeName === 'InGame') return;
    const entry = MOUNTED.get(activeName);
    if (!entry) return;
    try {
      releaseInputMode(entry.module);
      if (entry.module.actionBarContext) clearMenuActionContext();
      if (typeof entry.module.onHide === 'function') entry.module.onHide(entry.ctx);
    } catch (e) { console.warn('[screen-manager] onHide(' + activeName + ') failed', e); }
    entry.container.hidden = true;
  }

  function showRegistered(name, params) {
    const entry = mountIfNeeded(name);
    if (!entry) return false;
    entry.container.hidden = false;
    document.body.classList.add('tsic-overlay-open');
    try {
      pushInputMode(entry.module);
      publishMenuActionContext(entry.module);
      if (typeof entry.module.onShow === 'function') entry.module.onShow(params || {}, entry.ctx);
      entry.ctx.focus();
    } catch (e) { console.warn('[screen-manager] onShow(' + name + ') failed', e); }
    return true;
  }

  function changeScreen(name, paramsJson) {
    if (name === activeName) return;
    let params = {};
    if (paramsJson && typeof paramsJson === 'string') {
      try { params = JSON.parse(paramsJson); } catch (e) { /* ignore */ }
    }

    hideCurrent();

    if (name === 'InGame' || !name) {
      activeName = 'InGame';
      document.body.classList.remove('tsic-overlay-open');
      return;
    }

    if (REGISTRY.has(name)) {
      activeName = name;
      showRegistered(name, params);
      return;
    }

    // Fallback: unmigrated screen. Leave the shell.
    document.body.classList.remove('tsic-overlay-open');
    activeName = 'InGame';                       // we're about to navigate away
    const file = (TSIC.screenFileFor && TSIC.screenFileFor(name)) || null;
    if (!file) {
      console.warn('[screen-manager] no fallback file for unregistered screen', name);
      return;
    }
    window.location.replace('/screens/' + file + '.html');
  }

  // --- boot --------------------------------------------------------------

  function boot() {
    if (!window.tsic || typeof window.tsic.on !== 'function') {
      setTimeout(boot, 16);
      return;
    }
    ensureHost();
    ensureCancelWired();
    window.tsic.on('tsic.msg.UI.Screen.Changed', (payload) => {
      if (!payload || typeof payload.Name !== 'string') return;
      changeScreen(payload.Name, payload.ParamsJson);
    });
  }
  boot();
})();
