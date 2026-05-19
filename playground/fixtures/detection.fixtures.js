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
        { label: 'Calm',       apply(s) { s.Enemies = []; s.ScreenMist = 0; } },
        { label: 'One enemy',  apply(s) { s.Enemies = [{ BearingDeg: 0, DetectionScore: 0.5 }]; s.ScreenMist = 0.1; } },
        { label: 'Surrounded', apply(s) {
            s.Enemies = Array.from({length: 6}, (_, i) => ({
                BearingDeg: i * 60, DetectionScore: 0.5 + 0.5 * Math.random(),
            }));
            s.ScreenMist = 0.4;
        } },
        { label: 'Spotted',    apply(s) { s.ScreenMist = 1; s.Enemies = [{ BearingDeg: 0, DetectionScore: 1 }]; } },
    ],
});
