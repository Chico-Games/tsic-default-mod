// BugReport screen module — registered with TSIC.registerScreen, mounted as
// an overlay by shared/screen-manager.js. Was screens/bug-report.html
// (that page is now a thin standalone host for tests/playground).
//
// Publishes UI.Cmd.BugReport.Submit {Category, Description, bIncludeScreenshot,
// bIncludeLog}; the director forwards it to BugReportContextSubsystem which
// posts to BugSplat and toasts the async result. Cancel/Esc publishes
// UI.Cmd.BugReport.Close (routes back to PauseMenu or MainMenu).
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    // screen-manager.js installs TSIC.registerScreen — retry until ready.
    setTimeout(register, 16);
    return;
  }

  const STYLE = `
    [data-screen="BugReport"] #br-overlay { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:auto; }
    [data-screen="BugReport"] .field { display:flex; flex-direction:column; gap:4px; margin-top: 10px; }
    [data-screen="BugReport"] .field > label { font-size:11px; letter-spacing:1px; color: rgba(59,47,28,0.75); text-transform:uppercase; }
    [data-screen="BugReport"] .field > select, [data-screen="BugReport"] .field > textarea {
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
  `;

  const TEMPLATE = `
    <div id="br-overlay" class="tsic-modal-scrim">
      <div class="tsic-panel" style="width:460px;max-height:90vh;display:flex;flex-direction:column;">
        <h2 class="tsic-title tsic-title--sm">Report a Bug</h2>

        <div data-tsic-focus-group="form-fields">
          <div class="field">
            <label for="br-category">Category</label>
            <select id="br-category" data-tsic-focusable>
              <option value="Gameplay">Gameplay</option>
              <option value="UI">UI</option>
              <option value="Crash">Crash</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div class="field">
            <label for="br-description">Description</label>
            <textarea id="br-description" placeholder="What happened? Steps to reproduce…" maxlength="4000"></textarea>
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
          <button class="tsic-button" id="btn-cancel">Cancel</button>
          <button class="tsic-button" id="btn-submit" data-tsic-initial-focus>Submit</button>
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

      description.addEventListener('input', () => {
        description.classList.remove('br-invalid');
        hint.style.visibility = 'hidden';
      });

      root.querySelector('#btn-submit').onclick = () => {
        const desc = (description.value || '').trim();
        if (!desc) {
          description.classList.add('br-invalid');
          hint.style.visibility = 'visible';
          try { description.focus({ preventScroll: true }); } catch (e) { /* noop */ }
          return;
        }
        ctx.publish('UI.Cmd.BugReport.Submit', {
          Category: root.querySelector('#br-category').value || 'Other',
          Description: desc,
          bIncludeScreenshot: !!root.querySelector('#br-screenshot').checked,
          bIncludeLog: !!root.querySelector('#br-log').checked,
        });
        description.value = '';
        ctx.publish('UI.Cmd.Pause.Resume');
      };
      root.querySelector('#btn-cancel').onclick = () => ctx.publish('UI.Cmd.BugReport.Close');
    },

    onShow(params, ctx) {
      // Stale validation state shouldn't survive a close/reopen.
      const description = ctx.root.querySelector('#br-description');
      description.classList.remove('br-invalid');
      ctx.root.querySelector('#br-hint').style.visibility = 'hidden';
    },
  });
})();
