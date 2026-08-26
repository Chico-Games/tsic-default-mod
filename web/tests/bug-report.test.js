TSICTestHarness.register({
    name: 'BugReport: submit publishes BugReport.Submit',
    file: '/screens/bug-report.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('textarea, [contenteditable]'));
        const ta = ctx.doc.querySelector('textarea');
        if (ta) ta.value = 'crash in inventory';
        ctx.clearPublishes();
        const submit = Array.from(ctx.doc.querySelectorAll('button')).find(b => /submit|send|report/i.test(b.textContent || ''));
        ctx.expect(ctx.assert.truthy(submit, 'expected a submit button'));
        submit && submit.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BugReport.Submit'));
    },
});

TSICTestHarness.register({
    name: 'BugReport: a sent report closes the form, it does not force gameplay',
    file: '/screens/bug-report.html',
    async run(ctx) {
        // REGRESSION (#150): submit used to publish Pause.Resume, which the director
        // answers by switching to InGame whatever world is loaded. Filed from the main
        // menu that left the player on the menu level with no UI and no way back. Close
        // is the routed exit — it returns to the screen the form was opened from and
        // clears the furniture snapshot on the way.
        await ctx.waitFor(() => ctx.doc.querySelector('textarea'));
        ctx.doc.querySelector('textarea').value = 'the shelf is inside the wall';
        ctx.clearPublishes();
        Array.from(ctx.doc.querySelectorAll('button'))
            .find(b => /submit|send/i.test(b.textContent || '')).click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BugReport.Submit'));
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BugReport.Close'));
        ctx.expect(ctx.assert.notPublished(ctx.handle, 'UI.Cmd.Pause.Resume'));
    },
});

// --- "this furniture is out of position" -----------------------------------
//
// The form must show the player which piece of furniture the view ray picked
// before they describe the problem, so a report can never be filed against
// something they weren't looking at.

const FURNITURE_TARGET = {
    bHasTarget: true,
    DisplayName: 'Metal Shelf',
    DefinitionId: 'FD_Shelf_DF',
    TileIndex: 4821,
    TileCoord: 'N33 E71',
    MapName: 'Durham',
    bMoved: false,
};

// Pick a dropdown value the way tsic-dropdown does, so the screen's
// tsic-change listener fires.
function selectCategory(ctx, value) {
    const trigger = ctx.doc.querySelector('#br-category');
    ctx.win.tsic.dropdown.set(trigger, value);
    return trigger;
}

TSICTestHarness.register({
    name: 'BugReport: opening the form asks C++ for the looked-at furniture',
    file: '/screens/bug-report.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#br-category'));
        // onShow fires on mount, before any category is chosen.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BugReport.RequestFurnitureTarget'));
    },
});

TSICTestHarness.register({
    name: 'BugReport: the form offers exactly Bug and Suggestion',
    file: '/screens/bug-report.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#br-category'));
        const trigger = ctx.doc.querySelector('#br-category');
        const values = JSON.parse(trigger.getAttribute('data-tsic-options')).map(o => o.value);
        // Pinned, not merely counted: "World generation issue" and "Other" were both
        // removed deliberately, and a category that reappears here silently starts
        // writing a value the server no longer classifies.
        ctx.expect(ctx.assert.truthy(JSON.stringify(values) === JSON.stringify(['Bug', 'Suggestion']),
            `category options should be exactly Bug, Suggestion; got: ${JSON.stringify(values)}`));
        ctx.expect(ctx.assert.truthy(ctx.win.tsic.dropdown.get(trigger) === 'Bug',
            'the form should open on Bug'));
    },
});

TSICTestHarness.register({
    name: 'BugReport: a suggestion hides the furniture panel',
    file: '/screens/bug-report.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#br-furniture'));
        const panel = ctx.doc.querySelector('#br-furniture');

        ctx.inject('tsic.msg.UI.BugReport.FurnitureTarget', FURNITURE_TARGET);
        selectCategory(ctx, 'Suggestion');
        ctx.expect(ctx.assert.truthy(!panel.classList.contains('br-shown'),
            'a suggestion is not about an object, so it attaches nothing'));
    },
});

