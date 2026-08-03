// Storage screen module. Was screens/storage.html.
//
// Migrated to the SPA 2026-07-25 for one concrete reason: unregistered screens fall back to
// window.location.replace, and hud.js only mounts the HUD chrome when the page declares
// <meta name="tsic-screen" content="InGame">. So opening ANY container used to navigate the
// whole shell away and blank health, stamina, hotbar and minimap — while crafting and
// production, already registered here, kept them. Containers are the most-opened screen in
// the game, so this was the worst instance of that inconsistency.
//
// All the actual rendering still lives in shared/storage-shell.js; this module only supplies
// the panel host and the screen lifecycle, exactly as crafting.js does for RecipeStation.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const TEMPLATE = '<div id="ss-root" class="tsic-modal-scrim"></div>';

  TSIC.registerScreen('Storage', {
    // Carried over verbatim from the legacy page's <meta> tags so input routing and the
    // menu action bar behave identically to before the migration.
    inputModeTag: 'InputMode.Menu.Storage',
    cancelCmd: 'UI.Cmd.Pause.Resume',
    actionBarContext: [
      { ActionName: 'IA_UI_ConfirmAccept', Label: 'Take', Priority: 10 },
      { ActionName: 'IA_UI_TakeAll', Label: 'Take All', Priority: 20 },
    ],
    template: TEMPLATE,

    mount(root, ctx) {
      const screen = this;
      (function waitForDeps() {
        if (!window.TSICInventory || !window.TSICStorageShell
            || !(window.TSIC && window.TSIC.TabFilter)) {
          setTimeout(waitForDeps, 16);
          return;
        }
        screen._shell = window.TSICStorageShell.mount({
          title: 'Storage',
          containerEyebrow: 'Container',
          containerOwnerIdMatch: (id) => typeof id === 'string' && id.indexOf('Storage:') === 0,
          containerMaxSlots: 32,
        });
        // The very first showing mounts the shell asynchronously, so onShow has already
        // been and gone by the time it exists — claim the hotbar here instead of losing it.
        if (ctx.isVisible()) screen._shell.activate();
      })();
    },

    // The player pane's first row is the live HUD hotbar (shared/hud-hotbar.js), claimed for
    // as long as a container is open. The shell is mounted once and reused, so the claim has
    // to be made and released per showing.
    onShow() {
      if (this._shell) this._shell.activate();
    },

    onHide() {
      if (this._shell) this._shell.deactivate();
    },
  });
})();
