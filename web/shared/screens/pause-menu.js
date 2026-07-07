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
    [data-screen="PauseMenu"] .pl-row { padding: 4px 6px; display:flex; align-items:center; gap:8px; }
    [data-screen="PauseMenu"] .pl-dot { width:10px; height:10px; border-radius:50%; flex:0 0 auto; border:1px solid rgba(255,255,255,0.5); }
  `;

  const TEMPLATE = `
    <div id="pause-overlay" class="tsic-modal-scrim tsic-modal-scrim--clear">
      <div id="pause-panel" class="tsic-panel">
        <h1 class="tsic-title tsic-title--lg">Paused</h1>
        <div class="pl" id="players"></div>
        <div data-tsic-focus-group="nav">
          <button class="tsic-button" style="width:100%;" id="btn-resume" data-tsic-initial-focus>Resume</button>
          <button class="tsic-button" style="width:100%; margin-top:8px;" id="btn-settings">Settings</button>
          <button class="tsic-button" style="width:100%; margin-top:8px;" id="btn-bug-report">Report a Bug</button>
          <button class="tsic-button" style="width:100%; margin-top:8px;" id="btn-menu">Save and Return to Main Menu</button>
          <!-- Dev/testing only: revealed by the UI.State.DevMode flag in non-shipping builds. -->
          <button class="tsic-button" style="width:100%; margin-top:8px; display:none;" id="btn-dev-join">Join Game (Dev)</button>
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
        p.Players.forEach((pl, i) => {
          const row = document.createElement('div');
          row.className = 'pl-row';

          const dot = document.createElement('span');
          dot.className = 'pl-dot';
          dot.style.background = pl.Color || '#888888';
          row.appendChild(dot);

          // Name can come through empty / "0" before PlayerState resolves —
          // call the first player "Host" so the row is never blank.
          const name = pl.Name || (pl.bIsHost || i === 0 ? 'Host' : 'Player');
          const label = document.createElement('span');
          label.textContent = name + (pl.bIsHost ? ' (host)' : '');
          row.appendChild(label);

          host.appendChild(row);
        });
      });

      root.querySelector('#btn-resume').onclick     = () => ctx.publish('UI.Cmd.Pause.Resume');
      root.querySelector('#btn-settings').onclick   = () => ctx.publish('UI.Cmd.Pause.Settings');
      root.querySelector('#btn-bug-report').onclick = () => ctx.publish('UI.Cmd.Pause.BugReport');
      root.querySelector('#btn-menu').onclick       = () => ctx.publish('UI.Cmd.Pause.QuitToMenu');

      // Dev/testing: reveal + wire the "Join Game (Dev)" button. Destroys this
      // instance's own session (if hosting) then finds + joins the host.
      const devJoin = root.querySelector('#btn-dev-join');
      if (devJoin) {
        devJoin.onclick = () => ctx.publish('UI.Cmd.Dev.JoinGame');
        ctx.on('tsic.msg.UI.State.DevMode', (p) => {
          devJoin.style.display = (p && p.bDevBuild) ? '' : 'none';
        });
      }
    },

    // onShow / onHide intentionally omitted — there's no transient state to
    // refresh or release beyond the input-mode tag + action-bar context the
    // manager handles automatically.
  });
})();
