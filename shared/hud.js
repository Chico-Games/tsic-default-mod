// Builds the persistent in-game HUD chrome. Because in-game.html is the
// only HTML page mounted as the Root WebView after the Slate UI tree was
// deleted, all of the HUD overlays (interaction prompt, toasts, health
// bar, stamina bar, crosshair) get assembled here as DOM under
// document.body. The standalone health-bar.html / stamina-bar.html /
// crosshair.html files still exist for the playground / snap-test runner
// and for any future multi-WebView mounting we may want to bring back.

// === DEBUG: paint a marker the instant this script is parsed, before
// anything else. If we don't see this red pip, hud.js never loaded
// (404 / wrong path / defer broken in Ultralight). ===
(function debugLoadMarker() {
  function paint() {
    if (!document.body) { setTimeout(paint, 16); return; }
    if (document.getElementById('hud-script-loaded-pip')) return;
    const d = document.createElement('div');
    d.id = 'hud-script-loaded-pip';
    d.className = 'pip-base';
    d.innerHTML = '<span class="pip-dot delay-1" style="background:#fff;"></span>'
                + 'hud.js loaded ' + new Date().toLocaleTimeString();
    d.style.cssText += 'left:8px; top:8px; background:#f00; color:#fff;';
    document.body.appendChild(d);
  }
  paint();
})();

