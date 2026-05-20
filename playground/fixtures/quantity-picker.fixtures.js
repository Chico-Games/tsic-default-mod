// /screens/quantity-picker.html — driven entirely by URL query params, no
// subscriptions. The fixture URL hard-codes one set of params; switching
// scenarios doesn't reload the iframe with different params yet, so the
// scenarios are marked expect.visualChange:false to make that contract
// explicit to the sweep runner.
//
// (Future: rebuild the screen URL when a scenario clicks, then drop
//  the expect override.)
TSICPlayground.register({
    id: 'quantity-picker',
    label: 'Quantity Picker',
    screen: '/screens/quantity-picker.html?fromOwnerId=Player&fromSlot=3&toOwnerId=Storage:Chest01&toSlot=-1&maxCount=32',
    initialState() { return {}; },
    project() { return []; },
    scenarios: [
        { label: 'Open (default 32)', apply() {}, expect: { visualChange: false, injects: 0 } },
        { label: 'Cap 1',             apply() {}, expect: { visualChange: false, injects: 0 } },
        { label: 'Cap 8',             apply() {}, expect: { visualChange: false, injects: 0 } },
        { label: 'Cap 99',            apply() {}, expect: { visualChange: false, injects: 0 } },
        { label: 'Cap 999',           apply() {}, expect: { visualChange: false, injects: 0 } },
    ],
});
