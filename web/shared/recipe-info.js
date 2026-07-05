// Renderer shared by crafting + production info panels. Pulls recipe metadata
// from the station payload + item names/icons from the catalog.
// Depends on: shared/dom.js (TSIC.el), shared/icons.js (TSIC.itemIconUrl, TSIC.iconImg)
(function(){
    function iconImg(itemId, sizePx) {
        var img = TSIC.iconImg(TSIC.itemIconUrl(itemId));
        img.style.cssText = `width:${sizePx}px;height:${sizePx}px;object-fit:contain;flex:0 0 auto;`;
        return img;
    }
    function itemRow(itemId, count, rightText, rowStyle) {
        const row = TSIC.el('div', { style: `display:flex;align-items:center;gap:6px;padding:2px 0;${rowStyle||''}` });
        row.appendChild(iconImg(itemId, 20));
        const cat = window.tsic.itemCatalog || {};
        const itemName = (cat[itemId] || {}).Name || itemId;
        row.appendChild(TSIC.el('span', { style: 'flex:1 1 auto;min-width:0;' }, `${itemName} x${count}`));
        if (rightText) {
            row.appendChild(TSIC.el('span', { style: 'color:rgba(37,33,25,0.6);font-size:11px;flex:0 0 auto;' }, rightText));
        }
        return row;
    }
    window.TSICRecipeInfo = {
        render(host, recipe, materialCounts) {
            host.innerHTML = '';
            if (!recipe) return;
            const lockBadge = !recipe.bDiscovered ? ' (locked)' :
                              !recipe.bStationLevelSufficient ? ` (lvl ${recipe.RequiredStationLevel})` : '';
            host.appendChild(TSIC.el('h3', { style: 'margin:0 0 6px;' }, (recipe.Name || recipe.RecipeId) + lockBadge));

            host.appendChild(TSIC.el('div', { style: 'font-size:10px;letter-spacing:2px;color:rgba(37,33,25,0.55);margin-top:8px;' }, 'INGREDIENTS'));
            for (const ing of (recipe.Ingredients || [])) {
                const have = (materialCounts && materialCounts[ing.ItemId]) || 0;
                const sufficient = have >= ing.Count;
                host.appendChild(itemRow(ing.ItemId, ing.Count, `(have ${have})`, sufficient ? '' : 'color:#e88;'));
            }
            host.appendChild(TSIC.el('div', { style: 'font-size:10px;letter-spacing:2px;color:rgba(37,33,25,0.55);margin-top:8px;' }, 'OUTPUTS'));
            for (const o of (recipe.Outputs || [])) {
                host.appendChild(itemRow(o.ItemId, o.Count));
            }
            if (typeof recipe.Duration === 'number' && recipe.Duration > 0) {
                host.appendChild(TSIC.el('div', { style: 'font-size:10px;letter-spacing:2px;color:rgba(37,33,25,0.55);margin-top:8px;' }, 'TIME'));
                host.appendChild(TSIC.el('div', { style: 'font-size:12px;' }, `${recipe.Duration.toFixed(recipe.Duration < 10 ? 1 : 0)}s`));
            }
            if (recipe.RequiredStationLevel > 1) {
                host.appendChild(TSIC.el('div', { style: `margin-top:8px;font-size:11px;${recipe.bStationLevelSufficient?'color:rgba(37,33,25,0.6);':'color:#e88;'}` },
                    `Required Station Level: ${recipe.RequiredStationLevel}`));
            }
        },
        canCraft(recipe, materialCounts) {
            if (!recipe) return false;
            if (!recipe.bDiscovered) return false;
            if (!recipe.bStationLevelSufficient) return false;
            for (const ing of (recipe.Ingredients || [])) {
                if (((materialCounts && materialCounts[ing.ItemId]) || 0) < ing.Count) return false;
            }
            return true;
        }
    };
})();
