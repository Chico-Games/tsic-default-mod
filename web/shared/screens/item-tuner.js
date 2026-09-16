// Item layout tuner screen — the placement sheet for the 3D basket inventory (L_Dev_ItemTuner).
//
// C++ (AScpItemLayoutTuner) owns everything: the item list, the sandbox basket in front of the
// player and the values. This panel shows UI.ItemTuner.State and sends edits back:
//   UI.Cmd.ItemTuner.Nav {Delta}                    arrows
//   UI.Cmd.ItemTuner.SelectItem {ItemId}            picker
//   UI.Cmd.ItemTuner.SetCells {Cells:"x,y;x,y"}     footprint grid toggles
//   UI.Cmd.ItemTuner.SetValue {Field,Value}         Scale, Pitch/Yaw/Roll, OffsetX/Y/Z, Stackable,
//                                                   MaxStackSize, PreviewCount, PoseX/Y/Z/PosePitch/PoseYaw/PoseRoll
//   UI.Cmd.ItemTuner.SelectUnit {Index}             which unit of the preview stack the pose sliders edit
//   UI.Cmd.ItemTuner.SetCamera {Yaw,Pitch,Distance}
//   UI.Cmd.ItemTuner.ClearPoses / Revert / Save / Toggle
// The rest of the screen stays clear: clicks there go to the basket (UI.Cmd.Basket.Pointer), so the
// stack can be picked up, split and dropped while tuning.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  // [field, label, min, max, step, decimals]
  const MESH = [
    ['Scale', 'Scale (0 = auto)', 0, 4, 0.01, 2],
    ['Pitch', 'Pitch', -180, 180, 0.5, 1],
    ['Yaw', 'Yaw', -180, 180, 0.5, 1],
    ['Roll', 'Roll', -180, 180, 0.5, 1],
    ['OffsetX', 'Offset X (away)', -30, 30, 0.1, 1],
    ['OffsetY', 'Offset Y (right)', -30, 30, 0.1, 1],
    ['OffsetZ', 'Offset Z (up)', -30, 30, 0.1, 1],
  ];
  const STACK = [
    ['MaxStackSize', 'Max stack', 1, 100, 1, 0],
    ['PreviewCount', 'Preview units', 1, 50, 1, 0],
  ];
  const POSE = [
    ['PoseX', 'X (away)', -30, 30, 0.1, 1],
    ['PoseY', 'Y (right)', -30, 30, 0.1, 1],
    ['PoseZ', 'Z (up)', -10, 60, 0.1, 1],
    ['PosePitch', 'Pitch', -180, 180, 0.5, 1],
    ['PoseYaw', 'Yaw', -180, 180, 0.5, 1],
    ['PoseRoll', 'Roll', -180, 180, 0.5, 1],
  ];
  const CAMERA = [
    ['__camYaw', 'Orbit', -180, 180, 1, 0],
    ['__camPitch', 'Pitch', -89, -5, 1, 0],
    ['__camDistance', 'Distance', 40, 400, 2, 0],
  ];
  const CAMERA_PRESETS = { Player: [0, -48, 100], Top: [0, -88, 110], Side: [90, -30, 110], Low: [0, -18, 120] };
  const GRID = 4; // footprint editor is 4x4 cells

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function slider(field, label, min, max, step) {
    return `<div class="it-row" data-field="${esc(field)}">` +
      `<label>${esc(label)}</label>` +
      `<input type="range" class="it-range" min="${min}" max="${max}" step="${step}" value="${min}" data-tsic-focusable data-no-sfx>` +
      `<input type="number" class="it-num" step="${step}" value="0" data-tsic-focusable data-no-sfx></div>`;
  }

  const STYLE = `
    [data-screen="ItemTuner"] #it-root { position: fixed; top: 0; right: 0; bottom: 0; width: 420px; pointer-events: auto; color: var(--cat-ink-dark); }
    [data-screen="ItemTuner"] #it-panel {
      height: 100%; box-sizing: border-box; overflow: auto; display: flex; flex-direction: column; gap: 8px;
      background: rgba(252,249,241,0.96); border-left: 3px solid var(--ink-night, #14110c); padding: 12px 14px 16px;
    }
    [data-screen="ItemTuner"] h2 { margin: 0; color: #1d4ed8; font-size: 22px; }
    [data-screen="ItemTuner"] #it-nav { display: flex; align-items: center; gap: 8px; }
    [data-screen="ItemTuner"] #it-nav .tsic-button { min-height: 0; padding: 4px 12px; font-size: 18px; border-width: 2px; }
    [data-screen="ItemTuner"] #it-focus { flex: 1 1 auto; text-align: center; min-width: 0; }
    [data-screen="ItemTuner"] #it-label { font-weight: 700; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    [data-screen="ItemTuner"] #it-sub { font-size: 11px; opacity: 0.7; word-break: break-all; }
    [data-screen="ItemTuner"] select, [data-screen="ItemTuner"] input[type="text"] { width: 100%; box-sizing: border-box; font: inherit; font-size: 12px; padding: 3px 4px; background: #fffdf7; color: inherit; border: 1px solid var(--tsic-border); }
    [data-screen="ItemTuner"] .it-section { border: 1px solid var(--tsic-border); padding: 8px 10px; background: rgba(255,253,247,0.8); }
    [data-screen="ItemTuner"] .it-section h3 { letter-spacing: 3px; color: rgba(59,47,28,0.7); font-size: 11px; margin: 0 0 6px; text-transform: uppercase; }
    [data-screen="ItemTuner"] .it-row { display: grid; grid-template-columns: 96px 1fr 68px; gap: 6px; align-items: center; margin-bottom: 4px; }
    [data-screen="ItemTuner"] .it-row label { font-size: 11px; color: rgba(59,47,28,0.8); }
    [data-screen="ItemTuner"] .it-range { width: 100%; accent-color: #1d4ed8; }
    [data-screen="ItemTuner"] .it-num { width: 100%; box-sizing: border-box; font: inherit; font-size: 11px; padding: 2px 4px; text-align: right; font-variant-numeric: tabular-nums; background: #fffdf7; color: inherit; border: 1px solid var(--tsic-border); }
    [data-screen="ItemTuner"] .it-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
    [data-screen="ItemTuner"] .it-buttons .tsic-button { min-height: 0; padding: 5px 10px; font-size: 12px; border-width: 2px; }
    [data-screen="ItemTuner"] .tsic-button.is-on { background: #1e3a8a; color: #fff; }
    [data-screen="ItemTuner"] .tsic-button.is-primary { background: #166534; color: #fff; }
    [data-screen="ItemTuner"] #it-status { font-size: 11px; opacity: 0.75; min-height: 14px; }
    [data-screen="ItemTuner"] #it-status.is-bad { color: #b91c1c; opacity: 1; }
    [data-screen="ItemTuner"] #it-json { font-size: 10px; opacity: 0.6; word-break: break-all; }
    [data-screen="ItemTuner"] #it-dirty { font-size: 11px; font-weight: 700; color: #b45309; }
    [data-screen="ItemTuner"] #it-cells { display: grid; grid-template-columns: repeat(${GRID}, 28px); gap: 3px; margin: 4px 0 6px; }
    [data-screen="ItemTuner"] .it-cell { width: 28px; height: 28px; border: 2px solid var(--ink-night, #14110c); background: #fffdf7; cursor: pointer; box-sizing: border-box; }
    [data-screen="ItemTuner"] .it-cell.is-on { background: #1d4ed8; }
    [data-screen="ItemTuner"] .it-cell.is-anchor { box-shadow: inset 0 0 0 3px #fbbf24; }
    [data-screen="ItemTuner"] .it-inline { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 4px; }
    [data-screen="ItemTuner"] .it-inline label { display: flex; align-items: center; gap: 4px; }
    [data-screen="ItemTuner"] #it-filter { margin-bottom: 4px; }
    [data-screen="ItemTuner"] #it-note { font-size: 11px; opacity: 0.7; }
  `;
  let styleInjected = false;
  function injectStyleOnce() {
    if (styleInjected) return;
    styleInjected = true;
    const el = document.createElement('style');
    el.textContent = STYLE;
    document.head.appendChild(el);
  }

  const TEMPLATE = `<div id="it-root"><div id="it-panel">
    <h2>Item layout tuner</h2>
    <div id="it-status"></div>
    <div id="it-nav">
      <button type="button" class="tsic-button" id="it-prev" data-tsic-focusable data-tsic-initial-focus title="Previous item">&#9664;</button>
      <div id="it-focus"><div id="it-label">-</div><div id="it-sub">-</div></div>
      <button type="button" class="tsic-button" id="it-next" data-tsic-focusable title="Next item">&#9654;</button>
    </div>
    <input type="text" id="it-filter" placeholder="Filter items" data-tsic-focusable data-no-sfx>
    <select id="it-items" size="6" data-tsic-focusable data-no-sfx></select>
    <div class="it-section"><h3>Footprint (cells)</h3>
      <div id="it-cells"></div>
      <div id="it-note">Top-left is the anchor. Columns run right, rows toward you.</div>
    </div>
    <div class="it-section"><h3>Mesh</h3>${MESH.map((a) => slider(...a)).join('')}<div id="it-scale-note" class="it-inline"></div></div>
    <div class="it-section"><h3>Stack</h3>
      <div class="it-inline"><label><input type="checkbox" id="it-stackable" data-tsic-focusable data-no-sfx> Stackable</label></div>
      ${STACK.map((a) => slider(...a)).join('')}
      <div class="it-inline">Unit:</div>
      <div class="it-buttons" id="it-units"></div>
      ${POSE.map((a) => slider(...a)).join('')}
      <div class="it-buttons"><button type="button" class="tsic-button" id="it-clear-poses" data-tsic-focusable title="Drop every authored pose; units pile straight up">Clear poses</button></div>
    </div>
    <div class="it-section"><h3>Camera</h3>
      <div class="it-buttons" id="it-cam-presets">${Object.keys(CAMERA_PRESETS).map((k) =>
        `<button type="button" class="tsic-button it-cam" data-preset="${esc(k)}" data-tsic-focusable>${esc(k)}</button>`).join('')}</div>
      ${CAMERA.map((a) => slider(...a)).join('')}
    </div>
    <div class="it-buttons">
      <button type="button" class="tsic-button" id="it-revert" data-tsic-focusable title="Drop every unsaved edit of this item">Revert item</button>
      <button type="button" class="tsic-button is-primary" id="it-save" data-tsic-focusable title="Write the item definition JSON">Save to JSON</button>
      <button type="button" class="tsic-button" id="it-close" data-tsic-focusable>Close</button>
    </div>
    <div id="it-dirty"></div>
    <div id="it-json"></div>
  </div></div>`;

  let requestState = null;

  TSIC.registerScreen('ItemTuner', {
    inputModeTag: 'InputMode.Menu.Generic',
    cancelCmd: 'UI.Cmd.ItemTuner.Toggle',
    actionBarContext: [
      { ActionName: 'IA_UI_CancelBack', Label: 'Close', KeyName: 'Escape', Priority: 1000 },
    ],
    opaque: false,
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();
      const $ = (id) => root.querySelector('#' + id);
      const rows = new Map();
      root.querySelectorAll('.it-row[data-field]').forEach((row) => {
        rows.set(row.dataset.field, { row, range: row.querySelector('.it-range'), num: row.querySelector('.it-num') });
      });
      const decimalsOf = new Map([...MESH, ...STACK, ...POSE, ...CAMERA].map((a) => [a[0], a[5]]));
      let dragging = null;
      let last = {};
      let items = [];
      let cells = new Set(['0,0']);

      function show(field, value) {
        const r = rows.get(field);
        if (!r) return;
        const v = Number(value || 0);
        if (dragging !== field) {
          r.range.value = String(v);
          r.num.value = v.toFixed(decimalsOf.get(field));
        }
      }

      function renderItems(state) {
        if (!state.bItemsOmitted && Array.isArray(state.Items)) items = state.Items;
        const sel = $('it-items');
        const filter = $('it-filter').value.trim().toLowerCase();
        const list = filter ? items.filter((i) => (i.Id + ' ' + i.Name).toLowerCase().includes(filter)) : items;
        const key = list.map((i) => `${i.Id}|${i.bDirty ? 1 : 0}|${i.bAuthored ? 1 : 0}`).join(',');
        if (sel.dataset.key !== key) {
          sel.dataset.key = key;
          const groups = new Map();
          for (const it of list) {
            if (!groups.has(it.Kind)) groups.set(it.Kind, []);
            groups.get(it.Kind).push(it);
          }
          sel.innerHTML = [...groups].map(([kind, entries]) =>
            `<optgroup label="${esc(kind)}">` + entries.map((it) =>
              `<option value="${esc(it.Id)}">${it.bDirty ? '* ' : ''}${it.bAuthored ? '' : '· '}${esc(it.Name || it.Id)}  (${esc(it.Id)})</option>`).join('') +
            '</optgroup>').join('');
        }
        if (sel.value !== state.ItemId) sel.value = state.ItemId || '';
      }

      function renderCells(state) {
        cells = new Set(String(state.Cells || '0,0').split(';').filter(Boolean));
        const host = $('it-cells');
        let html = '';
        for (let y = 0; y < GRID; y++) {
          for (let x = 0; x < GRID; x++) {
            const on = cells.has(`${x},${y}`);
            html += `<div class="it-cell${on ? ' is-on' : ''}${x === 0 && y === 0 ? ' is-anchor' : ''}" data-x="${x}" data-y="${y}" title="${x},${y}"></div>`;
          }
        }
        host.innerHTML = html;
        host.querySelectorAll('.it-cell').forEach((c) => c.addEventListener('click', () => {
          const key = `${c.dataset.x},${c.dataset.y}`;
          if (cells.has(key)) { if (cells.size > 1) cells.delete(key); } else cells.add(key);
          ctx.publish('UI.Cmd.ItemTuner.SetCells', { Cells: [...cells].join(';') });
        }));
      }

      function renderUnits(state) {
        const host = $('it-units');
        const count = Math.max(1, Number(state.PreviewCount || 1));
        const authored = (state.Poses || []).length;
        let html = '';
        for (let i = 0; i < Math.min(count, 12); i++) {
          html += `<button type="button" class="tsic-button it-unit${i === state.UnitIndex ? ' is-on' : ''}" data-index="${i}" data-tsic-focusable title="${i < authored ? 'authored pose' : 'piled (auto)'}">${i + 1}${i < authored ? '' : '·'}</button>`;
        }
        host.innerHTML = html;
        host.querySelectorAll('.it-unit').forEach((b) => b.addEventListener('click', () =>
          ctx.publish('UI.Cmd.ItemTuner.SelectUnit', { Index: Number(b.dataset.index) })));
      }

      function render(state) {
        last = state;
        const status = $('it-status');
        status.textContent = state.Message || '';
        status.classList.toggle('is-bad', !state.bHasTuner);
        const total = (state.bItemsOmitted ? items : (state.Items || [])).length;
        $('it-label').textContent = total ? `${state.ItemIndex + 1} / ${total}  -  ${state.ItemName || state.ItemId}` : '-';
        $('it-sub').textContent = state.ItemId
          ? `${state.ItemId}  ·  ${state.MeshName || 'no mesh'}  ·  ${state.CellsWide}x${state.CellsTall} cells of ${Number(state.CellSize || 0).toFixed(1)} cm` : '';
        renderItems(state);
        renderCells(state);
        for (const [f] of MESH) show(f, state[f]);
        $('it-scale-note').textContent = state.Scale > 0 ? '' : `Auto-fit scale: ${Number(state.EffectiveScale || 1).toFixed(3)}`;
        $('it-stackable').checked = !!state.bStackable;
        show('MaxStackSize', state.MaxStackSize);
        show('PreviewCount', state.PreviewCount);
        renderUnits(state);
        const pose = (state.Poses || [])[state.UnitIndex];
        for (const [f] of POSE) {
          const key = f.slice(4); // PoseX -> X
          show(f, pose ? pose[key] : 0);
        }
        show('__camYaw', state.CamYaw);
        show('__camPitch', state.CamPitch);
        show('__camDistance', state.CamDistance);
        $('it-dirty').textContent = state.bDirty ? 'Unsaved edits on this item.' : '';
        $('it-json').textContent = state.JsonPath ? `Saves to ${state.JsonPath}` : '';
      }

      // Sliders publish as they move (throttled a little so the bridge is not flooded).
      const pending = new Map();
      let flushTimer = null;
      function camera() {
        const v = (f, fallback) => (pending.has(f) ? pending.get(f) : Number(fallback || 0));
        return { Yaw: v('__camYaw', last.CamYaw), Pitch: v('__camPitch', last.CamPitch), Distance: v('__camDistance', last.CamDistance) };
      }
      function flush() {
        flushTimer = null;
        let cameraTouched = false;
        for (const [field, value] of pending) {
          if (field.startsWith('__cam')) { cameraTouched = true; continue; }
          ctx.publish('UI.Cmd.ItemTuner.SetValue', { Field: field, Value: value });
        }
        if (cameraTouched) ctx.publish('UI.Cmd.ItemTuner.SetCamera', camera());
        pending.clear();
      }
      function edit(field, value) {
        const r = rows.get(field);
        if (!r || !Number.isFinite(value)) return;
        dragging = field;
        r.range.value = String(value);
        r.num.value = value.toFixed(decimalsOf.get(field));
        pending.set(field, value);
        if (!flushTimer) flushTimer = setTimeout(flush, 40);
      }
      for (const [field, r] of rows) {
        r.range.addEventListener('input', () => edit(field, Number(r.range.value)));
        r.range.addEventListener('change', () => { dragging = null; });
        r.num.addEventListener('change', () => { edit(field, Number(r.num.value)); dragging = null; });
        r.num.addEventListener('keydown', (ev) => ev.stopPropagation());
      }

      $('it-prev').addEventListener('click', () => ctx.publish('UI.Cmd.ItemTuner.Nav', { Delta: -1 }));
      $('it-next').addEventListener('click', () => ctx.publish('UI.Cmd.ItemTuner.Nav', { Delta: 1 }));
      $('it-items').addEventListener('change', () => ctx.publish('UI.Cmd.ItemTuner.SelectItem', { ItemId: $('it-items').value }));
      $('it-filter').addEventListener('input', () => renderItems({ bItemsOmitted: true, ItemId: last.ItemId }));
      $('it-filter').addEventListener('keydown', (ev) => ev.stopPropagation());
      $('it-stackable').addEventListener('change', () => ctx.publish('UI.Cmd.ItemTuner.SetValue', { Field: 'Stackable', Value: $('it-stackable').checked ? 1 : 0 }));
      root.querySelectorAll('.it-cam').forEach((b) => b.addEventListener('click', () => {
        const [Yaw, Pitch, Distance] = CAMERA_PRESETS[b.dataset.preset];
        ctx.publish('UI.Cmd.ItemTuner.SetCamera', { Yaw, Pitch, Distance });
      }));
      $('it-clear-poses').addEventListener('click', () => ctx.publish('UI.Cmd.ItemTuner.ClearPoses', {}));
      $('it-revert').addEventListener('click', () => ctx.publish('UI.Cmd.ItemTuner.Revert', {}));
      $('it-save').addEventListener('click', () => ctx.publish('UI.Cmd.ItemTuner.Save', {}));
      $('it-close').addEventListener('click', () => ctx.publish('UI.Cmd.ItemTuner.Toggle', {}));

      root.addEventListener('keydown', (ev) => {
        const tag = ev.target && ev.target.tagName;
        if (tag === 'INPUT' || tag === 'SELECT') return;
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); ctx.publish('UI.Cmd.ItemTuner.Nav', { Delta: -1 }); }
        else if (ev.key === 'ArrowRight') { ev.preventDefault(); ctx.publish('UI.Cmd.ItemTuner.Nav', { Delta: 1 }); }
      });

      // Everything outside the panel is the basket: forward moves and buttons like the Basket
      // screen does (the page is the cursor authority while an overlay is up).
      const panel = $('it-root');
      const overlay = root;
      const frac = (ev) => ({ X: ev.clientX / Math.max(1, window.innerWidth), Y: ev.clientY / Math.max(1, window.innerHeight) });
      let moveTimer = null;
      let lastMove = null;
      function flushMove() {
        moveTimer = null;
        if (!lastMove) return;
        ctx.publish('UI.Cmd.Basket.Pointer', { Type: 0, Button: 0, ...lastMove });
        lastMove = null;
      }
      overlay.addEventListener('pointermove', (ev) => {
        if (panel.contains(ev.target)) return;
        lastMove = frac(ev);
        if (!moveTimer) moveTimer = setTimeout(flushMove, 33);
      });
      overlay.addEventListener('pointerdown', (ev) => {
        if (panel.contains(ev.target) || (ev.pointerType && ev.pointerType !== 'mouse')) return;
        ev.preventDefault();
        ctx.publish('UI.Cmd.Basket.Pointer', { Type: 1, Button: ev.button, ...frac(ev) });
      });
      overlay.addEventListener('pointerup', (ev) => {
        if (panel.contains(ev.target) || (ev.pointerType && ev.pointerType !== 'mouse')) return;
        ev.preventDefault();
        ctx.publish('UI.Cmd.Basket.Pointer', { Type: 2, Button: ev.button, ...frac(ev) });
      });
      overlay.addEventListener('contextmenu', (ev) => { if (!panel.contains(ev.target)) ev.preventDefault(); });

      ctx.on('tsic.msg.UI.ItemTuner.State', (state) => render(state || {}));
      requestState = () => ctx.publish('UI.Cmd.ItemTuner.RequestState', {});
    },

    onShow() {
      if (requestState) requestState();
    },
  });
})();
