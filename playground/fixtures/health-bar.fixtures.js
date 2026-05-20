// /screens/health-bar.html subscribes to:
//   tsic.attr.player.health  { current, max }
//   tsic.msg.Message.DamageEvent  { ... }
TSICPlayground.register({
    id: 'health-bar',
    label: 'Health Bar',
    screen: '/screens/health-bar.html',
    initialState() { return { current: 65, max: 100, dmgNonce: 0 }; },
    project(s) {
        const out = [['tsic.attr.player.health', { current: s.current, max: s.max }]];
        if (s.dmgNonce > 0) out.push(['tsic.msg.Message.DamageEvent', { Damage: 10, _nonce: s.dmgNonce }]);
        return out;
    },
    scenarios: [
        { label: 'Full',           apply(s) { s.current = s.max; } },
        { label: '75%',            apply(s) { s.current = 75; } },
        { label: '50%',            apply(s) { s.current = 50; } },
        { label: '25%',            apply(s) { s.current = 25; } },
        { label: 'Critical (5%)',  apply(s) { s.current = 5; } },
        { label: 'One HP',         apply(s) { s.current = 1; } },
        { label: 'Empty',          apply(s) { s.current = 0; } },
        { label: 'Take dmg',       apply(s) { s.current = Math.max(0, s.current - 12); s.dmgNonce++; } },
        { label: 'Big dmg burst',  apply(s) { s.current = Math.max(0, s.current - 40); s.dmgNonce++; } },
        { label: 'Heal +20',       apply(s) { s.current = Math.min(s.max, s.current + 20); } },
        { label: 'Buffed max 150', apply(s) { s.max = 150; s.current = 130; } },
        { label: 'Debuffed max 60',apply(s) { s.max = 60;  s.current = 60; } },
    ],
});
