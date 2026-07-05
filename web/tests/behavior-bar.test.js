// Gameplay behavior-bar tests, run against the LIVE component (shared/hud-behavior-bar.js)
// hosted by /screens/test-behavior-bar.html. The old menu-bar (#bb-menu) tests were
// removed when the dead screens/action-bar.html was deleted — the menu behavior bar is
// not yet wired into the live shell (tracked as a separate follow-up).

TSICTestHarness.register({
    name: 'BehaviorBar: gameplay rows render',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', {
            Entries: [
                { BehaviorTagName: 'IA_Interact', DisplayName: 'Open Storage', SubText: '3 items', StatusInt: 0, bVisible: true, CooldownPercent: 0 },
                { BehaviorTagName: 'IA_Flashlight', DisplayName: 'Flashlight',   StatusInt: 0, bVisible: true, CooldownPercent: 0 },
            ],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#bb-gameplay .bb-row').length >= 2);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#bb-gameplay .bb-row', 2));
    },
});

TSICTestHarness.register({
    name: 'BehaviorBar: blocked rows are hidden from the bar',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', {
            Entries: [
                { BehaviorTagName: 'IA_Use',     DisplayName: 'Use',      StatusInt: 0, bVisible: true },
                { BehaviorTagName: 'IA_Interact', DisplayName: 'Hack Door', StatusInt: 1, bVisible: true },
            ],
        });
        // Only the available row renders; the blocked one is skipped entirely.
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#bb-gameplay .bb-row').length === 1);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#bb-gameplay .bb-row', 1));
        ctx.expect(ctx.assert.truthy(
            !ctx.doc.querySelector('#bb-gameplay .bb-row[data-status="blocked"]'),
            'blocked rows must not render'));
    },
});

TSICTestHarness.register({
    // Spamming crouch toggles StatusInt every poll, which legitimately re-broadcasts
    // the entry list. A full innerHTML rebuild recreates the <img>, and CEF shows a
    // blank frame while it re-decodes — that is the flash. The key icon <img> must be
    // reused across a status-only change. render() runs synchronously inside the inject
    // handler, so capture the nodes back-to-back (jsdom can't decode SVGs and fires
    // img.onerror on the next tick, which would tear the node down; CEF keeps it).
    name: 'BehaviorBar: status change reuses key icon img node (no flash on spam)',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        const payload = (st) => ({ Entries: [
            { BehaviorTagName: 'IA_Crouch', DisplayName: 'Crouch', bVisible: true, StatusInt: st,
              KeyboardIconUrl: '/icons/keyboard/c.svg' },
        ]});
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', payload(0));
        const first = ctx.doc.querySelector('#bb-gameplay .bb-row .bb-key img');
        ctx.expect(ctx.assert.truthy(first, 'expected a key icon img after first render'));
        // Crouch press: Available -> Cooldown, same icon URL. (Blocked would be hidden;
        // use a status that still renders so the node-reuse check is meaningful.)
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', payload(2));
        const second = ctx.doc.querySelector('#bb-gameplay .bb-row .bb-key img');
        ctx.expect(ctx.assert.truthy(second === first,
            'key icon <img> should be reused across a status-only change, not recreated (recreation flashes)'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '#bb-gameplay .bb-row[data-status="cooldown"]'));
    },
});

TSICTestHarness.register({
    name: 'BehaviorBar: gamepad mode swaps icon family',
    file: '/screens/test-behavior-bar.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.BehaviorBar.Entries', {
            Entries: [{
                BehaviorTagName: 'IA_Interact', DisplayName: 'Interact', StatusInt: 0, bVisible: true,
                KeyboardIconUrl: '/icons/keyboard/e.svg',
                GamepadIconUrl:  '/icons/gamepad/face-bottom.svg',
            }],
        });
        ctx.mode('Gamepad');
        await new Promise(r => setTimeout(r, 60));
        const img = ctx.doc.querySelector('#bb-gameplay .bb-row .bb-key img');
        ctx.expect(ctx.assert.truthy(img));
        ctx.expect(ctx.assert.truthy(img && img.src.indexOf('/icons/gamepad/') > 0, 'expected gamepad glyph URL'));
    },
});
