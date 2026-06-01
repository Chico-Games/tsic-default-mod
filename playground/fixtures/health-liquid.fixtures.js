// /screens/health-liquid.html subscribes to:
//   tsic.msg.UI.Player.Attribute  { Channel:'Health', Current, Max }
// (same contract as the production health bar — this is a stylised liquid/ink
// fill prototype). Drag Health to watch the surface slosh; the "Take hit"
// scenarios drop the level so the splash + droplets fire.
TSICPlayground.register({
    id: 'health-liquid',
    label: 'Health — Liquid (proto)',
    screen: '/screens/health-liquid.html',
    initialState() { return { health: 72, max: 100 }; },
    project(s) {
        return [['tsic.msg.UI.Player.Attribute', { Channel: 'Health', Current: s.health, Max: s.max }]];
    },
    controls: [
        {
            label: 'Health',
            min: 0, max: 100, step: 1,
            read(s) { return s.health; },
            apply(s, v) { s.health = v; },
            format(v) { return Math.round(v) + ' / 100'; },
        },
    ],
    scenarios: [
        { label: 'Full',       apply(s) { s.health = 100; } },
        { label: 'Hurt',       apply(s) { s.health = 55; } },
        { label: 'Critical',   apply(s) { s.health = 14; } },
        { label: 'Dregs',      apply(s) { s.health = 3; } },
        { label: 'Take hit -18', apply(s) { s.health = Math.max(0, s.health - 18); } },
        { label: 'Take hit -7',  apply(s) { s.health = Math.max(0, s.health - 7); } },
        { label: 'Heal +25',     apply(s) { s.health = Math.min(s.max, s.health + 25); } },
    ],
});
