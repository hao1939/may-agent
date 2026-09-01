<ai_context>
summary: "Companion to agent-runtime-hardening.md for cross-source runtime integrity patterns: revision-bound workspace admission, evidence-carrying effect closure, authorization retained through ambiguous delivery, outbound publication reconciliation, history/context separation, crash-safe continuation, verification evidence bound to its subject, explicit unattended-execution trust boundaries, replay consistency versus effect completeness, and why local durability markers cannot guarantee remote effects."
triggers: ["runtime effect integrity", "revision-bound admission", "persistent workspace", "effect closure", "post-actuation observation", "actuation receipt", "stateful authorization", "AID-Guard", "reservation lineage", "certified no effect", "delivery fence", "outbound publication", "posting claim", "ambiguous delivery", "PR Cockpit", "event-sourced agent runtime", "context projection", "crash recovery", "safe resume", "replay divergence", "host-call journal", "Ovo runtime", "LetItLoop", "atomic marker", "at-least-once step", "Apache Maka", "desktop harness", "verification subject binding", "Brigade", "Docker Sandboxes", "microVM isolation", "credential proxy", "shared skills trust boundary"]
last_updated: "2026-08-27"
source_basis: "Extracted intact from agent-runtime-hardening.md during its oversized-note review. Sources are the linked Scout findings; xfreeze2/desktop-harness revision 57739ae71c563a9856a7a9a376435d17861099ef and its verify helper, skill, safety gate, and media-control postmortem; Brigade revision 0e8b83ae6ef779bb6be8701dd4cd534c064608f9; HN 49239751; Docker's product, security-model, default-posture, and credential documentation; Apache Maka revision 52c0e3275eae053ea5a221cefdd3be09bbfb46da, including its runtime-core, compaction, and resume architecture documents; qntx/ovo revision 929d39b03d2c3228e2f3fdff21d1ebc928fb1c14, especially its workflow journal, validator, resume example, and runtime host adapter; arXiv 2608.21159v1 (AID-Guard), checked through the arXiv API and full HTML paper; taovc/pr-cockpit revision 5b8ccc8c511ad3393b339e51dde68fcb3edee684, especially its review publication endpoint, GitHub posting helper, and architecture contract; and HN 49462893 plus sdageltc/letitloop revision c5bc40236f405d80572507064cca6bdd7e59a3d9, especially its README, durable decorators, and crash-window scenarios."
</ai_context>

# Agent Runtime Effect Integrity

**Companion note** to [Agent Runtime Hardening](./agent-runtime-hardening.md).

These patterns cover the boundary after an agent has been granted execution:
which revision enters a persistent workspace, what evidence closes an effect,
what work a verification receipt actually proves, and where an unattended
sandbox's trust boundary ends.

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

