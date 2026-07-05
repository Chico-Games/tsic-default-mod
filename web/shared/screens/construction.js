// Construction screen module. Was screens/construction.html.
//
// Special: the InputMode.Construction tag is owned by UGameplayAbility_Construct
// (the ability appends/removes it on the player's input subsystem). The screen
// module must NOT also push the tag, or beforeunload-equivalent teardown would
// pull it out from under the still-running ability. Likewise, cancel-back is
// handled by the construction ability itself via IMC_CancelBack — we opt out
// of the screen-manager's auto-publish (cancelCmd = null).
(function register() {
  if (!window.TSIC || typeof TSIC.registerScreen !== 'function') {
    setTimeout(register, 16);
    return;
  }

  const STYLE = `
    [data-screen="Construction"] #c-tabs { display:flex; gap:0; margin-bottom:8px; }
    [data-screen="Construction"] .c-row { display:flex; align-items:center; gap:8px; padding:6px 10px; }
    [data-screen="Construction"] .c-row.disabled { color: rgba(47,43,34,0.45); pointer-events: none; }
    [data-screen="Construction"] #c-cost { padding: 8px; font-size:11px; background:rgba(241,229,207,0.88); border-top:1px solid var(--tsic-border); }
    [data-screen="Construction"] .c-cost-row { display:flex; justify-content:space-between; padding:2px 0; }
    [data-screen="Construction"] .c-cost-row .have-less { color:#9f2e25; }
    [data-screen="Construction"] .c-cost-row .have-ok   { color:#166534; }
  `;

  const TEMPLATE = `
    <div id="sidebar" class="tsic-panel" style="position:absolute;left:24px;top:24px;bottom:24px;width:300px;display:flex;flex-direction:column;gap:6px;overflow:hidden;">
      <h2 class="tsic-title tsic-title--sm">Build</h2>
      <div id="c-tabs" data-tsic-focus-group="category-tabs" data-tsic-tab-bar></div>
      <div id="items" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px;" data-tsic-focus-group="item-list"></div>
      <div id="c-cost"></div>
    </div>

    <div id="preview-pill" class="tsic-panel" style="position:absolute;top:24px;left:50%;transform:translateX(-50%);padding:6px 16px;font-size:12px;letter-spacing:2px;display:none;">
      <span id="preview-text">—</span>
      <span id="rotation-axis" style="color:rgba(47,43,34,0.65);font-size:10px;margin-left:8px;"></span>
    </div>

    <div style="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:8px;" data-tsic-focus-group="actions">
      <button class="tsic-button" id="btn-confirm" data-tsic-initial-focus>Confirm</button>
      <button class="tsic-button" id="btn-cancel">Cancel</button>
      <button class="tsic-button" id="btn-deconstruct">Deconstruct</button>
    </div>
  `;

  function injectStyleOnce() {
    if (document.getElementById('screen-construction-style')) return;
    const s = document.createElement('style');
    s.id = 'screen-construction-style';
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  TSIC.registerScreen('Construction', {
    inputModeTag: 'InputMode.Menu.Construction', // modal picker: pause build input, show cursor + UI nav
    cancelCmd: 'UI.Cmd.Construction.ClosePicker',// Esc closes the picker (does NOT cancel the build)
    actionBarContext: [
      { ActionName: 'IA_UI_ConfirmAccept', Label: 'Place',  Priority: 10 },
      { ActionName: 'IA_UI_CancelBack',    Label: 'Cancel', Priority: 1000 },
    ],
    template: TEMPLATE,

    mount(root, ctx) {
      injectStyleOnce();

      let lastItems = [];
      let hoveredItem = null;
      let tabFilter = null;

      function categoryFor(it) { return (it && (it.Category || it.Type)) || 'Other'; }

      function uniqueCategories(items) {
        const set = new Set();
        for (const it of (items || [])) set.add(categoryFor(it));
        return ['All', ...Array.from(set).sort()];
      }

      function rebuildTabs() {
        if (!tabFilter) return;
        tabFilter.setTabs(uniqueCategories(lastItems).map((c) => ({ id: c, label: c })));
      }

      function renderCostFor(item) {
        const host = root.querySelector('#c-cost');
        host.innerHTML = '';
        if (!item || !Array.isArray(item.Cost) || item.Cost.length === 0) {
          host.textContent = item ? '(no cost data)' : '';
          return;
        }
        const cat = (window.tsic && window.tsic.itemCatalog) || {};
        for (const c of item.Cost) {
          const row = document.createElement('div');
          row.className = 'c-cost-row';
          const label = document.createElement('span');
          label.textContent = (cat[c.ItemId] && cat[c.ItemId].Name) || c.ItemId;
          const have = document.createElement('span');
          const haveCount = (c.HaveCount !== undefined) ? c.HaveCount : '?';
          have.textContent = `${haveCount} / ${c.Count}`;
          have.className = (typeof c.HaveCount === 'number' && c.HaveCount < c.Count) ? 'have-less' : 'have-ok';
          row.appendChild(label);
          row.appendChild(have);
          host.appendChild(row);
        }
      }

      function renderItems() {
        const host = root.querySelector('#items');
        host.innerHTML = '';
        const activeCategory = tabFilter ? tabFilter.getActive() : 'All';
        const items = (lastItems || []).filter((it) => activeCategory === 'All' || categoryFor(it) === activeCategory);
        for (const it of items) {
          const row = document.createElement('button');
          row.className = 'tsic-button c-row' + (it.bAffordable === false ? ' disabled' : '');
          row.style.justifyContent = 'flex-start';
          if (it.IconUrl) {
            const img = document.createElement('img');
            img.src = it.IconUrl;
            img.style.cssText = 'width:24px;height:24px;object-fit:contain;';
            row.appendChild(img);
          }
          const label = document.createElement('span');
          label.style.flex = '1';
          label.textContent = it.Name || it.EntityDefId;
          row.appendChild(label);
          row.onmouseenter = () => { hoveredItem = it; renderCostFor(it); };
          row.onmouseleave = () => { if (hoveredItem === it) { hoveredItem = null; renderCostFor(null); } };
          row.onclick = () => {
            ctx.publish('UI.Cmd.Construction.Begin', { EntityDefId: it.EntityDefId });
            ctx.publish('UI.Cmd.Construction.ClosePicker', {});
          };
          host.appendChild(row);
        }
      }

      function renderPreview(p) {
        const pill = root.querySelector('#preview-pill');
        const text = root.querySelector('#preview-text');
        const axis = root.querySelector('#rotation-axis');
        if (!p) { pill.style.display = 'none'; return; }
        pill.style.display = 'block';
        if (p.bCanPlace) {
          text.textContent = 'READY';
          pill.style.color = '#0f4d24';
          text.style.color = '#0f4d24';
          text.style.fontWeight = '700';
          pill.style.borderColor = 'rgba(15,77,36,0.65)';
        } else {
          text.textContent = (p.FailureReason || 'BLOCKED').toUpperCase();
          pill.style.color = '#9f2e25';
          text.style.color = '#9f2e25';
          text.style.fontWeight = '700';
          pill.style.borderColor = 'rgba(159,46,37,0.65)';
        }
        axis.textContent = p.RotationAxis ? `· axis: ${p.RotationAxis}` : '';
      }

      (function waitForDeps() {
        if (!window.TSIC || !window.TSIC.TabFilter) { setTimeout(waitForDeps, 16); return; }
        tabFilter = TSIC.TabFilter.create(
          root.querySelector('#c-tabs'), [{ id: 'All', label: 'All' }], () => renderItems()
        );

        ctx.on('tsic.msg.UI.Construction.Available', (p) => {
          lastItems = (p && p.Items) || [];
          if (ctx.isVisible()) { rebuildTabs(); renderItems(); }
        });
        ctx.on('tsic.msg.UI.Construction.PreviewState', (p) => {
          if (ctx.isVisible()) renderPreview(p);
        });
        window.addEventListener('tsic-item-catalog', () => { if (ctx.isVisible()) renderCostFor(hoveredItem); });

        root.querySelector('#btn-confirm').onclick     = () => ctx.publish('UI.Cmd.Construction.Confirm', {});
        root.querySelector('#btn-cancel').onclick      = () => ctx.publish('UI.Cmd.Construction.ClosePicker', {});
        root.querySelector('#btn-deconstruct').onclick = () => ctx.publish('UI.Cmd.Construction.Deconstruct', { EntityId: 0 });
      })();
    },
  });
})();
