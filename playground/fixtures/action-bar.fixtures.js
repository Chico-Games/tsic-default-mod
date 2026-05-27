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
                { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Interact', SubText: '', StatusInt: 0, bVisible: true, KeyboardKeyText: 'E' },
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
    controls: [
        // Live cooldown driver — drag to set the ring's fill percent on the
        // first gameplay slot. 0 hides the ring (status idle), 1 also hides
        // it (cooldown done). Forces gameplay mode so the ring is visible.
        {
            label: 'Cooldown',
            min: 0, max: 1, step: 0.01,
            format(v) { return Math.round(v * 100) + '%'; },
            read(s) {
                const slot = s && s.abilities && s.abilities.Slots && s.abilities.Slots[0];
                return (slot && typeof slot.CooldownPercent === 'number') ? slot.CooldownPercent : 0;
            },
            apply(s, v) {
                if (!s.abilities) s.abilities = { Slots: [] };
                if (!s.abilities.Slots[0]) {
                    s.abilities.Slots[0] = {
                        InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Dash',
                        SubText: '', bVisible: true, KeyboardKeyText: 'E',
                    };
                }
                const slot = s.abilities.Slots[0];
                if (v > 0 && v < 1) { slot.StatusInt = 2; slot.CooldownPercent = v; }
                else                { slot.StatusInt = 0; delete slot.CooldownPercent; }
                s.screenName = null;       // gameplay mode shows abilities
                s.menu = { Entries: [] };
            },
        },
    ],
    scenarios: [
        { label: 'Menu: Inventory',   apply(s) { s.screenName = 'Inventory'; } },
        { label: 'Menu: Crafting',    apply(s) { s.screenName = 'Crafting'; s.menu = { Entries: [
            { ActionName: 'IA_UI_ConfirmAccept', Label: 'Craft',   Priority: 10, KeyboardKeyText: 'E' },
            { ActionName: 'IA_UI_CancelBack',    Label: 'Close',   Priority: 9,  KeyboardKeyText: 'Esc' },
            { ActionName: 'IA_UI_ActionBar1',    Label: 'Stack',   Priority: 8,  KeyboardKeyText: 'Q' },
        ] }; } },
        { label: 'Menu: Storage',     apply(s) { s.screenName = 'Storage'; s.menu = { Entries: [
            { ActionName: 'IA_UI_ConfirmAccept', Label: 'Take',    Priority: 10, KeyboardKeyText: 'E' },
            { ActionName: 'IA_UI_ActionBar1',    Label: 'Take all',Priority: 9,  KeyboardKeyText: 'Q' },
            { ActionName: 'IA_UI_CancelBack',    Label: 'Close',   Priority: 8,  KeyboardKeyText: 'Esc' },
        ] }; } },
        { label: 'Gameplay (no menu)',apply(s) { s.screenName = null; s.menu = { Entries: [] }; }, expect: { visualChange: false } },
        { label: 'Menu empty',        apply(s) { s.screenName = 'Inventory'; s.menu = { Entries: [] }; } },
        { label: 'Menu crowded',      apply(s) { s.screenName = 'Inventory'; s.menu = { Entries: [
            { ActionName: 'IA_UI_ConfirmAccept', Label: 'Build',   Priority: 10, KeyboardKeyText: 'E' },
            { ActionName: 'IA_UI_CancelBack',    Label: 'Cancel',  Priority: 9,  KeyboardKeyText: 'Esc' },
            { ActionName: 'IA_UI_ActionBar1',    Label: 'Pick up', Priority: 8,  KeyboardKeyText: 'Q' },
            { ActionName: 'IA_UI_ActionBar2',    Label: 'Inspect', Priority: 7,  KeyboardKeyText: 'R' },
            { ActionName: 'IA_UI_ActionBar3',    Label: 'Drop',    Priority: 6,  KeyboardKeyText: 'F' },
        ] }; } },
        { label: 'Empty ability row', apply(s) { s.abilities = { Slots: [] }; s.screenName = null; } },
        { label: 'Cooldown ability',  apply(s) { s.abilities = { Slots: [
            { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Dash', SubText: '', StatusInt: 2, CooldownPercent: 0.55, bVisible: true, KeyboardKeyText: 'E' },
        ] }; s.screenName = null; } },
        { label: 'Cooldown almost ready', apply(s) { s.abilities = { Slots: [
            { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Dash', SubText: '', StatusInt: 2, CooldownPercent: 0.92, bVisible: true, KeyboardKeyText: 'E' },
        ] }; s.screenName = null; } },
        { label: 'Blocked ability',   apply(s) { s.abilities = { Slots: [
            { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Throw', SubText: '', StatusInt: 1, bVisible: true, KeyboardKeyText: 'E' },
        ] }; s.screenName = null; } },
        { label: 'Five abilities',    apply(s) { s.abilities = { Slots: [
            { InputName: 'IA_PrimaryFire',      AbilityName: 'Attack',  SubText: 'Axe',  StatusInt: 0, bVisible: true, KeyboardKeyText: 'LMB' },
            { InputName: 'IA_SecondaryFire',    AbilityName: 'Block',   SubText: '',     StatusInt: 0, bVisible: true, KeyboardKeyText: 'RMB' },
            { InputName: 'IA_Sprint',           AbilityName: 'Dash',    SubText: '',     StatusInt: 2, CooldownPercent: 0.4, bVisible: true, KeyboardKeyText: 'Shift' },
            { InputName: 'IA_Interact',         AbilityName: 'Throw',   SubText: 'Rock', StatusInt: 1, bVisible: true, KeyboardKeyText: 'E' },
            { InputName: 'IA_UI_CancelBack',    AbilityName: 'Cancel',  SubText: '',     StatusInt: 0, bVisible: true, KeyboardKeyText: 'Esc' },
        ] }; s.screenName = null; } },
        { label: 'Hidden slot',       apply(s) { s.abilities = { Slots: [
            { InputName: 'IA_UI_ConfirmAccept', AbilityName: 'Use', SubText: '', StatusInt: 0, bVisible: true, KeyboardKeyText: 'E' },
            { InputName: 'IA_UI_CancelBack',    AbilityName: 'Hidden', SubText: '', StatusInt: 0, bVisible: false, KeyboardKeyText: 'Esc' },
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
