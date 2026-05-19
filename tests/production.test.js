TSICTestHarness.register({
    name: 'Production: renders recipes + queue',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production',
            Recipes: [{ RecipeId: 'R_Plank', Name: 'Plank', bDiscovered: true, bStationLevelSufficient: true,
                        Ingredients: [], Outputs: [{ ItemId: 'ID_Plank', Count: 1 }] }],
            MaterialCounts: {},
        });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', {
            Kind: 'Production',
            Entries: [{ RecipeId: 'R_Plank', QueueIndex: 0, Progress: 0, bIsActive: false }],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#p-list .tsic-list-row').length >= 1, { timeout: 2000 });
        ctx.expect(ctx.assert.domExists(ctx.doc, '#p-list .tsic-list-row'));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#p-queue .q-entry', 1));
    },
});

TSICTestHarness.register({
    name: 'Production: progress updates do not crash',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production', Recipes: [], MaterialCounts: {},
        });
        ctx.inject('tsic.msg.UI.Recipe.Progress', { Kind: 'Production', RecipeId: 'R_Plank', Progress: 0.5 });
        ctx.inject('tsic.msg.UI.Recipe.Completed', { Kind: 'Production', RecipeId: 'R_Plank' });
        ctx.expect(ctx.assert.truthy(true));
    },
});

// ---- Progress bar widths reflect Progress fraction ----------------------
TSICTestHarness.register({
    name: 'Production/Visuals: progress bar widths reflect 0 / 50% / 100% Progress',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Production', Recipes: [], MaterialCounts: {} });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', Entries: [
            { RecipeId: 'A', QueueIndex: 0, Progress: 0,   bIsActive: false },
            { RecipeId: 'B', QueueIndex: 1, Progress: 0.5, bIsActive: false },
            { RecipeId: 'C', QueueIndex: 2, Progress: 1,   bIsActive: false },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#p-queue .q-entry').length === 3);
        const bars = ctx.doc.querySelectorAll('#p-queue .q-entry .q-bar > div');
        // jsdom normalizes "50.0%" → "50%"; accept either form.
        const norm = s => s.replace(/\.0%$/, '%');
        ctx.expect(ctx.assert.eq(norm(bars[0].style.width), '0%'));
        ctx.expect(ctx.assert.eq(norm(bars[1].style.width), '50%'));
        ctx.expect(ctx.assert.eq(norm(bars[2].style.width), '100%'));
    },
});

// ---- Active vs inactive bar styling -------------------------------------
TSICTestHarness.register({
    name: 'Production/Visuals: active entry gets .active class (green), queued does not',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Production', Recipes: [], MaterialCounts: {} });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', Entries: [
            { RecipeId: 'A', QueueIndex: 0, Progress: 0.6, bIsActive: true  },
            { RecipeId: 'B', QueueIndex: 1, Progress: 0,   bIsActive: false },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#p-queue .q-entry').length === 2);
        const bars = ctx.doc.querySelectorAll('#p-queue .q-entry .q-bar');
        ctx.expect(ctx.assert.eq(bars[0].classList.contains('active'), true));
        ctx.expect(ctx.assert.eq(bars[1].classList.contains('active'), false));
    },
});

// ---- PRODUCING throb visible iff queue has active entry -----------------
TSICTestHarness.register({
    name: 'Production/Visuals: PRODUCING throb on when queue has active entry, off otherwise',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Production', Recipes: [], MaterialCounts: {} });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', Entries: [] });
        await new Promise(r => setTimeout(r, 50));
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('p-throb').className, '', 'throb should be off with empty queue'));
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', Entries: [
            { RecipeId: 'A', QueueIndex: 0, Progress: 0.3, bIsActive: true },
        ]});
        await ctx.waitFor(() => ctx.doc.getElementById('p-throb').className === 'on');
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('p-throb').className, 'on'));
        // Drain queue.
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', Entries: [] });
        await ctx.waitFor(() => ctx.doc.getElementById('p-throb').className === '');
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('p-throb').className, ''));
    },
});

// ---- Add-to-queue: button click publishes Recipe.Start + Recipe.Added ----
TSICTestHarness.register({
    name: 'Production/E2E: Add to Queue publishes Recipe.Start Kind=Production + Recipe.Added sound',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Plank: { Name: 'Plank' } });
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production',
            StationId: 'S_Sawmill',
            Recipes: [{ RecipeId: 'R_Plank', Name: 'Plank', bDiscovered: true, bStationLevelSufficient: true,
                        Ingredients: [], Outputs: [{ ItemId: 'ID_Plank', Count: 1 }] }],
            MaterialCounts: {},
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#p-list .tsic-list-row'));
        ctx.clearPublishes();
        ctx.doc.getElementById('p-add').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Recipe.Start',
            { where: p => p.Kind === 'Production' && p.StationId === 'S_Sawmill' && p.RecipeId === 'R_Plank' && p.Count === 1 }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play',
            { where: p => p.SoundKey === 'Recipe.Added' }));
    },
});

