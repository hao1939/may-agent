<ai_context>
summary: "Companion to agent-runtime-unattended-execution-and-replay.md for replay evidence and boundary design: operation-specific replay claims, cut-point regression replay, interaction-identity preservation, model-fixture key scope, request-hashed host-call replay, and the separation of model, workspace, tool, effect, and evidence planes."
triggers: ["agent replay", "replay taxonomy", "GenOS", "cut-point replay", "Chronicle", "interaction replay", "Mutagen", "model fixture", "replay key", "Weft", "host-call replay", "Ovo", "offline replay", "OrcaReplay", "replay evidence", "replay boundary", "effect safety"]
last_updated: "2026-09-27"
source_basis: "Extracted intact from agent-runtime-unattended-execution-and-replay.md during its 2026-09-24 oversized-note review, then extended with pinned Weft and GenOS implementation evidence about replay scope, match keys, and claim vocabulary. Each section retains stable source links, pinned revisions where applicable, reproduced checks where performed, and explicit evidence limitations."
</ai_context>

# Agent Runtime Replay Evidence and Boundaries

**Companion note** to [Agent Runtime Unattended Execution and Replay](./agent-runtime-unattended-execution-and-replay.md).
The parent retains lifecycle-bound resume identity, unattended cadence, approval and
effect settlement, accountable writes, desktop authorization, and workflow/host
recovery. This note isolates what replay records must preserve, which boundaries a
candidate revision should re-execute, and why deterministic replay does not establish
external-effect safety.

## “Replay” Needs an Operation-Specific Completion Vocabulary — GenOS (GitHub, September 2026)

GenOS exposes several operations under the replay label, and their differences make
a useful API-design pattern. Its trace endpoint sorts recorded spans, hashes their
canonical representation, and returns them as `RECONSTRUCTED`; crucially, it also
sets `replayVerified: false`, `qualityGuarantee: false`, and
`requiresReexecution: true`. Its agent-state endpoint is a different operation: in
preview mode it compares a snapshot digest with a projection of the current live
row, while `apply: true` writes the snapshot fields and then re-reads the row before
reporting `completed` or `verification_failed`. Neither path re-executes the agent's
decisions or tools.

A third “causal replay” service does less still. It partitions supplied events at
checkpoint markers, selects the penultimate segment, and emits a success receipt,
but the receipt explicitly says `stateRestored: false`; no state is restored and no
event is re-executed. The run replay manifest likewise captures prompt, model,
contract version, policies, budget, executable, workspace path, and only the
**names** of allowed environment variables—not their values or digests. It is useful
launch metadata, but not a content-complete reproduction capsule.

**Runtime rule:** make replay completion predicates operation-specific and
machine-readable. Distinguish at least `manifest-captured`, `trace-reconstructed`,
`state-previewed`, `state-restored-and-read-back`, and `behavior-reexecuted`; attach
the exact subject digest and explicit omitted inputs to each. A generic success
receipt must not outrank a negative capability field such as `stateRestored: false`,
and a deterministic hash over recorded output proves reconstruction identity, not
behavioral equivalence or external-effect safety.

This assessment is static inspection of one pinned revision. Repository-authored
tests assert the trace caveats, manifest secret-name filtering, and snapshot/live
hash comparison, but Scout could not execute them because the downloaded archive
lacked installed `sqlite3` and `protobufjs` dependencies. The repository had one
star at discovery; these are inspectable interface semantics, not evidence that the
large runtime is production-ready or that its replay paths are complete.

