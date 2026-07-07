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
    [data-screen="PauseMenu"] #pause-panel { width:360px; text-align:center; background: var(--cat-bg); max-height: 90vh; overflow-y:auto; }
    [data-screen="PauseMenu"] .pl { text-align:left; margin: 8px 0; max-height: 140px; overflow:auto; }
    [data-screen="PauseMenu"] .pl-row { padding: 4px 6px; display:flex; align-items:center; gap:8px; }
    [data-screen="PauseMenu"] .pl-dot { width:10px; height:10px; border-radius:50%; flex:0 0 auto; border:1px solid rgba(255,255,255,0.5); }
    [data-screen="PauseMenu"] .pl-name { flex:1 1 auto; }
    [data-screen="PauseMenu"] .pl-kick { flex:0 0 auto; font-size:11px; padding:2px 8px; cursor:pointer; background:rgba(200,60,60,0.25); border:1px solid rgba(200,60,60,0.6); border-radius:4px; color:inherit; }
    [data-screen="PauseMenu"] .pl-kick:hover { background:rgba(200,60,60,0.45); }
    [data-screen="PauseMenu"] .mp { margin-top:16px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.15); text-align:left; }
    [data-screen="PauseMenu"] .mp-title { margin:0 0 8px; font-size:13px; letter-spacing:0.08em; text-transform:uppercase; opacity:0.75; }
    [data-screen="PauseMenu"] .mp-row { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:8px 0; }
    [data-screen="PauseMenu"] .mp-label { font-size:13px; }
    [data-screen="PauseMenu"] .mp-toggle { position:relative; width:40px; height:22px; flex:0 0 auto; border-radius:11px; background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.3); cursor:pointer; transition:background 0.15s; }
    [data-screen="PauseMenu"] .mp-toggle::after { content:''; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#eee; transition:left 0.15s; }
    [data-screen="PauseMenu"] .mp-toggle.on { background:rgba(90,170,110,0.7); }
    [data-screen="PauseMenu"] .mp-toggle.on::after { left:20px; }
    [data-screen="PauseMenu"] .mp-toggle.disabled { opacity:0.4; cursor:default; }
    [data-screen="PauseMenu"] .mp-input { width:100%; box-sizing:border-box; padding:6px 8px; margin:0 0 8px; background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.25); border-radius:4px; color:inherit; }
    [data-screen="PauseMenu"] .mp-input:disabled { opacity:0.4; }
  `;

  const TEMPLATE = `
    <div id="pause-overlay" class="tsic-modal-scrim tsic-modal-scrim--clear">
      <div id="pause-panel" class="tsic-panel">
        <h1 class="tsic-title tsic-title--lg">Paused</h1>
        <div data-tsic-focus-group="nav">
          <button class="tsic-button" style="width:100%;" id="btn-resume" data-tsic-initial-focus>Resume</button>
          <button class="tsic-button" style="width:100%; margin-top:8px;" id="btn-settings">Settings</button>
          <button class="tsic-button" style="width:100%; margin-top:8px;" id="btn-bug-report">Report a Bug</button>
          <button class="tsic-button" style="width:100%; margin-top:8px;" id="btn-menu">Save and Return to Main Menu</button>
          <!-- Dev/testing only: revealed by the UI.State.DevMode flag in non-shipping builds. -->
          <button class="tsic-button" style="width:100%; margin-top:8px; display:none;" id="btn-dev-join">Join Game (Dev)</button>
        </div>
        <div class="mp" id="mp">
          <h2 class="mp-title">Multiplayer</h2>
          <div class="pl" id="players"></div>
          <div class="mp-row">
            <span class="mp-label">Allow friends to join</span>
            <div class="mp-toggle" id="mp-allow" role="switch" tabindex="0"></div>
          </div>
          <div class="mp-row">
            <span class="mp-label">Require password</span>
            <div class="mp-toggle" id="mp-pw-toggle" role="switch" tabindex="0"></div>
          </div>
          <input class="mp-input" id="mp-pw" type="text" placeholder="Password" autocomplete="off" />
          <button class="tsic-button" style="width:100%;" id="btn-invite">Invite Friends</button>
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

      // Latest host multiplayer settings + whether we're the host. Defaults match
      // the C++ FSimpleSessionSettings defaults (allow-friends on). Overwritten by
      // the UI.Multiplayer.State broadcast that fires when the pause menu opens.
      let mpState = { bAllowFriends: true, bPasswordRequired: false, Password: '', bLocalIsHost: false };
      let lastPlayers = null;

      const allowTog = root.querySelector('#mp-allow');
      const pwTog    = root.querySelector('#mp-pw-toggle');
      const pwInput  = root.querySelector('#mp-pw');
      const inviteBtn = root.querySelector('#btn-invite');

      // Push the current control values to C++ as one FScpUICmdMultiplayerSet.
      function publishSet() {
        ctx.publish('UI.Cmd.Multiplayer.Set', {
          bAllowFriends: mpState.bAllowFriends,
          bPasswordRequired: mpState.bPasswordRequired,
          Password: mpState.Password || '',
        });
      }

      // Reflect mpState onto the controls, and gate host-only controls so a
      // non-host client sees them read-only.
      function applyState() {
        const host = !!mpState.bLocalIsHost;
        allowTog.classList.toggle('on', !!mpState.bAllowFriends);
        allowTog.classList.toggle('disabled', !host);
        pwTog.classList.toggle('on', !!mpState.bPasswordRequired);
        pwTog.classList.toggle('disabled', !host);
        if (document.activeElement !== pwInput) pwInput.value = mpState.Password || '';
        pwInput.disabled = !host || !mpState.bPasswordRequired;
        pwInput.style.display = mpState.bPasswordRequired ? '' : 'none';
        inviteBtn.disabled = !host;
        inviteBtn.style.opacity = host ? '' : '0.4';
      }

      function renderPlayers() {
        const hostEl = root.querySelector('#players');
        if (!hostEl) return;
        hostEl.innerHTML = '';
        if (!lastPlayers || !lastPlayers.Players) return;
        lastPlayers.Players.forEach((pl, i) => {
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
          label.className = 'pl-name';
          label.textContent = name + (pl.bIsHost ? ' (host)' : '');
          row.appendChild(label);

          // Host-only kick button for every non-host row.
          if (mpState.bLocalIsHost && !pl.bIsHost) {
            const kick = document.createElement('button');
            kick.className = 'pl-kick';
            kick.textContent = 'Kick';
            kick.onclick = () => ctx.publish('UI.Cmd.Multiplayer.Kick', { PlayerId: pl.Id });
            row.appendChild(kick);
          }

          hostEl.appendChild(row);
        });
      }

      // Players list updates whenever UI.Players.List broadcasts. Bridge
      // channels are sticky so the most recent list replays on subscribe.
      ctx.on('tsic.msg.UI.Players.List', (p) => {
        lastPlayers = p;
        renderPlayers();
      });

      // Host settings — broadcast when the pause menu opens (PublishStateForScreen).
      ctx.on('tsic.msg.UI.Multiplayer.State', (s) => {
        if (s) mpState = s;
        applyState();
        renderPlayers(); // kick-button visibility depends on bLocalIsHost
      });

      allowTog.onclick = () => {
        if (!mpState.bLocalIsHost) return;
        mpState.bAllowFriends = !mpState.bAllowFriends;
        applyState();
        publishSet();
      };
      pwTog.onclick = () => {
        if (!mpState.bLocalIsHost) return;
        mpState.bPasswordRequired = !mpState.bPasswordRequired;
        applyState();
        publishSet();
        if (mpState.bPasswordRequired) pwInput.focus();
      };
      pwInput.onchange = () => {
        if (!mpState.bLocalIsHost) return;
        mpState.Password = pwInput.value;
        publishSet();
      };
      inviteBtn.onclick = () => {
        if (!mpState.bLocalIsHost) return;
        ctx.publish('UI.Cmd.Multiplayer.Invite');
      };

      applyState();

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
