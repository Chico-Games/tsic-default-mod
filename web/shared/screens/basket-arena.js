// Container arena screen module (spec 16.2) — the setup sheet for the 3D containers (F10 in
// L_Dev_ContainerLab, the worldgen-on blank floor whose bays the scenario setups use).
//
// C++ owns the loop: UI.Cmd.BasketArena.Toggle sweeps the floor and opens this screen; Apply
// sends the whole setup back on UI.Cmd.BasketArena.Apply and C++ closes the screen, empties the
// bag, wears the backpack, replaces the furniture slots (contents, parts, station state), grants
// each bag row, drops each floor row, sets the clock and opens the basket. The scenario and world
// buttons go out on UI.Cmd.BasketArena.Action.
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
  const STATION_STATES = ['idle', 'working', 'done'];

  // "tray: ID_Potato_CN x2, ID_CookingOil_CN" per line -> [{Compartment, ItemId, Count}]
  function parseContents(text) {
    const rows = [];
    for (const line of String(text || '').split(/\n/)) {
      const at = line.indexOf(':');
      if (at < 0) continue;
      const compartment = line.slice(0, at).trim();
      for (const part of line.slice(at + 1).split(',')) {
        const m = part.trim().match(/^(\S+)(?:\s*x\s*(\d+))?$/i);
        if (compartment && m) rows.push({ Compartment: compartment, ItemId: m[1], Count: Math.max(1, parseInt(m[2], 10) || 1) });
      }
    }
    return rows;
  }
  function formatContents(rows) {
    const by = new Map();
    for (const r of rows || []) {
      if (isNone(r.ItemId)) continue;
      const list = by.get(r.Compartment) || [];
      list.push(r.Count > 1 ? `${r.ItemId} x${r.Count}` : r.ItemId);
      by.set(r.Compartment, list);
    }
    return [...by].map(([c, list]) => `${c}: ${list.join(', ')}`).join('\n');
  }
  // "OvenDoor=1, Drawer1=0.5" -> [{Part, Open}]
  function parseParts(text) {
    return String(text || '').split(',').map((p) => p.trim().match(/^(\S+)\s*=\s*([\d.]+)$/)).filter(Boolean)
      .map((m) => ({ Part: m[1], Open: Math.min(1, Math.max(0, parseFloat(m[2]) || 0)) }));
  }
  function formatParts(rows) {
    return (rows || []).filter((r) => !isNone(r.Part)).map((r) => `${r.Part}=${r.Open}`).join(', ');
  }

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
    [data-screen="BasketArena"] .bb-input--comp { width: 96px; flex: 0 0 auto; }
    [data-screen="BasketArena"] .bb-input--wide { flex: 1 1 auto; min-width: 0; resize: vertical; }
    [data-screen="BasketArena"] .bb-furn { border-top: 1px dashed var(--tsic-border); padding-top: 6px; margin-top: 6px; }
    [data-screen="BasketArena"] .bb-furn:first-of-type { border-top: 0; padding-top: 0; margin-top: 0; }
    [data-screen="BasketArena"] #bb-scenario { flex: 1 1 auto; min-width: 0; }
    [data-screen="BasketArena"] #bb-runstatus.is-bad { color: #b91c1c; }
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
        `<input class="bb-input bb-input--cell" id="bb-bagcell-${i}" type="number" min="0" max="63" placeholder="cell" title="Anchor cell, blank = wherever it lands">` +
        `<input class="bb-input bb-input--comp" id="bb-bagcomp-${i}" type="text" placeholder="compartment" title="Player compartment (basket.grid, coldbag, hook.1, worn.head...); blank = routed like a pickup"></div>`;
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
      `<div class="bb-furn"><div class="bb-row"><label for="bb-furn-${i}">${label}</label>` + combo(`bb-furn-${i}`, '(empty) — type a furniture piece') + '</div>' +
      `<div class="bb-row"><label for="bb-furnbay-${i}">At</label><select class="bb-input" id="bb-furnbay-${i}" title="A lab bay, as the scenario setups place furniture; blank = its slot in front of you"><option value="">(${label.toLowerCase()} slot)</option></select></div>` +
      `<div class="bb-row"><label for="bb-furnparts-${i}">Parts</label><input class="bb-input bb-input--wide" id="bb-furnparts-${i}" type="text" placeholder="OvenDoor=1, Drawer1=0.5"></div>` +
      `<div class="bb-row"><label for="bb-furncont-${i}">Holds</label><textarea class="bb-input bb-input--wide" id="bb-furncont-${i}" rows="2" placeholder="tray: ID_Potato_CN x2, ID_CookingOil_CN"></textarea></div>` +
      `<div class="bb-row"><label for="bb-furnstate-${i}">Station</label><select class="bb-input" id="bb-furnstate-${i}">` +
      STATION_STATES.map((s) => `<option value="${s}">${s}</option>`).join('') + '</select>' +
      `<input class="bb-input bb-input--count" id="bb-furnprog-${i}" type="number" min="0" max="100" value="0" title="Working: % already done">%` +
      `<input class="bb-input bb-input--count" id="bb-furnburn-${i}" type="number" min="0" value="0" title="Done: seconds already on the burn clock">s burn</div></div>`).join('');
  }

  const TEMPLATE = `
    <div id="bb-root">
      <div id="bb-panel">
        <div id="bb-header">
          <h2 class="tsic-title">Container Arena</h2>
          <span id="bb-status">Waiting for the arena…</span>
          <span class="bb-spacer"></span>
          <button class="tsic-button secondary" id="bb-close">Close</button>
          <button class="tsic-button" id="bb-apply" data-tsic-focusable data-tsic-initial-focus>Apply</button>
        </div>

        <div id="bb-columns">
          <div class="bb-section" data-tsic-focus-group="bag">
            <h3>Bag</h3>
            ${bagRows()}
            <div class="bb-meta">Granted in order into an emptied bag. A compartment and cell put the stack there afterwards (row-major, 0 = top-left); an occupant swaps. Blank = routed like a pickup.</div>
            <div class="bb-row" style="margin-top: 8px"><label for="bb-capacity">Carry</label>
              <input class="bb-input bb-input--count" id="bb-capacity" type="number" min="0" value="0" title="Carry capacity; 0 = the default"><span class="bb-meta">capacity (0 = default)</span></div>
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
              <div class="bb-meta">Spawned facing you on Apply, replacing the last ones. Holds: one compartment per line. A working or done station locks in whatever its input makes.</div>
            </div>
            <div class="bb-section" data-tsic-focus-group="world" style="margin-top: 10px">
              <h3>World</h3>
              <div class="bb-row"><label for="bb-timeofday">Clock</label>
                <input class="bb-input bb-input--count" id="bb-timeofday" type="number" min="-1" value="-1" title="Seconds into the day cycle; -1 leaves the clock alone">
                <label for="bb-timescale">Speed</label>
                <input class="bb-input bb-input--count" id="bb-timescale" type="number" min="0.1" step="0.1" value="1" title="Time scale, 1 = normal"></div>
              <div class="bb-row">
                <button class="tsic-button" data-action="AdvanceTime" data-arg="300">+5 min</button>
                <button class="tsic-button" data-action="AdvanceTime" data-arg="3600">+1 h</button>
                <button class="tsic-button" data-action="SaveLoad">Save + load</button>
                <button class="tsic-button" data-action="WalkAway">Walk away &amp; back</button>
                <button class="tsic-button" data-action="ClearFloor">Clear floor</button>
              </div>
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

        <div class="bb-section" id="bb-scenarios" data-tsic-focus-group="scenarios">
          <h3>Scenarios</h3>
          <div class="bb-row">
            <label for="bb-scenario">Preset</label>
            <select class="bb-input" id="bb-scenario"></select>
            <button class="tsic-button" data-scenario="Preset" title="Set up the scenario, then play it by hand">Open preset</button>
            <button class="tsic-button" data-scenario="Run" title="Run every step">Run &#9654;</button>
            <button class="tsic-button" data-scenario="Step" title="Run one step each time Next step is pressed">Step mode</button>
            <button class="tsic-button" data-action="NextStep">Next step</button>
            <button class="tsic-button" data-action="Resume">Resume</button>
            <button class="tsic-button secondary" data-action="Stop">Stop</button>
          </div>
          <div class="bb-meta" id="bb-runstatus"></div>
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
          // SearchAlias carries what the item is called elsewhere (its mesh, usually), so
          // typing "scrap fabric" finds the one the game lists as Upholstery Fabric.
          const hay = ((it.DisplayName || '') + ' ' + (it.InternalName || '') + ' ' + (it.SearchAlias || '')).toLowerCase();
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

      function fillBays() {
        const d = state.data || {};
        for (let i = 0; i < FURNITURE_SLOTS.length; i++) {
          const select = $(`bb-furnbay-${i}`);
          const keep = select.getAttribute('data-value') || select.value;
          const first = select.options[0];
          select.replaceChildren(first, ...(d.Bays || []).map((b) => TSIC.el('option', { value: b }, b)));
          select.value = (d.Bays || []).includes(keep) ? keep : '';
        }
      }

      function fillPickers() {
        const d = state.data || {};
        fillBays();
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
          $(`bb-bagcomp-${i}`).value = isNone(r.Compartment) ? '' : r.Compartment;
        }
        const floor = s.Floor || [];
        for (let i = 0; i < FLOOR_ROWS; i++) {
          const r = floor[i] || {};
          setComboValue(`bb-floor-${i}`, r.ItemId, d.Items);
          $(`bb-floorcount-${i}`).value = Math.max(1, parseInt(r.Count, 10) || 1);
        }
        const furniture = s.Furniture || [];
        for (let i = 0; i < FURNITURE_SLOTS.length; i++) {
          const f = furniture[i] || {};
          setComboValue(`bb-furn-${i}`, f.Definition, d.Furniture);
          const bay = isNone(f.Bay) ? '' : f.Bay;
          $(`bb-furnbay-${i}`).setAttribute('data-value', bay);
          $(`bb-furnbay-${i}`).value = (d.Bays || []).includes(bay) ? bay : '';
          $(`bb-furnparts-${i}`).value = formatParts(f.Parts);
          $(`bb-furncont-${i}`).value = formatContents(f.Contents);
          $(`bb-furnstate-${i}`).value = STATION_STATES.includes(f.StationState) ? f.StationState : 'idle';
          $(`bb-furnprog-${i}`).value = Math.round((parseFloat(f.StationProgress) || 0) * 100);
          $(`bb-furnburn-${i}`).value = parseFloat(f.BurnSeconds) || 0;
        }
        $('bb-capacity').value = parseFloat(s.WeightCapacity) || 0;
        $('bb-timeofday').value = s.TimeOfDay == null ? -1 : s.TimeOfDay;
        $('bb-timescale').value = parseFloat(s.TimeScale) > 0 ? s.TimeScale : 1;
        setComboValue('bb-backpack', s.Backpack, d.Backpacks);
        $('bb-openbasket').checked = s.bOpenBasket !== false;
        $('bb-name').value = s.Name || '';
      }

      function readSetup() {
        const setup = {
          Name: $('bb-name').value.trim(), Bag: [], Floor: [], Backpack: comboValue('bb-backpack'), bOpenBasket: $('bb-openbasket').checked,
          Furniture: FURNITURE_SLOTS.map((_, i) => ({
            Definition: comboValue(`bb-furn-${i}`),
            Bay: $(`bb-furnbay-${i}`).value,
            Parts: parseParts($(`bb-furnparts-${i}`).value),
            Contents: parseContents($(`bb-furncont-${i}`).value),
            StationState: $(`bb-furnstate-${i}`).value,
            StationProgress: Math.min(100, Math.max(0, parseFloat($(`bb-furnprog-${i}`).value) || 0)) / 100,
            BurnSeconds: Math.max(0, parseFloat($(`bb-furnburn-${i}`).value) || 0),
          })),
          WeightCapacity: Math.max(0, parseFloat($('bb-capacity').value) || 0),
          TimeOfDay: parseFloat($('bb-timeofday').value),
          TimeScale: parseFloat($('bb-timescale').value) > 0 ? parseFloat($('bb-timescale').value) : 1,
        };
        if (!Number.isFinite(setup.TimeOfDay)) setup.TimeOfDay = -1;
        for (let i = 0; i < BAG_ROWS; i++) {
          const cellText = $(`bb-bagcell-${i}`).value.trim();
          const cell = cellText === '' ? -1 : parseInt(cellText, 10);
          setup.Bag.push({ ItemId: comboValue(`bb-bag-${i}`), Count: Math.max(1, parseInt($(`bb-bagcount-${i}`).value, 10) || 1), Cell: Number.isFinite(cell) ? cell : -1,
            Compartment: $(`bb-bagcomp-${i}`).value.trim() });
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

      function renderScenarios() {
        const d = state.data || {};
        const select = $('bb-scenario');
        const keep = select.value;
        select.replaceChildren(...(d.Scenarios || []).map((name) => TSIC.el('option', { value: name }, name)));
        if ((d.Scenarios || []).includes(keep)) select.value = keep;
        const run = $('bb-runstatus');
        run.classList.remove('is-bad');
        if (d.Scenario) {
          const step = d.StepIndex >= 0 ? `step ${d.StepIndex + 1} of ${d.StepCount}${d.StepLabel ? ': ' + d.StepLabel : ''}` : 'setting up';
          run.textContent = `${d.Scenario} — ${step}${d.bScenarioPaused ? ' (waiting for Next step)' : ''}`;
        } else if (d.LastResult) {
          run.textContent = `Last run: ${d.LastResult}`;
          run.classList.toggle('is-bad', d.LastResult.indexOf(': failed') >= 0);
        } else {
          run.textContent = 'Open preset sets a scenario up to play by hand; F10 comes back here mid-run.';
        }
        root.querySelectorAll('[data-scenario]').forEach((b) => { b.disabled = !d.bHasArena || !!d.Scenario; });
      }

      function renderStatus() {
        const d = state.data;
        const el = $('bb-status');
        const meta = $('bb-gridmeta');
        $('bb-apply').disabled = !(d && d.bHasArena);
        if (!d) { el.textContent = 'Waiting for the arena…'; el.classList.remove('is-bad'); meta.textContent = ''; return; }
        if (!d.bHasArena) {
          el.textContent = d.Message || 'Arena not ready';
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
        renderScenarios();
      });

      root.querySelectorAll('[data-scenario]').forEach((b) => b.addEventListener('click', () => {
        const name = $('bb-scenario').value;
        if (!name) { tsic.playSound('UI.Error', 0.4); return; }
        ctx.publish('UI.Cmd.BasketArena.Action', { Action: b.getAttribute('data-scenario'), Arg: name });
      }));
      root.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => {
        const action = b.getAttribute('data-action');
        const arg = action === 'TimeScale' ? $('bb-timescale').value : (b.getAttribute('data-arg') || '');
        ctx.publish('UI.Cmd.BasketArena.Action', { Action: action, Arg: arg });
      }));

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
      renderScenarios();
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