(function () {
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    for (const c of children) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  }

  // ---------- toasts ----------

  function severityClass(tag) {
    if (!tag) return '';
    const parts = String(tag).split('.');
    const leaf = parts[parts.length - 1].toLowerCase();
    if (leaf === 'error' || leaf === 'danger') return 'toast--error';
    if (leaf === 'warning' || leaf === 'warn') return 'toast--warning';
    if (leaf === 'info') return 'toast--info';
    return '';
  }

  function extractSeverityTag(sev) {
    if (!sev) return '';
    if (typeof sev === 'string') return sev;
    if (typeof sev === 'object' && typeof sev.TagName === 'string') return sev.TagName;
    return '';
  }

  const TOAST_VISIBLE_MS = 3000;
  const TOAST_EXIT_MS = 200;

  function showToast(payload) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const text = (payload && (payload.Text || payload.text)) || '';
    if (!text) return;
    const sev = extractSeverityTag(payload && payload.Severity);
    const div = document.createElement('div');
    div.className = 'toast ' + severityClass(sev);
    div.textContent = String(text);
    container.appendChild(div);
    setTimeout(() => {
      if (!div.parentNode) return;
      div.classList.add('toast--leaving');
      setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, TOAST_EXIT_MS);
    }, TOAST_VISIBLE_MS);
  }

  // ---------- inline HUD styles ----------

  const STYLE = `
    .hud-bar {
      position: fixed; left: 24px;
      width: 240px;
      border: 1px solid rgba(184,170,145,0.45);
      background: rgba(241,229,207,0.88);
      border-radius: 3px; overflow: hidden;
      font-family: 'Segoe UI', system-ui, sans-serif;
      pointer-events: none;
      z-index: 20;
    }
    #hud-health { bottom: 60px; height: 18px; }
    #hud-stamina { bottom: 36px; height: 14px; }
    .hud-bar .trail-fill, .hud-bar .live-fill {
      position: absolute; left: 0; top: 0; bottom: 0;
    }
    #hud-health .trail-fill { background: #6b1010; width: 100%; }
    #hud-health .live-fill { background: #ce2424; width: 100%; transition: width 0.05s linear; }
    #hud-stamina .trail-fill { background: #133a73; width: 100%; }
    #hud-stamina .live-fill { background: #1f8fff; width: 100%; transition: width 0.05s linear; }
    .hud-bar .numbers {
      position: absolute; left: 0; right: 0; top: 50%;
      transform: translateY(-50%);
      text-align: center; font-weight: 700;
      color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.75);
    }
    #hud-health .numbers { font-size: 12px; }
    #hud-stamina .numbers { font-size: 11px; }

    /* Crosshair: 24px wide cross of two thin white lines + a 4px centre
       dot, all with a subtle black outline so it's visible on bright AND
       dark backgrounds. */
    #hud-crosshair {
      position: fixed; left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      width: 24px; height: 24px;
      pointer-events: none;
      z-index: 20;
    }
    #hud-crosshair::before,
    #hud-crosshair::after {
      content: ''; position: absolute;
      background: #fff;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.6);
    }
    /* Horizontal bar */
    #hud-crosshair::before {
      left: 0; right: 0; top: 50%;
      height: 2px; transform: translateY(-50%);
    }
    /* Vertical bar */
    #hud-crosshair::after {
      top: 0; bottom: 0; left: 50%;
      width: 2px; transform: translateX(-50%);
    }
    /* Centre dot via the parent's background */
    #hud-crosshair {
      background: radial-gradient(circle at center,
        #fff 0 2px,
        transparent 3px 100%);
    }
    #hud-crosshair.hidden { display: none; }
  `;

  function buildChrome() {
    if (document.getElementById('hud-chrome')) return;

    const style = document.createElement('style');
    style.id = 'hud-inline-styles';
    style.textContent = STYLE;
    document.head.appendChild(style);

    const chrome = el('div', { id: 'hud-chrome' });
    const prompt = el('div', { class: 'interaction-prompt', id: 'interaction-prompt', style: 'display:none;' }, '');
    chrome.appendChild(prompt);
    document.body.appendChild(chrome);

    document.body.appendChild(el('div', { id: 'toast-container' }));

    // Debug pip — proves hud.js ran. Click-through, top-right corner.
    document.body.appendChild(el('div', {
      id: 'hud-debug-pip',
      style: 'position:fixed; right:8px; top:8px; padding:4px 8px; '
           + 'background:#0f0; color:#000; font:11px monospace; '
           + 'font-weight:700; border:2px solid #000; '
           + 'pointer-events:none; z-index:9999;',
    }, 'HUD ' + new Date().toLocaleTimeString()));

    // Health bar
    document.body.appendChild(el('div', { id: 'hud-health', class: 'hud-bar' },
      el('div', { class: 'trail-fill' }),
      el('div', { class: 'live-fill' }),
      el('div', { class: 'numbers' }, '— / —')));

    // Stamina bar
    document.body.appendChild(el('div', { id: 'hud-stamina', class: 'hud-bar' },
      el('div', { class: 'trail-fill' }),
      el('div', { class: 'live-fill' }),
      el('div', { class: 'numbers' }, '— / —')));

    // Crosshair
    document.body.appendChild(el('div', { id: 'hud-crosshair' }));
  }

  // ---------- bars ----------

  function attachBar(rootId, attrChannel, opts) {
    const root = document.getElementById(rootId);
    if (!root) return;
    const trail = root.querySelector('.trail-fill');
    const live  = root.querySelector('.live-fill');
    const nums  = root.querySelector('.numbers');

    let current = 1, max = 1;
    let liveN = 1, trailN = 1;
    let lastDecayTime = -1e9;
    let prevTarget = 1;

    function applyAttr(p) {
      if (!p) return;
      current = Number(p.current) || 0;
      max     = Number(p.max) || 1;
      if (opts.decayOnDecrease) {
        const target = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
        if (target < prevTarget - 1e-4) {
          lastDecayTime = performance.now() / 1000;
        }
        prevTarget = target;
      }
    }

    function onDamage(p) {
      if (!p) return;
      lastDecayTime = performance.now() / 1000;
    }

    let last = performance.now() / 1000;
    function frame() {
      const now = performance.now() / 1000;
      const dt = Math.max(0, now - last);
      last = now;

      const target = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
      if (target > liveN) trailN = Math.max(trailN, target);
      liveN = target;

      if ((now - lastDecayTime) >= opts.delay) {
        const step = opts.decayRate * dt;
        if (trailN > liveN) trailN = Math.max(liveN, trailN - step);
      }
      if (trailN < liveN) trailN = liveN;

      if (trail) trail.style.width = (trailN * 100).toFixed(1) + '%';
      if (live)  live.style.width  = (liveN  * 100).toFixed(1) + '%';
      if (nums)  nums.textContent  = Math.round(current) + ' / ' + Math.round(max);
      requestAnimationFrame(frame);
    }

    tsic.on(attrChannel, applyAttr);
    if (opts.damageChannel) tsic.on(opts.damageChannel, onDamage);
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------

  function whenReady(cb) {
    if (window.tsic && document.body) { cb(); return; }
    setTimeout(() => whenReady(cb), 16);
  }

  whenReady(() => {
    buildChrome();

    // Interaction prompt — primary target's label.
    tsic.on('tsic.msg.UI.Interaction.Targets', (p) => {
      const el = document.getElementById('interaction-prompt');
      if (!el) return;
      const target = p && p.Targets && p.Targets.find(t => t.bIsPrimary);
      if (target) { el.textContent = target.Label || 'Interact'; el.style.display = ''; }
      else { el.style.display = 'none'; }
    });

    // Toasts.
    tsic.on('tsic.msg.UI.Toast.Show', showToast);

    // Health + stamina bars (live attribute bridges; sticky).
    attachBar('hud-health', 'tsic.attr.player.health', {
      delay: 2.0, decayRate: 0.2, damageChannel: 'tsic.msg.Message.DamageEvent',
    });
    attachBar('hud-stamina', 'tsic.attr.player.stamina', {
      delay: 1.0, decayRate: 0.3, decayOnDecrease: true,
    });

    // Crosshair visibility — hide when an HTML screen takes over the cursor.
    tsic.on('tsic.msg.UI.Input.Mode.Changed', (p) => {
      const dot = document.getElementById('hud-crosshair');
      if (!dot || !p) return;
      const isMenuMode = String(p.Device || '') === 'mouse' && String(p.Focus || '') === 'ui';
      dot.classList.toggle('hidden', isMenuMode);
    });
  });
})();
