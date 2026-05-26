// shared/recipe-station.js — Shared two-pane recipe station UI.
//
// Depends on: shared/dom.js (TSIC.el), shared/icons.js (TSIC.itemIconUrl,
//             TSIC.iconImg), shared/recipe-info.js (TSICRecipeInfo)
//
// Usage:
//   var station = TSIC.RecipeStation.mount(rootEl, {
//     kind:         'Crafting',             // filter StationOpened by Kind
//     actionLabel:  'Craft',                // button text
//     onAction:     function(recipeId, ctx){}, // called when action triggered
//     renderExtra:  function(host, data){}, // optional extra pane content
//     emptyText:    'No recipes available.',// placeholder when list is empty
//     soundSuccess: 'Craft.Success',        // sound on successful action
//     soundFail:    'Craft.Fail',           // sound on toast warning/error
//     rowName:      function(recipe, cat){},// optional: override display name
//     rowIcon:      function(recipe){},     // optional: override icon item ID
//     rowRight:     function(recipe){},     // optional: override right-side text
//     isLocked:     function(recipe){},     // optional: override locked state
//     canAction:    function(recipe, mats){},// optional: override canCraft check
//     renderInfo:   function(host, recipe, mats){}, // optional: override detail pane
//   });
//   station.destroy();
//
(function () {
  'use strict';

  function mount(rootEl, opts) {
    var kind = opts.kind;
    var actionLabel = opts.actionLabel || 'Confirm';
    var emptyText = opts.emptyText || 'No recipes available.';
    var soundSuccess = opts.soundSuccess || null;
    var soundFail = opts.soundFail || null;

    var stationId = null;
    var lastStation = null;
    var materialCounts = {};
    var selectedRecipeId = null;
    var actionPendingAt = 0;

    // --- DOM scaffold ---
    var listPane = document.createElement('div');
    listPane.className = 'tsic-list-pane';
    listPane.setAttribute('data-tsic-focus-group', 'rs-list');

    var listCol = document.createElement('div');
    listCol.className = 'tsic-split-col';
    var listEyebrow = document.createElement('div');
    listEyebrow.className = 'tsic-eyebrow';
    listEyebrow.textContent = 'Recipes';
    listCol.appendChild(listEyebrow);
    listCol.appendChild(listPane);

    var infoPane = document.createElement('div');
    infoPane.style.cssText = 'padding:10px; background:rgba(241,229,207,0.88); border:1px solid var(--tsic-border); flex:1 1 auto; overflow:auto; min-height:0;';

    var actionBtn = document.createElement('button');
    actionBtn.className = 'tsic-button';
    actionBtn.disabled = true;
    actionBtn.textContent = actionLabel;
    actionBtn.style.cssText = 'width:100%; padding:8px; flex:0 0 auto;';

    var detailCol = document.createElement('div');
    detailCol.className = 'tsic-split-col';
    var detailEyebrow = document.createElement('div');
    detailEyebrow.className = 'tsic-eyebrow';
    detailEyebrow.textContent = 'Details';
    detailCol.appendChild(detailEyebrow);
    detailCol.appendChild(infoPane);
    detailCol.appendChild(actionBtn);

    // Optional extra content area (e.g. production queue)
    var extraHost = null;
    if (typeof opts.renderExtra === 'function') {
      extraHost = document.createElement('div');
      extraHost.style.cssText = 'flex:0 0 auto;';
      detailCol.appendChild(extraHost);
    }

    var split = document.createElement('div');
    split.className = 'tsic-split';
    split.appendChild(listCol);
    split.appendChild(detailCol);

    rootEl.appendChild(split);

    // --- Delegates (overrideable per-screen) ---

    function isLocked(r) {
      if (typeof opts.isLocked === 'function') return opts.isLocked(r);
      return !r.bDiscovered || !r.bStationLevelSufficient;
    }

    function canAction(recipe) {
      if (typeof opts.canAction === 'function') return opts.canAction(recipe, materialCounts);
      return window.TSICRecipeInfo.canCraft(recipe, materialCounts);
    }

    function getRowIcon(r) {
      if (typeof opts.rowIcon === 'function') return opts.rowIcon(r);
      if (!r.bDiscovered) return '';
      return (r.Outputs && r.Outputs[0] && r.Outputs[0].ItemId) || '';
    }

    function getRecipeName(r) {
      var cat = (window.tsic && window.tsic.itemCatalog) || {};
      if (typeof opts.rowName === 'function') return opts.rowName(r, cat);
      if (!r.bDiscovered) return '???';
      var outId = (r.Outputs && r.Outputs[0] && r.Outputs[0].ItemId) || '';
      return (cat[outId] && cat[outId].Name) || r.Name || r.RecipeId;
    }

    function getRowRight(r) {
      if (typeof opts.rowRight === 'function') return opts.rowRight(r);
      if (!r.bStationLevelSufficient) return 'lvl ' + r.RequiredStationLevel;
      return '';
    }

    // --- Rendering ---

    function renderList() {
      listPane.innerHTML = '';
      if (!lastStation) return;
      var recipes = lastStation.Recipes || [];
      if (recipes.length === 0) {
        listPane.appendChild(Object.assign(document.createElement('div'),
          { className: 'tsic-empty', textContent: emptyText }));
        return;
      }
      for (var i = 0; i < recipes.length; i++) {
        (function (r) {
          var locked = isLocked(r);
          var row = document.createElement('div');
          row.className = 'tsic-list-row'
            + (selectedRecipeId === r.RecipeId ? ' is-selected' : '')
            + (locked ? ' is-locked' : '');
          row.setAttribute('data-tsic-focusable', '');
          row.tabIndex = -1;

          var iconWrap = document.createElement('div');
          iconWrap.className = 'icon';
          var iconId = getRowIcon(r);
          if (iconId) {
            iconWrap.appendChild(TSIC.iconImg(TSIC.itemIconUrl(iconId)));
          }
          row.appendChild(iconWrap);

          var name = document.createElement('div');
          name.className = 'name';
          name.textContent = getRecipeName(r);
          row.appendChild(name);

          var rightText = getRowRight(r);
          if (rightText) {
            var right = document.createElement('div');
            right.className = 'right';
            right.textContent = rightText;
            row.appendChild(right);
          }

          var selectRecipe = function () { selectedRecipeId = r.RecipeId; renderAll(); };
          var commitRecipe = function () {
            selectRecipe();
            if (!actionBtn.disabled) actionBtn.click();
          };
          row.addEventListener('click', selectRecipe);
          row.addEventListener('focusin', selectRecipe);
          row.addEventListener('dblclick', commitRecipe);
          row.addEventListener('tsic:confirm', function (e) { e.preventDefault(); commitRecipe(); });
          listPane.appendChild(row);
        })(recipes[i]);
      }
    }

    function renderInfoPane(recipe) {
      if (typeof opts.renderInfo === 'function') {
        opts.renderInfo(infoPane, recipe, materialCounts);
      } else {
        window.TSICRecipeInfo.render(infoPane, recipe, materialCounts);
      }
      actionBtn.disabled = !recipe || !canAction(recipe);
    }

    function renderAll() {
      renderList();
      var recipe = lastStation
        ? (lastStation.Recipes || []).find(function (r) { return r.RecipeId === selectedRecipeId; })
        : null;
      renderInfoPane(recipe);
      if (extraHost && typeof opts.renderExtra === 'function') {
        opts.renderExtra(extraHost, {
          stationId: stationId,
          lastStation: lastStation,
          materialCounts: materialCounts,
          selectedRecipeId: selectedRecipeId
        });
      }
    }

    // --- Events ---

    function onStationOpened(p) {
      if (!p || p.Kind !== kind) return;
      stationId = p.StationId;
      lastStation = p;
      materialCounts = p.MaterialCounts || {};
      if (!selectedRecipeId && (p.Recipes || []).length > 0) {
        selectedRecipeId = p.Recipes[0].RecipeId;
      }
      renderAll();
    }

    function onToast(p) {
      if (!p || !soundFail) return;
      var sev = (p.Severity && p.Severity.TagName) || '';
      if (Date.now() - actionPendingAt < 500 && /Warning|Error/i.test(sev)) {
        tsic.publishMessage('UI.Cmd.Sound.Play', { SoundKey: soundFail, VolumeScale: 1.0 });
      }
    }

    function onCatalogUpdate() { renderAll(); }

    function onActionClick() {
      var recipe = lastStation
        ? (lastStation.Recipes || []).find(function (r) { return r.RecipeId === selectedRecipeId; })
        : null;
      if (!recipe || !canAction(recipe)) return;
      actionPendingAt = Date.now();
      if (typeof opts.onAction === 'function') {
        opts.onAction(recipe.RecipeId, { stationId: stationId, recipe: recipe });
      } else {
        tsic.publishMessage('UI.Cmd.Recipe.Start', { Kind: kind, StationId: stationId, RecipeId: recipe.RecipeId, Count: 1 });
      }
      if (soundSuccess) {
        tsic.publishMessage('UI.Cmd.Sound.Play', { SoundKey: soundSuccess, VolumeScale: 1.0 });
      }
    }

    actionBtn.addEventListener('click', onActionClick);

    // Subscribe
    tsic.on('tsic.msg.UI.Recipe.StationOpened', onStationOpened);
    if (soundFail) tsic.on('tsic.msg.UI.Toast.Show', onToast);
    window.addEventListener('tsic-item-catalog', onCatalogUpdate);

    // --- Cleanup ---

    function destroy() {
      window.removeEventListener('tsic-item-catalog', onCatalogUpdate);
      actionBtn.removeEventListener('click', onActionClick);
      if (split.parentNode) split.parentNode.removeChild(split);
    }

    return {
      destroy: destroy,
      /** Force a full re-render (useful after external state changes). */
      refresh: renderAll,
      /** Direct access for screens that need to read internal state. */
      getStationId:      function () { return stationId; },
      getSelectedRecipe: function () {
        return lastStation
          ? (lastStation.Recipes || []).find(function (r) { return r.RecipeId === selectedRecipeId; })
          : null;
      }
    };
  }

  window.TSIC = window.TSIC || {};
  window.TSIC.RecipeStation = { mount: mount };
})();
