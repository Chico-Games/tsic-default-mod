// shared/hud-station-tip.js — the short label by a station's in-world status dot.
//
// Driven by UI.StationTip.State { bActive, Text, Status, Color, X, Y } from the local player's
// UOpenableIndicatorComponent while the crosshair is on a station (or its container view is
// open): "Needs: 2 × Plank", "Hold to Saw", "Cook 40%", "Output full", "Burning!". X/Y are the
// dot on screen as a fraction of the viewport; the label sits just above it, edged in the dot's
// colour. Mounted on <body>, not a HUD shell, because it shows over the basket screen too.
(function () {
  const CSS = [
    '#hud-station-tip { position:fixed; left:0; top:0; transform:translate(-50%, calc(-100% - 14px)) scale(0.96);',
    '  pointer-events:none; z-index:8990; opacity:0; white-space:nowrap;',
    '  font:600 13px/1.2 var(--font-ui, sans-serif); letter-spacing:0.02em; color:#f4ecdc;',
    '  padding:4px 9px; border-radius:6px; background:rgba(18,16,14,0.78);',
    '  border:1px solid var(--st-color,#f1e5cf); box-shadow:0 1px 4px rgba(0,0,0,0.55);',
    '  transition:opacity 120ms ease, transform 140ms ease; }',
    '#hud-station-tip.active { opacity:1; transform:translate(-50%, calc(-100% - 14px)) scale(1); }',
    '#hud-station-tip[data-status="burning"] { color:#ffd9d4; }',
    'html[data-tsic-reduce-motion] #hud-station-tip { transition:opacity 120ms ease; }',
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('hud-station-tip-styles')) return;
    const s = document.createElement('style');
    s.id = 'hud-station-tip-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  let tip = null;
  function ensureTip() {
    if (tip && tip.isConnected) return tip;
    tip = document.getElementById('hud-station-tip') || TSIC.el('div', { id: 'hud-station-tip' });
    if (!tip.isConnected) document.body.appendChild(tip);
    return tip;
  }

  injectStyles();
  tsic.on('tsic.msg.UI.StationTip.State', function (p) {
    const el = ensureTip();
    const active = !!(p && p.bActive);
    el.classList.toggle('active', active);
    if (!active) return;
    const text = String(p.Text || '');
    if (el.textContent !== text) el.textContent = text;
    el.dataset.status = String(p.Status || '');
    if (p.Color) el.style.setProperty('--st-color', String(p.Color));
    el.style.left = ((Number(p.X) || 0.5) * 100) + 'vw';
    el.style.top = ((Number(p.Y) || 0.5) * 100) + 'vh';
  });
})();
