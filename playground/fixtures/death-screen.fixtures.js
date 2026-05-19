// /screens/death-screen.html — no incoming subscriptions; just two buttons.
TSICPlayground.register({
    id: 'death-screen',
    label: 'Death Screen',
    screen: '/screens/death-screen.html',
    initialState() { return {}; },
    project() { return []; },
    scenarios: [{ label: 'Open', apply() {} }],
});
