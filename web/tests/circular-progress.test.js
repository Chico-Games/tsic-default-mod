// Tests for the LIVE progress/charge ring (shared/hud-circular-progress.js),
// hosted by the thin fixture test-crosshair.html alongside the crosshair dot.
TSICTestHarness.register({
    name: 'CircularProgress: active state shows the ring with fill + colour',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2.0, Elapsed: 0.5, Color: '#7fff9a' });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-circular-progress').classList.contains('active'));
        const host = ctx.doc.getElementById('hud-circular-progress');
        ctx.expect(ctx.assert.eq(host.style.getPropertyValue('--cp-p'), '25'));
        ctx.expect(ctx.assert.eq(host.style.getPropertyValue('--cp-color'), '#7fff9a'));
    },
});

TSICTestHarness.register({
    name: 'CircularProgress: full charge holds a 100% ring',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 1.5, Elapsed: 1.5, Color: '#ffffff' });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-circular-progress').classList.contains('active'));
        const host = ctx.doc.getElementById('hud-circular-progress');
        ctx.expect(ctx.assert.eq(host.style.getPropertyValue('--cp-p'), '100'));
    },
});

TSICTestHarness.register({
    name: 'CircularProgress: inactive hides the ring',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2.0, Elapsed: 0.5 });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-circular-progress').classList.contains('active'));
        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: false, Total: 0, Elapsed: 0 });
        await ctx.waitFor(() => !ctx.doc.getElementById('hud-circular-progress').classList.contains('active'));
        ctx.expect(ctx.assert.truthy(!ctx.doc.getElementById('hud-circular-progress').classList.contains('active'), 'expected ring hidden while inactive'));
    },
});
