// shared/hud-voice.js — Voice chat speaking indicator.
//
// Loaded by hud.js into the #hud-voice shell. Shows a pulsing "TALKING" chip
// while the local player's mic is open (push-to-talk held / toggle latched)
// and one row per remote player currently transmitting.
//
// Channel: tsic.msg.UI.VoiceChat.State — { Speaking: [names], bSelfPushToTalk }.
(function () {
  var CSS = [
    '#hud-voice { position:fixed; left:24px; top:24px; font-size:11px; pointer-events:none; z-index:20; }',
    '#vc-self { display:none; align-items:center; gap:6px; padding:4px 8px; background:rgba(220,38,38,0.5);',
    '  border-radius:3px; margin-bottom:4px; letter-spacing:1px; color:#fff; font-weight:700; }',
    '#vc-self.on { display:inline-flex; }',
    '#vc-self .vc-mic { display:inline-block; width:8px; height:8px; border-radius:50%; background:#fff;',
    '  animation: vc-pulse 800ms ease-in-out infinite alternate; }',
    '@keyframes vc-pulse { from { background: rgba(255,255,255,0.35); } to { background: #fff; } }',
    '@media (prefers-reduced-motion: reduce) { #vc-self .vc-mic { animation:none; } }',
    '#vc-list { display:flex; flex-direction:column; gap:2px; }',
    '#vc-list .vc-row { padding:2px 8px; background:rgba(241,229,207,0.88); border-left:2px solid #4ade80;',
    '  color:#2b2118; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
  ].join('\n');

  var root = null;
  var selfChip = null;
  var list = null;

  function injectStyles() {
    if (document.getElementById('hud-voice-styles')) return;
    var s = document.createElement('style');
    s.id = 'hud-voice-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function build() {
    root = document.getElementById('hud-voice');
    if (!root) return false;
    selfChip = TSIC.el('div', { id: 'vc-self' },
      TSIC.el('span', { class: 'vc-mic' }), 'TALKING');
    list = TSIC.el('div', { id: 'vc-list' });
    root.appendChild(selfChip);
    root.appendChild(list);
    return true;
  }

  function onState(p) {
    if (!root) return;
    selfChip.classList.toggle('on', !!(p && p.bSelfPushToTalk));
    var speaking = (p && p.Speaking) || [];
    while (list.firstChild) list.removeChild(list.firstChild);
    for (var i = 0; i < speaking.length; i++) {
      list.appendChild(TSIC.el('div', { class: 'vc-row' }, String(speaking[i])));
    }
  }

  (function boot() {
    if (!window.tsic || !window.TSIC || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
    injectStyles();
    if (!build()) { setTimeout(boot, 16); return; }
    tsic.whenReady(function () {
      tsic.on('tsic.msg.UI.VoiceChat.State', onState);
    });
  })();
})();
