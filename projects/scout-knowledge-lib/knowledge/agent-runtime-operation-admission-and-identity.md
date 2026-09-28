<ai_context>
summary: "Companion to agent-runtime-effect-integrity.md for operation admission and identity: separating conversation from business transitions, live single-winner approval response, ownership claims, ambiguity-aware mutation review, centralized effect-mode derivation, pre-wait attempt journals, decision-time feedback binding, and durable receipt joins."
triggers: ["operation admission", "business operation boundary", "approval responder", "ownership claim", "mutation review", "effect mode", "provider attempt journal", "decision-time choice set", "receipt identity", "steering receipt"]
last_updated: "2026-09-28"
source_basis: "Extracted intact from agent-runtime-effect-integrity.md during its 2026-09-28 oversized-note review. Each section preserves stable source links, pinned revisions where applicable, reproduced checks where performed, and explicit evidence limitations."
</ai_context>

# Agent Runtime Operation Admission and Identity

**Companion note** to [Agent Runtime Effect Integrity](./agent-runtime-effect-integrity.md).

These patterns cover the boundary before and around effect admission: separating
conversation from deterministic operations, making approval answerable, claiming
ownership safely, preserving uncertainty under restricted modes, and joining
feedback or receipts to the exact operation identity that produced them.

## Separate Conversation From Business Operations Before Production — Reddit (September 2026)

A pseudonymous project author reports rebuilding a conversational car-rental
system's architecture three times over six months as it moved from testing
toward production. The post identifies the concrete failure questions that
forced the redesign: nearly simultaneous messages, a property-management-system
operation succeeding just before the local process fails, duplicate bookings,
unclear ownership of business decisions, and recovery after a partially
completed operation. The third architecture reportedly separates conversation
from critical operations and treats idempotency, concurrency, state, and failure
recovery as explicit concerns.

This is useful as a practitioner signal because the pressure came from connecting
conversation to consequential domain transitions—availability, prices, bookings,
changes, and cancellations—not from improving dialogue quality. The reusable
boundary is to let conversation propose and clarify an operation while a
deterministic service owns business invariants, operation identity, concurrency
control, durable state transitions, and reconciliation. A fluent demo does not
exercise the crash windows or competing requests that determine whether an
operational agent is safe to retry.

**Evidence boundary:** Scout read the complete author-written post body in
Reddit's current public Atom feed. The post provides no architecture diagram,
implementation, tests, incident log, or measurements, and Scout did not verify
the product or the claimed three rebuilds. Treat it as a self-reported production
design lesson that aligns with the stronger effect-integrity evidence elsewhere
in this note, not as proof that the current system prevents duplicate or partial
business effects.

- **Source:** https://www.reddit.com/r/sideprojects/comments/1wp5b90/ive_been_building_an_ai_system_for_6_months_and/
- **Stable post ID:** `t3_1wp5b90`
- **Coverage:** Full public Atom body; comments and implementation not reviewed
- **Observed:** 2026-09-24

## A Visible Approval Must Already Have a Live, Single-Winner Responder — ZCode (GitHub, September 2026)

ZCode's pinned agent runtime exposes a subtle approval-liveness failure and a
useful repair pattern. A comment in its current permission flow records the
prior ordering: the runtime emitted a permission request, then awaited a
`PermissionRequest` hook, and only afterwards registered the interactive
broker's response deferred. A synchronous hook used as an external approval
bridge could block while the confirmation UI was already visible. User clicks
then found no deferred, were treated as idempotent misses, and the turn could
hang permanently. This is an implementation comment about the repaired defect,
not an independently reproduced incident report.

At revision `872ad960de7ec172591f7e1952f7849229f94521`, the runtime races the
hook and broker responders. It starts the broker branch first, and the broker
contract requires its response channel to be registered synchronously. A
broker response first claims the result and aborts the hook; a hook decision
first resolves the race and aborts the broker. A hook that returns no decision
forfeits, while a hook exception is logged and leaves the user-facing broker
waiting rather than converting auxiliary infrastructure failure into approval
or denial. The winner is resolved before loser cancellation, so cleanup of a
stuck loser cannot delay the accepted decision.

