// Renderer shared by crafting + production info panels. Pulls recipe metadata
// from the station payload + item names/icons from the catalog.
(function(){
    function el(t, p, c){ const e = document.createElement(t); Object.assign(e, p||{}); if (p && p.style) e.style.cssText = p.style; for (const x of (c||[])) e.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); return e; }
    function iconImg(itemId, sizePx) {
        const img = el('img', { src: `tex://item-icon/${encodeURIComponent(itemId || '')}`,
            style: `width:${sizePx}px;height:${sizePx}px;object-fit:contain;flex:0 0 auto;` });
        img.onerror = () => { img.style.visibility = 'hidden'; };
        return img;
    }
    function itemRow(itemId, count, rightText, rowStyle) {
        const row = el('div', { style: `display:flex;align-items:center;gap:6px;padding:2px 0;${rowStyle||''}` });
        row.appendChild(iconImg(itemId, 20));
        const cat = window.tsic.itemCatalog || {};
        const itemName = (cat[itemId] || {}).Name || itemId;
        row.appendChild(el('span', { textContent: `${itemName} x${count}`, style: 'flex:1 1 auto;min-width:0;' }));
        if (rightText) {
            row.appendChild(el('span', { textContent: rightText, style: 'opacity:0.6;font-size:11px;flex:0 0 auto;' }));
        }
        return row;
    }
    window.TSICRecipeInfo = {
        render(host, recipe, materialCounts) {
            host.innerHTML = '';
            if (!recipe) return;
            const lockBadge = !recipe.bDiscovered ? ' (locked)' :
                              !recipe.bStationLevelSufficient ? ` (lvl ${recipe.RequiredStationLevel})` : '';
            host.appendChild(el('h3', { textContent: (recipe.Name || recipe.RecipeId) + lockBadge, style: 'margin:0 0 6px;' }));

            host.appendChild(el('div', { textContent: 'INGREDIENTS', style: 'font-size:10px;letter-spacing:2px;opacity:0.55;margin-top:8px;' }));
            for (const ing of (recipe.Ingredients || [])) {
                const have = (materialCounts && materialCounts[ing.ItemId]) || 0;
                const sufficient = have >= ing.Count;
                host.appendChild(itemRow(ing.ItemId, ing.Count, `(have ${have})`, sufficient ? '' : 'color:#e88;'));
            }
            host.appendChild(el('div', { textContent: 'OUTPUTS', style: 'font-size:10px;letter-spacing:2px;opacity:0.55;margin-top:8px;' }));
            for (const o of (recipe.Outputs || [])) {
                host.appendChild(itemRow(o.ItemId, o.Count));
            }
            if (typeof recipe.Duration === 'number' && recipe.Duration > 0) {
                host.appendChild(el('div', { textContent: 'TIME', style: 'font-size:10px;letter-spacing:2px;opacity:0.55;margin-top:8px;' }));
                host.appendChild(el('div', { textContent: `${recipe.Duration.toFixed(recipe.Duration < 10 ? 1 : 0)}s`,
                    style: 'font-size:12px;' }));
            }
            if (recipe.RequiredStationLevel > 1) {
                host.appendChild(el('div', { textContent: `Required Station Level: ${recipe.RequiredStationLevel}`,
                    style: `margin-top:8px;font-size:11px;${recipe.bStationLevelSufficient?'opacity:0.6;':'color:#e88;'}` }));
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
