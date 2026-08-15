// Tutorial objectives box (shared/hud-tutorial.js) — content and legibility.
//
// The legibility half exists because of issue #227: "Objective UI needs to be larger, it's
// currently small enough that it could be hard to read for certain people. Playing in 1440p."
// The box is sized in vh, so the assertion is a FLOOR on the rendered size rather than an
// exact value — it pins "never smaller than this" without pinning the design.

const STEPS = [
    { Id: 'OpenCraftingBench', bDone: true },
    { Id: 'DragFurniture', bDone: false },
    { Id: 'Construct', bDone: false },
    { Id: 'SetSpawnPoint', bDone: false },
    { Id: 'EatFood', bDone: false },
];

async function showObjectives(ctx, steps) {
    ctx.inject('tsic.msg.UI.Tutorial.State', { Steps: steps || STEPS, bEnabled: true });
    await ctx.waitFor(() => ctx.doc.querySelectorAll('#hud-tutorial .tut-row').length > 0,
        { timeout: 4000 });
}

TSICTestHarness.register({
    name: 'Objectives: the last completed step is ticked above the next few incomplete ones',
    file: '/screens/in-game.html',
    async run(ctx) {
        await showObjectives(ctx);
        const rows = ctx.doc.querySelectorAll('#hud-tutorial .tut-row');
        // 1 done + 3 upcoming.
        ctx.expect(ctx.assert.eq(rows.length, 4, 'four rows: the completed one plus three upcoming'));
        ctx.expect(ctx.assert.truthy(rows[0].classList.contains('tut-done'),
            'the completed step leads'));
        ctx.expect(ctx.assert.eq(rows[0].querySelector('.tut-label').textContent,
            'Find a crafting bench', 'steps are labelled, never shown as raw ids'));
        ctx.expect(ctx.assert.falsy(rows[1].classList.contains('tut-done'),
            'the rows below it are the upcoming objectives'));
        ctx.expect(ctx.assert.falsy(ctx.doc.getElementById('hud-tutorial').classList.contains('tut-hidden'),
            'the box is up while objectives remain'));
    },
});

TSICTestHarness.register({
    name: 'Objectives: the box hides once every step is done',
    file: '/screens/in-game.html',
    async run(ctx) {
        await showObjectives(ctx);
        ctx.inject('tsic.msg.UI.Tutorial.State', {
            Steps: STEPS.map(s => ({ Id: s.Id, bDone: true })), bEnabled: true,
        });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-tutorial').classList.contains('tut-hidden'),
            { timeout: 2000 });
        ctx.expect(ctx.assert.truthy(
            ctx.doc.getElementById('hud-tutorial').classList.contains('tut-hidden'),
            'nothing left to do, nothing on screen'));
    },
});

TSICTestHarness.register({
    name: 'Objectives: rows are large enough to read (issue #227)',
    file: '/screens/in-game.html',
    async run(ctx) {
        await showObjectives(ctx);
        const root = ctx.doc.getElementById('hud-tutorial');
        const label = root.querySelector('.tut-row .tut-label');
        const header = root.querySelector('.tut-header');
        const rowPx = parseFloat(ctx.win.getComputedStyle(label).fontSize);
        const headerPx = parseFloat(ctx.win.getComputedStyle(header).fontSize);

        // The box was authored at 12px rows / 11px header, which is what the report is about.
        ctx.expect(ctx.assert.truthy(rowPx >= 15, `objective rows are at least 15px (got ${rowPx}px)`));
        ctx.expect(ctx.assert.truthy(headerPx >= 13, `the header is at least 13px (got ${headerPx}px)`));
        ctx.expect(ctx.assert.truthy(root.getBoundingClientRect().width >= 250,
            'the column is at least as wide as it ever was'));

        // Growth must not push it off the right edge or under the minimap above it.
        const box = root.getBoundingClientRect();
        ctx.expect(ctx.assert.truthy(box.right <= ctx.win.innerWidth + 1,
            `box stays on screen (right ${Math.round(box.right)} vs ${ctx.win.innerWidth})`));
        const minimap = ctx.doc.getElementById('hud-minimap');
        if (minimap) {
            ctx.expect(ctx.assert.truthy(box.top >= minimap.getBoundingClientRect().bottom,
                'the box still clears the minimap it sits under'));
        }
    },
});
