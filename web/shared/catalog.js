// Listens to UI.Item.Catalog / UI.Recipe.Catalog and stocks tsic.itemCatalog
// + tsic.recipeCatalog. Every screen reads from these for display lookups.
(function () {
    (function boot() {
        if (!window.tsic || typeof tsic.whenReady !== 'function') { setTimeout(boot, 16); return; }
        tsic.whenReady(function () {
            window.tsic.itemCatalog = window.tsic.itemCatalog || {};
            window.tsic.recipeCatalog = window.tsic.recipeCatalog || {};

            tsic.on('tsic.msg.UI.Item.Catalog', (p) => {
                const next = {};
                for (const it of ((p && p.Items) || [])) {
                    next[it.ItemId] = it;
                }
                window.tsic.itemCatalog = next;
                window.dispatchEvent(new CustomEvent('tsic-item-catalog'));
            });

            tsic.on('tsic.msg.UI.Recipe.Catalog', (p) => {
                const next = {};
                for (const r of ((p && p.Recipes) || [])) {
                    next[r.RecipeId] = r;
                }
                window.tsic.recipeCatalog = next;
                window.dispatchEvent(new CustomEvent('tsic-recipe-catalog'));
            });

            // Convenience accessors
            window.tsic.itemName = (id) => (window.tsic.itemCatalog[id] || {}).Name || id;
            window.tsic.itemDesc = (id) => (window.tsic.itemCatalog[id] || {}).Description || '';
            window.tsic.itemCategory = (id) => (window.tsic.itemCatalog[id] || {}).Category || 'Other';
            window.tsic.itemIconUrl = (id) => `/tex/item-icon/${encodeURIComponent(id)}`;
        });
    })();
})();