- **Repo:** https://github.com/PISSARAW/GenOS
- **Inspected revision:** [`5b9d296bec36f6928225cdc6281a03eb61dc5fe5`](https://github.com/PISSARAW/GenOS/commit/5b9d296bec36f6928225cdc6281a03eb61dc5fe5)
- **Primary sources:** [trace reconstruction and explicit non-guarantees](https://github.com/PISSARAW/GenOS/blob/5b9d296bec36f6928225cdc6281a03eb61dc5fe5/backend/src/controllers/traceController.js), [snapshot preview/apply verification](https://github.com/PISSARAW/GenOS/blob/5b9d296bec36f6928225cdc6281a03eb61dc5fe5/backend/src/controllers/lineage/replay.js), [checkpoint selection without restoration](https://github.com/PISSARAW/GenOS/blob/5b9d296bec36f6928225cdc6281a03eb61dc5fe5/backend/src/services/search/causalReplayService.js), [run-manifest field coverage](https://github.com/PISSARAW/GenOS/blob/5b9d296bec36f6928225cdc6281a03eb61dc5fe5/backend/src/services/agentProcessOutcome.js), and [trace semantics test](https://github.com/PISSARAW/GenOS/blob/5b9d296bec36f6928225cdc6281a03eb61dc5fe5/backend/tests/test_trace_replay_semantics.js)
- **Discovery query:** GitHub Repository Search API `topic:ai-agents pushed:>=2026-09-20`, sorted by updated; `total_count: 19916`, `incomplete_results: false`

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

## A Green Model Replay Is Only as Sensitive as Its Match Key — Weft (GitHub, September 2026)

Weft's pinned test helper makes one replay boundary inspectable: it records each
model request and event stream as readable JSON, then substitutes the recorded
model events while leaving the agent loop, middleware, approvals, and deterministic
test tools live. Missing keys fail loudly, repeated identical requests are consumed
in recorded order, recording replaces a test's fixture directory rather than merging
stale entries, and abandoned or failed streams remain visible in the fixture. Those
are useful controls against silent fixture reuse.

The important qualification is what counts as the “same” request. At revision
`6da758c13508588926569684f58ec9f002e0e0f1`, the key covers transcript messages,
sorted tool names, thinking configuration, tool choice, and the sequential-tools
flag. It deliberately excludes the system prompt, tool descriptions, and tool
schemas. The complete system prompt is stored for human diff review, but replay
reconstructs its key from the reduced request document; the project-authored
`TestReplayKeyIgnoresSystem` confirms that two different system prompts consume the
same fixture queue. Consequently, changing instructions or a same-named tool's
contract can leave offline replay green without exercising the model's response to
that change. Readable fixtures and deliberate re-recording mitigate this only when a
reviewer notices the drift; they are not automatic invalidation.

Fixture order is part of the matching contract too. The recorder numbers files and
the replayer loads the directory in lexical order before grouping by key. The current
revision widened the sequence pad from three to five digits after recognizing that
`1000-…` sorted before `999-…`, which could reverse repeated identical requests
across that boundary. Old recordings still load because matching uses the key inside
the file, but the episode shows that deterministic output can still be bound to the
wrong historical occurrence when storage order and logical order diverge.

**Runtime rule:** publish the replay match function as part of the test claim. Bind
fixtures to every input whose change should invalidate model behavior—including
instruction and tool-contract revisions—or require an explicit re-record receipt
when an intentionally excluded field changes. Separately preserve occurrence order
with a numeric field or parsed sequence rather than relying on filename lexical
order. A green model replay proves only that the candidate matched this declared key
and consumed these recorded events; it does not prove prompt sensitivity, provider
behavior, or external-effect safety.

Scout statically inspected the pinned implementation, ADRs, and repository-authored
tests. The environment did not provide the Go toolchain, so Scout could not run the
focused replay tests. The repository had one star at retrieval; this is an early,
source-visible testing pattern rather than evidence of broad adoption or production
reliability.

- **Repo:** https://github.com/weftgo/weft
- **Inspected revision:** https://github.com/weftgo/weft/commit/6da758c13508588926569684f58ec9f002e0e0f1
- **Primary sources:** [request key, recorder, and replayer](https://github.com/weftgo/weft/blob/6da758c13508588926569684f58ec9f002e0e0f1/wefttest/replay.go), [replay contract tests](https://github.com/weftgo/weft/blob/6da758c13508588926569684f58ec9f002e0e0f1/wefttest/replay_test.go), and [testing-conventions ADR](https://github.com/weftgo/weft/blob/6da758c13508588926569684f58ec9f002e0e0f1/docs/adr/0017-testing-conventions.md)
- **Discovery query:** GitHub Repository Search API `AI agent trace replay deterministic in:name,description,readme pushed:>2026-09-20`, sorted by updated; `total_count: 4300`, `incomplete_results: false`

## Replay Consistency Is Not Effect Completeness — Ovo (GitHub, August 2026)

Ovo's journaled Rhai workflow mode supplies a compact implementation of deterministic **host-call replay**. Each call is assigned a dense sequence number and a hash over its kind plus canonicalized request JSON. On resume, a matching entry returns the recorded result without calling the model again; a changed kind or request hash fails as replay divergence. The v2 append-only JSONL journal also has a format header, byte and entry ceilings, symlink rejection, synchronous appends, and repair for an incomplete final line. A repository example asserts that a two-agent workflow makes two samples initially and zero new samples when replayed.

This is a useful middle layer between rerunning a free-form agent and adopting a full durable-execution backend: the script remains readable control flow, while nondeterministic agent calls become memoized host boundaries. Dry-run validation separately compiles and executes a script against a model-free probe host, and the runtime exposes typed paused, budget-exceeded, cancelled, failed, and completed outcomes.

The safety boundary is narrower than the word “journal” may suggest. Entries contain the request hash and the host's returned JSON, but no signature, script or argument digest, dispatch-before-effect marker, idempotency key, or post-crash reconciliation status. The scratch-file and git-diff helpers also execute in the host adapter rather than appearing in this replay journal. A valid replay therefore establishes **call-order and request consistency for covered calls**, not that the journal is untampered, that every side effect was captured, or that an external effect completed. In particular, a crash after an effect crosses its boundary but before its result is appended retains the same unknown interval identified in [Apache Maka's safe-resume design](./agent-runtime-effect-integrity.md#history-fidelity-and-execution-safety-are-orthogonal--apache-maka-github-august-2026).

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

