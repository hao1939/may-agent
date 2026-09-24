<ai_context>
summary: "agmsg demonstrates that cross-vendor agent messaging can be a thin durable transport while leaving assignment, completion, and runaway control to a separate coordination plane. Its newer lock, liveness, and setup fixes add a second lesson: exclusive roles remain trustworthy only when ownership handoff is atomic, uncertain observations fail safe, and configured delivery is not confused with live receipt."
triggers: ["cross-vendor agent messaging", "agent transport", "coordination plane", "shared inbox", "task claim", "agent interoperability", "agmsg"]
last_updated: "2026-09-24"
source_basis: "GitHub repository search metadata and agmsg documentation and implementation at revisions ad5c13f88b6a3eb9674209e98e3b220be75c938f and e94ca9e0f4c40ebf3115dee8eb639f303c7f7a3f, including the lock-release, liveness-observation, and delivery-setup fixes released in v1.4.2."
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

## Follow-up: exclusive roles need atomic handoff and observable delivery

GitHub's current `topic:ai-agents pushed:>2026-09-23 stars:>30` search returned
agmsg again, now at release `v1.4.2` and inspected revision
`e94ca9e0f4c40ebf3115dee8eb639f303c7f7a3f`. Three fixes since the earlier
revision sharpen what the transport/coordination split requires below the task
layer:

- The registry lock formerly removed its directory before deleting a sibling
  holder file. A new acquirer could create its directory and holder between
  those operations, after which the old owner deleted the **new** holder and
  left an unidentifiable lock that blocked later joins. Commit
  `8f71cf266b3eae316c4acfb2b4493a44c60c40ee` now moves the current holder to a
  process-specific staging name while exclusion is still held, removes the lock
  directory, and either deletes the staged copy after success or restores it if
  release fails. The repository reports 0 failures in 90 concurrent-join runs
  with the fix versus 9 in 90 with the old ordering; this is project-reported
  regression evidence, not a Scout reproduction.
- Process-liveness checks had treated an empty or unreadable `ps` result as
  proof that an owner was dead, permitting a live owner's lock to be reclaimed.
  Commit `302adb52a933e8b058641eef3d9940095858b4be` introduces three outcomes:
  alive, proven dead, and unknown. A dead verdict now requires a completed
  process-table observation that also sees the caller's own PID as a canary;
  partial, failed, or canary-less observations preserve the owner. This favors
  temporary unavailability over split ownership when observation cannot prove
  absence.
- Delivery setup could fail to write a harness hooks file yet leave only a
  generic shell error, making a deaf seat resemble an empty inbox. Commit
  `2fd959c4611a4b6ad5ea120bf97c35060a43de63` now returns failure, names the
  unwritten hooks file, says delivery was not set up, and prints a safely quoted
  recovery command. The current README separately warns that a configured
  monitor mode does not prove the runtime monitor is active, so **configuration,
  live attention, and message receipt remain three different facts**.

Together these changes make role exclusivity an evidence protocol rather than
just a lock primitive: transfer the ownership witness before exposing the lock,
refuse to infer death from an inconclusive probe, and report delivery setup and
runtime health separately. The repository-authored Bats tests were inspected
but not run in this scan.

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
- Current inspected revision and v1.4.2 release: https://github.com/fujibee/agmsg/commit/e94ca9e0f4c40ebf3115dee8eb639f303c7f7a3f
- Atomic lock-release fix: https://github.com/fujibee/agmsg/commit/8f71cf266b3eae316c4acfb2b4493a44c60c40ee
- Fail-safe liveness observation: https://github.com/fujibee/agmsg/commit/302adb52a933e8b058641eef3d9940095858b4be
- Explicit delivery-setup failure: https://github.com/fujibee/agmsg/commit/2fd959c4611a4b6ad5ea120bf97c35060a43de63
- Current README delivery-health boundary: https://github.com/fujibee/agmsg/blob/e94ca9e0f4c40ebf3115dee8eb639f303c7f7a3f/README.md#delivery-modes
- Original feed checked: `https://api.github.com/search/repositories?q=topic%3Aai-agents+stars%3A%3E100&sort=updated&order=desc&per_page=10`
- Follow-up feed checked: `https://api.github.com/search/repositories?q=topic%3Aai-agents+pushed%3A%3E2026-09-23+stars%3A%3E30&sort=updated&order=desc&per_page=20`
