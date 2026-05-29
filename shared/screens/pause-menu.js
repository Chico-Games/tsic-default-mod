// PauseMenu screen module — registered with TSIC.registerScreen, mounted as
// an overlay by shared/screen-manager.js. Was screens/pause-menu.html.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    // screen-manager.js installs TSIC.registerScreen — retry until ready.
    setTimeout(register, 16);
    return;
  }

  // CSS lives inline (scoped under [data-screen="PauseMenu"]) so the
  // module is fully self-contained. Inserted once on first mount.
  const STYLE = `
    [data-screen="PauseMenu"] #pause-overlay { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:auto; }
    [data-screen="PauseMenu"] #pause-panel { width:360px; text-align:center; background: var(--cat-bg); }
    [data-screen="PauseMenu"] .pl { text-align:left; margin: 16px 0; max-height: 140px; overflow:auto; }
    [data-screen="PauseMenu"] .pl-row { padding: 4px 6px; }
    [data-screen="PauseMenu"] .pause-btn-row > button { flex: 1; }
  `;

  const TEMPLATE = `
    <div id="pause-overlay" class="tsic-modal-scrim tsic-modal-scrim--clear">
      <div id="pause-panel" class="tsic-panel">
        <h1 class="tsic-title tsic-title--lg">Paused</h1>
        <div class="pl" id="players"></div>
        <div data-tsic-focus-group="nav">
          <button class="tsic-button" style="width:100%;" id="btn-resume" data-tsic-initial-focus>Resume</button>
          <div class="tsic-row pause-btn-row" style="margin-top:8px; gap:8px;">
            <button class="tsic-button" id="btn-settings">Settings</button>
            <button class="tsic-button" id="btn-menu">Quit to Menu</button>
          </div>
        </div>
      </div>
    </div>
  `;

  function injectStyleOnce() {
    if (document.getElementById('screen-pause-menu-style')) return;
    const s = document.createElement('style');
    s.id = 'screen-pause-menu-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  TSIC.registerScreen('PauseMenu', {
    inputModeTag: 'InputMode.Menu.Pause',
    cancelCmd: 'UI.Cmd.Pause.Resume',
    actionBarContext: [
      { ActionName: 'IA_UI_CancelBack', Label: 'Resume', Priority: 1000 },
    ],
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();

      // Players list updates whenever UI.Players.List broadcasts. Bridge
      // channels are sticky so the most recent list replays on subscribe.
      ctx.on('tsic.msg.UI.Players.List', (p) => {
        const host = root.querySelector('#players');
        if (!host) return;
        host.innerHTML = '';
        if (!p || !p.Players) return;
        for (const pl of p.Players) {
          const row = document.createElement('div');
          row.className = 'pl-row';
          row.textContent = pl.Name + (pl.bIsHost ? ' (host)' : '');
          host.appendChild(row);
        }
      });

      root.querySelector('#btn-resume').onclick   = () => ctx.publish('UI.Cmd.Pause.Resume');
      root.querySelector('#btn-settings').onclick = () => ctx.publish('UI.Cmd.Pause.Settings');
      root.querySelector('#btn-menu').onclick     = () => ctx.publish('UI.Cmd.Pause.QuitToMenu');
    },

    // onShow / onHide intentionally omitted — there's no transient state to
    // refresh or release beyond the input-mode tag + action-bar context the
    // manager handles automatically.
  });
})();
