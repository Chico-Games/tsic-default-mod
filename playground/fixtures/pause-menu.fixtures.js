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
        { label: 'Two players',  apply() {} },
        { label: 'Solo (host)',  apply(s) { s.players = [{ Name: 'Ziggy', bIsHost: true }]; } },
        { label: 'Four players', apply(s) { s.players = [
            { Name: 'Ziggy',   bIsHost: true },
            { Name: 'Friend',  bIsHost: false },
            { Name: 'Stranger',bIsHost: false },
            { Name: 'Newbie',  bIsHost: false },
        ]; } },
    ],
});
