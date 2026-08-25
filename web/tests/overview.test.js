// Overview screen (shared/screens/overview.js) — the hold-Tab handbook + shift roster.
//
// Loaded through /screens/in-game.html rather than an isolated page: the screen is mounted
// by screen-manager into the real shell, and the solo/multiplayer switch is a property of
// that shell's layout, not of the module in isolation.
//
// Nothing here presses Tab. Opening is a C++ concern (UOverviewControllerComponent turns
// Input.Behavior.Overview into a screen change); what this suite owns is everything that
// happens once the screen is up.

const OPEN_MS = 120;   // screen-manager mount + first render

function panel(ctx, sel) {
    return ctx.doc.querySelector('[data-screen="Overview"] ' + sel);
}

function steps(ids) {
    return { Steps: ids.map(([Id, bDone]) => ({ Id, bDone })), bEnabled: true };
}

const DEFAULT_STEPS = steps([
    ['OpenCraftingBench', true],
    ['CraftWeapon', true],
    ['EquipWeapon', false],
    ['KillEnemy', false],
    ['DragFurniture', false],
    ['Construct', false],
    ['SetSpawnPoint', false],
    ['EatFood', false],
    ['OpenStorage', false],
    ['SurviveNight', false],
    ['ProduceRecipe', false],
    ['PlantSeed', false],
    ['UpgradeFurniture', false],
    ['RepairItem', false],
    ['UseTeleporter', false],
]);

function player(over) {
    return Object.assign({
        Id: 'p1', Name: 'Player', Color: '#ff0000',
        bIsHost: false, bIsLocal: false, bHasPawn: true, bIsDead: false,
        HealthPct: 1, Health: 100, MaxHealth: 100,
        DistanceM: 0, BearingDeg: 0, HeightLevel: 0,
    }, over || {});
}

async function open(ctx, tutorial, overview) {
    ctx.inject('tsic.msg.UI.Tutorial.State', tutorial || DEFAULT_STEPS);
    if (overview) ctx.inject('tsic.msg.UI.Overview.State', overview);
    ctx.screen('Overview');
    await new Promise(r => setTimeout(r, OPEN_MS));
}

// ---------------------------------------------------------------------------

