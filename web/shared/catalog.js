// Listens to UI.Item.Catalog / UI.Recipe.Catalog and stocks tsic.itemCatalog
// + tsic.recipeCatalog. Every screen reads from these for display lookups.
//
// Also owns the display-formatting helpers on TSIC (defined at parse time, so
// they work before the bridge handshake and in unit tests): no screen should
// ever put a raw definition id or a raw category tag in front of a player.
(function () {
    window.TSIC = window.TSIC || {};

    // "Entity.Inventory.Item.Category.Weapon" -> "Weapon"
    function tagLeaf(tagName) {
        var parts = String(tagName || '').split('.');
        return parts[parts.length - 1] || '';
    }

    // "BoneHead" -> "Bone Head"; leaves ALLCAPS runs alone.
    function spaceCamelCase(text) {
        return String(text || '').replace(/([^A-Z\s])([A-Z])/g, '$1 $2').trim();
    }

    // Category leaves that don't read well when merely un-camel-cased.
    var CATEGORY_LABELS = {
        Misc: 'Miscellaneous',
        Constructable: 'Buildable',
        Other: 'Item',
        '': 'Item',
    };

    /**
     * Last-resort display name for a definition asset id, mirroring
     * ScpUIRecipeBuilder::PrettifyDefinitionName on the C++ side:
     * "RD_Wrench_CR" -> "Wrench", "RD_Contain_BoneHead" -> "Contain Bone Head".
     * Strips the domain prefix + trailing all-caps kind suffix, then spaces out
     * CamelCase. Use this instead of ever showing a bare id.
     */
    TSIC.prettifyDefinitionName = function (id) {
        var work = String(id || '');
        var prefixed = work.match(/^[A-Za-z]{1,4}_(.+)$/);
        if (prefixed) work = prefixed[1];
        work = work.replace(/_[A-Z]{1,3}$/, '');
        work = work.replace(/_/g, ' ');
        return spaceCamelCase(work);
    };

    /**
     * Human-readable item type for an item-catalog descriptor: "Weapon",
     * "Crafting Material", "Armour". Prefers the authored Item.Category tag leaf
     * (finer-grained) and falls back to the coarse Category bucket.
     */
    /**
     * Item description block. Descriptions are authored as "<what it does>\n<flavour>":
     * the first paragraph is plain function text, anything after the first newline is
     * flavour and renders muted + italic under a divider. Legacy one-paragraph text
     * (no newline) renders as function text only.
     */
    TSIC.descriptionEl = function (description) {
        var text = String(description || '');
        var nl = text.indexOf('\n');
        var fn = (nl < 0 ? text : text.slice(0, nl)).trim();
        var flavour = nl < 0 ? '' : text.slice(nl + 1).trim();
        var wrap = TSIC.el('div', { class: 'item-desc' });
        if (fn) wrap.appendChild(TSIC.el('p', { class: 'item-desc-fn' }, fn));
        if (flavour) wrap.appendChild(TSIC.el('p', { class: 'item-desc-flavour' }, flavour));
        return wrap;
    };

    TSIC.itemTypeLabel = function (descriptor) {
        var d = descriptor || {};
        var leaf = tagLeaf(d.CategoryTag) || d.Category || '';
        if (Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, leaf)) return CATEGORY_LABELS[leaf];
        return spaceCamelCase(leaf);
    };

    /** Human-readable equipment slot ("Weapon", "Backpack"), '' if not equippable. */
    TSIC.itemSlotLabel = function (descriptor) {
        var d = descriptor || {};
        return spaceCamelCase(tagLeaf(d.EquipmentSlot));
    };

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
