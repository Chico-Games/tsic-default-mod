// Hit-reaction tuner screen — the slider sheet for L_Dev_HitReactionTuner.
//
// C++ (AScpHitReactionTuner) owns everything: the clip list, the focused clip, the dummy's
// locomotion and the values. This panel only shows UI.HitTuner.State and sends edits back:
//   UI.Cmd.HitTuner.Nav {Delta}            arrows
//   UI.Cmd.HitTuner.SetValue {Field,Value} any slider (Field = FHitReactionTuning property)
//   UI.Cmd.HitTuner.SetLocomotion {Mode}   Idle / Walk / Run
//   UI.Cmd.HitTuner.SetInterval {Seconds}  replay cadence
//   UI.Cmd.HitTuner.Replay / Reset / ApplyToTier / Toggle
// It sits on the right so the dummy stays in view; the game keeps running under it.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const SECTIONS = [
    ['Head', 'Head'], ['Neck', 'Neck'], ['Shoulders', 'Shoulders'], ['Arms', 'Arms'],
    ['SpineUpper', 'Upper spine'], ['SpineMid', 'Mid spine'], ['SpineLower', 'Lower spine'],
    ['Pelvis', 'Pelvis'], ['Legs', 'Legs'],
  ];
  const TIMING = [
    ['PlayRate', 'Play rate', 0.1, 3, 0.05],
    ['DurationSeconds', 'Duration (s, 0 = full clip)', 0, 6, 0.05],
    ['BlendInSeconds', 'Blend in (s)', 0, 1, 0.01],
    ['BlendOutSeconds', 'Blend out (s)', 0, 1.5, 0.01],
  ];
  const PHYSICS = [
    ['PhysicsBlendWeight', 'Physics blend', 0, 1, 0.01],
    ['PhysicsKick', 'Hit kick', 0, 4, 0.05],
    ['PhysicsSeconds', 'Physics decay (s)', 0.05, 3, 0.05],
  ];

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function slider(field, label, min, max, step) {
    return `<div class="ht-row" data-field="${esc(field)}">` +
      `<label>${esc(label)}</label>` +
      `<input type="range" class="ht-range" min="${min}" max="${max}" step="${step}" value="${min}" data-tsic-focusable data-no-sfx>` +
      `<span class="ht-val">-</span></div>`;
  }

  const STYLE = `
    [data-screen="HitTuner"] #ht-root { position: fixed; top: 0; right: 0; bottom: 0; width: 420px; pointer-events: auto; color: var(--cat-ink-dark); }
    [data-screen="HitTuner"] #ht-panel {
      height: 100%; box-sizing: border-box; overflow: auto; display: flex; flex-direction: column; gap: 8px;
      background: rgba(252,249,241,0.96); border-left: 3px solid var(--ink-night, #14110c); padding: 12px 14px 16px;
    }
    [data-screen="HitTuner"] h2 { margin: 0; color: #c2410c; font-size: 22px; }
    [data-screen="HitTuner"] #ht-nav { display: flex; align-items: center; gap: 8px; }
    [data-screen="HitTuner"] #ht-nav .tsic-button { min-height: 0; padding: 4px 12px; font-size: 18px; border-width: 2px; }
    [data-screen="HitTuner"] #ht-focus { flex: 1 1 auto; text-align: center; }
    [data-screen="HitTuner"] #ht-label { font-weight: 700; font-size: 15px; }
    [data-screen="HitTuner"] #ht-sub { font-size: 11px; opacity: 0.7; word-break: break-all; }
    [data-screen="HitTuner"] .ht-section { border: 1px solid var(--tsic-border); padding: 8px 10px; background: rgba(255,253,247,0.8); }
    [data-screen="HitTuner"] .ht-section h3 { letter-spacing: 3px; color: rgba(59,47,28,0.7); font-size: 11px; margin: 0 0 6px; text-transform: uppercase; }
    [data-screen="HitTuner"] .ht-row { display: grid; grid-template-columns: 118px 1fr 44px; gap: 6px; align-items: center; margin-bottom: 4px; }
    [data-screen="HitTuner"] .ht-row label { font-size: 11px; color: rgba(59,47,28,0.8); }
    [data-screen="HitTuner"] .ht-val { font-size: 11px; text-align: right; font-variant-numeric: tabular-nums; }
    [data-screen="HitTuner"] .ht-range { width: 100%; accent-color: #c2410c; }
    [data-screen="HitTuner"] .ht-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
    [data-screen="HitTuner"] .ht-buttons .tsic-button { min-height: 0; padding: 5px 10px; font-size: 12px; border-width: 2px; }
    [data-screen="HitTuner"] .tsic-button.is-on { background: #7c2d12; color: #fff; }
    [data-screen="HitTuner"] #ht-status { font-size: 11px; opacity: 0.75; }
    [data-screen="HitTuner"] #ht-status.is-bad { color: #b91c1c; opacity: 1; }
    [data-screen="HitTuner"] #ht-json { font-size: 10px; opacity: 0.6; word-break: break-all; }
  `;
  let styleInjected = false;
  function injectStyleOnce() {
    if (styleInjected) return;
    styleInjected = true;
    const el = document.createElement('style');
    el.textContent = STYLE;
    document.head.appendChild(el);
  }

  const TEMPLATE = `<div id="ht-root"><div id="ht-panel">
    <h2>Hit reaction tuner</h2>
    <div id="ht-status"></div>
    <div id="ht-nav">
      <button type="button" class="tsic-button" id="ht-prev" data-tsic-focusable data-tsic-initial-focus title="Previous clip">&#9664;</button>
      <div id="ht-focus"><div id="ht-label">-</div><div id="ht-sub">-</div></div>
      <button type="button" class="tsic-button" id="ht-next" data-tsic-focusable title="Next clip">&#9654;</button>
    </div>
    <div class="ht-section"><h3>Dummy</h3>
      <div class="ht-buttons">
        <button type="button" class="tsic-button ht-loco" data-mode="Idle" data-tsic-focusable>Idle</button>
        <button type="button" class="tsic-button ht-loco" data-mode="Walk" data-tsic-focusable>Walk</button>
        <button type="button" class="tsic-button ht-loco" data-mode="Run" data-tsic-focusable>Run</button>
        <button type="button" class="tsic-button" id="ht-replay" data-tsic-focusable>Replay now</button>
      </div>
      ${slider('__interval', 'Replay every (s)', 0, 10, 0.5)}
    </div>
    <div class="ht-section"><h3>Body sections</h3>${SECTIONS.map(([f, l]) => slider(f, l, 0, 1, 0.01)).join('')}</div>
    <div class="ht-section"><h3>Timing</h3>${TIMING.map((a) => slider(...a)).join('')}</div>
    <div class="ht-section"><h3>Physics</h3>${PHYSICS.map((a) => slider(...a)).join('')}</div>
    <div class="ht-buttons">
      <button type="button" class="tsic-button" id="ht-reset" data-tsic-focusable title="Drop this clip's override">Reset to tier default</button>
      <button type="button" class="tsic-button" id="ht-apply-tier" data-tsic-focusable title="Copy these values to every clip of this tier">Apply to whole tier</button>
      <button type="button" class="tsic-button" id="ht-close" data-tsic-focusable>Close</button>
    </div>
    <div id="ht-json"></div>
  </div></div>`;

  let requestState = null;

  TSIC.registerScreen('HitTuner', {
    inputModeTag: 'InputMode.Menu.Generic',
    cancelCmd: 'UI.Cmd.HitTuner.Toggle',
    actionBarContext: [
      { ActionName: 'IA_UI_CancelBack', Label: 'Close', KeyName: 'Escape', Priority: 1000 },
    ],
    opaque: false,
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();
      const $ = (id) => root.querySelector('#' + id);
      const rows = new Map();
      root.querySelectorAll('.ht-row').forEach((row) => {
        rows.set(row.dataset.field, { row, input: row.querySelector('input'), val: row.querySelector('.ht-val') });
      });
      let dragging = null;

      function show(field, value) {
        const r = rows.get(field);
        if (!r) return;
        if (dragging !== field) r.input.value = String(value);
        r.val.textContent = Number(value).toFixed(2);
      }

      function render(state) {
        const status = $('ht-status');
        status.textContent = state.Message || (state.bHasOverride ? 'Clip has its own values.' : 'Clip is on its tier default.');
        status.classList.toggle('is-bad', !state.bHasTuner);
        $('ht-label').textContent = state.Count ? `${state.Index + 1} / ${state.Count}  -  ${state.Label}` : '-';
        $('ht-sub').textContent = state.MontageName ? `${state.MontageName}  (${Number(state.ClipSeconds || 0).toFixed(2)}s clip)` : '';
        root.querySelectorAll('.ht-loco').forEach((b) => b.classList.toggle('is-on', b.dataset.mode === state.Locomotion));
        show('__interval', state.IntervalSeconds);
        const t = state.Tuning || {};
        for (const [f] of SECTIONS) show(f, t[f]);
        for (const [f] of TIMING) show(f, t[f]);
        for (const [f] of PHYSICS) show(f, t[f]);
        $('ht-json').textContent = state.JsonPath ? `Saved live to ${state.JsonPath}` : '';
      }

      // Sliders publish as they move (throttled a little so the bridge is not flooded).
      const pending = new Map();
      let flushTimer = null;
      function flush() {
        flushTimer = null;
        for (const [field, value] of pending) {
          if (field === '__interval') ctx.publish('UI.Cmd.HitTuner.SetInterval', { Seconds: value });
          else ctx.publish('UI.Cmd.HitTuner.SetValue', { Field: field, Value: value });
        }
        pending.clear();
      }
      for (const [field, r] of rows) {
        r.input.addEventListener('input', () => {
          dragging = field;
          const v = Number(r.input.value);
          r.val.textContent = v.toFixed(2);
          pending.set(field, v);
          if (!flushTimer) flushTimer = setTimeout(flush, 40);
        });
        r.input.addEventListener('change', () => { dragging = null; });
      }

      $('ht-prev').addEventListener('click', () => ctx.publish('UI.Cmd.HitTuner.Nav', { Delta: -1 }));
      $('ht-next').addEventListener('click', () => ctx.publish('UI.Cmd.HitTuner.Nav', { Delta: 1 }));
      root.querySelectorAll('.ht-loco').forEach((b) => b.addEventListener('click', () =>
        ctx.publish('UI.Cmd.HitTuner.SetLocomotion', { Mode: b.dataset.mode })));
      $('ht-replay').addEventListener('click', () => ctx.publish('UI.Cmd.HitTuner.Replay', {}));
      $('ht-reset').addEventListener('click', () => ctx.publish('UI.Cmd.HitTuner.Reset', {}));
      $('ht-apply-tier').addEventListener('click', () => ctx.publish('UI.Cmd.HitTuner.ApplyToTier', {}));
      $('ht-close').addEventListener('click', () => ctx.publish('UI.Cmd.HitTuner.Toggle', {}));

      root.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); ctx.publish('UI.Cmd.HitTuner.Nav', { Delta: -1 }); }
        else if (ev.key === 'ArrowRight') { ev.preventDefault(); ctx.publish('UI.Cmd.HitTuner.Nav', { Delta: 1 }); }
      });

      ctx.on('tsic.msg.UI.HitTuner.State', (state) => render(state || {}));
      requestState = () => ctx.publish('UI.Cmd.HitTuner.RequestState', {});
    },

    onShow() {
      if (requestState) requestState();
    },
  });
})();