TSICTestHarness.register({
    name: 'Overview: opens with chapters, goal rows and a progress dial',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx);

        ctx.expect(ctx.assert.truthy(panel(ctx, '#ov-shell'), 'expected the overview shell'));
        const chapters = ctx.doc.querySelectorAll('[data-screen="Overview"] .ov-chapter');
        ctx.expect(ctx.assert.truthy(chapters.length >= 3,
            'expected at least three chapters, got ' + chapters.length));

        const goals = ctx.doc.querySelectorAll('[data-screen="Overview"] .ov-goal');
        ctx.expect(ctx.assert.truthy(goals.length >= 10,
            'expected the full step list, got ' + goals.length));

        // Two of fifteen are done in the fixture.
        ctx.expect(ctx.assert.eq(panel(ctx, '#ov-dial-text').textContent, '2/15'));

        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: completed steps are ticked, outstanding ones are not',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx);

        const done = panel(ctx, '.ov-goal[data-step="OpenCraftingBench"]');
        const todo = panel(ctx, '.ov-goal[data-step="EquipWeapon"]');
        ctx.expect(ctx.assert.truthy(done, 'expected an OpenCraftingBench row'));
        ctx.expect(ctx.assert.truthy(todo, 'expected an EquipWeapon row'));
        ctx.expect(ctx.assert.truthy(done.classList.contains('is-done'), 'done row missing is-done'));
        ctx.expect(ctx.assert.truthy(!todo.classList.contains('is-done'), 'todo row wrongly is-done'));
        ctx.expect(ctx.assert.eq(done.querySelector('.ov-goal-mark').textContent, '✓'));

        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: the next-up callout names the first outstanding step',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx);

        const next = panel(ctx, '.ov-next .ov-next-title');
        ctx.expect(ctx.assert.truthy(next, 'expected a next-up callout'));
        // EquipWeapon is the first not-done step in the fixture's order.
        ctx.expect(ctx.assert.eq(next.textContent, 'Put it on your hotbar'));

        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: every goal row carries artwork',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx);

        const arts = Array.from(ctx.doc.querySelectorAll('[data-screen="Overview"] .ov-goal-art'));
        ctx.expect(ctx.assert.truthy(arts.length > 0, 'expected goal artwork slots'));
        const empty = arts.filter(a => !a.querySelector('img') && !a.querySelector('svg'));
        ctx.expect(ctx.assert.eq(empty.length, 0,
            empty.length + ' goal rows render no icon at all'));

        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: the To do filter hides finished steps',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx);

        panel(ctx, '.ov-chip[data-filter="todo"]').click();
        await new Promise(r => setTimeout(r, 40));

        ctx.expect(ctx.assert.falsy(panel(ctx, '.ov-goal[data-step="OpenCraftingBench"]'),
            'a finished step survived the To do filter'));
        ctx.expect(ctx.assert.truthy(panel(ctx, '.ov-goal[data-step="EquipWeapon"]'),
            'an outstanding step was filtered out'));

        // Put it back so the next scenario starts from the default view.
        panel(ctx, '.ov-chip[data-filter="all"]').click();
        await new Promise(r => setTimeout(r, 40));
        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: hovering a goal fills the detail box, clicking pins it',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx);

        const row = panel(ctx, '.ov-goal[data-step="PlantSeed"]');
        row.dispatchEvent(new ctx.win.MouseEvent('mouseenter', { bubbles: false }));
        await new Promise(r => setTimeout(r, 30));
        ctx.expect(ctx.assert.truthy(
            panel(ctx, '.ov-detail-title').textContent.indexOf('Plant a seed') === 0,
            'hover did not describe the hovered goal'));

        // "Look for" icons come from the card's find list.
        ctx.expect(ctx.assert.truthy(panel(ctx, '.ov-detail-find .ov-find'),
            'expected look-for icons for a card that lists them'));

        row.click();
        await new Promise(r => setTimeout(r, 40));
        ctx.expect(ctx.assert.truthy(
            panel(ctx, '.ov-detail-title').textContent.indexOf('pinned') !== -1,
            'clicking a goal did not pin it'));
        ctx.expect(ctx.assert.truthy(
            panel(ctx, '.ov-goal[data-step="PlantSeed"]').classList.contains('is-picked'),
            'the pinned row is not marked'));

        panel(ctx, '.ov-goal[data-step="PlantSeed"]').click();   // unpin
        await new Promise(r => setTimeout(r, 40));
        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: a step C++ sends but the handbook has no card for still appears',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx, steps([['OpenCraftingBench', true], ['SomethingBrandNew', false]]));

        const row = panel(ctx, '.ov-goal[data-step="SomethingBrandNew"]');
        ctx.expect(ctx.assert.truthy(row, 'an uncarded step vanished from the handbook'));
        ctx.expect(ctx.assert.eq(row.querySelector('.ov-goal-title').textContent,
            'Something Brand New'));

        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: single player hides the roster and widens the handbook',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx, null, {
            Players: [player({ Id: 'me', Name: 'Solo', bIsLocal: true, bIsHost: true })],
            bMultiplayer: false, bLocalIsHost: true, Day: 1, DaySection: 'Gameplay.DaySection.Day',
            DayFraction: 0.25,
        });

        ctx.expect(ctx.assert.eq(panel(ctx, '#ov-shell').getAttribute('data-solo'), '1'));
        const roster = panel(ctx, '#ov-roster');
        ctx.expect(ctx.assert.eq(ctx.win.getComputedStyle(roster).display, 'none',
            'the roster panel is visible in single player'));

        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: multiplayer shows one roster row per player, with badges',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx, null, {
            Players: [
                player({ Id: 'me', Name: 'Dani', bIsLocal: true, Color: '#33cc66' }),
                player({ Id: 'host', Name: 'Chico', bIsHost: true, DistanceM: 42, BearingDeg: 90 }),
                player({ Id: 'down', Name: 'Sam', bIsDead: true, HealthPct: 0, Health: 0, DistanceM: 8 }),
            ],
            bMultiplayer: true, bLocalIsHost: false, Day: 3,
            DaySection: 'Gameplay.DaySection.Night', DayFraction: 0.8,
        });

        ctx.expect(ctx.assert.eq(panel(ctx, '#ov-shell').getAttribute('data-solo'), '0'));
        const rows = ctx.doc.querySelectorAll('[data-screen="Overview"] .ov-player');
        ctx.expect(ctx.assert.eq(rows.length, 3, 'expected one row per player'));

        const me = panel(ctx, '.ov-player[data-player="me"]');
        ctx.expect(ctx.assert.truthy(me.classList.contains('is-local'), 'local row not marked'));
        ctx.expect(ctx.assert.truthy(me.querySelector('.ov-badge--you'), 'expected a You badge'));

        ctx.expect(ctx.assert.truthy(
            panel(ctx, '.ov-player[data-player="host"] .ov-badge--host'), 'expected a Host badge'));

        const down = panel(ctx, '.ov-player[data-player="down"]');
        ctx.expect(ctx.assert.truthy(down.classList.contains('is-dead'), 'downed row not marked'));
        ctx.expect(ctx.assert.truthy(down.querySelector('.ov-badge--down'), 'expected a Down badge'));

        ctx.expect(ctx.assert.eq(panel(ctx, '#ov-session-day').textContent, 'Day 3 · Night'));

        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: a teammate with no pawn reads as out of range, not as dead',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx, null, {
            Players: [
                player({ Id: 'me', Name: 'Dani', bIsLocal: true }),
                player({ Id: 'far', Name: 'Far', bHasPawn: false, HealthPct: 0, Health: 0, MaxHealth: 0 }),
            ],
            bMultiplayer: true, Day: 1, DaySection: 'Gameplay.DaySection.Day', DayFraction: 0.1,
        });

        const far = panel(ctx, '.ov-player[data-player="far"]');
        ctx.expect(ctx.assert.truthy(far.classList.contains('is-away'), 'out-of-range row not marked'));
        ctx.expect(ctx.assert.truthy(!far.classList.contains('is-dead'),
            'an out-of-range teammate is being drawn as dead'));
        ctx.expect(ctx.assert.eq(far.querySelector('.ov-player-meta').textContent, 'Out of range'));
        // An empty health bar reads as "dead" — it has to be absent, not zero-width.
        ctx.expect(ctx.assert.eq(far.querySelector('.ov-hp').style.display, 'none'));

        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: repeated payloads update rows in place, not by rebuilding them',
    file: '/screens/in-game.html',
    async run(ctx) {
        const base = {
            Players: [
                player({ Id: 'me', Name: 'Dani', bIsLocal: true }),
                player({ Id: 'mate', Name: 'Mate', DistanceM: 10, HealthPct: 1, Health: 100 }),
            ],
            bMultiplayer: true, Day: 1, DaySection: 'Gameplay.DaySection.Day', DayFraction: 0.1,
        };
        await open(ctx, null, base);

        // Identity, not equality: a row replaced under a hovering cursor is the bug.
        const before = panel(ctx, '.ov-player[data-player="mate"]');
        ctx.inject('tsic.msg.UI.Overview.State', Object.assign({}, base, {
            Players: [
                player({ Id: 'me', Name: 'Dani', bIsLocal: true }),
                player({ Id: 'mate', Name: 'Mate', DistanceM: 25, HealthPct: 0.4, Health: 40 }),
            ],
        }));
        await new Promise(r => setTimeout(r, 40));
        const after = panel(ctx, '.ov-player[data-player="mate"]');

        ctx.expect(ctx.assert.truthy(before === after, 'the roster row was rebuilt on a data-only update'));
        ctx.expect(ctx.assert.eq(after.querySelector('.ov-dist').textContent, '25 m'));
        ctx.expect(ctx.assert.eq(after.querySelector('.ov-hp').getAttribute('data-state'), 'hurt'));

        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: the bearing arrow rotates to the payload bearing',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx, null, {
            Players: [
                player({ Id: 'me', Name: 'Dani', bIsLocal: true }),
                player({ Id: 'mate', Name: 'Mate', DistanceM: 12, BearingDeg: -90 }),
            ],
            bMultiplayer: true, Day: 1, DaySection: 'Gameplay.DaySection.Day', DayFraction: 0.1,
        });

        const arrow = panel(ctx, '.ov-player[data-player="mate"] .ov-bearing svg');
        ctx.expect(ctx.assert.truthy(arrow, 'expected a bearing arrow'));
        ctx.expect(ctx.assert.eq(arrow.style.transform, 'rotate(-90deg)'));

        // The local row has no bearing to point at.
        ctx.expect(ctx.assert.eq(
            panel(ctx, '.ov-player[data-player="me"] .ov-bearing svg').style.display, 'none'));

        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: tabs switch between the handbook, notes and controls',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx);

        panel(ctx, '.tsic-tab[data-tab="notes"]').click();
        await new Promise(r => setTimeout(r, 40));
        ctx.expect(ctx.assert.truthy(panel(ctx, '.ov-note'), 'the notes page rendered nothing'));
        ctx.expect(ctx.assert.eq(ctx.win.getComputedStyle(panel(ctx, '#ov-filters')).display, 'none',
            'the goal filters are still showing on the notes page'));

        ctx.inject('tsic.msg.UI.Settings.ControlsState', {
            Entries: [
                { HotkeyId: 'HK_Overview', DisplayName: 'Overview', Category: 'Interface',
                  KeyboardKeyText: 'Tab', GamepadKeyText: '' },
                { HotkeyId: 'HK_Jump', DisplayName: 'Jump', Category: 'Movement',
                  KeyboardKeyText: 'Space Bar', GamepadKeyText: 'Gamepad Face Button Bottom' },
            ],
            MouseSensitivity: 1, GamepadSensitivity: 1,
        });
        panel(ctx, '.tsic-tab[data-tab="controls"]').click();
        await new Promise(r => setTimeout(r, 40));
        const rows = ctx.doc.querySelectorAll('[data-screen="Overview"] .ov-ctl');
        ctx.expect(ctx.assert.eq(rows.length, 2, 'expected a row per bound control'));
        ctx.expect(ctx.assert.truthy(panel(ctx, '.ov-ctl-group'), 'controls were not grouped'));

        panel(ctx, '.tsic-tab[data-tab="guide"]').click();
        await new Promise(r => setTimeout(r, 40));
        ctx.expect(ctx.assert.truthy(panel(ctx, '.ov-goal'), 'returning to the handbook rendered nothing'));

        ctx.screen('InGame');
    },
});

TSICTestHarness.register({
    name: 'Overview: finishing everything replaces the callout rather than leaving it stale',
    file: '/screens/in-game.html',
    async run(ctx) {
        await open(ctx, steps([['OpenCraftingBench', true], ['CraftWeapon', true]]));

        const callout = panel(ctx, '.ov-next');
        ctx.expect(ctx.assert.truthy(callout, 'expected an all-clear callout'));
        ctx.expect(ctx.assert.truthy(callout.classList.contains('is-done'),
            'the all-clear callout is still styled as an outstanding objective'));
        ctx.expect(ctx.assert.eq(panel(ctx, '#ov-dial-text').textContent, '2/2'));

        ctx.screen('InGame');
    },
});
