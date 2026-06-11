// Production screen module. Was screens/production.html.
//
// Unlike Crafting (which delegates to TSIC.RecipeStation), Production owns
// its own queue UI with drag-reorder + per-entry progress bars + a per-row
// add-to-queue button. The bridge subscriptions stay live across opens so
// progress keeps updating in the background; visible-gate prevents wasted
// DOM work while hidden.
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const STYLE = `
    [data-screen="Production"] #p-header { display:flex; align-items:baseline; gap:12px; margin-bottom:8px; }
    [data-screen="Production"] #p-throb { font-size:10px; color:rgba(47,43,34,0.6); letter-spacing:2px; visibility:hidden; }
    [data-screen="Production"] #p-throb.on { visibility:visible; animation: tsic-prod-pulse 1.5s infinite; }
    @keyframes tsic-prod-pulse { 0%, 100% { color:rgba(47,43,34,0.6); } 50% { color:rgba(47,43,34,1.0); } }
    [data-screen="Production"] #p-info { padding:10px; background: rgba(241,229,207,0.88); border:1px solid var(--tsic-border); flex: 0 0 auto; max-height: 50%; overflow:auto; }
    [data-screen="Production"] #p-add { width:100%; padding: 8px; flex: 0 0 auto; }
    [data-screen="Production"] #p-add:disabled { color:rgba(47,43,34,0.4); background:rgba(241,229,207,0.4); cursor:not-allowed; }
    [data-screen="Production"] .q-entry { padding:6px 8px; background: rgba(241,229,207,0.55); border:1px solid var(--tsic-border); display:flex; flex-direction:column; gap:4px; }
    [data-screen="Production"] .q-entry .q-head { display:flex; align-items:center; gap:6px; font-size:12px; }
    [data-screen="Production"] .q-entry .q-head .name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; }
    [data-screen="Production"] .q-bar { height:5px; background: rgba(184,170,145,0.45); }
    [data-screen="Production"] .q-bar > div { height:100%; background:#7fd4ff; transition: width 0.15s; }
    [data-screen="Production"] .q-bar.active > div { background:#7fffae; }
    [data-screen="Production"] .q-cancel { padding: 2px 8px; font-size:10px; min-height: 22px; }
  `;

  const TEMPLATE = `
    <div id="p-root" class="tsic-modal-scrim">
      <div id="p-panel" class="tsic-panel tsic-panel--screen">
        <div id="p-header">
          <h2 class="tsic-title" style="margin:0;">Production</h2>
          <div id="p-throb">PRODUCING…</div>
        </div>

        <div class="tsic-split">
          <div class="tsic-split-col">
            <div class="tsic-eyebrow">Recipes</div>
            <div id="p-list" class="tsic-list-pane"></div>
          </div>
          <div class="tsic-split-col">
            <div class="tsic-eyebrow">Details</div>
            <div id="p-info"></div>
            <button id="p-add" class="tsic-button" disabled>Add to Queue</button>
            <div class="tsic-eyebrow" style="margin-top:6px;">Queue</div>
            <div id="p-queue" class="tsic-list-pane"></div>
          </div>
        </div>

        <div class="tsic-close-row">
          <button class="tsic-button" id="btn-close" data-tsic-initial-focus>Close (Esc)</button>
        </div>
      </div>
    </div>
  `;

  function injectStyleOnce() {
    if (document.getElementById('screen-production-style')) return;
    const s = document.createElement('style');
    s.id = 'screen-production-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  TSIC.registerScreen('Production', {
    inputModeTag: 'InputMode.Menu.Production',
    cancelCmd: 'UI.Cmd.Pause.Resume',
    actionBarContext: [
      { ActionName: 'IA_UI_ConfirmAccept', Label: 'Build', Priority: 10 },
    ],
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();

      let stationId = null;
      let lastStation = null;
      let queue = [];
      let materialCounts = {};
      let selectedRecipeId = null;
      // Per-row bar-inner refs populated during renderQueue, so UI.Recipe.Progress
      // (multi-Hz) can update one width instead of tearing down the whole queue
      // DOM (rebuilds every entry, re-fetches icons, re-attaches drag handlers).
      // Refilled on every QueueChanged rebuild — stale refs from prior renders
      // are dropped with the map.
      let barByIndex = new Map();

      function renderList() {
        const host = root.querySelector('#p-list');
        host.innerHTML = '';
        if (!lastStation) return;
        const cat = window.tsic.itemCatalog || {};
        const recipes = lastStation.Recipes || [];
        if (recipes.length === 0) {
          host.appendChild(Object.assign(document.createElement('div'), { className: 'tsic-empty', textContent: 'No recipes available.' }));
          return;
        }
        for (const r of recipes) {
          const locked = !r.bDiscovered || !r.bStationLevelSufficient;
          const row = document.createElement('div');
          row.className = 'tsic-list-row' + (selectedRecipeId === r.RecipeId ? ' is-selected' : '') + (locked ? ' is-locked' : '');
          row.setAttribute('data-tsic-focusable', '');
          row.tabIndex = -1;

          const iconWrap = document.createElement('div');
          iconWrap.className = 'icon';
          if (r.bDiscovered) {
            const img = TSIC.iconImg(TSIC.itemIconUrl((r.Outputs[0] || {}).ItemId || ''));
            iconWrap.appendChild(img);
          }
          row.appendChild(iconWrap);

          const name = document.createElement('div');
          name.className = 'name';
          name.textContent = r.bDiscovered
            ? ((cat[(r.Outputs[0] || {}).ItemId] || {}).Name || r.Name)
            : '???';
          row.appendChild(name);

          const right = document.createElement('div');
          right.className = 'right';
          if (locked) right.textContent = !r.bDiscovered ? 'undiscovered' : 'station Lv. ↑';
          row.appendChild(right);

          const selectRecipe = () => { selectedRecipeId = r.RecipeId; renderAll(); };
          const commitRecipe = () => {
            selectRecipe();
            const add = root.querySelector('#p-add');
            if (add && !add.disabled) add.click();
          };
          row.addEventListener('click', selectRecipe);
          row.addEventListener('focusin', selectRecipe);
          row.addEventListener('dblclick', commitRecipe);
          row.addEventListener('tsic:confirm', (e) => { e.preventDefault(); commitRecipe(); });
          host.appendChild(row);
        }
      }

      function renderQueue() {
        const host = root.querySelector('#p-queue');
        host.innerHTML = '';
        barByIndex = new Map();
        const cat = window.tsic.itemCatalog || {};
        const recipesById = {};
        for (const r of ((lastStation && lastStation.Recipes) || [])) recipesById[r.RecipeId] = r;
        if (queue.length === 0) {
          host.appendChild(Object.assign(document.createElement('div'), { className: 'tsic-empty', textContent: 'Queue is empty.' }));
        }
        for (const e of queue) {
          const div = document.createElement('div');
          div.className = 'q-entry' + (e.bIsActive ? ' is-active' : '');
          div.dataset.queueIndex = String(e.QueueIndex);
          const r = recipesById[e.RecipeId];
          const itemId = r ? (r.Outputs[0] || {}).ItemId : '';
          const name = (cat[itemId] || {}).Name || e.RecipeId;
          const head = document.createElement('div');
          head.className = 'q-head';
          const nameSpan = document.createElement('span');
          nameSpan.className = 'name';
          nameSpan.textContent = `${e.QueueIndex + 1}. ${name}`;
          head.appendChild(nameSpan);
          const btn = document.createElement('button');
          btn.className = 'tsic-button cancel q-cancel';
          btn.textContent = 'Cancel';
          btn.addEventListener('click', () => {
            ctx.publish('UI.Cmd.Recipe.Cancel', { Kind: 'Production', StationId: stationId, QueueIndex: e.QueueIndex });
            window.tsic.playSound && window.tsic.playSound('Recipe.Removed');
          });
          head.appendChild(btn);
          div.appendChild(head);

          const bar = document.createElement('div');
          bar.className = 'q-bar' + (e.bIsActive ? ' active' : '');
          const inner = document.createElement('div');
          inner.style.width = (Math.max(0, Math.min(1, e.Progress || 0)) * 100).toFixed(1) + '%';
          bar.appendChild(inner);
          div.appendChild(bar);
          barByIndex.set(e.QueueIndex, inner);

          // Drag-reorder. Index 0 is the actively-producing entry and is locked.
          if (e.QueueIndex > 0) {
            div.draggable = true;
            div.addEventListener('dragstart', (ev) => {
              ev.dataTransfer.setData('application/tsic-queue', JSON.stringify({ from: e.QueueIndex }));
              div.classList.add('is-dragging');
            });
            div.addEventListener('dragend', () => div.classList.remove('is-dragging'));
            div.addEventListener('dragover', (ev) => { ev.preventDefault(); div.classList.add('is-drop-target'); });
            div.addEventListener('dragleave', () => div.classList.remove('is-drop-target'));
            div.addEventListener('drop', (ev) => {
              ev.preventDefault();
              div.classList.remove('is-drop-target');
              const raw = ev.dataTransfer.getData('application/tsic-queue');
              if (!raw) return;
              let src;
              try { src = JSON.parse(raw); } catch (_) { return; }
              const targetIndex = e.QueueIndex;
              if (src.from === targetIndex || src.from <= 0) return;
              const moving = queue.splice(src.from, 1)[0];
              queue.splice(targetIndex, 0, moving);
              for (let k = 0; k < queue.length; k++) queue[k].QueueIndex = k;
              renderQueue();
              ctx.publish('UI.Cmd.Recipe.Reorder', {
                Kind: 'Production', StationId: stationId,
                FromIndex: src.from, ToIndex: targetIndex,
              });
            });
          }

          host.appendChild(div);
        }
        const throb = root.querySelector('#p-throb');
        throb.className = queue.some((e) => e.bIsActive) ? 'on' : '';
      }

      // Fast path for UI.Recipe.Progress: only the active row's bar width changes.
      // Avoids the full renderQueue tear-down (which rebuilds every entry, refetches
      // icons, and re-attaches drag handlers) on every progress tick.
      function applyProgress(progress) {
        const clamped = Math.max(0, Math.min(1, progress || 0));
        for (const e of queue) {
          if (!e.bIsActive) continue;
          e.Progress = clamped;
          const inner = barByIndex.get(e.QueueIndex);
          if (inner) inner.style.width = (clamped * 100).toFixed(1) + '%';
        }
      }

      function renderInfo() {
        const recipe = lastStation && (lastStation.Recipes || []).find((r) => r.RecipeId === selectedRecipeId);
        window.TSICRecipeInfo.render(root.querySelector('#p-info'), recipe, materialCounts);
        const btn = root.querySelector('#p-add');
        btn.disabled = !window.TSICRecipeInfo.canCraft(recipe, materialCounts);
      }
      function renderAll() { renderList(); renderQueue(); renderInfo(); }

      (function waitForDeps() {
        if (!window.TSICRecipeInfo) { setTimeout(waitForDeps, 16); return; }

        ctx.on('tsic.msg.UI.Recipe.StationOpened', (p) => {
          if (!p || p.Kind !== 'Production') return;
          stationId = p.StationId;
          lastStation = p;
          materialCounts = p.MaterialCounts || {};
          if (!selectedRecipeId && (p.Recipes || []).length > 0) selectedRecipeId = p.Recipes[0].RecipeId;
          if (ctx.isVisible()) renderAll();
        });
        ctx.on('tsic.msg.UI.Recipe.QueueChanged', (p) => {
          if (!p || p.Kind !== 'Production') return;
          if (stationId && p.StationId !== stationId) return;
          queue = p.Entries || [];
          if (ctx.isVisible()) renderQueue();
        });
        ctx.on('tsic.msg.UI.Recipe.Progress', (p) => {
          if (!p || p.Kind !== 'Production') return;
          if (stationId && p.StationId !== stationId) return;
          if (ctx.isVisible()) applyProgress(p.Progress);
          else for (const e of queue) if (e.bIsActive) e.Progress = p.Progress || 0;
        });
        ctx.on('tsic.msg.UI.Recipe.Completed', (p) => {
          if (p && p.Kind === 'Production') window.tsic.playSound && window.tsic.playSound('Recipe.Completed');
        });
        window.addEventListener('tsic-item-catalog', () => { if (ctx.isVisible()) renderAll(); });

        root.querySelector('#p-add').addEventListener('click', () => {
          const recipe = lastStation && (lastStation.Recipes || []).find((r) => r.RecipeId === selectedRecipeId);
          if (!recipe || !window.TSICRecipeInfo.canCraft(recipe, materialCounts)) return;
          ctx.publish('UI.Cmd.Recipe.Start', { Kind: 'Production', StationId: stationId, RecipeId: recipe.RecipeId, Count: 1 });
          window.tsic.playSound && window.tsic.playSound('Recipe.Added');
        });
        root.querySelector('#btn-close').addEventListener('click', () => {
          ctx.publish('UI.Cmd.Pause.Resume');
        });
      })();
    },
  });
})();
