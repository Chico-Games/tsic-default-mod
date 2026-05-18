TSICTestHarness.register({
    name: 'PlayerIndicators: renders one indicator per player',
    file: '/screens/player-indicators.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.PlayerIndicators', {
            Indicators: [
                { PlayerId: 'P1', Name: 'Alex', ScreenPos01: { X: 0.5, Y: 0.5 }, Distance: 1234, Color: '#7fff9a', bOffScreen: false, bLookedAt: false },
                { PlayerId: 'P2', Name: 'Sam',  ScreenPos01: { X: 0.1, Y: 0.9 }, Distance: 4321, Color: '#fca5a5', bOffScreen: true,  bLookedAt: true  },
            ],
        });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.domCount(ctx.doc, '.pi', 2));
        ctx.expect(ctx.assert.domExists(ctx.doc, '.pi.off'));
        ctx.expect(ctx.assert.domExists(ctx.doc, '.pi.lookedAt'));
    },
});
