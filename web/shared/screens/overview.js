// Overview screen module — the hold-Tab handbook + shift roster.
//
// Registered with TSIC.registerScreen and mounted as an overlay by
// shared/screen-manager.js. Opened and closed entirely from C++
// (UOverviewControllerComponent, off Input.Behavior.Overview), so unlike every
// other screen this one has no Back wiring and no input-mode tag of its own:
// the component owns the input situation for exactly as long as the key is down.
//
// Two panels. The left one is always there — the handbook, built from
// shared/guide-catalog.js for the wording and artwork and from UI.Tutorial.State
// for what is actually done. The right one is the roster of who is on shift, and
// it only exists in a multiplayer session; single player gets one wider column.
//
// Channels
//   in  UI.Tutorial.State         per-step done flags (sticky)
//   in  UI.Overview.State         roster + session clock, ~6/sec while open
//   in  UI.Settings.ControlsState the controls list, for the Controls page
//
// Refresh discipline: the roster payload arrives many times a second, and a list
// the player is hovering cannot be thrown away and rebuilt at that rate — the
// row under the cursor would be replaced mid-hover and the highlight would
// strobe. Rows are therefore keyed by player id, created once, and updated in
// place; only a change in WHO is present rebuilds anything.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  var S = '[data-screen="Overview"] ';

  var STYLE = [
    // ── Stage ────────────────────────────────────────────────────────────
    // Not a solid stage: this is a peek, not a destination, and seeing the room
    // you are still walking through behind it is the point. The wash is dark
    // enough to carry cream paper over any biome.
    S + '#ov-scrim { position:fixed; inset:0; display:flex; align-items:center; justify-content:center;',
    '  padding:3vh 3vw; background:rgba(10,10,10,0.55); pointer-events:auto; }',
    S + '#ov-scrim { animation:ov-in 120ms ease-out; }',
    '@keyframes ov-in { from { opacity:0; } to { opacity:1; } }',
    'html[data-tsic-reduce-motion] ' + S + '#ov-scrim { animation:none; }',

    S + '#ov-shell { display:grid; gap:16px; width:100%; max-width:1480px; height:min(82vh, 900px);',
    '  grid-template-columns:minmax(0,1fr) minmax(340px, 420px); }',
    // Single player: one column, and narrower, so the handbook does not sprawl
    // into a two-metre reading line on a wide monitor.
    S + '#ov-shell[data-solo="1"] { grid-template-columns:minmax(0, 980px); justify-content:center; }',
    S + '#ov-shell[data-solo="1"] #ov-roster { display:none; }',

    S + '.ov-panel { display:flex; flex-direction:column; min-height:0; min-width:0; padding:16px 18px; }',

    // ── Panel headers ────────────────────────────────────────────────────
    S + '.ov-head { display:flex; align-items:flex-start; gap:14px; flex:0 0 auto; }',
    S + '.ov-head .ov-head-text { flex:1 1 auto; min-width:0; }',
    S + '.ov-head .tsic-title { margin-bottom:2px; }',
    S + '.ov-blurb { font-family:var(--font-body); font-size:12px; color:var(--ink-mute); }',

    // Progress dial — conic ring with the count in the middle. currentColor-free
    // on purpose: the ring is the one place red is allowed to be decorative.
    S + '.ov-dial { position:relative; flex:0 0 auto; width:64px; height:64px; border-radius:50%;',
    '  background:conic-gradient(var(--mag-red) calc(var(--pct) * 1%), rgba(10,10,10,0.14) 0);',
    '  display:flex; align-items:center; justify-content:center; }',
    S + '.ov-dial::after { content:""; position:absolute; inset:7px; border-radius:50%;',
    '  background:var(--paper-cream); border:2px solid var(--ink-night); }',
    S + '.ov-dial span { position:relative; z-index:1; font-family:var(--font-display); font-size:17px;',
    '  letter-spacing:0.02em; color:var(--ink-night); }',
    S + '.ov-dial[hidden] { display:none; }',

    // ── Body / scroll ────────────────────────────────────────────────────
    S + '.ov-body { flex:1 1 auto; min-height:0; overflow-y:auto; scrollbar-gutter:stable; padding-right:2px; }',

    // ── Filter chips ─────────────────────────────────────────────────────
    S + '.ov-filters { display:flex; gap:6px; flex:0 0 auto; margin:0 0 10px; }',
    S + '.ov-chip { padding:3px 11px; border:2px solid var(--ink-night); background:var(--paper-bright);',
    '  color:var(--ink-soft); font-family:var(--font-display); font-size:12px; letter-spacing:0.10em;',
    '  text-transform:uppercase; cursor:pointer; }',
    S + '.ov-chip:hover { background:var(--paper-muted); color:var(--ink-night); }',
    S + '.ov-chip.is-active { background:var(--ink-night); color:var(--paper-bright); }',

    // ── Next-up callout ──────────────────────────────────────────────────
    // The single most useful line on the page, so it gets the loudest plate.
    S + '.ov-next { display:flex; align-items:center; gap:14px; margin:0 0 14px; padding:12px 14px;',
    '  background:var(--mag-red); color:#fff; border:3px solid var(--ink-night); box-shadow:var(--shadow-block-sm); }',
    S + '.ov-next .ov-next-art { flex:0 0 auto; width:54px; height:54px; background:rgba(255,255,255,0.16);',
    '  border:2px solid rgba(255,255,255,0.55); display:flex; align-items:center; justify-content:center; }',
    S + '.ov-next .ov-next-art img { width:100%; height:100%; object-fit:contain; }',
    S + '.ov-next .ov-next-art svg { width:60%; height:60%; }',
    S + '.ov-next-text { min-width:0; }',
    S + '.ov-next-eyebrow { font-family:var(--font-body); font-size:10px; font-weight:800;',
    '  letter-spacing:0.20em; text-transform:uppercase; opacity:0.82; }',
    S + '.ov-next-title { font-family:var(--font-display); font-size:24px; letter-spacing:0.03em;',
    '  text-transform:uppercase; line-height:1.0; margin:2px 0 3px; }',
    S + '.ov-next-hint { font-family:var(--font-body); font-size:12px; opacity:0.9; }',
    S + '.ov-next.is-done { background:var(--ink-night); }',

    // ── Chapters ─────────────────────────────────────────────────────────
    S + '.ov-chapter { margin:0 0 16px; }',
    S + '.ov-chapter-head { display:flex; align-items:baseline; gap:10px; padding:0 2px 4px;',
    '  border-bottom:3px solid var(--ink-night); }',
    S + '.ov-chapter-title { flex:1 1 auto; font-family:var(--font-display); font-size:18px;',
    '  letter-spacing:0.10em; text-transform:uppercase; color:var(--ink-night); }',
    S + '.ov-chapter-count { font-family:var(--font-terminal); font-size:13px; color:var(--ink-soft); }',
    S + '.ov-chapter-bar { height:5px; background:rgba(10,10,10,0.14); border:1px solid var(--ink-night);',
    '  border-top:0; }',
    S + '.ov-chapter-fill { height:100%; background:var(--mag-red); transition:width 220ms ease; }',
    S + '.ov-chapter.is-complete .ov-chapter-fill { background:var(--mag-yellow); }',
    S + '.ov-chapter-blurb { font-family:var(--font-body); font-size:11px; color:var(--ink-mute); margin:5px 2px 2px; }',

    // ── Goal rows ────────────────────────────────────────────────────────
    S + '.ov-goal { display:flex; align-items:center; gap:12px; width:100%; text-align:left;',
    '  padding:8px 8px; background:transparent; border:0; border-bottom:1px dashed rgba(10,10,10,0.28);',
    '  cursor:pointer; color:var(--ink-night); font-family:var(--font-display); }',
    S + '.ov-goal:hover, ' + S + '.ov-goal.is-picked { background:var(--paper-muted); }',
    S + '.ov-goal-art { position:relative; flex:0 0 auto; width:46px; height:46px; background:var(--paper-bright);',
    '  border:2px solid var(--ink-night); display:flex; align-items:center; justify-content:center; }',
    S + '.ov-goal-art img { width:100%; height:100%; object-fit:contain; }',
    S + '.ov-goal-art svg { width:60%; height:60%; color:var(--ink-soft); }',
    S + '.ov-goal-text { flex:1 1 auto; min-width:0; }',
    S + '.ov-goal-title { font-size:16px; letter-spacing:0.04em; text-transform:uppercase; line-height:1.1;',
    '  position:relative; display:inline-block; }',
    S + '.ov-goal-hint { font-family:var(--font-body); font-size:11.5px; color:var(--ink-mute); margin-top:2px;',
    '  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    S + '.ov-goal-mark { flex:0 0 auto; width:24px; text-align:center; font-size:17px; color:rgba(10,10,10,0.32); }',

    // Done: gold tick, struck-through title, and the artwork steps back so the
    // eye lands on what is still outstanding.
    S + '.ov-goal.is-done .ov-goal-mark { color:var(--mag-yellow); }',
    S + '.ov-goal.is-done .ov-goal-title { color:var(--ink-mute); }',
    S + '.ov-goal.is-done .ov-goal-title::after { content:""; position:absolute; left:0; top:55%;',
    '  height:2px; width:100%; background:currentColor; }',
    S + '.ov-goal.is-done .ov-goal-art { opacity:0.45; }',
    S + '.ov-goal.is-done .ov-goal-hint { color:rgba(10,10,10,0.34); }',

    // ── Detail footer (guide) ────────────────────────────────────────────
    S + '.ov-detail { flex:0 0 auto; margin-top:10px; padding-top:10px; border-top:3px solid var(--ink-night);',
    '  min-height:62px; }',
    S + '.ov-detail-title { font-family:var(--font-display); font-size:15px; letter-spacing:0.08em;',
    '  text-transform:uppercase; color:var(--ink-night); }',
    S + '.ov-detail-body { font-family:var(--font-body); font-size:12px; color:var(--ink-soft); margin-top:3px; }',
    S + '.ov-detail-find { display:flex; align-items:center; gap:6px; margin-top:7px; flex-wrap:wrap; }',
    S + '.ov-detail-find .ov-find-label { font-family:var(--font-body); font-size:10px; font-weight:800;',
    '  letter-spacing:0.16em; text-transform:uppercase; color:var(--ink-mute); margin-right:2px; }',
    S + '.ov-find { width:34px; height:34px; background:var(--paper-bright); border:2px solid var(--ink-night);',
    '  display:flex; align-items:center; justify-content:center; }',
    S + '.ov-find img { width:100%; height:100%; object-fit:contain; }',

    // ── Field notes ──────────────────────────────────────────────────────
    S + '.ov-note { display:flex; gap:12px; padding:10px 4px; border-bottom:1px dashed rgba(10,10,10,0.28); }',
    S + '.ov-note-art { flex:0 0 auto; width:36px; height:36px; border:2px solid var(--ink-night);',
    '  background:var(--paper-bright); display:flex; align-items:center; justify-content:center; }',
    S + '.ov-note-art svg { width:60%; height:60%; color:var(--mag-red); }',
    S + '.ov-note-title { font-family:var(--font-display); font-size:16px; letter-spacing:0.06em;',
    '  text-transform:uppercase; color:var(--ink-night); }',
    S + '.ov-note-body { font-family:var(--font-body); font-size:12px; color:var(--ink-soft); margin-top:3px;',
    '  line-height:1.45; }',

    // ── Controls page ────────────────────────────────────────────────────
    S + '.ov-ctl-group { font-family:var(--font-display); font-size:14px; letter-spacing:0.12em;',
    '  text-transform:uppercase; color:var(--ink-soft); margin:12px 2px 4px; border-bottom:2px solid var(--ink-night); }',
    S + '.ov-ctl { display:flex; align-items:center; gap:10px; padding:5px 4px;',
    '  border-bottom:1px dashed rgba(10,10,10,0.22); }',
    S + '.ov-ctl-name { flex:1 1 auto; min-width:0; font-family:var(--font-display); font-size:14px;',
    '  letter-spacing:0.04em; text-transform:uppercase; color:var(--ink-night);',
    '  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    S + '.ov-key { flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center;',
    '  min-width:30px; height:26px; padding:0 6px; background:var(--paper-bright);',
    '  border:2px solid var(--ink-night); box-shadow:var(--shadow-block-sm);',
    '  font-family:var(--font-terminal); font-size:13px; color:var(--ink-night); }',
    S + '.ov-key img { width:18px; height:18px; }',

    // ── Roster ───────────────────────────────────────────────────────────
    S + '#ov-roster-rows { display:flex; flex-direction:column; gap:6px; }',
    S + '.ov-player { display:flex; align-items:center; gap:10px; padding:8px 9px;',
    '  background:var(--paper-bright); border:2px solid var(--ink-night); cursor:default; }',
    S + '.ov-player:hover { background:var(--paper-muted); }',
    S + '.ov-player.is-local { border-color:var(--mag-red); box-shadow:var(--shadow-block-sm); }',
    S + '.ov-player.is-dead { opacity:0.62; }',
    S + '.ov-player.is-away { opacity:0.72; }',

    // The colour chip is the same palette entry the map and minimap use, so a
    // name here and a dot out there are the same person without a legend.
    S + '.ov-player-dot { flex:0 0 auto; width:16px; height:16px; border:2px solid var(--ink-night); }',
    S + '.ov-player-main { flex:1 1 auto; min-width:0; }',
    S + '.ov-player-name-row { display:flex; align-items:baseline; gap:6px; }',
    S + '.ov-player-name { font-family:var(--font-display); font-size:16px; letter-spacing:0.04em;',
    '  text-transform:uppercase; color:var(--ink-night); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
    S + '.ov-badge { flex:0 0 auto; padding:1px 5px; font-family:var(--font-body); font-size:9px;',
    '  font-weight:800; letter-spacing:0.14em; text-transform:uppercase;',
    '  background:var(--ink-night); color:var(--paper-bright); }',
    S + '.ov-badge.ov-badge--you { background:var(--mag-red); }',
    S + '.ov-badge.ov-badge--down { background:var(--mag-red-deep); }',
    // Health escalates: ink while it is nothing to worry about, yellow once it is,
    // red only when it is nearly gone. A bar that starts at the alarm colour has
    // nowhere left to go, and a full-health teammate read as a hurt one.
    S + '.ov-hp { height:7px; margin-top:5px; background:rgba(10,10,10,0.16); border:1px solid var(--ink-night); }',
    S + '.ov-hp-fill { height:100%; background:var(--ink-night); transition:width 180ms linear; }',
    S + '.ov-hp[data-state="hurt"] .ov-hp-fill { background:var(--mag-yellow); }',
    S + '.ov-hp[data-state="critical"] .ov-hp-fill { background:var(--mag-red); }',
    S + '.ov-player-meta { font-family:var(--font-terminal); font-size:11px; color:var(--ink-mute); margin-top:3px; }',

    // Bearing arrow — rotated, not re-drawn, so it can update at the payload
    // rate without touching layout.
    S + '.ov-bearing { flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:2px;',
    '  width:52px; }',
    S + '.ov-bearing svg { width:22px; height:22px; color:var(--ink-night); transition:transform 140ms linear; }',
    S + '.ov-bearing .ov-dist { font-family:var(--font-terminal); font-size:12px; color:var(--ink-soft); }',
    S + '.ov-player.is-local .ov-bearing svg { color:var(--mag-red); }',
    'html[data-tsic-reduce-motion] ' + S + '.ov-bearing svg,',
    'html[data-tsic-reduce-motion] ' + S + '.ov-hp-fill { transition:none; }',

    // ── Session strip ────────────────────────────────────────────────────
    S + '.ov-session { flex:0 0 auto; display:flex; align-items:center; gap:10px; margin-top:10px;',
    '  padding-top:10px; border-top:3px solid var(--ink-night); }',
    S + '.ov-clock { position:relative; flex:0 0 auto; width:30px; height:30px; border-radius:50%;',
    '  border:2px solid var(--ink-night);',
    '  background:conic-gradient(var(--ink-night) calc(var(--frac) * 1%), var(--paper-bright) 0); }',
    S + '.ov-session-text { flex:1 1 auto; font-family:var(--font-display); font-size:15px;',
    '  letter-spacing:0.10em; text-transform:uppercase; color:var(--ink-night); }',
    S + '.ov-session-sub { font-family:var(--font-terminal); font-size:11px; color:var(--ink-mute);',
    '  letter-spacing:0.04em; text-transform:none; }',

    // ── Hold hint ────────────────────────────────────────────────────────
    S + '.ov-hold { display:flex; align-items:center; justify-content:center; gap:8px;',
    '  font-family:var(--font-body); font-size:10px; font-weight:800; letter-spacing:0.18em;',
    '  text-transform:uppercase; color:var(--ink-mute); }',
    S + '.ov-hold img { width:20px; height:20px; opacity:0.75; }',
  ].join('\n');

  var TEMPLATE = ''
    + '<div id="ov-scrim">'
    +   '<div id="ov-shell" data-solo="1">'
    +     '<section id="ov-guide" class="tsic-panel ov-panel">'
    +       '<div class="ov-head">'
    +         '<div class="ov-head-text">'
    +           '<div class="tsic-eyebrow">Staff Handbook</div>'
    +           '<h1 class="tsic-title" id="ov-guide-title">Getting Started</h1>'
    +           '<div class="ov-blurb" id="ov-guide-blurb">What to do next, and where to look for it.</div>'
    +         '</div>'
    +         '<div class="ov-dial" id="ov-dial" style="--pct:0"><span id="ov-dial-text">0/0</span></div>'
    +       '</div>'
    +       '<div class="tsic-tab-bar" data-tsic-tab-bar id="ov-tabs">'
    +         '<button class="tsic-tab is-active" data-tab="guide">Handbook</button>'
    +         '<button class="tsic-tab" data-tab="notes">Field Notes</button>'
    +         '<button class="tsic-tab" data-tab="controls">Controls</button>'
    +       '</div>'
    +       '<div class="ov-filters" id="ov-filters">'
    +         '<button class="ov-chip is-active" data-filter="all">All</button>'
    +         '<button class="ov-chip" data-filter="todo">To do</button>'
    +         '<button class="ov-chip" data-filter="done">Done</button>'
    +       '</div>'
    +       '<div class="ov-body" id="ov-body"></div>'
    +       '<div class="ov-detail" id="ov-detail"></div>'
    +       '<div class="ov-session">'
    +         '<div class="ov-clock" id="ov-clock" style="--frac:0"></div>'
    +         '<div class="ov-session-text"><span id="ov-session-day">Day 1</span>'
    +           '<div class="ov-session-sub" id="ov-session-sub">&nbsp;</div>'
    +         '</div>'
    +         '<div class="ov-hold"><img id="ov-hold-key" alt="Tab"><span>Hold to keep this open</span></div>'
    +       '</div>'
    +     '</section>'
    +     '<aside id="ov-roster" class="tsic-panel ov-panel">'
    +       '<div class="ov-head">'
    +         '<div class="ov-head-text">'
    +           '<div class="tsic-eyebrow">On Shift</div>'
    +           '<h2 class="tsic-title tsic-title--sm" id="ov-roster-count">Nobody</h2>'
    +           '<div class="ov-blurb" id="ov-roster-blurb">&nbsp;</div>'
    +         '</div>'
    +       '</div>'
    +       '<div class="ov-body"><div id="ov-roster-rows"></div></div>'
    +       '<div class="ov-detail" id="ov-roster-foot"></div>'
    +     '</aside>'
    +   '</div>'
    + '</div>';

  // ── module state ──────────────────────────────────────────────────────
  // Deliberately outside the screen lifecycle: the panel is opened and closed
  // dozens of times a session and the player's chosen page should survive that.
  var activeTab = 'guide';
  var activeFilter = 'all';
  var pickedStep = null;      // step id the player clicked, pinned into the detail box

  var doneById = {};          // step id -> bool, from UI.Tutorial.State
  var stepOrder = [];         // step ids in the order C++ sent them
  var roster = null;          // last UI.Overview.State payload
  var controls = null;        // last UI.Settings.ControlsState payload
  var visible = false;

  var els = {};
  var playerRows = new Map(); // player id -> { root, refs… }
  var rosterKey = '';         // who was in the last structural render

  function el() { return TSIC.el.apply(null, arguments); }

  function injectStyles() {
    if (document.getElementById('ov-styles')) return;
    var s = document.createElement('style');
    s.id = 'ov-styles';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  // ── artwork ───────────────────────────────────────────────────────────

  /** Item thumbnail when the entry names one, an inline category glyph otherwise. */
  function artFor(entry) {
    if (entry.item && TSIC.itemIconUrl && TSIC.iconImg) {
      return TSIC.iconImg(TSIC.itemIconUrl(entry.item), { alt: '' });
    }
    if (entry.glyph && TSIC.categoryIcon) {
      var g = TSIC.categoryIcon(entry.glyph);
      if (g) return g;
    }
    return null;
  }

  // ── guide model ───────────────────────────────────────────────────────

  /**
   * Chapters from the catalogue, plus a trailing chapter for any step the game
   * sent that the catalogue does not mention. A new C++ step therefore shows up
   * in the handbook the moment it exists, with a prettified title, rather than
   * being silently invisible until someone remembers to write a card for it.
   */
  function buildChapters() {
    var catalog = (TSIC.GuideCatalog && TSIC.GuideCatalog.chapters) || [];
    var known = TSIC.guideKnownStepIds ? TSIC.guideKnownStepIds() : {};
    var out = catalog.map(function (chapter) {
      return {
        id: chapter.id,
        title: chapter.title,
        blurb: chapter.blurb,
        steps: chapter.steps.filter(function (entry) {
          // A card for a step this build does not have is stale content, not an
          // objective — dropping it keeps the counts honest.
          return stepOrder.length === 0 || stepOrder.indexOf(entry.step) !== -1;
        }),
      };
    });

    var extras = stepOrder.filter(function (id) { return !known[id]; });
    if (extras.length) {
      out.push({
        id: 'more',
        title: 'More To Do',
        blurb: 'Objectives this handbook has not been written up for yet.',
        steps: extras.map(function (id) {
          return { step: id, title: prettifyStep(id), hint: '', glyph: 'item' };
        }),
      });
    }
    return out.filter(function (chapter) { return chapter.steps.length > 0; });
  }

  /** "OpenCraftingBench" -> "Open Crafting Bench". Last resort only. */
  function prettifyStep(id) {
    return String(id || '').replace(/([^A-Z\s])([A-Z])/g, '$1 $2');
  }

  function isDone(stepId) { return doneById[stepId] === true; }

  function countDone(steps) {
    var n = 0;
    steps.forEach(function (entry) { if (isDone(entry.step)) n++; });
    return n;
  }

  function firstOutstanding(chapters) {
    for (var i = 0; i < chapters.length; i++) {
      for (var j = 0; j < chapters[i].steps.length; j++) {
        if (!isDone(chapters[i].steps[j].step)) return chapters[i].steps[j];
      }
    }
    return null;
  }

  function findEntry(chapters, stepId) {
    for (var i = 0; i < chapters.length; i++) {
      for (var j = 0; j < chapters[i].steps.length; j++) {
        if (chapters[i].steps[j].step === stepId) return chapters[i].steps[j];
      }
    }
    return null;
  }

  // ── guide rendering ───────────────────────────────────────────────────

  function renderGuide() {
    var chapters = buildChapters();
    var total = 0;
    var done = 0;
    chapters.forEach(function (chapter) {
      total += chapter.steps.length;
      done += countDone(chapter.steps);
    });

    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    els.dial.style.setProperty('--pct', String(pct));
    els.dialText.textContent = done + '/' + total;

    els.body.textContent = '';

    // Next up — the outstanding objective closest to the front of the order.
    var next = firstOutstanding(chapters);
    if (next && activeFilter !== 'done') {
      els.body.appendChild(nextCallout(next));
    } else if (!next && total > 0) {
      els.body.appendChild(el('div', { class: 'ov-next is-done' },
        el('div', { class: 'ov-next-art' }, TSIC.categoryIcon ? TSIC.categoryIcon('summon') : null),
        el('div', { class: 'ov-next-text' },
          el('div', { class: 'ov-next-eyebrow' }, 'All clear'),
          el('div', { class: 'ov-next-title' }, 'The handbook is finished'),
          el('div', { class: 'ov-next-hint' }, 'Everything below is done. The store is yours to run.'))));
    }

    var shown = 0;
    chapters.forEach(function (chapter) {
      var steps = chapter.steps.filter(function (entry) {
        if (activeFilter === 'todo') return !isDone(entry.step);
        if (activeFilter === 'done') return isDone(entry.step);
        return true;
      });
      if (!steps.length) return;
      shown += steps.length;
      els.body.appendChild(chapterBlock(chapter, steps));
    });

    if (shown === 0) {
      els.body.appendChild(el('div', { class: 'tsic-empty' },
        activeFilter === 'done' ? 'Nothing finished yet' : 'Nothing left to do'));
    }

    renderDetail(chapters);
  }

  function nextCallout(entry) {
    var art = artFor(entry);
    return el('div', { class: 'ov-next' },
      el('div', { class: 'ov-next-art' }, art),
      el('div', { class: 'ov-next-text' },
        el('div', { class: 'ov-next-eyebrow' }, 'Next up'),
        el('div', { class: 'ov-next-title' }, entry.title || prettifyStep(entry.step)),
        el('div', { class: 'ov-next-hint' }, entry.hint || '')));
  }

  function chapterBlock(chapter, steps) {
    var doneCount = countDone(chapter.steps);
    var total = chapter.steps.length;
    var complete = doneCount === total;

    var fill = el('div', { class: 'ov-chapter-fill' });
    fill.style.width = (total > 0 ? (doneCount / total) * 100 : 0) + '%';

    var block = el('section', { class: 'ov-chapter' + (complete ? ' is-complete' : '') },
      el('div', { class: 'ov-chapter-head' },
        el('div', { class: 'ov-chapter-title' }, chapter.title),
        el('div', { class: 'ov-chapter-count' }, doneCount + ' / ' + total)),
      el('div', { class: 'ov-chapter-bar' }, fill),
      chapter.blurb ? el('div', { class: 'ov-chapter-blurb' }, chapter.blurb) : null);

    steps.forEach(function (entry) { block.appendChild(goalRow(entry)); });
    return block;
  }

  function goalRow(entry) {
    var doneNow = isDone(entry.step);
    var row = el('button', {
      class: 'ov-goal' + (doneNow ? ' is-done' : '') + (pickedStep === entry.step ? ' is-picked' : ''),
      'data-step': entry.step,
      type: 'button',
    },
      el('div', { class: 'ov-goal-art' }, artFor(entry)),
      el('div', { class: 'ov-goal-text' },
        el('div', { class: 'ov-goal-title' }, entry.title || prettifyStep(entry.step)),
        entry.hint ? el('div', { class: 'ov-goal-hint' }, entry.hint) : null),
      el('div', { class: 'ov-goal-mark' }, doneNow ? '✓' : '□'));

    // Hover previews, click pins. Pinning matters because the player is holding
    // a key with one hand: they can park the detail on the thing they care about
    // and then move the mouse without losing it.
    row.addEventListener('mouseenter', function () { showDetailFor(entry); });
    row.addEventListener('click', function () {
      pickedStep = (pickedStep === entry.step) ? null : entry.step;
      renderGuide();
    });
    return row;
  }

  function renderDetail(chapters) {
    var entry = pickedStep ? findEntry(chapters, pickedStep) : null;
    if (entry) { showDetailFor(entry, true); return; }
    showDetailHint();
  }

  function showDetailHint() {
    els.detail.textContent = '';
    els.detail.appendChild(el('div', { class: 'ov-detail-body' },
      'Hover an objective to read it. Click to pin it here.'));
  }

  function showDetailFor(entry, pinned) {
    els.detail.textContent = '';
    els.detail.appendChild(el('div', { class: 'ov-detail-title' },
      (entry.title || prettifyStep(entry.step)) + (pinned ? ' — pinned' : '')));
    if (entry.hint) {
      els.detail.appendChild(el('div', { class: 'ov-detail-body' }, entry.hint));
    }
    if (entry.find && entry.find.length && TSIC.itemIconUrl && TSIC.iconImg) {
      var strip = el('div', { class: 'ov-detail-find' },
        el('span', { class: 'ov-find-label' }, 'Look for'));
      entry.find.forEach(function (id) {
        strip.appendChild(el('div', { class: 'ov-find', title: prettifyItemId(id) },
          TSIC.iconImg(TSIC.itemIconUrl(id), { alt: '' })));
      });
      els.detail.appendChild(strip);
    }
  }

  function prettifyItemId(id) {
    if (TSIC.prettifyDefinitionName) return TSIC.prettifyDefinitionName(id);
    return String(id || '');
  }

  // ── field notes ───────────────────────────────────────────────────────

  function renderNotes() {
    var notes = (TSIC.GuideCatalog && TSIC.GuideCatalog.notes) || [];
    els.body.textContent = '';
    if (!notes.length) {
      els.body.appendChild(el('div', { class: 'tsic-empty' }, 'No notes'));
      return;
    }
    notes.forEach(function (note) {
      els.body.appendChild(el('div', { class: 'ov-note' },
        el('div', { class: 'ov-note-art' }, TSIC.categoryIcon ? TSIC.categoryIcon(note.glyph) : null),
        el('div', null,
          el('div', { class: 'ov-note-title' }, note.title),
          el('div', { class: 'ov-note-body' }, note.body))));
    });
    els.detail.textContent = '';
    els.detail.appendChild(el('div', { class: 'ov-detail-body' },
      'Everything here is always true. The handbook page tracks what you have actually done.'));
  }

  // ── controls ──────────────────────────────────────────────────────────

  function keyChip(text) {
    var url = TSIC.keyIconUrl ? TSIC.keyIconUrl(text) : '';
    if (url) {
      var img = document.createElement('img');
      img.src = url;
      img.alt = text;
      return el('span', { class: 'ov-key' }, img);
    }
    return el('span', { class: 'ov-key' }, text);
  }

  function renderControls() {
    els.body.textContent = '';
    var entries = (controls && controls.Entries) || [];
    var withKeys = entries.filter(function (e) { return e.KeyboardKeyText || e.GamepadKeyText; });

    if (!withKeys.length) {
      els.body.appendChild(el('div', { class: 'tsic-empty' }, 'Controls not loaded yet'));
      return;
    }

    // Grouped by the hotkey definition's own category, in first-seen order, so
    // the page matches the settings screen rather than inventing a second scheme.
    var groups = [];
    var byName = {};
    withKeys.forEach(function (e) {
      var name = e.Category || 'Other';
      if (!byName[name]) { byName[name] = []; groups.push(name); }
      byName[name].push(e);
    });

    groups.forEach(function (name) {
      els.body.appendChild(el('div', { class: 'ov-ctl-group' }, name));
      byName[name].forEach(function (e) {
        var row = el('div', { class: 'ov-ctl' },
          el('div', { class: 'ov-ctl-name' }, e.DisplayName || e.HotkeyId));
        if (e.KeyboardKeyText) row.appendChild(keyChip(e.KeyboardKeyText));
        if (e.GamepadKeyText) {
          var url = TSIC.keyIconUrl ? TSIC.keyIconUrl(e.GamepadKeyText, true) : '';
          if (url) {
            var img = document.createElement('img');
            img.src = url;
            img.alt = e.GamepadKeyText;
            row.appendChild(el('span', { class: 'ov-key' }, img));
          }
        }
        els.body.appendChild(row);
      });
    });

    els.detail.textContent = '';
    els.detail.appendChild(el('div', { class: 'ov-detail-body' },
      'Rebind any of these in Options → Controls.'));
  }

  // ── roster ────────────────────────────────────────────────────────────

  var ARROW_PATH = 'M12 3 L19 20 L12 16 L5 20 Z';

  function bearingArrow() {
    var svg = TSIC.svg('svg', {
      viewBox: '0 0 24 24', fill: 'currentColor',
      'aria-hidden': 'true',
    });
    svg.appendChild(TSIC.svg('path', { d: ARROW_PATH }));
    return svg;
  }

  /** Compass point for a bearing relative to where the player is facing. */
  function bearingLabel(deg) {
    var names = ['ahead', 'ahead-right', 'right', 'behind-right', 'behind', 'behind-left', 'left', 'ahead-left'];
    var idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
    return names[idx];
  }

  function makePlayerRow(player) {
    var dot = el('div', { class: 'ov-player-dot' });
    var name = el('div', { class: 'ov-player-name' }, player.Name || 'Player');
    var badges = el('div', { class: 'ov-player-name-row' }, name);
    var hpFill = el('div', { class: 'ov-hp-fill' });
    var hp = el('div', { class: 'ov-hp' }, hpFill);
    var meta = el('div', { class: 'ov-player-meta' }, '');
    var arrow = bearingArrow();
    var dist = el('div', { class: 'ov-dist' }, '');
    var bearing = el('div', { class: 'ov-bearing' }, arrow, dist);

    var root = el('div', { class: 'ov-player', 'data-player': player.Id || '' },
      dot,
      el('div', { class: 'ov-player-main' }, badges, hp, meta),
      bearing);

    return { root: root, dot: dot, name: name, badges: badges, hp: hp, hpFill: hpFill,
             meta: meta, arrow: arrow, dist: dist };
  }

  /** "1 floor up" / "2 floors down", or '' on the same level as the local player. */
  function floorLabel(player, localLevel) {
    if (!player.bHasPawn || player.bIsLocal || localLevel === null) return '';
    var delta = (player.HeightLevel || 0) - localLevel;
    if (delta === 0) return '';
    var n = Math.abs(delta);
    return n + (n === 1 ? ' floor ' : ' floors ') + (delta > 0 ? 'up' : 'down');
  }

  function updatePlayerRow(refs, player, localLevel) {
    refs.root.classList.toggle('is-local', !!player.bIsLocal);
    refs.root.classList.toggle('is-dead', !!player.bIsDead);
    refs.root.classList.toggle('is-away', !player.bHasPawn);
    refs.dot.style.background = player.Color || '#ffffff';
    refs.name.textContent = player.Name || 'Player';

    // Badges live in the name row and only change when the flags do — rebuilding
    // them every payload would churn the DOM six times a second for nothing.
    var wantBadges = [];
    if (player.bIsLocal) wantBadges.push(['you', 'You']);
    if (player.bIsHost) wantBadges.push(['host', 'Host']);
    if (player.bIsDead) wantBadges.push(['down', 'Down']);
    var signature = wantBadges.map(function (b) { return b[0]; }).join(',');
    if (refs.badgeSignature !== signature) {
      refs.badgeSignature = signature;
      while (refs.badges.childNodes.length > 1) refs.badges.removeChild(refs.badges.lastChild);
      wantBadges.forEach(function (b) {
        refs.badges.appendChild(el('span', { class: 'ov-badge ov-badge--' + b[0] }, b[1]));
      });
    }

    if (player.bHasPawn && player.MaxHealth > 0) {
      var pct = Math.max(0, Math.min(1, player.HealthPct || 0));
      refs.hp.style.display = '';
      refs.hpFill.style.width = (pct * 100) + '%';
      refs.hp.setAttribute('data-state', pct <= 0.25 ? 'critical' : (pct <= 0.6 ? 'hurt' : 'ok'));
      // Absolute height levels mean nothing to a player. What they need to know is
      // whether the teammate is on their floor, and which way to go if not.
      var floors = floorLabel(player, localLevel);
      refs.meta.textContent = Math.round(player.Health) + ' / ' + Math.round(player.MaxHealth)
        + (floors ? '  ·  ' + floors : '');
    } else {
      // No pawn here means no health to show — say so rather than draw an empty
      // bar, which reads as "this teammate is dead".
      refs.hp.style.display = 'none';
      refs.meta.textContent = player.bHasPawn ? '' : 'Out of range';
    }

    if (player.bIsLocal) {
      refs.dist.textContent = 'here';
      refs.arrow.style.display = 'none';
    } else if (player.bHasPawn) {
      refs.arrow.style.display = '';
      refs.arrow.style.transform = 'rotate(' + (player.BearingDeg || 0) + 'deg)';
      refs.dist.textContent = formatDistance(player.DistanceM);
    } else {
      refs.arrow.style.display = 'none';
      refs.dist.textContent = '—';
    }

    if (player.bHasPawn && !player.bIsLocal) {
      var floorsForTitle = floorLabel(player, localLevel);
      refs.root.title = player.Name + ' — ' + formatDistance(player.DistanceM) + ' '
        + bearingLabel(player.BearingDeg || 0) + (floorsForTitle ? ', ' + floorsForTitle : '');
    } else {
      refs.root.title = player.Name || '';
    }
  }

  function formatDistance(metres) {
    var m = Math.max(0, metres || 0);
    if (m < 1000) return Math.round(m) + ' m';
    return (m / 1000).toFixed(1) + ' km';
  }

  function renderRoster() {
    var players = (roster && roster.Players) || [];
    var solo = !(roster && roster.bMultiplayer);
    els.shell.setAttribute('data-solo', solo ? '1' : '0');
    els.rosterCount.textContent = players.length === 1 ? '1 Player' : players.length + ' Players';
    els.rosterBlurb.textContent = players.length > 1
      ? 'Distances and arrows are measured from you.'
      : 'Nobody else is in this session.';

    // Structural pass only when the cast changes; otherwise update in place so a
    // hovered row survives the next payload.
    var key = players.map(function (p) { return p.Id || p.Name; }).join('|');
    if (key !== rosterKey) {
      rosterKey = key;
      els.rosterRows.textContent = '';
      playerRows.clear();
      players.forEach(function (player) {
        var refs = makePlayerRow(player);
        playerRows.set(player.Id || player.Name, refs);
        els.rosterRows.appendChild(refs.root);
      });
    }

    // Players[0] is the local player by construction on the C++ side; without a pawn
    // there is no floor of our own to compare anyone against.
    var local = players[0];
    var localLevel = (local && local.bIsLocal && local.bHasPawn) ? (local.HeightLevel || 0) : null;
    players.forEach(function (player) {
      var refs = playerRows.get(player.Id || player.Name);
      if (refs) updatePlayerRow(refs, player, localLevel);
    });

    renderRosterFoot(players);
    renderSession();
  }

  /** One honest line about what the roster can and cannot see right now. */
  function renderRosterFoot(players) {
    var away = 0;
    var down = 0;
    players.forEach(function (p) {
      if (!p.bIsLocal && !p.bHasPawn) away++;
      if (p.bIsDead) down++;
    });
    var parts = [];
    if (down) parts.push(down + (down === 1 ? ' down' : ' down'));
    if (away) parts.push(away + ' out of range');
    els.rosterFoot.textContent = '';
    els.rosterFoot.appendChild(el('div', { class: 'ov-detail-body' },
      parts.length ? parts.join('  ·  ')
                   : 'Everyone accounted for. Arrows point from where you are looking.'));
  }

  function renderSession() {
    var day = (roster && roster.Day) || 1;
    var section = (roster && roster.DaySection) || '';
    var leaf = section.split('.').pop() || '';
    var frac = Math.round(((roster && roster.DayFraction) || 0) * 100);
    els.clock.style.setProperty('--frac', String(frac));
    els.sessionDay.textContent = 'Day ' + day + (leaf ? ' · ' + leaf : '');
    els.sessionSub.textContent = leaf === 'Night' ? 'Get inside' : 'Daylight';
  }

  // ── tabs ──────────────────────────────────────────────────────────────

  function setTab(tab) {
    if (tab === activeTab) return;
    activeTab = tab;
    Array.prototype.forEach.call(els.tabs.children, function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-tab') === tab);
    });
    els.filters.style.display = (tab === 'guide') ? '' : 'none';
    els.dial.hidden = (tab !== 'guide');
    els.guideTitle.textContent = tab === 'guide' ? 'Getting Started'
      : (tab === 'notes' ? 'Field Notes' : 'Controls');
    els.guideBlurb.textContent = tab === 'guide'
      ? 'What to do next, and where to look for it.'
      : (tab === 'notes' ? 'Things worth knowing before you learn them the hard way.'
                         : 'Every binding currently in force.');
    try { window.tsic.playSound('UI.TabSwitch', 0.5); } catch (e) { /* noop */ }
    renderActive();
  }

  function renderActive() {
    if (activeTab === 'notes') { renderNotes(); return; }
    if (activeTab === 'controls') { renderControls(); return; }
    renderGuide();
  }

  // ── channel handlers ──────────────────────────────────────────────────

  function onTutorialState(payload) {
    if (!payload || !Array.isArray(payload.Steps)) return;
    doneById = {};
    stepOrder = [];
    payload.Steps.forEach(function (step) {
      doneById[step.Id] = !!step.bDone;
      stepOrder.push(step.Id);
    });
    if (visible && activeTab === 'guide') renderGuide();
  }

  function onOverviewState(payload) {
    if (!payload) return;
    roster = payload;
    if (visible) renderRoster();
  }

  function onControlsState(payload) {
    if (!payload) return;
    controls = payload;
    if (visible && activeTab === 'controls') renderControls();
  }

  // ── registration ──────────────────────────────────────────────────────

  TSIC.registerScreen('Overview', {
    template: TEMPLATE,
    // No inputModeTag: UOverviewControllerComponent owns the input situation for
    // the length of the hold, so the player keeps walking and nothing here can
    // strand a mode tag if the screen is taken away mid-hold.
    //
    // No cancelCmd either — Back is not even listened for in this situation, and
    // the only way out is releasing the key.
    cancelCmd: null,
    screenSoundOpen: 'UI.Open',
    screenSoundClose: 'UI.Back',

    mount: function (root) {
      injectStyles();
      els.shell = root.querySelector('#ov-shell');
      els.body = root.querySelector('#ov-body');
      els.detail = root.querySelector('#ov-detail');
      els.dial = root.querySelector('#ov-dial');
      els.dialText = root.querySelector('#ov-dial-text');
      els.tabs = root.querySelector('#ov-tabs');
      els.filters = root.querySelector('#ov-filters');
      els.guideTitle = root.querySelector('#ov-guide-title');
      els.guideBlurb = root.querySelector('#ov-guide-blurb');
      els.rosterRows = root.querySelector('#ov-roster-rows');
      els.rosterCount = root.querySelector('#ov-roster-count');
      els.rosterBlurb = root.querySelector('#ov-roster-blurb');
      els.rosterFoot = root.querySelector('#ov-roster-foot');
      els.clock = root.querySelector('#ov-clock');
      els.sessionDay = root.querySelector('#ov-session-day');
      els.sessionSub = root.querySelector('#ov-session-sub');

      var holdKey = root.querySelector('#ov-hold-key');
      if (holdKey && TSIC.keyIconUrl) holdKey.src = TSIC.keyIconUrl('Tab');

      els.tabs.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-tab]');
        if (btn) setTab(btn.getAttribute('data-tab'));
      });

      els.filters.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-filter]');
        if (!btn) return;
        activeFilter = btn.getAttribute('data-filter');
        Array.prototype.forEach.call(els.filters.children, function (chip) {
          chip.classList.toggle('is-active', chip.getAttribute('data-filter') === activeFilter);
        });
        renderGuide();
      });

      // Leaving the list clears an unpinned preview, so the detail box never
      // describes something the cursor left behind.
      // Leaving the list restores whatever was pinned, or the hint if nothing is —
      // the detail box must never keep describing a row the cursor has left.
      els.body.addEventListener('mouseleave', function () {
        if (activeTab !== 'guide') return;
        if (!pickedStep) { showDetailHint(); return; }
        var entry = findEntry(buildChapters(), pickedStep);
        if (entry) showDetailFor(entry, true); else showDetailHint();
      });

      window.tsic.on('tsic.msg.UI.Tutorial.State', onTutorialState);
      window.tsic.on('tsic.msg.UI.Overview.State', onOverviewState);
      window.tsic.on('tsic.msg.UI.Settings.ControlsState', onControlsState);
    },

    onShow: function () {
      visible = true;
      // Force a structural roster pass: the cast can have changed while the
      // screen was closed, and the in-place path only reacts to a key change.
      rosterKey = '';
      renderActive();
      renderRoster();
    },

    onHide: function () {
      visible = false;
    },
  });
})();
