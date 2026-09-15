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
    [data-screen="Basket"] #bk-hints {
      position: absolute; right: 24px; bottom: 24px; padding: 8px 12px; pointer-events: none; text-align: right;
      background: rgba(20,17,12,0.72); color: #fffdf7; font-size: 12px; line-height: 17px; border-radius: 3px;
    }
    [data-screen="Basket"] #bk-hints b { color: #fbbf24; }
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
    <div id="bk-tip" hidden></div>
    <div id="bk-status"><div class="bk-title">Basket</div><div id="bk-slots"></div><div id="bk-weight"></div></div>
    <div id="bk-hints">
      <div><b>Left click</b> take stack &middot; <b>Right click</b> take one</div>
      <div>holding: <b>Left</b> drop all &middot; <b>Right</b> drop one &middot; <b>outside</b> drop to floor</div>
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

      function render(state) {
        last = state;
        // Tooltip: the held stack wins over the hovered one.
        tip.className = '';
        if (state.HeldName) {
          const where = state.bDropOutside ? 'Release to drop on the floor'
            : state.bDropValid ? 'Release to place' : 'No room here';
          tip.innerHTML = `<div class="bk-tip-name">${esc(state.HeldName)}${state.HeldCount > 1 ? ' &times; ' + state.HeldCount : ''}</div>` +
            `<div class="bk-tip-sub">${esc(where)}</div>`;
          tip.classList.add(state.bDropOutside ? 'is-out' : state.bDropValid ? 'is-held' : 'is-bad');
          tip.hidden = false;
        } else if (state.HoverName) {
          tip.innerHTML = `<div class="bk-tip-name">${esc(state.HoverName)}${state.HoverCount > 1 ? ' &times; ' + state.HoverCount : ''}</div>` +
            `<div class="bk-tip-sub">Left: take ${state.HoverCount > 1 ? 'stack' : 'it'}${state.HoverCount > 1 ? ' &middot; Right: take one' : ''}</div>`;
          tip.hidden = false;
        } else {
          tip.hidden = true;
        }
        placeTip();

        // Badges: one per stack of two or more, at the top of the stack.
        const list = state.Badges || [];
        badges.innerHTML = list.map((b) =>
          `<div class="bk-badge" style="left:${(b.X * 100).toFixed(2)}%;top:${(b.Y * 100).toFixed(2)}%">${b.Count}</div>`).join('');

        const cap = state.SlotCapacity || 0;
        $('bk-slots').textContent = cap ? `Cells ${state.UsedSlots} / ${cap}` : '';
        const over = state.MaxWeight > 0 && state.Weight > state.MaxWeight;
        $('bk-weight').innerHTML = `Weight <span class="${over ? 'bk-over' : ''}">${Number(state.Weight || 0).toFixed(1)}</span>` +
          (state.MaxWeight > 0 ? ` / ${Number(state.MaxWeight).toFixed(0)}` : '') + (over ? ' &middot; overburdened' : '');
      }

      // The page-drawn cursor follows pointermove; the tooltip rides beside it.
      root.addEventListener('pointermove', (ev) => {
        mouse = { x: ev.clientX, y: ev.clientY };
        placeTip();
      });
      // Mouse buttons go to C++; it polls the cursor position itself.
      root.addEventListener('pointerdown', (ev) => {
        if (ev.pointerType && ev.pointerType !== 'mouse') return;
        ev.preventDefault();
        ctx.publish('UI.Cmd.Basket.Pointer', { Type: 1, Button: ev.button, X: -1, Y: -1 });
      });
      root.addEventListener('pointerup', (ev) => {
        if (ev.pointerType && ev.pointerType !== 'mouse') return;
        ev.preventDefault();
        ctx.publish('UI.Cmd.Basket.Pointer', { Type: 2, Button: ev.button, X: -1, Y: -1 });
      });
      root.addEventListener('contextmenu', (ev) => ev.preventDefault());

      ctx.on('tsic.msg.UI.Basket.State', (state) => render(state || {}));
      requestState = () => ctx.publish('UI.Cmd.Basket.RequestState', {});
    },

    onShow() {
      if (requestState) requestState();
    },
  });
})();
