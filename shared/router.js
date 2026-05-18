// Self-navigating router. Each page declares its own screen name via:
//   <meta name="tsic-screen" content="MainMenu">
// On UI.Screen.Changed, navigate if the broadcast name differs from this page's.
(function () {
  const SCREEN_TO_FILE = {
    MainMenu: 'main-menu',
    NewStore: 'new-store',
    Mods: 'mods',
    Credits: 'credits',
    Loading: 'loading-screen',
    InGame: 'in-game',
    DeathScreen: 'death-screen',
    PauseMenu: 'pause-menu',
    Inventory: 'inventory',
    Settings: 'settings',
    SaveLoad: 'save-load',
    Crafting: 'crafting',
    Production: 'production',
    Upgrade: 'upgrade',
    BossSummoner: 'boss-summoner',
    Construction: 'construction',
    Interaction: 'interaction',
    Selection: 'selection',
    Cage: 'cage',
    Notifications: 'notifications',
    Map: 'map',
    Chat: 'chat',
    Teleporter: 'teleporter',
    BugReport: 'bug-report',
    Storage: 'storage',
    UniversalStorage: 'universal-storage',
    Equipment: 'equipment',
    Wardrobe: 'wardrobe',
    Hotbar: 'hotbar',
    QuantityPicker: 'quantity-picker',
    ActionBar: 'action-bar',
    Ping: 'ping',
    Crosshair: 'crosshair',
    Detection: 'detection',
    HealthBar: 'health-bar',
    StaminaBar: 'stamina-bar',
    Stomach: 'stomach',
  };

  function myScreen() {
    const m = document.querySelector('meta[name="tsic-screen"]');
    return m ? m.getAttribute('content') : '';
  }

  function fileFor(name) {
    return SCREEN_TO_FILE[name] || null;
  }

  function whenReady(cb) {
    if (window.tsic) { cb(); return; }
    setTimeout(() => whenReady(cb), 16);
  }

  function activeInputModeTag() {
    const m = document.querySelector('meta[name="tsic-input-mode"]');
    return m ? m.getAttribute('content') : null;
  }

  whenReady(() => {
    // Screen routing.
    window.tsic.on('tsic.msg.UI.Screen.Changed', (payload /*, meta, name*/) => {
      if (!payload || !payload.Name) return;
      if (payload.Name === myScreen()) return;
      const file = fileFor(payload.Name);
      if (!file) {
        console.warn('[router] no file mapping for screen', payload.Name);
        return;
      }
      window.location.replace(`/screens/${file}.html`);
    });

    // Input-mode tag activation: append on load, release on beforeunload.
    const inputTag = activeInputModeTag();
    if (inputTag) {
      window.tsic.publishMessage('UI.Cmd.Input.AppendModeTag', { Tag: inputTag });
      window.addEventListener('beforeunload', () => {
        window.tsic.publishMessage('UI.Cmd.Input.RemoveModeTag', { Tag: inputTag });
      });
    }

    // Modder API helpers — bound on window.tsic after the native bootstrap.
    window.tsic.appendInputModeTag = function (tagStr) {
      window.tsic.publishMessage('UI.Cmd.Input.AppendModeTag', { Tag: tagStr });
    };
    window.tsic.removeInputModeTag = function (tagStr) {
      window.tsic.publishMessage('UI.Cmd.Input.RemoveModeTag', { Tag: tagStr });
    };
  });

  // Expose for ad-hoc dev navigation.
  window.tsicGoto = function (name) {
    const file = fileFor(name);
    if (file) window.location.replace(`/screens/${file}.html`);
  };
})();
