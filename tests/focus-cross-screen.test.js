// Cross-screen focus smoke.
//
// For every menu screen that opts in via <meta name="tsic-focus" content="enabled">,
// confirm:
//   - the meta tag is present (catches: page was opted in by the spec but the
//     opt-in tag never landed).
//   - a [data-tsic-initial-focus] element exists in the rendered DOM (catches:
//     page declared the meta but didn't tag an initial-focus target).
//   - after ctx.mode('Gamepad'), the engine focuses something (catches:
//     applyInitialFocus didn't run / engine never enabled).
//
// Per-screen reachability (focus-per-screen.test.js) is the deeper test; this
// file's job is to scream "a new menu was added and forgot to wire focus".

const FOCUS_SCREENS = [
    'main-menu','new-store','credits','pause-menu','settings','save-load',
    'universal-storage-setup','boss-summoner','construction',
    'teleporter','cage','selection','bug-report','quantity-picker',
];

for (const screen of FOCUS_SCREENS) {
    TSICTestHarness.register({
        name: `Focus/CrossScreen: ${screen} opts in and lands focus`,
        file: `/screens/${screen}.html`,
        tags: ['focus', 'cross-screen'],
        async run(ctx) {
            ctx.focus.disableSmoothScroll();
            ctx.focus.resetMemory();
            // Seed mostly-empty state on screens that need data to render
            // their initial-focus target.
            switch (screen) {
                case 'cage':
                case 'selection':
                    ctx.inject('tsic.msg.UI.Selection.Opened', {
                        Context: screen === 'cage' ? 'Cage' : 'Pick',
                        Options: [{ OptionId: 'x', Label: 'x' }],
                    });
                    break;
                case 'teleporter':
                    ctx.inject('tsic.msg.UI.Teleporter.Destinations', {
                        Destinations: [{ EntityId: 1, Label: 'Hub', Cooldown: 0 }],
                    });
                    break;
            }
            await new Promise(r => setTimeout(r, 60));
            // (1) opt-in meta.
            const meta = ctx.doc.querySelector('meta[name="tsic-focus"][content="enabled"]');
            ctx.expect(ctx.assert.truthy(meta, screen + ': missing <meta name="tsic-focus" content="enabled">'));
            // (2) initial-focus target exists.
            const initial = ctx.doc.querySelector('[data-tsic-initial-focus]');
            ctx.expect(ctx.assert.truthy(initial, screen + ': missing [data-tsic-initial-focus]'));
            // (3) engine lands focus on something focusable on Gamepad.
            ctx.mode('Gamepad');
            await new Promise(r => setTimeout(r, 120));
            const active = ctx.doc.activeElement;
            ctx.expect(ctx.assert.truthy(
                active && active !== ctx.doc.body,
                screen + ': engine did not land initial focus on Gamepad (active=' + (active ? active.tagName : 'null') + ')'));
        },
    });
}
