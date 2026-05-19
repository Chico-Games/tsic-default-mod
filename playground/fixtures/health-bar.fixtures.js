// /screens/health-bar.html subscribes to:
//   tsic.attr.player.health  { current, max }
//   tsic.msg.Message.DamageEvent  { ... }
TSICPlayground.register({
    id: 'health-bar',
    label: 'Health Bar',
    screen: '/screens/health-bar.html',
    initialState() { return { current: 100, max: 100, dmgNonce: 0 }; },
    project(s) {
        const out = [['tsic.attr.player.health', { current: s.current, max: s.max }]];
        if (s.dmgNonce > 0) out.push(['tsic.msg.Message.DamageEvent', { Damage: 10, _nonce: s.dmgNonce }]);
        return out;
    },
    scenarios: [
        { label: 'Full',    apply(s) { s.current = s.max; } },
        { label: '50%',     apply(s) { s.current = 50; } },
        { label: 'Critical',apply(s) { s.current = 5; } },
        { label: 'Take dmg',apply(s) { s.current = Math.max(0, s.current - 12); s.dmgNonce++; } },
        { label: 'Empty',   apply(s) { s.current = 0; } },
    ],
});
