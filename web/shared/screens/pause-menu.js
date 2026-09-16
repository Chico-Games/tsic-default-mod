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
    /* Fixed height, not max-height. The panel is vertically CENTRED, so anything that made it
       taller pushed its top edge upward — and every button in it moved with that edge, under
       a cursor already reaching for one. Measured (Scripts/webui-bench/layout.mjs, issue
       #273): h 583/639/723 and y 249/221/179 for nought/two/eight players, all from one list
       growing. A fixed box makes the menu the same page whoever is in the session, and the
       overflow that used to move the panel scrolls inside it instead.
       min() so a short window still gets a panel that fits rather than one it clips. */
    [data-screen="PauseMenu"] #pause-panel {
      width:360px; height:min(760px, 90vh); text-align:center; background: var(--cat-bg);
      overflow-y:auto; scrollbar-gutter:stable;
    }
    /* Likewise fixed: the list reserves its row whether it holds nought names or eight, so
       the multiplayer block below it never slides. Its own gutter is reserved too — a
       scrollbar appearing on the fourth player would otherwise reflow every row in it. */
    [data-screen="PauseMenu"] .pl { text-align:left; margin: 8px 0; height: 180px; overflow:auto; scrollbar-gutter:stable; }
    [data-screen="PauseMenu"] .pl-empty { padding:4px 6px; opacity:0.5; font-size:13px; }
    [data-screen="PauseMenu"] .pl-row { padding: 5px 6px; display:flex; align-items:center; gap:8px; }
    [data-screen="PauseMenu"] .pl-row.is-dead,
    [data-screen="PauseMenu"] .pl-row.is-away { opacity:0.65; }
    /* The colour chip is the same palette entry the map and minimap use, so a name here and
       a dot out there are the same person without a legend. */
    [data-screen="PauseMenu"] .pl-dot { width:12px; height:12px; flex:0 0 auto; border:2px solid var(--ink-night); }
    [data-screen="PauseMenu"] .pl-main { flex:1 1 auto; min-width:0; }
    [data-screen="PauseMenu"] .pl-name-row { display:flex; align-items:baseline; gap:5px; min-width:0; }
    [data-screen="PauseMenu"] .pl-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
    [data-screen="PauseMenu"] .pl-badge { flex:0 0 auto; padding:1px 4px; font-size:9px; font-weight:800; letter-spacing:0.12em;
      text-transform:uppercase; background:var(--ink-night); color:var(--paper-bright); }
    [data-screen="PauseMenu"] .pl-badge--you { background:var(--mag-red); }
    [data-screen="PauseMenu"] .pl-badge--down { background:var(--mag-red-deep); }
    /* Health escalates: ink while it is nothing to worry about, yellow once it is, red only
       when it is nearly gone. */
    [data-screen="PauseMenu"] .pl-hp { height:5px; margin-top:4px; background:rgba(10,10,10,0.16); border:1px solid var(--ink-night); }
    [data-screen="PauseMenu"] .pl-hp-fill { height:100%; background:var(--ink-night); transition:width 180ms linear; }
    [data-screen="PauseMenu"] .pl-hp[data-state="hurt"] .pl-hp-fill { background:var(--mag-yellow); }
    [data-screen="PauseMenu"] .pl-hp[data-state="critical"] .pl-hp-fill { background:var(--mag-red); }
    [data-screen="PauseMenu"] .pl-meta { font-family:var(--font-terminal); font-size:11px; color:var(--ink-mute); margin-top:2px; }
    /* Bearing arrow: rotated, not re-drawn, so it can follow the payload without layout. */
    [data-screen="PauseMenu"] .pl-bearing { flex:0 0 auto; width:44px; display:flex; flex-direction:column; align-items:center; gap:1px; }
    [data-screen="PauseMenu"] .pl-bearing svg { width:16px; height:16px; color:var(--ink-night); transition:transform 140ms linear; }
    [data-screen="PauseMenu"] .pl-dist { font-family:var(--font-terminal); font-size:11px; color:var(--ink-soft); white-space:nowrap; }
    html[data-tsic-reduce-motion] [data-screen="PauseMenu"] .pl-bearing svg,
    html[data-tsic-reduce-motion] [data-screen="PauseMenu"] .pl-hp-fill { transition:none; }
    [data-screen="PauseMenu"] .mp-head { display:flex; align-items:baseline; justify-content:space-between; gap:10px; }
    [data-screen="PauseMenu"] .mp-day { font-family:var(--font-terminal); font-size:12px; color:var(--ink-mute); }
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
          <button class="tsic-button" style="width:100%; margin-top:8px;" id="btn-teleport-spawn">I'm stuck (Teleport to spawn point)</button>
          <button class="tsic-button" style="width:100%; margin-top:8px;" id="btn-menu">Save and Return to Main Menu</button>
          <button class="tsic-button" style="width:100%; margin-top:8px;" id="btn-quit">Save and Quit</button>
          <!-- Dev/testing only, revealed by UI.State.DevMode's bDevBuild (non-shipping). -->
          <button class="tsic-button" style="width:100%; margin-top:8px; display:none;" id="btn-dev-cheats">Cheat Menu (F1)</button>
        </div>
        <div class="mp" id="mp">
          <div class="mp-head">
            <h2 class="mp-title">Multiplayer</h2>
            <span class="mp-day" id="mp-day"></span>
          </div>
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
    screenSound: false, // plays its own Pause.Open / Pause.Close
    actionBarContext: [
      { ActionName: 'IA_UI_CancelBack', Label: 'Resume', Priority: 1000 },
    ],
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();

      // Latest host multiplayer settings + whether we're the host. Defaults match
      // the C++ FSimpleSessionSettings defaults (allow-friends on). Overwritten by
      // the UI.Multiplayer.State broadcast that fires when the pause menu opens.
      // It also carries the live roster (Players: health, distance, bearing) and the day,
      // republished a few times a second while the menu is open.
      let mpState = { bAllowFriends: true, bPasswordRequired: false, Password: '', bLocalIsHost: false, bCanInvite: false, Players: [] };
      let lastPlayers = null;
      // Rows are rebuilt only when the cast or the kick buttons change, so a hovered or
      // focused Kick button survives the next live payload.
      let rowsKey = '';
      let rows = [];

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
        // Not host-only: a client can invite a friend into the host's game with
        // the same connect string. C++ reports whether the session is joinable.
        const canInvite = !!mpState.bCanInvite;
        inviteBtn.disabled = !canInvite;
        inviteBtn.style.opacity = canInvite ? '' : '0.4';
        inviteBtn.title = canInvite ? '' : 'No joinable session — the host has closed the game to friends.';
      }

      const ARROW_PATH = 'M12 3 L19 20 L12 16 L5 20 Z';

      function formatDistance(metres) {
        const m = Math.max(0, metres || 0);
        return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km';
      }

      /** Compass point for a bearing relative to where the local player is facing. */
      function bearingLabel(deg) {
        const names = ['ahead', 'ahead-right', 'right', 'behind-right', 'behind', 'behind-left', 'left', 'ahead-left'];
        return names[Math.round((((deg || 0) % 360) + 360) % 360 / 45) % 8];
      }

      /** "1 floor up" / "2 floors down", or '' on the local player's level or when unknown. */
      function floorLabel(live, localLevel) {
        if (!live || !live.bHasPawn || live.bIsLocal || localLevel === null) return '';
        const delta = (live.HeightLevel || 0) - localLevel;
        if (delta === 0) return '';
        const n = Math.abs(delta);
        return n + (n === 1 ? ' floor ' : ' floors ') + (delta > 0 ? 'up' : 'down');
      }

      /** The list to draw: UI.Players.List when it has arrived, else the live roster. */
      function listedPlayers() {
        const listed = lastPlayers && lastPlayers.Players;
        if (listed && listed.length) return listed;
        return mpState.Players || [];
      }

      function makeRow(pl) {
        const el = TSIC.el;
        const refs = {};
        refs.dot = el('span', { class: 'pl-dot' });
        refs.name = el('span', { class: 'pl-name' });
        refs.nameRow = el('div', { class: 'pl-name-row' }, refs.name);
        refs.hpFill = el('div', { class: 'pl-hp-fill' });
        refs.hp = el('div', { class: 'pl-hp' }, refs.hpFill);
        refs.meta = el('div', { class: 'pl-meta' });
        refs.arrow = TSIC.svg('svg', { viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' },
          TSIC.svg('path', { d: ARROW_PATH }));
        refs.dist = el('span', { class: 'pl-dist' });
        refs.root = el('div', { class: 'pl-row', 'data-player': pl.Id || '' },
          refs.dot,
          el('div', { class: 'pl-main' }, refs.nameRow, refs.hp, refs.meta),
          el('div', { class: 'pl-bearing' }, refs.arrow, refs.dist));

        // Host-only kick button for every non-host row.
        if (mpState.bLocalIsHost && !pl.bIsHost) {
          const kick = el('button', { class: 'pl-kick' }, 'Kick');
          kick.onclick = () => ctx.publish('UI.Cmd.Multiplayer.Kick', { PlayerId: pl.Id });
          refs.root.appendChild(kick);
        }
        return refs;
      }

      function updateRow(refs, pl, i, live, localLevel) {
        // Name can come through empty / "0" before PlayerState resolves -
        // call the first player "Host" so the row is never blank.
        const name = pl.Name || (live && live.Name) || (pl.bIsHost || i === 0 ? 'Host' : 'Player');
        const hasPawn = !!(live && live.bHasPawn);
        const isLocal = !!(live && live.bIsLocal);
        const isDead = !!(live && live.bIsDead);

        refs.dot.style.background = pl.Color || (live && live.Color) || '#888888';
        refs.name.textContent = name;
        refs.root.classList.toggle('is-dead', isDead);
        refs.root.classList.toggle('is-away', !!live && !hasPawn && !isLocal);

        // Badges only change when the flags do; rebuilding them every payload would churn
        // the DOM several times a second for nothing.
        const badges = [];
        if (isLocal) badges.push(['you', 'You']);
        if (pl.bIsHost) badges.push(['host', 'Host']);
        if (isDead) badges.push(['down', 'Down']);
        const signature = badges.map((b) => b[0]).join(',');
        if (refs.badgeSignature !== signature) {
          refs.badgeSignature = signature;
          while (refs.nameRow.childNodes.length > 1) refs.nameRow.removeChild(refs.nameRow.lastChild);
          badges.forEach((b) => refs.nameRow.appendChild(TSIC.el('span', { class: 'pl-badge pl-badge--' + b[0] }, b[1])));
        }

        const floors = floorLabel(live, localLevel);
        if (hasPawn && live.MaxHealth > 0) {
          const pct = Math.max(0, Math.min(1, live.HealthPct || 0));
          refs.hp.style.display = '';
          refs.hpFill.style.width = (pct * 100) + '%';
          refs.hp.setAttribute('data-state', pct <= 0.25 ? 'critical' : (pct <= 0.6 ? 'hurt' : 'ok'));
          refs.meta.textContent = Math.round(live.Health) + ' / ' + Math.round(live.MaxHealth) + (floors ? '  \u00b7  ' + floors : '');
        } else {
          // No pawn here means no health to show; say so rather than draw an empty bar,
          // which reads as "this teammate is dead".
          refs.hp.style.display = 'none';
          refs.meta.textContent = !live ? 'Health unknown' : (hasPawn ? '' : 'Out of range');
        }

        if (isLocal) {
          refs.arrow.style.display = 'none';
          refs.dist.textContent = 'you';
          refs.root.title = name;
        } else if (hasPawn) {
          refs.arrow.style.display = '';
          refs.arrow.style.transform = 'rotate(' + (live.BearingDeg || 0) + 'deg)';
          refs.dist.textContent = formatDistance(live.DistanceM);
          refs.root.title = name + ', ' + formatDistance(live.DistanceM) + ' ' + bearingLabel(live.BearingDeg)
            + (floors ? ', ' + floors : '');
        } else {
          refs.arrow.style.display = 'none';
          refs.dist.textContent = '\u2014';
          refs.root.title = name;
        }
      }

      function renderDay() {
        const dayEl = root.querySelector('#mp-day');
        if (!dayEl) return;
        const leaf = String(mpState.DaySection || '').split('.').pop();
        dayEl.textContent = mpState.Day ? 'Day ' + mpState.Day + (leaf ? ' \u00b7 ' + leaf : '') : '';
      }

      function renderPlayers() {
        const hostEl = root.querySelector('#players');
        if (!hostEl) return;
        renderDay();
        const players = listedPlayers();

        // The list keeps its row whether or not anyone is in it (see .pl's fixed height), so
        // say what the empty box means rather than leaving a blank plate under the heading.
        if (!players.length) {
          rowsKey = '';
          rows = [];
          hostEl.textContent = '';
          hostEl.appendChild(TSIC.el('div', { class: 'pl-empty' }, 'No other players'));
          return;
        }

        const key = (mpState.bLocalIsHost ? 'h:' : 'c:')
          + players.map((pl) => (pl.Id || pl.Name || '') + (pl.bIsHost ? '*' : '')).join('|');
        if (key !== rowsKey) {
          rowsKey = key;
          hostEl.textContent = '';
          rows = players.map((pl) => {
            const refs = makeRow(pl);
            hostEl.appendChild(refs.root);
            return refs;
          });
        }

        const liveById = new Map();
        (mpState.Players || []).forEach((p) => { if (p && p.Id) liveById.set(p.Id, p); });
        const local = (mpState.Players || []).find((p) => p && p.bIsLocal);
        const localLevel = (local && local.bHasPawn) ? (local.HeightLevel || 0) : null;

        players.forEach((pl, i) => {
          if (rows[i]) updateRow(rows[i], pl, i, liveById.get(pl.Id), localLevel);
        });
      }

      // Players list updates whenever UI.Players.List broadcasts. Bridge
      // channels are sticky so the most recent list replays on subscribe.
      ctx.on('tsic.msg.UI.Players.List', (p) => {
        lastPlayers = p;
        renderPlayers();
      });

      // Host settings + live roster: broadcast when the pause menu opens
      // (PublishStateForScreen) and republished a few times a second while it stays open.
      ctx.on('tsic.msg.UI.Multiplayer.State', (s) => {
        if (s) mpState = s;
        applyState();
        renderPlayers(); // kick-button visibility depends on bLocalIsHost; health/distance are live
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
        if (!mpState.bCanInvite) return;
        ctx.publish('UI.Cmd.Multiplayer.Invite');
      };

      applyState();

      root.querySelector('#btn-resume').onclick     = () => ctx.publish('UI.Cmd.Pause.Resume');
      root.querySelector('#btn-settings').onclick   = () => ctx.publish('UI.Cmd.Pause.Settings');
      root.querySelector('#btn-bug-report').onclick = () => ctx.publish('UI.Cmd.Pause.BugReport');
      root.querySelector('#btn-teleport-spawn').onclick = () => ctx.publish('UI.Cmd.Pause.TeleportToSpawn');
      root.querySelector('#btn-menu').onclick       = () => ctx.publish('UI.Cmd.Pause.QuitToMenu');
      // Menu.Exit's handler saves (SaveBeforeQuit) then quits the process —
      // the same path as the main menu's Fire Exit, minus the trip through it.
      root.querySelector('#btn-quit').onclick       = () => ctx.publish('UI.Cmd.Menu.Exit');

      // Dev/testing: reveal + wire the cheat menu button. Non-shipping builds
      // only, so it gates on bDevBuild.
      const devCheats = root.querySelector('#btn-dev-cheats');
      if (devCheats) {
        devCheats.onclick = () => ctx.publish('UI.Cmd.Pause.CheatMenu');
        ctx.on('tsic.msg.UI.State.DevMode', (p) => {
          devCheats.style.display = (p && p.bDevBuild) ? '' : 'none';
        });
      }
    },

    onShow(/* params, ctx */) {
      if (window.tsic && window.tsic.playSound) window.tsic.playSound('Pause.Open', 0.4);
    },

    onHide(/* ctx */) {
      if (window.tsic && window.tsic.playSound) window.tsic.playSound('Pause.Close', 0.4);
    },
  });
})();
