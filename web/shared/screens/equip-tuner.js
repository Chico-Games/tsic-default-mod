// Equipment pose tuner screen — the placement sheet for L_Dev_EquipTuner.
//
// C++ (AScpEquipPoseTuner) owns everything: the item list, what the player wears, the orbit
// camera and the values. This panel only shows UI.EquipTuner.State and sends edits back:
//   UI.Cmd.EquipTuner.Nav {Delta}                 arrows
//   UI.Cmd.EquipTuner.SelectItem {ItemId}         picker
//   UI.Cmd.EquipTuner.SelectRow {Index}           row tabs (one per attached piece)
//   UI.Cmd.EquipTuner.SetValue {Field,Value}      LocX/LocY/LocZ, Pitch/Yaw/Roll, Scale, ScaleX/Y/Z
//   UI.Cmd.EquipTuner.SetSocket {Socket}          socket dropdown
//   UI.Cmd.EquipTuner.SetCamera {Yaw,Pitch,Distance,Height}
//   UI.Cmd.EquipTuner.ResetRow / CopyToPair / Revert / Save / Toggle
// It sits on the right so the player stays in view; the game keeps running under it.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  // [field, label, min, max, step, decimals]
  const LOCATION = [
    ['LocX', 'X (forward)', -60, 60, 0.1, 2],
    ['LocY', 'Y (right)', -60, 60, 0.1, 2],
    ['LocZ', 'Z (up)', -60, 60, 0.1, 2],
  ];
  const ROTATION = [
    ['Pitch', 'Pitch', -180, 180, 0.5, 1],
    ['Yaw', 'Yaw', -180, 180, 0.5, 1],
    ['Roll', 'Roll', -180, 180, 0.5, 1],
  ];
  const SCALE = [
    ['Scale', 'Uniform', 0.1, 3, 0.01, 2],
    ['ScaleX', 'X', 0.1, 3, 0.01, 2],
    ['ScaleY', 'Y', 0.1, 3, 0.01, 2],
    ['ScaleZ', 'Z', 0.1, 3, 0.01, 2],
  ];
  const CAMERA = [
    ['__camYaw', 'Orbit', -180, 180, 1, 0],
    ['__camPitch', 'Pitch', -80, 80, 1, 0],
    ['__camDistance', 'Distance', 30, 800, 5, 0],
    ['__camHeight', 'Height', -20, 220, 1, 0],
  ];
  // name -> [yaw, pitch, distance, height]
  const CAMERA_PRESETS = {
    Front: [0, -8, 260, 110],
    Left: [90, -8, 260, 110],
    Right: [-90, -8, 260, 110],
    Back: [180, -8, 260, 110],
    Head: [0, 0, 110, 165],
    Hands: [20, -20, 150, 95],
    Torso: [0, 0, 170, 130],
    Legs: [0, 5, 190, 45],
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function slider(field, label, min, max, step) {
    return `<div class="et-row" data-field="${esc(field)}">` +
      `<label>${esc(label)}</label>` +
      `<input type="range" class="et-range" min="${min}" max="${max}" step="${step}" value="${min}" data-tsic-focusable data-no-sfx>` +
      `<input type="number" class="et-num" step="${step}" value="0" data-tsic-focusable data-no-sfx></div>`;
  }

  const STYLE = `
    [data-screen="EquipTuner"] #et-root { position: fixed; top: 0; right: 0; bottom: 0; width: 440px; pointer-events: auto; color: var(--cat-ink-dark); }
    [data-screen="EquipTuner"] #et-panel {
      height: 100%; box-sizing: border-box; overflow: auto; display: flex; flex-direction: column; gap: 8px;
      background: rgba(252,249,241,0.96); border-left: 3px solid var(--ink-night, #14110c); padding: 12px 14px 16px;
    }
    [data-screen="EquipTuner"] h2 { margin: 0; color: #1d4ed8; font-size: 22px; }
    [data-screen="EquipTuner"] #et-nav { display: flex; align-items: center; gap: 8px; }
    [data-screen="EquipTuner"] #et-nav .tsic-button { min-height: 0; padding: 4px 12px; font-size: 18px; border-width: 2px; }
    [data-screen="EquipTuner"] #et-focus { flex: 1 1 auto; text-align: center; min-width: 0; }
    [data-screen="EquipTuner"] #et-label { font-weight: 700; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    [data-screen="EquipTuner"] #et-sub { font-size: 11px; opacity: 0.7; word-break: break-all; }
    [data-screen="EquipTuner"] select { width: 100%; font: inherit; font-size: 12px; padding: 3px 4px; background: #fffdf7; color: inherit; border: 1px solid var(--tsic-border); }
    [data-screen="EquipTuner"] .et-section { border: 1px solid var(--tsic-border); padding: 8px 10px; background: rgba(255,253,247,0.8); }
    [data-screen="EquipTuner"] .et-section h3 { letter-spacing: 3px; color: rgba(59,47,28,0.7); font-size: 11px; margin: 0 0 6px; text-transform: uppercase; }
    [data-screen="EquipTuner"] .et-row { display: grid; grid-template-columns: 84px 1fr 72px; gap: 6px; align-items: center; margin-bottom: 4px; }
    [data-screen="EquipTuner"] .et-row label { font-size: 11px; color: rgba(59,47,28,0.8); }
    [data-screen="EquipTuner"] .et-range { width: 100%; accent-color: #1d4ed8; }
    [data-screen="EquipTuner"] .et-num { width: 100%; box-sizing: border-box; font: inherit; font-size: 11px; padding: 2px 4px; text-align: right; font-variant-numeric: tabular-nums; background: #fffdf7; color: inherit; border: 1px solid var(--tsic-border); }
    [data-screen="EquipTuner"] .et-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
    [data-screen="EquipTuner"] .et-buttons .tsic-button { min-height: 0; padding: 5px 10px; font-size: 12px; border-width: 2px; }
    [data-screen="EquipTuner"] .tsic-button.is-on { background: #1e3a8a; color: #fff; }
    [data-screen="EquipTuner"] .tsic-button.is-bad { border-color: #b91c1c; color: #b91c1c; }
    [data-screen="EquipTuner"] .tsic-button.is-primary { background: #166534; color: #fff; }
    [data-screen="EquipTuner"] #et-status { font-size: 11px; opacity: 0.75; min-height: 14px; }
    [data-screen="EquipTuner"] #et-status.is-bad { color: #b91c1c; opacity: 1; }
    [data-screen="EquipTuner"] #et-socket-warn { font-size: 11px; color: #b91c1c; margin-top: 4px; }
    [data-screen="EquipTuner"] #et-json { font-size: 10px; opacity: 0.6; word-break: break-all; }
    [data-screen="EquipTuner"] #et-dirty { font-size: 11px; font-weight: 700; color: #b45309; }
  `;
  let styleInjected = false;
  function injectStyleOnce() {
    if (styleInjected) return;
    styleInjected = true;
    const el = document.createElement('style');
    el.textContent = STYLE;
    document.head.appendChild(el);
  }

  const TEMPLATE = `<div id="et-root"><div id="et-panel">
    <h2>Equipment pose tuner</h2>
    <div id="et-status"></div>
    <div id="et-nav">
      <button type="button" class="tsic-button" id="et-prev" data-tsic-focusable data-tsic-initial-focus title="Previous item">&#9664;</button>
      <div id="et-focus"><div id="et-label">-</div><div id="et-sub">-</div></div>
      <button type="button" class="tsic-button" id="et-next" data-tsic-focusable title="Next item">&#9654;</button>
    </div>
    <select id="et-items" data-tsic-focusable data-no-sfx></select>
    <div class="et-section"><h3>Piece</h3>
      <div class="et-buttons" id="et-rows"></div>
      <div class="et-row"><label>Socket</label><select id="et-socket" data-tsic-focusable data-no-sfx style="grid-column: 2 / 4"></select></div>
      <div id="et-socket-warn" hidden></div>
    </div>
    <div class="et-section"><h3>Location (cm)</h3>${LOCATION.map((a) => slider(...a)).join('')}</div>
    <div class="et-section"><h3>Rotation (deg)</h3>${ROTATION.map((a) => slider(...a)).join('')}</div>
    <div class="et-section"><h3>Scale</h3>${SCALE.map((a) => slider(...a)).join('')}</div>
    <div class="et-section"><h3>Camera</h3>
      <div class="et-buttons" id="et-cam-presets">${Object.keys(CAMERA_PRESETS).map((k) =>
        `<button type="button" class="tsic-button et-cam" data-preset="${esc(k)}" data-tsic-focusable>${esc(k)}</button>`).join('')}</div>
      ${CAMERA.map((a) => slider(...a)).join('')}
    </div>
    <div class="et-buttons">
      <button type="button" class="tsic-button" id="et-reset-row" data-tsic-focusable title="Put this piece back to the values on disk">Reset piece</button>
      <button type="button" class="tsic-button" id="et-copy-pair" data-tsic-focusable title="Copy this piece's offset onto its left/right partner">Copy to L/R partner</button>
      <button type="button" class="tsic-button" id="et-revert" data-tsic-focusable title="Drop every unsaved edit of this item">Revert item</button>
      <button type="button" class="tsic-button is-primary" id="et-save" data-tsic-focusable title="Write the item's definition JSON">Save to JSON</button>
      <button type="button" class="tsic-button" id="et-close" data-tsic-focusable>Close</button>
    </div>
    <div id="et-dirty"></div>
    <div id="et-json"></div>
  </div></div>`;

  let requestState = null;

  TSIC.registerScreen('EquipTuner', {
    inputModeTag: 'InputMode.Menu.Generic',
    cancelCmd: 'UI.Cmd.EquipTuner.Toggle',
    actionBarContext: [
      { ActionName: 'IA_UI_CancelBack', Label: 'Close', KeyName: 'Escape', Priority: 1000 },
    ],
    opaque: false,
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();
      const $ = (id) => root.querySelector('#' + id);
      const rows = new Map();
      root.querySelectorAll('.et-row[data-field]').forEach((row) => {
        rows.set(row.dataset.field, {
          row, range: row.querySelector('.et-range'), num: row.querySelector('.et-num'),
        });
      });
      const decimalsOf = new Map([...LOCATION, ...ROTATION, ...SCALE, ...CAMERA].map((a) => [a[0], a[5]]));
      let dragging = null;
      let last = {};

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
        const sel = $('et-items');
        const items = state.Items || [];
        const key = items.map((i) => `${i.Id}|${i.bDirty ? 1 : 0}`).join(',');
        if (sel.dataset.key !== key) {
          sel.dataset.key = key;
          const groups = new Map();
          for (const it of items) {
            if (!groups.has(it.Slot)) groups.set(it.Slot, []);
            groups.get(it.Slot).push(it);
          }
          sel.innerHTML = [...groups].map(([slot, list]) =>
            `<optgroup label="${esc(slot)}">` + list.map((it) =>
              `<option value="${esc(it.Id)}">${it.bDirty ? '* ' : ''}${esc(it.Name || it.Id)}  (${esc(it.Id)})</option>`).join('') +
            '</optgroup>').join('');
        }
        if (sel.value !== state.ItemId) sel.value = state.ItemId || '';
      }

      function renderRows(state) {
        const host = $('et-rows');
        const list = state.Rows || [];
        host.innerHTML = list.map((r, i) =>
          `<button type="button" class="tsic-button et-rowtab${i === state.RowIndex ? ' is-on' : ''}${r.bSocketExists ? '' : ' is-bad'}" data-index="${i}" data-tsic-focusable title="${esc(r.Visual)}">${esc(r.Socket)}</button>`).join('')
          || '<span style="font-size:11px;opacity:0.7">No pieces.</span>';
        host.querySelectorAll('.et-rowtab').forEach((b) => b.addEventListener('click', () =>
          ctx.publish('UI.Cmd.EquipTuner.SelectRow', { Index: Number(b.dataset.index) })));
      }

      function renderSocket(state, row) {
        const sel = $('et-socket');
        const sockets = state.Sockets || [];
        const key = sockets.join(',') + '|' + (row ? row.Socket : '');
        if (sel.dataset.key !== key) {
          sel.dataset.key = key;
          const names = sockets.slice();
          if (row && row.Socket && !names.includes(row.Socket)) names.unshift(row.Socket);
          sel.innerHTML = names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
        }
        if (row && sel.value !== row.Socket) sel.value = row.Socket;
        const warn = $('et-socket-warn');
        warn.hidden = !row || row.bSocketExists;
        warn.textContent = row && !row.bSocketExists
          ? `${row.Socket} does not exist on ${state.BodyMesh || 'the body mesh'}: the piece is sitting at the mesh origin.` : '';
      }

      function render(state) {
        last = state;
        const status = $('et-status');
        status.textContent = state.Message || (state.bEquipped ? '' : 'Item is not on the player.');
        status.classList.toggle('is-bad', !state.bHasTuner);
        const items = state.Items || [];
        $('et-label').textContent = items.length ? `${state.ItemIndex + 1} / ${items.length}  -  ${state.ItemName || state.ItemId}` : '-';
        $('et-sub').textContent = state.ItemId
          ? `${state.ItemId}  ·  ${state.Slot}${state.LayerClass ? '  ·  ' + state.LayerClass : ''}` : '';
        renderItems(state);
        renderRows(state);
        const row = (state.Rows || [])[state.RowIndex];
        renderSocket(state, row);
        for (const [f] of [...LOCATION, ...ROTATION]) show(f, row ? row[f] : 0);
        show('Scale', row ? row.ScaleX : 1);
        show('ScaleX', row ? row.ScaleX : 1);
        show('ScaleY', row ? row.ScaleY : 1);
        show('ScaleZ', row ? row.ScaleZ : 1);
        show('__camYaw', state.CamYaw);
        show('__camPitch', state.CamPitch);
        show('__camDistance', state.CamDistance);
        show('__camHeight', state.CamHeight);
        $('et-dirty').textContent = state.bDirty ? 'Unsaved edits on this item.' : '';
        $('et-json').textContent = state.JsonPath ? `Saves to ${state.JsonPath}` : '';
      }

      // Sliders publish as they move (throttled a little so the bridge is not flooded).
      const pending = new Map();
      let flushTimer = null;
      function camera() {
        const v = (f, fallback) => (pending.has(f) ? pending.get(f) : Number(fallback || 0));
        return {
          Yaw: v('__camYaw', last.CamYaw), Pitch: v('__camPitch', last.CamPitch),
          Distance: v('__camDistance', last.CamDistance), Height: v('__camHeight', last.CamHeight),
        };
      }
      function flush() {
        flushTimer = null;
        let cameraTouched = false;
        for (const [field, value] of pending) {
          if (field.startsWith('__cam')) { cameraTouched = true; continue; }
          ctx.publish('UI.Cmd.EquipTuner.SetValue', { Field: field, Value: value });
        }
        if (cameraTouched) ctx.publish('UI.Cmd.EquipTuner.SetCamera', camera());
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
        // Arrow keys on the number box step it; the slider's own keys do the same.
        r.num.addEventListener('keydown', (ev) => ev.stopPropagation());
      }

      $('et-prev').addEventListener('click', () => ctx.publish('UI.Cmd.EquipTuner.Nav', { Delta: -1 }));
      $('et-next').addEventListener('click', () => ctx.publish('UI.Cmd.EquipTuner.Nav', { Delta: 1 }));
      $('et-items').addEventListener('change', () => ctx.publish('UI.Cmd.EquipTuner.SelectItem', { ItemId: $('et-items').value }));
      $('et-socket').addEventListener('change', () => ctx.publish('UI.Cmd.EquipTuner.SetSocket', { Socket: $('et-socket').value }));
      root.querySelectorAll('.et-cam').forEach((b) => b.addEventListener('click', () => {
        const [Yaw, Pitch, Distance, Height] = CAMERA_PRESETS[b.dataset.preset];
        ctx.publish('UI.Cmd.EquipTuner.SetCamera', { Yaw, Pitch, Distance, Height });
      }));
      $('et-reset-row').addEventListener('click', () => ctx.publish('UI.Cmd.EquipTuner.ResetRow', {}));
      $('et-copy-pair').addEventListener('click', () => ctx.publish('UI.Cmd.EquipTuner.CopyToPair', {}));
      $('et-revert').addEventListener('click', () => ctx.publish('UI.Cmd.EquipTuner.Revert', {}));
      $('et-save').addEventListener('click', () => ctx.publish('UI.Cmd.EquipTuner.Save', {}));
      $('et-close').addEventListener('click', () => ctx.publish('UI.Cmd.EquipTuner.Toggle', {}));

      root.addEventListener('keydown', (ev) => {
        const tag = ev.target && ev.target.tagName;
        if (tag === 'INPUT' || tag === 'SELECT') return;
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); ctx.publish('UI.Cmd.EquipTuner.Nav', { Delta: -1 }); }
        else if (ev.key === 'ArrowRight') { ev.preventDefault(); ctx.publish('UI.Cmd.EquipTuner.Nav', { Delta: 1 }); }
      });

      ctx.on('tsic.msg.UI.EquipTuner.State', (state) => render(state || {}));
      requestState = () => ctx.publish('UI.Cmd.EquipTuner.RequestState', {});
    },

    onShow() {
      if (requestState) requestState();
    },
  });
})();
