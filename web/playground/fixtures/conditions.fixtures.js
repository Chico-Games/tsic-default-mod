// /screens/conditions.html subscribes to:
//   tsic.msg.UI.Conditions.State  { Conditions:[{Id, Kind, Duration, RemainingTime}] }
//
// C++ emits the list in a fixed catalogue order (debuffs first), so the scenarios below
// keep that order — the component renders bottom-up, putting entry 0 lowest.
(function () {
    // Every catalogue entry, in the order PublishConditionsSnapshot emits them.
    var C = {
        Starving:      { Id: 'Starving',      Kind: 'Debuff', Duration: 0,   RemainingTime: 0 },
        Burning:       { Id: 'Burning',       Kind: 'Debuff', Duration: 0,   RemainingTime: 0 },
        Tazed:         { Id: 'Tazed',         Kind: 'Debuff', Duration: 0,   RemainingTime: 0 },
        Overburdened:  { Id: 'Overburdened',  Kind: 'Debuff', Duration: 0,   RemainingTime: 0 },
        Hungry:        { Id: 'Hungry',        Kind: 'Debuff', Duration: 0,   RemainingTime: 0 },
        WellFed:       { Id: 'WellFed',       Kind: 'Buff',   Duration: 0,   RemainingTime: 0 },
        Regenerating:  { Id: 'Regenerating',  Kind: 'Buff',   Duration: 60,  RemainingTime: 42 },
        Hearty:        { Id: 'Hearty',        Kind: 'Buff',   Duration: 900, RemainingTime: 780 },
        Enduring:      { Id: 'Enduring',      Kind: 'Buff',   Duration: 900, RemainingTime: 780 },
        Fortified:     { Id: 'Fortified',     Kind: 'Buff',   Duration: 300, RemainingTime: 210 },
        Swift:         { Id: 'Swift',         Kind: 'Buff',   Duration: 45,  RemainingTime: 30 },
        Energised:     { Id: 'Energised',     Kind: 'Buff',   Duration: 45,  RemainingTime: 30 },
        QuickRecovery: { Id: 'QuickRecovery', Kind: 'Buff',   Duration: 120, RemainingTime: 95 },
        Hidden:        { Id: 'Hidden',        Kind: 'Buff',   Duration: 0,   RemainingTime: 0 },
    };
    var ORDER = Object.keys(C);

    function pick(ids, overrides) {
        return ORDER.filter(function (id) { return ids.indexOf(id) !== -1; })
                    .map(function (id) {
                        return Object.assign({}, C[id], (overrides && overrides[id]) || {});
                    });
    }

    TSICPlayground.register({
        id: 'conditions',
        label: 'Conditions',
        screen: '/screens/conditions.html',
        initialState() { return { conditions: pick(['Hungry', 'Swift', 'Energised']) }; },
        project(state) { return [['tsic.msg.UI.Conditions.State', { Conditions: state.conditions }]]; },
        scenarios: [
            { label: 'None',
              apply(s) { s.conditions = []; } },
            { label: 'Just eaten (Coffee)',
              apply(s) { s.conditions = pick(['WellFed', 'Swift', 'Energised']); } },
            { label: 'Single debuff',
              apply(s) { s.conditions = pick(['Hungry']); } },
            { label: 'Starving + burning',
              apply(s) { s.conditions = pick(['Starving', 'Burning']); } },
            { label: 'Hidden only',
              apply(s) { s.conditions = pick(['Hidden']); } },
            { label: 'Bread (full food buff)',
              apply(s) { s.conditions = pick(['WellFed', 'Hearty', 'Enduring']); } },
            { label: 'Mixed buff + debuff',
              apply(s) { s.conditions = pick(['Overburdened', 'Hungry', 'Swift', 'Energised']); } },
            // Expiring chips re-open their label and breathe — the last-5s warning.
            { label: 'Expiring buffs',
              apply(s) { s.conditions = pick(['WellFed', 'Swift', 'Energised'], {
                  Swift:     { RemainingTime: 3 },
                  Energised: { RemainingTime: 4 },
              }); } },
            { label: 'One expiring among many',
              apply(s) { s.conditions = pick(['Hungry', 'Regenerating', 'Hearty', 'Swift'], {
                  Swift: { RemainingTime: 2 },
              }); } },
            { label: 'Longest label (Quick Recovery)',
              apply(s) { s.conditions = pick(['Overburdened', 'QuickRecovery', 'Regenerating']); } },
            { label: 'Everything at once',
              apply(s) { s.conditions = pick(ORDER); } },
            { label: 'Tazed (stun)',
              apply(s) { s.conditions = pick(['Tazed']); } },
            // Re-pick these two back to back: the rising RefreshCount is what a second
            // consumable re-granting an active buff looks like, so Swift bumps and
            // re-shows its name while Energised sits still.
            { label: 'Top-up: before',
              apply(s) { s.conditions = pick(['Swift', 'Energised'], {
                  Swift:     { RemainingTime: 12, RefreshCount: 0 },
                  Energised: { RemainingTime: 12, RefreshCount: 0 },
              }); } },
            { label: 'Top-up: after (Swift re-granted)',
              apply(s) { s.conditions = pick(['Swift', 'Energised'], {
                  Swift:     { RemainingTime: 300, Duration: 300, RefreshCount: 1 },
                  Energised: { RemainingTime: 10,  RefreshCount: 0 },
              }); } },
            // Selecting a food on the hotbar gold-highlights the buffs it is driving
            // (bFromSelected), tying them to the highlighted stomach slot. Well Fed, being
            // shared, never lights up even when the selected food satiates.
            { label: 'Selected food buffs',
              apply(s) { s.conditions = pick(['WellFed', 'Swift', 'Energised'], {
                  Swift:     { bFromSelected: true },
                  Energised: { bFromSelected: true },
              }); } },
        ],
    });
})();
