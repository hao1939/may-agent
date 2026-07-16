# Brief: Universal Agent Communication Framework

## Vision

Agents currently communicate through file-based handoffs and the agents.send() API, but this is limiting. We need a unified communication framework that supports:

1. **Typed message channels** — agents declare what message types they accept
2. **Priority queuing** — urgent messages interrupt current work
3. **Message acknowledgment** — sender knows when receiver processed the message
4. **Broadcast channels** — one agent can notify all others
5. **Message routing** — messages automatically go to the right agent based on content type

## Architecture

```
MessageBus
├── Channel (typed, per-agent)
│   ├── PriorityQueue
│   ├── AckTracker
│   └── DeadLetterQueue
├── Router
│   ├── ContentTypeRouter
│   ├── PriorityRouter
│   └── BroadcastRouter
└── Registry
    ├── AgentCapabilities
    └── ChannelConfig
```

## Design

### Message Types
Each agent registers the message types it can handle:
```typescript
interface AgentMessageSpec {
  agent: string;
  accepts: MessageType[];
  priority_rules: PriorityRule[];
}
```

### Channel Protocol
Messages flow through typed channels with guaranteed delivery:
1. Sender publishes to channel
2. Router determines recipient(s)
3. Priority queue orders delivery
4. Recipient processes and ACKs
5. Dead letter queue catches unprocessed messages

### Broadcast
For system-wide announcements (new deployment, config change), agents subscribe to broadcast channels. The bus handles fan-out and tracks per-agent acknowledgment.

## Benefits

- More reliable than file-based handoffs
- Enables real-time coordination between agents
- Typed messages prevent miscommunication
- Priority system ensures urgent work isn't delayed
- Dead letter queue prevents message loss

## Implementation Plan

Phase 1: MessageBus core + Channel abstraction (2 sessions)
Phase 2: Router + ContentType matching (2 sessions)
Phase 3: Priority queue + ACK tracking (1 session)
Phase 4: Broadcast channels (1 session)
Phase 5: Agent migration (3 sessions)

Total: ~9 sessions across Tech-Lead and Optimizer.
