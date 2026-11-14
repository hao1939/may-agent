<ai_context>
summary: "Anthropic's first-party guide defines an always-on agent as a sequence of brief, event-triggered runs around five durable primitives: inbox, timers, memory, permissions, and outbox. The architecture makes continuity and unattended operation control-plane concerns, while leaving cross-store atomicity, external-effect idempotency, and delivery settlement unspecified."
triggers: ["always-on agents", "event inbox", "durable timers", "agent outbox", "deferred tool calls", "unattended agent", "50491826"]
last_updated: "2026-11-14"
source_basis: "Complete first-party Anthropic article retrieved from claude.com and HN item 50491826; no implementation, tests, production traces, or independent reliability evidence were supplied."
</ai_context>

# Always-on agents are durable event cycles, not continuous sessions

**Date:** 2026-11-14  
**HN:** [Building Always-On Agents](https://news.ycombinator.com/item?id=50491826)  
**Source:** [Anthropic, “Building always-on agents”](https://claude.com/resources/articles/building-always-on-agents)  
**Reviewed source revision:** Article dated 2026-11-13; retrieved HTML SHA-256 `98eba2afe83669353043a7d9f912e8d84e6d692de37dc2ee07e70910c08e3635`  
**Coverage:** Complete first-party article and HN item 50491826  
**Disposition:** New knowledge

## Question

What runtime structure makes an agent feel continuously available while preserving work across disjoint runs, failures, schedules, and requests for human input?

## What the source says

Anthropic describes “always-on” as a user experience rather than a continuously running model process. The agent normally sleeps. An event wakes a worker, the agent performs one brief run inside a new or resumed session, saves durable state, and sleeps again. Five surrounding primitives create continuity:

1. **Event inbox.** Webhooks, user messages, schedules, and background jobs append to a durable event list instead of directly invoking the model. A worker reads pending events, resumes an earlier session when the event continues prior work, and otherwise opens a new session. The guide recommends source-identifier deduplication, one active worker per user inbox, batching pending events, and treating the inbox as the source of truth so another worker can retry after a crash.
2. **Timers.** Follow-ups and recurring schedules live in a durable timer store. A scheduler marks or advances due timers, appends corresponding events to the inbox, and wakes the worker. Timers therefore create future work by entering the same event path as external triggers.
3. **Memory.** Durable files or records outlive workers and retain user instructions, notes, prior messages, and per-task progress. The guide recommends storing pointers when authoritative information can be looked up elsewhere, loading only a lean baseline on every run, and preserving important details in memory before session compaction or replacement loses them.
4. **Permissions.** Unattended runs need a credential proxy, automatic review or blocking for higher-risk actions, and deferred tool calls for decisions that still require a person. A deferred call ends the run with the session saved mid-call; the user's later answer becomes another inbox event that resumes it.
5. **Outbox.** Background work may produce a message, no message, or a request for input. A formal outbox and dispatcher can pace messages and recover from delivery errors. The guide recommends evaluating notification volume and beginning quietly rather than treating every run as user-visible.

The resulting loop is: inbox event → run or resumed session → memory read → permission-bounded actions → memory update → optional outbox message → later timer or reply event.

## Scout interpretation

The useful architectural claim is that persistence does not belong inside one immortal conversation. The model loop is replaceable and brief; continuity lives in durable control-plane records. This separates several identities that are easy to collapse:

- an **event** that requests consideration;
- a **run** that handles one admitted batch;
- a **session** that carries conversational/tool-call context;
- a **task progress record** that survives session replacement;
- a **permission decision** that may suspend one tool call;
- an **outgoing message** whose delivery has its own lifecycle.

That separation supports recovery and user interaction, but the article also exposes unfilled settlement boundaries. Source-event deduplication and one active worker reduce duplicate runs; they do not prove that a retried run will not repeat a non-idempotent external effect. Likewise, the described scheduler advances or completes a timer and then appends an inbox event, but the article does not specify whether those writes are atomic. A crash between them could lose a firing, while reversing the order could duplicate one. The formal outbox allows delivery recovery, but no delivery idempotency key, acknowledgement model, or ambiguous-send reconciliation is described.

A stronger runtime contract should therefore preserve separate receipts for:

- source-event admission and deduplication;
- timer consumption and resulting inbox-event creation;
- run attempt, completion, and retry identity;
- each external effect and its settlement or uncertainty;
- deferred request revision and the human answer that resumes it;
- outbox admission, dispatch attempt, and recipient acknowledgement.

Memory should preserve task progress and instructions, but it should not silently become proof that an external action occurred or that an old permission remains valid. The article's five primitives are a useful minimum architecture; exactly-once claims still require effect-specific idempotency, transactional boundaries, or reconciliation beyond that architecture.

## Relevance to May

The article is specifically relevant to May's event-driven, multi-session agent runtime because it independently converges on durable inboxes, scheduled wakes, retained task progress, suspended human decisions, and separate communication delivery. The most useful adoption question is not whether May has similarly named components, but whether each handoff has an observable receipt and a defined crash window—especially timer-to-event creation, tool effect-to-local completion, deferred approval resumption, and message dispatch.

## Evidence limits

This is producer-authored architecture guidance, not an implementation or evaluation. Scout inspected the complete article and the HN item, which had one point and no comments at retrieval; HN supplied discovery, not substantive corroboration. No source code, schemas, transaction boundaries, deployment topology, tests, failure-injection results, production traces, security assessment, or reliability measurements were available.

The article's claims about improved model judgment, lower long-horizon cost, and the practical resurgence of always-on agents were not independently checked. Its cited 78% cost reduction for one long-horizon coding benchmark is not used as evidence for the runtime pattern here. The proposed receipts and crash-window analysis are Scout's interpretation of omissions in the described architecture, not guarantees or failures demonstrated by Anthropic's systems.
