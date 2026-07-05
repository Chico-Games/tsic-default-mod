TSICTestHarness.register({
    name: 'ConstructionCarousel: renders 9-slot strip with current highlighted',
    file: '/screens/construction-carousel.html',
    async run(ctx) {
        const slot = (id, label, ok = true) => ({ FurnitureId: id, IconUrl: '', Label: label, bAffordable: ok });
        ctx.inject('tsic.msg.UI.Construction.Carousel', {
            bActive: true,
            Prev: [slot('A','A'), slot('B','B'), slot('C','C'), slot('D','D')],
            Current: slot('E','E'),
            Next: [slot('F','F'), slot('G','G'), slot('H','H', false), slot('I','I')],
            RotationAxis: 'Z',
            BlockedReason: '',
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#cc-row .cc-slot').length === 9);
        ctx.expect(ctx.assert.domVisible(ctx.doc, '#hud-construction-carousel'));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#cc-row .cc-slot.current', 1));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#cc-row .cc-slot.unafford', 1));
        ctx.expect(ctx.assert.domText(ctx.doc, '#cc-rotation', 'ROTATION: Z'));
        // No "nothing to build" hint while slots are present.
        ctx.expect(ctx.assert.domText(ctx.doc, '#cc-empty', ''));
    },
});

TSICTestHarness.register({
    name: 'ConstructionCarousel: blocked reason surfaces',
    file: '/screens/construction-carousel.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.Carousel', {
            bActive: true,
            Prev: [], Current: { FurnitureId: 'X', Label: 'X', bAffordable: false }, Next: [],
            BlockedReason: 'no clearance',
        });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.domText(ctx.doc, '#cc-blocked', /NO CLEARANCE/));
    },
});

// bActive is the single source of truth for visibility. EndAbility broadcasts an
// empty payload with bActive=false, which must hide the strip even though the
// "active but nothing to build" state ALSO has an empty Current.
TSICTestHarness.register({
    name: 'ConstructionCarousel: hides when build mode inactive',
    file: '/screens/construction-carousel.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.Carousel', {
            bActive: true, Prev: [], Current: { FurnitureId: 'X', Label: 'X', bAffordable: true }, Next: [],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#cc-row .cc-slot').length === 1);
        ctx.inject('tsic.msg.UI.Construction.Carousel', { bActive: false, Prev: [], Current: {}, Next: [] });
        await ctx.waitFor(() => ctx.assert.domHidden(ctx.doc, '#hud-construction-carousel') === null);
        ctx.expect(ctx.assert.domHidden(ctx.doc, '#hud-construction-carousel'));
    },
});

// Entering build mode with nothing constructable must still show the strip,
// with a hint, instead of vanishing (which reads as "build mode failed").
TSICTestHarness.register({
    name: 'ConstructionCarousel: stays visible with hint when nothing to build',
    file: '/screens/construction-carousel.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Construction.Carousel', {
            bActive: true, Prev: [], Current: {}, Next: [],
        });
        await ctx.waitFor(() => ctx.assert.domVisible(ctx.doc, '#hud-construction-carousel') === null);
        ctx.expect(ctx.assert.domVisible(ctx.doc, '#hud-construction-carousel'));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#cc-row .cc-slot', 0));
        ctx.expect(ctx.assert.domText(ctx.doc, '#cc-empty', /Nothing to build/i));
    },
});

// Unaffordable items are shown by dimming the icon, NOT by a red wash overlay
// (the old .cc-slot.unafford::after). This keeps the look matching other UI.
TSICTestHarness.register({
    name: 'ConstructionCarousel: unaffordable slot dims icon and has no red overlay',
    file: '/screens/construction-carousel.html',
    async run(ctx) {
        const slot = (id, label, ok = true) => ({ FurnitureId: id, IconUrl: '/shared/x.svg', Label: label, bAffordable: ok });
        ctx.inject('tsic.msg.UI.Construction.Carousel', {
            bActive: true, Prev: [], Current: slot('U','U', false), Next: [],
        });
        await ctx.waitFor(() => !!ctx.doc.querySelector('#cc-row .cc-slot.unafford'));
        const win = ctx.doc.defaultView;
        const slotEl = ctx.doc.querySelector('#cc-row .cc-slot.unafford');
        const after = win.getComputedStyle(slotEl, '::after');
        // No red-overlay ::after. Real browsers report 'none'/'normal' for an
        // unset content; jsdom reports '' — all mean "no overlay".
        const noOverlay = !after.content || after.content === 'none' || after.content === 'normal';
        ctx.expect(ctx.assert.truthy(noOverlay, 'unafford ::after content (no red overlay)'));
        const img = slotEl.querySelector('img');
        ctx.expect(ctx.assert.truthy(img, 'unafford slot has an icon img'));
        if (img) {
            const op = parseFloat(win.getComputedStyle(img).opacity);
            ctx.expect(op < 1 ? null : `expected unafford icon opacity < 1, got ${op}`);
        }
    },
});

// "Neutral cells, not beige" — the slot fill must no longer be the parchment
// beige (rgb(241,229,207)) that bled through icon transparency.
TSICTestHarness.register({
    name: 'ConstructionCarousel: slot cells are not beige-tinted',
    file: '/screens/construction-carousel.html',
    async run(ctx) {
        const slot = (id, label) => ({ FurnitureId: id, IconUrl: '', Label: label, bAffordable: true });
        ctx.inject('tsic.msg.UI.Construction.Carousel', {
            bActive: true, Prev: [slot('A','A')], Current: slot('B','B'), Next: [slot('C','C')],
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#cc-row .cc-slot').length === 3);
        const win = ctx.doc.defaultView;
        const cell = ctx.doc.querySelector('#cc-row .cc-slot:not(.current)');
        const bg = win.getComputedStyle(cell).backgroundColor;
        ctx.expect(/241,\s*229,\s*207/.test(bg) ? `slot still beige-tinted: ${bg}` : null);
    },
});
