// /screens/pause-menu.html subscribes to:
//   tsic.msg.UI.Players.List  { Players:[{Name, bIsHost}] }
TSICPlayground.register({
    id: 'pause-menu',
    label: 'Pause Menu',
    screen: '/screens/pause-menu.html',
    initialState() { return { players: [
        { Name: 'Ziggy',  bIsHost: true },
        { Name: 'Friend', bIsHost: false },
    ] }; },
    project(state) { return [['tsic.msg.UI.Players.List', { Players: state.players }]]; },
    scenarios: [
        { label: 'Two players',   apply() {}, expect: { visualChange: false } },
        { label: 'Solo (host)',   apply(s) { s.players = [{ Name: 'Ziggy', bIsHost: true }]; } },
        { label: 'Solo (guest)',  apply(s) { s.players = [{ Name: 'Stranger', bIsHost: false }]; } },
        { label: 'Three players', apply(s) { s.players = [
            { Name: 'Ziggy',   bIsHost: true },
            { Name: 'Friend',  bIsHost: false },
            { Name: 'Stranger',bIsHost: false },
        ]; } },
        { label: 'Four players',  apply(s) { s.players = [
            { Name: 'Ziggy',   bIsHost: true },
            { Name: 'Friend',  bIsHost: false },
            { Name: 'Stranger',bIsHost: false },
            { Name: 'Newbie',  bIsHost: false },
        ]; } },
        { label: 'Eight players', apply(s) { s.players = [
            { Name: 'Ziggy',    bIsHost: true },
            { Name: 'Friend',   bIsHost: false },
            { Name: 'Stranger', bIsHost: false },
            { Name: 'Newbie',   bIsHost: false },
            { Name: 'Vet',      bIsHost: false },
            { Name: 'Ghost',    bIsHost: false },
            { Name: 'Lurker',   bIsHost: false },
            { Name: 'Newcomer', bIsHost: false },
        ]; } },
        { label: 'Long names',    apply(s) { s.players = [
            { Name: 'PlayerWithAVeryLongUsername', bIsHost: true },
            { Name: 'AnotherLongName',             bIsHost: false },
        ]; } },
        { label: 'Empty',         apply(s) { s.players = []; } },
    ],
});
