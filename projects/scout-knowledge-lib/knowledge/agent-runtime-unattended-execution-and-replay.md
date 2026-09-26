<ai_context>
summary: "Companion to agent-runtime-effect-integrity.md for unattended execution integrity: lifecycle-bound resume identity, cadence and failure accounting, infrastructure trust boundaries, clone identity hygiene, local durability versus external settlement, site-action reconciliation, revision-bound approval, accountable agent writes, desktop effect authorization, deterministic workflow/host recovery boundaries, and pause-versus-execution authority."
triggers: ["unattended execution", "session resume", "lifecycle generation", "Daintree", "heartbeat", "failure backoff", "Talon", "Docker Sandboxes", "sandbox trust boundary", "clone identity", "LingCage", "effect settlement", "LetItLoop", "Kevlar", "ATR", "approval revision", "AIS", "orphan recovery", "Rebuno", "approval resume", "AgenticOS", "diagnostic attention", "site action ledger", "uncertain effect", "identity drift", "rules drift", "Runpin", "effect deduplication", "agent identity", "Sensefold", "desktop authorization", "macOS Harness", "AgentRun", "workflow DSL", "late settlement", "Kiso", "recovery projection", "crash matrix", "LoopX", "hard lease", "agent pause", "lease retirement"]
last_updated: "2026-09-26"
source_basis: "Extracted intact from agent-runtime-effect-integrity.md during its 2026-09-21 oversized-note review, then extended with pinned implementation evidence for lifecycle-bound session resume, unattended cadence and failure accounting, AgentRun's workflow/host recovery boundary, Kiso's deterministic recovery projection, and LoopX's pause/lease transaction boundary, plus explicitly limited Reddit practitioner reports about diagnostic attention and site-action reconciliation. Replay-specific Chronicle, Mutagen, Ovo, and OrcaReplay sections moved intact to agent-runtime-replay-evidence-and-boundaries.md during the 2026-09-24 oversized-note review. Each retained section preserves stable source links, reproduced checks where performed, and explicit evidence limitations."
</ai_context>

# Agent Runtime Unattended Execution and Replay

**Companion note** to [Agent Runtime Effect Integrity](./agent-runtime-effect-integrity.md).
The parent retains revision admission, guarded writes, ambiguous-delivery recovery,
resource quarantine, and core effect-closure patterns. This note covers the trust
boundaries and settlement evidence needed when execution continues unattended or
is replayed after interruption.

## Resume the Process Generation, Not the Reused Pane — Daintree (GitHub, September 2026)

Daintree's passive coding-agent session capture exposes a general identity problem:
a stable UI pane or terminal ID can host several process incarnations, while a late
close path from the predecessor can finish after the successor has started. Treating
the pane ID as the resume identity can therefore suppress the successor's record or
write the predecessor's conversation onto the live pane.

At pinned revision `8e314b3e06e3260fd8df564aa1beae373656c6ad`, Daintree freezes a
launch generation before initiating a kill and funnels overlapping close paths
through one journal gate keyed by `(terminalId, generation)`. A ledger mark is only
a reservation: if persistence fails, the mark is rescinded, and the recorded event
is emitted only after the durable write. If the bounded lifecycle ledger has already
forgotten a predecessor, an explicit unknown generation fails open rather than
consulting the current generation; that may admit a duplicate, but it cannot spend
the successor's exactly-once slot. Session-ID deduplication remains a second line of
defense.

The same capture is projected independently into two stores. The global history
supports a resume picker, while the saved pane's session ID supports cold in-place
restore. Journal failure does not suppress pane writeback, nor does pane failure
suppress journaling. Pane writeback is narrower: it accepts only a final exit with a
numeric generation, rechecks generation, project, and agent ownership when the
serialized state update actually runs, and never overwrites a different ID that the
renderer or user owns. A fresh confirmed relaunch clears a module-authored ID unless
that launch explicitly resumes it. This prevents a recovery hint from turning into
an accidental command to reopen an abandoned conversation forever.

Shutdown has two explicit barriers. The PTY host registers each asynchronous capture
tail before its first await, stops waiting for optional branch enrichment once
finishing begins, and reports whether a bounded drain left records undelivered. Main
seals acceptance and separately drains accepted journal and pane writes. The local
history's read-modify-write operations are serialized to avoid lost updates, and an
existing but unreadable journal is distinct from an absent one: mutation aborts
rather than replacing unknown records with an empty list. Proven malformed JSON is
quarantined only when that move succeeds.

**Runtime rule:** bind recovery credentials to the process incarnation that produced
them, not only to a reusable UI or resource ID. Freeze that incarnation before
teardown, revalidate ownership at apply time, and distinguish reservation from
durable receipt. When one observation feeds multiple recovery projections, persist
them independently and report each outcome. On shutdown, make both delivery to the
persistence owner and settlement inside that owner bounded, observable barriers;
optional enrichment must not delay the credential itself.

Scout inspected pinned source and repository-authored Vitest cases but did not clone
the repository, run its test suite, or exercise an actual Claude, Codex, or Gemini
resume. The evidence establishes static safeguards and authored regression coverage,
not crash-consistent resume in deployment. The fail-open path explicitly prefers a
rare duplicate over losing a resume record.

