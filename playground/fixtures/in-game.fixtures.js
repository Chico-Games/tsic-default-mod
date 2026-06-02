// /screens/in-game.html is the combined gameplay HUD (built by shared/hud.js).
// It wires up several independent elements, each driven by its own channel:
//   Health bar      tsic.msg.UI.Player.Attribute   { Channel:'Health',  Current, Max }
//   Stamina bar     tsic.msg.UI.Player.Attribute   { Channel:'Stamina', Current, Max }
//   Crosshair       tsic.msg.UI.Input.Mode.Changed { Mode, Device, Focus } (hides in menu)
//   Action bar      tsic.msg.UI.ActionBar.Abilities{ Slots:[...] }
//   Interaction     tsic.msg.UI.Interaction.Targets{ Targets:[{Label, bIsPrimary}] }
//   Minimap         (runtime texture — shows as an empty ring in the browser)
//   Hotbar          tsic.msg.UI.Hotbar.Changed { SlotIndices, SelectedSlot }
//                   + tsic.msg.UI.Inventory.Updated (OwnerId 'Player') for icons
// Per-element visibility is driven by UI.HUD.SetElementVisible { Element, Visible }
// so the toggles below can hide/show each piece independently.
const HUD_ELEMENTS = ['health', 'stamina', 'crosshair', 'minimap', 'actionbar', 'interaction', 'hotbar'];

function inGameToggle(key, label) {
    return {
        type: 'toggle',
        label,
        read(s) { return s.show[key]; },
        apply(s, v) { s.show[key] = v; },
    };
}

TSICPlayground.register({
    id: 'in-game',
    label: 'In-Game HUD (combined)',
    screen: '/screens/in-game.html',
    initialState() {
        return {
            health: 75, healthMax: 100,
            stamina: 60, staminaMax: 100,
            abilities: { Slots: [
                { InputName: 'IA_Interact', AbilityName: 'Open',   SubText: 'Locker', StatusInt: 0, bVisible: true, KeyboardKeyText: 'E' },
                { InputName: 'IA_Attack',   AbilityName: 'Attack', SubText: '',       StatusInt: 0, bVisible: true, KeyboardKeyText: 'LMB' },
                { InputName: 'IA_Dash',     AbilityName: 'Dash',   SubText: '',       StatusInt: 2, bVisible: true, KeyboardKeyText: 'Shift', CooldownPercent: 0.45 },
            ] },
            targets: [{ EntityId: 1, Label: 'Open Locker', bIsPrimary: true }],
            // Hotbar: a few assigned slots + the rest empty; slot 0 selected.
            hotbarItems: [
                { ItemId: 'ID_Axe',    Count: 1, SlotIndex: 0 },
                { ItemId: 'ID_Hammer', Count: 1, SlotIndex: 1 },
                { ItemId: 'ID_Bread',  Count: 5, SlotIndex: 2 },
            ],
            hotbar: { SlotIndices: [0, 1, 2, -1, -1, -1, -1, -1, -1, -1], SelectedSlot: 0 },
            // Ping wheel defaults off — it's a full-screen overlay, so it's an
            // explicit toggle rather than part of the always-on HUD set.
            show: { health: true, stamina: true, crosshair: true, minimap: true, actionbar: true, interaction: true, hotbar: true, ping: false },
        };
    },
    project(s) {
        const out = [
            ['tsic.msg.UI.Player.Attribute', { Channel: 'Health',  Current: s.health,  Max: s.healthMax }],
            ['tsic.msg.UI.Player.Attribute', { Channel: 'Stamina', Current: s.stamina, Max: s.staminaMax }],
            ['tsic.msg.UI.ActionBar.Abilities', s.abilities],
            ['tsic.msg.UI.Interaction.Targets', { Targets: s.targets }],
            ['tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: s.hotbarItems }],
            ['tsic.msg.UI.Hotbar.Changed', s.hotbar],
            // Gameplay input mode so the crosshair isn't auto-hidden as if in a menu.
            ['tsic.msg.UI.Input.Mode.Changed', { Mode: 'MouseAndKeyboard', Device: 'kbm', Focus: 'game' }],
        ];
        for (const key of HUD_ELEMENTS) {
            out.push(['tsic.msg.UI.HUD.SetElementVisible', { Element: key, Visible: !!s.show[key] }]);
        }
        // Ping wheel (show-convention element; kept out of the bulk HUD set).
        out.push(['tsic.msg.UI.HUD.SetElementVisible', { Element: 'ping', Visible: !!s.show.ping }]);
        return out;
    },
    controls: [
        {
            label: 'Health',
            min: 0, max: 100, step: 1,
            read(s) { return s.health; },
            apply(s, v) { s.health = v; },
            format(v) { return Math.round(v) + ' / 100'; },
        },
        {
            label: 'Stamina',
            min: 0, max: 100, step: 1,
            read(s) { return s.stamina; },
            apply(s, v) { s.stamina = v; },
            format(v) { return Math.round(v) + ' / 100'; },
        },
        inGameToggle('health', 'Health bar'),
        inGameToggle('stamina', 'Stamina bar'),
        inGameToggle('crosshair', 'Crosshair'),
        inGameToggle('minimap', 'Minimap'),
        inGameToggle('actionbar', 'Action bar'),
        inGameToggle('interaction', 'Interaction prompt'),
        inGameToggle('hotbar', 'Hotbar'),
        inGameToggle('ping', 'Ping wheel'),
    ],
    scenarios: [
        { label: 'All elements', apply(s) {
            HUD_ELEMENTS.forEach((k) => { s.show[k] = true; });
            s.health = 75; s.stamina = 60;
        } },
        { label: 'Healthy',  apply(s) { s.health = 100; s.stamina = 100; } },
        { label: 'Hurt',     apply(s) { s.health = 38;  s.stamina = 55; } },
        { label: 'Critical', apply(s) { s.health = 7;   s.stamina = 22; } },
        { label: 'Exhausted',apply(s) { s.stamina = 4; } },
        { label: 'Bars only', apply(s) {
            s.show.health = true; s.show.stamina = true;
            s.show.crosshair = false; s.show.minimap = false;
            s.show.actionbar = false; s.show.interaction = false;
            s.show.hotbar = false;
        } },
        { label: 'Combat', apply(s) {
            HUD_ELEMENTS.forEach((k) => { s.show[k] = true; });
            s.show.interaction = false;
            s.health = 52; s.stamina = 30;
        } },
        { label: 'Exploring', apply(s) {
            HUD_ELEMENTS.forEach((k) => { s.show[k] = true; });
            s.show.actionbar = false;
        } },
        { label: 'HUD hidden', apply(s) {
            HUD_ELEMENTS.forEach((k) => { s.show[k] = false; });
        } },
    ],
    // Mouse wheel cycles the hotbar's selected slot, as it does in game.
    onWheel(s, deltaY) {
        const n = (s.hotbar.SlotIndices || []).length || 10;
        const dir = deltaY > 0 ? 1 : -1;   // wheel down → next slot
        const cur = (typeof s.hotbar.SelectedSlot === 'number') ? s.hotbar.SelectedSlot : 0;
        s.hotbar.SelectedSlot = ((cur + dir) % n + n) % n;
    },
});
