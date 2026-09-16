// Basket bench screen module — the setup sheet for the 3D basket inventory (F10 in L_BasketArena).
//
// C++ owns the loop: UI.Cmd.BasketArena.Toggle sweeps the floor and opens this screen; Apply
// sends the whole setup back on UI.Cmd.BasketArena.Apply and C++ closes the screen, empties the
// bag, wears the backpack, replaces the furniture slots, grants each bag row, drops each floor row
// and opens the basket.
// Everything the sheet shows arrives on UI.BasketArena.State — the working setup, the saved
// ones and the item lists — so this file holds no catalogue of its own.
//
// Item fields are search boxes (the arena sheet's pattern): type to filter, pick from the list
// under the box. A setup is plain data mirroring FScpBasketArenaSetup; an empty id is sent as
// '' and comes back as 'None' (FName), so both spell "nothing" here.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const BAG_ROWS = 12;
  const FLOOR_ROWS = 6;
  const FURNITURE_SLOTS = ['Left', 'Middle', 'Right'];

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isNone = (v) => v == null || v === '' || v === 'None';

  /** A search box with a result list under it. Value lives on data-value; '' = none. */
  function combo(id, placeholder) {
    return `<div class="bb-combo" id="${esc(id)}" data-value="">` +
      `<input class="bb-input bb-combo-input" type="text" autocomplete="off" spellcheck="false"` +
      ` placeholder="${esc(placeholder || '(none) — type to search')}" data-tsic-focusable>` +
      `<button type="button" class="bb-combo-clear" title="Clear" tabindex="-1" data-no-sfx>×</button>` +
      `<ul class="bb-combo-list" role="listbox" hidden></ul></div>`;
  }

  const STYLE = `
    [data-screen="BasketArena"] #bb-root {
      position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      background: rgba(13, 14, 21, 0.72); pointer-events: auto; color: var(--cat-ink-dark);
    }
    [data-screen="BasketArena"] #bb-panel {
      width: min(1100px, 94vw); max-height: 92vh; display: flex; flex-direction: column; gap: 10px;
      background: rgba(252,249,241,0.96); border: 3px solid var(--ink-night, #14110c);
      box-shadow: 8px 8px 0 var(--ink-night, #14110c); padding: 14px 18px 16px;
    }
    [data-screen="BasketArena"] #bb-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    [data-screen="BasketArena"] #bb-header h2 { margin: 0; color: #1d4ed8; font-size: 28px; }
    [data-screen="BasketArena"] #bb-status { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.75; }
    [data-screen="BasketArena"] #bb-status.is-bad { color: #b91c1c; opacity: 1; }
    [data-screen="BasketArena"] .bb-spacer { flex: 1 1 auto; }
    [data-screen="BasketArena"] #bb-header .tsic-button { min-height: 0; padding: 6px 14px; font-size: 14px; border-width: 2px; }
    [data-screen="BasketArena"] #bb-apply { background: #1e3a8a; }

    [data-screen="BasketArena"] #bb-columns { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; min-height: 0; overflow: auto; }
    [data-screen="BasketArena"] .bb-section { border: 1px solid var(--tsic-border); padding: 9px 11px; background: rgba(255,253,247,0.8); }
    [data-screen="BasketArena"] .bb-section h3 { letter-spacing: 3px; color: rgba(59,47,28,0.7); font-size: 12px; margin: 0 0 8px; text-transform: uppercase; }
    [data-screen="BasketArena"] .bb-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
    [data-screen="BasketArena"] .bb-row label { font-size: 11px; color: rgba(59,47,28,0.7); min-width: 44px; }
    [data-screen="BasketArena"] .bb-input {
      background: var(--paper-bright, #fffdf3); color: var(--ink-night, #14110c); border: 1px solid var(--tsic-border);
      padding: 2px 6px; font-family: inherit; font-size: 12px; min-width: 0;
    }
    [data-screen="BasketArena"] .bb-input--count { width: 52px; flex: 0 0 auto; }
    [data-screen="BasketArena"] .bb-input--cell { width: 46px; flex: 0 0 auto; }
    [data-screen="BasketArena"] .bb-input--name { flex: 1 1 auto; max-width: 260px; }
    [data-screen="BasketArena"] .bb-meta { font-size: 11px; color: rgba(59,47,28,0.6); margin-top: 4px; }
    [data-screen="BasketArena"] .bb-check { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer; user-select: none; margin-right: 10px; }
    [data-screen="BasketArena"] .bb-check input { margin: 0; }
    [data-screen="BasketArena"] #bb-saved { display: flex; flex-wrap: wrap; gap: 6px; }
    [data-screen="BasketArena"] .bb-saved {
      display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--tsic-border);
      background: var(--paper-bright, #fffdf3); padding: 2px 4px 2px 8px; font-size: 12px;
    }
    [data-screen="BasketArena"] .bb-saved button {
      border: 1px solid var(--tsic-border); background: transparent; color: inherit; cursor: pointer;
      font-family: inherit; font-size: 11px; padding: 1px 6px;
    }
    [data-screen="BasketArena"] .bb-saved button:hover { background: var(--mag-yellow, #f5c518); }
    [data-screen="BasketArena"] .bb-saved button.is-armed { background: #b91c1c; color: #fff; }
    [data-screen="BasketArena"] .bb-section .tsic-button { min-height: 0; padding: 4px 10px; font-size: 13px; gap: 5px; border-width: 2px; }

    [data-screen="BasketArena"] .bb-combo { position: relative; flex: 1 1 auto; min-width: 0; display: flex; }
    [data-screen="BasketArena"] .bb-combo-input { flex: 1 1 auto; min-width: 0; padding-right: 22px; }
    [data-screen="BasketArena"] .bb-combo.has-value .bb-combo-input { font-weight: bold; }
    [data-screen="BasketArena"] .bb-combo-clear {
      position: absolute; right: 2px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px;
      border: 0; background: transparent; color: rgba(59,47,28,0.55); cursor: pointer; font-size: 13px; line-height: 1; padding: 0;
    }
    [data-screen="BasketArena"] .bb-combo-clear:hover { color: #b91c1c; }
    [data-screen="BasketArena"] .bb-combo:not(.has-value) .bb-combo-clear { display: none; }
    [data-screen="BasketArena"] .bb-combo-list {
      position: absolute; left: 0; right: 0; top: 100%; z-index: 20; margin: 0; padding: 0; list-style: none;
      max-height: 220px; overflow-y: auto; background: var(--paper-bright, #fffdf3);
      border: 1px solid var(--ink-night, #14110c); box-shadow: 4px 4px 0 var(--ink-night, #14110c);
    }
    [data-screen="BasketArena"] .bb-combo-list li { padding: 3px 8px; font-size: 12px; color: var(--ink-night, #14110c); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    [data-screen="BasketArena"] .bb-combo-list li.is-active, [data-screen="BasketArena"] .bb-combo-list li:hover { background: var(--mag-yellow, #f5c518); }
    [data-screen="BasketArena"] .bb-combo-list li.is-meta { color: rgba(59,47,28,0.6); cursor: default; font-style: italic; }
    [data-screen="BasketArena"] .bb-combo-list li.is-meta:hover { background: transparent; }
    [data-screen="BasketArena"] .bb-section, [data-screen="BasketArena"] #bb-columns { overflow: visible; }
  `;

  function bagRows() {
    let html = '';
    for (let i = 0; i < BAG_ROWS; i++) {
      html += `<div class="bb-row"><label for="bb-bag-${i}">Row ${i + 1}</label>` + combo(`bb-bag-${i}`, '(empty) — type an item') +
        `<input class="bb-input bb-input--count" id="bb-bagcount-${i}" type="number" min="1" max="999" value="1" title="Count">` +
        `<input class="bb-input bb-input--cell" id="bb-bagcell-${i}" type="number" min="0" max="63" placeholder="cell" title="Anchor cell, blank = wherever it lands"></div>`;
    }
    return html;
  }
  function floorRows() {
    let html = '';
    for (let i = 0; i < FLOOR_ROWS; i++) {
      html += `<div class="bb-row"><label for="bb-floor-${i}">Drop ${i + 1}</label>` + combo(`bb-floor-${i}`, '(none) — type an item') +
        `<input class="bb-input bb-input--count" id="bb-floorcount-${i}" type="number" min="1" max="999" value="1" title="Count"></div>`;
    }
    return html;
  }
  function furnitureRows() {
    return FURNITURE_SLOTS.map((label, i) =>
      `<div class="bb-row"><label for="bb-furn-${i}">${label}</label>` + combo(`bb-furn-${i}`, '(empty) — type a furniture piece') + '</div>').join('');
  }

  const TEMPLATE = `
    <div id="bb-root">
      <div id="bb-panel">
        <div id="bb-header">
          <h2 class="tsic-title">Basket Bench</h2>
          <span id="bb-status">Waiting for the bench…</span>
          <span class="bb-spacer"></span>
          <button class="tsic-button secondary" id="bb-close">Close</button>
          <button class="tsic-button" id="bb-apply" data-tsic-focusable data-tsic-initial-focus>Apply</button>
        </div>

        <div id="bb-columns">
          <div class="bb-section" data-tsic-focus-group="bag">
            <h3>Bag</h3>
            ${bagRows()}
            <div class="bb-meta">Granted in order into an emptied bag. A cell moves the stack there afterwards (row-major, 0 = top-left); an occupant swaps.</div>
          </div>
          <div>
            <div class="bb-section" data-tsic-focus-group="floor">
              <h3>Floor</h3>
              ${floorRows()}
              <div class="bb-meta">Dropped as physics items in a line in front of you, to pick up into the basket.</div>
            </div>
            <div class="bb-section" data-tsic-focus-group="furniture" style="margin-top: 10px">
              <h3>Furniture</h3>
              ${furnitureRows()}
              <div class="bb-meta">Spawned facing you on Apply, replacing the last ones. Drag them, open them, store things in them.</div>
            </div>
            <div class="bb-section" data-tsic-focus-group="options" style="margin-top: 10px">
              <h3>Bag size</h3>
              <div class="bb-row"><label for="bb-backpack">Backpack</label>${combo('bb-backpack', '(none) — base grid')}</div>
              <div class="bb-row">
                <label class="bb-check"><input type="checkbox" id="bb-openbasket" data-tsic-focusable checked> Open the basket after Apply</label>
              </div>
              <div class="bb-meta" id="bb-gridmeta"></div>
            </div>
          </div>
        </div>

        <div class="bb-section" id="bb-setups" data-tsic-focus-group="setups">
          <h3>Setups</h3>
          <div class="bb-row">
            <label for="bb-name">Name</label>
            <input class="bb-input bb-input--name" id="bb-name" placeholder="e.g. Full bag, bread on floor">
            <button class="tsic-button" id="bb-save">Save</button>
            <span class="bb-meta">Saved per machine. Load fills the sheet; it does not apply. F10 also sweeps the floor and puts you back on the mark.</span>
          </div>
          <div id="bb-saved"></div>
        </div>
      </div>
    </div>
  `;

  function injectStyleOnce() {
    if (document.getElementById('screen-basket-arena-style')) return;
    const s = document.createElement('style');
    s.id = 'screen-basket-arena-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  let requestState = null;
  let cancelOpenList = null;

  TSIC.registerScreen('BasketArena', {
    inputModeTag: 'InputMode.Menu.Generic',
    // Toggle, so Escape and F10 both close it to the game.
    cancelCmd: 'UI.Cmd.BasketArena.Toggle',
    actionBarContext: [
      { ActionName: 'IA_UI_CancelBack', Label: 'Close', KeyName: 'Escape', Priority: 1000 },
    ],
    opaque: true,
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();

      const state = { data: null };
      const $ = (id) => root.querySelector('#' + id);
      function formatEntry(it) {
        return it.DisplayName ? `${it.DisplayName} [${it.InternalName}]` : it.InternalName;
      }

      // -------- search boxes (the arena sheet's pattern) --------
      const MAX_RESULTS = 30;
      const combos = new Map();
      let openCombo = null;

      function comboValue(id) {
        const c = combos.get(id);
        return c ? c.value : '';
      }
      function setComboValue(id, value, allItems) {
        const c = combos.get(id);
        if (!c) return;
        const v = isNone(value) ? '' : String(value);
        c.value = v;
        c.root.setAttribute('data-value', v);
        c.root.classList.toggle('has-value', v !== '');
        if (v === '') { c.input.value = ''; return; }
        const item = c.items.find((it) => it.InternalName === v) || (allItems || []).find((it) => it.InternalName === v);
        c.input.value = item ? formatEntry(item) : v;
      }
      function setComboItems(id, items) {
        const c = combos.get(id);
        if (!c) return;
        c.items = items || [];
        if (c.value) setComboValue(id, c.value);
      }
      function matches(items, query) {
        const q = query.trim().toLowerCase();
        if (!q) return items.slice(0, MAX_RESULTS);
        const terms = q.split(/\s+/);
        const hit = (it) => {
          const hay = ((it.DisplayName || '') + ' ' + (it.InternalName || '')).toLowerCase();
          return terms.every((t) => hay.includes(t));
        };
        const starts = [];
        const rest = [];
        for (const it of items) {
          if (!hit(it)) continue;
          ((it.DisplayName || '').toLowerCase().startsWith(q) ? starts : rest).push(it);
        }
        return starts.concat(rest);
      }
      function closeCombo() {
        if (!openCombo) return;
        openCombo.list.hidden = true;
        openCombo.list.replaceChildren();
        openCombo.active = -1;
        openCombo = null;
      }
      function renderCombo(c) {
        const all = matches(c.items, c.input.value);
        const shown = all.slice(0, MAX_RESULTS);
        c.list.replaceChildren();
        c.active = -1;
        const none = TSIC.el('li', { class: 'is-meta', 'data-value': '' }, '(none)');
        none.addEventListener('mousedown', (ev) => { ev.preventDefault(); pickCombo(c, ''); });
        c.list.appendChild(none);
        for (const it of shown) {
          const li = TSIC.el('li', { 'data-value': it.InternalName, title: it.InternalName }, formatEntry(it));
          li.addEventListener('mousedown', (ev) => { ev.preventDefault(); pickCombo(c, it.InternalName); });
          c.list.appendChild(li);
        }
        if (all.length > shown.length) {
          c.list.appendChild(TSIC.el('li', { class: 'is-meta' }, `${all.length - shown.length} more — keep typing`));
        } else if (shown.length === 0) {
          c.list.appendChild(TSIC.el('li', { class: 'is-meta' }, 'no match'));
        }
        if (openCombo && openCombo !== c) closeCombo();
        c.list.hidden = false;
        openCombo = c;
      }
      function pickCombo(c, value) {
        setComboValue(c.id, value);
        closeCombo();
        c.input.blur();
      }
      function moveActive(c, delta) {
        const rows = [...c.list.querySelectorAll('li[data-value]')];
        if (rows.length === 0) return;
        rows.forEach((r) => r.classList.remove('is-active'));
        c.active = (c.active + delta + rows.length) % rows.length;
        rows[c.active].classList.add('is-active');
        rows[c.active].scrollIntoView({ block: 'nearest' });
      }
      function bindCombo(rootEl) {
        const c = {
          id: rootEl.id, root: rootEl, input: rootEl.querySelector('.bb-combo-input'),
          list: rootEl.querySelector('.bb-combo-list'), items: [], value: '', active: -1,
        };
        combos.set(c.id, c);
        c.input.addEventListener('focus', () => { c.input.select(); renderCombo(c); });
        c.input.addEventListener('input', () => renderCombo(c));
        c.input.addEventListener('blur', () => {
          if (openCombo === c) closeCombo();
          setComboValue(c.id, c.value);
        });
        c.input.addEventListener('keydown', (ev) => {
          if (ev.key === 'ArrowDown') { ev.preventDefault(); if (c.list.hidden) renderCombo(c); moveActive(c, 1); }
          else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveActive(c, -1); }
          else if (ev.key === 'Enter') {
            ev.preventDefault();
            const rows = [...c.list.querySelectorAll('li[data-value]')];
            const row = c.active >= 0 ? rows[c.active] : rows.find((r) => r.getAttribute('data-value') !== '');
            if (row) pickCombo(c, row.getAttribute('data-value'));
          }
          else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); c.input.blur(); }
        });
        rootEl.querySelector('.bb-combo-clear').addEventListener('click', () => setComboValue(c.id, ''));
      }
      root.querySelectorAll('.bb-combo').forEach(bindCombo);
      // Number boxes keep their arrow keys.
      root.querySelectorAll('input[type="number"]').forEach((el) => el.addEventListener('keydown', (ev) => ev.stopPropagation()));

      function fillPickers() {
        const d = state.data || {};
        for (let i = 0; i < BAG_ROWS; i++) setComboItems(`bb-bag-${i}`, d.Items);
        for (let i = 0; i < FLOOR_ROWS; i++) setComboItems(`bb-floor-${i}`, d.Items);
        for (let i = 0; i < FURNITURE_SLOTS.length; i++) setComboItems(`bb-furn-${i}`, d.Furniture);
        setComboItems('bb-backpack', d.Backpacks);
      }

      // -------- setup <-> controls --------
      function applySetup(setup) {
        const d = state.data || {};
        const s = setup || {};
        const bag = s.Bag || [];
        for (let i = 0; i < BAG_ROWS; i++) {
          const r = bag[i] || {};
          setComboValue(`bb-bag-${i}`, r.ItemId, d.Items);
          $(`bb-bagcount-${i}`).value = Math.max(1, parseInt(r.Count, 10) || 1);
          const cell = parseInt(r.Cell, 10);
          $(`bb-bagcell-${i}`).value = Number.isFinite(cell) && cell >= 0 ? cell : '';
        }
        const floor = s.Floor || [];
        for (let i = 0; i < FLOOR_ROWS; i++) {
          const r = floor[i] || {};
          setComboValue(`bb-floor-${i}`, r.ItemId, d.Items);
          $(`bb-floorcount-${i}`).value = Math.max(1, parseInt(r.Count, 10) || 1);
        }
        const furniture = s.Furniture || [];
        for (let i = 0; i < FURNITURE_SLOTS.length; i++) setComboValue(`bb-furn-${i}`, furniture[i], d.Furniture);
        setComboValue('bb-backpack', s.Backpack, d.Backpacks);
        $('bb-openbasket').checked = s.bOpenBasket !== false;
        $('bb-name').value = s.Name || '';
      }

      function readSetup() {
        const setup = {
          Name: $('bb-name').value.trim(), Bag: [], Floor: [], Backpack: comboValue('bb-backpack'), bOpenBasket: $('bb-openbasket').checked,
          Furniture: FURNITURE_SLOTS.map((_, i) => comboValue(`bb-furn-${i}`)),
        };
        for (let i = 0; i < BAG_ROWS; i++) {
          const cellText = $(`bb-bagcell-${i}`).value.trim();
          const cell = cellText === '' ? -1 : parseInt(cellText, 10);
          setup.Bag.push({ ItemId: comboValue(`bb-bag-${i}`), Count: Math.max(1, parseInt($(`bb-bagcount-${i}`).value, 10) || 1), Cell: Number.isFinite(cell) ? cell : -1 });
        }
        for (let i = 0; i < FLOOR_ROWS; i++) {
          setup.Floor.push({ ItemId: comboValue(`bb-floor-${i}`), Count: Math.max(1, parseInt($(`bb-floorcount-${i}`).value, 10) || 1), Cell: -1 });
        }
        return setup;
      }

      // -------- saved setups --------
      function renderSaved() {
        const host = $('bb-saved');
        const saved = (state.data && state.data.Saved) || [];
        host.replaceChildren();
        if (saved.length === 0) {
          host.appendChild(TSIC.el('span', { class: 'bb-meta' }, 'No saved setups yet.'));
          return;
        }
        for (const s of saved) {
          const load = TSIC.el('button', { type: 'button', title: 'Fill the sheet from this setup' }, 'Load');
          load.addEventListener('click', () => applySetup(s));
          const del = TSIC.el('button', { type: 'button', title: 'Delete — click twice' }, 'Delete');
          let timer = null;
          del.addEventListener('click', () => {
            if (del.classList.contains('is-armed')) {
              clearTimeout(timer);
              ctx.publish('UI.Cmd.BasketArena.Delete', { Name: s.Name });
              return;
            }
            del.classList.add('is-armed');
            del.textContent = 'Sure?';
            timer = setTimeout(() => { del.classList.remove('is-armed'); del.textContent = 'Delete'; }, 2000);
          });
          host.appendChild(TSIC.el('span', { class: 'bb-saved' }, TSIC.el('span', {}, s.Name), load, del));
        }
      }

      function renderStatus() {
        const d = state.data;
        const el = $('bb-status');
        const meta = $('bb-gridmeta');
        if (!d) { el.textContent = 'Waiting for the bench…'; el.classList.remove('is-bad'); meta.textContent = ''; return; }
        if (!d.bHasArena) {
          el.textContent = d.Message || 'Bench not ready';
          el.classList.add('is-bad');
          meta.textContent = '';
          return;
        }
        el.textContent = `${d.SlotCapacity} cells, ${d.GridWidth} wide`;
        el.classList.remove('is-bad');
        meta.textContent = `The bag has ${d.SlotCapacity} cells right now (${d.GridWidth} per row). A backpack adds its bonus slots when Apply wears it.`;
      }

      // -------- bind --------
      ctx.on('tsic.msg.UI.BasketArena.State', (p) => {
        state.data = p || null;
        fillPickers();
        applySetup(p && p.Current);
        renderSaved();
        renderStatus();
      });

      $('bb-apply').addEventListener('click', () => ctx.publish('UI.Cmd.BasketArena.Apply', { Setup: readSetup() }));
      $('bb-save').addEventListener('click', () => {
        const setup = readSetup();
        if (!setup.Name) { tsic.playSound('UI.Error', 0.4); $('bb-name').focus(); return; }
        ctx.publish('UI.Cmd.BasketArena.Save', { Setup: setup });
      });
      $('bb-close').addEventListener('click', () => ctx.publish('UI.Cmd.BasketArena.Toggle', {}));

      fillPickers();
      renderSaved();
      renderStatus();
      requestState = () => ctx.publish('UI.Cmd.BasketArena.RequestState', {});
      cancelOpenList = () => {
        if (!openCombo) return false;
        openCombo.input.blur();
        return true;
      };
    },

    // Back with a result list open closes the list, not the screen.
    onCancel() {
      return cancelOpenList ? cancelOpenList() : false;
    },

    onShow() {
      if (requestState) requestState();
    },
  });
})();
