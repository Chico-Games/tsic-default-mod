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
    [data-screen="Basket"] #bk-sew { position: absolute; inset: 0; pointer-events: none; }
    [data-screen="Basket"] #bk-sew[hidden] { display: none; }
    [data-screen="Basket"] #bk-sew svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    [data-screen="Basket"] #bk-sew .bk-sew-ring { fill: none; stroke: rgba(252,249,241,0.30); stroke-width: 3; stroke-dasharray: 7 9; }
    [data-screen="Basket"] #bk-sew .bk-sew-seam { fill: none; stroke: var(--mag-yellow, #f5c518); stroke-width: 5; stroke-linecap: round; }
    [data-screen="Basket"] #bk-sew .bk-sew-marker { fill: rgba(252,249,241,0.10); stroke: #fffdf7; stroke-width: 3; }
    [data-screen="Basket"] #bk-sew .bk-sew-marker.is-feeding { fill: rgba(245,197,24,0.28); stroke: var(--mag-yellow, #f5c518); }
    [data-screen="Basket"] #bk-sew .bk-sew-marker.is-slipped { fill: rgba(185,28,28,0.30); stroke: #f87171; }
    [data-screen="Basket"] #bk-sew .bk-sew-needle { fill: none; stroke: #fffdf7; stroke-width: 2; opacity: 0.55; }
    [data-screen="Basket"] #bk-sew .bk-sew-caption {
      position: absolute; transform: translate(-50%, -50%); text-align: center; pointer-events: none;
      color: #fffdf7; text-shadow: 0 2px 4px rgba(0,0,0,0.85); font: 700 15px/21px var(--tsic-font, sans-serif);
    }
    [data-screen="Basket"] #bk-sew .bk-sew-pct { font-size: 30px; font-variant-numeric: tabular-nums; color: var(--mag-yellow, #f5c518); }
    [data-screen="Basket"] #bk-sew .bk-sew-hint { font-size: 12px; font-weight: 400; opacity: 0.8; }
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
      <button type="button" class="bk-peer-btn" id="bk-take-all" data-no-sfx>Take all</button>
      <button type="button" class="bk-peer-btn" id="bk-put-all" data-no-sfx>Put all</button>
      <button type="button" class="bk-peer-btn bk-peer-cook" id="bk-cook" data-no-sfx hidden>Cook</button>
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
      <div><b>hover a box</b> of screws or dowels to open it &middot; cardboard and planks stay put</div>
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

      for (const [id, cmd] of [['bk-take-all', 'UI.Cmd.Basket.TakeAll'], ['bk-put-all', 'UI.Cmd.Basket.PutAll'], ['bk-cook', 'UI.Cmd.Basket.Cook']]) {
        const el = $(id);
        el.addEventListener('pointerdown', (ev) => ev.stopPropagation());
        el.addEventListener('pointerup', (ev) => ev.stopPropagation());
        el.addEventListener('click', (ev) => { ev.stopPropagation(); tsic.playSound('UI.Click'); ctx.publish(cmd, {}); });
      }

      // --- The seam ---------------------------------------------------------------------------
      // The machine feeds itself: hold the left button on the marker and it sets off round the
      // ring at the machine's own pace, dragging the cloth with it. The hand's job is to keep up.
      // Let go, or let the marker out from under the cursor, and the cloth slips out of the
      // needle: the seam goes back to nothing and is started again. C++ owns the machine, the
      // cloth and when the seam is done; the page owns the ring, because the page is where the
      // cursor is.
      const TWO_PI = Math.PI * 2;
      const sew = {
        on: false, travelled: 0, total: TWO_PI * 2, down: false, feeding: false, slipped: 0,
        centre: [0.5, 0.5], ring: 0.21, marker: 0.045, rate: Math.PI, making: '',
        sent: 0, frame: null, last: 0,
      };
      const sewRoot = $('bk-sew');
      let sewSvg = null;
      let sewSeam = null;
      let sewMarker = null;
      let sewCaption = null;

      function sewBuild() {
        sewSvg = TSIC.svg('svg');
        sewSvg.appendChild(TSIC.svg('circle', { class: 'bk-sew-ring', cx: 0, cy: 0, r: 1 }));
        sewSeam = TSIC.svg('path', { class: 'bk-sew-seam', d: '' });
        sewSvg.appendChild(sewSeam);
        sewMarker = TSIC.svg('circle', { class: 'bk-sew-marker', cx: 0, cy: 0, r: 1 });
        sewSvg.appendChild(sewMarker);
        sewCaption = TSIC.el('div', { class: 'bk-sew-caption' });
        sewRoot.replaceChildren(sewSvg, sewCaption);
      }

      const sewGeom = () => {
        const w = Math.max(1, window.innerWidth);
        const h = Math.max(1, window.innerHeight);
        const unit = Math.min(w, h);
        return { cx: sew.centre[0] * w, cy: sew.centre[1] * h, r: sew.ring * unit, m: sew.marker * unit };
      };
      // Angle 0 is the BOTTOM of the ring, nearest the player, and the marker climbs from there:
      // the cloth feeds away from them into the machine, so the marker rises the way it does.
      const sewAt = (g, a) => [g.cx + g.r * Math.sin(a), g.cy + g.r * Math.cos(a)];

      function sewDraw() {
        const g = sewGeom();
        const ring = sewSvg.firstChild;
        ring.setAttribute('cx', g.cx); ring.setAttribute('cy', g.cy); ring.setAttribute('r', g.r);
        // The seam so far: at most the last turn's worth of arc, so three turns do not overdraw.
        const done = Math.min(sew.travelled, sew.total);
        const from = Math.max(0, done - TWO_PI * 0.999);
        const a0 = sewAt(g, from);
        const a1 = sewAt(g, done);
        const big = (done - from) > Math.PI ? 1 : 0;
        sewSeam.setAttribute('d', done - from < 0.001 ? ''
          : 'M ' + a0[0].toFixed(1) + ' ' + a0[1].toFixed(1) + ' A ' + g.r.toFixed(1) + ' ' + g.r.toFixed(1)
            + ' 0 ' + big + ' 1 ' + a1[0].toFixed(1) + ' ' + a1[1].toFixed(1));
        const p = sewAt(g, done);
        sewMarker.setAttribute('cx', p[0]); sewMarker.setAttribute('cy', p[1]); sewMarker.setAttribute('r', g.m);
        sewMarker.classList.toggle('is-feeding', sew.feeding);
        sewMarker.classList.toggle('is-slipped', sew.slipped > 0);
        const pct = Math.round(Math.min(1, sew.travelled / sew.total) * 100);
        sewCaption.style.left = g.cx + 'px';
        sewCaption.style.top = g.cy + 'px';
        const hint = sew.slipped > 0 ? 'the cloth slipped out &mdash; hold the marker again'
          : sew.feeding ? 'keep up with it'
          : 'hold the left button <b>on the marker</b> and follow it round &middot; <b>Esc</b> stop';
        sewCaption.innerHTML = '<div class="bk-sew-pct">' + pct + '%</div>'
          + '<div>' + esc(sew.making ? 'Sewing ' + sew.making : 'Sewing') + '</div>'
          + '<div class="bk-sew-hint">' + hint + '</div>';
      }

      function sewTick(now) {
        sew.frame = sew.on ? requestAnimationFrame(sewTick) : null;
        if (!sew.on) return;
        const dt = Math.min(0.1, Math.max(0, (now - sew.last) / 1000));
        sew.last = now;
        const g = sewGeom();
        const p = sewAt(g, Math.min(sew.travelled, sew.total));
        const dx = mouse.x - p[0];
        const dy = mouse.y - p[1];
        const under = (dx * dx + dy * dy) <= g.m * g.m;
        const was = sew.feeding;
        sew.feeding = sew.down && under && sew.travelled < sew.total;
        // It was running and the hand has come off it: the cloth is out of the needle.
        if (was && !sew.feeding && sew.travelled < sew.total && sew.travelled > 0) {
          sew.travelled = 0;
          sew.down = false;
          sew.slipped = now;
          tsic.playSound('Inventory.Invalid');
        }
        if (sew.slipped && now - sew.slipped > 1400) sew.slipped = 0;
        // Held: the machine feeds itself, at its own pace, and the hand keeps up.
        if (sew.feeding) sew.travelled = Math.min(sew.total, sew.travelled + sew.rate * dt);
        sewDraw();
        const progress = Math.min(1, sew.travelled / sew.total);
        // 20 Hz is plenty: C++ eases its own pose towards whatever it was last told, and a reset
        // to 0 has to arrive as promptly as the rest.
        if (now - sew.sent > 50 || progress >= 1 || progress === 0) {
          sew.sent = now;
          ctx.publish('UI.Cmd.Sewing.Feed', { Progress: progress });
        }
      }

      function sewApply(state) {
        const on = !!state.bActive;
        if (on) {
          sew.centre = [state.CentreX, state.CentreY];
          sew.ring = state.RingRadius || 0.21;
          sew.marker = state.MarkerRadius || 0.045;
          sew.total = TWO_PI * Math.max(0.25, state.Turns || 2);
          sew.rate = (state.DegreesPerSecond || 180) * Math.PI / 180;
          sew.making = state.Making || '';
        }
        if (on === sew.on) { if (on) sewDraw(); return; }
        sew.on = on;
        sewRoot.hidden = !on;
        if (!on) { sew.down = false; sew.feeding = false; return; }
        sew.travelled = 0;
        sew.slipped = 0;
        sew.last = performance.now();
        sew.sent = 0;
        sewBuild();
        sewDraw();
        if (!sew.frame) sew.frame = requestAnimationFrame(sewTick);
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
            : state.bHoverFixed ? 'Stays in the basket'
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
          peer.querySelector('.bk-peer-fill').textContent = `${state.PeerUsed} / ${state.PeerCapacity} cells`;
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
              : progress >= 1 ? 'Done — take it' : `${working}… ${Math.round(progress * 100)}%`;
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
      const frac = (ev) => ({ X: ev.clientX / Math.max(1, window.innerWidth), Y: ev.clientY / Math.max(1, window.innerHeight) });
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
        if (sew.on) return;
        lastMove = frac(ev);
        if (!moveTimer) moveTimer = setTimeout(flushMove, 33);
      });
      root.addEventListener('pointerdown', (ev) => {
        if (ev.pointerType && ev.pointerType !== 'mouse') return;
        ev.preventDefault();
        // A seam owns the pointer: a hand walking the marker round must not also pick stacks up.
        if (sew.on) {
          if (ev.button === 0) {
            const g = sewGeom();
            const p = sewAt(g, Math.min(sew.travelled, sew.total));
            sew.down = (ev.clientX - p[0]) ** 2 + (ev.clientY - p[1]) ** 2 <= g.m * g.m;
          }
          return;
        }
        ctx.publish('UI.Cmd.Basket.Pointer', { Type: 1, Button: ev.button, ...frac(ev) });
      });
      root.addEventListener('pointerup', (ev) => {
        if (ev.pointerType && ev.pointerType !== 'mouse') return;
        ev.preventDefault();
        if (sew.on) { if (ev.button === 0) sew.down = false; return; }
        ctx.publish('UI.Cmd.Basket.Pointer', { Type: 2, Button: ev.button, ...frac(ev) });
      });
      root.addEventListener('contextmenu', (ev) => ev.preventDefault());

      ctx.on('tsic.msg.UI.Basket.State', (state) => render(state || {}));
      ctx.on('tsic.msg.UI.Sewing.State', (state) => { sewApply(state || {}); render(last); });
      requestState = () => ctx.publish('UI.Cmd.Basket.RequestState', {});
    },

    onShow() {
      if (requestState) requestState();
    },
  });
})();
