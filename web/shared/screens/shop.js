// Vending machine screen module.
//
// Mirrors screens/crafting.js — RecipeStation does the whole list/detail UI — but filters on
// Kind === 'Shop', so it renders the machine's own store_recipes instead of a bench's recipe list.
// Before this existed a vending machine opened the Crafting screen, which ignores any snapshot whose
// Kind isn't 'Crafting', so it silently kept showing whichever bench you last opened.
//
// Shop rows differ from crafting rows in two ways: the price is the recipe's Coins *input* (so it
// needs no new plumbing), and a capped line carries StockRemaining (-1 = unlimited).
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const COINS_ID = 'ID_Coins_CM';

  const TEMPLATE = `
    <div id="s-root" class="tsic-modal-scrim">
      <div id="s-panel" class="tsic-panel tsic-panel--screen">
        <h2 class="tsic-title" id="s-title" style="margin:0 0 8px;">Vending Machine</h2>
        <div id="s-station" class="tsic-station-host"></div>
        <div class="tsic-close-row">
          <button class="tsic-button" id="btn-close" data-tsic-initial-focus>Close (Esc)</button>
        </div>
      </div>
    </div>
  `;

  const STYLE = `
    [data-screen="Shop"] .s-price { display:inline-flex; align-items:center; gap:3px; font-variant-numeric:tabular-nums; }
    [data-screen="Shop"] .s-stock { margin-left:6px; opacity:0.65; font-size:11px; }
    [data-screen="Shop"] .s-soldout { color:#c2534b; }
    [data-screen="Shop"] #s-wallet { display:flex; align-items:center; gap:5px; padding:4px 0 0; font-size:12px; }
  `;

  // registerScreen has no `style` key — screens inject their own sheet once (see production.js).
  function injectStyleOnce() {
    if (document.getElementById('screen-shop-style')) return;
    const s = document.createElement('style');
    s.id = 'screen-shop-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  /** Coins this recipe costs. The price IS the recipe's only input, so read it straight off. */
  function priceOf(recipe) {
    const ing = (recipe && recipe.Ingredients || []).find(i => i.ItemId === COINS_ID);
    return ing ? ing.Count : 0;
  }

  function stockOf(recipe) {
    // Absent or -1 both mean unlimited; only shop snapshots ever set it.
    const n = recipe && recipe.StockRemaining;
    return (typeof n === 'number') ? n : -1;
  }

  function isSoldOut(recipe) {
    return stockOf(recipe) === 0;
  }

  TSIC.registerScreen('Shop', {
    inputModeTag: 'InputMode.Menu.Crafting',
    cancelCmd: 'UI.Cmd.Pause.Resume',
    actionBarContext: [
      { ActionName: 'IA_UI_ConfirmAccept', Label: 'Buy', Priority: 10 },
    ],
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();
      const titleEl = root.querySelector('#s-title');

      (function waitForDeps() {
        if (!window.TSICRecipeInfo || !window.TSIC.RecipeStation) {
          setTimeout(waitForDeps, 16);
          return;
        }

        TSIC.RecipeStation.mount(root.querySelector('#s-station'), {
          kind: 'Shop',
          actionLabel: 'Buy',
          emptyText: 'This machine is empty.',
          soundSuccess: 'Craft.Success',
          soundFail: 'Craft.Fail',

          // Right-hand column: price, then remaining stock for capped lines.
          rowRight(recipe) {
            const price = priceOf(recipe);
            const stock = stockOf(recipe);
            if (stock === 0) return 'sold out';
            const parts = [price + ' ◉'];
            if (stock > 0) parts.push(stock + ' left');
            return parts.join('   ');
          },

          // Sold-out lines grey out like an undiscovered recipe rather than looking buyable.
          isLocked(recipe) {
            if (isSoldOut(recipe)) return true;
            return !recipe.bDiscovered || !recipe.bStationLevelSufficient;
          },

          canAction(recipe, mats) {
            if (!recipe || isSoldOut(recipe)) return false;
            if (!recipe.bStationLevelSufficient) return false;
            return (mats && mats[COINS_ID] || 0) >= priceOf(recipe);
          },

          // The machine names itself, so "Snack Vending Machine" vs "Black Market" reads correctly.
          renderExtra(host, data) {
            const name = data.lastStation && data.lastStation.StationName;
            if (name && titleEl) titleEl.textContent = name;

            const coins = (data.materialCounts && data.materialCounts[COINS_ID]) || 0;
            host.replaceChildren(
              TSIC.el('div', { id: 's-wallet' }, 'Coins: ' + coins + ' ◉')
            );
          },
        });
      })();

      root.querySelector('#btn-close').addEventListener('click', () => {
        ctx.publish('UI.Cmd.Pause.Resume');
      });
    },
  });
})();
