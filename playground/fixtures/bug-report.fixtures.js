// /screens/bug-report.html — no subscriptions; publishes UI.Cmd.BugReport.Submit.
TSICPlayground.register({
    id: 'bug-report',
    label: 'Bug Report',
    screen: '/screens/bug-report.html',
    initialState() { return {}; },
    project() { return []; },
    scenarios: [
        { label: 'Open',          apply() {}, expect: { visualChange: false, injects: 0 } },
        { label: 'Replay open',   apply() {}, expect: { visualChange: false, injects: 0 } },
        { label: 'Open #3',       apply() {}, expect: { visualChange: false, injects: 0 } },
    ],
});
