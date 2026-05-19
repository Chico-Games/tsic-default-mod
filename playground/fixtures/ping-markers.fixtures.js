// /screens/ping-markers.html subscribes to:
//   tsic.msg.UI.Ping.Set  { Pings:[{PingId, PingType, OwnerId, X, Y, Z}] }
// Flashes a toast when a new PingId appears.
TSICPlayground.register({
    id: 'ping-markers',
    label: 'Ping Markers',
    screen: '/screens/ping-markers.html',
    initialState() { return { nextId: 100, pings: [
        { PingId: 1, PingType: 'Loot',    OwnerId: 'Ziggy',  X: 100, Y: 200, Z: 0 },
        { PingId: 2, PingType: 'Hostile', OwnerId: 'Friend', X: 300, Y: 100, Z: 0 },
    ] }; },
    project(s) { return [['tsic.msg.UI.Ping.Set', { Pings: s.pings }]]; },
    scenarios: [
        { label: 'Two pings',  apply() {} },
        { label: 'Add ping',   apply(s) {
            s.pings = [...s.pings, { PingId: s.nextId++, PingType: 'Food', OwnerId: 'Ziggy', X: 0, Y: 0, Z: 0 }];
        } },
        { label: 'Clear',      apply(s) { s.pings = []; } },
    ],
});
