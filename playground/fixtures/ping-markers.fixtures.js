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
        { label: 'Two pings',    apply() {}, expect: { visualChange: false } },
        { label: 'One ping',     apply(s) { s.pings = [
            { PingId: 1, PingType: 'Loot', OwnerId: 'Ziggy', X: 100, Y: 200, Z: 0 },
        ]; } },
        { label: 'All types',    apply(s) { s.pings = [
            { PingId: 1, PingType: 'Loot',     OwnerId: 'Ziggy', X: 0,   Y: 0,   Z: 0 },
            { PingId: 2, PingType: 'Hostile',  OwnerId: 'Ziggy', X: 100, Y: 50,  Z: 0 },
            { PingId: 3, PingType: 'Food',     OwnerId: 'Ziggy', X: 200, Y: 100, Z: 0 },
            { PingId: 4, PingType: 'Water',    OwnerId: 'Ziggy', X: 300, Y: 150, Z: 0 },
            { PingId: 5, PingType: 'Friendly', OwnerId: 'Ziggy', X: 400, Y: 200, Z: 0 },
            { PingId: 6, PingType: 'Defend',   OwnerId: 'Ziggy', X: 500, Y: 250, Z: 0 },
        ]; } },
        { label: 'Many pings',   apply(s) { s.pings = Array.from({length: 12}, (_, i) => ({
            PingId: 100 + i,
            PingType: ['Loot','Hostile','Food','Water','Friendly','Defend'][i % 6],
            OwnerId: i % 2 === 0 ? 'Ziggy' : 'Friend',
            X: (i % 4) * 200, Y: Math.floor(i / 4) * 200, Z: 0,
        })); } },
        { label: 'Multiple owners', apply(s) { s.pings = [
            { PingId: 1, PingType: 'Loot',     OwnerId: 'Ziggy',    X: 0,   Y: 0,   Z: 0 },
            { PingId: 2, PingType: 'Hostile',  OwnerId: 'Friend',   X: 100, Y: 100, Z: 0 },
            { PingId: 3, PingType: 'Friendly', OwnerId: 'Stranger', X: 200, Y: 200, Z: 0 },
        ]; } },
        { label: 'Add ping',     apply(s) {
            s.pings = [...s.pings, { PingId: s.nextId++, PingType: 'Food', OwnerId: 'Ziggy', X: 0, Y: 0, Z: 0 }];
        } },
        { label: 'Clear',        apply(s) { s.pings = []; } },
    ],
});
