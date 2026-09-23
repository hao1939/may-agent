<ai_context>
summary: "Companion to agent-runtime-effect-integrity.md for unattended execution and replay integrity: cadence and failure accounting, infrastructure trust boundaries, clone identity hygiene, cut-point and interaction-bound replay, local durability versus external settlement, revision-bound approval, accountable agent writes, and desktop effect authorization."
triggers: ["unattended execution", "heartbeat", "failure backoff", "Talon", "Docker Sandboxes", "sandbox trust boundary", "clone identity", "LingCage", "cut-point replay", "Chronicle", "interaction replay", "Mutagen", "host-call replay", "Ovo", "offline replay", "OrcaReplay", "effect settlement", "LetItLoop", "Kevlar", "ATR", "approval revision", "AIS", "orphan recovery", "Rebuno", "approval resume", "AgenticOS", "diagnostic attention", "Runpin", "effect deduplication", "agent identity", "Sensefold", "desktop authorization", "macOS Harness"]
last_updated: "2026-09-23"
source_basis: "Extracted intact from agent-runtime-effect-integrity.md during its 2026-09-21 oversized-note review, then extended with pinned implementation evidence for unattended cadence and failure accounting. Each section retains stable source links, reproduced checks where performed, and explicit evidence limitations."
</ai_context>

# Agent Runtime Unattended Execution and Replay

**Companion note** to [Agent Runtime Effect Integrity](./agent-runtime-effect-integrity.md).
The parent retains revision admission, guarded writes, ambiguous-delivery recovery,
resource quarantine, and core effect-closure patterns. This note covers the trust
boundaries and settlement evidence needed when execution continues unattended or
is replayed after interruption.

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

## Cut-Point Replay Turns Incidents Into Boundary-Explicit Regression Tests — Chronicle (arXiv, September 2026)

Chronicle addresses a narrower problem than whole-agent reproducibility: testing
whether changed runtime code still prevents a previously recorded failure. It
records nondeterministic boundaries as immutable envelopes, then uses
**cut-point replay** to serve a selected subset from the incident record while
executing the complementary boundaries live. This lets a regression test hold
model responses and changing dependencies fixed while deliberately re-running
the tool or guard code under review.

The abstract reports a six-failure benchmark with simulated model boundaries.
Full replay made zero model calls and was bit-stable across 20 repetitions;
cut-point tests failed on faulty code and passed on guarded and benign changes
for all six incidents. In a mutation study of guarded tools, cut-point tests
caught every mutant that allowed the recorded unsafe action, while a baseline
that stubbed every boundary caught none—even though both used the same
assertion. The important signal is not the small perfect score but the test
architecture: a replay can erase the very implementation path a patch needs to
exercise if it stubs too much.

**Runtime rule:** an incident regression should declare which envelopes are
frozen evidence and which boundaries execute the candidate revision. Full
replay is appropriate for trace stability; cut-point replay is appropriate for
asking whether a changed component now handles the same antecedent conditions.
Neither establishes safety outside the recorded boundary set, and live
external effects still need sandboxing, idempotency, or reconciliation.

These are author-reported, abstract-only results from a six-incident benchmark
with simulated model boundaries. Scout did not inspect the repository, execute
the benchmark, or verify how the immutable-envelope and live-effect guarantees
are implemented, so this is a promising test-design signal rather than an
independent validation.

- **Source:** https://arxiv.org/abs/2609.20625v1
- **Repository named in the abstract:** https://github.com/theagentplane/chronicle
- **Coverage:** arXiv API title and abstract only

## Lossy Interaction Records Can Make Candidate Replay Lie — Mutagen (GitHub, September 2026)

Mutagen is an unusually restrained signal among repositories promising agent
self-improvement. Its README explicitly says the project does not yet run an
agent, call a model, or self-evolve. At pinned revision
`21b755b44eed7cf5ea53fb7d9dbab6bf3612a9a8`, the implemented research artifacts
instead test two narrow prerequisites for comparing a changed agent against
recorded experience.

The first synthetic experiment puts all environment reads behind an observation
lookup. Replaying the recorded observation reproduces the historical decision
despite environment drift, and a changed candidate that requests an unrecorded
observation fails explicitly rather than consulting live state. The second
experiment ablates three parts of the interaction record:

- dropping argument identity can attach `read("alpha")`'s outcome to
  `read("beta")` after the candidate reorders calls;
- collapsing repeated identical calls into one mapping erases the transition
  from `pending` to `ready`; and
- retaining only successful values makes an error-dependent historical branch
  unreplayable.

The implementation makes the important failure visible. Its full lookup binds
outcomes by operation, argument, and per-call occurrence; missing records and
external errors are distinct result variants. In the argument ablation, a strict
policy reports ambiguity while a deterministic first-match policy returns a
plausible but wrong sequence. Determinism is therefore not enough: replay can be
stable while silently evaluating the candidate against observations that belong
to different historical interactions.

**Runtime rule:** preserve enough interaction identity to bind each replayed
outcome to the call that produced it, including repeated occurrences and error
outcomes. If a changed trajectory introduces an unrecorded interaction or makes
historical matching ambiguous, fail closed and classify the comparison as
unsupported rather than falling through to live state or choosing a convenient
match. This record-level rule complements effect reconciliation; it does not make
external side effects safe to re-execute.

The evidence is deliberately local. Both experiments use private, in-memory Rust
scaffolding and three hand-constructed deterministic fixtures. They do not cover
LLM stochasticity, prompts or context, persistence, concurrency, side effects,
revision identity, promotion, rollback, or cross-domain generalization. The
repository documents three byte-identical runs and its examples contain assertions
for every reported metric, but Scout could not independently rerun them because
`cargo` is unavailable in the supplied environment. The repository was created the
day before inspection and had zero stars; this is careful experiment design, not
adoption or production validation.

