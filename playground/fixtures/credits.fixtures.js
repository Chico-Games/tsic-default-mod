// /screens/credits.html — static page, no subscriptions.
TSICPlayground.register({
    id: 'credits',
    label: 'Credits',
    screen: '/screens/credits.html',
    initialState() { return {}; },
    project() { return []; },
    scenarios: [{ label: 'Open', apply() {} }],
});
