// Tests for the LIVE interaction prompt (shared/hud-interaction.js), hosted
// by the thin fixture test-interaction.html. The prompt shows the primary
// target's label inside the gameplay behavior-bar panel; activation goes
// through Enhanced Input (the interact ability), not UI clicks.
TSICTestHarness.register({
    name: 'Interaction: prompt shows the primary target\'s label',
    file: '/screens/test-interaction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', {
            Targets: [
                { EntityId: 1, Label: 'Open Storage' },
                { EntityId: 2, Label: 'Pick up Hammer' },
            ],
        });
        await ctx.waitFor(() => /Open Storage/.test((ctx.doc.getElementById('interaction-prompt') || {}).textContent || ''));
        const prompt = ctx.doc.getElementById('interaction-prompt');
        ctx.expect(ctx.assert.truthy(!prompt.classList.contains('hidden'), 'prompt should be visible'));
        const divider = ctx.doc.getElementById('bb-divider');
        ctx.expect(ctx.assert.truthy(!divider.classList.contains('hidden'), 'divider should be visible'));
    },
});

TSICTestHarness.register({
    name: 'Interaction: prompt hides when targets empty out',
    file: '/screens/test-interaction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [{ EntityId: 7, Label: 'Use' }] });
        await ctx.waitFor(() => /Use/.test((ctx.doc.getElementById('interaction-prompt') || {}).textContent || ''));
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [] });
        await ctx.waitFor(() => ctx.doc.getElementById('interaction-prompt').classList.contains('hidden'));
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('interaction-prompt').classList.contains('hidden')));
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('bb-divider').classList.contains('hidden')));
    },
});

TSICTestHarness.register({
    name: 'Crosshair: draggable look-target shows the faint drag ring',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [], bDraggable: true, bDragging: false });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-crosshair').classList.contains('draggable'));
        const dot = ctx.doc.getElementById('hud-crosshair');
        ctx.expect(ctx.assert.truthy(dot.classList.contains('draggable'), 'expected .draggable ring'));
        ctx.expect(ctx.assert.truthy(!dot.classList.contains('dragging'), 'not dragging yet'));
    },
});

TSICTestHarness.register({
    name: 'Crosshair: dragging ring wins over draggable and clears on release',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [], bDraggable: true, bDragging: true });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-crosshair').classList.contains('dragging'));
        const dot = ctx.doc.getElementById('hud-crosshair');
        ctx.expect(ctx.assert.truthy(!dot.classList.contains('draggable'), 'dragging replaces draggable'));
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [], bDraggable: false, bDragging: false });
        await ctx.waitFor(() => !dot.classList.contains('dragging'));
        ctx.expect(ctx.assert.truthy(!dot.classList.contains('dragging') && !dot.classList.contains('draggable'), 'rings cleared'));
    },
});

TSICTestHarness.register({
    name: 'Interaction: category tints the prompt and shows a symbol',
    file: '/screens/test-interaction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', {
            Targets: [{ EntityId: 5, Label: 'Craft', Category: 'crafting' }],
        });
        await ctx.waitFor(() => (ctx.doc.getElementById('interaction-prompt') || { classList: { contains: () => false } }).classList.contains('cat-crafting'));
        const prompt = ctx.doc.getElementById('interaction-prompt');
        ctx.expect(ctx.assert.truthy(prompt.classList.contains('cat-crafting'), 'expected .cat-crafting tint class'));
        ctx.expect(ctx.assert.truthy(prompt.querySelector('.cat-icon svg'), 'expected inline SVG category symbol'));
        ctx.expect(ctx.assert.truthy(/Craft/.test(prompt.textContent), 'label text preserved next to the symbol'));
        // Category class resets when the next target is uncategorised.
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [{ EntityId: 6, Label: 'Use' }] });
        await ctx.waitFor(() => !ctx.doc.getElementById('interaction-prompt').classList.contains('cat-crafting'));
        ctx.expect(ctx.assert.truthy(!ctx.doc.getElementById('interaction-prompt').querySelector('.cat-icon'), 'symbol removed for uncategorised target'));
    },
});

TSICTestHarness.register({
    name: 'Crosshair: look-target category stamps data-cat for the halo animation',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', {
            Targets: [{ EntityId: 11, Label: 'Use Assembler', Category: 'production' }],
        });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-crosshair').getAttribute('data-cat') === 'production');
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [] });
        await ctx.waitFor(() => !ctx.doc.getElementById('hud-crosshair').hasAttribute('data-cat'));
        ctx.expect(ctx.assert.truthy(!ctx.doc.getElementById('hud-crosshair').hasAttribute('data-cat'), 'data-cat cleared when looking away'));
    },
});

TSICTestHarness.register({
    name: 'Crosshair: hand icon appears for draggable targets and tightens while dragging',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [], bDraggable: true, bDragging: false });
        await ctx.waitFor(() => {
            const hand = ctx.doc.getElementById('hud-crosshair-hand');
            return hand && hand.classList.contains('visible');
        });
        const hand = ctx.doc.getElementById('hud-crosshair-hand');
        ctx.expect(ctx.assert.truthy(hand.querySelector('svg'), 'hand SVG built'));
        ctx.expect(ctx.assert.truthy(!hand.classList.contains('dragging'), 'not dragging yet'));
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [], bDraggable: true, bDragging: true });
        await ctx.waitFor(() => hand.classList.contains('dragging'));
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [], bDraggable: false, bDragging: false });
        await ctx.waitFor(() => !hand.classList.contains('visible'));
        ctx.expect(ctx.assert.truthy(!hand.classList.contains('visible') && !hand.classList.contains('dragging'), 'hand cleared'));
    },
});

TSICTestHarness.register({
    name: 'Interaction: target without a Label falls back to "Interact"',
    file: '/screens/test-interaction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [{ EntityId: 3, Label: '' }] });
        await ctx.waitFor(() => /Interact/.test((ctx.doc.getElementById('interaction-prompt') || {}).textContent || ''));
        ctx.expect(ctx.assert.domText(ctx.doc, '#interaction-prompt', /Interact/));
    },
});
