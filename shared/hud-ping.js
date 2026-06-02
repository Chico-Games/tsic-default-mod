// shared/hud-ping.js — In-game ping composer wheel (overlay).
//
// Apex-style radial wheel rendered into the #ping-shell overlay built by
// hud.js. Hidden by default (body.hud-show-ping reveals it) so the real HUD
// only shows it on demand; the combined preview's "Ping wheel" toggle flips
// that class. Mirrors screens/ping.html (the standalone modal screen).
//
// Publishes: UI.Cmd.Ping.Request { PingType, Location }
(function () {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const SIZE = 360, C = 180, R_OUT = 168, R_IN = 78, GAP = 2.6;
  const R_LABEL = (R_OUT + R_IN) / 2;

  // CSS scoped under #ping-shell so it can't collide with the rest of the HUD.
  // display on #ping-shell is owned by hud.js (default none / hud-show-ping).
  const CSS = [
    '#ping-shell { position:fixed; inset:0; align-items:center; justify-content:center; pointer-events:auto;',
    '  background: radial-gradient(circle at 50% 50%, rgba(6,7,10,0) 18%, rgba(6,7,10,0.42) 78%);',
    '  animation: ping-scrim-in 160ms ease both; }',
    '@keyframes ping-scrim-in { from { opacity:0; } to { opacity:1; } }',
    '#ping-wheel { position:relative; width:360px; height:360px; transform-origin:center; animation: ping-wheel-in 280ms cubic-bezier(0.34,1.56,0.64,1) both; }',
    '@keyframes ping-wheel-in { from { opacity:0; transform:scale(0.72) rotate(-6deg); } to { opacity:1; transform:scale(1) rotate(0); } }',
    '.ping-glass { position:absolute; left:50%; top:50%; width:340px; height:340px; margin:-170px 0 0 -170px; border-radius:50%;',
    '  background: rgba(14,14,18,0.34);',
    '  box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 46px rgba(0,0,0,0.45), 0 12px 44px rgba(0,0,0,0.45); }',
    '#ping-svg { position:absolute; inset:0; overflow:visible; }',
    '.ping-wedge { fill: rgba(236,236,240,0.05); stroke: rgba(255,255,255,0.14); stroke-width:1.5; transform-origin:180px 180px;',
    '  transition: fill 150ms ease, stroke 150ms ease, filter 150ms ease; opacity:0; animation: ping-piece-in 300ms cubic-bezier(0.22,0.85,0.28,1) forwards; }',
    '@keyframes ping-piece-in { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }',
    '.ping-wedge.is-active { fill: var(--c-soft); stroke: var(--c); filter: drop-shadow(0 0 12px var(--c)); }',
    '.ping-item { position:absolute; width:32px; height:32px; transform:translate(-50%,-50%) scale(1); pointer-events:none; color:#e7e2d4;',
    '  transition: transform 150ms cubic-bezier(0.34,1.56,0.64,1), color 150ms ease; opacity:0; animation: ping-item-in 300ms ease forwards; }',
    '@keyframes ping-item-in { from { opacity:0; } to { opacity:1; } }',
    '@keyframes ping-pop-in { from { transform:scale(0.55); } to { transform:scale(1); } }',
    '.ping-item svg { width:32px; height:32px; display:block; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.65)); animation: ping-pop-in 320ms cubic-bezier(0.34,1.56,0.64,1) both; }',
    '.ping-item .ping-lbl { position:absolute; top:calc(100% + 5px); left:50%; transform:translateX(-50%); white-space:nowrap;',
    '  font-family: var(--font-display); font-size:12px; font-weight:700; letter-spacing:0.16em; text-shadow:0 1px 2px rgba(0,0,0,0.85); }',
    '.ping-item.is-active { transform:translate(-50%,-50%) scale(1.18); color:#fff; }',
    '.ping-item.is-active svg { filter: drop-shadow(0 0 8px var(--c)) drop-shadow(0 1px 2px rgba(0,0,0,0.7)); }',
    '#ping-hub { position:absolute; left:50%; top:50%; width:132px; height:132px; margin:-66px 0 0 -66px; border-radius:50%;',
    '  display:flex; align-items:center; justify-content:center; text-align:center; background: rgba(11,11,15,0.62);',
    '  border:1px solid rgba(255,255,255,0.12);',
    '  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 6px 22px rgba(0,0,0,0.5); color:#cfcabb;',
    '  font-family: var(--font-display); font-size:15px; font-weight:700; letter-spacing:0.24em;',
    '  transition: color 150ms ease, box-shadow 150ms ease, border-color 150ms ease; pointer-events:none; }',
    '#ping-hub.is-active { color: var(--c); border-color: var(--c); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 0 24px var(--c), 0 6px 22px rgba(0,0,0,0.5); }',
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('hud-ping-styles')) return;
    const s = document.createElement('style');
    s.id = 'hud-ping-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const TYPES = [
    { id: 'Enemy',  label: 'ENEMY',  color: '#ff5a5a', icon: 'enemy'  },
    { id: 'Entity', label: 'LOOT',   color: '#3ddc97', icon: 'loot'   },
    { id: 'Ground', label: 'MOVE',   color: '#4ea1ff', icon: 'move'   },
    { id: 'Map',    label: 'DANGER', color: '#ffc63f', icon: 'danger' },
  ];
  const ICONS = {
    enemy:  '<circle cx="12" cy="12" r="7"/><path d="M12 1.5v3.5M12 19v3.5M1.5 12h3.5M19 12h3.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    loot:   '<path d="M12 2.4 21.6 12 12 21.6 2.4 12Z"/><path d="M7.6 12 12 7.6 16.4 12 12 16.4Z"/>',
    move:   '<path d="M5 13.5 12 6.5 19 13.5"/><path d="M5 18.5 12 11.5 19 18.5"/>',
    danger: '<path d="M12 3 22 20 2 20Z"/><path d="M12 9v5"/><circle cx="12" cy="17.4" r="1.05" fill="currentColor" stroke="none"/>',
  };

  function iconSvg(name) {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.innerHTML = ICONS[name] || '';
    return s;
  }

  const rad = (d) => d * Math.PI / 180;
  const pol = (r, d) => [C + r * Math.cos(rad(d)), C + r * Math.sin(rad(d))];
  function sectorPath(a0, a1) {
    const [x0o, y0o] = pol(R_OUT, a0), [x1o, y1o] = pol(R_OUT, a1);
    const [x1i, y1i] = pol(R_IN, a1),  [x0i, y0i] = pol(R_IN, a0);
    const large = (a1 - a0) > 180 ? 1 : 0;
    return `M ${x0o} ${y0o} A ${R_OUT} ${R_OUT} 0 ${large} 1 ${x1o} ${y1o}`
         + ` L ${x1i} ${y1i} A ${R_IN} ${R_IN} 0 ${large} 0 ${x0i} ${y0i} Z`;
  }
  function softFill(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0.30)`;
  }

  const wedges = [];
  let active = -1;
  const N = TYPES.length;
  const SPAN = 360 / N;
  const centreDeg = (i) => -90 + i * SPAN;

  function publish(type) {
    if (window.tsic && window.tsic.publishMessage) {
      tsic.publishMessage('UI.Cmd.Ping.Request', { PingType: type, Location: { X: 0, Y: 0, Z: 0 } });
    }
  }

  function build(shell) {
    const wheel = document.createElement('div');
    wheel.id = 'ping-wheel';
    wheel.appendChild(Object.assign(document.createElement('div'), { className: 'ping-glass' }));

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.id = 'ping-svg';
    svg.setAttribute('viewBox', '0 0 360 360');
    wheel.appendChild(svg);

    const hub = document.createElement('div');
    hub.id = 'ping-hub';
    hub.textContent = 'PING';
    wheel.appendChild(hub);

    for (let i = 0; i < N; i++) {
      const t = TYPES[i];
      const cd = centreDeg(i);
      const path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('class', 'ping-wedge');
      path.setAttribute('d', sectorPath(cd - SPAN / 2 + GAP / 2, cd + SPAN / 2 - GAP / 2));
      path.style.setProperty('--c', t.color);
      path.style.setProperty('--c-soft', softFill(t.color));
      path.style.animationDelay = (40 + i * 45) + 'ms';
      svg.appendChild(path);

      const [lx, ly] = pol(R_LABEL, cd);
      const item = document.createElement('div');
      item.className = 'ping-item';
      item.style.left = lx + 'px';
      item.style.top = ly + 'px';
      item.style.setProperty('--c', t.color);
      item.style.animationDelay = (90 + i * 45) + 'ms';
      item.appendChild(iconSvg(t.icon));
      const lbl = document.createElement('div');
      lbl.className = 'ping-lbl';
      lbl.textContent = t.label;
      item.appendChild(lbl);
      wheel.appendChild(item);

      wedges.push({ path, item, type: t });
    }
    shell.appendChild(wheel);
  }

  function setActive(idx) {
    if (idx === active) return;
    active = idx;
    const hub = document.getElementById('ping-hub');
    wedges.forEach((w, i) => {
      w.path.classList.toggle('is-active', i === idx);
      w.item.classList.toggle('is-active', i === idx);
    });
    if (!hub) return;
    if (idx >= 0) {
      hub.textContent = TYPES[idx].label;
      hub.style.setProperty('--c', TYPES[idx].color);
      hub.classList.add('is-active');
    } else {
      hub.textContent = 'PING';
      hub.classList.remove('is-active');
    }
  }

  function pickAt(clientX, clientY) {
    const wheel = document.getElementById('ping-wheel');
    if (!wheel) return -1;
    const r = wheel.getBoundingClientRect();
    const scale = r.width / SIZE || 1;
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < R_IN * 0.55 * scale) return -1;
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;
    for (let i = 0; i < N; i++) {
      let diff = ang - centreDeg(i);
      diff = ((diff + 180) % 360 + 360) % 360 - 180;
      if (Math.abs(diff) <= SPAN / 2) return i;
    }
    return -1;
  }

  function boot() {
    if (!window.tsic || typeof tsic.on !== 'function') { setTimeout(boot, 16); return; }
    const shell = document.getElementById('ping-shell');
    if (!shell) { setTimeout(boot, 16); return; }
    injectStyles();
    build(shell);
    shell.addEventListener('pointermove', (e) => setActive(pickAt(e.clientX, e.clientY)));
    shell.addEventListener('pointerdown', (e) => {
      const idx = pickAt(e.clientX, e.clientY);
      if (idx >= 0) publish(TYPES[idx].id);
    });
  }
  boot();
})();
