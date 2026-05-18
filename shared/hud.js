// Builds the persistent in-game HUD chrome. With each HUD subsystem owning
// its own WebView page (health-bar.html, stamina-bar.html, stomach.html,
// notifications.html, crosshair.html), only the transient toast stack and
// the interaction prompt remain in-game.html.
(function () {
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    for (const c of children) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
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
    const sev = (payload && payload.Severity && (payload.Severity.TagName || payload.Severity)) || '';
    const div = document.createElement('div');
    div.className = 'toast ' + severityClass(sev);
    div.textContent = String(text);
    container.appendChild(div);
    setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 3000);
  }

  function buildChrome() {
    const chrome = el('div', { id: 'hud-chrome' });
    const prompt = el('div', { class: 'interaction-prompt', id: 'interaction-prompt', style: 'display:none;' }, '');
    chrome.appendChild(prompt);
    document.body.appendChild(chrome);

    const toasts = el('div', { id: 'toast-container' });
    toasts.setAttribute('style',
      'position:fixed; right:24px; top:24px; display:flex; flex-direction:column; gap:8px; z-index:100; pointer-events:none;');
    document.body.appendChild(toasts);
  }

  function whenReady(cb) {
    if (window.tsic && document.body) { cb(); return; }
    setTimeout(() => whenReady(cb), 16);
  }

  whenReady(() => {
    buildChrome();

    tsic.on('tsic.msg.UI.Interaction.Targets', (p) => {
      const el = document.getElementById('interaction-prompt');
      if (!el) return;
      const target = p && p.Targets && p.Targets.find(t => t.bIsPrimary);
      if (target) { el.textContent = target.Label || 'Interact'; el.style.display = ''; }
      else { el.style.display = 'none'; }
    });

    tsic.on('tsic.msg.UI.Toast.Show', showToast);
  });
})();
