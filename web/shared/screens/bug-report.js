// BugReport screen module — registered with TSIC.registerScreen, mounted as
// an overlay by shared/screen-manager.js. Was screens/bug-report.html
// (that page is now a thin standalone host for tests/playground).
//
// Publishes UI.Cmd.BugReport.Submit {Category, Description, bIncludeScreenshot,
// bIncludeLog}; the director forwards it to BugReportContextSubsystem which
// posts to the telemetry server and toasts the async result. Cancel/Esc
// publishes UI.Cmd.BugReport.Close (the director routes it back to whichever
// screen was up when the form opened — pause menu, main menu, or gameplay when
// it was opened with the Report a Bug hotkey).
//
// Shift+Enter sends. Plain Enter is a newline: the description is free text and
// players write multi-line repro steps.
//
// Two categories, Bug and Suggestion, and that is the whole vocabulary. Earlier
// drafts also offered "World generation issue" and "Other": "Other" was picked
// zero times in 174 real reports, and the world-gen one asked the player to
// classify a fault they had only just noticed — which is triage's job, not
// theirs, and got it wrong often enough that the label was worth less than no
// label. Both are gone; what they were for lives on below.
//
// A bug report asks C++ to trace for the furniture under the crosshair
// (UI.Cmd.BugReport.RequestFurnitureTarget -> UI.BugReport.FurnitureTarget) and
// shows the player what was picked. This is what the world-gen category used to
// exist for, and it is strictly better here: the diagnostics ride along with
// every bug about a specific object, whether or not the player would have
// thought to call it world generation. It is attached when the ray finds
// something and simply omitted when it does not — never a precondition, because
// a report the player cannot send is a report nobody reads.
//
// There is deliberately no Crash category: a crash report is filed by the crash
// handler, not by a player who is still in the pause menu.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    // screen-manager.js installs TSIC.registerScreen — retry until ready.
    setTimeout(register, 16);
    return;
  }

  // The two category ids the form can send. Both are matched by name on the C++
  // side (BugReportContextSubsystem::BuildReportJson), so these strings are wire
  // format: changing one changes what lands in the telemetry inbox.
  const BUG_CATEGORY = 'Bug';
  const SUGGESTION_CATEGORY = 'Suggestion';
  // What a category falls back to when the dropdown has no value — a bug, since
  // that is what the form opens on and what nearly every report turns out to be.
  const DEFAULT_CATEGORY = BUG_CATEGORY;

  const STYLE = `
    [data-screen="BugReport"] #br-overlay { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:auto; }
    [data-screen="BugReport"] .field { display:flex; flex-direction:column; gap:4px; margin-top: 10px; }
    [data-screen="BugReport"] .field > label { font-size:11px; letter-spacing:1px; color: rgba(59,47,28,0.75); text-transform:uppercase; }
    [data-screen="BugReport"] .field > textarea {
      background: transparent;
      color: var(--cat-ink-dark);
      border: 1px solid var(--tsic-border);
      padding: 6px 8px;
      font: inherit;
      outline: none;
    }
    [data-screen="BugReport"] .field > textarea { min-height: 120px; resize: vertical; }
    [data-screen="BugReport"] .field > textarea.br-invalid { border-color: #b03030; }
    [data-screen="BugReport"] .check-row { display:flex; align-items:center; gap:8px; margin-top: 8px; }
    [data-screen="BugReport"] .check-row > input { accent-color: var(--tsic-accent); }
    [data-screen="BugReport"] #br-hint { font-size:11px; color:#b03030; margin-top:6px; visibility:hidden; }
    [data-screen="BugReport"] #br-submit-hint { font-size:11px; letter-spacing:1px; text-transform:uppercase; color: rgba(59,47,28,0.6); margin-right:auto; align-self:center; }
    [data-screen="BugReport"] #br-furniture { display:none; margin-top:10px; padding:8px 10px; border:1px solid var(--tsic-border); font-size:12px; line-height:1.5; }
    /* A RESERVED box, not one the trace result sizes. The block starts as one line of
       "Looking for furniture…" and is replaced, a frame or two later, by the name plus four
       detail rows: measured 36px -> 139px typical, 175px worst. The dialog is vertically
       centred, so that growth pushed the panel's top edge 69px UP and took Submit and Cancel
       with it — while the player was already reaching for one of them. Fixed height, and
       the rare over-long definition id scrolls inside it. (issue #273) */
    [data-screen="BugReport"] #br-furniture.br-shown {
      display:block; height:150px; overflow:auto; scrollbar-gutter:stable;
    }
    [data-screen="BugReport"] #br-furniture dl { display:grid; grid-template-columns:auto 1fr; gap:2px 10px; margin:4px 0 0; }
    [data-screen="BugReport"] #br-furniture dt { color:rgba(59,47,28,0.7); text-transform:uppercase; font-size:10px; letter-spacing:1px; align-self:center; }
    [data-screen="BugReport"] #br-furniture dd { margin:0; }
    [data-screen="BugReport"] #br-furniture .br-name { font-weight:600; }
    [data-screen="BugReport"] #br-furniture .br-note { color:rgba(59,47,28,0.7); font-size:11px; letter-spacing:1px; text-transform:uppercase; margin-bottom:4px; }
  `;

  const TEMPLATE = `
    <div id="br-overlay" class="tsic-modal-scrim">
      <div class="tsic-panel" style="width:460px;max-height:90vh;display:flex;flex-direction:column;">
        <h2 id="br-title" class="tsic-title tsic-title--sm">Report a Bug</h2>

        <div data-tsic-focus-group="form-fields">
          <div class="field">
            <label for="br-category">Category</label>
            <!-- tsic-dropdown, not a native <select>: CEF's native select popup renders
                 through a Slate menu that misplaces/flips under accelerated paint. -->
            <button id="br-category" type="button" class="tsic-dropdown" data-tsic-focusable
                    data-tsic-value="Bug"
                    data-tsic-options='[
                      {"value":"Bug","label":"Bug"},
                      {"value":"Suggestion","label":"Suggestion"}]'>
              <span class="tsic-dropdown-label">Bug</span>
              <span class="tsic-dropdown-caret">▾</span>
            </button>
          </div>

          <!-- Shown for a bug report: what the view ray hit, attached to the report. -->
          <div id="br-furniture" aria-live="polite"></div>

          <div class="field">
            <label for="br-description">Description</label>
            <!-- Enter inserts a newline; Shift+Enter submits (see the keydown handler). -->
            <textarea id="br-description" placeholder="What happened? Steps to reproduce…" maxlength="4000"
                      data-tsic-focusable data-tsic-initial-focus></textarea>
            <div id="br-hint">Please describe what happened before submitting.</div>
          </div>

          <label class="check-row">
            <input id="br-screenshot" type="checkbox" checked>
            <span>Include screenshot</span>
          </label>
          <label class="check-row">
            <input id="br-log" type="checkbox" checked>
            <span>Include game log</span>
          </label>
        </div>

        <div class="tsic-button-row" data-tsic-focus-group="actions">
          <span id="br-submit-hint">Shift + Enter to send</span>
          <button class="tsic-button" id="btn-cancel">Cancel</button>
          <button class="tsic-button" id="btn-submit">Submit</button>
        </div>
      </div>
    </div>
  `;

  function injectStyleOnce() {
    if (document.getElementById('screen-bug-report-style')) return;
    const s = document.createElement('style');
    s.id = 'screen-bug-report-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  TSIC.registerScreen('BugReport', {
    inputModeTag: 'InputMode.Menu.Generic',
    cancelCmd: 'UI.Cmd.BugReport.Close',
    actionBarContext: [
      { ActionName: 'IA_UI_CancelBack', Label: 'Back', Priority: 1000 },
    ],
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();

      const description = root.querySelector('#br-description');
      const hint = root.querySelector('#br-hint');
      const category = root.querySelector('#br-category');
      const furniture = root.querySelector('#br-furniture');

      // Latest UI.BugReport.FurnitureTarget payload; null until C++ answers.
      let target = null;

      function renderFurniture() {
        // A suggestion is about the game, not about an object in front of you, so
        // it neither shows the panel nor sends the snapshot.
        const wantsTarget = tsic.dropdown.get(category) !== SUGGESTION_CATEGORY;
        furniture.classList.toggle('br-shown', wantsTarget);
        if (!wantsTarget) return;

        if (target === null) {
          furniture.textContent = 'Looking for furniture…';
          return;
        }
        if (!target.bHasTarget) {
          // Never an error state. Plenty of bugs are not about anything you can
          // aim at, and the report goes out regardless.
          furniture.textContent = 'Nothing under the crosshair — the report will be sent without an object attached.';
          return;
        }

        // TSIC.el takes children as variadic arguments, not an array.
        const rows = [
          ['Definition', target.DefinitionId || '—'],
          ['Map', target.MapName || '—'],
          ['Tile', target.TileIndex >= 0 ? `${target.TileIndex} (${target.TileCoord || '?'})` : '—'],
          ['Placement', target.bMoved
            ? 'Moved since the level generated it'
            : 'As the level generated it'],
        ].flatMap(([label, value]) => [
          TSIC.el('dt', {}, label),
          TSIC.el('dd', {}, value),
        ]);
        const children = [
          TSIC.el('div', { class: 'br-name' },
            target.DisplayName || target.DefinitionId || 'Unknown furniture'),
          TSIC.el('dl', {}, ...rows),
        ];
        // Say why furniture details are on a bug report at all.
        children.unshift(TSIC.el('div', { class: 'br-note' }, 'Attaching what you are looking at'));
        furniture.replaceChildren(...children);
      }

      // Ask C++ to trace now. The reply lands on UI.BugReport.FurnitureTarget.
      function requestTarget() {
        target = null;
        renderFurniture();
        ctx.publish('UI.Cmd.BugReport.RequestFurnitureTarget');
      }

      ctx.on('tsic.msg.UI.BugReport.FurnitureTarget', (payload) => {
        target = payload || { bHasTarget: false };
        renderFurniture();
      });

      // The form is reached by two different keys (GH #352), so the heading names
      // the category rather than always claiming to be a bug report.
      const TITLES = {
        Bug: 'Report a Bug',
        Suggestion: 'Suggest Something',
      };
      const title = root.querySelector('#br-title');
      function renderTitle() {
        const chosen = tsic.dropdown.get(category) || DEFAULT_CATEGORY;
        title.textContent = TITLES[chosen] || TITLES[DEFAULT_CATEGORY];
      }

      // tsic.dropdown.set fires tsic-change on the trigger; re-render the panel
      // so switching between Bug and Suggestion shows or hides what the ray found.
      category.addEventListener('tsic-change', () => { renderFurniture(); renderTitle(); });
      ctx.renderTitle = renderTitle;

      description.addEventListener('input', () => {
        description.classList.remove('br-invalid');
        hint.style.visibility = 'hidden';
      });

      function submit() {
        const chosen = tsic.dropdown.get(category) || DEFAULT_CATEGORY;
        const desc = (description.value || '').trim();
        if (!desc) {
          description.classList.add('br-invalid');
          hint.style.visibility = 'visible';
          tsic.playSound('UI.Error', 0.4);
          try { description.focus({ preventScroll: true }); } catch (e) { /* noop */ }
          return;
        }
        tsic.playSound('BugReport.Submit', 0.45);
        ctx.publish('UI.Cmd.BugReport.Submit', {
          Category: chosen,
          Description: desc,
          bIncludeScreenshot: !!root.querySelector('#br-screenshot').checked,
          bIncludeLog: !!root.querySelector('#br-log').checked,
        });
        description.value = '';
        // Close, not Pause.Resume. Close routes back to whichever screen the form was
        // opened from (pause menu, main menu, gameplay) and clears the furniture snapshot
        // so it can't ride along on the next report; Resume forces gameplay, which from
        // the main menu left the player looking at the menu level with no UI (#150).
        ctx.publish('UI.Cmd.BugReport.Close');
      }

      // Shift+Enter sends; plain Enter stays a newline in the description. Bound on
      // the panel rather than the textarea so it also works from the checkboxes and
      // the category dropdown. Enter is not the game's Accept key (that is Space),
      // so nothing else in the menu stack competes for this chord.
      root.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' || !ev.shiftKey) return;
        if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
        ev.preventDefault();
        submit();
      });

      root.querySelector('#btn-submit').onclick = submit;
      root.querySelector('#btn-cancel').onclick = () => {
        tsic.playSound('BugReport.Cancel', 0.4);
        ctx.publish('UI.Cmd.BugReport.Close');
      };

      ctx.requestTarget = requestTarget;
      ctx.renderFurniture = renderFurniture;
    },

    onShow(params, ctx) {
      // Stale validation state shouldn't survive a close/reopen.
      const description = ctx.root.querySelector('#br-description');
      description.classList.remove('br-invalid');
      ctx.root.querySelector('#br-hint').style.visibility = 'hidden';

      // Opened by one of the two per-category report keys (router.js, GH #352) — start
      // on the category that key stands for. Read here rather than in mount() because
      // mount runs once and the screen is reused for every later open. Consumed on
      // read, so opening the form from the pause menu falls back to the markup
      // default instead of whichever key was pressed last.
      if (window.TSIC && window.TSIC.pendingReportCategory) {
        const preset = window.TSIC.pendingReportCategory;
        window.TSIC.pendingReportCategory = null;
        tsic.dropdown.set('#br-category', preset);
      }
      if (ctx.renderTitle) ctx.renderTitle();

      // Re-trace every time the form opens — the snapshot is only valid for the
      // view the player froze on this trip through the pause menu.
      if (ctx.requestTarget) ctx.requestTarget();

      // Land in the description so the player can type straight away. focusTextField,
      // not description.focus(): the view does not hold keyboard focus at this point, so
      // Chromium would move activeElement without firing focusin and the keystrokes would
      // go to gameplay instead of the box.
      //
      // Deferred past the first frame's layout by double rAF, NOT setTimeout(0): the
      // focus() inside forces a synchronous style+layout pass, and a timer fires before
      // the first frame while the overlay subtree is still maximally dirty — traced at
      // ~19ms of Layout inside this one callback, all of BugReport's first-frame cost.
      // A single rAF runs before that frame's own layout, so the tree is still dirty
      // there (same finding as screen-manager's deferred ctx.focus). Two frames later
      // the read is free. This also runs after the screen is actually visible, which
      // the old timer only probabilistically did — focusing a display:none textarea
      // does nothing.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (ctx.isVisible && !ctx.isVisible()) return;
        if (typeof tsic.focusTextField === 'function') {
          tsic.focusTextField(description);
          return;
        }
        // Harness and any host without the capture shim: plain focus still puts the
        // caret in the right place, it just cannot claim the keyboard from gameplay.
        try { description.focus({ preventScroll: true }); } catch (e) { /* noop */ }
      }));
    },
  });
})();
