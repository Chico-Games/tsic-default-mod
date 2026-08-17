// Boss summoner screen module. Was screens/boss-summoner.html.
//
// Same shape as Crafting — TSIC.RecipeStation.mount() builds the whole UI — but
// boss recipes are rituals: they may have no Outputs, and undiscovered ones stay
// locked rather than merely unaffordable.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const TEMPLATE = `
    <div id="bs-root" class="tsic-modal-scrim">
      <div id="bs-panel" class="tsic-panel tsic-panel--screen">
        <!-- One line, truncated: the altar names this title and a wrap shortens the
             ritual list below it. Same rule as the crafting and shop panels. (issue #273) -->
        <h2 class="tsic-title" id="bs-title"
            style="margin:0 0 8px;flex:0 0 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Boss Summoner</h2>
        <div id="bs-station" class="tsic-station-host"></div>
        <div class="tsic-close-row">
          <button class="tsic-button" id="btn-close" data-tsic-initial-focus>Close (Esc)</button>
        </div>
      </div>
    </div>
  `;

  TSIC.registerScreen('BossSummoner', {
    inputModeTag: 'InputMode.Menu.BossSummoner',
    cancelCmd: 'UI.Cmd.Pause.Resume',
    actionBarContext: [
      { ActionName: 'IA_UI_ConfirmAccept', Label: 'Summon', Priority: 10 },
    ],
    template: TEMPLATE,

    mount(root, ctx) {
      // Title itself per altar ("Bone Altar", "Broadcast Altar", ...); the
      // generic heading only shows until the first snapshot lands.
      const titleEl = root.querySelector('#bs-title');
      ctx.on('tsic.msg.UI.Recipe.StationOpened', (p) => {
        if (!p || p.Kind !== 'Boss' || !titleEl) return;
        titleEl.textContent = p.StationName || 'Boss Summoner';
      });

      (function waitForDeps() {
        if (!window.TSICRecipeInfo || !window.TSIC.RecipeStation) {
          setTimeout(waitForDeps, 16);
          return;
        }
        TSIC.RecipeStation.mount(root.querySelector('#bs-station'), {
          kind: 'Boss',
          actionLabel: 'Summon',
          soundSuccess: 'Craft.Success',
          soundWorking: 'Craft.Working',
          soundFail: 'Craft.Fail',
          emptyText: 'No rituals available yet.',
          rowIcon(r) {
            // Boss recipes may not have Outputs; fall back to the first ingredient.
            if (r.bDiscovered === false) return '';
            if (r.Outputs && r.Outputs[0]) return r.Outputs[0].ItemId;
            if (r.Ingredients && r.Ingredients[0]) return r.Ingredients[0].ItemId;
            return '';
          },
          isLocked(r) { return r.bDiscovered === false; },
          canAction(r, mats) {
            if (!r || r.bDiscovered === false) return false;
            for (const ing of (r.Ingredients || [])) {
              if (((mats && mats[ing.ItemId]) || 0) < ing.Count) return false;
            }
            return true;
          },
        });
      })();

      root.querySelector('#btn-close').addEventListener('click', () => {
        ctx.publish('UI.Cmd.Pause.Resume');
      });
    },
  });
})();
