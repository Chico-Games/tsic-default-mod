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
