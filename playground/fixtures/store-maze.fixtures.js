// /screens/store-maze.html hosts the shifting furniture-store maze motif
// (shared/store-maze.js) — an ambient procedural floor-plan backdrop meant
// for menu backgrounds once polished. Pure canvas: it listens to no message
// channels, so the fixture only exists to make the motif browsable here.
TSICPlayground.register({
    id: 'store-maze',
    label: 'Store Maze Background',
    screen: '/screens/store-maze.html',
    initialState() { return {}; },
    project() { return []; },
});
