// Condition chips (shared/hud-conditions.js) hosted by /screens/conditions.html.
//
// The component mounts chips on the UI.Conditions.State channel and unmounts them when a
// condition leaves the payload. Exit is deferred ~280ms for the collapse animation, so
// removal assertions wait it out rather than checking immediately.

const EXIT_MS = 360;   // chip exit timer (280ms) + slack

function chip(ctx, id) {
    return ctx.doc.querySelector('#hud-conditions .cond-chip[data-id="' + id + '"]');
}

function liveChips(ctx) {
    return Array.from(ctx.doc.querySelectorAll('#hud-conditions .cond-chip:not(.cond-exit)'));
}

function send(ctx, conditions) {
    ctx.inject('tsic.msg.UI.Conditions.State', { Conditions: conditions });
}

const BUFF = (Id, RemainingTime = 0, Duration = 0, RefreshCount = 0) =>
    ({ Id, Kind: 'Buff', Duration, RemainingTime, RefreshCount });
const DEBUFF = (Id) => ({ Id, Kind: 'Debuff', Duration: 0, RemainingTime: 0, RefreshCount: 0 });

TSICTestHarness.register({
    name: 'Conditions: chips mount with icon and name',
    file: '/screens/conditions.html',
    async run(ctx) {
        send(ctx, [DEBUFF('Hungry'), BUFF('Swift', 30, 45)]);
        await new Promise(r => setTimeout(r, 80));

        const hungry = chip(ctx, 'Hungry');
        const swift = chip(ctx, 'Swift');
        ctx.expect(ctx.assert.truthy(hungry, 'expected a Hungry chip'));
        ctx.expect(ctx.assert.truthy(swift, 'expected a Swift chip'));

        // Name comes from the JS catalogue, not the payload.
        ctx.expect(ctx.assert.eq(hungry.querySelector('.cond-label').textContent, 'Hungry'));
        ctx.expect(ctx.assert.eq(swift.querySelector('.cond-label').textContent, 'Swift'));

        // Each chip carries an inline SVG icon.
        ctx.expect(ctx.assert.truthy(hungry.querySelector('.cond-ico svg path'), 'expected an icon path'));
        ctx.expect(ctx.assert.truthy(swift.querySelector('.cond-ico svg path'), 'expected an icon path'));

        // Kind drives the tint.
        ctx.expect(ctx.assert.eq(hungry.getAttribute('data-kind'), 'Debuff'));
        ctx.expect(ctx.assert.eq(swift.getAttribute('data-kind'), 'Buff'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: multi-word ids get spaced display names',
    file: '/screens/conditions.html',
    async run(ctx) {
        send(ctx, [BUFF('WellFed'), BUFF('QuickRecovery', 95, 120)]);
        await new Promise(r => setTimeout(r, 80));

        ctx.expect(ctx.assert.eq(chip(ctx, 'WellFed').querySelector('.cond-label').textContent, 'Well Fed'));
        ctx.expect(ctx.assert.eq(chip(ctx, 'QuickRecovery').querySelector('.cond-label').textContent, 'Quick Recovery'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: every catalogue id renders a distinct icon',
    file: '/screens/conditions.html',
    async run(ctx) {
        const ids = ['Starving', 'Burning', 'Tazed', 'Overburdened', 'Hungry', 'WellFed',
                     'Regenerating', 'Hearty', 'Enduring', 'Fortified', 'Swift',
                     'Energised', 'QuickRecovery', 'Hidden'];
        send(ctx, ids.map(id => BUFF(id)));
        await new Promise(r => setTimeout(r, 100));

        ctx.expect(ctx.assert.eq(liveChips(ctx).length, ids.length));

        const shapes = new Set();
        for (const id of ids) {
            const c = chip(ctx, id);
            ctx.expect(ctx.assert.truthy(c, `expected a chip for ${id}`));
            const paths = Array.from(c.querySelectorAll('.cond-ico svg path'))
                .map(p => p.getAttribute('d')).join('|');
            ctx.expect(ctx.assert.truthy(paths.length > 0, `expected icon geometry for ${id}`));
            shapes.add(paths);
            // A label, not a raw id fallback.
            ctx.expect(ctx.assert.truthy(c.querySelector('.cond-label').textContent.length > 0,
                `expected a display name for ${id}`));
        }
        ctx.expect(ctx.assert.eq(shapes.size, ids.length, 'every condition should have its own icon'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: chips unmount when the condition ends',
    file: '/screens/conditions.html',
    async run(ctx) {
        send(ctx, [DEBUFF('Hungry'), BUFF('Swift', 30, 45), BUFF('Energised', 30, 45)]);
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.eq(liveChips(ctx).length, 3));

        // Swift lapses; the other two stay.
        send(ctx, [DEBUFF('Hungry'), BUFF('Energised', 25, 45)]);
        await new Promise(r => setTimeout(r, 40));
        // Exit is animated, so the chip is marked before it is gone.
        ctx.expect(ctx.assert.truthy(
            !chip(ctx, 'Swift') || chip(ctx, 'Swift').classList.contains('cond-exit'),
            'expected the Swift chip to start exiting'));

        await new Promise(r => setTimeout(r, EXIT_MS));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Swift'), 'expected the Swift chip removed from the DOM'));
        ctx.expect(ctx.assert.eq(liveChips(ctx).length, 2));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Hungry'), 'Hungry should survive'));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Energised'), 'Energised should survive'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: empty payload clears every chip',
    file: '/screens/conditions.html',
    async run(ctx) {
        send(ctx, [DEBUFF('Burning'), BUFF('Hearty', 700, 900)]);
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.eq(liveChips(ctx).length, 2));

        send(ctx, []);
        await new Promise(r => setTimeout(r, EXIT_MS));
        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#hud-conditions .cond-chip').length, 0));
    },
});

TSICTestHarness.register({
    name: 'Conditions: label opens on arrival then collapses to icon-only',
    file: '/screens/conditions.html',
    async run(ctx) {
        send(ctx, [BUFF('Swift', 30, 45)]);
        // The open class lands on the frame after mount.
        await new Promise(r => setTimeout(r, 120));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Swift').classList.contains('cond-open'),
            'expected the chip to enter with its label showing'));

        // LABEL_HOLD_MS is 3s; wait past it.
        await new Promise(r => setTimeout(r, 3200));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Swift').classList.contains('cond-open'),
            'expected the label to collapse to icon-only after the hold'));
        // The chip itself stays — only the name folds away.
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Swift'), 'chip should remain mounted while active'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: final seconds pulse and re-open the label',
    file: '/screens/conditions.html',
    async run(ctx) {
        send(ctx, [BUFF('Energised', 30, 45)]);
        await new Promise(r => setTimeout(r, 3200));   // let it settle to icon-only
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Energised').classList.contains('cond-open'),
            'precondition: chip settled'));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Energised').classList.contains('cond-expiring'),
            'a 30s buff is not expiring'));

        // Cross into the final 5s (matches GConditionExpiringSeconds in C++).
        send(ctx, [BUFF('Energised', 4, 45)]);
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Energised').classList.contains('cond-expiring'),
            'expected the expiring pulse inside the final seconds'));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Energised').classList.contains('cond-open'),
            'expected the name to re-open as a warning before it drops'));

        // And it must STAY open — collapsing mid-warning would leave an anonymous icon
        // as the thing that vanishes.
        await new Promise(r => setTimeout(r, 3400));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Energised').classList.contains('cond-open'),
            'expected the name to stay up for the whole expiring window'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: a topped-up buff resumes its normal collapse',
    file: '/screens/conditions.html',
    async run(ctx) {
        // Eating a second helping while the first is nearly gone pushes RemainingTime back
        // up; the chip should drop the pulse and go back to collapsing on the usual hold.
        send(ctx, [BUFF('Swift', 2, 45)]);
        await new Promise(r => setTimeout(r, 100));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Swift').classList.contains('cond-expiring'),
            'precondition: chip is expiring'));

        send(ctx, [BUFF('Swift', 45, 45)]);
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Swift').classList.contains('cond-expiring'),
            'expected the pulse to stop once the timer is topped up'));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Swift').classList.contains('cond-open'),
            'expected the label to re-open on the top-up'));

        await new Promise(r => setTimeout(r, 3200));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Swift').classList.contains('cond-open'),
            'expected the un-pinned label to collapse again after the hold'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: a chip that mounts already expiring keeps its label pinned',
    file: '/screens/conditions.html',
    async run(ctx) {
        // Rejoining a session (or a sticky replay) can deliver a buff that is already in
        // its final seconds. The enter animation must not clobber the pinned label.
        send(ctx, [BUFF('WellFed'), BUFF('Swift', 3, 45)]);
        await new Promise(r => setTimeout(r, 120));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Swift').classList.contains('cond-expiring'),
            'expected the pulse straight away'));

        await new Promise(r => setTimeout(r, 3400));   // past LABEL_HOLD_MS
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Swift').classList.contains('cond-open'),
            'expected the expiring label to stay pinned through the hold'));
        // Its non-expiring neighbour still collapses on the normal schedule.
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'WellFed').classList.contains('cond-open'),
            'expected the untimed neighbour to have collapsed'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: eating another source of an active buff re-shows its name',
    file: '/screens/conditions.html',
    async run(ctx) {
        // The point of the top-up feedback: the chip is already on screen and its Id has
        // not changed, so without this you get no confirmation of WHICH buff you extended.
        send(ctx, [BUFF('Swift', 30, 45, 0), BUFF('Energised', 30, 45, 0)]);
        await new Promise(r => setTimeout(r, 3200));   // both settle to icon-only
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Swift').classList.contains('cond-open'),
            'precondition: Swift settled'));

        // A second consumable re-grants Swift only.
        send(ctx, [BUFF('Swift', 300, 300, 1), BUFF('Energised', 26, 45, 0)]);
        await new Promise(r => setTimeout(r, 80));

        ctx.expect(ctx.assert.truthy(chip(ctx, 'Swift').classList.contains('cond-open'),
            'expected the topped-up buff to show its name again'));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Swift').classList.contains('cond-refresh'),
            'expected the top-up bump on the topped-up chip'));
        // The untouched neighbour stays as it was.
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Energised').classList.contains('cond-open'),
            'the buff that was not re-granted should stay collapsed'));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Energised').classList.contains('cond-refresh'),
            'the buff that was not re-granted should not bump'));

        // The bump is a one-shot; the name then collapses on the normal hold.
        await new Promise(r => setTimeout(r, 600));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Swift').classList.contains('cond-refresh'),
            'expected the bump to clear itself'));
        await new Promise(r => setTimeout(r, 3000));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Swift').classList.contains('cond-open'),
            'expected the re-shown name to collapse again after the hold'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: an unchanged refresh count causes no bump',
    file: '/screens/conditions.html',
    async run(ctx) {
        send(ctx, [BUFF('Hearty', 700, 900, 2)]);
        await new Promise(r => setTimeout(r, 3200));

        // Ordinary countdown updates carry the same RefreshCount — no re-show.
        send(ctx, [BUFF('Hearty', 690, 900, 2)]);
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Hearty').classList.contains('cond-refresh'),
            'a plain countdown update must not bump'));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Hearty').classList.contains('cond-open'),
            'a plain countdown update must not re-show the name'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: a chip mounting with a non-zero refresh count does not bump',
    file: '/screens/conditions.html',
    async run(ctx) {
        // Sticky replay after a reload can deliver a buff already topped up twice. The
        // entry animation introduces it — a bump on top would read as a second event.
        send(ctx, [BUFF('Swift', 300, 300, 2)]);
        await new Promise(r => setTimeout(r, 120));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Swift').classList.contains('cond-refresh'),
            'a freshly mounted chip should not bump'));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Swift').classList.contains('cond-open'),
            'it should still enter with its name, as any new chip does'));

        // A further top-up from there still registers.
        send(ctx, [BUFF('Swift', 300, 300, 3)]);
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Swift').classList.contains('cond-refresh'),
            'a later top-up should still bump'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: topping up an expiring buff clears the pulse and re-shows the name',
    file: '/screens/conditions.html',
    async run(ctx) {
        send(ctx, [BUFF('Energised', 3, 45, 0)]);
        await new Promise(r => setTimeout(r, 100));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Energised').classList.contains('cond-expiring'),
            'precondition: expiring'));

        send(ctx, [BUFF('Energised', 45, 45, 1)]);
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Energised').classList.contains('cond-expiring'),
            'expected the pulse to stop'));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Energised').classList.contains('cond-refresh'),
            'expected the top-up bump'));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Energised').classList.contains('cond-open'),
            'expected the name shown again'));

        // Un-pinned now, so it collapses on the normal hold rather than staying open.
        await new Promise(r => setTimeout(r, 3400));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Energised').classList.contains('cond-open'),
            'expected it to collapse once no longer expiring'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: untimed conditions never pulse',
    file: '/screens/conditions.html',
    async run(ctx) {
        // Tag-driven conditions carry RemainingTime 0 — that is "no clock", not "expired".
        send(ctx, [DEBUFF('Starving'), DEBUFF('Overburdened'), BUFF('Hidden')]);
        await new Promise(r => setTimeout(r, 80));
        for (const id of ['Starving', 'Overburdened', 'Hidden']) {
            ctx.expect(ctx.assert.truthy(!chip(ctx, id).classList.contains('cond-expiring'),
                `${id} has no duration and must not pulse`));
        }
    },
});

