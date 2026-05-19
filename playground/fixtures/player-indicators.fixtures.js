// /screens/player-indicators.html subscribes to:
//   tsic.msg.UI.PlayerIndicators  { Indicators:[{PlayerId, Name, Color, ScreenPos01:{X,Y}, bOffScreen, bLookedAt, Distance}] }
TSICPlayground.register({
    id: 'player-indicators',
    label: 'Player Indicators',
    screen: '/screens/player-indicators.html',
    initialState() { return { indicators: [
        { PlayerId: 'p_1', Name: 'Friend',  Color: '#7fffae', ScreenPos01: { X: 0.3, Y: 0.4 }, bOffScreen: false, Distance: 800 },
        { PlayerId: 'p_2', Name: 'Stranger',Color: '#ffcc00', ScreenPos01: { X: 0.8, Y: 0.6 }, bOffScreen: false, Distance: 2200 },
    ] }; },
    project(s) { return [['tsic.msg.UI.PlayerIndicators', { Indicators: s.indicators }]]; },
    scenarios: [
        { label: 'Two players',  apply() {} },
        { label: 'Off-screen',   apply(s) { s.indicators = s.indicators.map(i => ({ ...i, bOffScreen: true })); } },
        { label: 'Looked at',    apply(s) { s.indicators = [{ ...s.indicators[0], bLookedAt: true }]; } },
        { label: 'None',         apply(s) { s.indicators = []; } },
    ],
});
