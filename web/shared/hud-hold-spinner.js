// shared/hud-hold-spinner.js — the hold-to-craft spinner at the cursor.
//
// Driven by UI.HoldSpinner.State { bActive, Progress 0..1, X, Y } from the 3D container view
// while a station's trigger is held (spec §11.3): 1 s for instant stations, the recipe's time
// for attended ones. X/Y are the cursor as a fraction of the viewport. The view publishes it
// every frame of the hold and bActive:false when the hold ends, the work is refused, or the
// craft finishes. Mounted on <body>, not a HUD shell, because it shows over the basket screen.
(function () {
  const CSS = [
    '#hud-hold-spinner { position:fixed; left:0; top:0; width:44px; height:44px; margin:-22px 0 0 -22px; border-radius:50%;',
    '  pointer-events:none; z-index:9000; opacity:0; transform:scale(0.8);',
    '  background:conic-gradient(var(--hs-color,#f1e5cf) calc(var(--hs-p,0) * 1%), rgba(241,229,207,0.25) 0);',
    '  mask:radial-gradient(circle, transparent 15px, #000 16px); -webkit-mask:radial-gradient(circle, transparent 15px, #000 16px);',
    '  filter:drop-shadow(0 1px 3px rgba(0,0,0,0.6)); transition:opacity 120ms ease, transform 160ms cubic-bezier(0.2,0.9,0.3,1.2); }',
    '#hud-hold-spinner.active { opacity:1; transform:scale(1); }',
    'html[data-tsic-reduce-motion] #hud-hold-spinner { transition:opacity 120ms ease; transform:none; }',
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('hud-hold-spinner-styles')) return;
    const s = document.createElement('style');
    s.id = 'hud-hold-spinner-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  let ring = null;
  function ensureRing() {
    if (ring && ring.isConnected) return ring;
    ring = document.getElementById('hud-hold-spinner') || TSIC.el('div', { id: 'hud-hold-spinner' });
    if (!ring.isConnected) document.body.appendChild(ring);
    return ring;
  }

  injectStyles();
  tsic.on('tsic.msg.UI.HoldSpinner.State', function (p) {
    const el = ensureRing();
    const active = !!(p && p.bActive);
    el.classList.toggle('active', active);
    if (!active) return;
    const pct = Math.max(0, Math.min(100, (Number(p.Progress) || 0) * 100));
    el.style.setProperty('--hs-p', String(pct));
    el.style.left = ((Number(p.X) || 0.5) * 100) + 'vw';
    el.style.top = ((Number(p.Y) || 0.5) * 100) + 'vh';
  });
})();
