TSICTestHarness.register({
    name: 'QuantityPicker: confirm publishes Inventory.Transfer',
    file: '/screens/quantity-picker.html?fromOwnerId=Player&toOwnerId=Storage:1&fromSlot=2&toSlot=-1&maxCount=5',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('input[type="range"], input[type="number"]'));
        const slider = ctx.doc.querySelector('input[type="range"]');
        if (slider) { slider.value = '3'; slider.dispatchEvent(new ctx.win.Event('input', { bubbles: true })); }
        ctx.clearPublishes();
        const confirm = Array.from(ctx.doc.querySelectorAll('button')).find(b => /confirm|ok|drop|transfer/i.test(b.textContent || ''));
        ctx.expect(ctx.assert.truthy(confirm, 'expected a confirm button'));
        confirm && confirm.click();
        ctx.expect(ctx.assert.published(ctx.handle, 'UI.Cmd.Inventory.Transfer', { where: p => p.FromSlot === 2 && p.Count >= 1 }));
    },
});
