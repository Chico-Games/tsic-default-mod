// Basket screen — the transparent overlay above the 3D shopping-basket inventory.
//
// C++ (AScpBasketInventoryView) owns the basket, the item meshes, the cursor and every op. This
// screen leaves the page clear so the world shows through, forwards mouse buttons (the CEF layer
// eats them before the game can see them) and draws what a 3D scene cannot: the tooltip for the
// stack under the cursor, the count badges over stacks, and the weight line.
//   UI.Cmd.Basket.Pointer {Type, Button, X, Y}   button down (1) / up (2) over the overlay; X/Y -1 = the real cursor
//   UI.Cmd.Basket.RequestState              on show
//   UI.Basket.State                          hover/held names and counts, badges, weight
// Left click: take the stack (or drop everything held). Right click: take one / drop one.
// Release outside the basket drops the held stack into the world. Escape / I closes.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  // m:ss while there are minutes to go, plain seconds under one -- a cook is usually short
  // enough that "0:07" reads slower than "7s".
  const clock = (seconds) => {
    const t = Math.max(0, Math.ceil(Number(seconds) || 0));
    return t < 60 ? t + 's' : Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  };
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const STYLE = `
    [data-screen="Basket"] #bk-root { position: fixed; inset: 0; pointer-events: auto; user-select: none; }
    [data-screen="Basket"] #bk-badges { position: absolute; inset: 0; pointer-events: none; }
    [data-screen="Basket"] .bk-badge {
      position: absolute; transform: translate(-50%, -100%); min-width: 22px; padding: 1px 6px;
      font: 700 13px/18px var(--tsic-font, sans-serif); text-align: center; color: #fffdf7;
      background: rgba(20,17,12,0.82); border: 2px solid rgba(255,253,247,0.85); border-radius: 12px;
      text-shadow: 0 1px 0 #000; pointer-events: none; font-variant-numeric: tabular-nums;
    }
    [data-screen="Basket"] #bk-tip {
      position: absolute; pointer-events: none; transform: translate(14px, 18px); max-width: 260px;
      padding: 6px 10px; background: rgba(252,249,241,0.96); color: var(--cat-ink-dark, #1a1611);
      border: 2px solid var(--ink-night, #14110c); box-shadow: 3px 3px 0 rgba(0,0,0,0.35); font-size: 14px;
    }
    [data-screen="Basket"] #bk-tip .bk-tip-name { font-weight: 700; }
    [data-screen="Basket"] #bk-tip .bk-tip-sub { font-size: 12px; opacity: 0.75; }
    [data-screen="Basket"] #bk-tip.is-held { border-color: #1d4ed8; }
    [data-screen="Basket"] #bk-tip.is-bad { border-color: #b91c1c; }
    [data-screen="Basket"] #bk-tip.is-out { border-color: #b45309; }
    [data-screen="Basket"] #bk-status {
      position: absolute; left: 24px; bottom: 24px; padding: 8px 12px; pointer-events: none;
      background: rgba(252,249,241,0.92); color: var(--cat-ink-dark, #1a1611); border: 2px solid var(--ink-night, #14110c);
      font-size: 13px; line-height: 18px; min-width: 180px;
    }
    [data-screen="Basket"] #bk-status .bk-title { font-weight: 700; font-size: 15px; margin-bottom: 2px; }
    [data-screen="Basket"] #bk-status .bk-over { color: #b91c1c; font-weight: 700; }
    [data-screen="Basket"] #bk-inspect {
      position: absolute; left: 50%; top: 14%; transform: translateX(-50%); text-align: center; pointer-events: none;
      padding: 10px 18px; background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.25); color: #fff;
    }
    [data-screen="Basket"] #bk-inspect .bk-inspect-name { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
    [data-screen="Basket"] #bk-inspect .bk-inspect-count { font-size: 34px; font-variant-numeric: tabular-nums; color: #fbbf24; }
    [data-screen="Basket"] #bk-inspect .bk-inspect-hint { font-size: 12px; opacity: 0.75; margin-top: 4px; }
    [data-screen="Basket"] #bk-tabs {
      position: absolute; left: 24px; top: 96px; display: flex; flex-direction: column; gap: 8px; pointer-events: auto;
    }
    [data-screen="Basket"] #bk-peer {
      position: absolute; right: 24px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 8px; align-items: stretch;
      pointer-events: auto; min-width: 170px; padding: 10px 12px; background: rgba(252,249,241,0.92); color: var(--cat-ink-dark, #1a1611);
      border: 2px solid var(--ink-night, #14110c); box-shadow: 3px 3px 0 rgba(0,0,0,0.35);
    }
    [data-screen="Basket"] #bk-peer[hidden] { display: none; }
    [data-screen="Basket"] #bk-peer .bk-peer-cook { background: var(--mag-yellow, #f5c518); }
    [data-screen="Basket"] #bk-peer .bk-peer-cooking { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; padding: 6px 0 2px; }
    [data-screen="Basket"] #bk-peer .bk-peer-preview { font-size: 12px; font-weight: 700; padding: 2px 0 0; }
    [data-screen="Basket"] #bk-peer .bk-peer-preview.is-none { opacity: 0.55; font-weight: 400; }
    /* The timer dial: a wedge of the ring is eaten away as the job runs, so what is left of
       the circle IS what is left of the cook -- the same conic-gradient + hole the HUD's hold
       ring uses, turned round so it drains instead of filling. */
    /* Registered so the wedge can be animated: an unregistered custom property is a string and
       jumps between publishes, which on a quarter-second poll reads as a stutter. */
    @property --bk-left { syntax: '<number>'; initial-value: 100; inherits: true; }
    [data-screen="Basket"] #bk-peer .bk-peer-dial { position: relative; width: 84px; height: 84px; margin: 6px auto 2px; transition: --bk-left 260ms linear; }
    [data-screen="Basket"] #bk-peer .bk-peer-dial-ring {
      position: absolute; inset: 0; border-radius: 50%;
      background: conic-gradient(var(--mag-yellow, #f5c518) calc(var(--bk-left, 100) * 1%), rgba(241,229,207,0.18) 0);
      mask: radial-gradient(circle, transparent 29px, #000 30px);
      -webkit-mask: radial-gradient(circle, transparent 29px, #000 30px);
    }
    [data-screen="Basket"] #bk-peer .bk-peer-dial.is-done .bk-peer-dial-ring { background: conic-gradient(#3fa34d 100%, #3fa34d 0); }
    [data-screen="Basket"] #bk-peer .bk-peer-dial-face {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; line-height: 1.05;
    }
    [data-screen="Basket"] #bk-peer .bk-peer-dial-time { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
    [data-screen="Basket"] #bk-peer .bk-peer-dial-verb { font-size: 10px; letter-spacing: 0.6px; text-transform: uppercase; opacity: 0.75; }
    [data-screen="Basket"] #bk-peer [hidden] { display: none; }
    [data-screen="Basket"] #bk-inspect[hidden], [data-screen="Basket"] #bk-tip[hidden] { display: none; }
    [data-screen="Basket"] #bk-peer .bk-peer-name { font-weight: 700; font-size: 16px; letter-spacing: 1px; text-transform: uppercase; }
    [data-screen="Basket"] #bk-peer .bk-peer-fill { font-size: 12px; opacity: 0.75; margin-bottom: 4px; }
    [data-screen="Basket"] #bk-peer .bk-peer-btn {
      padding: 7px 12px; font: 700 13px/16px var(--tsic-font, sans-serif); letter-spacing: 1px; text-transform: uppercase; cursor: pointer;
      background: var(--paper-bright, #fffdf3); color: var(--ink-night, #14110c); border: 2px solid var(--ink-night, #14110c);
    }
    [data-screen="Basket"] #bk-peer .bk-peer-btn:hover { background: var(--mag-yellow, #f5c518); }
    [data-screen="Basket"] .bk-tab {
      padding: 8px 18px; font: 700 15px/18px var(--tsic-font, sans-serif); letter-spacing: 1px; text-transform: uppercase;
      background: rgba(252,249,241,0.92); color: var(--cat-ink-dark, #1a1611); border: 2px solid var(--ink-night, #14110c);
      box-shadow: 3px 3px 0 rgba(0,0,0,0.35); cursor: pointer;
    }
    [data-screen="Basket"] .bk-tab .bk-tab-count { font-weight: 400; font-size: 12px; opacity: 0.7; margin-left: 6px; text-transform: none; }
    [data-screen="Basket"] .bk-tab.is-active { background: #1d4ed8; color: #fff; }
    [data-screen="Basket"] .bk-tab:hover:not(.is-active):not(.is-disabled) { background: var(--mag-yellow, #f5c518); }
    [data-screen="Basket"] .bk-tab.is-disabled { opacity: 0.4; cursor: not-allowed; }
    [data-screen="Basket"] #bk-hints {
      position: absolute; right: 24px; bottom: 24px; padding: 8px 12px; pointer-events: none; text-align: right;
      background: rgba(20,17,12,0.72); color: #fffdf7; font-size: 12px; line-height: 17px; border-radius: 3px;
    }
    [data-screen="Basket"] #bk-hints b { color: #fbbf24; }
    [data-screen="Basket"] #bk-sew {
      position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%); pointer-events: none;
      min-width: 260px; text-align: center; color: #fffdf7; text-shadow: 0 2px 4px rgba(0,0,0,0.9);
      font: 700 15px/22px var(--tsic-font, sans-serif);
    }
    [data-screen="Basket"] #bk-sew[hidden] { display: none; }
    [data-screen="Basket"] #bk-sew .bk-sew-line.is-bad { color: #fca5a5; }
    [data-screen="Basket"] #bk-sew .bk-sew-bar {
      height: 8px; margin: 6px auto 0; width: 220px; background: rgba(20,17,12,0.65);
      border: 2px solid rgba(255,253,247,0.85);
    }
    [data-screen="Basket"] #bk-sew .bk-sew-bar i { display: block; height: 100%; background: var(--mag-yellow, #f5c518); }
    [data-screen="Basket"] #bk-sew .bk-sew-makes { font-size: 12px; font-weight: 400; opacity: 0.8; margin-top: 3px; }
  `;
  let styleInjected = false;
  function injectStyleOnce() {
    if (styleInjected) return;
    styleInjected = true;
    const el = document.createElement('style');
    el.textContent = STYLE;
    document.head.appendChild(el);
  }

  const TEMPLATE = `<div id="bk-root">
    <div id="bk-badges"></div>
    <div id="bk-tabs"></div>
    <div id="bk-peer" hidden>
      <div class="bk-peer-name"></div>
      <div class="bk-peer-fill"></div>
      <button type="button" class="bk-peer-btn bk-peer-cook" id="bk-cook" data-no-sfx hidden>Cook</button>
      <div class="bk-peer-dial" id="bk-dial" hidden>
        <div class="bk-peer-dial-ring"></div>
        <div class="bk-peer-dial-face">
          <div class="bk-peer-dial-time"></div>
          <div class="bk-peer-dial-verb"></div>
        </div>
      </div>
      <div class="bk-peer-cooking" id="bk-cooking" hidden></div>
      <div class="bk-peer-preview" id="bk-preview" hidden></div>
    </div>
    <div id="bk-sew" hidden></div>
    <div id="bk-inspect" hidden></div>
    <div id="bk-tip" hidden></div>
    <div id="bk-status"><div class="bk-title">Basket</div><div id="bk-slots"></div><div id="bk-weight"></div></div>
    <div id="bk-hints">
      <div><b>Left click</b> take stack &middot; <b>Right click</b> take one</div>
      <div>holding: <b>Left</b> drop all &middot; <b>Right</b> drop one &middot; <b>outside</b> drop to floor</div>
      <div><b>Shift</b> + click sends a stack straight to the other side &middot; <b>Shift</b> + right sends one</div>
      <div><b>hover a box</b> of screws or dowels to open it &middot; off the left-hand piles one comes at a time</div>
      <div><b>click</b> a floor item to take it &middot; the <b>hooks</b> on the front hold weapons</div>
      <div><b>Esc</b> / <b>I</b> close</div>
    </div>
  </div>`;

  let requestState = null;

  TSIC.registerScreen('Basket', {
    inputModeTag: 'InputMode.Menu.Inventory',
    cancelCmd: 'UI.Cmd.Basket.Close',
    actionBarContext: [
      { ActionName: 'IA_UI_CancelBack', Label: 'Close', KeyName: 'Escape', Priority: 1000 },
    ],
    opaque: false,
    screenSoundOpen: 'Inventory.Open',
    screenSoundClose: 'Inventory.Close',
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();
      const $ = (id) => root.querySelector('#' + id);
      const tip = $('bk-tip');
      const badges = $('bk-badges');
      let last = {};
      let mouse = { x: 0, y: 0 };

      function placeTip() {
        tip.style.left = mouse.x + 'px';
        tip.style.top = mouse.y + 'px';
      }

      // The switcher along the top: one tab per carried container, the shown one lit.
      const tabs = $('bk-tabs');
      let tabsKey = '';
      function renderTabs(state) {
        const list = state.Containers || [];
        const key = JSON.stringify([state.Container, list]);
        if (key === tabsKey) return;
        tabsKey = key;
        tabs.replaceChildren();
        for (const c of list) {
          const cls = 'bk-tab' + (c.Name === state.Container ? ' is-active' : '') + (c.bDisabled ? ' is-disabled' : '');
          const el = TSIC.el('button', Object.assign({ type: 'button', class: cls, 'data-no-sfx': '' }, c.bDisabled ? { disabled: '' } : {}),
            esc(c.Label), TSIC.el('span', { class: 'bk-tab-count' }, `${c.Used} / ${c.Capacity}`));
          el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
          el.addEventListener('pointerup', (ev) => ev.stopPropagation());
          el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            // A bag that can put nothing into the storage open beside it stays on the shelf.
            if (c.bDisabled) return;
            if (c.Name !== state.Container) { tsic.playSound('UI.Click'); ctx.publish('UI.Cmd.Basket.Container', { Name: c.Name }); }
          });
          tabs.appendChild(el);
        }
      }

      for (const [id, cmd] of [['bk-cook', 'UI.Cmd.Basket.Cook']]) {
        const el = $(id);
        el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
        el.addEventListener('pointerup', (ev) => ev.stopPropagation());
        el.addEventListener('click', (ev) => { ev.stopPropagation(); tsic.playSound('UI.Click'); ctx.publish(cmd, {}); });
      }

      // --- The seam ---------------------------------------------------------------------------
      // The cloth is the button. C++ decides everything -- whether the bed is sewable, whether the
      // cursor is on the cloth, how far the seam has got -- so all the page does is say whether
      // the left button is down, and draw the line under the machine.
      const sew = { on: false, down: false };
      const sewRoot = $('bk-sew');

      function sewApply(state) {
        sew.on = !!state.bActive;
        sewRoot.hidden = !sew.on;
        if (!sew.on) return;
        const pct = Math.round(Math.max(0, Math.min(1, state.Progress || 0)) * 100);
        // The verb comes from the station: the same bed and the same hold are a sewing
        // machine and a saw bench, so the page must not decide it is sewing.
        const doing = state.WorkingLabel || 'Sewing';
        const verb = (state.ActionLabel || 'Sew').toLowerCase();
        const line = state.Message ? esc(state.Message)
          : state.bHolding ? esc(doing) + '&hellip; keep holding'
          : 'Hold it to ' + esc(verb);
        sewRoot.innerHTML =
          '<div class="bk-sew-line' + (state.Message ? ' is-bad' : '') + '">' + line + '</div>' +
          (state.Message ? '' :
            '<div class="bk-sew-bar"><i style="width:' + pct + '%"></i></div>' +
            (state.Making ? '<div class="bk-sew-makes">Makes ' + esc(state.Making) + '</div>' : ''));
      }

      function render(state) {
        last = state;
        renderTabs(state);
        // Tooltip: the held stack wins over the hovered one.
        tip.className = '';
        if (state.HeldName) {
          const where = state.bHeldOverBody ? (state.bHeldWearable ? 'Release to wear' : 'Cannot be worn')
            : state.bDropOutside ? 'Release to drop on the floor'
            : state.bHeldOverPeer ? (state.bDropValid ? `Release to put in ${esc(state.PeerLabel || 'storage')}` : `No room in ${esc(state.PeerLabel || 'storage')}`)
            : state.bDropValid ? 'Release to place' : 'No room here';
          tip.innerHTML = `<div class="bk-tip-name">${esc(state.HeldName)}${state.HeldCount > 1 ? ' &times; ' + state.HeldCount : ''}</div>` +
            `<div class="bk-tip-sub">${esc(where)}</div>`;
          tip.classList.add(state.bDropOutside ? 'is-out' : state.bDropValid ? 'is-held' : 'is-bad');
          tip.hidden = false;
        } else if (state.HoverBodyPart && !state.HoverName) {
          // On the doll, where nothing is worn.
          tip.innerHTML = `<div class="bk-tip-name">${esc(state.HoverBodyPart)}</div>` +
            `<div class="bk-tip-sub">Nothing worn &middot; drag armour here</div>`;
          tip.hidden = false;
        } else if (state.HoverName) {
          const sub = state.bHoverWorn ? `Worn on ${esc(state.HoverBodyPart)} &middot; Left: take off`
            : state.bHoverFixed ? 'Left: take one'
            : `Left: take ${state.HoverCount > 1 ? 'stack' : 'it'}${state.HoverCount > 1 ? ' &middot; Right: take one' : ''}`;
          tip.innerHTML = `<div class="bk-tip-name">${esc(state.HoverName)}${state.HoverCount > 1 ? ' &times; ' + state.HoverCount : ''}</div>` +
            `<div class="bk-tip-sub">${sub}</div>`;
          tip.hidden = false;
        } else {
          tip.hidden = true;
        }
        placeTip();

        // An opened box: its name and what the zone holds, over the box at the camera.
        const inspect = $('bk-inspect');
        if (state.InspectName) {
          inspect.innerHTML = `<div class="bk-inspect-name">${esc(state.InspectName)}</div>` +
            `<div class="bk-inspect-count">${state.InspectCount}<span style="font-size:16px;opacity:0.7"> / ${state.InspectCapacity}</span></div>` +
            `<div class="bk-inspect-hint">move away to close it</div>`;
          inspect.hidden = false;
        } else {
          inspect.hidden = true;
        }
        // The storage pane beside the bag: its name, fill and the bulk buttons.
        const peer = $('bk-peer');
        if (state.PeerLabel) {
          peer.querySelector('.bk-peer-name').textContent = state.PeerLabel;
          peer.querySelector('.bk-peer-fill').textContent = `${state.PeerUsed} / ${state.PeerCapacity} ${state.bZoned ? 'slots' : 'cells'}`;
          // A station worked from a tray: its button while idle with something on it, progress while it runs.
          const cook = $('bk-cook');
          const cooking = $('bk-cooking');
          const progress = typeof state.PeerCookProgress === 'number' ? state.PeerCookProgress : -1;
          const verb = state.PeerCookLabel || 'Cook';
          const working = state.PeerCookWorking || 'Cooking';
          cook.textContent = verb;
          cook.hidden = sew.on || !state.bPeerCooks || state.bPeerCookControls || progress >= 0 || state.PeerUsed <= 0;
          // A station with knobs: how to turn it on, while it sits idle with something in it.
          const idleHint = state.bPeerCookControls && progress < 0 && state.PeerUsed > 0;
          cooking.hidden = !state.bPeerCooks || (progress < 0 && !idleHint);
          if (!cooking.hidden) {
            // A station with a door is shut before it is turned on; a sewing machine has no
            // door, only the dial that sets its needle going.
            cooking.textContent = idleHint ? (verb === 'Cook' ? 'Shut the door, then turn a knob' : 'Turn the dial on the machine')
              : progress >= 1 ? 'Done — take it' : working;
          }
          // The dial: how much longer, read as a shape rather than a number you have to do
          // arithmetic on. It stands in for the percentage, which said nothing about time.
          const dial = $('bk-dial');
          dial.hidden = progress < 0;
          if (!dial.hidden) {
            const done = progress >= 1;
            const left = Math.max(0, Math.min(100, (1 - progress) * 100));
            dial.style.setProperty('--bk-left', done ? 100 : left.toFixed(2));
            dial.classList.toggle('is-done', done);
            dial.querySelector('.bk-peer-dial-time').textContent = done ? 'Done' : clock(state.PeerCookRemaining);
            dial.querySelector('.bk-peer-dial-verb').textContent = done ? 'take it' : working;
          }
          // What the pile on the tray adds up to, so a wrong pile reads as wrong before the press.
          const preview = $('bk-preview');
          const showPreview = state.bPeerCooks && progress < 0 && state.PeerUsed > 0;
          preview.hidden = !showPreview;
          if (showPreview) {
            preview.textContent = state.PeerCookPreview ? `Makes ${state.PeerCookPreview}` : 'Makes nothing yet';
            preview.classList.toggle('is-none', !state.PeerCookPreview);
          }
          peer.hidden = sew.on;
        } else {
          peer.hidden = true;
        }
        // Badges: one per stack of two or more, at the top of the stack.
        const list = state.Badges || [];
        badges.innerHTML = list.map((b) =>
          `<div class="bk-badge" style="left:${(b.X * 100).toFixed(2)}%;top:${(b.Y * 100).toFixed(2)}%">${b.Count}</div>`).join('');

        const cap = state.SlotCapacity || 0;
        const shown = (state.Containers || []).find((c) => c.Name === state.Container);
        root.querySelector('.bk-title').textContent = shown ? shown.Label : 'Basket';
        $('bk-slots').textContent = cap ? `Cells ${state.UsedSlots} / ${cap}` : '';
        const over = state.MaxWeight > 0 && state.Weight > state.MaxWeight;
        $('bk-weight').innerHTML = `Weight <span class="${over ? 'bk-over' : ''}">${Number(state.Weight || 0).toFixed(1)}</span>` +
          (state.MaxWeight > 0 ? ` / ${Number(state.MaxWeight).toFixed(0)}` : '') + (over ? ' &middot; overburdened' : '');
      }

      // The page is the cursor authority: this overlay sits on top of the game viewport and
      // eats every mouse event, so the viewport's own cursor cache never moves while a screen
      // is up. Moves go over at ~30 Hz as viewport fractions; buttons carry the position too.
      // Shift travels with the event: C++ reads it on the click, so it has to be the state at the
      // moment of the press, not whatever the key is doing when the message arrives.
      const frac = (ev) => ({
        X: ev.clientX / Math.max(1, window.innerWidth),
        Y: ev.clientY / Math.max(1, window.innerHeight),
        bShift: !!ev.shiftKey,
      });
      let moveTimer = null;
      let lastMove = null;
      function flushMove() {
        moveTimer = null;
        if (!lastMove) return;
        ctx.publish('UI.Cmd.Basket.Pointer', { Type: 0, Button: 0, ...lastMove });
        lastMove = null;
      }
      root.addEventListener('pointermove', (ev) => {
        mouse = { x: ev.clientX, y: ev.clientY };
        placeTip();
        lastMove = frac(ev);
        if (!moveTimer) moveTimer = setTimeout(flushMove, 33);
      });
      root.addEventListener('pointerdown', (ev) => {
        if (ev.pointerType && ev.pointerType !== 'mouse') return;
        ev.preventDefault();
        ctx.publish('UI.Cmd.Basket.Pointer', { Type: 1, Button: ev.button, ...frac(ev) });
      });
      root.addEventListener('pointerup', (ev) => {
        if (ev.pointerType && ev.pointerType !== 'mouse') return;
        ev.preventDefault();
        ctx.publish('UI.Cmd.Basket.Pointer', { Type: 2, Button: ev.button, ...frac(ev) });
      });
      root.addEventListener('contextmenu', (ev) => ev.preventDefault());

      ctx.on('tsic.msg.UI.Basket.State', (state) => render(state || {}));
      ctx.on('tsic.msg.UI.Sewing.State', (state) => sewApply(state || {}));
      requestState = () => ctx.publish('UI.Cmd.Basket.RequestState', {});
    },

    onShow() {
      if (requestState) requestState();
    },
  });
})();
