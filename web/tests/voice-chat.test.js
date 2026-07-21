// Voice chat HUD component (shared/hud-voice.js, mounted by hud.js inside the
// in-game shell). Shows a pulsing TALKING chip while the local mic is open and
// one row per remote speaker. State arrives on UI.VoiceChat.State.

TSICTestHarness.register({
    name: 'VoiceChat: speakers render',
    tags: ['voice', 'hud'],
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#vc-list'));
        ctx.inject('tsic.msg.UI.VoiceChat.State', { Speaking: ['Alex', 'Sam'], bSelfPushToTalk: false });
        await ctx.waitFor(() => ctx.doc.querySelectorAll('#vc-list .vc-row').length === 2);
        ctx.expect(ctx.assert.domCount(ctx.doc, '#vc-list .vc-row', 2));
    },
});

TSICTestHarness.register({
    name: 'VoiceChat: self-PTT toggles indicator',
    tags: ['voice', 'hud'],
    file: '/screens/in-game.html',
    async run(ctx) {
        await ctx.waitFor(() => ctx.doc.querySelector('#vc-self'));
        ctx.inject('tsic.msg.UI.VoiceChat.State', { Speaking: [], bSelfPushToTalk: true });
        await ctx.waitFor(() => ctx.doc.getElementById('vc-self').classList.contains('on'));
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('vc-self').classList.contains('on')));
        ctx.inject('tsic.msg.UI.VoiceChat.State', { Speaking: [], bSelfPushToTalk: false });
        await ctx.waitFor(() => !ctx.doc.getElementById('vc-self').classList.contains('on'));
        ctx.expect(ctx.assert.truthy(!ctx.doc.getElementById('vc-self').classList.contains('on')));
    },
});
