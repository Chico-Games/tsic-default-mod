// /screens/in-game.html is the combined gameplay HUD (built by shared/hud.js).
// It wires up several independent elements, each driven by its own channel:
//   Health bar      tsic.msg.UI.Player.Attribute   { Channel:'Health',  Current, Max }
//   Stamina bar     tsic.msg.UI.Player.Attribute   { Channel:'Stamina', Current, Max }
//   Stomach         tsic.msg.UI.Stomach.State      { Slots:[{ItemId, IconUrl, Duration, RemainingTime}] }
//   Crosshair       tsic.msg.UI.Input.Mode.Changed { Mode, Device, Focus } (hides in menu)
//   Behavior bar    tsic.msg.UI.BehaviorBar.Entries{ Entries:[...] }
//   Interaction     tsic.msg.UI.Interaction.Targets{ Targets:[{Label, bIsPrimary}] }
//   Minimap         (runtime texture — shows as an empty ring in the browser)
//   Hotbar          tsic.msg.UI.Hotbar.Changed { SlotIndices, SelectedSlot }
//                   + tsic.msg.UI.Inventory.Updated (OwnerId 'Player') for icons
// Per-element visibility is driven by UI.HUD.SetElementVisible { Element, Visible }
// so the toggles below can hide/show each piece independently.
const HUD_ELEMENTS = ['health', 'stamina', 'stomach', 'crosshair', 'minimap', 'actionbar', 'interaction', 'hotbar'];

// Fire a transient hit-reaction splat. hitSeq is the monotonic _id the
// component de-dupes on, so re-projection on other control changes doesn't
// re-spawn — only a fresh fireHit() does.
function fireHit(s, dir, amt) {
    s.hitSeq = (s.hitSeq || 0) + 1;
    s.hit = { BearingDeg: dir, Amount: amt };
}

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
            stomach: [
                { ItemId: 'ID_Bread', IconUrl: '/tex/item-icon/ID_Bread', Duration: 60, RemainingTime: 45 },
                { ItemId: 'ID_Apple', IconUrl: '/tex/item-icon/ID_Apple', Duration: 60, RemainingTime: 18 },
                {}, {},
            ],
            behaviors: { Entries: [
                { DisplayName: 'Open',   SubText: 'Locker', StatusInt: 0, bVisible: true, KeyboardKeyText: 'E',     BehaviorTagName: 'IA_Interact' },
                { DisplayName: 'Attack', SubText: '',       StatusInt: 0, bVisible: true, KeyboardKeyText: 'LMB',   BehaviorTagName: 'IA_Attack' },
                { DisplayName: 'Dash',   SubText: '',       StatusInt: 2, bVisible: true, KeyboardKeyText: 'Shift', BehaviorTagName: 'IA_Dash', CooldownPercent: 0.45 },
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
            show: { health: true, stamina: true, stomach: true, crosshair: true, minimap: true, actionbar: true, interaction: true, hotbar: true, ping: false },
            // Hit-reaction: aim knobs + the last-fired transient (null until a
            // hit scenario fires).
            hitDir: 0, hitAmt: 0.6, hit: null, hitSeq: 0,
        };
    },
    project(s) {
        const out = [
            ['tsic.msg.UI.Player.Attribute', { Channel: 'Health',  Current: s.health,  Max: s.healthMax }],
            ['tsic.msg.UI.Player.Attribute', { Channel: 'Stamina', Current: s.stamina, Max: s.staminaMax }],
            ['tsic.msg.UI.Stomach.State', { Slots: s.stomach }],
            ['tsic.msg.UI.BehaviorBar.Entries', s.behaviors],
            ['tsic.msg.UI.Interaction.Targets', { Targets: s.targets }],
            ['tsic.msg.UI.Inventory.Updated', { OwnerId: 'Player', Items: s.hotbarItems }],
            ['tsic.msg.UI.Hotbar.Changed', s.hotbar],
            // Gameplay input mode so the crosshair isn't auto-hidden as if in a menu.
            ['tsic.msg.UI.Input.Mode.Changed', { Mode: 'MouseAndKeyboard', Device: 'kbm', Focus: 'game' }],
        ];
        // Hit-reaction is transient: only emit once a hit has been fired, tagged
        // with the monotonic _id the component de-dupes on (re-projection on a
        // slider drag re-sends the same _id → no re-spawn).
        if (s.hit) {
            out.push(['tsic.msg.UI.Player.Hit', { BearingDeg: s.hit.BearingDeg, Amount: s.hit.Amount, _id: s.hitSeq }]);
        }
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
        inGameToggle('stomach', 'Stomach'),
        inGameToggle('crosshair', 'Crosshair'),
        inGameToggle('minimap', 'Minimap'),
        inGameToggle('actionbar', 'Action bar'),
        inGameToggle('interaction', 'Interaction prompt'),
        inGameToggle('hotbar', 'Hotbar'),
        inGameToggle('ping', 'Ping wheel'),
        {
            // Bearing of the incoming hit: 0 = front, 90 = right, 180 = behind,
            // 270 = left (conic 0° = up, +clockwise). Set it, then press the
            // "HIT (use sliders)" button to fire a splat at this bearing.
            label: 'Hit direction',
            min: 0, max: 360, step: 2,
            read(s) { return s.hitDir || 0; },
            apply(s, v) { s.hitDir = v; },
            format(v) { return Math.round(v) + '°'; },
        },
        {
            label: 'Hit amount',
            min: 0, max: 1, step: 0.02,
            read(s) { return s.hitAmt == null ? 0.6 : s.hitAmt; },
            apply(s, v) { s.hitAmt = v; },
            format(v) { return Math.round(v * 100) + '%'; },
        },
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
        // Hit-reaction — fire a transient splat. The first button fires at the
        // Hit direction/amount sliders above; the rest are quick presets.
        { label: '💥 HIT (use sliders)', apply(s) { fireHit(s, s.hitDir || 0, s.hitAmt == null ? 0.6 : s.hitAmt); } },
        { label: 'Hit: front',      apply(s) { fireHit(s, 0,   0.5); } },
        { label: 'Hit: right',      apply(s) { fireHit(s, 90,  0.5); } },
        { label: 'Hit: behind',     apply(s) { fireHit(s, 180, 0.7); } },
        { label: 'Hit: left',       apply(s) { fireHit(s, 270, 0.5); } },
        { label: 'Hit: heavy back', apply(s) { fireHit(s, 180, 1.0); } },
        { label: 'Bars only', apply(s) {
            s.show.health = true; s.show.stamina = true;
            s.show.stomach = false; s.show.crosshair = false; s.show.minimap = false;
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
