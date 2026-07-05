// /screens/detection.html subscribes to:
//   tsic.msg.UI.Detection.State  { Enemies:[{BearingDeg, DetectionScore}], ScreenMist }
//
// `Level` and `Direction` are playground-only master knobs (not part of the
// C++ payload). Applied in project() before broadcast:
//   Level     — scales every enemy's score + the edge vignette, sweeping the
//               whole HUD calm → spotted on top of whatever layout a scenario
//               set up.
//   Direction — a bearing offset added to every enemy, so dragging it spins the
//               whole threat picture around the full 360°. With a single-enemy
//               scenario this sweeps one wedge around the screen so you can see
//               how it reads moving; with a multi-threat scenario it rotates the
//               ring. Both compose with the scenario buttons and the input pane.
const clamp01 = (v) => Math.max(0, Math.min(1, v));

TSICPlayground.register({
    id: 'detection',
    label: 'Detection',
    screen: '/screens/detection.html',
    initialState() { return {
        Level: 1,
        Direction: 0,
        Enemies: [
            { BearingDeg: 30,  DetectionScore: 0.6 },
            { BearingDeg: 270, DetectionScore: 0.3 },
        ],
        ScreenMist: 0.2,
    }; },
    project(s) {
        const lvl = s.Level == null ? 1 : s.Level;
        const dir = s.Direction == null ? 0 : s.Direction;
        const enemies = (s.Enemies || []).map((e) => ({
            BearingDeg: (e.BearingDeg || 0) + dir,
            DetectionScore: clamp01((e.DetectionScore || 0) * lvl),
        }));
        // Edge vignette tracks the strongest live threat, but never drops below
        // the scenario's own mist (scaled by Level) so it still previews when
        // there are no directional threats on screen.
        const maxScore = enemies.reduce((m, e) => Math.max(m, e.DetectionScore), 0);
        const mist = Math.max(maxScore, clamp01((s.ScreenMist || 0) * lvl));
        return [['tsic.msg.UI.Detection.State', { Enemies: enemies, ScreenMist: mist }]];
    },
    controls: [
        {
            // The headline knob: master detection level. Scales every threat.
            label: 'Detection level',
            min: 0, max: 1, step: 0.01,
            read(s) { return s.Level == null ? 1 : s.Level; },
            apply(s, v) { s.Level = v; },
            format(v) { return Math.round(v * 100) + '%'; },
        },
        {
            // Rotate every threat's bearing — drag to watch the wedge travel
            // around the screen edge through the full 360°.
            label: 'Direction',
            min: 0, max: 360, step: 1,
            read(s) { return s.Direction == null ? 0 : s.Direction; },
            apply(s, v) { s.Direction = v; },
            format(v) { return Math.round(v) + '°'; },
        },
    ],
    scenarios: [
        { label: 'Calm',         apply(s) { s.Enemies = []; s.ScreenMist = 0; } },
        { label: 'Mild fog',     apply(s) { s.Enemies = []; s.ScreenMist = 0.25; } },
        { label: 'One enemy',    apply(s) { s.Enemies = [{ BearingDeg: 0, DetectionScore: 0.5 }]; s.ScreenMist = 0.1; } },
        { label: 'Two flanks',   apply(s) { s.Enemies = [
            { BearingDeg: 90,  DetectionScore: 0.7 },
            { BearingDeg: 270, DetectionScore: 0.4 },
        ]; s.ScreenMist = 0.2; } },
        { label: 'From behind',  apply(s) { s.Enemies = [{ BearingDeg: 180, DetectionScore: 0.9 }]; s.ScreenMist = 0.3; } },
        { label: 'Surrounded',   apply(s) {
            s.Enemies = Array.from({length: 6}, (_, i) => ({
                BearingDeg: i * 60, DetectionScore: 0.5 + 0.05 * i,
            }));
            s.ScreenMist = 0.4;
        } },
        { label: 'Heavy mist',   apply(s) { s.Enemies = [{ BearingDeg: 45, DetectionScore: 0.3 }]; s.ScreenMist = 0.8; } },
        { label: 'Spotted',      apply(s) { s.ScreenMist = 1; s.Enemies = [{ BearingDeg: 0, DetectionScore: 1 }]; } },
        { label: 'Faint distant',apply(s) { s.Enemies = [
            { BearingDeg: 10,  DetectionScore: 0.1 },
            { BearingDeg: 200, DetectionScore: 0.15 },
        ]; s.ScreenMist = 0.05; } },
    ],
});
