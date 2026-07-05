// Shared reducers fixtures can call from their onPublish handlers.
// Pure-ish functions — they mutate the passed-in state object in place.
(function (global) {
    const NS = global.TSICPlaygroundSim = global.TSICPlaygroundSim || {};

    NS.recomputeWeight = function (items, itemCatalog) {
        let w = 0;
        for (const it of items || []) {
            const def = itemCatalog && itemCatalog[it.ItemId];
            w += (def && def.Weight || 0) * (it.Count || 1);
        }
        return Math.round(w * 100) / 100;
    };

    NS.firstFreeSlot = function (items) {
        const used = new Set((items || []).map(i => i.SlotIndex));
        let s = 0;
        while (used.has(s)) s++;
        return s;
    };

    NS.applyInventoryDrop = function (state, slotIndex) {
        if (!state.items) return;
        const idx = state.items.findIndex(i => i.SlotIndex === slotIndex);
        if (idx >= 0) state.items.splice(idx, 1);
    };

    NS.applyConsume = function (state, slotIndex, count) {
        if (!state.items) return;
        count = count || 1;
        const it = state.items.find(i => i.SlotIndex === slotIndex);
        if (!it) return;
        it.Count -= count;
        if (it.Count <= 0) {
            state.items.splice(state.items.indexOf(it), 1);
        }
    };

    NS.applyHotbarAssign = function (state, hotbarIndex, slotIndex) {
        state.hotbar = state.hotbar || { SlotIndices: [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1], SelectedSlot: 0 };
        state.hotbar.SlotIndices[hotbarIndex] = slotIndex;
    };

    NS.applyHotbarSelect = function (state, hotbarIndex) {
        state.hotbar = state.hotbar || { SlotIndices: [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1], SelectedSlot: 0 };
        state.hotbar.SelectedSlot = hotbarIndex;
    };

    // Transfer between two named containers in state.containers[owner].
    // Each container = { items: [...], maxSlots, maxWeight }.
    NS.applyTransfer = function (state, fromOwner, toOwner, fromSlot, count) {
        state.containers = state.containers || {};
        const from = state.containers[fromOwner];
        const to = state.containers[toOwner];
        if (!from || !to) return;
        const it = from.items.find(i => i.SlotIndex === fromSlot);
        if (!it) return;
        const moveCount = Math.min(count || it.Count, it.Count);
        it.Count -= moveCount;
        if (it.Count <= 0) from.items.splice(from.items.indexOf(it), 1);
        const existing = to.items.find(i => i.ItemId === it.ItemId);
        if (existing) {
            existing.Count += moveCount;
        } else {
            to.items.push({ ItemId: it.ItemId, Count: moveCount, SlotIndex: NS.firstFreeSlot(to.items) });
        }
    };

    NS.applyRecipeStart = function (state, recipeId, recipe, count) {
        count = count || 1;
        if (!recipe) return;
        const inputs = recipe.Ingredients || recipe.Inputs || [];
        state.materialCounts = state.materialCounts || {};
        for (const ing of inputs) {
            state.materialCounts[ing.ItemId] = Math.max(0, (state.materialCounts[ing.ItemId] || 0) - (ing.Count * count));
        }
        for (const out of (recipe.Outputs || [])) {
            const existing = (state.items || []).find(i => i.ItemId === out.ItemId);
            if (existing) {
                existing.Count += out.Count * count;
            } else {
                state.items = state.items || [];
                state.items.push({ ItemId: out.ItemId, Count: out.Count * count, SlotIndex: NS.firstFreeSlot(state.items) });
            }
        }
    };
})(window);
