// /screens/main-menu.html — no incoming subscriptions; pure buttons that
// publish UI.Cmd.Menu.Navigate / UI.Cmd.Menu.Exit. The fixture exists mainly
// to give the playground entry + scenarios that highlight log output.
// Scenarios that don't change the UI declare expect.visualChange:false to
// make that contract explicit to the sweep runner.
TSICPlayground.register({
    id: 'main-menu',
    label: 'Main Menu',
    screen: '/screens/main-menu.html',
    initialState() { return {}; },
    project() { return []; },
    scenarios: [
        { label: 'Open',           apply() {}, expect: { visualChange: false, injects: 0 } },
        { label: 'Replay open',    apply() {}, expect: { visualChange: false, injects: 0 } },
        { label: 'Open #2',        apply() {}, expect: { visualChange: false, injects: 0 } },
    ],
});
