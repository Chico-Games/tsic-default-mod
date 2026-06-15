// /screens/test-stamina-bar.html subscribes to:
//   tsic.msg.UI.Player.Attribute  { Channel, Current, Max }
TSICPlayground.register({
    id: 'stamina-bar',
    label: 'Stamina Bar',
    screen: '/screens/test-stamina-bar.html',
    initialState() { return { current: 80, max: 100 }; },
    project(s) { return [['tsic.msg.UI.Player.Attribute', { Channel: 'Stamina', Current: s.current, Max: s.max }]]; },
    controls: [
        {
            label: 'Stamina',
            min: 0, max: 150, step: 1,
            read(s) { return s.current; },
            apply(s, v) { s.current = v; },
            format(v) { return Math.round(v); },
        },
    ],
    scenarios: [
        { label: 'Full',          apply(s) { s.current = s.max; } },
        { label: '90%',           apply(s) { s.current = 90; } },
        { label: '75%',           apply(s) { s.current = 75; } },
        { label: '50%',           apply(s) { s.current = 50; } },
        { label: '25%',           apply(s) { s.current = 25; } },
        { label: '10%',           apply(s) { s.current = 10; } },
        { label: 'Empty',         apply(s) { s.current = 0; } },
        { label: 'Drain -10',     apply(s) { s.current = Math.max(0, s.current - 10); } },
        { label: 'Regen +20',     apply(s) { s.current = Math.min(s.max, s.current + 20); } },
        { label: 'Buffed max 150',apply(s) { s.max = 150; s.current = 130; } },
        { label: 'Tiny pool',     apply(s) { s.max = 30;  s.current = 12; } },
    ],
});
