# TSIC Web UI &mdash; JavaScript API

The plugin exposes a single global, `window.tsic`, on every page loaded inside a
`UTSICWebView`. Bindings are installed in the load listener's
`OnWindowObjectReady` callback, before any page script runs.

## Channels

A channel is a named pipe between C++ and JS, identified by an FName. By
convention:

| Prefix     | Meaning                                          |
|------------|--------------------------------------------------|
| `tsic.*`   | Plugin / first-party game channels.              |
| `mod.<id>.*` | Channels owned by mod `<id>`.                  |

Channels must be registered on the C++ side (`UTSICWebUISubsystem::RegisterChannel`)
before any broadcast or request will be honoured. Unregistered names are
rejected and logged.

Channels have a `kind`:

- `event` &mdash; fire-and-forget. Subscribers receive only future broadcasts.
- `sticky` &mdash; the most recently broadcast payload is cached; new subscribers
  (including freshly loaded pages) get the cached value at subscribe time.

## JS API

All payloads are arbitrary JSON-serializable values; they are converted with
`JSON.stringify` on the JS side and decoded with `JSON.parse` on the other.

```js
// Fire-and-forget JS -> C++.
tsic.send('tsic.test.ping', { foo: 1 });

// Request/response JS -> C++ -> JS, returns a Promise.
tsic.request('tsic.test.echo', { foo: 1 }).then((resp) => {
  console.log(resp);
}).catch((err) => {
  console.error(err.message);
});

// Subscribe / unsubscribe to C++ -> JS events.
function onHealth(payload) { ... }
tsic.on('tsic.player.health', onHealth);
tsic.off('tsic.player.health', onHealth);

// List known channels.
const channels = tsic.describe();
// [{ name: 'tsic.player.health', kind: 'sticky', description: '...' }, ...]

// Tell the engine which rectangles in the page consume mouse input. Areas
// outside any rect pass clicks through to the gameplay layer. Default
// (no rects set) treats the whole view as interactive.
tsic.setInteractiveRects([
  { x: 0,   y: 0,   w: 320, h: 64 },
  { x: 960, y: 600, w: 320, h: 120 },
]);
```

## C++ API

```cpp
UTSICWebUISubsystem* Bus = GetGameInstance()->GetSubsystem<UTSICWebUISubsystem>();

// One-time registration (typically during startup or after the mod handshake).
Bus->RegisterChannel(TEXT("tsic.player.health"), EWebChannelKind::Sticky,
    TEXT("Latest player health snapshot. { current, max }"));

// Push state to every page (sticky channels also cache for late subscribers).
Bus->BroadcastEvent(TEXT("tsic.player.health"),
    FString::Printf(TEXT("{\"current\":%d,\"max\":%d}"), Cur, Max));

// Handle JS-initiated send (fire-and-forget).
Bus->GetEventBus().RegisterHandler(TEXT("craft.start"),
    FTSICWebEventHandler::CreateLambda([](FName Channel, const FString& Json)
{
    // Always invoked on the game thread.
    // Parse Json, kick off the action.
}));

// Handle JS-initiated request (returns response payload to JS Promise).
Bus->GetEventBus().RegisterRequestHandler(TEXT("inventory.list"),
    FTSICWebRequestHandler::CreateLambda([](FName Channel, const FString& Json) -> TOptional<FString>
{
    // Return the response JSON. Return an empty optional to reject the promise.
    return FString(TEXT("[{\"id\":\"ID_BreadData\",\"count\":3}]"));
}));
```

## Threading model

- Native JS callbacks fire on the same thread that drives `Renderer::Update`,
  which the plugin runs from `UTSICWebUISubsystem::Tick` (the game thread).
- All inbound JS &rarr; C++ messages are still queued and drained at the end
  of the tick to avoid re-entrancy.
- All C++ handlers therefore run on the game thread.
- Pages going through `tsic.request` get their responses on the next tick
  (one frame round-trip in the common case).

## Multiplayer

Web UIs run **on the client viewing them**. The plugin is listen-server only:
on the listen-server host the local pawn's UI behaves like any other client.
Replication is the game code's job &mdash; broadcast events *after* the data has
been replicated to the relevant client, never before. For sticky channels,
broadcast every time the underlying state changes locally; the bus caches the
last value automatically.

## Modding

Mod modules should register their channels through `UTSICWebUISubsystem`
**after** `UScpModManagerSubsystem` finishes the mod handshake (see
`feedback_mod_handshake_timing`). Pick the channel namespace
`mod.<your-mod-id>.<event>` so mods cannot collide with each other or with
core channels.

```cpp
// In your mod runtime module, after the mod-set handshake resolves:
UTSICWebUISubsystem* Bus = GetGameInstance()->GetSubsystem<UTSICWebUISubsystem>();
Bus->RegisterChannel(
    TEXT("mod.example.tick"),
    EWebChannelKind::Event,
    TEXT("Fires once per simulated tick."));
```

Pages discover available channels at runtime via `tsic.describe()`; there is no
static schema.

## Console commands

| Command            | Purpose                                                                |
|--------------------|------------------------------------------------------------------------|
| `WebUI.DumpChannels` | Print every registered channel to the log along with handler counts. |
| `WebUI.Ping`         | Broadcast a `tsic.test.pong` event from C++ for verification.        |
