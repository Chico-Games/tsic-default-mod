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
        { label: 'Empty',         apply(s) { s.messages = []; } },
        { label: 'Two lines',     apply(s) { s.messages = [
            { SenderName: 'System', Text: 'Welcome.' },
            { SenderName: 'Ziggy',  Text: 'sup' },
        ]; } },
        { label: 'Long history',  apply(s) { s.messages = Array.from({length: 30}, (_, i) => ({
            SenderName: ['Ziggy', 'Friend', 'Stranger', 'System'][i % 4],
            Text: 'message ' + i,
        })); } },
    ],
    onPublish(state, channel, payload) {
        if (channel === 'UI.Cmd.Chat.Send') {
            state.messages.push({ SenderName: 'Ziggy', Text: payload.Text || '' });
        }
    },
});