// ---- Cancel entry 2: publishes Recipe.Cancel with QueueIndex 2 ---------
TSICTestHarness.register({
    name: 'Production/E2E: Cancel on QueueIndex 2 publishes Recipe.Cancel with that index + Recipe.Removed sound',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production',
            StationId: 'S_Sawmill',
            Recipes: [{ RecipeId: 'R', Name: 'R', bDiscovered: true, bStationLevelSufficient: true, Ingredients: [], Outputs: [] }],
            MaterialCounts: {},
        });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', StationId: 'S_Sawmill', Entries: [
            { RecipeId: 'R', QueueIndex: 0, Progress: 0.4, bIsActive: true  },
            { RecipeId: 'R', QueueIndex: 1, Progress: 0,   bIsActive: false },
            { RecipeId: 'R', QueueIndex: 2, Progress: 0,   bIsActive: false },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#p-queue .q-entry').length === 3);
        const entries = ctx.doc.querySelectorAll('#p-queue .q-entry');
        ctx.clearPublishes();
        // Click the Cancel button on the third entry (index 2).
        entries[2].querySelector('.q-cancel').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Recipe.Cancel',
            { where: p => p.Kind === 'Production' && p.StationId === 'S_Sawmill' && p.QueueIndex === 2 }));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play',
            { where: p => p.SoundKey === 'Recipe.Removed' }));
    },
});

// ---- Mid-queue cancel: remaining entries shift correctly ----------------
TSICTestHarness.register({
    name: 'Production/E2E: after mid-queue cancel, remaining entries render in QueueIndex order',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_A: { Name: 'Alpha' }, ID_B: { Name: 'Beta' }, ID_C: { Name: 'Charlie' } });
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production',
            Recipes: [
                { RecipeId: 'R_A', Name: 'A', bDiscovered: true, bStationLevelSufficient: true, Ingredients: [], Outputs: [{ ItemId: 'ID_A', Count: 1 }] },
                { RecipeId: 'R_B', Name: 'B', bDiscovered: true, bStationLevelSufficient: true, Ingredients: [], Outputs: [{ ItemId: 'ID_B', Count: 1 }] },
                { RecipeId: 'R_C', Name: 'C', bDiscovered: true, bStationLevelSufficient: true, Ingredients: [], Outputs: [{ ItemId: 'ID_C', Count: 1 }] },
            ],
            MaterialCounts: {},
        });
        // Initial queue: A, B, C
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', Entries: [
            { RecipeId: 'R_A', QueueIndex: 0, Progress: 0.5, bIsActive: true  },
            { RecipeId: 'R_B', QueueIndex: 1, Progress: 0,   bIsActive: false },
            { RecipeId: 'R_C', QueueIndex: 2, Progress: 0,   bIsActive: false },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#p-queue .q-entry').length === 3);
        // Server cancels the middle one — re-broadcasts with shifted indices.
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', Entries: [
            { RecipeId: 'R_A', QueueIndex: 0, Progress: 0.5, bIsActive: true  },
            { RecipeId: 'R_C', QueueIndex: 1, Progress: 0,   bIsActive: false },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#p-queue .q-entry').length === 2);
        const names = Array.from(ctx.doc.querySelectorAll('#p-queue .q-entry .name')).map(e => e.textContent || '');
        // Expect "1. Alpha" then "2. Charlie".
        ctx.expect(ctx.assert.truthy(/1\..*Alpha/.test(names[0] || ''), `expected "1. Alpha" first, got: ${names[0]}`));
        ctx.expect(ctx.assert.truthy(/2\..*Charlie/.test(names[1] || ''), `expected "2. Charlie" second, got: ${names[1]}`));
    },
});

// ---- Long-duration progress bar layout (e.g. plant recipe over 60s) ----
TSICTestHarness.register({
    name: 'Production/Visuals: long-duration recipe at 1% progress still renders bar correctly',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Production', Recipes: [], MaterialCounts: {} });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', Entries: [
            { RecipeId: 'R_Long', QueueIndex: 0, Progress: 0.01, bIsActive: true },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelector('#p-queue .q-entry .q-bar > div'));
        const inner = ctx.doc.querySelector('#p-queue .q-entry .q-bar > div');
        // jsdom normalizes "1.0%" → "1%"; accept either.
        ctx.expect(ctx.assert.truthy(/^1(\.0)?%$/.test(inner.style.width),
            `expected width "1%" or "1.0%", got: ${inner.style.width}`));
    },
});

// ---- Recipe.Completed for Production publishes Recipe.Completed sound ----
TSICTestHarness.register({
    name: 'Production/E2E: Recipe.Completed Kind=Production plays Recipe.Completed sound',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Production', Recipes: [], MaterialCounts: {} });
        ctx.clearPublishes();
        ctx.inject('tsic.msg.UI.Recipe.Completed', { Kind: 'Production', RecipeId: 'R' });
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Sound.Play',
            { where: p => p.SoundKey === 'Recipe.Completed' }));
    },
});

