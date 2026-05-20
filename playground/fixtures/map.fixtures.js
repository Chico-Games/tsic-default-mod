// /screens/map.html subscribes to:
//   tsic.msg.UI.Map.Snapshot  { MinBounds:{X,Y}, MaxBounds:{X,Y}, Icons:[{X,Y,IconUrl}], Players:[{Id,Name,X,Y,bSelf}] }
//   tsic.msg.UI.Ping.Set      { Pings:[{X,Y,Z,PingType,OwnerId}] }
//   + input channels handled by the input emulator
TSICPlayground.register({
    id: 'map',
    label: 'Map',
    screen: '/screens/map.html',
    initialState() {
        return {
            snapshot: {
                MinBounds: { X: -2000, Y: -2000 },
                MaxBounds: { X:  2000, Y:  2000 },
                Icons: [
                    { X:  400, Y:  300, IconUrl: '' },
                    { X: -800, Y:  600, IconUrl: '' },
                ],
                Players: [
                    { Id: 'p_1', Name: 'Ziggy',  X: 0,    Y: 0,   bSelf: true },
                    { Id: 'p_2', Name: 'Friend', X: 200,  Y: 100, bSelf: false },
                ],
            },
            pings: [
                { X: 600,   Y: -400,  Z: 0, PingType: 'Loot',    OwnerId: 'Ziggy' },
                { X: -1200, Y: -1200, Z: 0, PingType: 'Hostile', OwnerId: 'Friend' },
            ],
        };
    },
    project(state) {
        return [
            ['tsic.msg.UI.Map.Snapshot', state.snapshot],
            ['tsic.msg.UI.Ping.Set', { Pings: state.pings }],
            ['tsic.msg.UI.Input.Mode.Changed', { Mode: 'MouseAndKeyboard', Device: 'kbm' }],
        ];
    },
    scenarios: [
        { label: 'Default',         apply() {} },
        { label: 'No pings',        apply(s) { s.pings = []; } },
        { label: 'One ping',        apply(s) { s.pings = [{ X: 0, Y: 0, Z: 0, PingType: 'Loot', OwnerId: 'Ziggy' }]; } },
        { label: 'Many pings (12)', apply(s) { s.pings = Array.from({length: 12}, (_, i) => ({
            X: -2000 + i * 320, Y: -1500 + (i * 197) % 3000, Z: 0,
            PingType: ['Loot','Hostile','Generic','Food'][i % 4],
            OwnerId: 'P' + i,
        })); } },
        { label: 'Dense pings (32)',apply(s) { s.pings = Array.from({length: 32}, (_, i) => ({
            X: -2000 + (i % 8) * 500, Y: -1500 + Math.floor(i / 8) * 800, Z: 0,
            PingType: ['Loot','Hostile','Generic','Food'][i % 4],
            OwnerId: 'P' + i,
        })); } },
        { label: 'Solo player',     apply(s) { s.snapshot.Players = [{ Id: 'p_1', Name: 'Ziggy', X: 0, Y: 0, bSelf: true }]; } },
        { label: 'Many players (6)',apply(s) { s.snapshot.Players = Array.from({length: 6}, (_, i) => ({
            Id: 'p_' + i, Name: ['Ziggy','Friend','Stranger','Newbie','Vet','Ghost'][i],
            X: ((i % 3) - 1) * 800, Y: (Math.floor(i / 3) - 0.5) * 1200, bSelf: i === 0,
        })); } },
        { label: 'Cornered player', apply(s) { s.snapshot.Players = [
            { Id: 'p_1', Name: 'Ziggy', X: -1900, Y: -1900, bSelf: true },
            { Id: 'p_2', Name: 'Friend', X: 1900, Y: 1900, bSelf: false },
        ]; } },
        { label: 'Lots of icons',   apply(s) { s.snapshot.Icons = Array.from({length: 18}, (_, i) => ({
            X: -1800 + (i % 6) * 600, Y: -1500 + Math.floor(i / 6) * 900, IconUrl: '',
        })); } },
        { label: 'Tiny world',      apply(s) {
            s.snapshot = { MinBounds: {X:-200,Y:-200}, MaxBounds: {X:200,Y:200}, Icons: [], Players: [
                { Id: 'p_1', Name: 'Ziggy', X: 0, Y: 0, bSelf: true },
            ] };
            s.pings = [{ X: 50, Y: 50, Z: 0, PingType: 'Loot', OwnerId: 'Ziggy' }];
        } },
        { label: 'No snapshot',     apply(s) {
            s.snapshot = { MinBounds: {X:0,Y:0}, MaxBounds: {X:0,Y:0}, Icons: [], Players: [] };
            s.pings = [];
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Ping.Request') {
            state.pings.push({
                X: (payload.Location && payload.Location.X) || 0,
                Y: (payload.Location && payload.Location.Y) || 0,
                Z: 0, PingType: payload.PingType || 'Map', OwnerId: 'Ziggy',
            });
        }
    },
});
