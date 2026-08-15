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
    [data-screen="Production"] #p-header { display:flex; align-items:baseline; gap:12px; margin-bottom:8px; flex:0 0 auto; }
    /* The station names the title ("Oven", "Sawmill", ...) once its snapshot lands, so a
       title sized by its own text moved the throbber beside it — measured 50px to 767px
       across stations. The title takes the row and truncates; the throbber is anchored to
       the right edge and stays there whatever the station is called. */
    [data-screen="Production"] #p-title {
      flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    [data-screen="Production"] #p-throb { flex:0 0 auto; font-size:10px; color:rgba(47,43,34,0.6); letter-spacing:2px; visibility:hidden; }
    [data-screen="Production"] #p-throb.on { visibility:visible; animation: tsic-prod-pulse 1.5s infinite; }
    @keyframes tsic-prod-pulse { 0%, 100% { color:rgba(47,43,34,0.6); } 50% { color:rgba(47,43,34,1.0); } }
    /* A FIXED share of the column, not a box the selected recipe sizes. It used to be
       flex:0 0 auto with max-height:50%, so selecting a recipe with ingredients grew the
       details box by ~197px and shoved the Add button and the whole queue down the screen —
       the queue row under the cursor became a different row mid-click. The details scroll
       inside their reserved slice instead. */
    [data-screen="Production"] #p-info { padding:10px; background: rgba(241,229,207,0.88); border:1px solid var(--tsic-border); flex: 0 0 44%; min-height:0; overflow:auto; scrollbar-gutter:stable; }
    [data-screen="Production"] #p-add { width:100%; padding: 8px; flex: 0 0 auto; }
    [data-screen="Production"] #p-add:disabled { color:rgba(47,43,34,0.4); background:rgba(241,229,207,0.4); cursor:not-allowed; }
    [data-screen="Production"] .q-entry { padding:6px 8px; background: rgba(241,229,207,0.55); border:1px solid var(--tsic-border); display:flex; flex-direction:column; gap:4px; }
    [data-screen="Production"] .q-entry .q-head { display:flex; align-items:center; gap:6px; font-size:12px; }
    [data-screen="Production"] .q-entry .q-head .name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; }
    [data-screen="Production"] .q-bar { height:5px; background: rgba(184,170,145,0.45); }
    [data-screen="Production"] .q-bar > div { height:100%; background:#7fd4ff; transition: width 0.15s; }
    [data-screen="Production"] .q-bar.active > div { background:#7fffae; }
    [data-screen="Production"] .q-cancel, [data-screen="Production"] .q-take { padding: 2px 8px; font-size:10px; min-height: 22px; }
    [data-screen="Production"] .q-entry.is-done { cursor:pointer; }
    [data-screen="Production"] .q-entry.is-done:hover, [data-screen="Production"] .q-entry.is-done[data-tsic-focused] { background: rgba(127,255,174,0.18); }
    [data-screen="Production"] .q-entry.is-done .q-bar > div { background:#7fffae; }
    [data-screen="Production"] .q-count { font-weight:700; font-size:11px; color:rgba(47,43,34,0.75); }
    /* Containment-cage credit buffer. Hidden entirely at every other station — the block
       only exists once the server answers with a cage snapshot. */
    [data-screen="Production"] #p-cage { display:none; flex:0 0 auto; }
    [data-screen="Production"] #p-cage.on { display:block; }
    [data-screen="Production"] #p-cage-list { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px; }
    [data-screen="Production"] .cage-stack { display:flex; align-items:center; gap:4px; padding:3px 6px; font-size:11px; background: rgba(241,229,207,0.55); border:1px solid var(--tsic-border); }
    [data-screen="Production"] .cage-stack .icon { width:20px; height:20px; flex:0 0 auto; }
    [data-screen="Production"] .cage-stack .icon img { width:100%; height:100%; object-fit:contain; }
    [data-screen="Production"] #p-cage-collect { width:100%; padding:6px; }
    [data-screen="Production"] #p-cage-collect:disabled { color:rgba(47,43,34,0.4); background:rgba(241,229,207,0.4); cursor:not-allowed; }
    [data-screen="Production"] #p-cage-note { font-size:10px; color:rgba(47,43,34,0.7); margin-top:4px; }
  `;

  const TEMPLATE = `
    <div id="p-root" class="tsic-modal-scrim">
      <div id="p-panel" class="tsic-panel tsic-panel--screen">
        <div id="p-header">
          <h2 class="tsic-title" id="p-title" style="margin:0;">Production</h2>
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
            <div id="p-cage">
              <div class="tsic-eyebrow" style="margin-top:6px;">Research Credits</div>
              <div id="p-cage-list"></div>
              <button id="p-cage-collect" class="tsic-button" disabled>Collect</button>
              <div id="p-cage-note"></div>
            </div>
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
      // Containment cages redirect their finished credits into a buffer on the cage instead
      // of the collecting player's inventory. That buffer is server-only state on a
      // non-replicating actor, so it arrives as a pushed UI.Cage.Buffer snapshot rather than
      // being readable here; null means "this station is not a cage".
      let cageBuffer = null;

      function renderList() {
        const host = root.querySelector('#p-list');
        host.innerHTML = '';
        if (!lastStation) return;
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
          name.textContent = window.TSICRecipeInfo.displayName(r);
          row.appendChild(name);

          const right = document.createElement('div');
          right.className = 'right';
          if (locked) right.textContent = !r.bDiscovered ? 'undiscovered' : 'station Lv. ↑';
          row.appendChild(right);

          const selectRecipe = () => {
            // No-op when already selected — a gamepad focusin on the selected
            // row must NOT re-render (the rebuild would destroy the focused
            // node and drop controller focus to <body>).
            if (selectedRecipeId === r.RecipeId) return;
            const hadFocus = document.activeElement === row || row.hasAttribute('data-tsic-focused');
            selectedRecipeId = r.RecipeId;
            renderAll();
            if (hadFocus) {
              const fresh = host.querySelector('.tsic-list-row.is-selected');
              if (fresh && window.tsic.focus && window.tsic.focus.focus) window.tsic.focus.focus(fresh);
              else if (fresh) fresh.focus();
            }
          };
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

      // The server flags completion and publishes the index the Cancel handler
      // resolves against, so never infer either here: the SPA lists in-progress
      // first and completed last, while the machine indexes completed FIRST.
      const isCompleted = (e) => !!e.bCompleted;

      // Collect a completed stack: one remove per item, highest index first so
      // earlier removals never shift a later target.
      function takeStack(stackEntries) {
        const indices = stackEntries.map((e) => e.RemoveIndex).sort((a, b) => b - a);
        for (const mi of indices) {
          ctx.publish('UI.Cmd.Recipe.Cancel', { Kind: 'Production', StationId: stationId, QueueIndex: mi });
        }
        window.tsic.playSound && window.tsic.playSound('Production.Collect', 0.5);
      }

      function renderQueue() {
        const host = root.querySelector('#p-queue');
        host.innerHTML = '';
        barByIndex = new Map();
        const recipesById = {};
        for (const r of ((lastStation && lastStation.Recipes) || [])) recipesById[r.RecipeId] = r;
        if (queue.length === 0) {
          host.appendChild(Object.assign(document.createElement('div'), { className: 'tsic-empty', textContent: 'Queue is empty.' }));
        }
        // Same-recipe completed entries collapse into one Take-able stack row.
        const rows = [];
        const stackByRecipe = new Map();
        for (const e of queue) {
          if (!isCompleted(e)) { rows.push({ entry: e, stack: null }); continue; }
          let stack = stackByRecipe.get(e.RecipeId);
          if (!stack) {
            stack = [];
            stackByRecipe.set(e.RecipeId, stack);
            rows.push({ entry: e, stack });
          }
          stack.push(e);
        }
        for (const { entry: e, stack } of rows) {
          const done = stack !== null;
          const div = document.createElement('div');
          div.className = 'q-entry' + (e.bIsActive ? ' is-active' : '') + (done ? ' is-done' : '');
          div.dataset.queueIndex = String(e.QueueIndex);
          const r = recipesById[e.RecipeId];
          // A queued recipe is by definition one the player has already started, so name it
          // even if the station snapshot hasn't arrived yet — and never mask it behind the
          // discovery "???", which only makes sense for the browsable recipe LIST.
          const name = r
            ? window.TSICRecipeInfo.displayNameUnmasked(r)
            : TSIC.prettifyDefinitionName(e.RecipeId);
          const head = document.createElement('div');
          head.className = 'q-head';
          const nameSpan = document.createElement('span');
          nameSpan.className = 'name';
          nameSpan.textContent = done ? name : `${e.QueueIndex + 1}. ${name}`;
          head.appendChild(nameSpan);
          if (done && stack.length > 1) {
            const count = document.createElement('span');
            count.className = 'q-count';
            count.textContent = `×${stack.length}`;
            head.appendChild(count);
          }
          const btn = document.createElement('button');
          if (done) {
            btn.className = 'tsic-button q-take';
            btn.textContent = 'Take';
            // No own listener: the click bubbles to the row handler below, so
            // button and row-background clicks share one take path.
          } else {
            btn.className = 'tsic-button cancel q-cancel';
            btn.textContent = 'Cancel';
            btn.addEventListener('click', () => {
              ctx.publish('UI.Cmd.Recipe.Cancel', { Kind: 'Production', StationId: stationId, QueueIndex: e.RemoveIndex });
              window.tsic.playSound && window.tsic.playSound('Recipe.Removed');
            });
          }
          head.appendChild(btn);
          div.appendChild(head);

          const bar = document.createElement('div');
          bar.className = 'q-bar' + (e.bIsActive ? ' active' : '');
          const inner = document.createElement('div');
          inner.style.width = (Math.max(0, Math.min(1, e.Progress || 0)) * 100).toFixed(1) + '%';
          bar.appendChild(inner);
          div.appendChild(bar);
          if (!done) barByIndex.set(e.QueueIndex, inner);

          if (done) {
            // Click anywhere on the row (or gamepad confirm) takes the stack.
            div.setAttribute('data-tsic-focusable', '');
            div.tabIndex = -1;
            div.addEventListener('click', () => takeStack(stack));
            div.addEventListener('tsic:confirm', (ev) => { ev.preventDefault(); takeStack(stack); });
            host.appendChild(div);
            continue;
          }

          // Drag-reorder, in the server's in-progress-only index space. ReorderIndex is -1 for
          // completed jobs and for the active one (both immovable), so this also stops a
          // completed row pretending to be reorderable.
          if (e.ReorderIndex > 0) {
            div.draggable = true;
            div.addEventListener('dragstart', (ev) => {
              ev.dataTransfer.setData('application/tsic-queue', JSON.stringify({ from: e.ReorderIndex }));
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
              // Both indices are in the server's in-progress-only space.
              const targetIndex = e.ReorderIndex;
              if (targetIndex <= 0 || src.from === targetIndex || src.from <= 0) return;
              // Optimistic local move, applied over the DISPLAY array by matching the
              // reorder index (display position != reorder index once anything completes).
              const fromPos = queue.findIndex((q) => q.ReorderIndex === src.from);
              const toPos = queue.findIndex((q) => q.ReorderIndex === targetIndex);
              if (fromPos < 0 || toPos < 0) return;
              const moving = queue.splice(fromPos, 1)[0];
              queue.splice(toPos, 0, moving);
              // Re-derive both spaces so a second drag before the server echo is still correct.
              // In-progress entries, in display order, map to server in-progress indices
              // 0,1,2...; index 0 is the active job and is immovable (-1).
              let inProgressSeen = 0;
              for (let k = 0; k < queue.length; k++) {
                queue[k].QueueIndex = k;
                if (queue[k].bCompleted) continue;
                queue[k].ReorderIndex = inProgressSeen === 0 ? -1 : inProgressSeen;
                inProgressSeen++;
              }
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
        const host = root.querySelector('#p-info');
        const btn = root.querySelector('#p-add');
        if (!recipe) {
          // Say which empty state this is rather than rendering a blank slab.
          const hasRows = !!(lastStation && (lastStation.Recipes || []).length > 0);
          host.innerHTML = '';
          host.appendChild(TSIC.el('div', { class: 'tsic-empty' },
            hasRows ? 'Select a recipe to see its details.' : 'No recipes available.'));
          btn.disabled = true;
          return;
        }
        window.TSICRecipeInfo.render(host, recipe, materialCounts);
        btn.disabled = !window.TSICRecipeInfo.canCraft(recipe, materialCounts);
      }
      function renderCage() {
        const host = root.querySelector('#p-cage');
        const list = root.querySelector('#p-cage-list');
        const btn = root.querySelector('#p-cage-collect');
        const note = root.querySelector('#p-cage-note');
        if (!cageBuffer) {
          host.className = '';
          return;
        }
        host.className = 'on';

        const stacks = cageBuffer.Stacks || [];
        list.innerHTML = '';
        if (stacks.length === 0) {
          list.appendChild(TSIC.el('div', { class: 'tsic-empty' }, 'Nothing contained yet.'));
        }
        for (const s of stacks) {
          const row = TSIC.el('div', { class: 'cage-stack' });
          const iconWrap = TSIC.el('div', { class: 'icon' });
          iconWrap.appendChild(TSIC.iconImg(TSIC.itemIconUrl(s.ItemId || '')));
          row.appendChild(iconWrap);
          const catalogued = ((window.tsic && window.tsic.itemCatalog) || {})[s.ItemId] || {};
          row.appendChild(TSIC.el('span', {},
            catalogued.Name || TSIC.prettifyDefinitionName(s.ItemId || '')));
          row.appendChild(TSIC.el('span', { class: 'q-count' }, `×${s.Count || 0}`));
          list.appendChild(row);
        }

        btn.disabled = stacks.length === 0;
        // A full cage has stopped working, and nothing else on the screen says so — the
        // Contain button simply refuses. Name the reason where the fix (collect) is.
        note.textContent = cageBuffer.bIsFull
          ? `Full (${stacks.length}/${cageBuffer.MaxStacks || 0}) — containment is paused until these are collected.`
          : '';
      }

      function renderAll() { renderList(); renderQueue(); renderInfo(); renderCage(); }

      (function waitForDeps() {
        if (!window.TSICRecipeInfo) { setTimeout(waitForDeps, 16); return; }

        ctx.on('tsic.msg.UI.Recipe.StationOpened', (p) => {
          if (!p || p.Kind !== 'Production') return;
          // Drop the previous station's credit buffer before anything renders — a cage's
          // credits must never show up on the next machine the player opens.
          if (stationId !== p.StationId) cageBuffer = null;
          stationId = p.StationId;
          lastStation = p;
          materialCounts = p.MaterialCounts || {};

          // Keep the selection only if the new station actually offers it. Plantables and
          // containment cages are production-station subclasses and share THIS screen, so a
          // recipe selected at a furnace used to survive into a plant pot, match nothing, and
          // leave the details pane blank.
          const recipes = p.Recipes || [];
          const stillPresent = selectedRecipeId && recipes.some((r) => r.RecipeId === selectedRecipeId);
          if (!stillPresent) selectedRecipeId = recipes.length > 0 ? recipes[0].RecipeId : null;

          // Title and commit verb come from the machine, not the screen: a plant pot is a
          // "Plant Pot" you "Plant" at, not a "Production" you "Add to Queue" at.
          const titleEl = root.querySelector('#p-title');
          if (titleEl) titleEl.textContent = p.StationName || 'Production';
          const addEl = root.querySelector('#p-add');
          if (addEl) addEl.textContent = p.ActionVerb || 'Add to Queue';

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
        ctx.on('tsic.msg.UI.Cage.Buffer', (p) => {
          if (!p) return;
          if (stationId && p.StationId !== stationId) return;
          cageBuffer = p;
          if (ctx.isVisible()) renderCage();
        });
        window.addEventListener('tsic-item-catalog', () => { if (ctx.isVisible()) renderAll(); });

        root.querySelector('#p-add').addEventListener('click', () => {
          const recipe = lastStation && (lastStation.Recipes || []).find((r) => r.RecipeId === selectedRecipeId);
          if (!recipe || !window.TSICRecipeInfo.canCraft(recipe, materialCounts)) return;
          ctx.publish('UI.Cmd.Recipe.Start', { Kind: 'Production', StationId: stationId, RecipeId: recipe.RecipeId, Count: 1 });
          // NB: 'Production.Insert' is registered in the sound set but is the
          // same moment as Recipe.Added — stacking both double-triggers. Left
          // unwired deliberately; see the audio audit.
          window.tsic.playSound && window.tsic.playSound('Recipe.Added');
        });
        root.querySelector('#p-cage-collect').addEventListener('click', () => {
          if (!cageBuffer || (cageBuffer.Stacks || []).length === 0) return;
          // The server drains what fits and pushes a fresh snapshot back either way, so a
          // full bag leaves the rows visible rather than looking like a silent success.
          ctx.publish('UI.Cmd.Cage.Collect', { StationId: stationId });
          window.tsic.playSound && window.tsic.playSound('Production.Collect', 0.5);
        });
        root.querySelector('#btn-close').addEventListener('click', () => {
          ctx.publish('UI.Cmd.Pause.Resume');
        });
      })();
    },
  });
})();
