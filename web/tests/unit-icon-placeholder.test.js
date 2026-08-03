// Unit tests for the item-icon loading state in shared/icons.js.
//
// /tex/item-icon/<id> 404s its first (cold) request while C++ async-loads and
// PNG-encodes the thumbnail, so every icon on a freshly-built screen starts as a
// failed <img>. Two things must hold through that window: the browser's
// broken-image glyph must never be what the player sees, and the slot must not
// collapse — it shows the same cardboard box the C++ resolver serves for an item
// whose thumbnail can't be resolved at all.
//
// These run against a static server with no /tex/ route, so every request 404s:
// that is exactly the cold-cache shape, held permanently.
TSICTestHarness.register({
    name: 'Unit/Icons: a pending icon shows the cardboard box, never the broken-image glyph',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        const img = ctx.win.TSIC.iconImg(ctx.win.TSIC.itemIconUrl('ID_DefinitelyNotReal'));
        ctx.doc.body.appendChild(img);

        // Retry ladder is 120/280/600/1200ms; wait past the last one.
        await ctx.waitFor(() => img.classList.contains('tsic-icon-loading')
            && img.src.indexOf('data:image/gif') === 0, { timeout: 4000 });

        ctx.expect(ctx.assert.truthy(img.classList.contains('tsic-icon-loading'),
            'the placeholder class survives the whole retry ladder'));
        ctx.expect(ctx.assert.truthy(img.src.indexOf('data:image/gif') === 0,
            'src parks on the blank pixel so no broken-image glyph can paint'));
        ctx.expect(ctx.assert.truthy(img.style.display !== 'none',
            'the slot keeps its box instead of collapsing'));

        const css = ctx.doc.getElementById('tsic-icon-placeholder-styles');
        ctx.expect(ctx.assert.truthy(css, 'placeholder stylesheet is injected once'));
        ctx.expect(ctx.assert.truthy(css.textContent.indexOf('/tex/fallback-icon') !== -1,
            'the placeholder is the C++-served fallback, not a second copy of the art'));

        img.remove();
    },
});

TSICTestHarness.register({
    name: 'Unit/Icons: sizing via style.cssText cannot wipe the placeholder',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        // shared/inventory.js sizes its grid icons exactly this way. An inline
        // background would be destroyed by it; a class is not.
        const img = ctx.win.TSIC.iconImg(ctx.win.TSIC.itemIconUrl('ID_AlsoNotReal'));
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;';
        ctx.doc.body.appendChild(img);

        await ctx.waitFor(() => img.src.indexOf('data:image/gif') === 0, { timeout: 4000 });
        ctx.expect(ctx.assert.truthy(img.classList.contains('tsic-icon-loading'),
            'cssText assignment leaves the placeholder class intact'));

        img.remove();
    },
});

TSICTestHarness.register({
    name: 'Unit/Icons: a non-/tex/ src still hides on failure',
    file: '/screens/test-fixtures.html',
    async run(ctx) {
        // Static svgs and data: URLs never warm, so the placeholder does not apply
        // to them and the old hide-on-failure behaviour must be unchanged.
        const img = ctx.win.TSIC.iconImg('/icons/keyboard/definitely-missing.svg');
        ctx.doc.body.appendChild(img);

        await ctx.waitFor(() => img.style.display === 'none', { timeout: 2000 });
        ctx.expect(ctx.assert.eq(img.style.display, 'none', 'unretriable icons still hide'));
        ctx.expect(ctx.assert.falsy(img.classList.contains('tsic-icon-loading'),
            'no cardboard box for something that was never an item icon'));

        img.remove();
    },
});
