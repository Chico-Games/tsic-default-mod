// shared/hud-stomach.js — In-game HUD stomach (digesting-food slots).
//
// Lives in the combined HUD just right of the health + stamina vials. Shows the
// player's stomach contents; each item's icon dims as it digests. Loaded by
// hud.js into the #hud-stomach shell; screens/stomach.html hosts the same live
// component via a thin fixture.
//
// Channel: tsic.msg.UI.Stomach.State
//   { Slots: [ { ItemId, IconUrl, Duration, RemainingTime } ] }   (full capacity, incl. empties)
//
// No always-on animation — it re-renders only when a state message arrives, so
// it costs nothing while the stomach is static. The icon's digestion fade is a
// per-message opacity, smoothed by a short CSS transition.
(function () {
  // Slot frame matches the hotbar plinths: dark glass, heavy ink outline, hard
  // offset block shadow. Empty slots read as faded capacity markers.
  var CSS = [
    '#hud-stomach { display:flex; flex-direction:column-reverse; gap:6px; }',
    '#hud-stomach .stomach-slot { position:relative; width:42px; height:42px; border:2px solid var(--ink-night); border-radius:8px;',
    '  background: linear-gradient(180deg, rgba(58,40,34,0.62), rgba(14,9,8,0.70));',
    '  box-shadow: inset 0 1px 0 rgba(255,250,240,0.14), var(--shadow-block-sm);',
    '  display:flex; align-items:center; justify-content:center; overflow:hidden; }',
    // Empty slots show a faint stomach silhouette (MDI, Apache-2.0; see
    // /icons/stomach.svg) as a placeholder, dropped once an item fills the slot.
    '#hud-stomach .stomach-slot.empty { background-color: rgba(14,9,8,0.30); border-color: rgba(10,10,10,0.5); box-shadow:none;',
    '  background-image: url("/icons/stomach.svg"); background-repeat:no-repeat; background-position:center; background-size:60%; }',
    '#hud-stomach .stomach-slot img { width:100%; height:100%; object-fit:contain; padding:5px; pointer-events:none;',
    '  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); transition: opacity 200ms linear; }',
    // Digestion meter — a vertical fill over the icon (Overwatch-cooldown style,
    // reversed): full the instant the food is eaten, draining bottom-ward to empty
    // as it digests. The bright top band is the "level" edge. Driven by a CSS
    // scaleY transition (transform_origin bottom) so it animates on the compositor.
    '#hud-stomach .stomach-slot .digest { position:absolute; inset:0; transform-origin:bottom center; pointer-events:none; will-change:transform;',
    '  background: linear-gradient(180deg, rgba(255,236,188,0.70) 0 5%, rgba(170,92,34,0.30) 16%, rgba(96,44,14,0.42) 100%); }',
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('hud-stomach-styles')) return;
    var s = document.createElement('style');
    s.id = 'hud-stomach-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function iconUrlFor(s) {
    if (s.IconUrl) return s.IconUrl;
    if (s.ItemId && window.TSIC && TSIC.itemIconUrl) return TSIC.itemIconUrl(s.ItemId);
    return '';
  }

  function render(payload) {
    var host = document.getElementById('hud-stomach');
    if (!host) return;
    var slots = (payload && payload.Slots) || [];
    host.innerHTML = '';
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i] || {};
      var url = iconUrlFor(s);
      var occupied = !!(s.ItemId && url);
      var dur = Number(s.Duration) || 0;
      var rem = Number(s.RemainingTime) || 0;
      var progress = dur > 0 ? Math.max(0, Math.min(1, 1 - rem / dur)) : 0;  // digested fraction
      var slot = document.createElement('div');
      slot.className = 'stomach-slot' + (occupied ? '' : ' empty');
      if (occupied) {
        var img = document.createElement('img');
        img.src = url;
        img.onerror = (function (im) { return function () { im.style.visibility = 'hidden'; }; })(img);
        // Digestion fade — dims toward 0.4 (never fully gone before the slot clears).
        img.style.opacity = String(lerp(1.0, 0.4, progress));
        slot.appendChild(img);
      }
      host.appendChild(slot);

      // Draining digestion meter — set the fill to the current remaining fraction,
      // then animate it to empty over the remaining real time (linear). Re-syncs
      // on every state message, so server corrections just retarget the drain.
      if (occupied && dur > 0 && rem > 0) {
        var digest = document.createElement('div');
        digest.className = 'digest';
        digest.style.transform = 'scaleY(' + (1 - progress).toFixed(4) + ')';
        slot.appendChild(digest);
        void digest.offsetHeight;                                  // commit start state
        digest.style.transition = 'transform ' + rem.toFixed(2) + 's linear';
        digest.style.transform = 'scaleY(0)';
      }
    }
  }

  (function boot() {
    if (!window.tsic || typeof tsic.on !== 'function') { setTimeout(boot, 16); return; }
    injectStyles();
    tsic.on('tsic.msg.UI.Stomach.State', render);
  })();
})();