TSICTestHarness.register({
    name: 'BugReport: the bug panel names the captured furniture',
    file: '/screens/bug-report.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#br-furniture'));
        const panel = ctx.doc.querySelector('#br-furniture');

        ctx.inject('tsic.msg.UI.BugReport.FurnitureTarget', FURNITURE_TARGET);
        selectCategory(ctx, 'Bug');
        await ctx.waitFor(() => panel.classList.contains('br-shown'));

        const text = panel.textContent || '';
        for (const expected of ['Metal Shelf', 'FD_Shelf_DF', 'Durham', '4821', 'N33 E71']) {
            ctx.expect(ctx.assert.truthy(text.includes(expected),
                `furniture panel should show ${expected}; got: ${text}`));
        }
        ctx.expect(ctx.assert.truthy(/as the level generated it/i.test(text),
            `unmoved furniture should say so; got: ${text}`));
    },
});

TSICTestHarness.register({
    name: 'BugReport: the panel reports moved furniture differently',
    file: '/screens/bug-report.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#br-furniture'));
        ctx.inject('tsic.msg.UI.BugReport.FurnitureTarget',
            { ...FURNITURE_TARGET, bMoved: true });
        selectCategory(ctx, 'Bug');

        const panel = ctx.doc.querySelector('#br-furniture');
        await ctx.waitFor(() => /moved since/i.test(panel.textContent || ''));
        ctx.expect(ctx.assert.truthy(/moved since/i.test(panel.textContent || ''),
            'moved furniture should be called out as moved'));
    },
});

TSICTestHarness.register({
    name: 'BugReport: a bug about misplaced furniture submits as a bug',
    file: '/screens/bug-report.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#br-furniture'));
        ctx.inject('tsic.msg.UI.BugReport.FurnitureTarget', FURNITURE_TARGET);
        selectCategory(ctx, 'Bug');

        ctx.doc.querySelector('#br-description').value = 'shelf is halfway inside the wall';
        ctx.clearPublishes();
        ctx.doc.querySelector('#btn-submit').click();
        // This is the report that used to need its own world-gen category. It goes
        // out as a plain Bug now, with the furniture snapshot riding along.
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BugReport.Submit',
            { where: p => p.Category === 'Bug' }));
    },
});

// --- the target is attached when there is one, never required ---------------

TSICTestHarness.register({
    name: 'BugReport: bug submits with nothing under the crosshair',
    file: '/screens/bug-report.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#br-furniture'));
        ctx.inject('tsic.msg.UI.BugReport.FurnitureTarget', { bHasTarget: false });
        selectCategory(ctx, 'Bug');

        const panel = ctx.doc.querySelector('#br-furniture');
        await ctx.waitFor(() => /nothing under the crosshair/i.test(panel.textContent || ''));
        // Not an error state — a bug without an object is still a bug, and the
        // report must go out rather than sending the player off to re-aim.

        ctx.doc.querySelector('#br-description').value = 'stamina never regenerates';
        ctx.clearPublishes();
        ctx.doc.querySelector('#btn-submit').click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BugReport.Submit',
            { where: p => p.Category === 'Bug' }));
    },
});

// --- Shift+Enter sends, plain Enter stays a newline -------------------------

function pressEnter(ctx, shiftKey) {
    const ta = ctx.doc.querySelector('#br-description');
    ta.focus();
    ta.dispatchEvent(new ctx.win.KeyboardEvent('keydown', {
        key: 'Enter', shiftKey, bubbles: true, cancelable: true,
    }));
}

TSICTestHarness.register({
    name: 'BugReport: Shift+Enter submits the report',
    file: '/screens/bug-report.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#br-description'));
        ctx.doc.querySelector('#br-description').value = 'enemy clipped through the floor';
        ctx.clearPublishes();
        pressEnter(ctx, /*shiftKey*/ true);
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.BugReport.Submit'));
    },
});

TSICTestHarness.register({
    name: 'BugReport: plain Enter does not submit (it is a newline)',
    file: '/screens/bug-report.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#br-description'));
        ctx.doc.querySelector('#br-description').value = 'enemy clipped through the floor';
        ctx.clearPublishes();
        pressEnter(ctx, /*shiftKey*/ false);

        const submitted = ctx.publishes().some(p =>
            String(p.channel || p.Channel || '').includes('UI.Cmd.BugReport.Submit'));
        ctx.expect(ctx.assert.truthy(!submitted,
            'plain Enter must insert a newline, not send the report'));
    },
});
