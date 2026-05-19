// /screens/main-menu.html — no incoming subscriptions; pure buttons that
// publish UI.Cmd.Menu.Navigate / UI.Cmd.Menu.Exit. The fixture exists mainly
// to give the playground entry + scenarios that highlight log output.
TSICPlayground.register({
    id: 'main-menu',
    label: 'Main Menu',
    screen: '/screens/main-menu.html',
    initialState() { return {}; },
    project() { return []; },
    scenarios: [
        { label: 'Open',  apply() {} },
    ],
});
