TSICTestHarness.register({
    name: 'Notifications: shows a toast on push',
    file: '/screens/notifications.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Notification.Show', {
            Title: 'Item Picked Up', Text: 'Bread x 1', Type: 'Inventory', IconUrl: '',
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#notif-list .notif').length >= 1, { timeout: 2000 }).catch(() => {});
        // Some implementations render to a different container; tolerate either id.
        const anyToast = ctx.doc.querySelector('.notif, .toast, [data-notif]');
        ctx.expect(ctx.assert.truthy(anyToast, 'expected at least one rendered notification'));
    },
});

TSICTestHarness.register({
    name: 'Notifications: error severity yields error class',
    file: '/screens/notifications.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Notification.Show', { Title: 'Boom', Text: 'Server died', Type: 'Error' });
        await new Promise(r => setTimeout(r, 80));
        const err = ctx.doc.querySelector('[data-type="Error"], .notif-Error, .toast-error, .error');
        ctx.expect(ctx.assert.truthy(err, 'expected an error-marked element somewhere'));
    },
});
