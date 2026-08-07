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

// ---- The panel ring must never reflow the panel ------------------------------
// The regression this guards: the ring used to be a display:none -> block block
// element at the end of the bottom-anchored action panel, so every hold grew the
// panel by 32px and shoved all its rows up, then dropped them back. It is now
// absolute + opacity-gated, so the panel's rows cannot move at all.
TSICTestHarness.register({
    name: 'CircularProgress: showing the panel ring never moves the panel rows',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        const row = ctx.doc.getElementById('interaction-hold-prompt');
        row.classList.remove('hidden');
        const shell = ctx.doc.getElementById('bb-shell-gameplay');
        const rowBefore = row.getBoundingClientRect();
        const shellBefore = shell.getBoundingClientRect();

        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2.0, Elapsed: 1.0 });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-circular-progress').classList.contains('active'));

        const rowAfter = row.getBoundingClientRect();
        const shellAfter = shell.getBoundingClientRect();
        ctx.expect(ctx.assert.eq(rowAfter.top, rowBefore.top));
        ctx.expect(ctx.assert.eq(shellAfter.top, shellBefore.top));
        ctx.expect(ctx.assert.eq(shellAfter.height, shellBefore.height));
    },
});

// ---- The panel ring circles the running action's key chip --------------------
TSICTestHarness.register({
    name: 'CircularProgress: panel ring mounts on the hold row key chip',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        const hold = ctx.doc.getElementById('interaction-hold-prompt');
        hold.classList.remove('hidden');
        const chip = hold.querySelector('.bb-key');

        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2.0, Elapsed: 1.0 });
        const ring = ctx.doc.getElementById('hud-circular-progress');
        await ctx.waitFor(() => ring.parentNode === chip);
        ctx.expect(ctx.assert.truthy(chip.classList.contains('cp-host'), 'host chip must stop clipping the ring'));
        ctx.expect(ctx.assert.truthy(!ring.classList.contains('parked'), 'mounted ring must not be parked'));
        // Centred on the chip, not hanging off it.
        const r = ring.getBoundingClientRect(), c = chip.getBoundingClientRect();
        ctx.expect(ctx.assert.truthy(Math.abs((r.left + r.width / 2) - (c.left + c.width / 2)) < 1.5, 'ring must be centred on the chip'));
    },
});

// The tap row is the fallback when the furniture is tap-only.
TSICTestHarness.register({
    name: 'CircularProgress: tap row chip is used when there is no hold row',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        const tap = ctx.doc.getElementById('interaction-prompt');
        tap.classList.remove('hidden');
        const chip = tap.querySelector('.bb-key');

        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 3.0, Elapsed: 1.5 });
        const ring = ctx.doc.getElementById('hud-circular-progress');
        await ctx.waitFor(() => ring.parentNode === chip);
        ctx.expect(ctx.assert.eq(ring.style.getPropertyValue('--cp-p'), '50'));
    },
});

// No visible row (throw charge with nothing matching) must still show a ring,
// parked in the panel corner — never nothing.
TSICTestHarness.register({
    name: 'CircularProgress: parks in the panel corner when no key chip matches',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2.0, Elapsed: 0.5 });
        const ring = ctx.doc.getElementById('hud-circular-progress');
        await ctx.waitFor(() => ring.classList.contains('active'));
        ctx.expect(ctx.assert.truthy(ring.classList.contains('parked'), 'expected parked ring with no chip to circle'));
        ctx.expect(ctx.assert.eq(ring.parentNode.id, 'bb-shell-gameplay'));
    },
});

// Stop must release the host chip, or it keeps overflow:visible forever and the
// next cooldown sweep on that chip bleeds outside its box.
TSICTestHarness.register({
    name: 'CircularProgress: Stop releases the host chip and re-parks',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        const hold = ctx.doc.getElementById('interaction-hold-prompt');
        hold.classList.remove('hidden');
        const chip = hold.querySelector('.bb-key');
        const ring = ctx.doc.getElementById('hud-circular-progress');

        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2.0, Elapsed: 1.0 });
        await ctx.waitFor(() => ring.parentNode === chip);

        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: false, Total: 0, Elapsed: 0 });
        await ctx.waitFor(() => ring.classList.contains('parked'));
        ctx.expect(ctx.assert.truthy(!chip.classList.contains('cp-host'), 'expected cp-host cleared from the chip on Stop'));
    },
});

