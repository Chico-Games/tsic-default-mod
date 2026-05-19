// /screens/ping.html — ping composer wheel. Subscribes to UI.Ping.Set just to
// keep sticky replay alive; the wheel is built from a hard-coded list inside
// the page, so this fixture just opens it.
TSICPlayground.register({
    id: 'ping',
    label: 'Ping Composer',
    screen: '/screens/ping.html',
    initialState() { return {}; },
    project() { return [['tsic.msg.UI.Ping.Set', { Pings: [] }]]; },
    scenarios: [{ label: 'Open wheel', apply() {} }],
});
