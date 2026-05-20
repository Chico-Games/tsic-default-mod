// /screens/credits.html — static page, no subscriptions. Scenarios are no-op
// since the page is purely static; expect.visualChange:false makes that
// explicit to the sweep runner.
TSICPlayground.register({
    id: 'credits',
    label: 'Credits',
    screen: '/screens/credits.html',
    initialState() { return {}; },
    project() { return []; },
    scenarios: [
        { label: 'Open',          apply() {}, expect: { visualChange: false, injects: 0 } },
        { label: 'Replay open',   apply() {}, expect: { visualChange: false, injects: 0 } },
        { label: 'Open #3',       apply() {}, expect: { visualChange: false, injects: 0 } },
    ],
});
