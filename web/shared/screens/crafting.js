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
        <h2 class="tsic-title" style="margin:0 0 8px;">Crafting</h2>
        <div id="c-station"></div>
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
      (function waitForDeps() {
        if (!window.TSICRecipeInfo || !window.TSIC.RecipeStation) {
          setTimeout(waitForDeps, 16);
          return;
        }
        TSIC.RecipeStation.mount(root.querySelector('#c-station'), {
          kind: 'Crafting',
          actionLabel: 'Craft',
          soundSuccess: 'Craft.Success',
          soundFail: 'Craft.Fail',
        });
      })();

      root.querySelector('#btn-close').addEventListener('click', () => {
        ctx.publish('UI.Cmd.Pause.Resume');
      });
    },
  });
})();
