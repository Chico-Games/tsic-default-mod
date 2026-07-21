// Text chat HUD component (shared/hud-chat.js, mounted by hud.js in the
// in-game shell). Subscribes to:
//   tsic.msg.UI.Chat.History      { Messages:[{SenderName, Text}] }
//   tsic.msg.UI.Behavior.OpenChat { Phase:'Started' }  (opens the input row)
// Outgoing:
//   UI.Cmd.Chat.Send      { Channel, Text }
//   UI.Cmd.Overlay.Push/Pop { Name:'ChatInput' }
TSICPlayground.register({
    id: 'chat',
    label: 'Chat',
    screen: '/screens/in-game.html',
    initialState() { return { messages: [
        { SenderName: 'System', Text: 'Welcome to the server.' },
        { SenderName: 'Ziggy',  Text: 'hey' },
        { SenderName: 'Friend', Text: 'sup' },
    ], openSeq: 0 }; },
    project(state) {
        const out = [['tsic.msg.UI.Chat.History', { Messages: state.messages }]];
        if (state.openSeq > 0) {
            out.push(['tsic.msg.UI.Behavior.OpenChat', { Phase: 'Started', _id: state.openSeq }]);
        }
        return out;
    },
    controls: [
        { type: 'button', label: 'Open input (Enter)', apply(s) { s.openSeq = (s.openSeq || 0) + 1; } },
    ],
    scenarios: [
        { label: 'Empty',          apply(s) { s.messages = []; } },
        { label: 'System only',    apply(s) { s.messages = [
            { SenderName: 'System', Text: 'Server starting...' },
            { SenderName: 'System', Text: 'Player Friend connected.' },
            { SenderName: 'System', Text: 'Day 1.' },
        ]; } },
        { label: 'Two lines',      apply(s) { s.messages = [
            { SenderName: 'System', Text: 'Welcome.' },
            { SenderName: 'Ziggy',  Text: 'sup' },
        ]; } },
        { label: 'Conversation',   apply(s) { s.messages = [
            { SenderName: 'Friend',  Text: 'meet at the warehouse?' },
            { SenderName: 'Ziggy',   Text: 'on my way' },
            { SenderName: 'Friend',  Text: 'bring stone' },
            { SenderName: 'Ziggy',   Text: 'got 12' },
            { SenderName: 'Friend',  Text: 'nice' },
        ]; } },
        { label: 'Long message',   apply(s) { s.messages = [
            { SenderName: 'Ziggy', Text: 'this is a really long message that should probably wrap onto multiple lines so we can see how the chat layout handles overflow gracefully' },
        ]; } },
        { label: 'Mention',        apply(s) { s.messages = [
            { SenderName: 'Friend', Text: '@Ziggy got room?' },
        ]; } },
        { label: 'Long history',   apply(s) { s.messages = Array.from({length: 30}, (_, i) => ({
            SenderName: ['Ziggy', 'Friend', 'Stranger', 'System'][i % 4],
            Text: 'message ' + i,
        })); } },
        { label: 'Spam burst',     apply(s) { s.messages = Array.from({length: 8}, () => ({
            SenderName: 'Spammer', Text: 'aaaaaaaaaa',
        })); } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Chat.Send') {
            state.messages.push({ SenderName: 'Ziggy', Text: payload.Text || '' });
        }
    },
});
