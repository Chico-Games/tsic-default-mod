// shared/hud-tutorial.js — Tutorial objectives box (top-right, below the minimap).
//
// Loaded by hud.js into the #hud-tutorial shell. Shows the most recently
// completed objective (ticked + crossed out) followed by the next few
// incomplete ones — up to 4 rows. Completing a step replaces the done row and
// slides the next objective in; out-of-order completions surface there too.
// Fully driven by the sticky UI.Tutorial.State channel; the C++ side owns
// detection and persistence.
//
// The ✕ button is only clickable while a cursor overlay (inventory, pause, map)
// is open (body.tsic-overlay-open, set by screen-manager.js). It flips the same
// persistent "Show tutorial objectives" setting the options menu exposes.
//
// Channel: tsic.msg.UI.Tutorial.State — { Steps:[{Id,bDone}], bEnabled }
(function () {
  var LABELS = {
    OpenCraftingBench: 'Find a crafting bench',
    DragFurniture:     'Drag furniture with right click',
    Construct:         'Build a base to hide at night',
    SetSpawnPoint:     'Sleep in a bed to set your spawn',
    EatFood:           'Eat food to regain health',
    ProduceRecipe:     'Produce a recipe in a machine',
    PlantSeed:         'Plant a seed in a plant pot',
    CraftWeapon:       'Craft a weapon',
  };
  var UPCOMING_COUNT = 3;   // incomplete objectives shown below the last-completed row

  // Steps that tick off silently. Their completion fires in the middle of a
  // physical action, where a chime reads as that action's own SFX rather than as
  // an objective being checked off (grabbing furniture sounded like a pickup cue).
  var SILENT_STEPS = { DragFurniture: true };

  // Transparent chrome: no plate behind the box — drop shadows carry legibility
  // (same treatment as the behavior bar, #bb-shell-gameplay).
  var CSS = [
    '#hud-tutorial { position:fixed; top:220px; right:24px; width:250px; pointer-events:none; z-index:20;',
    '  text-shadow:0 1px 2px rgba(0,0,0,0.75); }',
    '#hud-tutorial.tut-hidden { display:none; }',

    '#hud-tutorial .tut-header { display:flex; align-items:center; justify-content:space-between;',
    '  padding:0 2px 3px; border-bottom:1px solid rgba(240,232,208,0.35);',
    '  color:var(--paper-cream, #f0e8d0); font-family:var(--font-display, Georgia, serif);',
    '  font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; }',

    // ✕ — dormant until a cursor overlay is open, then clickable.
    '#hud-tutorial .tut-close { pointer-events:none; opacity:0; transition:opacity 150ms ease;',
    '  background:none; border:0; padding:0 2px; color:var(--paper-cream, #f0e8d0);',
    '  font-size:13px; line-height:1; font-family:inherit; text-shadow:inherit; }',
    'body.tsic-overlay-open #hud-tutorial .tut-close { pointer-events:auto; opacity:0.65; cursor:pointer; }',
    'body.tsic-overlay-open #hud-tutorial .tut-close:hover { opacity:1; }',

    '#hud-tutorial .tut-rows { padding:4px 0 0; }',
    '#hud-tutorial .tut-row { display:flex; align-items:baseline; gap:8px; padding:3px 2px;',
    '  color:var(--paper-bright, #fdf8ea); font-family:var(--font-display, Georgia, serif);',
    '  font-size:12px; letter-spacing:0.03em; }',
    '#hud-tutorial .tut-check { flex-shrink:0; width:13px; text-align:center;',
    '  color:rgba(240,232,208,0.55); font-size:11px; }',

    // Newly-mounted rows slide in from the right.
    '#hud-tutorial .tut-row.tut-in { animation:tut-row-in 300ms ease-out; }',
    '@keyframes tut-row-in { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }',

    // The last-completed row: gold tick + crossed out. It stays visible until
    // the next completion replaces it. The strike is a ::after line (not
    // text-decoration) so it can animate — on a fresh completion (.tut-just)
    // it draws across the text and the tick pops in.
    '#hud-tutorial .tut-row.tut-done { color:rgba(253,248,234,0.60); }',
    '#hud-tutorial .tut-row.tut-done .tut-check { color:var(--mag-yellow, #f5d34a); }',
    '#hud-tutorial .tut-row.tut-done .tut-label { position:relative; }',
    '#hud-tutorial .tut-row.tut-done .tut-label::after { content:""; position:absolute;',
    '  left:0; top:55%; height:1.5px; width:100%; background:currentColor; }',
    '#hud-tutorial .tut-row.tut-done.tut-just .tut-label::after { animation:tut-strike 450ms ease-out 120ms both; }',
    '#hud-tutorial .tut-row.tut-done.tut-just .tut-check { animation:tut-tick 350ms cubic-bezier(0.34,1.56,0.64,1) both; }',
    '@keyframes tut-strike { from { width:0; } to { width:100%; } }',
    '@keyframes tut-tick { 0% { transform:scale(0); } 60% { transform:scale(1.5); } 100% { transform:scale(1); } }',

    '@media (prefers-reduced-motion: reduce) {',
    '  #hud-tutorial .tut-row.tut-in, #hud-tutorial .tut-row.tut-done.tut-just .tut-label::after,',
    '  #hud-tutorial .tut-row.tut-done.tut-just .tut-check { animation:none; }',
    '}',
  ].join('\n');

  var root = null;
  var rowsHost = null;
  var state = null;        // last received Steps array
  var prevDone = null;     // Id -> bool; null until the first state (sticky replay = no sound)
  var lastDone = null;     // Id of the most recently completed step (shown ticked + crossed out)
  var justDone = null;     // Id that completed in the latest update (plays the strike animation)
  var mounted = {};        // Id -> true for rows currently in the DOM (gates the slide-in anim)
  var enabled = true;

  function el(tag, attrs) {
    if (window.TSIC && window.TSIC.el) return TSIC.el.apply(null, arguments);
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c != null) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function injectStyles() {
    if (document.getElementById('hud-tutorial-styles')) return;
    var s = document.createElement('style');
    s.id = 'hud-tutorial-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Up to 4 rows: the most recently completed step (ticked + crossed out),
  // then the next UPCOMING_COUNT incomplete steps in order. All done = empty
  // (the box hides — tutorial finished).
  function visibleSteps() {
    var out = [];
    var i;
    if (lastDone) {
      for (i = 0; i < state.length; i++) {
        if (state[i].Id === lastDone) { out.push(state[i]); break; }
      }
    }
    var upcoming = 0;
    for (i = 0; i < state.length && upcoming < UPCOMING_COUNT; i++) {
      if (!state[i].bDone) { out.push(state[i]); upcoming++; }
    }
    return upcoming > 0 ? out : [];
  }

  function render() {
    if (!root || !rowsHost) return;

    var vis = state ? visibleSteps() : [];
    root.classList.toggle('tut-hidden', !enabled || vis.length === 0);

    rowsHost.textContent = '';
    var nowMounted = {};
    vis.forEach(function (s) {
      var row = el('div', { class: 'tut-row', 'data-step': s.Id },
        el('span', { class: 'tut-check' }, s.bDone ? '✓' : '□'),
        el('span', { class: 'tut-label' }, LABELS[s.Id] || s.Id));
      if (s.bDone) {
        row.classList.add('tut-done');
        if (s.Id === justDone) row.classList.add('tut-just');
      } else if (!mounted[s.Id]) {
        row.classList.add('tut-in');
      }
      nowMounted[s.Id] = true;
      rowsHost.appendChild(row);
    });
    mounted = nowMounted;
  }

  function onState(p) {
    if (!p || !Array.isArray(p.Steps)) return;

    var first = (prevDone === null);
    var newly = [];
    var appeared = false;
    if (!first) {
      p.Steps.forEach(function (s) { if (s.bDone && !prevDone[s.Id]) newly.push(s.Id); });
      // A step id we have never tracked at all = a fresh objective rolling in.
      appeared = p.Steps.some(function (s) { return !(s.Id in prevDone) && !s.bDone; });
    }
    prevDone = {};
    p.Steps.forEach(function (s) { prevDone[s.Id] = !!s.bDone; });
    state = p.Steps;
    enabled = p.bEnabled !== false;

    justDone = null;
    if (newly.length) {
      var audible = newly.some(function (id) { return !SILENT_STEPS[id]; });
      if (audible) {
        try { tsic.playSound('Objective.Complete', 0.5); } catch (e) {}
      }
      lastDone = newly[newly.length - 1];
      justDone = lastDone;   // plays the strike/tick animation this render only
    } else if (appeared) {
      try { tsic.playSound('Tutorial.NewStep', 0.4); } catch (e) {}
    } else if (first) {
      // Sticky replay after a reload/rejoin: surface the last completed step
      // by display order, with no sound or animation.
      for (var i = 0; i < state.length; i++) {
        if (state[i].bDone) lastDone = state[i].Id;
      }
    }

    render();
  }

  function build() {
    root = document.getElementById('hud-tutorial');
    if (!root) return false;

    var close = el('button', { class: 'tut-close', title: 'Hide tutorial (re-enable in Options)' }, '✕');
    close.addEventListener('click', function () {
      tsic.publishMessage('UI.Cmd.Settings.Set', { Key: 'gameplay.show_tutorial', ValueJson: 'false' });
      enabled = false;   // optimistic; the settings echo re-broadcasts the sticky state
      render();
    });

    rowsHost = el('div', { class: 'tut-rows' });
    root.appendChild(el('div', { class: 'tut-box' },
      el('div', { class: 'tut-header' }, el('span', null, 'Objectives'), close),
      rowsHost));

    root.classList.add('tut-hidden');   // stay hidden until the first state arrives
    return true;
  }

  (function boot() {
    if (!window.tsic || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
    injectStyles();
    if (!build()) { setTimeout(boot, 16); return; }
    tsic.whenReady(function () {
      tsic.on('tsic.msg.UI.Tutorial.State', onState);
    });
  })();
})();
