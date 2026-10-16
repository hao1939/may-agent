<ai_context>
summary: "Companion to agent-runtime-unattended-execution-and-replay.md for workflow and control-plane recovery boundaries: host-owned durability, trace-compilation limits, deterministic recovery projections, pause-versus-execution authority, receipt-bound action selection, and fresh-state checks after concurrency fences."
triggers: ["AgentRun", "workflow DSL", "late settlement", "Hotpath", "trace compilation", "workflow drift", "Kiso", "recovery projection", "crash matrix", "LoopX", "hard lease", "agent pause", "lease retirement", "host-owned turn", "action selection", "receipt binding", "concurrent admission", "fresh-state recovery"]
last_updated: "2026-10-16"
source_basis: "Extracted intact from agent-runtime-unattended-execution-and-replay.md during its 2026-10-01 oversized-note review, then extended with pinned LoopX evidence on host-owned Turn selection and concurrent recovery admission. Each section retains stable source links, pinned revisions, inspected implementation or repository-authored test evidence, and explicit execution limitations."
</ai_context>

# Agent Runtime Workflow and Control-Plane Recovery

**Companion note** to [Agent Runtime Unattended Execution and Replay](./agent-runtime-unattended-execution-and-replay.md). This note isolates reusable boundaries for declarative workflow hosts, trace compilation, deterministic crash recovery, and pause/lease lifecycle transactions.

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

## Compiling One Trace Freezes More Than the Happy Path — Hotpath (HN / GitHub, October 2026)

Hotpath is an early TypeScript prototype that records an agent's stdio MCP calls,
compiles one trace into an editable straight-line JSON workflow, and substitutes a
cheaper model only for text arguments that look model-written. Inputs and values
copied from prior tool results become templates; tool results receive inferred JSON
Schema guards. On schema drift before any side effect, the runtime reruns the agent,
compiles its new trace, and preserves the previous workflow as a backup. It refuses
to replace the workflow when the fresh trace has lost a prior read-only tool unless
an operator passes `--accept-recompile`.

That mechanism usefully makes repeated work inspectable, but its compiler also shows
why a successful trace is not a complete workflow specification. Every MCP tool
without `readOnlyHint: true` is classified as side-effecting. Calls that returned an
error are omitted, including unrecovered failures; branches and loops are not
represented. Tool guards check the *shape* inferred from the recorded result, not
business correctness. The LLM grounding guard covers only sufficiently long scalar
values that the recorded example happened to mention; if a path disappears at run
time there is nothing to check. A passing replay therefore establishes conformance
to selected properties of one trace, not equivalence to the agent's policy,
coverage, or judgment.

The side-effect boundary is more conservative. Once a side-effecting tool has run,
a later drift failure will not fall back to the agent because that could repeat the
effect. This avoids automatic duplication, but it leaves settlement and recovery to
an operator; there is no provider idempotency or external reconciliation layer. The
`--dry-run` mode skips tools marked side-effecting and prints their arguments, but
its safety depends on truthful MCP annotations and classification.

**Runtime rule:** treat trace compilation as a candidate optimization under an
independent contract. Review which failed calls, branches, reads, invariants, and
effects the trace omitted; preserve the source trace and workflow revision; validate
semantic outputs separately from inferred shape; and stop for reconciliation after
an admitted effect rather than interpreting “no fallback” as settlement.

The repository's benchmark reports 3–5x speedups and 10–13x lower modeled cost on two
small fake tasks, but each main figure is one run, the prices are placeholders, the
pass table contains only one or two runs per scenario, and earlier model outputs
occasionally omitted items. Scout inspected pinned source and repository-authored
tests but did not clone the repository, run its suite, reproduce the model benchmark,
or exercise a real side effect. The repository was created the same day and had one
GitHub star; this is implementation evidence for a design boundary, not adoption or
production reliability.

