// /screens/map.html subscribes to:
//   tsic.msg.UI.Map.Snapshot  { MinBounds:{X,Y}, MaxBounds:{X,Y},
//                               Icons:[{IconId,Category,Position:{X,Y},IconUrl,Label,EntityId}],
//                               Players:[{PlayerId,Name,Position:{X,Y},YawDeg}] }
//   tsic.msg.UI.Ping.Set      { Pings:[{PingId,PingType,Location:{X,Y,Z},OwnerId}] }
//   + input channels handled by the input emulator
// Shapes match Source/TSIC/Public/Subsystems/UI/ScpUIWorldIndicatorMessages.h.
// Player[0] is treated as "self" by convention (matches screen rendering and
// centerOnLocalPlayer); no self flag exists on the C++ struct yet.
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
                    { IconId: 'spawn_1', Category: 'SpawnPoint', Position: { X: -1600, Y:  1400 }, IconUrl: '', Label: 'Spawn',         EntityId: 0 },
                    { IconId: 'tele_1',  Category: 'Teleporter', Position: { X:   400, Y:   300 }, IconUrl: '', Label: 'East Portal',   EntityId: 101 },
                    { IconId: 'tele_2',  Category: 'Teleporter', Position: { X:  -800, Y:   600 }, IconUrl: '', Label: 'West Portal',   EntityId: 102 },
                    { IconId: 'land_1',  Category: 'Landmark',   Position: { X:  1200, Y: -1000 }, IconUrl: '', Label: 'Old Tower',     EntityId: 0 },
                    { IconId: 'death_1', Category: 'DeathBox',   Position: { X:  -200, Y:  -900 }, IconUrl: '', Label: 'Last Death',    EntityId: 0 },
                ],
                Players: [
                    { PlayerId: 'p_1', Name: 'Ziggy',  Position: { X:    0, Y:    0 }, YawDeg:   0 },
                    { PlayerId: 'p_2', Name: 'Friend', Position: { X:  200, Y:  100 }, YawDeg:  45 },
                ],
            },
            pings: [
                { PingId: 'pg_1', PingType: 'Loot',    Location: { X:   600, Y:  -400, Z: 0 }, OwnerId: 'Ziggy'  },
                { PingId: 'pg_2', PingType: 'Hostile', Location: { X: -1200, Y: -1200, Z: 0 }, OwnerId: 'Friend' },
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
        { label: 'One ping',        apply(s) {
            s.pings = [{ PingId: 'pg_1', PingType: 'Loot', Location: { X: 0, Y: 0, Z: 0 }, OwnerId: 'Ziggy' }];
        } },
        { label: 'Many pings (12)', apply(s) {
            const types = ['Loot', 'Hostile', 'Generic', 'Food'];
            s.pings = Array.from({ length: 12 }, (_, i) => ({
                PingId: 'pg_' + i,
                PingType: types[i % types.length],
                Location: { X: -2000 + i * 320, Y: -1500 + (i * 197) % 3000, Z: 0 },
                OwnerId: 'P' + i,
            }));
        } },
        { label: 'Dense pings (32)', apply(s) {
            const types = ['Loot', 'Hostile', 'Generic', 'Food'];
            s.pings = Array.from({ length: 32 }, (_, i) => ({
                PingId: 'pg_' + i,
                PingType: types[i % types.length],
                Location: { X: -2000 + (i % 8) * 500, Y: -1500 + Math.floor(i / 8) * 800, Z: 0 },
                OwnerId: 'P' + i,
            }));
        } },
        { label: 'Solo player',     apply(s) {
            s.snapshot.Players = [
                { PlayerId: 'p_1', Name: 'Ziggy', Position: { X: 0, Y: 0 }, YawDeg: 0 },
            ];
        } },
        { label: 'Many players (6)', apply(s) {
            const names = ['Ziggy', 'Friend', 'Stranger', 'Newbie', 'Vet', 'Ghost'];
            s.snapshot.Players = Array.from({ length: 6 }, (_, i) => ({
                PlayerId: 'p_' + i,
                Name: names[i],
                Position: { X: ((i % 3) - 1) * 800, Y: (Math.floor(i / 3) - 0.5) * 1200 },
                YawDeg: (i * 60) % 360,
            }));
        } },
        { label: 'Cornered player', apply(s) {
            s.snapshot.Players = [
                { PlayerId: 'p_1', Name: 'Ziggy',  Position: { X: -1900, Y: -1900 }, YawDeg: 135 },
                { PlayerId: 'p_2', Name: 'Friend', Position: { X:  1900, Y:  1900 }, YawDeg: -45 },
            ];
        } },
        { label: 'Lots of icons', apply(s) {
            const categories = ['SpawnPoint', 'Teleporter', 'DeathBox', 'Landmark'];
            s.snapshot.Icons = Array.from({ length: 18 }, (_, i) => {
                const cat = categories[i % categories.length];
                return {
                    IconId: 'ic_' + i,
                    Category: cat,
                    Position: { X: -1800 + (i % 6) * 600, Y: -1500 + Math.floor(i / 6) * 900 },
                    IconUrl: '',
                    Label: cat + ' ' + i,
                    EntityId: cat === 'Teleporter' ? (200 + i) : 0,
                };
            });
        } },
        { label: 'Clustered icons', apply(s) {
            // Place many icons very close together so the low-zoom cluster
            // path (state.scale < 0.5) collapses them into "N POIs" bubbles.
            s.snapshot.Icons = Array.from({ length: 14 }, (_, i) => ({
                IconId: 'cl_' + i,
                Category: 'Landmark',
                Position: { X: -100 + (i % 4) * 40, Y: -100 + Math.floor(i / 4) * 40 },
                IconUrl: '',
                Label: 'Landmark ' + i,
                EntityId: 0,
            }));
        } },
        { label: 'Tiny world', apply(s) {
            s.snapshot = {
                MinBounds: { X: -200, Y: -200 },
                MaxBounds: { X:  200, Y:  200 },
                Icons: [],
                Players: [
                    { PlayerId: 'p_1', Name: 'Ziggy', Position: { X: 0, Y: 0 }, YawDeg: 0 },
                ],
            };
            s.pings = [
                { PingId: 'pg_1', PingType: 'Loot', Location: { X: 50, Y: 50, Z: 0 }, OwnerId: 'Ziggy' },
            ];
        } },
        { label: 'No snapshot', apply(s) {
            s.snapshot = { MinBounds: { X: 0, Y: 0 }, MaxBounds: { X: 0, Y: 0 }, Icons: [], Players: [] };
            s.pings = [];
        } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Ping.Request') {
            const loc = payload && payload.Location;
            state.pings.push({
                PingId: 'pg_user_' + state.pings.length,
                PingType: (payload && payload.PingType) || 'Map',
                Location: {
                    X: (loc && typeof loc.X === 'number') ? loc.X : 0,
                    Y: (loc && typeof loc.Y === 'number') ? loc.Y : 0,
                    Z: (loc && typeof loc.Z === 'number') ? loc.Z : 0,
                },
                OwnerId: 'Ziggy',
            });
        }
    },
});
