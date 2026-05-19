// /screens/voice-chat.html subscribes to:
//   tsic.msg.UI.VoiceChat.State  { bSelfPushToTalk, Speaking:[string] }
TSICPlayground.register({
    id: 'voice-chat',
    label: 'Voice Chat',
    screen: '/screens/voice-chat.html',
    initialState() { return { bSelfPushToTalk: false, Speaking: [] }; },
    project(s) { return [['tsic.msg.UI.VoiceChat.State', s]]; },
    scenarios: [
        { label: 'Silent',         apply(s) { s.bSelfPushToTalk = false; s.Speaking = []; } },
        { label: 'Self talking',   apply(s) { s.bSelfPushToTalk = true;  s.Speaking = []; } },
        { label: 'One speaker',    apply(s) { s.bSelfPushToTalk = false; s.Speaking = ['Friend']; } },
        { label: 'Three speakers', apply(s) { s.bSelfPushToTalk = true;  s.Speaking = ['Friend','Stranger','Newbie']; } },
    ],
});
