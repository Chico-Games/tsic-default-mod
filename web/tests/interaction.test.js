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
    name: 'Interaction: target without a Label falls back to "Interact"',
    file: '/screens/test-interaction.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Interaction.Targets', { Targets: [{ EntityId: 3, Label: '' }] });
        await ctx.waitFor(() => /Interact/.test((ctx.doc.getElementById('interaction-prompt') || {}).textContent || ''));
        ctx.expect(ctx.assert.domText(ctx.doc, '#interaction-prompt', /Interact/));
    },
});
