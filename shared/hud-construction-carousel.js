// shared/hud-construction-carousel.js — Construction HUD carousel (bottom strip).
//
// This is the ONE and ONLY renderer of the in-game construction carousel — the
// bottom-centre strip showing the currently-selected buildable plus up to four
// neighbours on each side. hud.js loads it on the InGame screen; tests host it
// via /screens/construction-carousel.html (a thin fixture that just loads this).
// Do NOT re-implement this rendering inline in an HTML page.
//
// Slots are projected from the construct ability's prev/current/next definition
// lists by UGameplayAbility_Construct::BroadcastUIConstructionCarousel (C++) and
// arrive on UI.Construction.Carousel. The ability re-broadcasts every build tick
// and clears the strip (empty Current) on EndAbility so this hides on exit.
//
// Builds its own #hud-construction-carousel root (inner #cc-row / #cc-rotation /
// #cc-blocked) so it is self-sufficient on both the live HUD and the test page.
(function () {
  var STYLE = [
    '#hud-construction-carousel { position:fixed; left:50%; bottom:96px; transform:translateX(-50%); pointer-events:none; z-index:20; }',
    '#hud-construction-carousel.hidden { display:none; }',
    '#cc-row { display:flex; align-items:center; gap:6px; padding:8px 12px; }',
    '.cc-slot { width:56px; height:56px; background:rgba(20,18,14,0.55); border:1px solid rgba(184,170,145,0.45); display:flex; align-items:center; justify-content:center; font-size:9px; color:rgba(226,232,240,0.5); position:relative; }',
    '.cc-slot img { max-width:80%; max-height:80%; object-fit:contain; }',
    '.cc-slot.current { background:rgba(20,18,14,0.78); transform:scale(1.12); border-color:var(--tsic-accent); }',
    // Unaffordable: dim the icon instead of washing the slot red — keeps the
    // strip reading as plain icons like the rest of the HUD.
    '.cc-slot.unafford img { opacity:0.45; }',
    // Empty-state hint shown while build mode is active but nothing is buildable.
    // Styled like the rotation caption below; collapses to nothing when blank.
    '#cc-empty { color:#cbd5e1; font-size:12px; letter-spacing:2px; padding:8px 14px; text-align:center; text-shadow:0 1px 2px rgba(0,0,0,0.75); }',
    '#cc-empty:empty { display:none; }',
    '#cc-rotation { color:#cbd5e1; font-size:11px; letter-spacing:2px; margin-top:4px; text-align:center; text-shadow:0 1px 2px rgba(0,0,0,0.75); }',
    '#cc-blocked { color:#fca5a5; font-size:11px; letter-spacing:2px; margin-top:4px; text-align:center; text-shadow:0 1px 2px rgba(0,0,0,0.75); }',
    'body.hud-hidden #hud-construction-carousel { display:none !important; }',
  ].join('\n');

  function injectStyleOnce() {
    if (document.getElementById('hud-construction-carousel-style')) return;
    var s = document.createElement('style');
    s.id = 'hud-construction-carousel-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function ensureRoot() {
    var root = document.getElementById('hud-construction-carousel');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'hud-construction-carousel';
    root.className = 'hidden';
    root.innerHTML = '<div id="cc-row"></div><div id="cc-empty"></div><div id="cc-rotation"></div><div id="cc-blocked"></div>';
    document.body.appendChild(root);
    return root;
  }

  function iconUrlFor(s) {
    if (s && s.IconUrl) return s.IconUrl;
    if (!s || !s.FurnitureId) return '';
    return TSIC.itemIconUrl(s.FurnitureId);
  }

  function slotEl(s, isCurrent) {
    var div = document.createElement('div');
    div.className = 'cc-slot' + (isCurrent ? ' current' : '') + (s && s.bAffordable === false ? ' unafford' : '');
    if (s) div.title = s.Label || s.FurnitureId || '';
    // The C++ /tex/item-icon resolver serves the real thumbnail, or the in-data
    // fallback thumbnail when a furniture def has no icon — so we just request it
    // and let iconImg ride out the cold-cache 404 with retries. On terminal
    // failure iconImg hides the <img>, leaving the empty slot box. No client cube.
    var url = iconUrlFor(s);
    if (url) {
      var img = (window.TSIC && typeof TSIC.iconImg === 'function')
        ? TSIC.iconImg(url)
        : (function () { var i = document.createElement('img'); i.src = url; return i; })();
      div.appendChild(img);
    }
    return div;
  }

  // Signature of everything the strip renders, so an unchanged re-broadcast does
  // not rebuild the row (which would re-fetch every icon and flicker). Mirrors the
  // C++ dedupe in UGameplayAbility_Construct::BroadcastUIConstructionCarousel.
  function slotSig(s) {
    return (s && s.FurnitureId || '') + '|' + (s && s.bAffordable === false ? '0' : '1') + ';';
  }
  function carouselSignature(p) {
    var parts = [];
    (p.Prev || []).slice(0, 4).forEach(function (s) { parts.push(slotSig(s)); });
    parts.push('>' + slotSig(p.Current));
    (p.Next || []).slice(0, 4).forEach(function (s) { parts.push(slotSig(s)); });
    parts.push((p.RotationAxis || '') + '|' + (p.BlockedReason || ''));
    return parts.join('');
  }
  var lastSignature = null;

  function boot() {
    if (!window.tsic || typeof tsic.on !== 'function') { setTimeout(boot, 16); return; }
    injectStyleOnce();
    ensureRoot();

    tsic.on('tsic.msg.UI.Construction.Carousel', function (p) {
      var root = ensureRoot();
      var row = document.getElementById('cc-row');
      var rot = document.getElementById('cc-rotation');
      var blk = document.getElementById('cc-blocked');
      var empty = document.getElementById('cc-empty');
      if (!row) return;

      // bActive is the single source of truth for visibility. EndAbility
      // broadcasts an empty payload with bActive=false to hide the strip; an
      // active build with nothing to place keeps it visible (with a hint), so we
      // must NOT key visibility off an empty Current the way we used to.
      if (!p || !p.bActive) {
        row.innerHTML = '';
        rot.textContent = '';
        blk.textContent = '';
        if (empty) empty.textContent = '';
        root.classList.add('hidden');
        lastSignature = null;
        return;
      }

      // Skip the rebuild when nothing the strip renders changed. The C++ side
      // already dedupes per-tick broadcasts, but this also absorbs any duplicate
      // delivery so the icons never re-fetch (and flash) on an identical payload.
      var signature = carouselSignature(p);
      if (signature === lastSignature && !root.classList.contains('hidden')) {
        return;
      }
      lastSignature = signature;

      row.innerHTML = '';
      var hasCurrent = !!(p.Current && p.Current.FurnitureId);
      if (hasCurrent) {
        var prev = (p.Prev || []).slice(0, 4).reverse();   // closest-to-current first
        var next = (p.Next || []).slice(0, 4);
        for (var i = 0; i < prev.length; i++) row.appendChild(slotEl(prev[i], false));
        row.appendChild(slotEl(p.Current, true));
        for (var j = 0; j < next.length; j++) row.appendChild(slotEl(next[j], false));
        if (empty) empty.textContent = '';
      } else if (empty) {
        // Active build mode but nothing constructable — keep the strip on screen.
        empty.textContent = 'Nothing to build';
      }
      rot.textContent = p.RotationAxis ? 'ROTATION: ' + p.RotationAxis : '';
      blk.textContent = p.BlockedReason ? p.BlockedReason.toUpperCase() : '';
      root.classList.remove('hidden');
    });
  }

  boot();
})();
