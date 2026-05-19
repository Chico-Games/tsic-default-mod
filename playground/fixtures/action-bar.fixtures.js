// /screens/action-bar.html subscribes to:
//   tsic.msg.UI.ActionBar.Abilities   { Slots:[{InputName, AbilityName, SubText, bVisible, StatusInt, CooldownPercent}] }
//   tsic.msg.UI.ActionBar.MenuContext { Entries:[{ActionName, Label}] }
//   tsic.msg.UI.Screen.Changed        { Name }  (flips gameplay vs menu)
//   tsic.msg.UI.Input.Mode.Changed    { Mode }
TSICPlayground.register({
    id: 'action-bar',
    label: 'Action Bar',
    screen: '/screens/action-bar.html',
    initialState() {
        return {
            screenName: 'Inventory',
            mode: 'MouseAndKeyboard',
            abilities: { Slots: [
                { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Pick up', SubText: 'Hammer',  StatusInt: 0, bVisible: true },
                { InputName: 'IA_UI_CancelBack',        AbilityName: 'Cancel',  SubText: '',        StatusInt: 0, bVisible: true },
            ] },
            menu: { Entries: [
                { ActionName: 'IA_UI_ConfirmAccept', Label: 'Confirm', Priority: 10 },
                { ActionName: 'IA_UI_CancelBack',        Label: 'Cancel',  Priority: 9 },
            ] },
        };
    },
    project(state) {
        return [
            ['tsic.msg.UI.ActionBar.Abilities', state.abilities],
            ['tsic.msg.UI.ActionBar.MenuContext', state.menu],
            ['tsic.msg.UI.Screen.Changed', { Name: state.screenName }],
            ['tsic.msg.UI.Input.Mode.Changed', { Mode: state.mode }],
        ];
    },
    scenarios: [
        { label: 'Menu: Inventory',   apply(s) { s.screenName = 'Inventory'; } },
        { label: 'Gameplay (no menu)',apply(s) { s.screenName = null; } },
        { label: 'Menu empty',        apply(s) { s.menu = { Entries: [] }; } },
        { label: 'Menu crowded',      apply(s) { s.menu = { Entries: [
            { ActionName: 'IA_UI_ConfirmAccept', Label: 'Build',   Priority: 10 },
            { ActionName: 'IA_UI_CancelBack',        Label: 'Cancel',  Priority: 9 },
            { ActionName: 'IA_UI_ActionBar1',    Label: 'Pick up', Priority: 8 },
            { ActionName: 'IA_UI_ActionBar2',    Label: 'Inspect', Priority: 7 },
            { ActionName: 'IA_UI_ActionBar3',    Label: 'Drop',    Priority: 6 },
        ] }; } },
        { label: 'Cooldown ability',  apply(s) { s.abilities = { Slots: [
            { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Dash', SubText: '', StatusInt: 2, CooldownPercent: 0.55, bVisible: true },
        ] }; s.screenName = null; } },
        { label: 'Blocked ability',   apply(s) { s.abilities = { Slots: [
            { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Throw', SubText: '', StatusInt: 1, bVisible: true },
        ] }; s.screenName = null; } },
        { label: 'Gamepad mode',      apply(s) { s.mode = 'Gamepad'; } },
        { label: 'KBM mode',          apply(s) { s.mode = 'MouseAndKeyboard'; } },
    ],
});
