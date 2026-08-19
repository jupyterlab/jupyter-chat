# A pub/sub API for Jupyter Chat

## Overview

Jupyter Chat should expose a single, generic pub/sub bus. Consumers publish and
subscribe to named topics; the server relays payloads to every subscriber of a
topic. This one primitive can power many features that today each need bespoke
wiring:

- new messages and message edits,
- typing state of web clients and of server-side agents,
- server-published session info in real time: available personas, models, and
  settings (see the persona-manager's
  [awareness models](https://github.com/jupyter-ai-contrib/jupyter-ai-persona-manager/blob/main/jupyter_ai_persona_manager/awareness_models.py)).

Under RTC, document awareness already provides exactly this. Awareness is versatile:
any peer can attach arbitrary data under a key, and every other peer sees it, with
no new handler code. That flexibility is why personas can broadcast their model and
usage today without touching `jupyterlab-chat`.

The RTC-free path has no equivalent. `WsChatModel` ships a fixed protocol
(`connection` / `users` / `msg` / `writing`) that only supports those message types.
A consumer that wants to broadcast anything new must either patch
`jupyterlab-chat` or open its own WebSocket per feature. The pub/sub API closes that
gap: it gives the RTC-free path the same open-ended extensibility awareness gives
the RTC path, behind one API that both transports implement.

## API

Add three methods to the base models: to `BaseChatModel` (per-chat channel) and to
`ChatManager` (global channel):

```python
def pub(self, topic: str, data: Any) -> None: ...
def sub(self, topic: str, callback: Callable[[Payload], None]) -> SubToken: ...
def unsub(self, token: SubToken) -> None: ...
```

Everything on the wire is one payload:

```python
@dataclass
class Payload:
    client_id: str   # who published it (enables replicated sets + cleanup on leave)
    data: Any        # arbitrary; publishers and subscribers agree on the shape
```

A subscriber receives the current state of the topic on subscribe, then every
subsequent payload. Because a WebSocket delivers in order and never drops a frame
on a live connection, a client that joins mid-stream (e.g. while an agent is
streaming a reply) cannot miss anything.

## Topics

Each topic is a category of payloads.

**The chat topic is special.** It carries the chat document (messages, users,
metadata). It is uniquely ordered, potentially large, and backed by an actual file
on the server (`.chat`). It is not a generic in-memory bus: under RTC it is the
YDoc, and under RTC-free it is `WsChatModel` plus the file. Subscribing yields the
message history and then live updates.

**Every other topic is a generic pub/sub bus.** Payloads are relayed to
subscribers and each peer keeps its own view. Two merge behaviors, chosen by the
payload type:

- A **dict** payload is merged by top-level key (last writer wins per key; a key
  set to `null` deletes it). This is a replicated set/dictionary.
- **Anything else** replaces the topic's value (last writer wins).

The merge is applied by each peer, not the server, because it must work the same
whether the transport is the YDoc/awareness (RTC) or our own WS (RTC-free). The
`client_id` lets a subscriber attribute keys to a publisher and drop them when that
publisher disconnects (a stopped/crashed writer's key is removed automatically).

## Implementation with RTC

The chat topic is the YDoc. `sub("/chat/...")` wraps the `YChat` observer API and
`pub` mutates the shared types. A peer that joins gets the whole document through
normal Yjs sync, so catchup is automatic and ordering is guaranteed by the CRDT.

Every other topic maps to awareness. Publishing sets a field on the peer's own
awareness state; subscribing observes awareness and folds the per-client states
locally (which is what the frontend already does to build the writers list). This
reuses the existing Y-protocol WebSocket, so there is no new server code.

## Implementation without RTC

There is no YDoc sync, so the chat topic is special and needs explicit handling.
`WsChatModel` owns the chat document and persists it to the `.chat` file. As soon
as a client connects, the server sends a catchup message carrying the full message
history; web clients always receive it because the server knows they are connected
(they hold the WebSocket). After catchup, edits stream as ordinary payloads on the
same ordered connection, so a client that connected mid-stream misses nothing.
Conceptually the chat topic is still just an observer over the document model,
the same shape as wrapping the YDoc observer under RTC; the only RTC-free-specific
step is sending that catchup ourselves instead of relying on Yjs sync.

Every other topic is a small in-memory relay: the server fans each published
payload out to the topic's subscribers over the one WebSocket per chat, and each
peer folds them locally exactly as in the RTC case. The server tracks which
`client_id` contributed which keys so it can relay a removal when that connection
closes (this is what clears a crashed writer).

## Use cases

### Chat flow (with RTC)

```python
chat.sub("/chat/messages", on_message)   # analogous to ychat.ymessages.observe(...)
```

Under RTC this wraps the `YChat` observer directly, so `on_message` fires for every
created or edited message. Multiple browser tabs and server-side agents subscribe
to the same topic and stay in sync through the YDoc.

### Chat flow (without RTC)

The chat topic is special here: the server sends the message history the instant a
client connects, because the client needs the file's contents to render anything.
The web client therefore must be able to `sub("/chat/messages", ...)` *before* the
WebSocket is open. Subscriptions are registered locally and flushed on connect, so
the first thing the callback receives is the history catchup, followed by live
edits on the same ordered connection.

```python
chat.sub("/chat/messages", on_message)   # registered even before the socket opens
# on connect: server pushes full history, then streams subsequent edits
```

### Writers

`/writers` is a replicated dictionary keyed by user id. Each writer contributes
only its own key and retracts it with `null`; a key also drops automatically when
that peer disconnects. Any number of peers can subscribe to watch the live set.

```python
# each writer publishes its own key
chat.pub("/writers", {user1_id: {"typing": True}})     # from client 1
chat.pub("/writers", {user2_id: {"typing": True}})     # from client 2
chat.pub("/writers", {user1_id: None})                 # client 1 stopped

# every subscriber converges to the merged set
chat.sub("/writers", lambda p: render_writers(p.data))
# -> {user1: {...}, user2: {...}} -> {user2: {...}}
```

### Jupyter AI: advertising personas

The persona manager publishes the available personas on a per-chat topic; the UI
subscribes to render the selector. Because the value is a plain list, each update
replaces the previous one.

```python
chat.pub("/personas", [
    {"id": "jupyternaut", "name": "Jupyternaut", "avatar_url": "..."},
    {"id": "code",        "name": "Code",        "avatar_url": "..."},
])
chat.sub("/personas", lambda p: update_persona_selector(p.data))
```

Per-persona state that several personas contribute to at once (model config, usage)
uses a `/personas/...` dict topic keyed by persona id, so each persona owns its key:

```python
chat.pub("/personas/usage", {persona_id: {"input_tokens": 1200, "cost_amount": 0.03}})
```

### Global awareness state

The `ChatManager` exposes a global pub/sub channel at `/api/chats/all` for state
that is not tied to one chat. It is the RTC-free analog of global awareness. For
example, broadcasting a settings change to every connected client:

```python
manager.pub("/settings", {"default_chat_dir": "chats/"})
manager.sub("/settings", lambda p: apply_settings(p.data))
```

The same channel can carry the cross-chat persona list, feature flags, or anything
else a client should react to globally.

## Notes

- Publishing is open to any peer, matching the awareness/YDoc trust model today.
- Presence topics are last-writer-wins, so out-of-order updates under RTC are
  harmless: a subscriber only ever wants the latest value of a key.
- `observe_messages`, `broadcast_writing_status`, and `ChatManager.observe_chats`
  become thin wrappers over `sub`/`pub` on the relevant topic.