- **Repo:** https://github.com/daintreehq/daintree
- **Inspected revision:** https://github.com/daintreehq/daintree/commit/8e314b3e06e3260fd8df564aa1beae373656c6ad
- **Primary sources:** [journal generation gate](https://github.com/daintreehq/daintree/blob/8e314b3e06e3260fd8df564aa1beae373656c6ad/electron/services/pty/agentSessionJournal.ts), [independent journal and pane projections](https://github.com/daintreehq/daintree/blob/8e314b3e06e3260fd8df564aa1beae373656c6ad/electron/services/pty/agentSessionCapturePersistence.ts), [host-side shutdown delivery barrier](https://github.com/daintreehq/daintree/blob/8e314b3e06e3260fd8df564aa1beae373656c6ad/electron/services/pty/agentSessionCaptureDelivery.ts), [serialized and guarded history writes](https://github.com/daintreehq/daintree/blob/8e314b3e06e3260fd8df564aa1beae373656c6ad/electron/services/pty/agentSessionHistory.ts), [journal tests](https://github.com/daintreehq/daintree/blob/8e314b3e06e3260fd8df564aa1beae373656c6ad/electron/services/pty/__tests__/agentSessionJournal.test.ts), and [persistence tests](https://github.com/daintreehq/daintree/blob/8e314b3e06e3260fd8df564aa1beae373656c6ad/electron/services/pty/__tests__/agentSessionCapturePersistence.test.ts)
- **Discovery query:** GitHub Repository Search API `topic:ai-agents pushed:>2026-09-23 stars:>30`, sorted by updated; `total_count: 369`, `incomplete_results: false`

## Cadence, Attempt, and Settlement Are Different Clocks — Talon (GitHub, September 2026)

Talon's heartbeat implementation exposes a subtle requirement for recurring agents:
what advances the schedule need not be the same as what counts as successful work.
The scheduler derives due times from persisted `last_run`, checks every minute, and
collapses any number of missed intervals after restart or suspend into one catch-up
run. A one-at-a-time guard prevents overlapping heartbeats. Ordinary failures retain
the prior successful marker and enter exponential backoff (five minutes doubling to
a one-hour cap); a session- or rate-limit error with a UTC reset time waits until that
time plus a two-minute buffer. By contrast, a hard timeout advances `last_run` and
the run count even though the heartbeat failed, because it consumed the full
wall-clock budget and should not immediately repeat the same work.

That distinction avoids both a retry storm and an unbounded catch-up storm, but it
also shows why one `last_run` field is an overloaded receipt. In the state type it is
documented as the last successfully completed run, while the timeout path writes it
on failure. The resulting marker is valid as a **cadence-consumed** fact, not as a
completed-work fact. A dashboard, prompt, or recovery policy that reads it as
success can overstate progress. The project-authored tests explicitly check missed
interval collapse, preservation after ordinary failure, backoff, and advancement
after timeout; they do not turn the timeout marker into evidence that goals advanced
or that any external effect settled.

Cancellation has the same layered boundary. The shared isolated runner applies a
hard timeout, calls `AbortController.abort()`, waits a bounded grace period, and can
ask the backend to evict tagged orphan subprocesses if abort is ignored. This bounds
local execution, but cannot retract a tool effect already accepted outside the
process. Run logs are intentionally best-effort and swallow append errors, while
failure-backoff state is intentionally in-memory and resets on process restart.
Neither is durable settlement evidence.

**Runtime rule:** persist separate timestamps or states for `scheduled/due`,
`attempt_started`, `cadence_consumed`, `work_completed`, and each consequential
effect's settlement. Define catch-up and retry from the relevant state rather than a
single success-sounding marker. A timeout may consume the recurrence budget while
leaving work failed and effects indeterminate; surface those facts independently,
and reconcile external effects before retrying them.

Scout inspected pinned source and repository-authored tests but did not clone the
repository or execute its Vitest suite. Talon's README describes hourly heartbeats
that advance persistent goals, but this assessment establishes scheduler behavior
from source—not reliability in a live deployment or exactly-once goal progress.

- **Repo:** https://github.com/dylanneve1/talon
- **Inspected revision:** https://github.com/dylanneve1/talon/commit/1a3053efbbfe793d0c6225183cb29644c35f51d0
- **Primary sources:** [heartbeat scheduler](https://github.com/dylanneve1/talon/blob/1a3053efbbfe793d0c6225183cb29644c35f51d0/src/core/background/heartbeat/scheduler.ts), [persisted heartbeat state](https://github.com/dylanneve1/talon/blob/1a3053efbbfe793d0c6225183cb29644c35f51d0/src/core/background/heartbeat/state.ts), [failure backoff](https://github.com/dylanneve1/talon/blob/1a3053efbbfe793d0c6225183cb29644c35f51d0/src/core/background/failure-backoff.ts), [isolated runner](https://github.com/dylanneve1/talon/blob/1a3053efbbfe793d0c6225183cb29644c35f51d0/src/core/background/isolated-agent.ts), [heartbeat tests](https://github.com/dylanneve1/talon/blob/1a3053efbbfe793d0c6225183cb29644c35f51d0/src/__tests__/heartbeat.test.ts), and [backoff tests](https://github.com/dylanneve1/talon/blob/1a3053efbbfe793d0c6225183cb29644c35f51d0/src/__tests__/failure-backoff.test.ts)
- **Discovery query:** GitHub Repository Search API `topic:ai-agent pushed:>2026-09-22 stars:>50`, sorted by updated; `total_count: 257`, `incomplete_results: false`

## Boundary-Explicit Unattended Execution — Docker Sandboxes (HN, August 2026)

A high-activity HN thread around Docker Sandboxes supplies a concrete product
signal for the move from command-by-command approval to infrastructure-bounded
agent autonomy. Docker advertises a dedicated microVM per agent, a private
Docker Engine, deny-by-default network policy, and host-side credential
injection so coding agents can run in permissive modes without receiving raw
API keys. The official security documentation is unusually explicit about
what that boundary does **not** protect.

The microVM confines the host kernel, processes, Docker daemon, and filesystem
outside explicit shares, but direct mode mounts the working tree read-write by
default. An agent can therefore change or delete project files—including Git
hooks, CI configuration, IDE tasks, and build scripts—that later execute on the
host. `--clone` strengthens this boundary by mounting the source repository
read-only and giving the agent a private clone. Shared agent skills are also
read-write by default across participating sandboxes, putting those sandboxes
inside one durable instruction-and-script trust boundary unless
`--no-share-skills` is used. Local stdio MCP servers remain host processes,
not microVM-confined tools.

Credential proxying is a separate capability boundary: the host proxy matches
an allowed service and injects the secret into the outbound header while the
sandbox sees a sentinel value. This reduces credential exfiltration from the
VM, but it still grants the agent the **authority to use** that credential
against allowed endpoints. OAuth passthrough can additionally opt out of
sentinel masking. The distinction matters: secret non-disclosure, permission
to exercise the secret, network reachability, and workspace mutability are
four different controls.

HN participants repeatedly asked how the product differs from hand-built
containers or existing microVM runtimes. More useful than that packaging debate
were two deployment questions: several commenters valued outbound firewalling
and boundary-level secret injection, while another noted that providing a
sandbox does not itself enforce that every agent process is launched inside
it. This yields an operational rule: an autonomy boundary needs both
**confinement** (what a sandboxed process can reach) and **admission** (which
agent processes are permitted to run, and only through the sandbox launcher).

The product page and docs establish architecture and defaults, not independent
breakout resistance or production reliability. Docker's claim of a “hard
security boundary” should therefore be treated as vendor-reported until tested.
The reusable design value is its explicit boundary inventory: host isolation,
workspace mode, cross-sandbox shared state, MCP escape hatches, network policy,
and credential-use authority must each be reviewed separately.

- **HN:** https://news.ycombinator.com/item?id=49239751
- **Source:** https://www.docker.com/products/docker-sandboxes/
- **Security model:** https://docs.docker.com/ai/sandboxes/security/
- **Default posture:** https://docs.docker.com/ai/sandboxes/security/defaults/
- **Credential model:** https://docs.docker.com/ai/sandboxes/security/credentials/

## A Cloneable VM Template Is Also an Identity Factory — LingCage (GitHub, September 2026)

LingCage provides an early implementation signal for a less visible snapshot risk:
a captured guest does not contain only reusable boot work. It can also contain
random seeds, host keys, machine identity, credentials, and other state that becomes
**clone-correlated** when RAM is restored copy-on-write. The pinned implementation
therefore treats template construction and per-clone identity as separate phases.

Before registering a captured initramfs, its sanitizer rejects systemd random seeds,
the system credential secret, hostname and machine-info files, SSH host-key paths,
and a populated machine ID. At sandbox assembly, the runtime restores the template,
then generates a fresh vsock context, random sandbox ID, random 32-hex machine ID,
and per-sandbox hostname for the guest-agent handshake. This turns “boot once, clone
many” into an explicit invariant: static executable state may be shared, but
principal- and entropy-bearing state must be removed before capture or regenerated
at spawn.

The template is also treated as an admitted artifact rather than an arbitrary RAM
file. Registration recomputes a SHA-256 identity over `ram.img`, `state.json`, and
`kernel.img`; refuses a metadata ID mismatch, another `lingcore` version, or an
incompatible device-layout stamp; and checks memory/vCPU shape again at sandbox
start. A shared file lock prevents deleting the RAM image while a live sandbox holds
it. These checks do not prove the guest image is trustworthy, but they bind a spawn
to the exact bytes and runtime shape that were admitted.

The limitations matter. The sanitizer is a path denylist over the initramfs, not a
complete secret scanner, and its source explicitly says zstd- and xz-compressed
initramfs listings are not yet supported. The repository README says process-model
and jailer work are next, and that isolation, storage, and networking remain future
milestones. Its seccomp code confines selected VMM worker threads while noting that
descriptors and memory still belong to the calling process; the assembly thread does
not yet have an allowlist. The current no-disk, no-network sandbox is therefore
implementation evidence for **template and clone hygiene**, not evidence of a
finished multi-tenant security boundary.

**Runtime rule:** audit every snapshot field by clone semantics. Classify state as
shareable, forbidden at capture, or mandatory to regenerate at spawn; content-bind
the admitted template; and re-check runtime compatibility before restore. A fast
clone that reproduces identity or entropy is not a clean sandbox allocation.

Scout inspected source and project-authored unit tests at one revision but did not
build the Rust workspace or run its KVM-dependent suite. The repository had 17 stars
at retrieval, so this is an early implementation pattern rather than adoption or
independent isolation validation.

- **Repo:** https://github.com/RuoqingHe/lingcage
- **Inspected revision:** https://github.com/RuoqingHe/lingcage/commit/51d4d9c7e76f7e464ca5a5100600400e711bf79f
- **Primary sources:** [repository status and test boundary](https://github.com/RuoqingHe/lingcage/blob/51d4d9c7e76f7e464ca5a5100600400e711bf79f/README.md), [template sanitizer](https://github.com/RuoqingHe/lingcage/blob/51d4d9c7e76f7e464ca5a5100600400e711bf79f/src/lingcage/src/template/sanitize.rs), [template admission and content identity](https://github.com/RuoqingHe/lingcage/blob/51d4d9c7e76f7e464ca5a5100600400e711bf79f/src/lingcage/src/template/store.rs), [clone assembly and fresh identity](https://github.com/RuoqingHe/lingcage/blob/51d4d9c7e76f7e464ca5a5100600400e711bf79f/src/lingcage/src/sandbox/mod.rs), and [seccomp scope](https://github.com/RuoqingHe/lingcage/blob/51d4d9c7e76f7e464ca5a5100600400e711bf79f/src/lingcore/src/seccomp/mod.rs)

## Replay Evidence and Boundaries

The replay-specific Chronicle, Mutagen, Ovo, and OrcaReplay assessments moved intact
to the companion beginning with
[Cut-Point Replay Turns Incidents Into Boundary-Explicit Regression Tests](./agent-runtime-replay-evidence-and-boundaries.md#cut-point-replay-turns-incidents-into-boundary-explicit-regression-tests--chronicle-arxiv-september-2026).
That companion separates frozen evidence from live candidate boundaries and model or
workspace replay from tool and external-effect safety.

## A Local Marker Can Trade Duplicate Effects for Missing Effects — LetItLoop (HN, August 2026)

HN surfaced LetItLoop under the claim “resume crashed AI agent loops with 0% token waste.” Its implementation supports a narrower and useful guarantee: a completed, JSON-serializable step is recorded locally and fast-forwards on resume, while an in-flight step runs again at least once. The README states both limits, and the repository's post-action/pre-journal crash scenario explicitly expects `AT_LEAST_ONCE_REPLAY`. The reported zero-waste result comes from a synthetic file-write conformance harness, so it should not be generalized to arbitrary model calls or remote effects.

The accompanying `atomic_marker()` makes the external-effect boundary especially clear. It creates an exclusive local marker **before** yielding permission to call the remote mutation. A crash after marker creation but before the mutation causes resume to see the marker and skip the effect: duplication is avoided by accepting a possible missing effect. Moving the marker after the mutation reverses the failure mode—a crash after remote success but before marker persistence can duplicate the effect. A local filesystem marker cannot atomically commit with an unrelated remote service.

**Runtime rule:** advertise recovery guarantees by crash window and effect class, not with one aggregate “zero waste” label:

1. completed local steps may be replay-skipped when their durable result is intact;
2. in-flight pure or idempotent steps may safely run at least once;
3. marker-before-effect provides at-most-once admission but can lose the intended effect;
4. effect-before-marker can duplicate the intended effect; and
5. exactly-once business effect requires provider-bound idempotency/transactionality or post-crash reconciliation, not a local marker alone.

This does not negate the repository's checksummed WAL, torn-tail handling, or explicit at-least-once scenario. It narrows the claim to what those mechanisms establish. Evidence is source inspection at one very new, low-adoption revision (four GitHub stars and an HN item with one point and no comments at retrieval), not an independent benchmark reproduction.

- **Source:** https://news.ycombinator.com/item?id=49462893
- **Repo:** https://github.com/sdageltc/letitloop
- **Inspected revision:** https://github.com/sdageltc/letitloop/commit/c5bc40236f405d80572507064cca6bdd7e59a3d9
- **Primary sources:** [README resume semantics](https://github.com/sdageltc/letitloop/blob/c5bc40236f405d80572507064cca6bdd7e59a3d9/README.md), [`step()` and `atomic_marker()`](https://github.com/sdageltc/letitloop/blob/c5bc40236f405d80572507064cca6bdd7e59a3d9/orchestrator/decorators.py), and [post-action/pre-journal scenario](https://github.com/sdageltc/letitloop/blob/c5bc40236f405d80572507064cca6bdd7e59a3d9/conformance/scenarios/DCP-003-POST_ACTION_PRE_JOURNAL.json)

## Reliability Wrappers Need Settlement Semantics — Kevlar (GitHub, September 2026)

Kevlar packages several small Python guards around unattended agents. Its budget
decorator checks a feature-local monthly ledger before a paid call and records the
cost after the call returns. Its deduplication decorator records an argument-derived
key before invoking the wrapped function. These choices are useful for ordinary
single-process cases, but together they expose a general boundary: **admission,
effect settlement, and durable accounting are different transitions**.

Two narrow negative controls reproduced the uncovered intervals at pinned revision
`1cee728c…1274`. First, a wrapped function that raised on its first invocation was
still marked as recently seen; the identical retry was suppressed and returned the
configured duplicate value without re-invoking the function. Second, two synchronized
threads each passed a `$1.00` budget check for a `$0.75` call. Both calls completed,
while the shared JSON ledger ended at `$0.75`, not `$1.50`. The check, effect, and
read-modify-write accounting steps are not serialized, and the repository tests cover
sequential success and rejection rather than these failure and concurrency paths.

This is not evidence that lightweight decorators are useless. It identifies the
claim they can safely make. A local dedupe window can reduce repeated calls in one
process, and a sequential ledger can provide coarse feature attribution. Neither is
an exactly-once effect protocol or a hard concurrent spend ceiling. A stronger
contract needs an explicit state machine such as `reserved → dispatched → settled`
(or `failed/indeterminate`), an atomic per-key reservation, provider idempotency or
post-effect reconciliation, and accounting that preserves outstanding reservations
rather than recording only successful returns. Failed calls also need an explicit
retry policy instead of silently inheriting the same status as completed effects.

Scout could not run the repository's claimed 24-test pytest suite because pytest was
absent in the environment; `compileall` succeeded, and the two direct Python negative
controls above reproduced against the pinned source. The repository was two stars at
inspection, so this is implementation-level boundary evidence, not production
reliability validation.

- **Repo:** https://github.com/KiitaInternet/kevlar
- **Inspected revision:** https://github.com/KiitaInternet/kevlar/commit/1cee728c751df9d475025374e86235910bea1274
- **Primary sources:** [budget guard](https://github.com/KiitaInternet/kevlar/blob/1cee728c751df9d475025374e86235910bea1274/kevlar_agent/budget.py), [deduplication guard](https://github.com/KiitaInternet/kevlar/blob/1cee728c751df9d475025374e86235910bea1274/kevlar_agent/dedupe.py), [budget tests](https://github.com/KiitaInternet/kevlar/blob/1cee728c751df9d475025374e86235910bea1274/tests/test_budget.py), and [deduplication tests](https://github.com/KiitaInternet/kevlar/blob/1cee728c751df9d475025374e86235910bea1274/tests/test_dedupe.py)

## A Version Change Is a Trigger, Not a Verdict — ATR (arXiv, September 2026)

Long-running agents can read evidence, pause for a tool or approval, and act after
that evidence changes. ATR makes a useful distinction: a **version conflict** says
something changed, while a **decision conflict** says the change falsified a
condition that justified the pending action. Aborting on every version mismatch
throws away still-valid reasoning; ignoring mismatches can release invalid
effects.

The proposed gate records typed, executable premises and evidence-to-effect
dependencies. A reverse index finds the affected closure after a change, then the
gate can keep the pending action, refresh presentation-only data, require
replanning, or block. Free-form rationale is explicitly not accepted as an
executable premise. Before release, target-local state must be bound through a
transaction, compare-and-set, uniqueness constraint, lease, or domain command.
Cross-system policy or authority needs its own reservation, capability, lease, or
fencing token; otherwise the evidence remains unbound and irreversible effects
should fail closed.

The paper's controlled evidence supports the mechanism, not production accuracy.
Across 210,000 executions that repeatedly exercise 15 developer-authored mutation
cases, ATR matched the declared outcome with no false allows or blocks. Ten durable
SQLite cells evaluated 0.6 premises per change versus 6.0 for a full scan. At
4,093 recorded reads, warmed single-process validation took 9.3 microseconds
versus 2,595.9 for the full scan. But the evaluation excludes connector, network,
model, logging, and replanning costs; does not test natural-language premise
extraction; and uses deterministic author-specified validators and ground truth.

The fault injection is the more operationally important result: omitting the sole
critical dependency edge yielded false-allow rates of 0.95%, 5.05%, and 9.97% at
1%, 5%, and 10% omission. Selectivity therefore shifts the safety burden onto
**complete or conservatively over-approximated dependency capture** and sound
premise validators. ATR also does not solve crash ambiguity after an external
effect, partial multi-system effects, or non-idempotent APIs; it belongs before
the effect-closure and recovery mechanisms documented elsewhere in this note.

**Runtime rule:** persist the justification as machine-checkable conditions,
revalidate only the affected closure when attribution is trustworthy, and bind
the checked versions to the authoritative commit. If premise extraction,
dependency attribution, or cross-system binding is uncertain, widen the closure
or fail closed rather than treating a selective green check as global safety.

- **Source:** https://arxiv.org/abs/2609.08015v1
- **Full paper:** https://arxiv.org/html/2609.08015
- **Artifact named by the paper:** https://github.com/ezreal13/atr-decision-validation/tree/89c32fa

## An Approval Must Bind the Task Revision, Not Just the Caller — AIS (arXiv, September 2026)

Agent-Integrated Software (AIS) isolates a coordination failure that ordinary API
validation and account permissions do not catch. A person can approve a proposal,
then alter the same shared objects through the application's normal interface while
the delegated task continues. The original approval remains authentic, but its
recipient list, attachment, or effect scope may now be obsolete. A later operation
can therefore be schema-valid and caller-authorized while violating the task the
person currently sees.

The paper's proposed **interaction–effect obligation** binds each admission to five
things: the current task revision, the reviewed object or payload versions,
role-specific authority, the active controller and its epoch, and evidence strong
enough to justify the reported outcome. Its compact disclosure example separates
four host-enforced invariants:

1. the admitted payload still matches the endorsed task and object bindings;
2. authority is current for the role, resource, action, and context;
3. admission occurs under the running task and active controller epoch, with the
   decision recorded atomically; and
4. a committed outcome is reported only from authoritative effect evidence.

This refines revision checking into a larger semantic boundary. A task revision can
invalidate **future** admissions without rewriting the historical truth of an effect
that was already admitted. Likewise, an acknowledged stop must fence later
admissions under the old controller epoch, but cannot imply reversal of an external
effect already committed. Compensation is a new authorized operation, not a
generated inverse command.

The paper also gives continuous assurance a useful three-valued standing. A witnessed
violation refutes a scoped claim; current evidence and dependencies can support it;
an expired premise, unavailable receipt, or coverage gap leaves it **insufficiently
supported**, not passing. Dependency tracking then permits selective reassessment:
a planner change may invalidate behavioral evidence while leaving an unchanged
admission gate's invariant intact, whereas adding an unmediated write path destroys
the gate's coverage premise.

The evidence is a formal perspective and research agenda, not a deployed-system
validation. Its propositions are conditional on authoritative bindings, complete
mediation, an initially valid journal, and an atomic trusted gate. The authors
explicitly do not establish goal suitability, progress, usability, fairness, or the
absence of omitted effects, and their cross-domain examples are hypothetical design
probes. The operational value is therefore the contract decomposition and its
failure tests—not an empirical claim that AIS has solved integration reliability.

**Runtime rule:** bind effect admission to the endorsed task revision and reviewed
objects as well as identity and permission; fence controller generations at the
admission boundary; and represent assurance as supported, refuted, or insufficient
under explicit versioned dependencies.

- **Source:** https://arxiv.org/abs/2609.11381v1
- **Full paper:** https://arxiv.org/html/2609.11381v1

## Replay Can Preserve a Verdict Without Settling the Effect — Rebuno (HN / GitHub, September 2026)

Rebuno's pinned implementation makes one crash boundary unusually explicit. Before
an agent runs a tool, model, or local call, the kernel records the step as
`executing`; afterward the agent reports a terminal result. A later dispatch
recomputes the step ID from execution, kind, target, canonical argument hash, and
per-dispatch occurrence. Terminal steps replay their recorded result. An orphaned
`safe_to_retry` step runs again, while an orphaned `at_most_once` step becomes
`failed/indeterminate`. A repository test further shows that a fresh attempt to
submit the same target and arguments after that indeterminate result is denied,
while a call with different arguments may proceed.

This is stronger than silently equating a missing result with “not executed,” but
it deliberately does not provide exactly-once effects. The idempotency class is
supplied by the agent and defaults to `safe_to_retry`; a mistaken declaration can
therefore duplicate a write. Conversely, `at_most_once` avoids automatic duplicate
execution by accepting that the intended effect may be lost or may already have
happened. The kernel's error tells the agent to inspect external state, but that
reconciliation is outside the runtime. Policy is also evaluated on first submission
and skipped when replaying the already recorded step, so replay preserves the old
step verdict rather than proving current authorization or current external state.

**Runtime rule:** record dispatch-start and terminal-result facts separately; make
orphan recovery an explicit per-effect choice; and treat `indeterminate` as a
machine-readable reconciliation obligation. A complete recovery receipt still
needs the provider's idempotency key or authoritative post-crash state—not merely a
valid local replay decision.

- **HN source:** https://news.ycombinator.com/item?id=49699591
- **Repo:** https://github.com/rebuno/rebuno/tree/b4c97f32d36295c60a531cd1c19d46bd0796800e
- **Primary implementation:** [step submission and orphan handling](https://github.com/rebuno/rebuno/blob/b4c97f32d36295c60a531cd1c19d46bd0796800e/internal/kernel/step.go), [indeterminate-retry test](https://github.com/rebuno/rebuno/blob/b4c97f32d36295c60a531cd1c19d46bd0796800e/internal/kernel/kernel_test.go#L1138-L1200), and [architecture contract](https://github.com/rebuno/rebuno/blob/b4c97f32d36295c60a531cd1c19d46bd0796800e/docs/architecture.mdx)
- **Evidence level:** pinned repository code and repository-authored tests inspected;
  not an independent production reliability evaluation (the Go toolchain was not
  available locally, so the tests were not rerun)

## Approval Resume Is a Compound Integrity Boundary — AgenticOS (HN / GitHub, September 2026)

AgenticOS's pinned delegation runtime shows why “resume after approval” is not one
piece of state. A parent parks on its own `task` tool call, while the human verdict
names a tool call inside the delegate. Starting the delegate again can therefore
substitute the parent's call identity, discard the delegate's conversation, and let
the model choose a different action. The implementation instead persists a plain-data
`ParkedDelegation` containing both call identities, a stable public task identity,
the delegate's serialized messages, its child run ID, first start time, and cumulative
spend. On replay, the original parent call retrieves the delegate-specific messages
and deferred verdicts, while the stable task ID reopens the same UI panel rather than
creating a second apparent task.

The cost state is deliberately independent of the resumable conversation. The carry
tracks pre-park plus post-resume spend, separately retaining the amount billed to a
published delegate's row when inline descendants have no row of their own. It also
keeps a `has_unpriced_models` bit so a priced continuation cannot make an earlier
unpriced segment look exact. If best-effort message capture fails, the implementation
still preserves spend and timing but reruns the delegation from the start. That is an
honest accounting fallback, not approval fidelity: the repository comments explicitly
acknowledge that a restarted model may choose a different tool.

This yields three distinct resume guarantees: **decision binding** (the verdict reaches
the tool call it names), **execution continuity** (the same delegate state continues),
and **accounting continuity** (all segments remain attributed once). Preserving one
does not imply the other two. In particular, a system that cannot restore the reviewed
conversation should require a new approval or fail closed before a newly generated
effect, even if it can still report the earlier spend accurately.

**Runtime rule:** persist parent-call identity, reviewed child-call identity, delegate
history, continuation verdicts, stable presentation identity, cumulative spend, and
pricing completeness as separate fields. On resume, prove each binding independently;
never treat accurate cost carry or a valid old verdict as evidence that a regenerated
action is the one a person reviewed.

- **HN source:** https://news.ycombinator.com/item?id=49705577
- **Repo:** https://github.com/vstorm-co/agenticos/tree/023a6e09b7cb09b5c44735623817f1d4c72345fe
- **Primary implementation:** [persisted delegation state](https://github.com/vstorm-co/agenticos/blob/023a6e09b7cb09b5c44735623817f1d4c72345fe/backend/app/agents/subagent_runtime.py#L295-L523) and [park/resume journal](https://github.com/vstorm-co/agenticos/blob/023a6e09b7cb09b5c44735623817f1d4c72345fe/backend/app/agents/capabilities/subagents/_journal.py#L550-L712)
- **Repository tests inspected:** [delegation seams](https://github.com/vstorm-co/agenticos/blob/023a6e09b7cb09b5c44735623817f1d4c72345fe/backend/tests/test_delegation_seams.py#L190-L220) and [nested resume](https://github.com/vstorm-co/agenticos/blob/023a6e09b7cb09b5c44735623817f1d4c72345fe/backend/tests/test_subagent_nested_resume.py)
- **Evidence level:** pinned repository code and repository-authored tests inspected;
  the two primary modules compiled locally, but repository tests were not rerun because
  `uv` was unavailable

## Detection Without Attention Does Not Close a Bad Verdict — Reddit Practitioner Report (September 2026)

A pseudonymous builder of a long-running autonomous research system reported an
instructive two-layer failure. After stopping the system for an audit, the builder
said that 55% of recorded results were infrastructure failures presented as
findings. The same post says the system had detected the problem months earlier,
but the operator did not read the channel where it was reported. The described
system also had append-only ledgers, provenance structures, six self-modification
gates, read-only diagnostic tools, and an audit register.

This is not independent evidence for the percentage or the architecture: the post
provides no public artifact, raw audit, or reproducible method. Its useful signal is
the failure decomposition. Verdict integrity can fail in the execution harness even
when the reasoning layer appears sound, while anomaly detection can succeed without
producing an operational response. A diagnostic channel is therefore not effect
closure; it needs an accountable consumer, escalation threshold, acknowledgement,
and a state transition that prevents suspect outputs from remaining accepted.

**Runtime rule:** keep infrastructure outcomes distinct from domain findings; make
that classification independently auditable; and route high-severity contradictions
to an owned, acknowledged queue that can quarantine affected results. Measure not
only detection rate but also time-to-review and the fraction of accepted findings
covered by unresolved harness alerts.

- **Source:** https://www.reddit.com/r/AI_Agents/comments/1wene1q/ive_been_building_something_for_a_year_so_far_its/
- **Stable post ID:** `t3_1wene1q`
- **Evidence level:** full post body observed in Reddit's public Atom search feed;
  pseudonymous self-report, not independently validated

## A Site-Action Ledger Needs an Uncertain State and Live Preconditions — Reddit Practitioner Report (September 2026)

A tool builder reported six failure modes from one week of letting Claude Code or
Codex post through the operator's own browser. The most reusable observation is not
Reddit-specific: a slow page can accept a write before the tool times out. Treating
the timeout as failure and retrying can duplicate the effect. The reported response
was to reserve a ledger row before dispatch, require a permalink as positive proof,
mark a send without proof as `uncertain`, and block both retry and new sends until
account history and the target thread were reconciled. Because account history could
lag for minutes, absence in one view was not treated as proof of non-delivery.

The report adds two pre-dispatch checks that a pure effect ledger does not cover.
Browser identity can drift, so the writer reads the signed-in account and refuses a
mismatch before every write. Site policy can also drift across surfaces: the builder
reports checking both community rules and the live composer because required flair
may appear only there. A CAPTCHA after a burst of activity became a stop condition
for human review rather than a challenge for the agent to solve.

These are plausible operational controls, but the evidence is a pseudonymous,
self-promotional account: no raw ledger, incident log, implementation, or independent
reproduction was supplied, and the linked open-source read-only component does not
establish the paid writer's behavior. The report therefore corroborates the stronger
implementation evidence elsewhere in this note; it does not establish incidence
rates, correctness, or safe autonomous posting.

**Runtime rule:** represent consequential site actions as
`reserved → dispatched → settled | uncertain`; let uncertainty block retry until
multiple authoritative views are reconciled; and revalidate actor identity, live
rules, and challenge state immediately before dispatch. A negative observation from
a lagging history view is not a failure receipt.

- **Source:** https://www.reddit.com/r/ArtificialInteligence/comments/1wqtvos/an_ai_agent_that_takes_real_actions_needs_a/
- **Stable post ID:** `t3_1wqtvos`
- **Evidence level:** full post body observed in Reddit's public Atom search feed;
  pseudonymous promotional self-report, not independently validated

## Durable Queue State Is Not Downstream Effect Deduplication — Runpin (GitHub, September 2026)

Runpin's pinned implementation cleanly exposes three guarantees that are easy to
collapse into one. First, an optional `idempotency_key` deduplicates **job creation**:
submitting the same key returns the existing row. Second, a transaction claims a
queued row under a worker lease, heartbeats extend that lease, and stale leases are
returned to the queue. Third, completion is conditional on the current lease owner
and `running` status, so a stale worker cannot overwrite the winner's local terminal
record.

Those controls protect queue state, not necessarily the remote effect. The built-in
`http_callback` handler sends the payload to an arbitrary service and stores the
response only after it returns. If that service commits an effect and the response is
lost—or if a lease expires while the old request is still completing—a reclaimed
attempt can send the callback again. The worker's abort signal asks the old request
to stop, but cannot retract an effect already accepted remotely. More subtly, the
job's top-level `idempotency_key` is not automatically forwarded to the callback;
the handler sends only the nested payload after removing callback configuration.
Downstream deduplication therefore requires the caller to place a stable operation
identifier in that payload and the receiver to enforce it. The README appropriately
lists exactly-once delivery and horizontal multi-worker correctness as non-goals.

**Runtime rule:** label enqueue deduplication, attempt fencing, and business-effect
deduplication separately. Keep a stable operation key across retries, transmit it
through the effect boundary, require the receiver to return the prior result for that
key, and reconcile ambiguous timeouts before retrying a non-repeatable action.

- **Repo:** https://github.com/anduraio/runpin/tree/c55b71c8c03b4a285fc9d35cb1151856e048ee2d
- **Primary implementation:** [job creation and lease transitions](https://github.com/anduraio/runpin/blob/c55b71c8c03b4a285fc9d35cb1151856e048ee2d/src/db/jobs.ts), [worker heartbeat, abort, and retry loop](https://github.com/anduraio/runpin/blob/c55b71c8c03b4a285fc9d35cb1151856e048ee2d/src/worker/index.ts), and [HTTP callback payload](https://github.com/anduraio/runpin/blob/c55b71c8c03b4a285fc9d35cb1151856e048ee2d/src/handlers/index.ts)
- **Documented boundary:** [README non-goals and enqueue contract](https://github.com/anduraio/runpin/blob/c55b71c8c03b4a285fc9d35cb1151856e048ee2d/README.md) and [custom-runner contract](https://github.com/anduraio/runpin/blob/c55b71c8c03b4a285fc9d35cb1151856e048ee2d/docs/CUSTOM-RUNNERS.md)
- **Evidence level:** pinned source and documentation inspection at a new,
  two-star repository; no repository test files were present in the inspected tree,
  and no runtime reliability experiment was performed

## First-Class Agent Identity Makes Writes Accountable, Not Pre-Authorized — Sensefold (HN, September 2026)

Sensefold's account of replacing an embedded chat with a remote MCP server combines
several controls that are often discussed separately. Each OAuth connection or
headless Agent key is a distinct revocable principal rather than impersonating the
human account. A tier shapes the advertised tool list, while dispatch performs a
second capability check. Mutations produce attributed revisions; updates and soft
deletes require an `expectedVersion`; and create retries reuse a client-generated
UUID, with different content under the same UUID rejected. Together these controls
answer **which connection wrote what**, avoid silent overwrites, and give a person a
reviewable compensation path.

The combination is useful, but its limits matter. A fixed `edit` or `full` tier is
standing capability, not evidence that a human approved a particular write. Revision
history and Revert recover prior application state after a bad edit; they do not undo
external effects caused by content already read, exported, or acted on. The UUID
contract covers retried creates only if the client preserves the key, while
`expectedVersion` detects stale writes rather than validating their intent. Finally,
the public repository at the checked revision contains manifests and examples, not
the server implementation or tests, so the enforcement, attribution, and recovery
claims are product documentation rather than independently inspected behavior.

**Runtime rule:** treat per-connection identity, capability admission, concurrency
control, retry deduplication, attribution, and compensation as separate receipts.
Their composition makes unattended writes more diagnosable and recoverable, but a
high-impact effect still needs operation-specific authority before dispatch and an
explicit account of consequences that a local Revert cannot reverse.

- **HN source:** https://news.ycombinator.com/item?id=49729808
- **Article:** https://sensefold.app/blog/agent-as-first-class-user
- **Product contracts:** https://sensefold.app/docs/mcp-tools/ and https://sensefold.app/docs/connect/permissions/
- **Public repo:** https://github.com/SenseFoldLabs/sensefold-mcp/tree/d19c88c45ed5c0d2c42c269f4a9949bfd7def266
- **Evidence level:** full article and product documentation read; public repository
  tree inspected at the pinned revision; no server implementation, tests, live
  connection, or recovery experiment was available, and the HN item had one point
  and no comments at retrieval

## Focus Preservation Is Not Effect Authorization — macOS Harness (GitHub, September 2026)

`browser-use/macos-harness` is a deliberately thin desktop harness: one persistent
Python process exposes screenshots, PID-targeted keyboard and pointer events,
Accessibility operations, Apple Events, a real Chrome connection, and ordinary
filesystem and subprocess access. Its pinned implementation includes concrete
interaction-safety invariants. Input without an explicit app or prior snapshot is
refused; app-name ambiguity is rejected; permission checks fail closed when macOS
reports missing Accessibility, screen-capture, or event-posting access; and each
background input burst compares the frontmost application before and after. If the
target unexpectedly becomes frontmost, the harness raises `FocusChangedError`.
Project tests exercise both PID targeting and the focus-change stop.

Those are useful **delivery and interference controls**, not an authorization
boundary. The focus check runs after events have already been posted, so it can stop
a sequence but cannot retract the first click or keystroke. It detects one narrow
transition—the background target becoming frontmost—not whether the intended
semantic object was selected, whether an operation is irreversible, or whether the
agent was entitled to perform it. The skill itself tells the model to stop at
irreversible actions, while the security notice tells operators to review them;
that policy remains advisory. The same process also exposes `Path`, `subprocess`,
Apple Events, Accessibility mutation, and browser control without a task-scoped
allowlist or effect ledger.

The browser bridge makes the authority distinction especially visible. On first
connection it watches for Chrome's exact **“Allow remote debugging?”** window and
programmatically presses the `Allow` button through system-wide Accessibility.
Matching the exact window and button reduces accidental clicks, but automating a
consent UI is not evidence of contemporaneous user approval. It converts an OS
prompt into harness bootstrap behavior once the host already has sufficient
Accessibility authority.

**Runtime rule:** model desktop safety as at least three independent gates:
(1) capability admission for global OS permissions, (2) operation-specific intent
approval before consequential effects, and (3) post-action observation bound to the
same target and state. PID targeting and focus preservation improve delivery
precision, but must not be promoted into proof of intent, authorization, or effect
correctness. Consent dialogs should produce an explicit user-presence receipt rather
than being auto-accepted by the same principal requesting the capability.

- **Repo:** https://github.com/browser-use/macos-harness
- **Inspected revision:** [`b88e4d77403bbcac35752eef4f4dd72db3663fd6`](https://github.com/browser-use/macos-harness/commit/b88e4d77403bbcac35752eef4f4dd72db3663fd6)
- **Primary sources:** [runtime implementation](https://github.com/browser-use/macos-harness/blob/b88e4d77403bbcac35752eef4f4dd72db3663fd6/src/macos_harness/macos.py), [Chrome prompt bridge](https://github.com/browser-use/macos-harness/blob/b88e4d77403bbcac35752eef4f4dd72db3663fd6/src/macos_harness/browser.py), [agent skill](https://github.com/browser-use/macos-harness/blob/b88e4d77403bbcac35752eef4f4dd72db3663fd6/skills/macos-harness/SKILL.md), [security notice](https://github.com/browser-use/macos-harness/blob/b88e4d77403bbcac35752eef4f4dd72db3663fd6/SECURITY.md), and [focused tests](https://github.com/browser-use/macos-harness/blob/b88e4d77403bbcac35752eef4f4dd72db3663fd6/tests/test_macos.py)
- **Evidence level:** README, skill, security notice, implementation, and focused
  tests inspected at the pinned revision; repository tree was complete (35 entries).
  Scout did not run the macOS-only code, exercise a live application, or test the
  Chrome permission flow.
- **Discovery query:** GitHub Repository Search API `"agent" "LLM" in:name,description,readme created:>2026-08-15`, sorted by stars; `incomplete_results: false`

## A Workflow Document Is Not Its Durability Boundary — AgentRun (HN / GitHub, September 2026)

AgentRun is a new TypeScript DSL for moving recurring agent control flow into an
inspectable, schema-checked document. Its support example makes the split concrete:
a tool searches first, a typed judgment checks answer fitness and confidence, one
bounded agent attempt runs only when needed, the result is checked again, and an
unresolved case escalates instead of being returned as complete. Parallel branches,
bounded loops, child workflows, intermediate state paths, and final outputs have
explicit contracts. This is useful evidence for compiling repeatable control and
uncertainty handling out of open-ended prompts.

More important than the graph syntax is the project's explicit **host boundary**.
The interpreter does not bundle a durable scheduler, permission system, or exactly-once
delivery. The host supplies tools, file access, checkpoints, recovery stores,
idempotency, activation policy, and custody of delivered artifacts. Best-effort
`onEvent` observers cannot gate a result; required checkpoint hooks must do that.
Likewise, a valid workflow digest identifies the document but not the interpreter,
adapters, policy, or permissions that executed it, so those versions and receipts
must be retained separately for a recoverable run.

The effect path preserves one especially important distinction. When a deadline or
cancellation cuts off an admitted effect that is still pending, the runtime raises a
typed `EffectOutcomeUnknownError` and does not retry it automatically. Its settlement
promise can later report fulfillment or rejection through `effect.late_settled`, but
a late success is not promoted into the workflow result, memo, or checkpoint. For
nested maps, loops, branches, and children, effect identity includes an execution
path; recovery is rejected before effects begin unless the host declares path-aware
storage. These mechanics preserve uncertainty and location, but they still leave the
host responsible for observing the outside system before any retry.

**Runtime rule:** version and test an agent workflow as two coupled artifacts: the
control document and the host contract that grants capabilities, stores checkpoints,
keys nested effects, verifies outputs, and reconciles unknown outcomes. A typed,
inspectable graph can make escalation and ambiguity explicit; it does not by itself
make execution durable, effects exactly once, or artifact delivery complete.

The evidence is pinned documentation, implementation, and repository-authored tests
at a same-day beta release. Static inspection confirmed the unknown-outcome type,
late-settlement event, no-auto-retry path, and fail-closed path-aware recovery check.
Scout could not rerun the suite because `npm ci` failed against the local npm cache,
and the HN item had seven points and no comments at retrieval. This is therefore an
early implementation pattern, not production reliability or adoption evidence.

- **HN source:** https://news.ycombinator.com/item?id=49821438
- **Repo:** https://github.com/Parcha-ai/agentrun
- **Inspected revision:** https://github.com/Parcha-ai/agentrun/commit/89b6fff6493700ad097c2a016ad2396e3c8c79bc (`0.1.0-beta.3`)
- **Primary sources:** [workflow and limits guide](https://github.com/Parcha-ai/agentrun/blob/89b6fff6493700ad097c2a016ad2396e3c8c79bc/docs/guide.md), [host integration contract](https://github.com/Parcha-ai/agentrun/blob/89b6fff6493700ad097c2a016ad2396e3c8c79bc/docs/host-integration.md), [interpreter implementation](https://github.com/Parcha-ai/agentrun/blob/89b6fff6493700ad097c2a016ad2396e3c8c79bc/packages/dsl/src/workflow.ts), [runtime-boundary tests](https://github.com/Parcha-ai/agentrun/blob/89b6fff6493700ad097c2a016ad2396e3c8c79bc/packages/dsl/test/runtime-boundaries.test.mjs), and [nested-recovery tests](https://github.com/Parcha-ai/agentrun/blob/89b6fff6493700ad097c2a016ad2396e3c8c79bc/packages/dsl/test/nested-composition.test.mjs)
- **Discovery feed:** HN Algolia `search_by_date?query=AI%20agent&tags=story&numericFilters=created_at_i%3E%3D1790186458&hitsPerPage=50`

## Recovery Is Easier to Audit as a Pure Next-Step Projection — Kiso (GitHub, September 2026)

Kiso's recovery design turns an append-only session prefix into one deterministic
next action rather than maintaining a second mutable recovery state machine. At the
pinned revision, `deriveRecoveryPlan(events, scope)` has no clock, ID generation, or
I/O. It applies a fixed order: recognize terminal/completed runs, surface a started
execution with no receipt, void an uncommitted model draft, recover permission and
execution gaps, repair missing model-facing results from durable receipts, then
continue the model. The driver appends one derived repair and projects again. This
makes recovery idempotence a local property: if a repair write itself is lost, the
same prefix must derive the same repair instead of inventing another transition.

The important safety boundary is what the projection **cannot** know. The tool crash
matrix lands both “execution started but effect did not run” and “effect ran but its
receipt did not land” on the same durable prefix. Both therefore become
`RESOLVE_UNCERTAIN`; neither is automatically replayed. A human may abandon or rerun
that logical execution. By contrast, when a success or failure receipt exists but the
corresponding model-facing `tool_result` is absent, recovery repairs the result from
the receipt and does not invoke the tool again. Execution identity is framework-
generated (`executionId`), so a legitimate later call with the same tool name and
input remains a different operation rather than being swallowed by content-based
deduplication.

Kiso also separates an unfinished **model draft** from a potentially effected tool
call. A model suffix without a committed stop can be voided, but once a durable
`tool_execution_started` exists the call is no longer treated as discardable text;
receipt repair or uncertainty resolution owns it. Pending approvals survive only
when the invocation itself remains executable. This avoids resurrecting an approval
for a voided “ghost” call while preserving a decision that belongs to a committed
invocation.

The repository-authored crash matrix injects holds at persistence, model, tool, and
human boundaries, checks crash-before and crash-after prefixes, and includes crashes
of recovery's own repair appends. That is a useful testing pattern: define effect
boundaries, derive the expected next action from each durable cut, and verify that
reopening converges without silently turning an ambiguous effect into a retry. It is
not proof of production exactly-once behavior. Scout inspected pinned source, ADRs,
and tests but did not clone the repository, execute its suite, or reproduce a real
`kill -9`; the matrix is project-authored evidence, and human resolution still cannot
determine an external effect's outcome without provider-side reconciliation.

**Runtime rule:** make recovery a deterministic projection over admitted durable
facts, keep model-draft repair separate from effect repair, and test every effect
boundary on both sides of the crash cut. If two real-world outcomes share one durable
prefix, preserve that ambiguity as an explicit resolution obligation rather than
choosing the convenient replay path.

- **Repo:** https://github.com/vincemakes/kiso
- **Inspected revision:** https://github.com/vincemakes/kiso/commit/3f77d06741cb39e2e98d09d8f55afae6d3bfe0ee
- **Primary sources:** [recovery projection](https://github.com/vincemakes/kiso/blob/3f77d06741cb39e2e98d09d8f55afae6d3bfe0ee/packages/runtime/src/recovery-plan.ts), [execution identity and receipt repair ADR](https://github.com/vincemakes/kiso/blob/3f77d06741cb39e2e98d09d8f55afae6d3bfe0ee/docs/adrs/0025-execution-identity-and-crash-safe-recovery.md), [pure-projection ADR](https://github.com/vincemakes/kiso/blob/3f77d06741cb39e2e98d09d8f55afae6d3bfe0ee/docs/adrs/0048-recovery-as-projection.md), [crash matrix](https://github.com/vincemakes/kiso/blob/3f77d06741cb39e2e98d09d8f55afae6d3bfe0ee/packages/runtime/tests/crash-matrix.test.ts), and [purity checks](https://github.com/vincemakes/kiso/blob/3f77d06741cb39e2e98d09d8f55afae6d3bfe0ee/packages/runtime/tests/recovery-purity.test.ts)
- **Discovery query:** GitHub Repository Search API `topic:ai-agent pushed:>2026-09-24 stars:>20`, sorted by updated; `total_count: 160`, `incomplete_results: false`

## Pausing Work Must Not Reuse Execution Authority — LoopX (GitHub, September 2026)

LoopX's hard-lease Todo lifecycle exposes a subtle control-plane distinction: an
owner-directed pause is neither completed work nor another execution attempt. At the
pinned revision, its narrow `open` ↔ `blocked` path accepts only a status, a non-empty
reason, and clearing the old resume condition. It rejects bundled content edits and
execution-lease proofs, refuses to pause while a lease is active, and requires a
registered actor. If a retained lease is expired but not yet released, the same
provider compare-and-set writes the blocked Todo and retires that lease; reopening
still grants no execution authority and requires a fresh lease.

This is stronger than changing a status label and cleaning up authority later. A
separate lease write would leave a crash window in which the task says “blocked”
while the old holder still appears authorized, or the lease is gone before the pause
is durable. The transition also preserves claim ownership, validation requirements,
and successor links while clearing the prior wait and its derived readiness. That
prevents “pause” from being misread as delivery, reassignment, dependency
satisfaction, or permission to continue.

**Runtime rule:** model pause/resume as lifecycle transactions, not work receipts.
Reject a pause while execution authority is live; atomically retire only inactive
authority with the status transition; preserve ownership and acceptance topology;
and require a newly acquired execution grant after reopen. Stable operation identity
and provider revision checks make retries recoverable without turning a repeated
pause into a second semantic action.

Scout inspected pinned documentation, TypeScript implementation, and repository-
authored file/SQLite parity tests but did not clone the repository or execute its
suite. The tests establish authored coverage for expired-lease retirement, replay,
intent mismatch, stale-wait clearing, reopen, live-lease rejection, and bundled-edit
rejection—not production linearizability or behavior of an independently deployed
provider.

- **Repo:** https://github.com/loopx-project/loopx
- **Inspected revision:** https://github.com/loopx-project/loopx/commit/ab83c672b9e11bb2cabb446bafeef838639472bb
- **Primary sources:** [hard-lease lifecycle implementation](https://github.com/loopx-project/loopx/blob/ab83c672b9e11bb2cabb446bafeef838639472bb/loopx/control_plane/coordination/todo_blocked_lifecycle.ts), [atomic update integration](https://github.com/loopx-project/loopx/blob/ab83c672b9e11bb2cabb446bafeef838639472bb/loopx/control_plane/coordination/todo_update.ts), [admission checks](https://github.com/loopx-project/loopx/blob/ab83c672b9e11bb2cabb446bafeef838639472bb/loopx/control_plane/coordination/todo_update_admission.ts), [lifecycle contract](https://github.com/loopx-project/loopx/blob/ab83c672b9e11bb2cabb446bafeef838639472bb/docs/project-agent-todo-contract.md), and [file/SQLite tests](https://github.com/loopx-project/loopx/blob/ab83c672b9e11bb2cabb446bafeef838639472bb/tests/control_plane_ts/blocked_hard_lease_lifecycle.test.ts)
- **Discovery query:** GitHub Repository Search API `topic:ai-agents pushed:>2026-09-24 stars:>10`, sorted by updated; `total_count: 726`, `incomplete_results: false`
