<ai_context>
summary: "Companion to agent-runtime-hardening.md for core effect integrity: revision-bound workspace admission, evidence-carrying closure, quarantine for unknown effects, operation identity across replanning, transactional review versus atomic commit, guarded writes, apply-time revalidation, session-bound retry safety, observation-bound handover, history/context separation, and externally anchored sandbox authority."
triggers: ["runtime effect integrity", "revision-bound admission", "effect closure", "unknown effect", "operation identity", "replanning retry", "resource quarantine", "atomic commit", "guarded configuration write", "previewable plan", "ambiguous delivery", "forward-only delivery", "reached wire", "unknown usage", "AID-Guard", "outbound publication", "remote session retry", "desktop handover", "history fidelity", "safe resume", "sandbox escape", "external authority"]
last_updated: "2026-09-28"
source_basis: "Extracted from agent-runtime-hardening.md during its oversized-note review and subsequently updated with source-grounded findings, including SkillRanker's pre-wait provider-attempt journal and decision-time feedback snapshots, amux's identity-bound steering receipts, and Apache Maka's transactional tool ledger. Each retained section preserves stable source links, pinned revisions where applicable, reproduced checks where performed, and explicit evidence limitations. Unattended-execution, replay, approval-resume, settlement, accountable-write, and desktop-authorization sections moved intact to agent-runtime-unattended-execution-and-replay.md during the 2026-09-21 oversized-note review. Operation admission, ownership, effect-mode, feedback-binding, and receipt-identity sections moved intact to agent-runtime-operation-admission-and-identity.md during the 2026-09-28 oversized-note review."
</ai_context>

# Agent Runtime Effect Integrity

**Companion note** to [Agent Runtime Hardening](./agent-runtime-hardening.md).
Verification and verdict-integrity patterns live in
[Agent Runtime Verdict Integrity](./agent-runtime-verdict-integrity.md). Unattended
execution, replay, and settlement patterns live in
[Agent Runtime Unattended Execution and Replay](./agent-runtime-unattended-execution-and-replay.md). Operation admission, ownership, mode derivation, and receipt identity live in
[Agent Runtime Operation Admission and Identity](./agent-runtime-operation-admission-and-identity.md).

These patterns cover the boundary after an agent has been granted execution:
which revision enters a persistent workspace, what evidence closes an effect,
what work a verification receipt actually proves, and where an unattended
sandbox's trust boundary ends.

## Separate Conversation From Business Operations Before Production — Reddit (September 2026)