The same flow handles another authority hazard: an approval hook can return a
modified tool input. ZCode normalizes and schema-validates that input, then
re-runs permission evaluation against the modified target. If the new target is
denied it stops; if it still requires approval it asks through the broker. This
prevents an approval for one path or scope from silently authorizing a
hook-rewritten one. The repository tree at this revision contains no core
permission test files (the only `*.test.ts`/`*.test.tsx` files found are in
service and UI packages), and Scout did not build or execute the 7,364-entry
monorepo. Treat these observations as static implementation evidence, not proof
that every UI transport registers at the exact visibility boundary or that the
race is free of all cancellation edge cases.

**Runtime rule:** make “visible” imply “answerable.” Register the authoritative
response channel before exposing an approval, give all legitimate responders a
single atomic claim on the decision, cancel but do not await losers, and define
how abstention and responder failure behave. If any responder can rewrite the
operation, normalize, validate, and re-authorize the rewritten input rather
than inheriting the original decision.

- **Repo:** https://github.com/zai-org/ZCode
- **Inspected revision:** [`872ad960de7ec172591f7e1952f7849229f94521`](https://github.com/zai-org/ZCode/commit/872ad960de7ec172591f7e1952f7849229f94521)
- **Primary sources:** [permission flow](https://github.com/zai-org/ZCode/blob/872ad960de7ec172591f7e1952f7849229f94521/apps/zcode-cli/packages/core/src/tool/executor/permission-flow.ts), [responder race](https://github.com/zai-org/ZCode/blob/872ad960de7ec172591f7e1952f7849229f94521/apps/zcode-cli/packages/core/src/tool/executor/permission-responder-race.ts), [modified-input recheck](https://github.com/zai-org/ZCode/blob/872ad960de7ec172591f7e1952f7849229f94521/apps/zcode-cli/packages/core/src/tool/executor/permission-input-recheck.ts), and [approval gate](https://github.com/zai-org/ZCode/blob/872ad960de7ec172591f7e1952f7849229f94521/apps/zcode-cli/packages/core/src/tool/executor/approval-gate.ts)
- **Discovery query:** GitHub Repository Search API `agent in:name,description created:>=2026-09-20`, sorted by stars; `total_count: 9843`, `incomplete_results: false`

## Atomic Replacement Is Not an Atomic Ownership Claim — agentsgo (GitHub, September 2026)

[agentsgo](https://github.com/urankwong/agentsgo) is a local-file protocol for
asynchronous multi-agent collaboration. Its strongest architectural choice is
to partition normal writes by agent: each participant writes its own round and
roster files, while a coordinator advances shared state. The project's own
retrospective records why this matters. Two entities once operated as the same
`agent-A`, overwrote the same status file, and risked overwriting the same round
submission. The incident led to a seat-claim protocol described as “first writer
wins” with optimistic locking and conflict evidence.

At pinned revision `360c8b9cffc6c86044ead9c59add1dafd598b0a6`, however, the
implementation does not yet enforce that claim. `claim_seat` reads an `invited`
status and its `updated` value, reads again to check that the timestamp did not
change, then uses `os.replace` to publish `joined`. Two contenders can both
complete the second read before either replacement. Replacement makes each
individual file publication indivisible, but it does not condition that write
on the version previously read; the later replacement can still overwrite the
earlier one. The post-write check only compares `state: joined` and a timestamp
with one-second resolution. It carries no claimant nonce, so two contenders in
the same second can observe indistinguishable state and both regard the claim
as successful.

The checked tests do not close this gap. One calls the claim function twice
sequentially, so the second sees an already-joined seat. Another injects a
changed timestamp between the two reads. Neither places two contenders past the
unchanged-version check before both write. There is an additional implementation
hazard: the agent-side writer uses the fixed sibling path `<status>.tmp`, so
concurrent claim attempts can also interfere with each other's temporary file.
Scout could not execute the repository's test suite because `pytest` is absent;
the finding is based on direct source and test inspection, not a reproduced
race or a claim about observed production behavior.

**Runtime rule:** single-writer partitioning only works after ownership is
established. The ownership transition itself needs a primitive with exclusive
or conditional semantics—for example, an `O_CREAT|O_EXCL` claim artifact, a
filesystem lock whose support and failure behavior are explicit, or a database
compare-and-swap transaction. Persist a unique claimant token and verify that
same token after acquisition. Atomic rename remains useful for preventing torn
file contents, but it is not a substitute for compare-and-swap, mutual
exclusion, or a unique-create operation.

- **Repo:** https://github.com/urankwong/agentsgo
- **Inspected revision:** [`360c8b9cffc6c86044ead9c59add1dafd598b0a6`](https://github.com/urankwong/agentsgo/commit/360c8b9cffc6c86044ead9c59add1dafd598b0a6)
- **Primary sources:** [seat-claim implementation](https://github.com/urankwong/agentsgo/blob/360c8b9cffc6c86044ead9c59add1dafd598b0a6/agent_loop.py), [protocol](https://github.com/urankwong/agentsgo/blob/360c8b9cffc6c86044ead9c59add1dafd598b0a6/protocol.md), [incident retrospective](https://github.com/urankwong/agentsgo/blob/360c8b9cffc6c86044ead9c59add1dafd598b0a6/docs/RETROSPECT-001.md), and [claim tests](https://github.com/urankwong/agentsgo/blob/360c8b9cffc6c86044ead9c59add1dafd598b0a6/tests/test_room.py)
- **Discovery query:** GitHub Repository Search API `"AI agent" in:name,description created:>=2026-09-20`, sorted by updated; `total_count: 1125`, `incomplete_results: false`

## Put Ambiguity Resolution and Mutation Review in the Interaction — Reddit (September 2026)

A current project-author [Reddit post](https://www.reddit.com/r/aiagents/comments/1wlr68r/i_built_an_ai_agent_that_can_actually_operate_my/)
describes an academic agent connected to 22 tools on a production classroom
SaaS. Its useful pattern is not the tool count or generated React itself, but
that the interaction changes shape according to the proposed effect. An
ambiguous lookup such as asking for the grade of a non-unique student produces
a selection component instead of a guess. A proposed score mutation produces a
confirmation view with the previous and new values; the author says the backend
does not mutate until confirmation and then records both values in an audit log.

This makes the UI part of the effect protocol rather than a decorative rendering
of chatbot text. A well-shaped interaction can expose the unresolved identity,
the exact delta, and the moment authority changes hands. The reusable sequence
is:

1. resolve target ambiguity before forming a mutation;
2. show the concrete old and proposed values at confirmation time;
3. keep execution behind a trusted backend gate rather than treating a rendered
   button as authority by itself; and
4. record the applied transition, including enough identity to distinguish the
   selected tenant and record.

The last two requirements are inferences, not verified properties of this
project. Agent-generated UI can improve review while also becoming a new attack
surface: the model could omit material scope, label an action misleadingly, or
submit a payload different from the preview. A production design should
therefore have trusted application code derive the confirmation from a frozen,
server-validated proposal, recheck tenant and record identity at apply time,
and bind the audit event to that same proposal and resulting state. Confirmation
clarity, authorization, concurrency control, and postcondition evidence remain
separate guarantees.

**Evidence boundary:** Scout read the complete post body from Reddit's current
public Atom feed. A direct public JSON request for the post returned HTTP 403,
so comments and implementation details were not reviewed. The application,
22-tool inventory, multi-tenant isolation, confirmation behavior, audit log,
and production deployment are unverified author claims; this is a
pseudonymous practitioner design signal, not a security assessment or evidence
that generated UI enforces the stated boundary.

- **Source:** https://www.reddit.com/r/aiagents/comments/1wlr68r/i_built_an_ai_agent_that_can_actually_operate_my/
- **Stable post ID:** `t3_1wlr68r`
- **Coverage:** Full Atom body; direct post JSON unavailable (HTTP 403)
- **Observed:** 2026-09-20

## Derive Effect Modes Once, Then Preserve What Became Unknown — SkillRanker (GitHub, September 2026)

[SkillRanker](https://github.com/Dicklesworthstone/skillranker) is a new Rust CLI
that ranks which agent skill should be used next. At pinned revision
`221494f3df8657901910f6b4b7f614872730f7ca`, its useful runtime pattern is not
the external ranking model but the local `EffectGate`. One validated policy
combines invocation flags such as offline, dry-run, no-persist, no-cache, and
no-ledger, then derives restrictions for every effect boundary: provider
network, unverified child processes, response cache, history ledger, and
cross-process coordination state. Conflicting modes are rejected rather than
silently normalized.

Two details make this stronger than scattering `if dry_run` checks through a
pipeline:

1. **The mode has observable semantics.** The gate emits a receipt naming each
   disabled store and the controlling restriction, whether network is blocked
   or still requires consent, whether unverified children are permitted, and
   whether the run is stateless. `--offline` blocks network without pretending
   that persistence is also off; `--dry-run` disables stores and network.
2. **Disabled evidence becomes unknown, not negative evidence.** If the ledger
   is unavailable, history is represented as `Withheld(restriction)`, not as an
   empty history, zero prior loads, or a negative observation. This prevents a
   privacy or no-persist choice from changing the ranking merely by fabricating
   an evidence-free baseline.

The checked pipeline consumes the same gate when selecting context sources,
opening the cache, and authorizing provider attempts. Provider authorization is
also refreshed immediately before each attempt, including retries, so changed
trusted configuration can supersede an earlier decision. The repository's
`effect_gate` tests enumerate all 128 flag combinations, reject 76 conflicting
ones, and exercise valid gates in both ranking and local-inspection scopes. They
include positive twins at real boundaries: filesystem state appears only when
cache access is enabled, and a loopback listener sees a socket only when network
consent is authorized.

**Runtime rule:** parse mode flags once into a typed capability object, pass
that object to effect-owning adapters, and serialize the effective mode in the
result. When a mode disables an evidence source, propagate “withheld” through
downstream logic instead of substituting an empty value. Test both sides of each
boundary—prohibited effects do not occur and permitted effects still can—across
the full flag matrix.

### Revision follow-up: journal irreversible attempt transitions before waiting

By revision `fba1991ae8908424a37579f69dcbf432e7ff885b`, SkillRanker adds a
second useful integrity pattern for provider calls. An `AttemptJournal` records
an admitted attempt before dispatch and records `reached_wire` in the transport
start callback, immediately before awaiting the response. The in-memory
provenance keeps admitted, sent, completed, failed, and discarded as distinct
outcomes; a sent attempt without a validated response has absent usage rather
than zero usage. Transport failures that started an HTTP attempt are likewise
classified as indeterminate, while failures established before dispatch remain
local and determinate.

The distinction matters at the process boundary. A project-authored integration
test waits for the fake provider itself to confirm it read a request, kills the
client while the provider withholds its response, and then checks that the
ledger still owns one `sent` attempt with a send time, no completion time, and
no token counts. This is stronger than finalizing accounting in a `finally` or
`Drop` path: a hard kill cannot execute cleanup, so the last durable write that
can establish possible cost must happen before the wait. Journal failure is
explicitly non-fatal to ranking, which preserves answer availability but means
the ledger is evidence when present, not a guaranteed billing record.

**Additional runtime rule:** persist the ownership and irreversible transition
of a remote attempt before entering the unbounded or killable wait. Do not turn
“request may have reached the provider, response never observed” into either
success, clean failure, or zero cost. Keep that outcome open until independent
reconciliation can close it.

### Revision follow-up: bind corrective feedback to the decision-time choice set

At revision `b66ddf7d0ee21497b1ef06adf09b5c7facecff45`, SkillRanker's local
feedback path also preserves what could actually have been recommended when the
ranking was made. Each event can reference a bounded roster snapshot containing
stable skill IDs, invocation names, content hashes, source, and historical
eligibility. This prevents a later roster from silently changing what a past
name meant or making a newly installed skill look like an alternative the
selector had missed.

The implementation distinguishes claims that need different evidence. A stable
ID found in a partial snapshot can support feedback about that exact member, but
an invocation name requires complete membership because an omitted skill may
share the name. A paired “use this instead” correction requires a complete
snapshot and resolves both references before writing either judgment. If the
alternative was present but ineligible, the correction is refused. If it was
absent, the system records a prospective proposal and writes neither the
negative label for the original nor a counterfactual positive label. The
project-authored tests check that an ambiguous name under partial coverage
leaves both the judgment count and store generation unchanged.

**Additional evaluation rule:** corrective feedback is evidence about a
historical decision only when it is joined to the decision-time candidate set,
stable identities, and eligibility. “A different skill is useful now” is not
proof that the old selector missed an available choice. Preserve incomplete
membership as unknown, and make multi-label corrections atomic so a failed
alternative lookup cannot leave a misleading standalone negative label.

This is implementation and project-authored test evidence from a young,
fast-changing repository. Scout did not run the Rust test suite; the assessment
is based on the pinned source and tests. The original effect-gate assessment
also found documentation drift: `docs/effect-gate.md` said no shipped command
read the gate while the earlier pinned `src/pipeline.rs` did. Treat these
patterns as concrete designs, not production validation or a claim that every
command has adopted them.

- **Repo:** https://github.com/Dicklesworthstone/skillranker
- **Original inspected revision:** [`221494f3df8657901910f6b4b7f614872730f7ca`](https://github.com/Dicklesworthstone/skillranker/commit/221494f3df8657901910f6b4b7f614872730f7ca)
- **Attempt-journal follow-up revision:** [`fba1991ae8908424a37579f69dcbf432e7ff885b`](https://github.com/Dicklesworthstone/skillranker/commit/fba1991ae8908424a37579f69dcbf432e7ff885b)
- **Feedback-snapshot follow-up revision:** [`b66ddf7d0ee21497b1ef06adf09b5c7facecff45`](https://github.com/Dicklesworthstone/skillranker/commit/b66ddf7d0ee21497b1ef06adf09b5c7facecff45)
- **Primary sources:** [effect gate](https://github.com/Dicklesworthstone/skillranker/blob/221494f3df8657901910f6b4b7f614872730f7ca/src/effects.rs), [pipeline integration and pre-attempt reauthorization](https://github.com/Dicklesworthstone/skillranker/blob/221494f3df8657901910f6b4b7f614872730f7ca/src/pipeline.rs), [flag-matrix and real-boundary tests](https://github.com/Dicklesworthstone/skillranker/blob/221494f3df8657901910f6b4b7f614872730f7ca/tests/effect_gate.rs), [attempt state and journal contract](https://github.com/Dicklesworthstone/skillranker/blob/fba1991ae8908424a37579f69dcbf432e7ff885b/src/jev/admission.rs), [retry-loop journal integration](https://github.com/Dicklesworthstone/skillranker/blob/fba1991ae8908424a37579f69dcbf432e7ff885b/src/jev/retry.rs), [hard-kill/reached-wire test](https://github.com/Dicklesworthstone/skillranker/blob/fba1991ae8908424a37579f69dcbf432e7ff885b/tests/ledger_attempt_recording.rs#L1000-L1084), [feedback and snapshot ledger logic](https://github.com/Dicklesworthstone/skillranker/blob/b66ddf7d0ee21497b1ef06adf09b5c7facecff45/src/storage/ledger.rs#L5209-L5804), and [snapshot-coverage regression tests](https://github.com/Dicklesworthstone/skillranker/blob/b66ddf7d0ee21497b1ef06adf09b5c7facecff45/tests/feedback_snapshot_coverage.rs)
- **Current discovery query:** GitHub Repository Search API `topic:ai-agents pushed:>2026-09-23 stars:>30`, sorted by updated; `total_count: 44`, `incomplete_results: false`

## A Receipt Must Join by Durable Identity, Not Resemblance — amux (GitHub, September 2026)

[amux](https://github.com/mixpeek/amux) exposes a concrete failure mode in
agent-to-agent steering: recording the command and recording its delivery can
race across a restart, while the same text may legitimately be sent more than
once. At pinned revision `2b8baa28f1a7ab4512280416399b58d68848dd08`, its
steering receipt migration joins the user-visible history row to delivery
history with a unique queue ID. A database trigger settles the history row in
the same transaction that inserts the delivery outcome. A second trigger
handles the opposite ordering—delivery history may already exist when the
history row is linked—and derives the same `confirmed`, `retried`, `voided`, or
`uncertain` presentation.

The migration's legacy repair is deliberately weaker. It matches session, exact
text, and enqueue time only when those fields identify exactly one unlinked
receipt and one queued message. Ambiguous duplicates remain unknown rather than
being attached to whichever similar row is found first. An earlier migration
also changes redelivery behavior by claiming a queue row before sending: a crash
can then leave a visible, reconcilable gap instead of leaving an unclaimed row
that will certainly be sent again. This does not create exactly-once delivery;
a crash after the claim and around the send still needs reconciliation.

The repository's newer durable-message API applies the same separation at the
semantic layer. Message creation persists the body first and queues only its ID,
using `deliver-<message-id>` as the queue idempotency key. Delivery then advances
forward through queued, delivered, acknowledged, and acted-on; it may skip a
stage when stronger evidence is observed, but it cannot move backward or
re-stamp a stage. Group delivery fans out to a distinct child message and
receipt per recipient instead of promoting one group-level “sent” claim. An
`acted_on` receipt may carry the task opened because of the message, preserving
a causal link without pretending that delivery itself proves work happened.

**Runtime rule:** give the intended message, each delivery attempt, each
recipient, and any resulting work stable but distinct identities. Join receipts
on those identities inside the transaction that records the observation, and
make late-arriving links settle from durable history. Similar text and nearby
timestamps are repair hints, not identity; only use them when uniqueness is
proved, otherwise retain unknown. A pre-send claim prevents automatic duplicate
replay but turns the crash window into an explicit reconciliation obligation—it
must not be reported as confirmed delivery.

This is static implementation and project-authored test evidence from a rapidly
changing repository. Scout inspected the complete pinned tree, migration SQL,
message model/API, a delivery-metadata UI test, and one live lifecycle test, but
did not build amux or run those tests. The live test is evidence of the project's
intended end-to-end check, not an independently reproduced delivery guarantee.

- **Repo:** https://github.com/mixpeek/amux
- **Inspected revision:** [`2b8baa28f1a7ab4512280416399b58d68848dd08`](https://github.com/mixpeek/amux/commit/2b8baa28f1a7ab4512280416399b58d68848dd08)
- **Primary sources:** [receipt identity and race-settling triggers](https://github.com/mixpeek/amux/blob/2b8baa28f1a7ab4512280416399b58d68848dd08/crates/amux-server/migrations/0086_steering_message_receipts.sql), [pre-send delivery claim](https://github.com/mixpeek/amux/blob/2b8baa28f1a7ab4512280416399b58d68848dd08/crates/amux-server/migrations/0064_steering_delivery_claim.sql), [durable message and forward-only state model](https://github.com/mixpeek/amux/blob/2b8baa28f1a7ab4512280416399b58d68848dd08/crates/amux-core/src/message.rs), [message persistence and per-recipient queueing](https://github.com/mixpeek/amux/blob/2b8baa28f1a7ab4512280416399b58d68848dd08/crates/amux-server/src/api/messages.rs), [delivery-metadata surface test](https://github.com/mixpeek/amux/blob/2b8baa28f1a7ab4512280416399b58d68848dd08/e2e/messages-delivery-metadata.spec.ts), and [live steering lifecycle test](https://github.com/mixpeek/amux/blob/2b8baa28f1a7ab4512280416399b58d68848dd08/e2e/lifecycle/live-steering-pickup.spec.ts)
- **Discovery query:** GitHub Repository Search API `topic:ai-agents pushed:>2026-09-23 stars:>30`, sorted by updated; `total_count: 227`, `incomplete_results: false`

