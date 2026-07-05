// /screens/chat.html subscribes to:
//   tsic.msg.UI.Chat.History  { Messages:[{SenderName, Text}] }
// Outgoing:
//   UI.Cmd.Chat.Send  { Channel, Text }
TSICPlayground.register({
    id: 'chat',
    label: 'Chat',
    screen: '/screens/chat.html',
    initialState() { return { messages: [
        { SenderName: 'System', Text: 'Welcome to the server.' },
        { SenderName: 'Ziggy',  Text: 'hey' },
        { SenderName: 'Friend', Text: 'sup' },
    ] }; },
    project(state) { return [['tsic.msg.UI.Chat.History', { Messages: state.messages }]]; },
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
