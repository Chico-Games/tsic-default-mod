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
    '#cc-row { display:flex; align-items:center; gap:6px; padding:8px 12px; background:rgba(241,229,207,0.92); border-radius:6px; border:1px solid var(--tsic-border); }',
    '.cc-slot { width:56px; height:56px; background:rgba(241,229,207,0.48); border:1px solid var(--tsic-border); display:flex; align-items:center; justify-content:center; font-size:9px; color:rgba(108,94,73,0.55); position:relative; }',
    '.cc-slot img { max-width:80%; max-height:80%; object-fit:contain; }',
    '.cc-slot.current { background:rgba(241,229,207,0.88); color:var(--cat-ink-soft); transform:scale(1.12); border-color:var(--tsic-accent); }',
    '.cc-slot.unafford::after { content:\'\'; position:absolute; inset:0; background:rgba(220,38,38,0.18); pointer-events:none; }',
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
    root.innerHTML = '<div id="cc-row"></div><div id="cc-rotation"></div><div id="cc-blocked"></div>';
    document.body.appendChild(root);
    return root;
  }

  // Generic box glyph shown when a slot has no renderable icon. Furniture
  // definitions don't expose icon assets yet, so /tex/item-icon/<id> 404s for
  // most — this is the expected, common case.
  var FALLBACK_ICON =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' " +
    "stroke='%236c5e49' stroke-width='1.5' stroke-linejoin='round'%3E" +
    "%3Cpath d='M3 7l9-4 9 4v10l-9 4-9-4V7z'/%3E%3Cpath d='M3 7l9 4 9-4M12 11v10'/%3E%3C/svg%3E";

  function iconUrlFor(s) {
    if (s && s.IconUrl) return s.IconUrl;
    if (!s || !s.FurnitureId) return FALLBACK_ICON;
    if (window.TSIC && typeof TSIC.itemIconUrl === 'function') return TSIC.itemIconUrl(s.FurnitureId);
    return '/tex/item-icon/' + encodeURIComponent(s.FurnitureId);
  }

  function slotEl(s, isCurrent) {
    var div = document.createElement('div');
    div.className = 'cc-slot' + (isCurrent ? ' current' : '') + (s && s.bAffordable === false ? ' unafford' : '');
    if (s) div.title = s.Label || s.FurnitureId || '';
    // Always render an icon: real thumbnail if the asset endpoint resolves,
    // otherwise swap to the box fallback so empty slots still read as items.
    var img = document.createElement('img');
    img.src = iconUrlFor(s);
    img.onerror = function () { if (img.src.indexOf(FALLBACK_ICON) !== 0) { img.onerror = null; img.src = FALLBACK_ICON; } };
    div.appendChild(img);
    return div;
  }

  function boot() {
    if (!window.tsic || typeof tsic.on !== 'function') { setTimeout(boot, 16); return; }
    injectStyleOnce();
    ensureRoot();

    tsic.on('tsic.msg.UI.Construction.Carousel', function (p) {
      var root = ensureRoot();
      var row = document.getElementById('cc-row');
      var rot = document.getElementById('cc-rotation');
      var blk = document.getElementById('cc-blocked');
      if (!row) return;

      // Hide when there's no active build (EndAbility clears Current).
      if (!p || !p.Current || !p.Current.FurnitureId) {
        row.innerHTML = '';
        rot.textContent = '';
        blk.textContent = '';
        root.classList.add('hidden');
        return;
      }

      row.innerHTML = '';
      var prev = (p.Prev || []).slice(0, 4).reverse();   // closest-to-current first
      var next = (p.Next || []).slice(0, 4);
      for (var i = 0; i < prev.length; i++) row.appendChild(slotEl(prev[i], false));
      row.appendChild(slotEl(p.Current, true));
      for (var j = 0; j < next.length; j++) row.appendChild(slotEl(next[j], false));
      rot.textContent = p.RotationAxis ? 'ROTATION: ' + p.RotationAxis : '';
      blk.textContent = p.BlockedReason ? p.BlockedReason.toUpperCase() : '';
      root.classList.remove('hidden');
    });
  }

  boot();
})();
