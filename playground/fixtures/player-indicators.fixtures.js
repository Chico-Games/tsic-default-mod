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
        { label: 'Two players',   apply() {}, expect: { visualChange: false } },
        { label: 'One player',    apply(s) { s.indicators = [s.indicators[0]]; } },
        { label: 'Many players',  apply(s) { s.indicators = Array.from({length: 6}, (_, i) => ({
            PlayerId: 'p_' + i,
            Name: ['Friend','Stranger','Newbie','Vet','Lurker','Ghost'][i],
            Color: ['#7fffae','#ffcc00','#7ec8ff','#ff7e7e','#bb8aff','#9aff8a'][i],
            ScreenPos01: { X: 0.1 + (i % 3) * 0.4, Y: 0.2 + Math.floor(i / 3) * 0.4 },
            bOffScreen: false, Distance: 500 + i * 300,
        })); } },
        { label: 'All off-screen',apply(s) { s.indicators = s.indicators.map(i => ({ ...i, bOffScreen: true })); } },
        { label: 'Mixed on/off',  apply(s) { s.indicators = [
            { ...s.indicators[0], bOffScreen: false },
            { ...s.indicators[1], bOffScreen: true  },
        ]; } },
        { label: 'Looked at',     apply(s) { s.indicators = [{ ...s.indicators[0], bLookedAt: true }]; } },
        { label: 'Close range',   apply(s) { s.indicators = [
            { ...s.indicators[0], Distance: 80 },
            { ...s.indicators[1], Distance: 120 },
        ]; } },
        { label: 'Far away',      apply(s) { s.indicators = s.indicators.map(i => ({ ...i, Distance: 8000 })); } },
        { label: 'None',          apply(s) { s.indicators = []; } },
    ],
});
