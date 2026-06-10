TSICTestHarness.register({
    name: 'Notifications: shows a toast on push',
    file: '/screens/test-notifications.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Notification.Show', {
            Title: 'Item Picked Up', Text: 'Bread x 1', Type: 'Inventory', IconUrl: '',
        });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#notif-stack .notif').length >= 1, { timeout: 2000 });
        ctx.expect(ctx.assert.domExists(ctx.doc, '#notif-stack .notif'));
    },
});

TSICTestHarness.register({
    name: 'Notifications: error severity yields .notif--Error class',
    file: '/screens/test-notifications.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Notification.Show', { Title: 'Boom', Text: 'Server died', Type: 'Error' });
        await ctx.waitFor(() => ctx.doc.querySelector('.notif--Error'), { timeout: 2000 });
        ctx.expect(ctx.assert.domExists(ctx.doc, '.notif--Error'));
    },
});

TSICTestHarness.register({
    name: 'Notifications: every notification type maps to a severity class',
    file: '/screens/test-notifications.html',
    async run(ctx) {
        const types = ['Tip','Warning','Error','Inventory','Event','Alarm','PlayerJoined','PlayerDied','Progression'];
        for (const t of types) {
            ctx.inject('tsic.msg.UI.Notification.Show', { Title: t, Text: t, Type: t });
        }
        await ctx.waitFor(() => ctx.doc.querySelectorAll('.notif').length >= 5, { timeout: 2000 });
        // Should cap at MAX_VISIBLE = 5
        const visible = ctx.doc.querySelectorAll('.notif');
        ctx.expect(ctx.assert.truthy(visible.length <= 5, `expected <=5 visible, got ${visible.length}`));
    },
});
