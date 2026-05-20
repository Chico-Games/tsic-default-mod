// /screens/voice-chat.html subscribes to:
//   tsic.msg.UI.VoiceChat.State  { bSelfPushToTalk, Speaking:[string] }
TSICPlayground.register({
    id: 'voice-chat',
    label: 'Voice Chat',
    screen: '/screens/voice-chat.html',
    initialState() { return { bSelfPushToTalk: false, Speaking: [] }; },
    project(s) { return [['tsic.msg.UI.VoiceChat.State', s]]; },
    scenarios: [
        { label: 'Silent',          apply(s) { s.bSelfPushToTalk = false; s.Speaking = []; }, expect: { visualChange: false } },
        { label: 'Self talking',    apply(s) { s.bSelfPushToTalk = true;  s.Speaking = []; } },
        { label: 'One speaker',     apply(s) { s.bSelfPushToTalk = false; s.Speaking = ['Friend']; } },
        { label: 'Self + one',      apply(s) { s.bSelfPushToTalk = true;  s.Speaking = ['Friend']; } },
        { label: 'Two speakers',    apply(s) { s.bSelfPushToTalk = false; s.Speaking = ['Friend','Stranger']; } },
        { label: 'Three speakers',  apply(s) { s.bSelfPushToTalk = true;  s.Speaking = ['Friend','Stranger','Newbie']; } },
        { label: 'Crowded (six)',   apply(s) { s.bSelfPushToTalk = true;
            s.Speaking = ['Friend','Stranger','Newbie','Vet','Ghost','Lurker']; } },
        { label: 'Long name',       apply(s) { s.bSelfPushToTalk = false;
            s.Speaking = ['SomeOneWithAReallyLongUsername']; } },
    ],
});
