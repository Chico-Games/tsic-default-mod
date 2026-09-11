// Arena screen module — the test-arena setup sheet (F9 in L_Arena).
//
// C++ owns the loop: UI.Cmd.Arena.Toggle clears the live enemies and opens this
// screen; Fight sends the whole setup back on UI.Cmd.Arena.Fight and C++ closes the
// screen, resets the player and spawns. Everything the sheet shows arrives on
// UI.Arena.State — the working setup, the saved ones and the pick lists — so this
// file holds no catalogue of its own.
//
// Enemy, gear and hotbar fields are search boxes: type to filter, pick from the list
// under the box. The tier pickers are tsic-dropdown triggers (never a native <select>,
// see cheat-menu.js). Nothing here renders hundreds of rows at once.
// A setup is plain data mirroring FScpArenaSetup; an empty id is sent as '' and comes
// back as 'None' (FName), so both spell "nothing" here.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const MAX_ENEMIES = 3;
  const HOTBAR_CELLS = 8;
  const TIERS = [
    { value: 'Base', label: 'Base' }, { value: 'Easy', label: 'Easy' },
    { value: 'Medium', label: 'Medium' }, { value: 'Hard', label: 'Hard' },
  ];
  const GEAR_SLOTS = [
    { key: 'Head', label: 'Head' }, { key: 'Body', label: 'Body' }, { key: 'Legs', label: 'Legs' },
    { key: 'Shoes', label: 'Shoes' }, { key: 'Gloves', label: 'Gloves' }, { key: 'Backpack', label: 'Backpack' },
  ];
  const NONE_OPT = { value: '', label: '(none)' };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const isNone = (v) => v == null || v === '' || v === 'None';

  /** A search box with a result list under it. Value lives on data-value; '' = none. */
  function combo(id, placeholder) {
    return `<div class="ar-combo" id="${esc(id)}" data-value="">` +
      `<input class="ar-input ar-combo-input" type="text" autocomplete="off" spellcheck="false"` +
      ` placeholder="${esc(placeholder || '(none) — type to search')}" data-tsic-focusable>` +
      `<button type="button" class="ar-combo-clear" title="Clear" tabindex="-1" data-no-sfx>×</button>` +
      `<ul class="ar-combo-list" role="listbox" hidden></ul></div>`;
  }

  function picker(id, opts, extraClass) {
    const first = opts[0] || NONE_OPT;
    return `<button type="button" class="tsic-dropdown ar-select${extraClass ? ' ' + extraClass : ''}" id="${esc(id)}" data-tsic-focusable` +
      ` data-tsic-options="${esc(JSON.stringify(opts))}" data-tsic-value="${esc(first.value)}">` +
      `<span class="tsic-dropdown-label">${esc(first.label)}</span><span class="tsic-dropdown-caret">▾</span></button>`;
  }

  const STYLE = `
    [data-screen="Arena"] #ar-root {
      position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
      background: rgba(13, 14, 21, 0.72); pointer-events: auto; color: var(--cat-ink-dark);
    }
    [data-screen="Arena"] #ar-panel {
      width: min(1180px, 94vw); max-height: 92vh; display: flex; flex-direction: column; gap: 10px;
      background: rgba(252,249,241,0.96); border: 3px solid var(--ink-night, #14110c);
      box-shadow: 8px 8px 0 var(--ink-night, #14110c); padding: 14px 18px 16px;
    }
    [data-screen="Arena"] #ar-header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    [data-screen="Arena"] #ar-header h2 { margin: 0; color: #c2410c; font-size: 28px; }
    [data-screen="Arena"] #ar-status { font-size: 12px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.75; }
    [data-screen="Arena"] #ar-status.is-bad { color: #b91c1c; opacity: 1; }
    [data-screen="Arena"] .ar-spacer { flex: 1 1 auto; }
    [data-screen="Arena"] #ar-header .tsic-button { min-height: 0; padding: 6px 14px; font-size: 14px; border-width: 2px; }
    [data-screen="Arena"] #ar-fight { background: #7c2d12; }

    [data-screen="Arena"] #ar-columns { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 12px; min-height: 0; overflow: auto; }
    [data-screen="Arena"] .ar-section { border: 1px solid var(--tsic-border); padding: 9px 11px; background: rgba(255,253,247,0.8); }
    [data-screen="Arena"] .ar-section h3 { letter-spacing: 3px; color: rgba(59,47,28,0.7); font-size: 12px; margin: 0 0 8px; text-transform: uppercase; }
    [data-screen="Arena"] .ar-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
    [data-screen="Arena"] .ar-row label { font-size: 11px; color: rgba(59,47,28,0.7); min-width: 58px; }
    [data-screen="Arena"] .ar-select {
      background: var(--paper-bright, #fffdf3); color: var(--ink-night, #14110c); border: 1px solid var(--tsic-border);
      padding: 2px 6px; flex: 1 1 auto; min-width: 0; font-family: inherit; font-size: 12px; letter-spacing: normal;
      text-transform: none; text-align: left; gap: 4px;
    }
    [data-screen="Arena"] .ar-select.ar-select--sm { flex: 0 0 96px; }
    [data-screen="Arena"] .ar-select .tsic-dropdown-caret { font-size: 9px; }
    [data-screen="Arena"] .ar-input {
      background: var(--paper-bright, #fffdf3); color: var(--ink-night, #14110c); border: 1px solid var(--tsic-border);
      padding: 2px 6px; font-family: inherit; font-size: 12px; min-width: 0;
    }
    [data-screen="Arena"] .ar-input--count { width: 52px; flex: 0 0 auto; }
    [data-screen="Arena"] .ar-input--filter { flex: 1 1 auto; }
    [data-screen="Arena"] .ar-input--name { flex: 1 1 auto; max-width: 260px; }
    [data-screen="Arena"] .ar-meta { font-size: 11px; color: rgba(59,47,28,0.6); margin-top: 4px; }

    [data-screen="Arena"] #ar-setups { display: flex; flex-direction: column; gap: 6px; }
    [data-screen="Arena"] .ar-check { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer; user-select: none; margin-right: 10px; }
    [data-screen="Arena"] .ar-check input { margin: 0; }
    [data-screen="Arena"] #ar-saved { display: flex; flex-wrap: wrap; gap: 6px; }
    [data-screen="Arena"] .ar-saved {
      display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--tsic-border);
      background: var(--paper-bright, #fffdf3); padding: 2px 4px 2px 8px; font-size: 12px;
    }
    [data-screen="Arena"] .ar-saved button {
      border: 1px solid var(--tsic-border); background: transparent; color: inherit; cursor: pointer;
      font-family: inherit; font-size: 11px; padding: 1px 6px;
    }
    [data-screen="Arena"] .ar-saved button:hover { background: var(--mag-yellow, #f5c518); }
    [data-screen="Arena"] .ar-saved button.is-armed { background: #b91c1c; color: #fff; }
    [data-screen="Arena"] .ar-section .tsic-button { min-height: 0; padding: 4px 10px; font-size: 13px; gap: 5px; border-width: 2px; }

    /* Search boxes. The list is absolutely positioned under its box and only ever holds
       the matches for what was typed (capped), so no field renders the whole catalogue. */
    [data-screen="Arena"] .ar-combo { position: relative; flex: 1 1 auto; min-width: 0; display: flex; }
    [data-screen="Arena"] .ar-combo-input { flex: 1 1 auto; min-width: 0; padding-right: 22px; }
    [data-screen="Arena"] .ar-combo.has-value .ar-combo-input { font-weight: bold; }
    [data-screen="Arena"] .ar-combo-clear {
      position: absolute; right: 2px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px;
      border: 0; background: transparent; color: rgba(59,47,28,0.55); cursor: pointer; font-size: 13px; line-height: 1; padding: 0;
    }
    [data-screen="Arena"] .ar-combo-clear:hover { color: #b91c1c; }
    [data-screen="Arena"] .ar-combo:not(.has-value) .ar-combo-clear { display: none; }
    [data-screen="Arena"] .ar-combo-list {
      position: absolute; left: 0; right: 0; top: 100%; z-index: 20; margin: 0; padding: 0; list-style: none;
      max-height: 220px; overflow-y: auto; background: var(--paper-bright, #fffdf3);
      border: 1px solid var(--ink-night, #14110c); box-shadow: 4px 4px 0 var(--ink-night, #14110c);
    }
    [data-screen="Arena"] .ar-combo-list li { padding: 3px 8px; font-size: 12px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    [data-screen="Arena"] .ar-combo-list li.is-active, [data-screen="Arena"] .ar-combo-list li:hover { background: var(--mag-yellow, #f5c518); }
    [data-screen="Arena"] .ar-combo-list li.is-meta { color: rgba(59,47,28,0.6); cursor: default; font-style: italic; }
    [data-screen="Arena"] .ar-combo-list li.is-meta:hover { background: transparent; }
    /* The list must be able to hang below its section. */
    [data-screen="Arena"] .ar-section, [data-screen="Arena"] #ar-columns { overflow: visible; }
  `;

  function enemyRows() {
    let html = '';
    for (let i = 0; i < MAX_ENEMIES; i++) {
      html += `<div class="ar-row"><label for="ar-enemy-${i}">Point ${i + 1}</label>` +
        combo(`ar-enemy-${i}`, '(none) — type an enemy') + picker(`ar-tier-${i}`, TIERS, 'ar-select--sm') + '</div>';
    }
    return html;
  }
  function gearRows() {
    return GEAR_SLOTS.map((g) =>
      `<div class="ar-row"><label for="ar-gear-${g.key}">${esc(g.label)}</label>${combo('ar-gear-' + g.key)}</div>`
    ).join('');
  }
  function hotbarRows() {
    let html = '';
    for (let i = 0; i < HOTBAR_CELLS; i++) {
      html += `<div class="ar-row"><label for="ar-hot-${i}">Cell ${i + 1}</label>` + combo(`ar-hot-${i}`, '(empty) — type an item') +
        `<input class="ar-input ar-input--count" id="ar-count-${i}" type="number" min="1" max="999" value="1" title="Count"></div>`;
    }
    return html;
  }

  const TEMPLATE = `
    <div id="ar-root">
      <div id="ar-panel">
        <div id="ar-header">
          <h2 class="tsic-title">Test Arena</h2>
          <span id="ar-status">Waiting for the arena…</span>
          <span class="ar-spacer"></span>
          <button class="tsic-button secondary" id="ar-close">Close</button>
          <button class="tsic-button" id="ar-fight" data-tsic-focusable data-tsic-initial-focus>Fight</button>
        </div>

        <div id="ar-columns">
          <div class="ar-section" data-tsic-focus-group="enemies">
            <h3>Enemies</h3>
            ${enemyRows()}
            <div class="ar-meta">One enemy per spawn point. Move the points in the level to change where they stand.</div>
          </div>
          <div class="ar-section" data-tsic-focus-group="gear">
            <h3>Equipment</h3>
            ${gearRows()}
            <div class="ar-meta">Weapons are hotbar items — put them in a cell.</div>
          </div>
          <div class="ar-section" data-tsic-focus-group="hotbar">
            <h3>Hotbar</h3>
            ${hotbarRows()}
            <div class="ar-meta">Type to search; Cell 1 is drawn when the fight starts.</div>
          </div>
        </div>

        <div class="ar-section" id="ar-cheats" data-tsic-focus-group="cheats">
          <h3>Player</h3>
          <div class="ar-row">
            <label class="ar-check"><input type="checkbox" id="ar-nodamage" data-tsic-focusable> No damage</label>
            <label class="ar-check"><input type="checkbox" id="ar-stamina" data-tsic-focusable> Infinite stamina</label>
            <span class="ar-meta">Saved with the setup. F9 also puts you back on the start mark, heals you and clears projectiles. F7 and F8 switch the clock to day and night.</span>
          </div>
        </div>

        <div class="ar-section" id="ar-debug" data-tsic-focus-group="debug">
          <h3>AI debug</h3>
          <div class="ar-row">
            <label class="ar-check"><input type="checkbox" id="ar-nameplates" data-tsic-focusable> AI state nameplates</label>
            <label class="ar-check"><input type="checkbox" id="ar-healthbars" data-tsic-focusable> Enemy health bars</label>
            <label class="ar-check"><input type="checkbox" id="ar-hitboxes" data-tsic-focusable> Attack hitboxes</label>
            <label class="ar-check"><input type="checkbox" id="ar-record" data-tsic-focusable> Record fight</label>
            <span class="ar-meta">Saved with the setup and applied when the fight starts. A recording opens its replay on the next fight or the F9 reset.</span>
          </div>
        </div>

        <div class="ar-section" id="ar-setups" data-tsic-focus-group="setups">
          <h3>Setups</h3>
          <div class="ar-row">
            <label for="ar-name">Name</label>
            <input class="ar-input ar-input--name" id="ar-name" placeholder="e.g. Two staff, crowbar">
            <button class="tsic-button" id="ar-save">Save</button>
            <span class="ar-meta">Saved per machine. Load fills the sheet; it does not start the fight.</span>
          </div>
          <div id="ar-saved"></div>
        </div>
      </div>
    </div>
  `;

  function injectStyleOnce() {
    if (document.getElementById('screen-arena-style')) return;
    const s = document.createElement('style');
    s.id = 'screen-arena-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  let requestState = null;
  let cancelOpenList = null;

  TSIC.registerScreen('Arena', {
    inputModeTag: 'InputMode.Menu.Generic',
    // Toggle, so Escape and F9 both close it to the game.
    cancelCmd: 'UI.Cmd.Arena.Toggle',
    actionBarContext: [
      { ActionName: 'IA_UI_CancelBack', Label: 'Close', KeyName: 'Escape', Priority: 1000 },
    ],
    opaque: true,
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();

      const state = { data: null };
      const $ = (id) => root.querySelector('#' + id);
      const dd = () => (window.tsic && window.tsic.dropdown) || null;

      function pickerValue(id) {
        const el = $(id);
        if (!el) return '';
        const api = dd();
        const v = api ? api.get(el) : el.getAttribute('data-tsic-value');
        return isNone(v) ? '' : String(v);
      }
      function setPickerQuiet(el, value, label) {
        el.setAttribute('data-tsic-value', String(value));
        const lbl = el.querySelector('.tsic-dropdown-label') || el;
        lbl.textContent = String(label);
      }
      function formatEntry(it) {
        return it.DisplayName ? `${it.DisplayName} [${it.InternalName}]` : it.InternalName;
      }

      // -------- search boxes --------
      // Each box owns its own source list (set from UI.Arena.State) and filters it on
      // every keystroke. The list shows at most MAX_RESULTS rows plus a "N more" line.
      const MAX_RESULTS = 30;
      const combos = new Map(); // id -> { root, input, list, items, value, active }
      let openCombo = null;

      function comboItems(id) {
        const c = combos.get(id);
        return c ? c.items : [];
      }
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
        // Re-label a pick the new list can name; keep the raw id when it cannot.
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
        // Display-name prefix matches first, then anything else that matches.
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
          id: rootEl.id, root: rootEl, input: rootEl.querySelector('.ar-combo-input'),
          list: rootEl.querySelector('.ar-combo-list'), items: [], value: '', active: -1,
        };
        combos.set(c.id, c);
        c.input.addEventListener('focus', () => { c.input.select(); renderCombo(c); });
        c.input.addEventListener('input', () => renderCombo(c));
        c.input.addEventListener('blur', () => {
          // A pick arrives on mousedown (before blur), so anything else is a cancel:
          // put the current value's label back rather than leaving a half-typed query.
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
        rootEl.querySelector('.ar-combo-clear').addEventListener('click', () => setComboValue(c.id, ''));
      }
      root.querySelectorAll('.ar-combo').forEach(bindCombo);

      // -------- catalogue -> search boxes --------
      function fillPickers() {
        const d = state.data || {};
        for (let i = 0; i < MAX_ENEMIES; i++) setComboItems(`ar-enemy-${i}`, d.Enemies);
        for (const g of GEAR_SLOTS) setComboItems('ar-gear-' + g.key, d[g.key]);
        for (let i = 0; i < HOTBAR_CELLS; i++) setComboItems(`ar-hot-${i}`, d.Items);
      }

      // -------- setup <-> controls --------
      function applySetup(setup) {
        const d = state.data || {};
        const s = setup || {};
        const enemies = s.Enemies || [];
        for (let i = 0; i < MAX_ENEMIES; i++) {
          const e = enemies[i] || {};
          setComboValue(`ar-enemy-${i}`, e.EnemyId, d.Enemies);
          const tier = TIERS.find((t) => t.value === e.VariantTier) || TIERS[0];
          setPickerQuiet($(`ar-tier-${i}`), tier.value, tier.label);
        }
        // Equipment is a flat id list; each id lands in the slot whose list carries it.
        const gear = (s.Equipment || []).filter((id) => !isNone(id));
        for (const g of GEAR_SLOTS) {
          const list = d[g.key] || [];
          const hit = gear.find((id) => list.some((it) => it.InternalName === id));
          setComboValue('ar-gear-' + g.key, hit || '', list);
        }
        const hot = s.Hotbar || [];
        for (let i = 0; i < HOTBAR_CELLS; i++) {
          const h = hot[i] || {};
          setComboValue(`ar-hot-${i}`, h.ItemId, d.Items);
          $(`ar-count-${i}`).value = Math.max(1, parseInt(h.Count, 10) || 1);
        }
        $('ar-name').value = s.Name || '';
        $('ar-nodamage').checked = !!s.bNoDamage;
        $('ar-stamina').checked = !!s.bInfiniteStamina;
        $('ar-nameplates').checked = !!s.bAiNameplates;
        $('ar-healthbars').checked = !!s.bEnemyHealthBars;
        $('ar-hitboxes').checked = !!s.bAttackHitboxes;
        $('ar-record').checked = !!s.bRecordFight;
      }

      function readSetup() {
        const setup = {
          Name: $('ar-name').value.trim(), Enemies: [], Equipment: [], Hotbar: [],
          bNoDamage: $('ar-nodamage').checked, bInfiniteStamina: $('ar-stamina').checked,
          bAiNameplates: $('ar-nameplates').checked, bEnemyHealthBars: $('ar-healthbars').checked,
          bAttackHitboxes: $('ar-hitboxes').checked, bRecordFight: $('ar-record').checked,
        };
        for (let i = 0; i < MAX_ENEMIES; i++) {
          setup.Enemies.push({ EnemyId: comboValue(`ar-enemy-${i}`), VariantTier: pickerValue(`ar-tier-${i}`) || 'Base' });
        }
        for (const g of GEAR_SLOTS) {
          const id = comboValue('ar-gear-' + g.key);
          if (id) setup.Equipment.push(id);
        }
        for (let i = 0; i < HOTBAR_CELLS; i++) {
          setup.Hotbar.push({ ItemId: comboValue(`ar-hot-${i}`), Count: Math.max(1, parseInt($(`ar-count-${i}`).value, 10) || 1) });
        }
        return setup;
      }

      // -------- saved setups --------
      function renderSaved() {
        const host = $('ar-saved');
        const saved = (state.data && state.data.Saved) || [];
        host.replaceChildren();
        if (saved.length === 0) {
          host.appendChild(TSIC.el('span', { class: 'ar-meta' }, 'No saved setups yet.'));
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
              ctx.publish('UI.Cmd.Arena.Delete', { Name: s.Name });
              return;
            }
            del.classList.add('is-armed');
            del.textContent = 'Sure?';
            timer = setTimeout(() => { del.classList.remove('is-armed'); del.textContent = 'Delete'; }, 2000);
          });
          host.appendChild(TSIC.el('span', { class: 'ar-saved' }, TSIC.el('span', {}, s.Name), load, del));
        }
      }

      function renderStatus() {
        const d = state.data;
        const el = $('ar-status');
        if (!d) { el.textContent = 'Waiting for the arena…'; el.classList.remove('is-bad'); return; }
        if (!d.bHasArena || d.SpawnPointCount === 0) {
          el.textContent = d.Message || 'Arena not ready';
          el.classList.add('is-bad');
          return;
        }
        el.textContent = `${d.SpawnPointCount} spawn point${d.SpawnPointCount === 1 ? '' : 's'}`;
        el.classList.remove('is-bad');
      }

      // -------- bind --------
      ctx.on('tsic.msg.UI.Arena.State', (p) => {
        state.data = p || null;
        fillPickers();
        applySetup(p && p.Current);
        renderSaved();
        renderStatus();
      });

      $('ar-fight').addEventListener('click', () => ctx.publish('UI.Cmd.Arena.Fight', { Setup: readSetup() }));
      $('ar-save').addEventListener('click', () => {
        const setup = readSetup();
        if (!setup.Name) { tsic.playSound('UI.Error', 0.4); $('ar-name').focus(); return; }
        ctx.publish('UI.Cmd.Arena.Save', { Setup: setup });
      });
      $('ar-close').addEventListener('click', () => ctx.publish('UI.Cmd.Arena.Toggle', {}));

      fillPickers();
      renderSaved();
      renderStatus();
      requestState = () => ctx.publish('UI.Cmd.Arena.RequestState', {});
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
      // The toggle already sends a state, but a reopen after a save elsewhere must not
      // show a stale list.
      if (requestState) requestState();
    },
  });
})();
