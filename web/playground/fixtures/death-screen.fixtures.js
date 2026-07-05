// /screens/death-screen.html — no incoming subscriptions; just two buttons.
// Scenarios are no-op since there's no driveable state.
TSICPlayground.register({
    id: 'death-screen',
    label: 'Death Screen',
    screen: '/screens/death-screen.html',
    initialState() { return {}; },
    project() { return []; },
    scenarios: [
        { label: 'Open',         apply() {}, expect: { visualChange: false, injects: 0 } },
        { label: 'Replay open',  apply() {}, expect: { visualChange: false, injects: 0 } },
        { label: 'Open #3',      apply() {}, expect: { visualChange: false, injects: 0 } },
    ],
});
