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
        // Neutral starting state — no specific menu, single ability, KBM.
        // Each named scenario diverges from this so visualChange asserts hold.
        return {
            screenName: 'Default',
            mode: 'MouseAndKeyboard',
            abilities: { Slots: [
                { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Interact', SubText: '', StatusInt: 0, bVisible: true },
            ] },
            menu: { Entries: [] },
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
        { label: 'Menu: Crafting',    apply(s) { s.screenName = 'Crafting'; s.menu = { Entries: [
            { ActionName: 'IA_UI_ConfirmAccept', Label: 'Craft',   Priority: 10 },
            { ActionName: 'IA_UI_CancelBack',    Label: 'Close',   Priority: 9 },
            { ActionName: 'IA_UI_ActionBar1',    Label: 'Stack',   Priority: 8 },
        ] }; } },
        { label: 'Menu: Storage',     apply(s) { s.screenName = 'Storage'; s.menu = { Entries: [
            { ActionName: 'IA_UI_ConfirmAccept', Label: 'Take',    Priority: 10 },
            { ActionName: 'IA_UI_ActionBar1',    Label: 'Take all',Priority: 9 },
            { ActionName: 'IA_UI_CancelBack',    Label: 'Close',   Priority: 8 },
        ] }; } },
        { label: 'Gameplay (no menu)',apply(s) { s.screenName = null; s.menu = { Entries: [] }; }, expect: { visualChange: false } },
        { label: 'Menu empty',        apply(s) { s.screenName = 'Inventory'; s.menu = { Entries: [] }; } },
        { label: 'Menu crowded',      apply(s) { s.screenName = 'Inventory'; s.menu = { Entries: [
            { ActionName: 'IA_UI_ConfirmAccept', Label: 'Build',   Priority: 10 },
            { ActionName: 'IA_UI_CancelBack',    Label: 'Cancel',  Priority: 9 },
            { ActionName: 'IA_UI_ActionBar1',    Label: 'Pick up', Priority: 8 },
            { ActionName: 'IA_UI_ActionBar2',    Label: 'Inspect', Priority: 7 },
            { ActionName: 'IA_UI_ActionBar3',    Label: 'Drop',    Priority: 6 },
        ] }; } },
        { label: 'Empty ability row', apply(s) { s.abilities = { Slots: [] }; s.screenName = null; } },
        { label: 'Cooldown ability',  apply(s) { s.abilities = { Slots: [
            { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Dash', SubText: '', StatusInt: 2, CooldownPercent: 0.55, bVisible: true },
        ] }; s.screenName = null; } },
        { label: 'Cooldown almost ready', apply(s) { s.abilities = { Slots: [
            { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Dash', SubText: '', StatusInt: 2, CooldownPercent: 0.92, bVisible: true },
        ] }; s.screenName = null; } },
        { label: 'Blocked ability',   apply(s) { s.abilities = { Slots: [
            { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Throw', SubText: '', StatusInt: 1, bVisible: true },
        ] }; s.screenName = null; } },
        { label: 'Five abilities',    apply(s) { s.abilities = { Slots: [
            { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Attack',  SubText: 'Axe',  StatusInt: 0, bVisible: true },
            { InputName: 'IA_UI_ActionBar1',    AbilityName: 'Block',   SubText: '',     StatusInt: 0, bVisible: true },
            { InputName: 'IA_UI_ActionBar2',    AbilityName: 'Dash',    SubText: '',     StatusInt: 2, CooldownPercent: 0.4, bVisible: true },
            { InputName: 'IA_UI_ActionBar3',    AbilityName: 'Throw',   SubText: 'Rock', StatusInt: 1, bVisible: true },
            { InputName: 'IA_UI_CancelBack',    AbilityName: 'Cancel',  SubText: '',     StatusInt: 0, bVisible: true },
        ] }; s.screenName = null; } },
        { label: 'Hidden slot',       apply(s) { s.abilities = { Slots: [
            { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Use', SubText: '', StatusInt: 0, bVisible: true  },
            { InputName: 'IA_UI_CancelBack',    AbilityName: 'Hidden', SubText: '', StatusInt: 0, bVisible: false },
        ] }; s.screenName = null; } },
        // Mode flips inject the channel but the action-bar page reads mode for
        // glyph hints — in the mock those glyphs don't render visibly, so
        // visualChange:false is the honest contract. Inject assertion catches
        // regressions.
        { label: 'Gamepad mode',      apply(s) { s.mode = 'Gamepad'; },          expect: { visualChange: false } },
        { label: 'KBM mode',          apply(s) { s.mode = 'MouseAndKeyboard'; }, expect: { visualChange: false } },
        { label: 'Touch mode',        apply(s) { s.mode = 'Touch'; },            expect: { visualChange: false } },
    ],
});
