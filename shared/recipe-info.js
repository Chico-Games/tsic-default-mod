// Renderer shared by crafting + production info panels. Pulls recipe metadata
// from the station payload + item names/icons from the catalog.
(function(){
    function el(t, p, c){ const e = document.createElement(t); Object.assign(e, p||{}); if (p && p.style) e.style.cssText = p.style; for (const x of (c||[])) e.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); return e; }
    window.TSICRecipeInfo = {
        render(host, recipe, materialCounts) {
            host.innerHTML = '';
            if (!recipe) return;
            const cat = window.tsic.itemCatalog || {};
            const lockBadge = !recipe.bDiscovered ? ' (locked)' :
                              !recipe.bStationLevelSufficient ? ` (lvl ${recipe.RequiredStationLevel})` : '';
            host.appendChild(el('h3', { textContent: (recipe.Name || recipe.RecipeId) + lockBadge, style: 'margin:0 0 6px;' }));

            host.appendChild(el('div', { textContent: 'INGREDIENTS', style: 'font-size:10px;letter-spacing:2px;opacity:0.55;margin-top:8px;' }));
            for (const ing of (recipe.Ingredients || [])) {
                const have = (materialCounts && materialCounts[ing.ItemId]) || 0;
                const sufficient = have >= ing.Count;
                const itemName = (cat[ing.ItemId] || {}).Name || ing.ItemId;
                const row = el('div', { style: `display:flex;justify-content:space-between;padding:2px 0;${sufficient?'':'color:#e88;'}` });
                row.appendChild(el('span', { textContent: `${itemName} x${ing.Count}` }));
                row.appendChild(el('span', { textContent: `(have ${have})`, style: 'opacity:0.6;font-size:11px;' }));
                host.appendChild(row);
            }
            host.appendChild(el('div', { textContent: 'OUTPUTS', style: 'font-size:10px;letter-spacing:2px;opacity:0.55;margin-top:8px;' }));
            for (const o of (recipe.Outputs || [])) {
                const itemName = (cat[o.ItemId] || {}).Name || o.ItemId;
                host.appendChild(el('div', { textContent: `${itemName} x${o.Count}` }));
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
