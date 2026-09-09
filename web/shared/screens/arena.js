// Arena screen module — the test-arena setup sheet (F9 in L_Arena).
//
// C++ owns the loop: UI.Cmd.Arena.Toggle clears the live enemies and opens this
// screen; Fight sends the whole setup back on UI.Cmd.Arena.Fight and C++ closes the
// screen, resets the player and spawns. Everything the sheet shows arrives on
// UI.Arena.State — the working setup, the saved ones and the pick lists — so this
// file holds no catalogue of its own.
//
// Pick lists are tsic-dropdown triggers (never a native <select>, see cheat-menu.js).
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
  `;

  function enemyRows() {
    let html = '';
    for (let i = 0; i < MAX_ENEMIES; i++) {
      html += `<div class="ar-row"><label for="ar-enemy-${i}">Point ${i + 1}</label>` +
        picker(`ar-enemy-${i}`, [NONE_OPT]) + picker(`ar-tier-${i}`, TIERS, 'ar-select--sm') + '</div>';
    }
    return html;
  }
  function gearRows() {
    return GEAR_SLOTS.map((g) =>
      `<div class="ar-row"><label for="ar-gear-${g.key}">${esc(g.label)}</label>${picker('ar-gear-' + g.key, [NONE_OPT])}</div>`
    ).join('');
  }
  function hotbarRows() {
    let html = '';
    for (let i = 0; i < HOTBAR_CELLS; i++) {
      html += `<div class="ar-row"><label for="ar-hot-${i}">Cell ${i + 1}</label>` + picker(`ar-hot-${i}`, [NONE_OPT]) +
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
            <div class="ar-row"><label for="ar-filter">Filter</label>
              <input class="ar-input ar-input--filter" id="ar-filter" placeholder="type to narrow the item lists…"></div>
            ${hotbarRows()}
            <div class="ar-meta">Cell 1 is drawn when the fight starts.</div>
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
      // Repopulate a picker, keeping its pick when the new list still has it.
      function setOptions(el, opts) {
        const prev = el.getAttribute('data-tsic-value');
        const api = dd();
        if (api) api.options(el, opts);
        else el.setAttribute('data-tsic-options', JSON.stringify(opts));
        const keep = opts.find((o) => String(o.value) === String(prev));
        const pick = keep || opts[0];
        if (pick) setPickerQuiet(el, pick.value, pick.label);
      }
      // Select a value even when the current list is filtered past it: the option is
      // added back so a loaded setup never shows "(none)" for something it names.
      function setPickerValue(el, value, allItems) {
        if (isNone(value)) { setPickerQuiet(el, '', NONE_OPT.label); return; }
        const opts = parseOptions(el);
        let opt = opts.find((o) => String(o.value) === String(value));
        if (!opt) {
          const item = (allItems || []).find((it) => it.InternalName === value);
          opt = { value, label: item ? formatEntry(item) : value };
          setOptions(el, [opts[0] || NONE_OPT, opt].concat(opts.slice(1)));
        }
        setPickerQuiet(el, opt.value, opt.label);
      }
      function parseOptions(el) {
        try { return JSON.parse(el.getAttribute('data-tsic-options') || '[]'); } catch (e) { return []; }
      }
      function formatEntry(it) {
        return it.DisplayName ? `${it.DisplayName} [${it.InternalName}]` : it.InternalName;
      }
      function toOptions(list, filter) {
        const f = (filter || '').toLowerCase();
        const opts = [NONE_OPT];
        for (const it of list || []) {
          if (f && !(it.DisplayName || '').toLowerCase().includes(f) && !(it.InternalName || '').toLowerCase().includes(f)) continue;
          opts.push({ value: it.InternalName, label: formatEntry(it) });
        }
        return opts;
      }

      // -------- catalogue -> pickers --------
      function fillPickers() {
        const d = state.data || {};
        const enemyOpts = toOptions(d.Enemies);
        for (let i = 0; i < MAX_ENEMIES; i++) setOptions($(`ar-enemy-${i}`), enemyOpts);
        for (const g of GEAR_SLOTS) setOptions($('ar-gear-' + g.key), toOptions(d[g.key]));
        fillHotbarPickers();
      }
      function fillHotbarPickers() {
        const d = state.data || {};
        const opts = toOptions(d.Items, $('ar-filter').value);
        for (let i = 0; i < HOTBAR_CELLS; i++) setOptions($(`ar-hot-${i}`), opts);
      }

      // -------- setup <-> controls --------
      function applySetup(setup) {
        const d = state.data || {};
        const s = setup || {};
        const enemies = s.Enemies || [];
        for (let i = 0; i < MAX_ENEMIES; i++) {
          const e = enemies[i] || {};
          setPickerValue($(`ar-enemy-${i}`), e.EnemyId, d.Enemies);
          const tier = TIERS.find((t) => t.value === e.VariantTier) || TIERS[0];
          setPickerQuiet($(`ar-tier-${i}`), tier.value, tier.label);
        }
        // Equipment is a flat id list; each id lands in the slot whose list carries it.
        const gear = (s.Equipment || []).filter((id) => !isNone(id));
        for (const g of GEAR_SLOTS) {
          const list = d[g.key] || [];
          const hit = gear.find((id) => list.some((it) => it.InternalName === id));
          setPickerValue($('ar-gear-' + g.key), hit || '', list);
        }
        const hot = s.Hotbar || [];
        for (let i = 0; i < HOTBAR_CELLS; i++) {
          const h = hot[i] || {};
          setPickerValue($(`ar-hot-${i}`), h.ItemId, d.Items);
          $(`ar-count-${i}`).value = Math.max(1, parseInt(h.Count, 10) || 1);
        }
        $('ar-name').value = s.Name || '';
      }

      function readSetup() {
        const setup = { Name: $('ar-name').value.trim(), Enemies: [], Equipment: [], Hotbar: [] };
        for (let i = 0; i < MAX_ENEMIES; i++) {
          setup.Enemies.push({ EnemyId: pickerValue(`ar-enemy-${i}`), VariantTier: pickerValue(`ar-tier-${i}`) || 'Base' });
        }
        for (const g of GEAR_SLOTS) {
          const id = pickerValue('ar-gear-' + g.key);
          if (id) setup.Equipment.push(id);
        }
        for (let i = 0; i < HOTBAR_CELLS; i++) {
          setup.Hotbar.push({ ItemId: pickerValue(`ar-hot-${i}`), Count: Math.max(1, parseInt($(`ar-count-${i}`).value, 10) || 1) });
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

      $('ar-filter').addEventListener('input', fillHotbarPickers);
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
    },

    onShow() {
      // The toggle already sends a state, but a reopen after a save elsewhere must not
      // show a stale list.
      if (requestState) requestState();
    },
  });
})();