// ---- Insufficient materials: Add to Queue stays disabled --------------
TSICTestHarness.register({
    name: 'Production/E2E: insufficient materials → Add to Queue disabled',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.setItemCatalog({ ID_Wood: { Name: 'Wood', Category: 'CraftingMaterial' } });
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production',
            Recipes: [{ RecipeId: 'R_Plank', Name: 'Plank', bDiscovered: true, bStationLevelSufficient: true,
                        Ingredients: [{ ItemId: 'ID_Wood', Count: 5 }], Outputs: [] }],
            MaterialCounts: { ID_Wood: 2 },  // not enough
        });
        await ctx.waitFor(() => ctx.doc.querySelector('#p-list .tsic-list-row'));
        ctx.expect(ctx.assert.eq(ctx.doc.getElementById('p-add').disabled, true));
    },
});

// ---- Empty recipe list shows tsic-empty hint --------------------------
TSICTestHarness.register({
    name: 'Production: empty recipe list shows empty-state hint',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Production', Recipes: [], MaterialCounts: {} });
        await ctx.waitFor(() => ctx.doc.querySelector('#p-list .tsic-empty'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#p-list .tsic-list-row').length, 0));
    },
});

// ---- Empty queue shows empty-state hint -----------------------------
TSICTestHarness.register({
    name: 'Production: empty queue shows empty-state hint',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Production', Recipes: [], MaterialCounts: {} });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', Entries: [] });
        await ctx.waitFor(() => ctx.doc.querySelector('#p-queue .tsic-empty'));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#p-queue .q-entry').length, 0));
    },
});

// ---- Reorder: drag queue row 1 onto row 2 publishes UI.Cmd.Recipe.Reorder ----
TSICTestHarness.register({
    name: 'Production/Reorder: drag queue row 1 → row 2 publishes UI.Cmd.Recipe.Reorder',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Production',
            StationId: 'S_Sawmill',
            Recipes: [{ RecipeId: 'R', Name: 'R', bDiscovered: true, bStationLevelSufficient: true, Ingredients: [], Outputs: [] }],
            MaterialCounts: {},
        });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', StationId: 'S_Sawmill', Entries: [
            { RecipeId: 'R', QueueIndex: 0, Progress: 0.5, bIsActive: true  },
            { RecipeId: 'R', QueueIndex: 1, Progress: 0,   bIsActive: false },
            { RecipeId: 'R', QueueIndex: 2, Progress: 0,   bIsActive: false },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#p-queue .q-entry').length === 3);
        ctx.clearPublishes();
        const dtData = { 'application/tsic-queue': JSON.stringify({ from: 1 }) };
        const dt = { _data: dtData, setData(k, v) { dtData[k] = v; }, getData(k) { return dtData[k] || ''; } };
        const entries = ctx.doc.querySelectorAll('#p-queue .q-entry');
        const dispatch = (target, type) => {
            const ev = new ctx.win.Event(type, { bubbles: true, cancelable: true });
            ev.dataTransfer = dt;
            target.dispatchEvent(ev);
        };
        dispatch(entries[2], 'dragover');
        dispatch(entries[2], 'drop');
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Recipe.Reorder',
            { where: p => p.Kind === 'Production' && p.StationId === 'S_Sawmill' && p.FromIndex === 1 && p.ToIndex === 2 }));
    },
});

TSICTestHarness.register({
    name: 'Production/Reorder: active row (QueueIndex 0) is not draggable',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', { Kind: 'Production', StationId: 'S', Recipes: [], MaterialCounts: {} });
        ctx.inject('tsic.msg.UI.Recipe.QueueChanged', { Kind: 'Production', StationId: 'S', Entries: [
            { RecipeId: 'R', QueueIndex: 0, Progress: 0.5, bIsActive: true  },
            { RecipeId: 'R', QueueIndex: 1, Progress: 0,   bIsActive: false },
        ]});
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#p-queue .q-entry').length === 2);
        const entries = ctx.doc.querySelectorAll('#p-queue .q-entry');
        ctx.expect(ctx.assert.eq(entries[0].draggable, false));
        ctx.expect(ctx.assert.eq(entries[1].draggable, true));
    },
});

// ---- StationOpened with Kind mismatch is ignored (Production page) ----
TSICTestHarness.register({
    name: 'Production: ignores StationOpened with non-Production Kind',
    file: '/screens/production.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Recipe.StationOpened', {
            Kind: 'Crafting',  // wrong kind for production page
            Recipes: [{ RecipeId: 'R_Wrong', Name: 'Wrong', bDiscovered: true, bStationLevelSufficient: true, Ingredients: [], Outputs: [] }],
            MaterialCounts: {},
        });
        await new Promise(r => setTimeout(r, 100));
        // Page should NOT have rendered the recipe.
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#p-list .tsic-list-row').length, 0));
    },
});
