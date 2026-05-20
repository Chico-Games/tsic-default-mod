// /screens/detection.html subscribes to:
//   tsic.msg.UI.Detection.State  { Enemies:[{BearingDeg, DetectionScore}], ScreenMist }
TSICPlayground.register({
    id: 'detection',
    label: 'Detection',
    screen: '/screens/detection.html',
    initialState() { return {
        Enemies: [
            { BearingDeg: 30,  DetectionScore: 0.6 },
            { BearingDeg: 270, DetectionScore: 0.3 },
        ],
        ScreenMist: 0.2,
    }; },
    project(s) { return [['tsic.msg.UI.Detection.State', s]]; },
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