- **Repo:** https://github.com/z-chenhao/Mutagen
- **Inspected revision:** [`21b755b44eed7cf5ea53fb7d9dbab6bf3612a9a8`](https://github.com/z-chenhao/Mutagen/commit/21b755b44eed7cf5ea53fb7d9dbab6bf3612a9a8)
- **Primary sources:** [scope and explicit non-claims](https://github.com/z-chenhao/Mutagen/blob/21b755b44eed7cf5ea53fb7d9dbab6bf3612a9a8/README.md), [observation-boundary experiment](https://github.com/z-chenhao/Mutagen/blob/21b755b44eed7cf5ea53fb7d9dbab6bf3612a9a8/docs/experiments/0001-replay-boundary.md), [record-ablation experiment](https://github.com/z-chenhao/Mutagen/blob/21b755b44eed7cf5ea53fb7d9dbab6bf3612a9a8/docs/experiments/0002-replay-record-ablation.md), and [ablation implementation](https://github.com/z-chenhao/Mutagen/blob/21b755b44eed7cf5ea53fb7d9dbab6bf3612a9a8/crates/mutagen-runtime/examples/exp_0002_replay_record_ablation.rs)
- **Discovery query:** GitHub Repository Search API `"AI agent" in:name,description created:>=2026-09-20`, sorted by updated; `total_count: 1046`, `incomplete_results: false`

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

## Offline Model Replay Still Re-executes Tool Effects — OrcaReplay (GitHub, September 2026)

OrcaReplay captures model exchanges, process output, selected MCP traffic, and
per-turn filesystem snapshots, then can serve the recorded model responses
again without calling the model provider. Its checkpoint contract is unusually
explicit: a fork point must have a filesystem snapshot and a complete model
request/response prefix; an invalid requested point snaps to an earlier valid
checkpoint with a warning. Exact replay also restores the recorded starting
workspace, runs the harness, and normally restores the operator's prior tree in
a `finally`. Fork manifests carry the parent run, fork point, and substituted
model, and project-authored tests check those fields against the normative
schema.

That makes model and workspace replay easy to mistake for whole-run isolation.
The implementation instead launches the agent process again, and states that
“everything that is not a model call” runs live. A repeated shell command can
contact the network, an MCP server can fetch outside the proxy, and any remote
mutation can happen again. Even the default `egress=blocked` label applies to
unmatched **model-proxy** requests: tool-owned sockets bypass that boundary by
default. `--tls-intercept` widens observation only for configured hosts; hosts
off its interception list are tunnelled rather than blocked. The project
therefore accurately warns that replay is not a sandbox.

The reversible workspace path is valuable but narrower still. Before replacing
the recorded directory, it snapshots the operator's current tree to a scratch
store, preflights that both directions are restorable, and keeps the scratch
copy if restoration fails. This can make a successful replay observationally
neutral for captured local files. It cannot roll back email, deployments,
payments, database writes, network calls, or files outside the captured roots.
An “exact” result reports request matching and model-response reuse—not a
claim that the external world was frozen or that effects were repeated safely.
Likewise, a fork that holds model prefix and workspace constant is not a
one-variable model experiment unless mutable tools, services, time, and random
inputs are controlled separately.

**Runtime rule:** report replay guarantees by plane:

1. **model plane** — which responses were served from the trace and whether any
   unmatched request reached a live provider;
2. **workspace plane** — which roots were restored, what was excluded, and
   whether the operator's pre-replay state was put back;
3. **tool plane** — which calls were replayed from frames versus executed live;
4. **effect plane** — which external actions were sandboxed, made idempotent, or
   reconciled after the run; and
5. **evidence plane** — trace integrity, provenance, redaction policy, and
   disclosure boundary.

OrcaReplay provides strong inspectable machinery for the first two planes and
usefully exposes parts of the third; it does not collapse them into effect
safety. Its manifest hashes `events.jsonl`, but that checksum is not an origin
signature, and `scrub` intentionally rewrites the trace and refreshes the
integrity digest. The repository also treats traces as sensitive: redaction is
best effort, MCP frame files are not redacted, and content-addressed filesystem
snapshots cannot be scrubbed in place. This assessment inspected pinned source,
the format specification, and project-authored tests; Scout did not execute a
live replay, fork, TLS-interception flow, or external-effect negative control.

- **Repo:** https://github.com/Continuum-AI-Corp/OrcaReplay
- **Inspected revision:** https://github.com/Continuum-AI-Corp/OrcaReplay/commit/b4df94160d29759a610eeb6ad0e815facd11d9b5
- **Primary sources:** [replay and workspace-restore implementation](https://github.com/Continuum-AI-Corp/OrcaReplay/blob/b4df94160d29759a610eeb6ad0e815facd11d9b5/packages/cli/src/commands/replay.ts), [trace specification](https://github.com/Continuum-AI-Corp/OrcaReplay/blob/b4df94160d29759a610eeb6ad0e815facd11d9b5/spec/orca-trace-v0.md), [security boundary](https://github.com/Continuum-AI-Corp/OrcaReplay/blob/b4df94160d29759a610eeb6ad0e815facd11d9b5/SECURITY.md), and [fork-provenance tests](https://github.com/Continuum-AI-Corp/OrcaReplay/blob/b4df94160d29759a610eeb6ad0e815facd11d9b5/packages/cli/test/fork-provenance.test.ts)
- **Discovery query:** GitHub Repository Search API `"AI agent" "sandbox" in:name,description,readme created:>2026-08-15`, sorted by stars; `incomplete_results: false`

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
