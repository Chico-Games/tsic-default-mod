TSICTestHarness.register({
    name: 'VoiceChat: speakers render',
    file: '/screens/voice-chat.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.VoiceChat.State', { Speaking: ['Alex', 'Sam'], bSelfPushToTalk: false });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.domCount(ctx.doc, '#vc-list .vc-row', 2));
    },
});

TSICTestHarness.register({
    name: 'VoiceChat: self-PTT toggles indicator',
    file: '/screens/voice-chat.html',
    async run(ctx) {
        ctx.inject('tsic.msg.UI.VoiceChat.State', { Speaking: [], bSelfPushToTalk: true });
        await new Promise(r => setTimeout(r, 60));
        ctx.expect(ctx.assert.truthy(ctx.doc.getElementById('vc-self').classList.contains('on')));
    },
});
