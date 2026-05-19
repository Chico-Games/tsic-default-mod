// /screens/circular-progress.html subscribes to:
//   tsic.msg.UI.CircularProgress.State  { bActive, Total, Elapsed, Color }
TSICPlayground.register({
    id: 'circular-progress',
    label: 'Circular Progress',
    screen: '/screens/circular-progress.html',
    initialState() { return { bActive: true, Total: 1, Elapsed: 0.5, Color: '#ffffff' }; },
    project(s) { return [['tsic.msg.UI.CircularProgress.State', s]]; },
    scenarios: [
        { label: '0%',         apply(s) { s.bActive = true;  s.Total = 1; s.Elapsed = 0;    s.Color = '#ffffff'; } },
        { label: '50%',        apply(s) { s.bActive = true;  s.Total = 1; s.Elapsed = 0.5;  s.Color = '#ffffff'; } },
        { label: '100%',       apply(s) { s.bActive = true;  s.Total = 1; s.Elapsed = 1.0;  s.Color = '#7fffae'; } },
        { label: 'Red ring',   apply(s) { s.bActive = true;  s.Total = 1; s.Elapsed = 0.5;  s.Color = '#ff7a7a'; } },
        { label: 'Inactive',   apply(s) { s.bActive = false; s.Total = 0; s.Elapsed = 0; } },
    ],
});