// The chip's own component rebuilds it from scratch on re-render, which detaches
// the ring. The next broadcast has to re-home it — otherwise the ring vanishes
// mid-hold and getElementById can never find it again.
TSICTestHarness.register({
    name: 'CircularProgress: ring re-homes after its host chip is rebuilt',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        const hold = ctx.doc.getElementById('interaction-hold-prompt');
        hold.classList.remove('hidden');
        const ring = ctx.doc.getElementById('hud-circular-progress');

        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2.0, Elapsed: 0.5 });
        await ctx.waitFor(() => ring.parentNode === hold.querySelector('.bb-key'));

        // Rebuild the row the way hud-interaction.js does: wipe and re-create.
        while (hold.firstChild) hold.removeChild(hold.firstChild);
        const fresh = ctx.doc.createElement('span');
        fresh.className = 'bb-key';
        fresh.textContent = 'E';
        hold.appendChild(fresh);
        ctx.expect(ctx.assert.truthy(!ring.isConnected, 'precondition: the rebuild detached the ring'));

        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2.0, Elapsed: 1.0 });
        await ctx.waitFor(() => ring.parentNode === fresh);
        ctx.expect(ctx.assert.eq(ring.style.getPropertyValue('--cp-p'), '50'));
    },
});

// ---- Crosshair collar -------------------------------------------------------
TSICTestHarness.register({
    name: 'CircularProgress: crosshair collar fills from the same broadcast',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        const collar = ctx.doc.getElementById('hud-crosshair-progress');
        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 4.0, Elapsed: 3.0, Color: '#9fd4f0' });
        await ctx.waitFor(() => collar.classList.contains('active'));
        ctx.expect(ctx.assert.eq(collar.style.getPropertyValue('--cp-p'), '75'));
        ctx.expect(ctx.assert.eq(collar.style.getPropertyValue('--cp-color'), '#9fd4f0'));
        // The dot's category halo yields to the ring so only one thing animates.
        ctx.expect(ctx.assert.truthy(ctx.doc.body.classList.contains('hud-charging'), 'expected body.hud-charging while a ring is up'));

        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: false, Total: 0, Elapsed: 0 });
        await ctx.waitFor(() => !collar.classList.contains('active'));
        ctx.expect(ctx.assert.truthy(!ctx.doc.body.classList.contains('hud-charging'), 'expected hud-charging cleared on Stop'));
    },
});

// The publisher HOLDS at 100% until the ability broadcasts Stop, so the bloom is
// edge-triggered: it must fire once on 0->100% and NOT re-fire on later frames
// that are still at 100%.
TSICTestHarness.register({
    name: 'CircularProgress: completion bloom fires once on the 100% edge',
    file: '/screens/test-crosshair.html',
    async run(ctx) {
        const bloom = ctx.doc.getElementById('hud-crosshair-bloom');
        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2.0, Elapsed: 0.5 });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-crosshair-progress').classList.contains('active'));
        ctx.expect(ctx.assert.truthy(!bloom.classList.contains('fire'), 'bloom must not fire mid-fill'));

        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2.0, Elapsed: 2.0 });
        await ctx.waitFor(() => bloom.classList.contains('fire'));

        // A second held-at-full frame must not restart it. The driver removes
        // .fire before re-adding, so a re-trigger is observable as the class
        // dropping; check it survives an injection untouched.
        ctx.inject('tsic.msg.UI.CircularProgress.State', { bActive: true, Total: 2.0, Elapsed: 2.0 });
        ctx.expect(ctx.assert.truthy(bloom.classList.contains('fire'), 'bloom must not be restarted while held at full'));
    },
});