Moved intact to [Agent Runtime Operation Admission and Identity](./agent-runtime-operation-admission-and-identity.md#separate-conversation-from-business-operations-before-production--reddit-september-2026).

## A Visible Approval Must Already Have a Live, Single-Winner Responder — ZCode (GitHub, September 2026)

Moved intact to [the companion section](./agent-runtime-operation-admission-and-identity.md#a-visible-approval-must-already-have-a-live-single-winner-responder--zcode-github-september-2026).

## Atomic Replacement Is Not an Atomic Ownership Claim — agentsgo (GitHub, September 2026)

Moved intact to [the companion section](./agent-runtime-operation-admission-and-identity.md#atomic-replacement-is-not-an-atomic-ownership-claim--agentsgo-github-september-2026).

## Put Ambiguity Resolution and Mutation Review in the Interaction — Reddit (September 2026)

Moved intact to [the companion section](./agent-runtime-operation-admission-and-identity.md#put-ambiguity-resolution-and-mutation-review-in-the-interaction--reddit-september-2026).

## Derive Effect Modes Once, Then Preserve What Became Unknown — SkillRanker (GitHub, September 2026)

Moved intact to [the companion section](./agent-runtime-operation-admission-and-identity.md#derive-effect-modes-once-then-preserve-what-became-unknown--skillranker-github-september-2026).

### Revision follow-up: journal irreversible attempt transitions before waiting

Moved intact to [the companion subsection](./agent-runtime-operation-admission-and-identity.md#revision-follow-up-journal-irreversible-attempt-transitions-before-waiting).

### Revision follow-up: bind corrective feedback to the decision-time choice set

Moved intact to [the companion subsection](./agent-runtime-operation-admission-and-identity.md#revision-follow-up-bind-corrective-feedback-to-the-decision-time-choice-set).

## A Receipt Must Join by Durable Identity, Not Resemblance — amux (GitHub, September 2026)

Moved intact to [the companion section](./agent-runtime-operation-admission-and-identity.md#a-receipt-must-join-by-durable-identity-not-resemblance--amux-github-september-2026).

## Revision-Bound Workspace Admission (Cross-Source, August 2026)

Three independent signals move execution authority beyond a single invocation:

- [Programmatic tool calling](./findings/2026-08-07-arxiv-programmatic-tool-calling.md)
  turns a tool interface into generated control flow that can chain and
  parallelize effects.
- [AWS AgentCore runtime instances](./findings/2026-08-07-hn-agentcore-persistent-runtime.md)
  make files, processes, dependencies, and co-resident agents persist for up to
  14 days.
- [shuohao-skills](./findings/2026-08-07-github-shuohao-skill-selftests.md)
  shows a portable skill with deterministic tests, but also a symlink-based
  install path where a later pull can change the executable skill immediately.

**Combined implication:** per-call authorization is necessary but no longer
sufficient. When generated programs and updateable skills operate inside a
persistent workspace, one admitted revision can leave artifacts or processes
that affect later calls and other agents. Trust must therefore bind the
**revision, verification result, workspace generation, and expanded effect
trace** together—not merely approve the current tool invocation.

A hardened admission path should:

1. resolve skills and helpers to immutable revisions;
2. run declared deterministic checks before activation;
3. create a new workspace generation or checkpoint for the admitted revision;
4. keep per-effect authorization and expand programmatic calls into replayable
   individual effects;
5. record which revision produced each durable artifact or process; and
6. support atomic rollback of both executable content and affected workspace
   state.

This is a design inference across the three sources, not a reported benchmark
result. The arXiv note is abstract-level evidence, the AWS item is a product
announcement with minimal HN validation, and the GitHub evidence is limited to
one checked repository revision.

## Evidence-Carrying Effect Closure (Cross-Source, August 2026)

Two early implementations in different effect domains expose the same runtime
boundary:

- [Limioryn](./findings/2026-08-08-github-limioryn-evidence-carrying-actuation.md)
  ranks evidence from transport through physical effect and business outcome;
  an acknowledgement cannot establish an effect above the layer actually
  observed.
- [Countersign](./findings/2026-08-08-cross-rail-kill-switch-evidence.md)
  distinguishes a dispatched freeze from a confirmed stop, preserves each
  provider's outcome, escalates uncertain cases to session revocation, and
  keeps unresolved agents in a `still_dangerous` set.

**Combined implication:** effectful runtimes need a closure contract, not a
success boolean. Every operation should declare the intended target set, the
strongest claim required for completion, acceptable evidence and freshness,
and the response to ambiguity. Transport success, application acceptance,
actuator state, external effect, and business outcome are different claims;
none should be silently promoted to the next.

This separation also governs retries and emergency controls. Lost
acknowledgement after a non-repeatable effect may make retry unsafe, while an
unconfirmed emergency stop must remain open and escalate. A useful result type
therefore carries per-target claim level, evidence provenance, uncertainty,
retry safety, escalation attempted, and unresolved targets. Semantic closure
occurs only when all intended targets meet the required evidence level or a
named owner explicitly accepts the residual risk.

Audit evidence remains separate from effect evidence: a signed append-only
record can prove what the control plane recorded without proving that a vendor,
device, or physical process actually changed. Both projects are low-adoption,
early implemented signals rather than production-safety evidence: Limioryn's
baseline is deterministic rather than hardware-in-the-loop, and Countersign's
public controller excludes proprietary production adapters and is described as
testnet-only.

## An Unknown Effect Must Quarantine Its Resource — AI Control Center (GitHub, September 2026)

AI Control Center makes crash ambiguity a property of the affected resource, not
just of the task that issued a call. Each tool operation atomically acquires its
sorted resource set under a unique call identity and records a `running` call
before dispatch. If the worker survives cancellation or its deadline, the gate
marks it `stopping` and retains those locks. On a later restart, the lock reaper
does not infer that a dead dispatcher stopped an external editor or service: it
changes `running` or `stopping` to `unknown`, converts every lock for that call
into an owner-independent reservation with no ordinary lease expiry, and emits a
`tool.stopping` event that requires reconciliation.

This closes an availability-oriented recovery error: refusing continuation of the
original task is insufficient if a different task can acquire the same application
and dispatch a conflicting effect. The project-authored tests reopen the database
with a fake dead owner, verify that all exact resources remain reserved, block an
unrelated task from the same application, and still admit work on another resource.
They also check that repeated reaping does not duplicate the stopping event and that
the status change, reservation conversion, and audit append roll back together if
the audit write fails.

**Runtime rule:** uncertainty should carry a precise exclusion set. When an effect
may have outlived its dispatcher, persist the call as unknown and quarantine the
smallest resources on which a conflicting call would be unsafe. Process death,
timeout, lease expiry, or a missing response must not release that exclusion.
Unrelated resources should remain available, and repeated observation should not
manufacture duplicate incident facts.

The pattern is conservative containment, not settlement. The repository explicitly
ships no model tool, endpoint, automatic retry, or automatic reconciler for unknown
calls; safe release still requires effect-specific inspection and an explicit state
change. A resource reservation cannot establish whether the effect happened, undo
it, or determine the right postcondition. The generic internal lock-release method
also does not itself validate call settlement, so safety depends on keeping release
behind a trusted reconciliation path rather than exposing it as ordinary agent
authority.

This is a very new, zero-star repository at retrieval. Scout inspected pinned source
and project-authored tests. The focused tests were not executed because the supplied
environment lacked the `pytest` module, so this is implementation and test-design
evidence rather than an independent reliability or security validation.

- **Repo:** https://github.com/RonanCorey/ai-control-center
- **Inspected revision:** [`c00ab34426b6422ad091cc5c38fdef365f2e769e`](https://github.com/RonanCorey/ai-control-center/commit/c00ab34426b6422ad091cc5c38fdef365f2e769e)
- **Primary sources:** [uncertain-resource contract](https://github.com/RonanCorey/ai-control-center/blob/c00ab34426b6422ad091cc5c38fdef365f2e769e/docs/uncertain-resource-reservations.md), [lock reaper and reservations](https://github.com/RonanCorey/ai-control-center/blob/c00ab34426b6422ad091cc5c38fdef365f2e769e/core/locks.py), [gate dispatch and uncertainty handling](https://github.com/RonanCorey/ai-control-center/blob/c00ab34426b6422ad091cc5c38fdef365f2e769e/core/gate.py), and [restart/rollback tests](https://github.com/RonanCorey/ai-control-center/blob/c00ab34426b6422ad091cc5c38fdef365f2e769e/tests/test_uncertain_locks.py)
- **Discovery query:** GitHub Repository Search API `"AI agent" "security" created:>2026-09-16`, sorted by updated; `incomplete_results: false`

## Transactional Review Is Not the Same as Atomic Commit — Overlord (HN / GitHub, September 2026)

Overlord is an early Linux “agent hypervisor” that gives a command a writable
overlay over a target directory, records its changes, and exposes an explicit
commit or rollback decision. The checked implementation has several concrete
protections: jailed agent mode uses namespace and overlay primitives; commit
checks touched paths against the initial size-and-mtime manifest; protected
harness files require a fresh complete countersignature; replay validates every
destination before mutation to reject symlink escapes; and MCP connectors are
explicitly classified as host-side external actions that cannot be undone by
discarding the filesystem session. Its audit chain uses an HMAC key and can
optionally pin the signed head to an off-box witness.

Those controls make **review before publication** and **atomic publication** easy
to confuse. The README says changes commit “all or nothing,” but the pinned commit
path calls `apply_layers`, which copies, removes, and replaces target entries one
at a time. There is no staging-tree swap, write-ahead recovery record, or exception
handler that restores already-applied entries if a later filesystem operation
fails. `rollback_session` deletes the pending overlay; it does not reverse target
writes already made by a failed commit attempt.

A narrow injected-failure check reproduced the boundary. Scout ran the repository's
`replay_safety_test.py` successfully, confirming that invalid destinations are
rejected before replay and that a leaf symlink is replaced rather than followed.
Scout then applied an upper layer containing `a.txt` and `b.txt` while injecting an
`OSError` on the second `_copy_entry`: `a.txt` remained in the real target while
`b.txt` was absent. This is not a claim about how often ordinary filesystems fail,
but it disproves an unconditional all-or-nothing commit guarantee at the inspected
revision.

**Runtime rule:** label the guarantees separately. Overlay execution can keep
unreviewed writes away from the base tree; preflight can reject known drift and
unsafe destinations before the first write; review can authorize an exact diff;
and a keyed log can preserve accountable history. None makes a multi-file publish
atomic. An all-or-nothing claim additionally needs an atomic namespace switch or a
durable apply/undo protocol with crash recovery, followed by a post-commit check.
External connector effects remain outside even that filesystem transaction and
need their own settlement and reconciliation semantics.

This is source inspection and a local failure injection against a very new,
low-adoption repository (two GitHub stars and an HN item with three points and no
comments at retrieval), not a full security audit or production reliability
assessment. The pure replay-safety test ran in Scout's environment; kernel jail,
AppArmor, network isolation, daemon policy, and live connector behavior were not
exercised.

- **HN:** https://news.ycombinator.com/item?id=49735668
- **Repo:** https://github.com/B1tR0n1n/overlord
- **Inspected revision:** [`7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3`](https://github.com/B1tR0n1n/overlord/commit/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3)
- **Primary sources:** [commit and replay implementation](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/overlord.py), [connector boundary](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/mcp.py), [keyed audit chain](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/audit.py), [replay-safety tests](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/test/replay_safety_test.py), and [integration guide](https://github.com/B1tR0n1n/overlord/blob/7572a9b6749ddeeb686b5bcc089cd8a6d5cd3da3/docs/INTEGRATION.md)

## A Safe Configuration Write Needs Four Different Proofs — n8n-mcp-guard (GitHub, September 2026)

`n8n-mcp-guard` turns agent edits to live n8n workflows into a concrete
plan/apply protocol. Planning reads the live workflow, computes a reviewable
diff, records both the platform version and a behavioral fingerprint, and
writes a checksum-verified backup before returning a short-lived plan. Applying
then re-reads the workflow and refuses the write if either version or
fingerprint moved, refuses if the exact-version backup is missing or damaged,
and reads the saved workflow back to compare it with the planned target.
Consumed plans are deleted, so the same in-process authority cannot be applied
twice.

The implementation is useful because its checks answer four distinct questions:

1. **Was this change reviewed?** The diff and target are frozen into the plan.
2. **Is the write still based on current state?** Version plus behavioral hash
   detect both ordinary edits and content drift under an unchanged version ID.
3. **Is the prior state recoverable?** Apply requires a readable backup whose
   definition hash matches its contents and whose workflow/version identity
   matches the planned base.
4. **Did the configuration service store the intended graph?** A post-write GET
   must match the target fingerprint rather than trusting the PUT response.

That composition is stronger than calling the whole operation “two-phase
commit”: it combines review binding, optimistic concurrency, rollback evidence,
and postcondition checking. Each check covers a different failure, so one
cannot substitute for another. In particular, a valid backup does not prove the
live state is unchanged, and a successful API response does not prove the
intended graph was persisted.

The boundary is narrower than workflow correctness or durable distributed
transactions. Plans live only in an in-memory map for 30 minutes; the behavioral
signature covers workflow name, nodes, credential bindings, and connections but
intentionally excludes activation state and other metadata; backups are local
files that may contain production configuration; and readback proves stored
configuration, not downstream effects. The repository reports 68 unit tests, a
live integration suite, and a 99-workflow validation corpus, but Scout inspected
source and project-authored tests rather than rerunning those claims. Publication
of an active workflow also remains an external-effect boundary that may need
separate reconciliation if its response is lost.

**Runtime rule:** admit an agent-authored configuration change only when review
identity, current-base identity, recovery evidence, and observed postcondition
are independently represented. Call the result “stored as intended,” not
“worked as intended,” unless execution outcomes are observed too.

- **Repo:** https://github.com/FarazHayder/n8n-mcp-guard
- **Inspected revision:** [`7ec7c7daa556f98803c11b346a268282b0889d94`](https://github.com/FarazHayder/n8n-mcp-guard/commit/7ec7c7daa556f98803c11b346a268282b0889d94)
- **Primary sources:** [guarded plan/apply implementation](https://github.com/FarazHayder/n8n-mcp-guard/blob/7ec7c7daa556f98803c11b346a268282b0889d94/src/n8n/guardedUpdate.ts), [behavioral fingerprint](https://github.com/FarazHayder/n8n-mcp-guard/blob/7ec7c7daa556f98803c11b346a268282b0889d94/src/n8n/graph.ts#L123-L148), [backup verification](https://github.com/FarazHayder/n8n-mcp-guard/blob/7ec7c7daa556f98803c11b346a268282b0889d94/src/n8n/backup.ts), and [guard tests](https://github.com/FarazHayder/n8n-mcp-guard/blob/7ec7c7daa556f98803c11b346a268282b0889d94/test/unit/guardedUpdate.test.ts)
- **Discovery query:** GitHub Repository Search API `"AI agent" (security OR sandbox OR evaluation OR observability) created:>=2026-09-11`, sorted by stars; `incomplete_results: false`

## A Previewable Plan Is Not a Write Capability — AnkiBridge (GitHub, September 2026)

AnkiBridge's plan/apply boundary treats saved JSON as an untrusted request to
re-evaluate, not as authority inherited from an earlier preview. Planning
produces readable old/new field values, tags, stable identity and target deck.
At apply time, the service checks the current write policy again; rejects delete
operations and unknown note types even if they were forged into the plan;
verifies unique stable identity and note type; reads **all actual decks** that
contain the note; and requires those memberships to match the plan. It also
compares each current field or tag set with both the recorded previous value and
the intended value. Exact replay can therefore settle as a no-op, while a third
value proves intervening change and forces replanning.

The audit sequence exposes a second boundary. The service writes a `started`
record before calling Anki and a `succeeded` record afterwards. A connection
error is labeled outcome-unknown and stops later writes; if the effect executes
but final audit logging fails, the returned item is changed to failure and the
batch stops pending reconciliation. This is weaker than a transaction, but
stronger than either blindly replaying the whole batch or treating a missing
response as no effect.

**Operational implication:** a reviewable plan should bind what the human saw,
but write authority and current-world assumptions must still be checked at the
effect boundary. Revalidation should cover target scope, object identity,
resource memberships and the exact prior values that make the proposed diff
safe; replay semantics and unknown-outcome semantics are separate controls.

The limits are material. The repository's MCP approval token, plan store,
writer lock and pre-apply backup are design proposals, not shipped features.
The implemented service has no cross-call Anki transaction or durable
collection/profile identity, and another client can still race it. Its default
`dry_run=True` returns without checking live preconditions, so it is not an
applicability proof. Scout inspected source and repository-authored tests but
did not run them or use a personal Anki collection. The repository was created
on 2026-09-17 and had four stars at retrieval.

- **Repo:** https://github.com/MrChalo69/ankibridge-oss
- **Inspected revision:** [`16270229942b761d8ca9833b85460d732a4f01dd`](https://github.com/MrChalo69/ankibridge-oss/commit/16270229942b761d8ca9833b85460d732a4f01dd)
- **Primary sources:** [architecture and transaction limits](https://github.com/MrChalo69/ankibridge-oss/blob/16270229942b761d8ca9833b85460d732a4f01dd/docs/ARCHITECTURE.md), [plan/apply service boundary](https://github.com/MrChalo69/ankibridge-oss/blob/16270229942b761d8ca9833b85460d732a4f01dd/src/ankibridge/service.py), [safety tests](https://github.com/MrChalo69/ankibridge-oss/blob/16270229942b761d8ca9833b85460d732a4f01dd/tests/test_service_safety.py), and [unimplemented MCP approval design](https://github.com/MrChalo69/ankibridge-oss/blob/16270229942b761d8ca9833b85460d732a4f01dd/docs/MCP_DESIGN.md)
- **Discovery query:** GitHub Repository Search API `"AI agent" created:>2026-09-16`, sorted by stars; `incomplete_results: false`

## Retry and Recovery Are Authority Transitions — AID-Guard (arXiv, August 2026)

AID-Guard sharpens effect closure around a failure that ordinary authorization
and idempotency leave open. A request can still change after admission, and a
provider can apply an effect even when its response is lost. If recovery then
mints fresh authority, a delayed predecessor and its replacement can both act
under one user approval. Independent idempotency keys do not couple those two
attempts, while a provider receipt alone does not identify the delegation that
authorized the effect.

The proposed protocol keeps one durable **reservation lineage** from approval
through provider settlement:

1. trusted services freeze the approved request and bind it to durable authority;
2. repeated checkpoints revalidate mutable dependencies, quota, session, and
   boundary state;
3. provider dispatch revalidates the exact request and current provider state at
   commit;
4. response loss leaves the reservation charged and ambiguous rather than
   authorizing a blind retry; and
5. release or one named successor is possible only after scoped certified-no-effect
   evidence and a delivery fence that makes the predecessor terminal through the
   declared recovery horizon.

This adds a missing rule to crash-safe continuation: an indeterminate effect is
not just parked execution—it is still consuming authority. Evidence can close or
reconcile that lineage but cannot itself create executable authority. Providers
without atomic commit or durable, body-bound idempotency plus terminal lookup
remain eligible only for conservative submission: ambiguity stays charged, with
no automatic retry or replacement.

The prototype reported 210 predeclared Stripe contract trials, 40
terminalize-then-successor schedules across two SaaS providers, 30 overlapping
Stripe confirm/cancel races, and 10 Stripe crash-recovery schedules without a
duplicate effect. It also blocked 44/44 attacks under complete proposer
compromise while admitting 44/44 matched legitimate proposals. This security
came with a visible utility cost: the strict exact-manifest profile reduced
benign utility by 35.4–43.8 percentage points; a typed three-call variant
recovered 9–10 completions in a separate no-seed comparison, with no observed
unsafe effect across 864 episodes.

The claim is conditional, not a general exactly-once guarantee. The prototype
used synthetic credentials on a trusted host, one enumerable loopback domain,
test-mode Stripe and sequential Resend schedules, and a declared effect-path
inventory that it verifies but does not discover. Finite races do not cover all
network interleavings or establish provider guarantees. Production use therefore
needs attested route inventory and provider-specific terminalization; omitted
egress or credential paths invalidate the boundary rather than becoming
protected effects.

- **Source:** https://arxiv.org/abs/2608.21159v1
- **Full paper:** https://arxiv.org/html/2608.21159

## Unknown Must Survive Replanning — HN / Josh C. Simmons (September 2026)

An HN-linked essay isolates a practical way an otherwise correct idempotency
scheme can fail: an HTTP client may reuse the provider key when it retries, but
an agent that reasons about the timeout again can emit a new tool call with a
new key. Every layer then follows its local contract while one user-authorized
operation becomes two remote effects. The article's deterministic Python
example makes this distinction visible: a simulated service commits a ticket
and drops the first response; retrying with the same operation key leaves one
ticket, while a newly minted key after replanning leaves two.

Scout ran the supplied example and reproduced its three assertions: two tickets
without provider deduplication, one with the same operation key, and two with a
new key after replanning. This is a didactic, single-threaded in-memory model. It
assumes the ticket write and deduplication record are indivisible and does not
measure model behavior, network failure frequency, database crash safety, or a
production provider.

The useful refinement is that **operation identity belongs to the authorized
effect, not to one model turn, tool-call message, worker, or retry attempt**.
Create the operation record before dispatch; bind it to the actor, target, and
resolved arguments; retain it across restart and delegation; and give each send
a separate attempt ID without changing the provider-facing operation key. A
transport timeout should move that operation to `unknown`, not `failed`. The
next action must then be effect-specific reconciliation or a bounded retry of
the same operation where the provider contract supports it—not a fresh create.

Readback is not automatically certified absence. A negative search can be stale,
scoped to the wrong account, or race an in-flight write. Likewise, a provider's
idempotency retention window can expire before an agent resumes. The runtime
therefore needs to preserve both the operation identity and the limits of the
evidence that can settle it. If neither safe same-key repetition nor conclusive
inspection exists, unresolved uncertainty should remain visible to the user
rather than being hidden by optimistic replanning.

This practitioner essay largely synthesizes established distributed-systems and
HTTP guidance, so it is not evidence that deployed agents commonly duplicate
these effects. Its contribution is the agent-specific boundary between a
transport retry and a semantically new tool call, plus an executable negative
control for that boundary. The HN item had one point and no comments at
retrieval.

- **HN:** https://news.ycombinator.com/item?id=49785337
- **Source:** https://www.drjoshcsimmons.com/writing/your-agent-needs-an-unknown-state
- **Runnable example:** https://www.drjoshcsimmons.com/examples/agent-retry-demo.py
- **Referenced standards and operational guidance:** [HTTP retry rules](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2), [AWS idempotent API guidance](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/), [Temporal Activity idempotency](https://docs.temporal.io/activity-definition#idempotency), and [Stripe idempotency keys](https://docs.stripe.com/api/idempotent_requests)
- **Coverage:** complete article, linked runnable example, local execution of the example, and HN item metadata; no HN comments were present

## A Local Posting Claim Does Not Close an External Publication — PR Cockpit (GitHub, August 2026)

PR Cockpit offers a unusually concrete human gate for AI-authored pull-request
reviews. Review agents run read-only in isolated worktrees; a person selects
findings; a dry-run assembles the exact GitHub review; and only a separate
publish action performs the outbound write. The implementation also hashes the
selected findings, recheck verdicts, notes, head SHA, provider, and model so an
unchanged preview can be reused rather than regenerated at publication time.

Its concurrency control is strong **inside the local database boundary**. A
real publish compare-and-sets the review from a postable state to `posting`
before any await, blocking concurrent publish, rerun, and recheck paths. After
GitHub returns, the endpoint records the post locally and settles the state to
`posted`. Failed assembly or submission restores the prior local state. The
GitHub helper also clears the caller's leftover `PENDING` review before posting
and retries a known 422 line-mapping failure by collapsing inline comments into
one summary review.

The source exposes the remaining external-effect gap. GitHub publication is a
single `POST .../pulls/{number}/reviews` with no application idempotency key. If
GitHub accepts that review but the response is lost, times out, or the process
dies before the local `posts` insert, recovery has only a local `posting` row
(or a restored pre-post state) and no recorded remote review ID. A retry can
therefore publish the same review twice. Deleting `PENDING` reviews does not
reconcile this case because the request uses `event: COMMENT`, which submits the
review rather than leaving it pending.

**Runtime rule:** human confirmation, stable preview, and a local compare-and-set
solve three different problems—authorization, content drift, and concurrent
callers—but not ambiguous remote completion. An outbound publication path also
needs a durable dispatch identity and effect-specific reconciliation:

1. persist a content signature and dispatch attempt before crossing the remote
   boundary;
2. attach a stable, machine-readable marker to the remote object where the API
   lacks native idempotency;
3. after timeout or restart, query the remote system for that marker before
   authorizing another post;
4. classify the attempt as posted, certified absent, or indeterminate; and
5. permit retry only after absence is established, while retaining the original
   human approval and exact preview binding.

This is source inspection of an active repository, not an observed duplicate or
reliability benchmark. GitHub API metadata reported 164 stars and two forks at
retrieval. The code demonstrates careful local exclusion and makes the narrow
crash/response-loss window legible; it does not establish that the window has
occurred in production.

- **Repo:** https://github.com/taovc/pr-cockpit
- **Inspected revision:** https://github.com/taovc/pr-cockpit/commit/5b8ccc8c511ad3393b339e51dde68fcb3edee684
- **Primary sources:** [architecture contract](https://github.com/taovc/pr-cockpit/blob/5b8ccc8c511ad3393b339e51dde68fcb3edee684/docs/ARCHITECTURE.en.md), [publication endpoint](https://github.com/taovc/pr-cockpit/blob/5b8ccc8c511ad3393b339e51dde68fcb3edee684/server/api/reviews/%5Bid%5D/post.post.ts), and [GitHub posting helper](https://github.com/taovc/pr-cockpit/blob/5b8ccc8c511ad3393b339e51dde68fcb3edee684/core/github/post.ts)
- **Discovery feed:** https://api.github.com/search/repositories?q=topic%3Aai-agents&sort=updated&order=desc&per_page=30

## Retry Safety Must Travel With the Remote Session — YourDesk (GitHub, September 2026)

YourDesk exposes remote desktops and interactive terminals through MCP, making a
useful distinction between **caller admission**, **session authority**, and
**effect replay**. Its HTTP boundary checks the direct peer address, applies either
an IP allowlist or a bearer token, rejects browser-origin requests, caps concurrent
requests, and bounds bodies and server timeouts. Remote operations then require a
connected session; terminal calls additionally require an MCP-owned connection and
the latest instance identifier, so a stale call cannot silently attach to a newly
established shell.

The stronger signal is inside the terminal protocol. Each input has a monotonically
increasing sequence number. The remote session rejects gaps and suppresses a repeated
sequence that it has already accepted, while output remains pending until the client
acknowledges its sequence. This gives retries a stable identity within one live
session instead of treating a transport timeout as permission to submit new input.
The MCP layer reinforces the rule: a timed-out operation tells the caller to inspect
remote state rather than resend, and the repository documentation says a retry of
the same terminal input must keep the original sequence and payload.

That mechanism is deliberately narrower than exactly-once effects. A separate
`run_remote_shell` tool executes short commands with the remote host account's full
authority; its documented home-directory boundary applies to file reads, not to the
shell. Cancelling the MCP wait does not prove that a command stopped, and the docs
explicitly say not to automatically resend a side-effecting command when its result
is unknown. Interactive deduplication is also scoped to a live terminal instance,
not a durable transaction spanning reconnects.

**Runtime rule:** authentication only decides who may begin. An effectful remote tool
also needs a generation-bound session, operation identity that survives safe retries,
acknowledged output, and an explicit indeterminate state when transport completion
cannot prove effect completion. If operation identity does not survive reconnect,
after-timeout recovery should observe or reconcile rather than mint a new command.

The repository records a local macOS loopback smoke test through TLS, P2P, and PTY,
including duplicate-input suppression and shell cleanup; a later supplement records a
browser-to-API-to-Remote-to-PTY path on macOS. Windows ConPTY execution, real Linux,
and cross-machine networking remained uncovered. Scout inspected source and project-
authored test records but did not run the application, so this is implementation
evidence for the protocol—not an independent security or reliability validation.

- **Repo:** https://github.com/VaderChen/YourDesk
- **Inspected revision:** [`b553cc00c320c2c3bcea465e0dac28fc91c035ad`](https://github.com/VaderChen/YourDesk/commit/b553cc00c320c2c3bcea465e0dac28fc91c035ad)
- **Primary sources:** [MCP server and timeout behavior](https://github.com/VaderChen/YourDesk/blob/b553cc00c320c2c3bcea465e0dac28fc91c035ad/internal/clientui/mcp.go#L180-L298), [terminal session binding](https://github.com/VaderChen/YourDesk/blob/b553cc00c320c2c3bcea465e0dac28fc91c035ad/internal/clientui/mcp_terminal.go#L12-L68), [remote sequence and acknowledgement handling](https://github.com/VaderChen/YourDesk/blob/b553cc00c320c2c3bcea465e0dac28fc91c035ad/internal/terminal/session.go#L164-L201), [remote-data safety contract](https://github.com/VaderChen/YourDesk/blob/b553cc00c320c2c3bcea465e0dac28fc91c035ad/docs/MCP-REMOTE-DATA.md), and [terminal smoke-test record](https://github.com/VaderChen/YourDesk/blob/b553cc00c320c2c3bcea465e0dac28fc91c035ad/docs/SMOKE-TERMINAL-2026-09-11.md)
- **Discovery query:** GitHub Repository Search API `"AI agent" (security OR sandbox) created:>=2026-09-08`, sorted by stars; `incomplete_results: false`

## A Handover Must Revoke Stale Perception as Well as Input Authority — Sideyard (GitHub, September 2026)

Sideyard makes human–agent desktop handover a three-part runtime transition rather
than a UI toggle. First, an explicit owner field gates agent input. Second, each
screenshot carries a workspace generation and MCP frame identity; input derived
from an older generation or another workspace is rejected. Third, taking human
control increments the generation, pauses agent input, waits for held keys and
buttons to be released, and retires the old transport before enabling the human
viewer. Returning control performs the reverse teardown but gives the agent
ownership only after a fresh screenshot succeeds; uncertain teardown or failed
observation leaves the workspace paused.

The useful pattern is that **authority and perception expire together**. Revoking
input alone prevents a simultaneous write but does not stop a resumed agent from
acting on a pre-takeover screen. A generation fence invalidates that stale premise;
a fresh observation then establishes the new actuation base. The supervisor also
rechecks generation between actions in a batch, narrowing the race in which a
handover begins after batch admission. Those mechanisms answer different questions:
who may act, which observed state an action assumes, whether the old input channel
is gone, and whether control can safely resume.

The evidence is implementation-level and narrow. Scout ran the pinned repository's
13 Python invariant tests successfully, including stale-generation rejection,
paused-owner rejection, cross-workspace frame rejection, and the between-actions
owner recheck. The declared `make check` could not run because this environment has
no `make`; its additional Omarchy plugin validation and the live desktop smoke test
were therefore not reproduced. The README also describes only same-user isolation:
host files remain readable and attached projects writable. This is evidence for a
handover protocol, not for hostile-code containment, complete desktop compatibility,
or production adoption.

**Runtime rule:** treat human takeover and return as generation changes. Before
resuming an agent, revoke the old input transport, invalidate observations and
queued actions from the prior generation, acquire a fresh observation, and fail
closed in a paused state if any transition step is uncertain.

- **Repo:** https://github.com/itchyfeetleech/sideyard
- **Inspected revision:** [`527824c9a6b454db7c74fe32edd1a0f0bccd7bb0`](https://github.com/itchyfeetleech/sideyard/commit/527824c9a6b454db7c74fe32edd1a0f0bccd7bb0)
- **Primary sources:** [README and boundary statement](https://github.com/itchyfeetleech/sideyard/blob/527824c9a6b454db7c74fe32edd1a0f0bccd7bb0/README.md), [handover and generation checks](https://github.com/itchyfeetleech/sideyard/blob/527824c9a6b454db7c74fe32edd1a0f0bccd7bb0/src/agent_workspaces/session.py), [frame binding](https://github.com/itchyfeetleech/sideyard/blob/527824c9a6b454db7c74fe32edd1a0f0bccd7bb0/src/agent_workspaces/mcp.py), and [invariant tests](https://github.com/itchyfeetleech/sideyard/blob/527824c9a6b454db7c74fe32edd1a0f0bccd7bb0/tests/test_invariants.py)
- **Discovery query:** GitHub Repository Search API `"AI agent" created:>=2026-09-13`, sorted by stars; `incomplete_results: false`

## History Fidelity and Execution Safety Are Orthogonal — Apache Maka (GitHub, August 2026)

Apache Maka supplies a concrete event-sourced runtime design in which model
messages, tool calls and results, permission decisions, usage, and terminal
facts enter an ordered Runtime Event Log. Session state, the UI, model context,
and recovery are projections over that log rather than competing authorities.
This makes a useful distinction operational: **context may forget while
history does not**.

Its compaction design treats a summary or provider-native compact state as a
materialized view over an ordered event prefix. The checkpoint carries a
through-boundary and source digest, keeps a recent raw tail, and may replace
raw history in a provider request only after durable append and replay-policy
validation. A mismatched or damaged projection is rejected or rebuilt from the
canonical ledger. Crucially, the digest proves which source prefix was covered;
it does not prove that an LLM summary preserved every meaning, and a claim such
as “tests passed” gains no authority by appearing in a checkpoint.

Crash continuation then applies a separate safety test. Maka records a dispatch
fact before a tool crosses the side-effect boundary and a result fact after it
settles. A dispatch with no result is **indeterminate**, not “not executed.” The
current safe-resume path creates a new execution only when every accepted tool
call has a committed outcome; otherwise it parks. Generic shell commands and
remote send, publish, pay, or delete effects remain parked unless a dedicated
reconciler can observe and settle them. The project explicitly says production
reconciler wiring is future work.

**Combined implication:** an append-only interaction log solves fact retention
and projection recovery, but not external-effect closure. Conversely, an effect
receipt without immutable model-visible lineage cannot explain what the agent
knew when it acted. A hardened runtime needs both planes:

1. a canonical semantic ledger with source-bound, disposable context views;
2. pre/post effect facts that preserve the unknown interval after a crash;
3. tool-specific reconciliation for effects that can be observed safely; and
4. fail-closed parking when either history or effect state cannot be proved.

Evidence is architecture and implementation documentation from the repository,
not an independent reliability benchmark. The README also warns that current
data formats can change and that this storage generation does not import older
JSONL conversation authority, so “recoverable going forward” should not be
confused with migration compatibility for existing users.

### Revision follow-up: make the effect boundary and its recovery debt one commit

At revision `50f0d0ecbca4382294bdfe2367942347bb1f7576`, Maka has moved the
history/effect distinction into a concrete storage protocol. `commitToolPrepared`
uses one database transaction to insert the model tool-call event, a separate
pre-dispatch event, a `prepared` journal row, and the operation's current-state
row. An exact retry returns `created: false`; the implementation compares the
stored event and operation identity, so reusing an operation ID with different
arguments or events is rejected rather than treated as idempotent. The matching
outcome commit advances the same operation. Thus a recovery query can find a
prepared dispatch without inferring one from transcript shape.

Project-authored provider-conformance tests exercise both prepare and outcome
under a simulated lost acknowledgement: retrying the identical commit does not
add another fact, while an identity conflict is rejected. Separate tests require
a terminal event to seal the run against later appends. The restart path first
tries to commit explicit interrupted outcomes; if that persistence fails, it
leaves the run non-terminal, and it refuses to seal any run that still contains
an indeterminate dispatch. This is a useful ordering rule: **persist recovery
debt before publishing terminal closure**, or retain the invocation as open.

The same revision also distinguishes immutable prefix proofs from mutable
streaming snapshots. A project-authored test appends a partial model event and
shows that neither the immutable high-water position nor its digest changes;
the proof API also enforces event, total-byte, and per-record-byte budgets. This
lets a caller prove the exact durable prefix it consumed without promoting a
replaceable partial rendering into canonical history.

These are stronger implementation and test-contract signals than the earlier
design documents, but Scout did not install dependencies, run the test suite,
or inject a real process crash. The transaction protects facts within Maka's
SQLite boundary; it cannot make the external tool effect atomic with that
commit. A prepared operation can therefore establish that dispatch was admitted
and may have crossed the boundary, not whether the external effect completed.

- **Repo:** https://github.com/apache/maka
- **Original inspected revision:** [`52c0e3275eae053ea5a221cefdd3be09bbfb46da`](https://github.com/apache/maka/commit/52c0e3275eae053ea5a221cefdd3be09bbfb46da)
- **Current inspected revision:** [`50f0d0ecbca4382294bdfe2367942347bb1f7576`](https://github.com/apache/maka/commit/50f0d0ecbca4382294bdfe2367942347bb1f7576)
- **Original primary sources:** [runtime core](https://github.com/apache/maka/blob/52c0e3275eae053ea5a221cefdd3be09bbfb46da/docs/architecture/runtime-core-architecture-draft.md), [compaction as projection](https://github.com/apache/maka/blob/52c0e3275eae053ea5a221cefdd3be09bbfb46da/docs/architecture/llm-compaction-events-log-projection-draft.md), and [safe resume](https://github.com/apache/maka/blob/52c0e3275eae053ea5a221cefdd3be09bbfb46da/docs/architecture/runtime-resume-architecture.md)
- **Current primary sources:** [transactional tool commit](https://github.com/apache/maka/blob/50f0d0ecbca4382294bdfe2367942347bb1f7576/packages/storage/src/sqlite-runtime-store.ts#L3213-L3319), [provider conformance and lost-acknowledgement tests](https://github.com/apache/maka/blob/50f0d0ecbca4382294bdfe2367942347bb1f7576/packages/storage/src/__tests__/execution-provider-conformance.test.ts#L2180-L2260), [restart settlement ordering](https://github.com/apache/maka/blob/50f0d0ecbca4382294bdfe2367942347bb1f7576/packages/runtime/src/session-manager.ts#L4860-L4920), and [immutable-prefix/partial-event test](https://github.com/apache/maka/blob/50f0d0ecbca4382294bdfe2367942347bb1f7576/packages/storage/src/__tests__/sqlite-runtime-store.test.ts#L3614-L3687)
- **Current discovery query:** GitHub Repository Search API `ai agent durable execution in:name,description,readme pushed:>2026-09-20`, sorted by updated; `total_count: 9502`, `incomplete_results: false`

## Verification-Evidence Binding — Brigade (GitHub, August 2026)

Moved intact to [Agent Runtime Verdict Integrity](./agent-runtime-verdict-integrity.md#verification-evidence-binding--brigade-github-august-2026).

## A Valid Receipt Must Carry Its Coverage Boundary — ASQAV (GitHub, September 2026)

Moved intact to [Agent Runtime Verdict Integrity](./agent-runtime-verdict-integrity.md#a-valid-receipt-must-carry-its-coverage-boundary--asqav-github-september-2026).

## The Verdict Path Needs Its Own Negative Controls — ProjectGuard (GitHub, September 2026)

Moved intact to [Agent Runtime Verdict Integrity](./agent-runtime-verdict-integrity.md#the-verdict-path-needs-its-own-negative-controls--projectguard-github-september-2026).

## A Clean Sweep Must Prove What It Swept — Dream Studio (GitHub, September 2026)

Moved intact to [Agent Runtime Verdict Integrity](./agent-runtime-verdict-integrity.md#a-clean-sweep-must-prove-what-it-swept--dream-studio-github-september-2026).

## A Sandbox Cannot Safely Mint Its Own Escape Authority — Codex (HN, September 2026)

A current [HN submission](https://news.ycombinator.com/item?id=49776305)
points to security researcher Oren Yomtov's disclosure of two Codex sandbox
escapes. The researcher says both were reported to OpenAI on August 12 and fixed
within eight days. The mechanisms differ, but both put the decision to widen
privilege inside state the untrusted workload could influence or inspect.

- **Overpatch:** in `workspace-write` mode, `apply_patch` reportedly granted
  access to each named path's parent directory. Adding a deliberately failing
  `/tmp` change widened the grant to `/`; a second change then followed a
  workspace symlink to append to `$HOME/.zshrc` without an approval prompt.
  This is a target-normalization failure: authority was derived from syntactic
  patch operands before resolving the effective write destination.
- **Heapjack:** the Codex Desktop-installed Node REPL reportedly placed trusted
  and untrusted V8 contexts in one isolate. Untrusted code could enumerate UUID-
  shaped strings from a heap snapshot, distinguish the valid bearer token by
  the native parent's response, and send a forged request through the shared
  stdout pipe. The parent then launched an application outside the sandbox even
  in `read-only` mode. This is a principal-separation failure: the secret and
  request channel used to identify trusted code were observable from the
  untrusted process they were meant to distinguish.

The reusable rule is stronger than “patch these two bugs”: **the constrained
process must not mint, infer, or possess the authority that relaxes its own
boundary**. File-write admission should resolve canonical targets and enforce
policy at the actual write boundary, not from user-controlled path hints.
Privileged brokers should authenticate a caller through an unforgeable channel
outside the guest's memory and IPC namespace, not through a bearer value exposed
to sibling code in the same process. An outer VM can provide that separation,
but only if its control plane, credentials, and host effects remain outside the
guest; the disclosure's recommendation of the author's own Accomplish product
is not independent evidence that one implementation achieves this.

**Evidence boundary:** Scout read the researcher-authored mechanism disclosure
and the HN item, but did not reproduce either exploit or inspect the private
patches. The HN item had one point and no comments when checked. Treat the two
mechanisms as disclosed-and-reported-fixed implementation evidence, not proof
about current Codex versions or all process sandboxes.

- **Primary source:** https://www.accomplish.ai/blog/escaping-the-openai-codex-sandbox-twice/
- **HN:** https://news.ycombinator.com/item?id=49776305

## Unattended Execution, Replay, and Settlement

The unattended-execution, replay, approval-resume, settlement, and accountable
write patterns formerly below moved intact to
[Agent Runtime Unattended Execution and Replay](./agent-runtime-unattended-execution-and-replay.md#boundary-explicit-unattended-execution--docker-sandboxes-hn-august-2026).
The forwarding headings below preserve links from retained digest snapshots.

### Boundary-Explicit Unattended Execution — Docker Sandboxes (HN, August 2026)
Moved to [the companion section](./agent-runtime-unattended-execution-and-replay.md#boundary-explicit-unattended-execution--docker-sandboxes-hn-august-2026).

### A Cloneable VM Template Is Also an Identity Factory — LingCage (GitHub, September 2026)
Moved to [the companion section](./agent-runtime-unattended-execution-and-replay.md#a-cloneable-vm-template-is-also-an-identity-factory--lingcage-github-september-2026).

### Cut-Point Replay Turns Incidents Into Boundary-Explicit Regression Tests — Chronicle (arXiv, September 2026)
Moved to [the replay companion section](./agent-runtime-replay-evidence-and-boundaries.md#cut-point-replay-turns-incidents-into-boundary-explicit-regression-tests--chronicle-arxiv-september-2026).

### Lossy Interaction Records Can Make Candidate Replay Lie — Mutagen (GitHub, September 2026)
Moved to [the replay companion section](./agent-runtime-replay-evidence-and-boundaries.md#lossy-interaction-records-can-make-candidate-replay-lie--mutagen-github-september-2026).

### Replay Consistency Is Not Effect Completeness — Ovo (GitHub, August 2026)
Moved to [the replay companion section](./agent-runtime-replay-evidence-and-boundaries.md#replay-consistency-is-not-effect-completeness--ovo-github-august-2026).

### Offline Model Replay Still Re-executes Tool Effects — OrcaReplay (GitHub, September 2026)
Moved to [the replay companion section](./agent-runtime-replay-evidence-and-boundaries.md#offline-model-replay-still-re-executes-tool-effects--orcareplay-github-september-2026).

### A Local Marker Can Trade Duplicate Effects for Missing Effects — LetItLoop (HN, August 2026)
Moved to [the companion section](./agent-runtime-unattended-execution-and-replay.md#a-local-marker-can-trade-duplicate-effects-for-missing-effects--letitloop-hn-august-2026).

### Reliability Wrappers Need Settlement Semantics — Kevlar (GitHub, September 2026)
Moved to [the companion section](./agent-runtime-unattended-execution-and-replay.md#reliability-wrappers-need-settlement-semantics--kevlar-github-september-2026).

### A Version Change Is a Trigger, Not a Verdict — ATR (arXiv, September 2026)
Moved to [the companion section](./agent-runtime-unattended-execution-and-replay.md#a-version-change-is-a-trigger-not-a-verdict--atr-arxiv-september-2026).

### An Approval Must Bind the Task Revision, Not Just the Caller — AIS (arXiv, September 2026)
Moved to [the companion section](./agent-runtime-unattended-execution-and-replay.md#an-approval-must-bind-the-task-revision-not-just-the-caller--ais-arxiv-september-2026).

### Replay Can Preserve a Verdict Without Settling the Effect — Rebuno (HN / GitHub, September 2026)
Moved to [the companion section](./agent-runtime-unattended-execution-and-replay.md#replay-can-preserve-a-verdict-without-settling-the-effect--rebuno-hn--github-september-2026).

### Approval Resume Is a Compound Integrity Boundary — AgenticOS (HN / GitHub, September 2026)
Moved to [the companion section](./agent-runtime-unattended-execution-and-replay.md#approval-resume-is-a-compound-integrity-boundary--agenticos-hn--github-september-2026).

### Detection Without Attention Does Not Close a Bad Verdict — Reddit Practitioner Report (September 2026)
Moved to [the companion section](./agent-runtime-unattended-execution-and-replay.md#detection-without-attention-does-not-close-a-bad-verdict--reddit-practitioner-report-september-2026).

### Durable Queue State Is Not Downstream Effect Deduplication — Runpin (GitHub, September 2026)
Moved to [the companion section](./agent-runtime-unattended-execution-and-replay.md#durable-queue-state-is-not-downstream-effect-deduplication--runpin-github-september-2026).

### First-Class Agent Identity Makes Writes Accountable, Not Pre-Authorized — Sensefold (HN, September 2026)
Moved to [the companion section](./agent-runtime-unattended-execution-and-replay.md#first-class-agent-identity-makes-writes-accountable-not-pre-authorized--sensefold-hn-september-2026).

### Focus Preservation Is Not Effect Authorization — macOS Harness (GitHub, September 2026)
Moved to [the companion section](./agent-runtime-unattended-execution-and-replay.md#focus-preservation-is-not-effect-authorization--macos-harness-github-september-2026).
