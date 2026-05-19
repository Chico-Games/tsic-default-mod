// /screens/stamina-bar.html subscribes to:
//   tsic.attr.player.stamina  { current, max }
TSICPlayground.register({
    id: 'stamina-bar',
    label: 'Stamina Bar',
    screen: '/screens/stamina-bar.html',
    initialState() { return { current: 80, max: 100 }; },
    project(s) { return [['tsic.attr.player.stamina', { current: s.current, max: s.max }]]; },
    scenarios: [
        { label: 'Full',     apply(s) { s.current = s.max; } },
        { label: '75%',      apply(s) { s.current = 75; } },
        { label: '50%',      apply(s) { s.current = 50; } },
        { label: '25%',      apply(s) { s.current = 25; } },
        { label: 'Empty',    apply(s) { s.current = 0; } },
        { label: 'Drain -10',apply(s) { s.current = Math.max(0, s.current - 10); } },
    ],
});
