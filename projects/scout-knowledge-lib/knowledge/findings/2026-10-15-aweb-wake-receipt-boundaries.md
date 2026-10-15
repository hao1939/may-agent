<ai_context>
summary: "Pinned aweb source separates durable message state, wake transport, accepted terminal presentation, read acknowledgement, and completed work; reconnect recovery is intentionally snapshot-based and at least once."
triggers: ["aweb", "agent wake", "durable mail", "presentation receipt", "work completion", "reconnect snapshot", "agent recovery"]
last_updated: "2026-10-15"
source_basis: "Static inspection of aweb documentation, TypeScript/Go implementation, and selected project-authored tests at revision bf05b5cf74823e120a173f4eb3f4d14791df5a1f; the software and tests were not executed."
</ai_context>

# A wake receipt is not a work-completion receipt

**Date:** 2026-10-15  
**Disposition:** new knowledge  
**Repo:** https://github.com/awebai/aweb  
**Inspected revision:** https://github.com/awebai/aweb/commit/bf05b5cf74823e120a173f4eb3f4d14791df5a1f  
**Question:** What must a durable agent communication system prove before it can claim that addressed work was completed?

## Finding

Aweb's pinned design usefully splits an apparently simple “wake the agent” flow
into independently recoverable states:

1. **The durable item exists.** Mail and chat are server state, while the event
   carries routing metadata and an exact item ID rather than serving as the
   message body.
2. **A wake path observes actionable state.** A native adapter, managed runner,
   terminal broker, raw event consumer, or explicit polling loop owns this step.
   The repository explicitly says an event does not launch an arbitrary runtime.
3. **The host accepts presentation.** The terminal adapter inspects the target,
   refuses bare shells, blocked modals, stopped sessions, and absent sessions,
   then submits formatted content to the host. A successful input call means the
   terminal transport accepted the text.
4. **Delivery/read state advances.** After accepted presentation, the channel can
   persist a delivered-ID mark and acknowledge mail or mark chat read when its
   grant permits. Read-only mail grants cannot perform the server acknowledgement,
   so local delivery and server read state can legitimately diverge.
5. **The requested work completes.** No presentation or read receipt proves model
   consumption, task acceptance, side-effect settlement, or completion.

This is more than a terminology distinction. The event stream has no resumable
cursor. Reconnection re-derives unread mail and pending chat from a fresh snapshot,
while a local delivered-ID store suppresses presentations that were already
accepted. That gives an intentionally at-least-once presentation boundary with
explicit crash windows:

- a failure before presentation/read marking leaves the durable item available to
  a later snapshot;
- a crash after terminal acceptance but before local delivery marking or server
  acknowledgement can present it again;
- a crash after marking an item read can remove it from unread recovery even when
  the agent never completed the request;
- empty unread/pending queries therefore do not prove that earlier work completed.

The server's authored recovery tests add a narrower transport property: after an
initial snapshot, transient mail or chat poll failures retain the last successful
actionable-state snapshot, retry with backoff, and can emit newly visible mail after
recovery. Sustained failure eventually ends the stream with an error. This helps
transport recovery, but does not turn control signals into durable replay or turn a
wake stream into a task ledger.

## Reusable rule

Model agent communication as a chain of typed receipts:

`durable item -> actionable observation -> host presentation -> read/delivery acknowledgement -> work admission -> effect settlement -> completion`

Persist and reconcile the later task and effect receipts independently from the
communication channel. On uncertain restart, recover exact message IDs or page
read-inclusive history, then compare them with task state and side-effect receipts
before retrying. Do not infer completed work from an empty inbox, a delivered-ID
mark, an accepted terminal input, or a read acknowledgement.

For May-like runtimes, this suggests keeping input delivery and Task convergence as
separate facts. A transport may legitimately redeliver after an uncertain crash;
the Task/effect layer, not the wake channel, must decide whether the request is new,
already admitted, completed, or unsafe to repeat.

## Evidence inspected

- [Repository README](https://github.com/awebai/aweb/blob/bf05b5cf74823e120a173f4eb3f4d14791df5a1f/README.md) — stable identity, durable mail/chat, event-as-wake-signal, and exact-item fetch.
- [Receiving events](https://github.com/awebai/aweb/blob/bf05b5cf74823e120a173f4eb3f4d14791df5a1f/docs/receiving-events.md) — runtime wake ownership, reconnect behavior, acknowledgement semantics, and poll-failure recovery contract.
- [Terminal wake broker](https://github.com/awebai/aweb/blob/bf05b5cf74823e120a173f4eb3f4d14791df5a1f/docs/terminal-wake-broker.md) — presentation crash windows, read-inclusive recovery, and the explicit statement that submitted input is not model consumption or work completion.
- [Terminal adapter](https://github.com/awebai/aweb/blob/bf05b5cf74823e120a173f4eb3f4d14791df5a1f/channel-core/src/terminal.ts) — serialized presentation, safety inspection, refusal states, exact recovery footer, and host input boundary.
- [Wake retry tests](https://github.com/awebai/aweb/blob/bf05b5cf74823e120a173f4eb3f4d14791df5a1f/cli/go/wake/broker_retry_test.go) — authored classification of permanent quarantine versus retryable HTTP failures and bounded jitter.
- [Event poll recovery tests](https://github.com/awebai/aweb/blob/bf05b5cf74823e120a173f4eb3f4d14791df5a1f/server/tests/test_events_poll_recovery.py) — authored checks for transient recovery, retained successful snapshot, backoff reset, heartbeat continuity, and sustained-failure termination.

**Discovery query:** GitHub Repository Search API query
`"AI agent" runtime pushed:>2026-10-01`, sorted by updated; `total_count: 864`,
`incomplete_results: false`.

## Limitations

Scout performed static inspection only. It did not install or run aweb, execute its
tests, connect two agents, inject a crash, or verify production durability. The
selected project-authored tests demonstrate intended regression coverage, not an
independent reliability measurement. This review did not audit every identity,
cryptography, federation, acknowledgement, or alternative runtime-adapter path.
The source supports the receipt separation and documented recovery model; it does
not establish exactly-once presentation, exactly-once work, or completed external
effects.
