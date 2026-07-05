TSICTestHarness.register({
    name: 'CircularProgress: active state shows the ring',
    file: '/screens/circular-progress.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2.0, Elapsed: 0.5, Color: '#7fff9a' });
        await new Promise(r => setTimeout(r, 80));
        const host = ctx.doc.getElementById('cp-host');
        ctx.expect(ctx.assert.truthy(!host.classList.contains('inactive'), 'expected host visible while active'));
    },
});

TSICTestHarness.register({
    name: 'CircularProgress: inactive hides the host',
    file: '/screens/circular-progress.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: false, Total: 0, Elapsed: 0 });
        await new Promise(r => setTimeout(r, 60));
        const host = ctx.doc.getElementById('cp-host');
        ctx.expect(ctx.assert.truthy(host.classList.contains('inactive'), 'expected host hidden while inactive'));
    },
});
