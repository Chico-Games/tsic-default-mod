// Builds the persistent in-game HUD chrome on every page that includes it.
// Subscribes to GAS attributes + interaction targets. Cache replay
// re-populates the bars within one frame of page load.
(function () {
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    for (const c of children) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  }

  function buildChrome() {
    const chrome = el('div', { id: 'hud-chrome' });
    const bars = el('div', { class: 'hud-bars' });

    const mkBar = (label) => {
      const row = el('div', { class: 'hud-row' });
      row.appendChild(el('div', { class: 'hud-label' }, label, el('span', { id: `${label.toLowerCase()}-status` })));
      const track = el('div', { class: 'tsic-bar-track' });
      track.appendChild(el('div', { class: 'tsic-bar-fill', id: `${label.toLowerCase()}-fill`, style: 'width:100%;' }));
      track.appendChild(el('div', { class: 'hud-numbers', id: `${label.toLowerCase()}-num` }, '— / —'));
      row.appendChild(track);
      return row;
    };

    bars.appendChild(mkBar('Health'));
    bars.appendChild(mkBar('Stamina'));
    bars.appendChild(mkBar('Stomach'));

    const prompt = el('div', { class: 'interaction-prompt', id: 'interaction-prompt', style: 'display:none;' }, '');

    chrome.appendChild(bars);
    chrome.appendChild(prompt);
    document.body.appendChild(chrome);

    // Toast container — fire-and-forget transient stack, top-right.
    const toasts = el('div', { id: 'toast-container' });
    toasts.setAttribute('style',
      'position:fixed; right:24px; top:24px; display:flex; flex-direction:column; gap:8px; z-index:100; pointer-events:none;');
    document.body.appendChild(toasts);
  }

  function severityClass(tag) {
    if (!tag) return '';
    const s = String(tag).toLowerCase();
    if (s.indexOf('error') >= 0 || s.indexOf('danger') >= 0) return 'toast--error';
    if (s.indexOf('warn') >= 0) return 'toast--warning';
    if (s.indexOf('info') >= 0) return 'toast--info';
    return '';
  }

  function showToast(payload) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const text = (payload && (payload.Text || payload.text)) || '';
    if (!text) return;
    const sev = payload && (payload.Severity && (payload.Severity.TagName || payload.Severity)) || '';
    const div = document.createElement('div');
    div.className = 'toast ' + severityClass(sev);
    div.textContent = String(text);
    container.appendChild(div);
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 3000);
  }

  function applyBar(name, cur, max) {
    const pct = max > 0 ? Math.max(0, Math.min(1, cur / max)) * 100 : 0;
    const fill = document.getElementById(`${name}-fill`);
    const num = document.getElementById(`${name}-num`);
    if (fill) fill.style.width = pct + '%';
    if (num) num.textContent = Math.round(cur) + ' / ' + Math.round(max);
  }

  function whenReady(cb) {
    if (window.tsic && document.body) { cb(); return; }
    setTimeout(() => whenReady(cb), 16);
  }

  whenReady(() => {
    buildChrome();

    tsic.on('tsic.attr.player.health', (p) => {
      if (!p) return;
      applyBar('health', Number(p.current) || 0, Number(p.max) || 1);
    });
    tsic.on('tsic.attr.player.stamina', (p) => {
      if (!p) return;
      applyBar('stamina', Number(p.current) || 0, Number(p.max) || 1);
    });
    tsic.on('tsic.attr.player.stomach', (p) => {
      if (!p) return;
      applyBar('stomach', Number(p.current) || 0, Number(p.max) || 1);
    });

    tsic.on('tsic.msg.UI.Interaction.Targets', (p) => {
      const el = document.getElementById('interaction-prompt');
      if (!el) return;
      const target = p && p.Targets && p.Targets.find(t => t.IsPrimary);
      if (target) { el.textContent = target.Label || 'Interact'; el.style.display = ''; }
      else { el.style.display = 'none'; }
    });

    // Transient toasts — bridged as bTransient so cache replay never re-fires
    // old toasts on page reload. Each delivery becomes a 3s DOM element.
    tsic.on('tsic.msg.UI.Toast.Show', (p) => showToast(p));
  });
})();