- **HN source:** https://news.ycombinator.com/item?id=49922532
- **Repo:** https://github.com/mourad-baazi/hotpath
- **Inspected revision:** https://github.com/mourad-baazi/hotpath/commit/51895c47bb48ed5c22ebb4b674b584803139bacb
- **Primary sources:** [compiler and inferred guards](https://github.com/mourad-baazi/hotpath/blob/51895c47bb48ed5c22ebb4b674b584803139bacb/packages/compiler/src/compiler.ts), [runtime drift and side-effect boundary](https://github.com/mourad-baazi/hotpath/blob/51895c47bb48ed5c22ebb4b674b584803139bacb/packages/runtime/src/runtime.ts), [fallback tests](https://github.com/mourad-baazi/hotpath/blob/51895c47bb48ed5c22ebb4b674b584803139bacb/packages/runtime/test/fallback.test.ts), and [benchmark limits](https://github.com/mourad-baazi/hotpath/blob/51895c47bb48ed5c22ebb4b674b584803139bacb/docs/BENCHMARK.md)
- **Discovery feed:** HN Algolia `search_by_date?query=AI%20agent&tags=story&numericFilters=created_at_i%3E1790863221&hitsPerPage=20`

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

## A Host-Selected Action Must Be Admitted Before Its Receipt Is Bound — LoopX (GitHub, October 2026)

A later LoopX revision extends typed Todo selection from its guided-start profiles to
any host that supplies a Turn identity, including generic CLI, outer-controller, and
native CLI profiles. The code does not treat `--todo-id` as authority merely because
an orchestrator supplied it. It normalizes the request, projects the current policy
and delivery boundary, and qualifies the requested Todo before binding the Turn's
settlement receipt. A rejected first request therefore leaves no false receipt; an
accepted request records the selected Todo with the same Turn identity used for
replay and settlement.

The order matters. Binding the receipt before admission would make an ineligible or
capability-incompatible choice look durable, while ignoring host selection would let
the control plane silently execute a different item. The implementation also keeps
outer-controller settlement with the outer host, rejects a conflicting later Todo
for the same Turn, and reuses the bound identity on replay. Project-authored tests
cover those paths across `generic_cli`, `outer_controller`, and `codex_cli`; they also
extend rejection, capability-readiness, and pre-bind qualification checks to a
generic host profile.

**Runtime rule:** treat a host's explicit work choice as a requested binding, not an
execution grant. Route it through the same typed admission owner as automatic
selection; only then commit the Turn-to-work receipt. On replay, preserve that exact
identity; on conflict, fail instead of silently replacing either the host's choice or
the admitted work. Keep settlement ownership explicit when an outer controller, not
the inner agent, owns the Turn.

Scout inspected the pinned commit patch, the complete action-selection module, its
quota contract documentation, and the modified repository-authored tests. Scout did
not clone the repository or execute the test suite, so this establishes implemented
and authored-test intent, not deployed behavior or cross-process linearizability.

- **Repo:** https://github.com/loopx-project/loopx
- **Inspected revision:** https://github.com/loopx-project/loopx/commit/04b0a04eba135661870cc4c2c59d17862c16c55c
- **Primary sources:** [host-owned selection implementation](https://github.com/loopx-project/loopx/blob/04b0a04eba135661870cc4c2c59d17862c16c55c/loopx/cli_commands/quota_action_selection.py), [quota allocation contract](https://github.com/loopx-project/loopx/blob/04b0a04eba135661870cc4c2c59d17862c16c55c/docs/quota-allocation.md), and [settlement CLI tests](https://github.com/loopx-project/loopx/blob/04b0a04eba135661870cc4c2c59d17862c16c55c/tests/control_plane/test_quota_settlement_cli.py)
- **Discovery query:** GitHub Repository Search API `"AI agent" durable execution in:name,description,readme pushed:>=2026-09-01`, sorted by updated; `total_count: 9453`, `incomplete_results: false`

## Recovery Must Recheck State After Waiting on an In-Flight Admission — LoopX (GitHub, October 2026)

LoopX's latest Lark transport fix demonstrates a small but consequential recovery
race. Intake first persists a transport record as `captured`, then admits it into the
core while still owning that record's file-lock fence. A concurrent reconciler can
read the intermediate `captured` snapshot even though intake is still progressing.
Retrying admission directly from that stale read can create two core admissions for
one external message.

The fix does not infer abandonment from the intermediate status. Recovery acquires
the same capture fence, waits for its current owner, and then reads the record again.
Only if the post-fence state is still `captured` does it retry admission. A separate
change similarly reloads the current Turn after potentially slow provider feedback
before starting progress output, preventing a terminal answer that completed during
feedback from being displaced or deferred by a stale `running` observation.

Project-authored concurrency tests force both interleavings. One holds core admission
while recovery observes `captured`, then asserts exactly one admission, one user
message, one `turn/start`, and one final provider write. Another makes the Turn
complete during provider feedback and asserts the final answer is delivered without
a provisional progress record. The abandoned-capture cases also recheck the current
binding: recovery proceeds only while it remains valid and leaves a revoked capture
unadmitted.

**Runtime rule:** a persisted intermediate state is not proof that its owner has
abandoned the operation. Recovery should join the operation's existing ownership
fence, re-read after the wait, and act only on that fresh state. Repeat the same
fresh-read discipline after slow presentation or provider calls; otherwise recovery
can duplicate admission or publish an obsolete progress state after completion.

Scout inspected the pinned commit patch and complete modified implementation and test
files. It did not clone LoopX, execute the tests, exercise Lark, or reproduce the
race independently. This is static implementation and repository-authored test
evidence, not proof of deployed exactly-once behavior or correctness across other
transports and process boundaries.

- **Repo:** https://github.com/loopx-project/loopx
- **Inspected revision:** https://github.com/loopx-project/loopx/commit/bece55a770c1a378a0419b8fb987fce0705605ae
- **Primary sources:** [Lark recovery implementation](https://github.com/loopx-project/loopx/blob/bece55a770c1a378a0419b8fb987fce0705605ae/loopx/extensions/lark/private_conversations.py) and [forced-interleaving tests](https://github.com/loopx-project/loopx/blob/bece55a770c1a378a0419b8fb987fce0705605ae/tests/test_lark_private_conversations.py)
- **Discovery query:** GitHub Repository Search API `"AI agent" memory in:name,description,readme pushed:>2026-10-10 stars:>20`, sorted by updated; `total_count: 3127`, `incomplete_results: false`
