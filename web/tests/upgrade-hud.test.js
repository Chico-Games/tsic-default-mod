// Tests for the LIVE hammer upgrade readout (shared/hud-upgrade.js), hosted by the thin
// fixture test-upgrade-hud.html.
//
// The hammer replaced the Upgrade screen, so this card is the ONLY place the player ever
// sees an upgrade cost. The states that matter are the negative ones: "hold to upgrade"
// doing nothing is indistinguishable from a broken feature unless the HUD names the gate.

const BASE = {
    EntityId: 42,
    FurnitureName: 'Bookcase',
    UpgradedName: 'Reinforced Bookcase',
    RequiredTier: 2,
    ToolTier: 2,
    bToolTierSufficient: true,
    bCanAfford: true,
    bHasUpgradeTool: true,
    Costs: [
        { ItemId: 'ID_ScrapMetal_CM', Name: 'Scrap Metal', Required: 4, Owned: 6 },
        { ItemId: 'ID_MetalScrews_CM', Name: 'Metal Screws', Required: 2, Owned: 2 },
    ],
};

function withState(over) {
    return Object.assign({}, BASE, over || {});
}

function cardText(ctx) {
    const el = ctx.doc.getElementById('hud-upgrade');
    return el ? (el.textContent || '') : '';
}

function badgeText(ctx) {
    const el = ctx.doc.getElementById('bb-upgradable');
    return el ? (el.textContent || '') : '';
}

TSICTestHarness.register({
    name: 'UpgradeHUD: affordable target shows target, result, costs and "hold to upgrade"',
    file: '/screens/test-upgrade-hud.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Upgrade.Target', withState());
        await ctx.waitFor(() => /Bookcase/.test(cardText(ctx)));
        const root = ctx.doc.getElementById('hud-upgrade');
        ctx.expect(ctx.assert.truthy(!root.hidden, 'card should be visible'));
        const text = cardText(ctx);
        ctx.expect(ctx.assert.truthy(/Reinforced Bookcase/.test(text), 'shows what it becomes'));
        ctx.expect(ctx.assert.truthy(/Scrap Metal/.test(text), 'lists each material'));
        ctx.expect(ctx.assert.truthy(/6 \/ 4/.test(text), 'shows have / need'));
        ctx.expect(ctx.assert.truthy(/Hold to upgrade/i.test(text), 'says it is ready'));
        // Every cost line is satisfied, so none should be flagged short.
        ctx.expect(ctx.assert.eq(root.querySelectorAll('.hu-cost.is-short').length, 0));
    },
});

TSICTestHarness.register({
    name: 'UpgradeHUD: hides itself when there is no upgradeable target',
    file: '/screens/test-upgrade-hud.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Upgrade.Target', withState());
        await ctx.waitFor(() => /Bookcase/.test(cardText(ctx)));
        // EntityId 0 is the engine's "nothing in front of me" signal.
        ctx.inject('tsic.msg.UI.Upgrade.Target', { EntityId: 0 });
        await ctx.waitFor(() => ctx.doc.getElementById('hud-upgrade').hidden === true);
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('hud-upgrade').hidden, 'card hidden'));
    },
});

TSICTestHarness.register({
    name: 'UpgradeHUD: names the tool-tier gate and quotes both tiers',
    file: '/screens/test-upgrade-hud.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Upgrade.Target',
            withState({ RequiredTier: 3, ToolTier: 1, bToolTierSufficient: false }));
        await ctx.waitFor(() => /tier/i.test(cardText(ctx)));
        const text = cardText(ctx);
        // Must say what is needed AND what the player has, or "needs a better hammer" is
        // unactionable.
        ctx.expect(ctx.assert.truthy(/tier 3/i.test(text), 'states the required tier'));
        ctx.expect(ctx.assert.truthy(/tier 1/i.test(text), 'states the equipped tier'));
        ctx.expect(ctx.assert.truthy(!/Hold to upgrade/i.test(text), 'must not claim it is ready'));
    },
});

TSICTestHarness.register({
    name: 'UpgradeHUD: flags only the materials actually short',
    file: '/screens/test-upgrade-hud.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Upgrade.Target', withState({
            bCanAfford: false,
            Costs: [
                { ItemId: 'ID_ScrapMetal_CM', Name: 'Scrap Metal', Required: 4, Owned: 4 },
                { ItemId: 'ID_MetalScrews_CM', Name: 'Metal Screws', Required: 2, Owned: 0 },
            ],
        }));
        await ctx.waitFor(() => /Missing materials/i.test(cardText(ctx)));
        const root = ctx.doc.getElementById('hud-upgrade');
        const shortRows = root.querySelectorAll('.hu-cost.is-short');
        ctx.expect(ctx.assert.eq(shortRows.length, 1));
        ctx.expect(ctx.assert.truthy(/Metal Screws/.test(shortRows[0].textContent), 'flags the right line'));
    },
});

TSICTestHarness.register({
    name: 'UpgradeHUD: with no hammer equipped neither the badge nor the cost card shows',
    file: '/screens/test-upgrade-hud.html',
    async run(ctx) {
        // Start from a hammer-in-hand readout so both pieces are on screen...
        ctx.inject('tsic.msg.UI.Upgrade.Target', withState());
        await ctx.waitFor(() => /Upgradable/i.test(badgeText(ctx)));
        // ...then unequip while still looking at the same furniture. Upgrading is a hammer
        // verb: bare-handed the whole readout goes away rather than nagging on every
        // upgradeable piece in the store.
        ctx.inject('tsic.msg.UI.Upgrade.Target',
            withState({ bHasUpgradeTool: false, ToolTier: 0, bToolTierSufficient: true }));
        await ctx.waitFor(() => ctx.doc.getElementById('bb-upgradable').classList.contains('hidden'));
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('hud-upgrade').hidden, 'cost card hidden'));
        ctx.expect(ctx.assert.eq(badgeText(ctx), ''));
    },
});

TSICTestHarness.register({
    name: 'UpgradeHUD: action-bar badge shows for a hammer-held upgradeable target and clears with it',
    file: '/screens/test-upgrade-hud.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.Upgrade.Target', withState());
        await ctx.waitFor(() => /Upgradable/i.test(badgeText(ctx)));
        const badge = ctx.doc.getElementById('bb-upgradable');
        ctx.expect(ctx.assert.truthy(!badge.classList.contains('hidden'), 'badge visible'));
        // Mounted into the action-bar panel, above the divider.
        ctx.expect(ctx.assert.eq(badge.parentNode.id, 'bb-shell-gameplay'));
        ctx.inject('tsic.msg.UI.Upgrade.Target', { EntityId: 0 });
        await ctx.waitFor(() => badge.classList.contains('hidden'));
        ctx.expect(ctx.assert.truthy(badge.classList.contains('hidden'), 'badge cleared'));
    },
});
