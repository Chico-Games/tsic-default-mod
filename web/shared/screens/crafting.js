// Crafting screen module. Was screens/crafting.html.
//
// Tiny module — the whole UI is built by TSIC.RecipeStation.mount(); we just
// own the panel chrome + close button.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const TEMPLATE = `
    <div id="c-root" class="tsic-modal-scrim">
      <div id="c-panel" class="tsic-panel tsic-panel--screen">
        <!-- The station names this title, so it holds ONE line and truncates. A long
             name wrapping to two took 26px off the recipe list below it and moved the
             list down by the same amount — at 1280x720, which is a window people play
             in. (issue #273) -->
        <h2 class="tsic-title" id="c-title"
            style="margin:0 0 8px;flex:0 0 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Crafting</h2>
        <div id="c-station" class="tsic-station-host"></div>
        <div class="tsic-close-row">
          <button class="tsic-button" id="btn-close" data-tsic-initial-focus>Close (Esc)</button>
        </div>
      </div>
    </div>
  `;

  TSIC.registerScreen('Crafting', {
    inputModeTag: 'InputMode.Menu.Crafting',
    cancelCmd: 'UI.Cmd.Pause.Resume',
    actionBarContext: [
      { ActionName: 'IA_UI_ConfirmAccept', Label: 'Craft', Priority: 10 },
    ],
    template: TEMPLATE,

    mount(root, ctx) {
      // Title itself per station ("Weapon Bench", "First Aid Station", ...) —
      // crafting is station-only, so the generic "Crafting" only shows until
      // the first snapshot lands.
      const titleEl = root.querySelector('#c-title');
      ctx.on('tsic.msg.UI.Recipe.StationOpened', (p) => {
        if (!p || p.Kind !== 'Crafting' || !titleEl) return;
        titleEl.textContent = p.StationName || 'Crafting';
      });

      (function waitForDeps() {
        if (!window.TSICRecipeInfo || !window.TSIC.RecipeStation) {
          setTimeout(waitForDeps, 16);
          return;
        }
        TSIC.RecipeStation.mount(root.querySelector('#c-station'), {
          kind: 'Crafting',
          actionLabel: 'Craft',
          soundSuccess: 'Craft.Success',
          soundWorking: 'Craft.Working',
          soundFail: 'Craft.Fail',
        });
      })();

      root.querySelector('#btn-close').addEventListener('click', () => {
        ctx.publish('UI.Cmd.Pause.Resume');
      });
    },
  });
})();