- **Repo:** https://github.com/apache/maka
- **Inspected revision:** [`52c0e3275eae053ea5a221cefdd3be09bbfb46da`](https://github.com/apache/maka/commit/52c0e3275eae053ea5a221cefdd3be09bbfb46da)
- **Primary sources:** [runtime core](https://github.com/apache/maka/blob/52c0e3275eae053ea5a221cefdd3be09bbfb46da/docs/architecture/runtime-core-architecture-draft.md), [compaction as projection](https://github.com/apache/maka/blob/52c0e3275eae053ea5a221cefdd3be09bbfb46da/docs/architecture/llm-compaction-events-log-projection-draft.md), and [safe resume](https://github.com/apache/maka/blob/52c0e3275eae053ea5a221cefdd3be09bbfb46da/docs/architecture/runtime-resume-architecture.md)

## Verification-Evidence Binding — Brigade (GitHub, August 2026)

[Brigade](./findings/2026-08-09-brigade-receipt-subject-binding.md) adds a
useful boundary to runtime verification: a real process exit code proves that a
check ran, but does not by itself prove **which work passed**. Its version-2
receipt schema records baseline commit, tree fingerprint, and patch digest;
missing identity data remains explicit rather than being silently upgraded into
patch proof.

Brigade reserves scoreable `subject_binding` for tracked, manifest-selected
runs. That binding ties the named artifact and content fingerprint to the
verifier manifest, patch source, producer-owned delta, and independent verifier.
Ad hoc command receipts remain audit-only even when they are durable or signed.
The implementation also avoids shell execution for verification commands and
retains the local receipt if archival fails.

**Runtime rule:** treat verification evidence as a typed ladder:

1. execution receipt — the command and exit status are real;
2. state binding — baseline, tree, and patch identity are known;
3. subject binding — the artifact and approved verifier are named;
4. authority separation — producer and verifier identities are distinct; and
5. outcome admission — only evidence satisfying the required rung may change
   promotion, routing, or completion state.

This sharpens the effect-closure rule above. Cryptographic integrity can show
that a receipt was not altered, but semantic binding determines what claim the
receipt may support. The evidence is architecture and implementation evidence
from Brigade's own repository at revision
`0e8b83ae6ef779bb6be8701dd4cd534c064608f9`, not an independent reliability
benchmark.

- **Primary sources:** [receipt schema](https://github.com/escoffier-labs/brigade/blob/main/docs/receipt-schemas.md),
  [execution model](https://github.com/escoffier-labs/brigade/blob/main/docs/execution-model.md),
  [outcome scoring](https://github.com/escoffier-labs/brigade/blob/main/docs/outcome-scoring.md),
  and [verification implementation](https://github.com/escoffier-labs/brigade/blob/main/src/brigade/work_cmd/verification.py).

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

## Replay Consistency Is Not Effect Completeness — Ovo (GitHub, August 2026)

Ovo's journaled Rhai workflow mode supplies a compact implementation of deterministic **host-call replay**. Each call is assigned a dense sequence number and a hash over its kind plus canonicalized request JSON. On resume, a matching entry returns the recorded result without calling the model again; a changed kind or request hash fails as replay divergence. The v2 append-only JSONL journal also has a format header, byte and entry ceilings, symlink rejection, synchronous appends, and repair for an incomplete final line. A repository example asserts that a two-agent workflow makes two samples initially and zero new samples when replayed.

This is a useful middle layer between rerunning a free-form agent and adopting a full durable-execution backend: the script remains readable control flow, while nondeterministic agent calls become memoized host boundaries. Dry-run validation separately compiles and executes a script against a model-free probe host, and the runtime exposes typed paused, budget-exceeded, cancelled, failed, and completed outcomes.

The safety boundary is narrower than the word “journal” may suggest. Entries contain the request hash and the host's returned JSON, but no signature, script or argument digest, dispatch-before-effect marker, idempotency key, or post-crash reconciliation status. The scratch-file and git-diff helpers also execute in the host adapter rather than appearing in this replay journal. A valid replay therefore establishes **call-order and request consistency for covered calls**, not that the journal is untampered, that every side effect was captured, or that an external effect completed. In particular, a crash after an effect crosses its boundary but before its result is appended retains the same unknown interval identified in Apache Maka's safe-resume design above.

**Runtime rule:** treat request-hashed replay as one rung in a continuation ladder:

1. script validation establishes that one probe path compiles and terminates acceptably;
2. request-hash matching establishes that covered host calls were reissued in the same order with the same canonical payload;
3. authenticated journal provenance establishes who produced an unmodified record;
4. dispatch/result facts establish whether a crash left an effect indeterminate; and
5. effect-specific observation or reconciliation establishes whether the outside world reached the intended state.

Ovo currently demonstrates rungs 1–2, with useful bounded-load and torn-write defenses. It should not be credited with rungs 3–5 without additional host-owned controls. This assessment is source inspection at one tagged repository revision, not an independent reliability or security benchmark; the environment lacked Cargo, so Scout could not execute the repository's supplied tests or resume example.

- **Repo:** https://github.com/qntx/ovo
- **Inspected revision:** https://github.com/qntx/ovo/commit/929d39b03d2c3228e2f3fdff21d1ebc928fb1c14 (`v0.9.1`)
- **Primary sources:** [journal and replay](https://github.com/qntx/ovo/blob/929d39b03d2c3228e2f3fdff21d1ebc928fb1c14/crates/ovo-workflow/src/journal.rs), [dry-run validator](https://github.com/qntx/ovo/blob/929d39b03d2c3228e2f3fdff21d1ebc928fb1c14/crates/ovo-workflow/src/validate.rs), [resume example](https://github.com/qntx/ovo/blob/929d39b03d2c3228e2f3fdff21d1ebc928fb1c14/crates/ovo/examples/workflow_resume.rs), and [runtime host adapter](https://github.com/qntx/ovo/blob/929d39b03d2c3228e2f3fdff21d1ebc928fb1c14/crates/ovo-runtime/src/workflow_host.rs)

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
