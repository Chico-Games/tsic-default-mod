// Detection overlay (shared/hud-detection.js), hosted by /screens/detection.html.
//
// The component subscribes to UI.Detection.State and draws one wedge + one claw per
// enemy that can see you, plus an ambient edge vignette driven by ScreenMist.
//
// The selectors below deliberately reach into #hud-detection rather than a page-local
// container: that is the shell the real in-game HUD mounts, and asserting against it is
// what keeps this feature from drifting back into a page nobody loads.

function arcs(ctx) {
    return ctx.doc.querySelectorAll('#hud-detection .dt-arc');
}

function claws(ctx) {
    return ctx.doc.querySelectorAll('#hud-detection .dt-chev');
}

function vignette(ctx) {
    return ctx.doc.querySelector('#hud-detection .dt-vignette');
}

TSICTestHarness.register({
    name: 'Detection: renders one wedge and one claw per enemy',
    file: '/screens/detection.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Detection.State', {
            Enemies: [
                { EntityId: 1, DetectionScore: 0.4, BearingDeg: 30 },
                { EntityId: 2, DetectionScore: 0.9, BearingDeg: -120 },
            ],
            ScreenMist: 0.3,
        });
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.eq(arcs(ctx).length, 2));
        ctx.expect(ctx.assert.eq(claws(ctx).length, 2));
    },
});

TSICTestHarness.register({
    name: 'Detection: empty state clears markers and the vignette',
    file: '/screens/detection.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Detection.State', {
            Enemies: [{ EntityId: 1, DetectionScore: 0.8, BearingDeg: 0 }],
            ScreenMist: 0.5,
        });
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.truthy(arcs(ctx).length > 0, 'expected markers before clearing'));

        ctx.inject('tsic.msg.UI.Detection.State', { Enemies: [], ScreenMist: 0 });
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.eq(arcs(ctx).length, 0));
        ctx.expect(ctx.assert.eq(vignette(ctx).style.opacity, '0'));
    },
});

// A zero score means "this enemy is in the list but has not noticed you", which is a
// normal payload rather than an empty one. Drawing a marker for it would tell the player
// they had been spotted when they had not.
TSICTestHarness.register({
    name: 'Detection: an enemy with zero detection draws nothing',
    file: '/screens/detection.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Detection.State', {
            Enemies: [
                { EntityId: 1, DetectionScore: 0, BearingDeg: 90 },
                { EntityId: 2, DetectionScore: 0.5, BearingDeg: 180 },
            ],
            ScreenMist: 0.2,
        });
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.eq(arcs(ctx).length, 1));
    },
});

// The claw is placed by solving the ray-rectangle intersection in pixels, so it has to
// land on the correct screen edge for the bearing. Straight up (0 deg) must sit above
// centre and straight down (180 deg) below it; a square-space mapping would still pass
// this, but an inverted Y or a swapped sin/cos would not.
TSICTestHarness.register({
    name: 'Detection: the claw sits on the edge the bearing points at',
    file: '/screens/detection.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Detection.State', {
            Enemies: [{ EntityId: 1, DetectionScore: 0.9, BearingDeg: 0 }],
            ScreenMist: 0,
        });
        await new Promise(r => setTimeout(r, 80));
        const up = parseFloat(claws(ctx)[0].style.top);

        ctx.inject('tsic.msg.UI.Detection.State', {
            Enemies: [{ EntityId: 1, DetectionScore: 0.9, BearingDeg: 180 }],
            ScreenMist: 0,
        });
        await new Promise(r => setTimeout(r, 80));
        const down = parseFloat(claws(ctx)[0].style.top);

        ctx.expect(ctx.assert.truthy(up < 50, `bearing 0 should place the claw above centre, got top ${up}%`));
        ctx.expect(ctx.assert.truthy(down > 50, `bearing 180 should place the claw below centre, got top ${down}%`));
    },
});
