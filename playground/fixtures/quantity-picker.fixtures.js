// /screens/quantity-picker.html — driven entirely by URL query params, no
// subscriptions. Fixture appends params to the iframe's screen path on load.
// To keep the playground simple we just register the default form.
TSICPlayground.register({
    id: 'quantity-picker',
    label: 'Quantity Picker',
    screen: '/screens/quantity-picker.html?fromOwnerId=Player&fromSlot=3&toOwnerId=Storage:Chest01&toSlot=-1&maxCount=32',
    initialState() { return {}; },
    project() { return []; },
    scenarios: [
        { label: 'Open (default 32)', apply() {} },
    ],
});
