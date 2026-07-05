// /screens/ping.html — ping composer wheel. Subscribes to UI.Ping.Set just to
// keep sticky replay alive; the wheel is built from a hard-coded list inside
// the page, so scenarios mostly toggle the recent-pings payload visible
// elsewhere. The wheel itself doesn't change in response, so scenarios that
// only mutate Pings declare expect.visualChange: false.
TSICPlayground.register({
    id: 'ping',
    label: 'Ping Composer',
    screen: '/screens/ping.html',
    initialState() { return { pings: [] }; },
    project(s) { return [['tsic.msg.UI.Ping.Set', { Pings: s.pings }]]; },
    scenarios: [
        { label: 'Open wheel',  apply(s) { s.pings = []; }, expect: { visualChange: false } },
        { label: 'One recent',  apply(s) { s.pings = [
            { PingId: 1, PingType: 'Loot', OwnerId: 'Ziggy', X: 100, Y: 200, Z: 0 },
        ]; }, expect: { visualChange: false } },
        { label: 'Many recent', apply(s) { s.pings = Array.from({length: 6}, (_, i) => ({
            PingId: 10 + i,
            PingType: ['Loot','Hostile','Food','Water','Friendly','Defend'][i],
            OwnerId: 'Ziggy', X: i * 50, Y: 0, Z: 0,
        })); }, expect: { visualChange: false } },
        { label: 'Reset',       apply(s) { s.pings = []; }, expect: { visualChange: false } },
    ],
});
