// Notebook screen module — the Tab-toggled catalogue held up in front of the camera.
//
// The book itself is 3D (AScpNotebookView); this screen is only its hands: a transparent layer
// that turns pages and a small hint strip with the page number. Opened and closed from C++
// (UNotebookControllerComponent, off Input.Behavior.Overview), which owns the input situation,
// so like the old Overview it has no inputModeTag and Escape goes back through
// UI.Cmd.Notebook.Close.
//
// Turning: mouse wheel, left click, right click (previous), arrow keys, Page Up/Down,
// Home (front cover) and End (back cover). A click carries where it landed, and C++ traces it
// against the book: a left click is sent with no delta of its own, so C++ decides whether it hit
// the Previous / Next buttons printed at the foot of the page, a divider tab (that department), or
// nothing (the next page). Repeated turns while a page is still moving simply retarget the book,
// so a spin of the wheel fans several pages round the coil at once.
//
// Channels
//   in  UI.Notebook.State        { Page, PageCount }
//   out UI.Cmd.Notebook.Turn     { Delta, Page, X, Y }  (Page >= 0 jumps straight there; X/Y a click's view fraction, -1 for none;
//                                                        Delta 0 with X/Y is a left click for C++ to place)
//   out UI.Cmd.Notebook.Close
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  var S = '[data-screen="Notebook"] ';
  var STYLE = [
    S + '#nb-layer { position:fixed; inset:0; pointer-events:auto; background:transparent; cursor:default; }',
    S + '#nb-hint { position:fixed; left:50%; bottom:4vh; transform:translateX(-50%); display:flex; gap:14px; align-items:center;',
    '  padding:6px 14px; background:var(--paper, #f3ecd9); color:var(--ink, #111); border:2px solid var(--ink, #111);',
    '  box-shadow:4px 4px 0 var(--ink, #111); font-family:var(--font-body); font-size:12px; white-space:nowrap; }',
    S + '#nb-page { font-family:var(--font-display); font-size:18px; letter-spacing:0.04em; }',
    S + '#nb-hint kbd { font-family:var(--font-body); font-weight:700; padding:0 5px; border:1px solid currentColor; border-radius:3px; }',
  ].join('\n');

  var TEMPLATE = ''
    + '<div id="nb-layer" aria-label="Notebook">'
    +   '<div id="nb-hint">'
    +     '<span id="nb-page">Front cover</span>'
    +     '<span>Click Previous / Next or scroll to turn · <kbd>Tab</kbd> or <kbd>Esc</kbd> to put away</span>'
    +   '</div>'
    + '</div>';

  var state = { Page: 0, PageCount: 0 };
  var els = {};
  var visible = false;
  var wheelCarry = 0;

  function injectStyles() {
    if (document.getElementById('nb-style')) return;
    document.head.appendChild(TSIC.el('style', { id: 'nb-style' }, STYLE));
  }

  function pageLabel() {
    if (state.Page <= 0) return 'Front cover';
    if (state.PageCount > 0 && state.Page >= state.PageCount) return 'Back cover';
    return 'Page ' + state.Page + ' of ' + Math.max(1, state.PageCount - 1);
  }

  function render() {
    if (els.page) els.page.textContent = pageLabel();
  }

  function turn(delta, ev) {
    if (!delta) return;
    var at = ev
      ? { X: ev.clientX / Math.max(1, window.innerWidth), Y: ev.clientY / Math.max(1, window.innerHeight) }
      : { X: -1, Y: -1 };
    window.tsic.publishMessage('UI.Cmd.Notebook.Turn', { Delta: delta, Page: -1, X: at.X, Y: at.Y });
    if (window.tsic.playSound) window.tsic.playSound('UI.Hover');
  }

  // A left click: where it landed decides (a printed button, a tab, or the next page).
  function click(ev) {
    window.tsic.publishMessage('UI.Cmd.Notebook.Turn', {
      Delta: 0,
      Page: -1,
      X: ev.clientX / Math.max(1, window.innerWidth),
      Y: ev.clientY / Math.max(1, window.innerHeight),
    });
    if (window.tsic.playSound) window.tsic.playSound('UI.Hover');
  }

  function jump(page) {
    window.tsic.publishMessage('UI.Cmd.Notebook.Turn', { Delta: 0, Page: page, X: -1, Y: -1 });
  }

  function onKey(ev) {
    if (!visible) return;
    switch (ev.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': turn(1); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': turn(-1); break;
      case 'Home': jump(0); break;
      case 'End': jump(state.PageCount); break;
      default: return;
    }
    ev.preventDefault();
  }

  TSIC.registerScreen('Notebook', {
    template: TEMPLATE,
    // No inputModeTag: UNotebookControllerComponent owns the input situation, so the player keeps
    // walking and nothing here can strand a mode tag if the screen is taken away underneath it.
    cancelCmd: 'UI.Cmd.Notebook.Close',
    screenSoundOpen: 'UI.Open',
    screenSoundClose: 'UI.Back',

    mount: function (root) {
      injectStyles();
      els.layer = root.querySelector('#nb-layer');
      els.page = root.querySelector('#nb-page');

      els.layer.addEventListener('wheel', function (ev) {
        // Trackpads send many small deltas: a page per notch-sized amount, not per event.
        wheelCarry += ev.deltaY;
        var steps = Math.trunc(wheelCarry / 60);
        if (steps !== 0) {
          wheelCarry -= steps * 60;
          turn(steps);
        }
        ev.preventDefault();
      }, { passive: false });
      els.layer.addEventListener('mousedown', function (ev) {
        if (ev.button === 0) click(ev);
        else if (ev.button === 2) turn(-1, ev);
      });
      els.layer.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
      document.addEventListener('keydown', onKey, true);

      window.tsic.on('tsic.msg.UI.Notebook.State', function (payload) {
        if (!payload) return;
        state = payload;
        render();
      });
    },

    onShow: function () {
      visible = true;
      wheelCarry = 0;
      render();
    },

    onHide: function () {
      visible = false;
    },
  });
})();
