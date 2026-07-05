// Tiny global registry that fixture files call into.
// playground-host.js reads TSICPlayground.fixtures after all script tags load.
(function (global) {
    const NS = global.TSICPlayground = global.TSICPlayground || {};
    NS.fixtures = NS.fixtures || [];
    NS.byId = NS.byId || new Map();
    NS.register = function (fixture) {
        if (!fixture || !fixture.id) throw new Error('TSICPlayground.register: fixture.id required');
        if (!fixture.screen) throw new Error(`TSICPlayground.register(${fixture.id}): screen required`);
        if (typeof fixture.initialState !== 'function') throw new Error(`TSICPlayground.register(${fixture.id}): initialState() required`);
        if (typeof fixture.project !== 'function') throw new Error(`TSICPlayground.register(${fixture.id}): project(state) required`);
        fixture.label = fixture.label || fixture.id;
        fixture.catalogs = fixture.catalogs || {};
        fixture.scenarios = fixture.scenarios || [];
        if (NS.byId.has(fixture.id)) throw new Error(`TSICPlayground.register: duplicate id "${fixture.id}"`);
        NS.fixtures.push(fixture);
        NS.byId.set(fixture.id, fixture);
    };
})(window);
