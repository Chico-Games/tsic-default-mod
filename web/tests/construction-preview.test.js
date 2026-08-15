// Build-mode placement readout — shared/hud-construction-preview.js.
//
// The ghost turning red says "no"; only this readout says WHY, and the reason is
// resolved in C++ specifically so the player can act on it. It lived on the modal
// construction picker, which the build-hotbar rework superseded — so the reason was
// computed on every build tick and shown to nobody until this component existed.
//
// The bActive=false case is the one that actually bites: the channel is cached, so
// without the clear-on-EndAbility a stale BLOCKED sticks to the HUD for the session.

TSICTestHarness.register({
    name: 'ConstructionPreview: READY when placement is valid',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.PreviewState', { bActive: true, bCanPlace: true });
        await ctx.waitFor(() => {
            const el = ctx.doc.getElementById('cp-text');
            return el && el.textContent === 'READY';
        });
        ctx.expect(ctx.assert.truthy(
            !ctx.doc.getElementById('hud-construction-preview').classList.contains('hidden')));
    },
});

TSICTestHarness.register({
    name: 'ConstructionPreview: the refusal reason is what gets shown, not "BLOCKED"',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.PreviewState',
            { bActive: true, bCanPlace: false, FailureReason: 'no clearance' });
        await ctx.waitFor(() => {
            const el = ctx.doc.getElementById('cp-text');
            return el && /NO CLEARANCE/.test(el.textContent);
        });
        ctx.expect(ctx.assert.domText(ctx.doc, '#cp-text', /NO CLEARANCE/));
    },
});

TSICTestHarness.register({
    name: 'ConstructionPreview: a refusal with no reason falls back to BLOCKED',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.PreviewState', { bActive: true, bCanPlace: false });
        await ctx.waitFor(() => {
            const el = ctx.doc.getElementById('cp-text');
            return el && el.textContent === 'BLOCKED';
        });
        ctx.expect(ctx.assert.domText(ctx.doc, '#cp-text', /BLOCKED/));
    },
});

TSICTestHarness.register({
    name: 'ConstructionPreview: leaving build mode hides the readout',
    file: '/screens/in-game.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.PreviewState',
            { bActive: true, bCanPlace: false, FailureReason: 'out of range' });
        await ctx.waitFor(() =>
            !ctx.doc.getElementById('hud-construction-preview').classList.contains('hidden'));
        // EndAbility broadcasts a default-constructed payload: bActive false.
        ctx.inject('tsic.msg.UI.Construction.PreviewState', { bActive: false, bCanPlace: false });
        await ctx.waitFor(() =>
            ctx.doc.getElementById('hud-construction-preview').classList.contains('hidden'));
        ctx.expect(ctx.assert.truthy(
            ctx.doc.getElementById('hud-construction-preview').classList.contains('hidden'),
            'expected the placement readout to hide when build mode ends'));
    },
});
