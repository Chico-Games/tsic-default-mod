// Component-gallery entries. Each loads /screens/elements.html?el=<id>, which
// renders one design-system component family in isolation. They are plain
// fixtures (no mock-tsic state) so they reuse the playground's iframe,
// live-reload, and reload-button machinery. Grouped under "Elements" via
// the explicit `category` field (see playground-host.js renderScreenList).
const EG_NOOP = { initialState() { return {}; }, project() { return []; } };

[
    ['el-all',         'All Elements', 'all'],
    ['el-buttons',     'Buttons',      'buttons'],
    ['el-inputs',      'Text Inputs',  'inputs'],
    ['el-dropdown',    'Dropdown',     'dropdown'],
    ['el-sliders',     'Sliders',      'sliders'],
    ['el-row-buttons', 'Row Buttons',  'row-buttons'],
    ['el-slots',       'Item Slots',   'slots'],
    ['el-bars',        'Progress Bars','bars'],
    ['el-panels',      'Panels',       'panels'],
    ['el-masthead',    'Masthead',     'masthead'],
    ['el-decorations', 'Decorations',  'decorations'],
].forEach(([id, label, el]) => {
    TSICPlayground.register({
        id,
        label,
        category: 'Elements',
        screen: '/screens/elements.html?el=' + el,
        ...EG_NOOP,
    });
});
