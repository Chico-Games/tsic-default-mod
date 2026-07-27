// Renderer shared by the crafting / production / boss-summoner info panels.
// Pulls recipe metadata from the station payload and display data (name,
// description, type, stats) from the item catalog.
//
// Undiscovered recipes are masked end to end: the list row already reads '???',
// and so must this pane — name, description, type, ingredients, outputs and
// time. Selecting or hovering an unknown recipe must never leak what it makes.
//
// Depends on: shared/dom.js (TSIC.el), shared/icons.js (TSIC.itemIconUrl,
//             TSIC.iconImg), shared/catalog.js (TSIC.itemTypeLabel,
//             TSIC.prettifyDefinitionName)
(function(){
    const MUTED = 'rgba(37,33,25,0.6)';
    const EYEBROW_CSS = 'font-size:10px;letter-spacing:2px;color:rgba(37,33,25,0.55);margin-top:8px;';

    function catalogEntry(itemId) {
        return ((window.tsic && window.tsic.itemCatalog) || {})[itemId] || null;
    }

    function iconImg(itemId, sizePx) {
        var img = TSIC.iconImg(TSIC.itemIconUrl(itemId));
        img.style.cssText = `width:${sizePx}px;height:${sizePx}px;object-fit:contain;flex:0 0 auto;`;
        return img;
    }
    function itemRow(itemId, count, rightText, rowStyle) {
        const row = TSIC.el('div', { style: `display:flex;align-items:center;gap:6px;padding:2px 0;${rowStyle||''}` });
        row.appendChild(iconImg(itemId, 20));
        const itemName = (catalogEntry(itemId) || {}).Name || TSIC.prettifyDefinitionName(itemId);
        row.appendChild(TSIC.el('span', { style: 'flex:1 1 auto;min-width:0;' }, `${itemName} x${count}`));
        if (rightText) {
            row.appendChild(TSIC.el('span', { style: `color:${MUTED};font-size:11px;flex:0 0 auto;` }, rightText));
        }
        return row;
    }
    // Stand-in for an ingredient/output the player hasn't discovered yet: same
    // row metrics as itemRow so the pane doesn't jump when a recipe unlocks.
    function maskedRow() {
        const row = TSIC.el('div', { style: 'display:flex;align-items:center;gap:6px;padding:2px 0;' });
        row.appendChild(TSIC.el('div', {
            style: 'width:20px;height:20px;flex:0 0 auto;border:1px dashed rgba(37,33,25,0.35);'
                 + `display:flex;align-items:center;justify-content:center;font-size:11px;color:${MUTED};`,
        }, '?'));
        row.appendChild(TSIC.el('span', { style: `flex:1 1 auto;min-width:0;color:${MUTED};` }, '???'));
        return row;
    }
    function eyebrow(host, text) {
        host.appendChild(TSIC.el('div', { style: EYEBROW_CSS }, text));
    }
    function statRow(host, label, value) {
        const row = TSIC.el('div', { style: 'display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:1px 0;' });
        row.appendChild(TSIC.el('span', { style: `color:${MUTED};` }, label));
        row.appendChild(TSIC.el('span', {}, value));
        host.appendChild(row);
    }
    function formatDuration(seconds) {
        return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
    }

    /** Catalog descriptor for what the recipe produces, or null. */
    function primaryOutput(recipe) {
        const outputs = (recipe && recipe.Outputs) || [];
        return outputs.length > 0 ? catalogEntry(outputs[0].ItemId) : null;
    }

    /**
     * Player-facing name for a recipe: '???' while undiscovered, otherwise the
     * produced item's catalog name. Falls back to the payload name (or the
     * de-prefixed recipe id) for recipes that produce no item — boss rituals,
     * furniture upgrades.
     */
    function displayName(recipe) {
        if (!recipe) return '';
        if (!recipe.bDiscovered) return '???';
        return displayNameUnmasked(recipe);
    }

    /**
     * displayName WITHOUT the discovery mask. For contexts where the player has already
     * demonstrably identified the recipe — a job sitting in their own production queue —
     * so showing "???" back to them would be nonsense.
     */
    function displayNameUnmasked(recipe) {
        if (!recipe) return '';
        const out = primaryOutput(recipe);
        if (out && out.Name) return out.Name;
        // A payload Name that is still a raw asset id (older server build, or a
        // recipe with no output item) gets prettified rather than shown raw.
        if (recipe.Name && !/^[A-Za-z]{1,4}_[A-Za-z0-9]/.test(recipe.Name)) return recipe.Name;
        return TSIC.prettifyDefinitionName(recipe.Name || recipe.RecipeId);
    }

    /** Human-readable type of what the recipe produces ('' when it makes no item). */
    function typeLabel(recipe) {
        if (!recipe || !recipe.bDiscovered) return '???';
        const out = primaryOutput(recipe);
        return out ? TSIC.itemTypeLabel(out) : '';
    }

    window.TSICRecipeInfo = {
        displayName: displayName,
        displayNameUnmasked: displayNameUnmasked,
        typeLabel: typeLabel,

        render(host, recipe, materialCounts) {
            host.innerHTML = '';
            if (!recipe) return;

            const discovered = !!recipe.bDiscovered;
            const type = typeLabel(recipe);
            if (type) {
                host.appendChild(TSIC.el('div', { class: 'tsic-eyebrow', style: 'margin-bottom:2px;' }, type));
            }

            const levelBadge = (discovered && !recipe.bStationLevelSufficient)
                ? ` (lvl ${recipe.RequiredStationLevel})` : '';
            host.appendChild(TSIC.el('h3', { style: 'margin:0 0 6px;' }, displayName(recipe) + levelBadge));

            if (!discovered) {
                host.appendChild(TSIC.el('p', { style: `font-size:12px;margin:0 0 6px;font-style:italic;color:${MUTED};` },
                    'Undiscovered recipe — nothing is known about it yet.'));
            } else {
                const out = primaryOutput(recipe);
                if (out && out.Description) {
                    host.appendChild(TSIC.el('p', { style: 'font-size:13px;margin:0 0 6px;color:rgba(37,33,25,0.78);' },
                        out.Description));
                }
            }

            eyebrow(host, 'INGREDIENTS');
            for (const ing of (recipe.Ingredients || [])) {
                if (!discovered) { host.appendChild(maskedRow()); continue; }
                const have = (materialCounts && materialCounts[ing.ItemId]) || 0;
                host.appendChild(itemRow(ing.ItemId, ing.Count, `(have ${have})`, have >= ing.Count ? '' : 'color:#e88;'));
            }

            eyebrow(host, 'OUTPUTS');
            for (const o of (recipe.Outputs || [])) {
                host.appendChild(discovered ? itemRow(o.ItemId, o.Count) : maskedRow());
            }

            if (!discovered) {
                // Duration/level are part of "what it makes" — mask them too.
                eyebrow(host, 'TIME');
                host.appendChild(TSIC.el('div', { style: `font-size:12px;color:${MUTED};` }, '???'));
                return;
            }

            if (typeof recipe.Duration === 'number' && recipe.Duration > 0) {
                eyebrow(host, 'TIME');
                host.appendChild(TSIC.el('div', { style: 'font-size:12px;' }, formatDuration(recipe.Duration)));
            }

            // Definition-authored stats for the produced item — the same fields the
            // inventory info card shows, so "is this worth crafting?" is answerable
            // without crafting it first. Damage lives in gameplay effects, not on
            // the definition, so it is deliberately absent.
            const out = primaryOutput(recipe);
            if (out) {
                const stats = [];
                const slot = TSIC.itemSlotLabel(out);
                if (slot) stats.push(['SLOT', slot]);
                if (out.Weight > 0) stats.push(['WEIGHT', `${out.Weight.toFixed(2)} kg`]);
                if (out.BonusInventorySlots > 0) stats.push(['SLOTS', `+${out.BonusInventorySlots}`]);
                if (out.MaxAmmo > 0) stats.push(['AMMO CAP', String(out.MaxAmmo)]);
                if (out.BonusEntityDamage > 0) stats.push(['VS FURNITURE', `+${out.BonusEntityDamage}`]);
                if (out.EntityDamageMultiplier > 0 && out.EntityDamageMultiplier !== 1) {
                    stats.push(['DEMOLITION', `${out.EntityDamageMultiplier.toFixed(2)}×`]);
                }
                if (stats.length > 0) {
                    eyebrow(host, out.bEquippable ? 'WHEN EQUIPPED' : 'DETAILS');
                    for (const [label, value] of stats) statRow(host, label, value);
                }
            }

            if (recipe.RequiredStationLevel > 1) {
                host.appendChild(TSIC.el('div', { style: `margin-top:8px;font-size:11px;${recipe.bStationLevelSufficient?`color:${MUTED};`:'color:#e88;'}` },
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
