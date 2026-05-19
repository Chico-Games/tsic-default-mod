// Shared player inventory the recipe-style fixtures (crafting / production
// / repair / upgrade) and the inventory fixture all read from. This is the
// piece that makes "click craft → bread appears in inventory + ingredient
// count drops" feel real.
//
// Lives as a singleton on window.TSICPlaygroundInventory. Fixtures call
// reset({items, maxSlots, maxWeight}) from initialState() to seed it, and
// then read items/materialCounts() during project(). Reducer helpers in
// sim-helpers.js still mutate the same object — this file just centralises
// it so multiple fixtures see the same state instead of carrying their own.
(function (global) {
    const ITEM_CATALOG = {
        // Crafting materials
        ID_Wood:   { Name: 'Wood',   Category: 'CraftingMaterial', Weight: 1.0 },
        ID_Stone:  { Name: 'Stone',  Category: 'CraftingMaterial', Weight: 2.0 },
        ID_Iron:   { Name: 'Iron',   Category: 'CraftingMaterial', Weight: 1.5 },
        ID_Gold:   { Name: 'Gold',   Category: 'CraftingMaterial', Weight: 1.5 },
        ID_Wheat:  { Name: 'Wheat',  Category: 'CraftingMaterial', Weight: 0.1 },
        ID_Rope:   { Name: 'Rope',   Category: 'CraftingMaterial', Weight: 0.3 },
        ID_Coin:   { Name: 'Coin',   Category: 'CraftingMaterial', Weight: 0.01 },
        // Consumables
        ID_Bread:  { Name: 'Bread',  Category: 'Consumable',       Weight: 0.2 },
        ID_Apple:  { Name: 'Apple',  Category: 'Consumable',       Weight: 0.15 },
        // Equipment
        ID_Axe:    { Name: 'Axe',    Category: 'Equipment',        Weight: 1.2 },
        ID_Hammer: { Name: 'Hammer', Category: 'Equipment',        Weight: 1.5 },
        // Misc
        ID_Nail:   { Name: 'Nail',   Category: 'CraftingMaterial', Weight: 0.05 },
    };

    const state = {
        items: [],
        maxSlots: 32,
        maxWeight: 30,
    };

    function firstFreeSlot(items) {
        const used = new Set((items || []).map(i => i.SlotIndex));
        let s = 0;
        while (used.has(s)) s++;
        return s;
    }

    const NS = global.TSICPlaygroundInventory = {
        catalog: ITEM_CATALOG,

        // Replace inventory contents. Fixtures call this from initialState().
        reset(opts) {
            opts = opts || {};
            state.items = (opts.items || []).map(i => ({ ...i }));
            state.maxSlots = opts.maxSlots || 32;
            state.maxWeight = opts.maxWeight || 30;
        },

        items() { return state.items; },
        maxSlots() { return state.maxSlots; },
        maxWeight() { return state.maxWeight; },

        currentWeight() {
            let w = 0;
            for (const it of state.items) {
                const def = ITEM_CATALOG[it.ItemId];
                w += (def && def.Weight || 0) * (it.Count || 1);
            }
            return Math.round(w * 100) / 100;
        },

        // Derived view: { ItemId: totalCount, ... } across all stacks.
        materialCounts() {
            const out = {};
            for (const it of state.items) {
                out[it.ItemId] = (out[it.ItemId] || 0) + (it.Count || 0);
            }
            return out;
        },

        // Drop `count` units of `itemId` from the inventory, lowest-slot first.
        // Returns the number actually removed.
        consume(itemId, count) {
            let remaining = count || 0;
            for (let i = 0; i < state.items.length && remaining > 0; ) {
                const it = state.items[i];
                if (it.ItemId !== itemId) { i++; continue; }
                const take = Math.min(remaining, it.Count);
                it.Count -= take;
                remaining -= take;
                if (it.Count <= 0) state.items.splice(i, 1);
                else i++;
            }
            return (count || 0) - remaining;
        },

        // Add `count` units of `itemId`. Stacks onto existing entry, otherwise
        // places in the first free slot.
        add(itemId, count) {
            const existing = state.items.find(i => i.ItemId === itemId);
            if (existing) {
                existing.Count += count;
                return;
            }
            state.items.push({ ItemId: itemId, Count: count, SlotIndex: firstFreeSlot(state.items) });
        },

        // Returns true if the inventory has enough materials to cover the
        // recipe (which uses .Ingredients or .Inputs).
        canAfford(recipe) {
            const ings = (recipe && (recipe.Ingredients || recipe.Inputs)) || [];
            const counts = NS.materialCounts();
            for (const ing of ings) {
                if ((counts[ing.ItemId] || 0) < (ing.Count || 0)) return false;
            }
            return true;
        },

        // Run a recipe: consume each input, add each output. Returns true on success.
        applyRecipe(recipe, count) {
            count = count || 1;
            if (!recipe) return false;
            if (!NS.canAfford(recipe)) return false;
            for (const ing of (recipe.Ingredients || recipe.Inputs || [])) {
                NS.consume(ing.ItemId, (ing.Count || 0) * count);
            }
            for (const out of (recipe.Outputs || [])) {
                NS.add(out.ItemId, (out.Count || 0) * count);
            }
            return true;
        },
    };
})(window);
