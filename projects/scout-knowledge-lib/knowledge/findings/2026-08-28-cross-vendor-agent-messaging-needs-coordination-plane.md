<ai_context>
summary: "agmsg demonstrates that cross-vendor agent messaging can be a thin durable transport while leaving assignment, completion, and runaway control to a separate coordination plane. Its own contracts expose the boundary: ordered messages and role exclusivity do not prevent duplicate task execution, shared-inbox races, or endless agent-to-agent loops."
triggers: ["cross-vendor agent messaging", "agent transport", "coordination plane", "shared inbox", "task claim", "agent interoperability", "agmsg"]
last_updated: "2026-08-28"
source_basis: "GitHub repository search metadata and the agmsg README plus send, inbox, role-claim, and watcher implementations at revision ad5c13f88b6a3eb9674209e98e3b220be75c938f."
</ai_context>

# Cross-Vendor Agent Messaging Still Needs a Coordination Plane

**Date:** 2026-08-28  
**Source:** GitHub  
**Repo:** https://github.com/fujibee/agmsg  
**Type:** Source-grounded finding

## Signal

GitHub's recently updated `topic:ai-agents stars:>100` feed surfaced **agmsg**, a
local messaging layer that lets independent Claude Code, Codex, Gemini, Copilot,
and other CLI-agent sessions exchange text through a shared store. At retrieval
time GitHub reported 1,468 stars; this is an attention signal, not evidence of
production maturity.

The useful architectural signal is the boundary the project makes unusually
explicit: **interoperable delivery is not interoperable coordination**. agmsg
provides a durable, ordered message floor and several host-specific delivery
adapters. It intentionally does not decide which worker owns a task, whether a
result satisfies the request, or when an autonomous exchange must stop.

## Source-grounded details

At inspected revision `ad5c13f88b6a3eb9674209e98e3b220be75c938f`:

- `send.sh` validates team names and, unless explicitly forced, checks that both
  sender and recipient are registered. The actual write goes through a storage
  facade as an append-only `message_sent` event.
- `inbox.sh` lists recipient-scoped unread messages, displays them, then marks
  only the displayed IDs as read. This avoids marking a message that arrived
  between the read and acknowledgment, but the acknowledgment is still a
  **delivery cursor**, not proof that work was accepted or completed.
- Delivery behavior differs by host. Some runtimes receive a polling monitor;
  others rely on between-turn hooks or a bridge. The transport therefore offers
  several wake-up semantics over one message model rather than pretending all
  agent hosts have equivalent lifecycle hooks.
- `actas-claim.sh` supplies an exclusive lock for a named role and rolls back
  partial multi-team claims. That prevents two live sessions from embodying the
  same role, but it is not a claim on a task or message.
- The README states that two agents can still take the same task because no
  protocol-level task claim or lease is enforced. It also puts max-turn or
  explicit-done conditions in prompts rather than in transport.
- `watch.sh` documents a subtler shared-inbox failure: two unfiltered watchers
  can share one recipient cursor, so whichever polls first consumes the row.
  The current implementation emits a diagnostic when it detects this situation,
  but deliberately does not turn that warning into exclusion.
- Messages carry plain text. Artifact references, summaries, success criteria,
  and handoff semantics remain conventions supplied by the surrounding prompt
  or workflow.

Scout inspected source and documentation but did not install agmsg or run its
Bats suite. Repository behavior above is implementation evidence, not an
independent runtime validation.

## Interpretation: three contracts, not one

A multi-agent system that connects heterogeneous workers needs at least three
separable contracts:

1. **Transport:** Can a message be durably addressed, ordered, delivered, and
   replayed across agent hosts?
2. **Assignment:** Which execution identity owns the request, under what lease,
   and can another worker safely take over after expiry or failure?
3. **Control and evidence:** What constitutes accepted completion, where is its
   evidence, and what budget or terminal stops further exchanges?

A transport can satisfy the first contract while the overall system still
executes work twice, loses accountability to a shared cursor, accepts a
plausible text reply as completion, or loops indefinitely. Role exclusivity is
also weaker than assignment: "only one session is Alice" does not prove that
Alice owns message 42, and "message 42 was read" does not prove that its requested
change was completed.

This separation is useful precisely because agmsg does not hide it. A thin
cross-vendor transport can remain simple, but the consuming workflow must add a
coordination plane instead of inferring ownership and completion from inbox
state.

## Reusable guidance

- Treat unread/read state as delivery telemetry only. Record task acceptance,
  lease, terminal outcome, and evidence separately.
- Key assignment to a request or task identity, not only to a human-readable
  agent role.
- Use atomic claim/lease transitions before execution; warn-only detection of
  shared consumers is observability, not concurrency control.
- Put explicit budgets, cancellation, and terminal signals in an enforceable
  control path rather than relying solely on peer prompts.
- Normalize transport envelopes across hosts, but preserve delivery mode and
  wake-up provenance so downstream logic can distinguish push, polling, and
  turn-boundary checks.
- Pass artifact IDs, commit SHAs, and bounded completion receipts in messages;
  do not treat free-form text as durable proof.

## Primary sources

- Repository at inspected revision: https://github.com/fujibee/agmsg/commit/ad5c13f88b6a3eb9674209e98e3b220be75c938f
- README and delivery/coordination limits: https://github.com/fujibee/agmsg/blob/ad5c13f88b6a3eb9674209e98e3b220be75c938f/README.md
- Message send path: https://github.com/fujibee/agmsg/blob/ad5c13f88b6a3eb9674209e98e3b220be75c938f/scripts/send.sh
- Recipient read/ack path: https://github.com/fujibee/agmsg/blob/ad5c13f88b6a3eb9674209e98e3b220be75c938f/scripts/inbox.sh
- Exclusive role claim: https://github.com/fujibee/agmsg/blob/ad5c13f88b6a3eb9674209e98e3b220be75c938f/scripts/actas-claim.sh
- Watcher and shared-cursor diagnostic: https://github.com/fujibee/agmsg/blob/ad5c13f88b6a3eb9674209e98e3b220be75c938f/scripts/watch.sh
- Feed checked: `https://api.github.com/search/repositories?q=topic%3Aai-agents+stars%3A%3E100&sort=updated&order=desc&per_page=10`