TSICTestHarness.register({
    name: 'Conditions: DOM order follows the payload so chips never reshuffle',
    file: '/screens/conditions.html',
    async run(ctx) {
        // C++ emits debuffs first; the component stacks bottom-up, so DOM order is payload order.
        send(ctx, [DEBUFF('Hungry'), BUFF('Swift', 30, 45)]);
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.eq(liveChips(ctx).map(c => c.dataset.id).join(','), 'Hungry,Swift'));

        // A condition inserted between the two lands between them, not at the end.
        send(ctx, [DEBUFF('Hungry'), BUFF('WellFed'), BUFF('Swift', 30, 45)]);
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.eq(liveChips(ctx).map(c => c.dataset.id).join(','), 'Hungry,WellFed,Swift'));

        // And a debuff arriving later still sorts to the bottom of the stack.
        send(ctx, [DEBUFF('Burning'), DEBUFF('Hungry'), BUFF('WellFed'), BUFF('Swift', 30, 45)]);
        await new Promise(r => setTimeout(r, 80));
        ctx.expect(ctx.assert.eq(liveChips(ctx).map(c => c.dataset.id).join(','), 'Burning,Hungry,WellFed,Swift'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: a chip arriving while another fades does not disturb the fading one',
    file: '/screens/conditions.html',
    async run(ctx) {
        send(ctx, [DEBUFF('Hungry'), BUFF('Swift', 30, 45)]);
        await new Promise(r => setTimeout(r, 80));
        const swiftEl = chip(ctx, 'Swift');

        // Swift lapses and Burning lands in the same beat — Burning sorts to the bottom.
        send(ctx, [DEBUFF('Burning'), DEBUFF('Hungry')]);
        await new Promise(r => setTimeout(r, 60));

        ctx.expect(ctx.assert.eq(liveChips(ctx).map(c => c.dataset.id).join(','), 'Burning,Hungry'));
        // The fading chip keeps its slot rather than being shuffled to an end.
        ctx.expect(ctx.assert.truthy(swiftEl.classList.contains('cond-exit'), 'Swift should be exiting'));
        const all = Array.from(ctx.doc.querySelectorAll('#hud-conditions .cond-chip'));
        ctx.expect(ctx.assert.eq(all[all.length - 1], swiftEl,
            'the exiting chip should still sit above the live ones, where it was'));

        await new Promise(r => setTimeout(r, EXIT_MS));
        ctx.expect(ctx.assert.eq(liveChips(ctx).map(c => c.dataset.id).join(','), 'Burning,Hungry'));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Swift'), 'Swift should be gone'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: re-applying during the exit animation leaves one chip',
    file: '/screens/conditions.html',
    async run(ctx) {
        // Eating a second helping the instant the first lapses: the outgoing chip must be
        // dropped rather than left in the DOM alongside its replacement.
        send(ctx, [BUFF('Swift', 30, 45)]);
        await new Promise(r => setTimeout(r, 80));
        send(ctx, []);                              // starts the 280ms exit
        await new Promise(r => setTimeout(r, 40));  // well inside it
        send(ctx, [BUFF('Swift', 45, 45)]);
        await new Promise(r => setTimeout(r, 80));

        ctx.expect(ctx.assert.eq(ctx.doc.querySelectorAll('#hud-conditions .cond-chip[data-id="Swift"]').length, 1,
            'expected exactly one Swift chip'));
        ctx.expect(ctx.assert.eq(liveChips(ctx).length, 1));

        // And the survivor is the live one, not a stuck ghost.
        await new Promise(r => setTimeout(r, EXIT_MS));
        ctx.expect(ctx.assert.truthy(chip(ctx, 'Swift'), 'the re-applied chip should still be mounted'));
        ctx.expect(ctx.assert.truthy(!chip(ctx, 'Swift').classList.contains('cond-exit'),
            'the surviving chip should be live'));
    },
});

TSICTestHarness.register({
    name: 'Conditions: repeated identical snapshots do not remount chips',
    file: '/screens/conditions.html',
    async run(ctx) {
        send(ctx, [BUFF('Hearty', 700, 900)]);
        await new Promise(r => setTimeout(r, 80));
        const first = chip(ctx, 'Hearty');

        send(ctx, [BUFF('Hearty', 690, 900)]);
        send(ctx, [BUFF('Hearty', 680, 900)]);
        await new Promise(r => setTimeout(r, 80));

        ctx.expect(ctx.assert.truthy(chip(ctx, 'Hearty') === first,
            'a still-active condition must keep its element (no re-entry animation)'));
        ctx.expect(ctx.assert.eq(liveChips(ctx).length, 1));
    },
});

TSICTestHarness.register({
    name: 'Conditions: chips stay compact',
    file: '/screens/conditions.html',
    async run(ctx) {
        send(ctx, [BUFF('QuickRecovery', 95, 120)]);   // longest label in the catalogue
        await new Promise(r => setTimeout(r, 400));    // let the widen animation finish

        const c = chip(ctx, 'QuickRecovery');
        const rect = c.getBoundingClientRect();
        ctx.expect(ctx.assert.truthy(rect.height <= 26,
            `chip should stay short, got ${rect.height}px`));
        ctx.expect(ctx.assert.truthy(rect.width <= 152,
            `even the longest label should stay narrow, got ${rect.width}px`));
    },
});
