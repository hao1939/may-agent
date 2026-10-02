# Core design review — 2026-09-09

**Historical context:** [Architecture](../../2a-design/architecture.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Dated source review and recommendations, not a new accepted contract.

The [refined follow-up proposal](../../proposals/task-controller-pattern.md#interruption-and-external-effects)
owns the proposed scope, accepted degradation and completion checks. This record
preserves the source findings and experimental evidence supporting that review.

The core direction is sound. The largest demonstrated problem is that recovery
has a separate result-acceptance path whose behavior has diverged from normal
execution. Fix that boundary before adding recovery machinery or moving more
files. Then examine whether mandatory Task hierarchy earns its continuing cost.

This review applies the [design philosophy](../../1-principles/design-philosophy.md)
and [review rule](../../1-principles/core-principles.md#review-rule): help turn
intent into useful, verified results with less supervision and acceptable total
cost. For this frequently used foundation, ongoing maintenance and failure costs
matter more than preserving every interrupted execution step.

## Scope and evidence

Two isolated Host revisions were reviewed:

- Merged `main`: `389f1f616c8bffbf322b59c3d6c3c3a64f6a4fa9` (PR #97).
- Stacked continuation: `4d5b55aed0d1197249fb53de600d4de9dfa29d2a`
  (a reviewed revision of PR #103, including the preceding separation work).

References below pin those sources. They do not establish the current PR head,
deployment state, or completeness of a later revision. The shared Host checkout
was older and was not used as the merged baseline. Existing unrelated edits
were preserved.

The review covered event admission/observation, authoritative Task state,
attempt execution and recovery, timing, and the boundary with request
coordination. Synthetic probes use real Task resource APIs and SQLite. This is
a focused design review, not a complete audit of every core behavior.

## Findings

### 1. Recovery can accept a workflow handoff without its required verifier

**Priority: fix before further recovery refactoring.** This affects correctness,
not just the quality of a recovery optimization.

Normal execution checks that a workflow's `needs-agent` handoff retains its
required verifier, then establishes acceptance before committing convergence
([normal path][normal-acceptance]). The
[accepted contract](../../2a-design/task-resource-engine.md#acceptance) requires
that verification to apply to the later agent result too.

Terminal-session recovery instead reconstructs a managed-agent claim and calls
`completeAppTask` with `acceptanceBasis.method: "agent-judgment"`
([recovery path][candidate-recovery]). The claim helper allows a Task whose
intent names a workflow and does not retain the handoff information used by
the normal check ([claim reconstruction][terminal-claim]). Recovery does not
run the workflow verifier.

The probe observes a workflow Task, claims its workflow, records `needs-agent`,
claims the resulting agent attempt, and supplies a persisted terminal result.
Recovery produces a completed receipt without workflow verification on both
reviewed revisions. The same helper is reached from startup repair and the
busy-Task path. This is a preexisting flaw that survives the separation work.

**Recommendation:** decline direct terminal-result salvage for workflow Tasks
and use the existing retry path as the smallest conservative correction. A
later reuse path should share normal acceptance behavior when its savings
justify the implementation cost. Do not build a second verifier pipeline
inside recovery merely to preserve completed agent computation.

The accepted degradation is extra work and delay after interruption. This
tradeoff is appropriate only where that work can be repeated safely; uncertain
external effects need inspection or an existing operation identity before
repetition. Durable-write fencing alone does not make provider effects safe.
If an App no longer needs a verifier, simplify that App's declared contract
explicitly; recovery cannot silently make that decision.

### 2. Recovered completion loses the structured result

**Priority: fix with finding 1.** Callers can receive a completed Task without
the machine-readable decision they need.

The converged branch in the same [recovery helper][candidate-complete] forwards
summary, response, evidence and actions, but omits `result: result.result`.
Normal completion preserves that field; even recovery's waiting branch
preserves it.

The probe completes one Task normally with
`{ verdict: "approved", sourceRevision: "fixture-revision" }`, then recovers
another Task with that same payload. Normal completion retains the object;
recovered completion returns convergence but its receipt has `result ===
undefined`. Both reviewed revisions reproduce this.

**Recommendation:** forward the structured result and keep a regression that
compares persisted results across normal completion and terminal recovery.
This is a small correction with little added machinery. Dropping a caller's
result is not a useful degradation: it saves negligible cost while defeating
the work's purpose.

Together, these findings show that sharing the final SQL commit function is
insufficient. Acceptance rules and result-field handling can still diverge
before that commit. Reduce these parallel decisions without introducing a
generic pipeline framework.

### 3. A standalone Task still requires a seeded hierarchy

**Priority: next contract simplification to evaluate, not a current-contract bug.**

[`TaskIntent.parentId`][task-intent] is required. Admission validates an existing
parent and walks its ancestry; execution also requires a root group before
claiming work ([parent validation][parent-validation],
[runtime prerequisite][root-prerequisite]). A probe confirms rejection when an
otherwise valid first Task refers to a missing parent. The
[resource contract](../../2a-design/task-resource-engine.md#resource-authority)
currently requires this behavior.

The useful core concept is an owned outcome with durable identity. Requiring a
structural parent for every independent outcome adds setup, normalization and
graph obligations. Real child ownership and dependencies have value; a root
used only to satisfy the schema needs a separate justification.

**Recommendation:** evaluate allowing top-level Tasks without a parent while
retaining explicit parent/dependency links for actual decomposition. Start with
the existing callers and stored groups, and identify what code and setup this
would eliminate. Change SDK, admission, reads and documentation together only
if that reduction justifies migration cost. Existing groups can remain readable
during transition. Avoid replacing them with synthetic root Tasks or another
hierarchy abstraction. If groups serve material policy or this only moves
complexity elsewhere, keep the current convention.

### 4. Request coordination deserves a later boundary audit

`app-inbox-host.ts` still combines durable request mechanics with child-request
creation, dependency waiting and conversational follow-up
([child coordination][request-children]). This can leave two places to understand
multi-step progress: request coordination and Task reconciliation.

This is an investigation target, not proof that every request record is a
second work authority. Caller correlation, durable pending admission and
Conversation ordering still have independent purposes. The
[authority proposal](../../proposals/authority-boundary-simplification.md)
already tracks retiring conversational child-request waiting where redundant.

**Recommendation:** use that existing audit rather than start another redesign.
Inventory active callers and retained obligations before removing behavior.
Prefer App-owned outcome coordination where it can replace a path; keep
lightweight direct conversation and request correlation where useful.

## What belongs in the minimal core

These are responsibilities, not four mandatory services or new abstractions.

| Responsibility | Keep | Allow outside it |
| --- | --- | --- |
| Events | Validated envelopes, durable admission identity and declared routing; a clear distinction between admission and passive observation | Transports, fact producers, presentation subscribers and reporting |
| Authoritative state | One authority per fact; atomic Task transitions, accepted inputs/results, and protection against stale writes | Query projections, transcripts and optional reporting implementations |
| Tasks and attempts | Durable obligation, bounded claims/execution, capacity, cancellation, waits and retry; consistent enforcement of App acceptance | Agent/workflow/native execution details and optional saved-progress recovery |
| Timing | Owned timers and bounded dispatch; time makes a check due, not a domain fact true | Schedule declarations, observers and particular maintenance duties |

Validated App registration and declaration checks support admission; filesystem
discovery is replaceable. Concrete storage is necessary for a working Host,
but another storage framework is not needed to express this boundary.

Removing a capability must preserve accepted obligations and remaining
correctness. For example, removing a model executor can leave its Tasks visible
and unable to execute while unrelated work continues. Removing an optional
dashboard can remove its presentation. Neither removal grants completion.

The continuation improves this separation: concrete execution/session handling
moves into adapters, optional reporting has a distinct boundary, and
[`OwnedTimer`][owned-timer] is a small ownership wrapper. Keep direct calls for
local sequencing and transactions; events serve independent admission and
observation. Every internal transition does not need a new event.

Keep the existing generation/attempt fences, accepted-input durability,
termination of superseded execution, process isolation for expensive work, and
bounded indexed repair of lost queue hints. Their costs protect recurring,
consequential failures. Prefer redo of an attempt over reconstruction of every
execution detail, while retaining the same Task identity.

The revision-keyed [snapshot cache][snapshot-cache] is not another mutable
authority: scoped reads use the resource store, cached snapshots are checked
against its revision, and commits still use fenced resource mutations. Removing
it needs a concrete correctness or cost argument.

## Organization and next steps

Keep the [existing organization proposal](../../proposals/task-runtime-organization.md):
`core/` owns stable mechanics, `adapters/` owns concrete capabilities, and
`composition/` wires ordinary modules. Task lifecycle code still lives partly
in `app-task-*.ts`; changing that name alone would not fix the acceptance split.

For result handling, the boundary should be simple: an adapter supplies result
evidence, the runtime enforces the App's applicable acceptance rules, and the
store atomically records the fenced result. Recovery may reuse evidence through
that behavior or leave the same Task for another attempt. Keep the policy
decision out of storage and session-artifact parsing out of generic lifecycle
code. Extract only the shared behavior demonstrated by actual callers.

Work in this order:

1. Correct the two recovery defects with focused regressions. Verify the
   workflow fallback through the runtime before shipping, including its eventual
   retry or visible inability to proceed. The scratch patch below is only a
   starting point.
2. Evaluate the optional-parent contract with concrete callers and a deletion
   estimate. Its value is reduced lifetime setup and maintenance, weighed
   against consumer and data migration costs.
3. Continue the already tracked request-coordination audit. Retire one redundant
   path only after its consumers and outstanding work have a clear destination.

Stop after each change when it achieves the sufficient outcome. Broader recovery
reconstruction should require evidence that avoided redo exceeds its recurring
maintenance and failure cost. No new plugin system, queue, scorecard or approval
process is needed for this review.

## Reproduction and validation

The [review patch](core-design-review-20260909.patch) contains the synthetic
probes and a candidate-only experimental fix. It is not applied to the shared
Host checkout, committed to Host, or published. The fix declines direct salvage
for all workflow Tasks and forwards the structured completion result.

In an isolated checkout of either pinned revision with dependencies installed,
apply only the test-file part of the patch:

```sh
git apply --include=src/app/core-review.probe.test.ts /path/to/core-design-review-20260909.patch
bun test src/app/core-review.probe.test.ts
```

Both unmodified revisions yielded **1 pass and 2 failures**: the parent-contract
probe passes; structured-result preservation and verifier protection fail.

On the pinned continuation, applying the runtime part of the patch permits the
following focused experiment:

```sh
git apply --include=src/app/app-task-runtime.ts /path/to/core-design-review-20260909.patch
bun test src/app/core-review.probe.test.ts src/app/app-task-runtime.test.ts \
  -t 'terminal|verifier|seeded parent'
```

That experiment yielded **6 pass, 0 fail, 65 filtered**, with 23 assertions.
Before the patch, the existing resource-store, controller, recovery, event bus,
event interface, timer, handler-recovery, session-binding and startup-recovery
tests yielded **105 pass, 0 fail**, with 338 assertions. The passing existing
suite did not cover the two defects. Commands ran with Bun 1.3.14.

The documentation integrity check passed with six existing workspace-layout
warnings. Local review/index links, anchors and Markdown whitespace checks
passed; the exported patch also passed a reverse-application check against the
experimental checkout.

These checks establish the helper-level defects and the narrow experimental
change. They do not prove the complete workflow restart/retry sequence, safety
of replaying external effects, full CI, or production restart behavior. The
parent probe documents today's constraint; it does not measure the net savings
of changing that contract.

[candidate-recovery]: https://github.com/hao1939/may-agent/blob/4d5b55aed0d1197249fb53de600d4de9dfa29d2a/src/app/app-task-runtime.ts#L409
[candidate-complete]: https://github.com/hao1939/may-agent/blob/4d5b55aed0d1197249fb53de600d4de9dfa29d2a/src/app/app-task-runtime.ts#L439
[normal-acceptance]: https://github.com/hao1939/may-agent/blob/4d5b55aed0d1197249fb53de600d4de9dfa29d2a/src/app/app-task-runtime.ts#L1686
[terminal-claim]: https://github.com/hao1939/may-agent/blob/4d5b55aed0d1197249fb53de600d4de9dfa29d2a/src/app/app-task-reconciler.ts#L934
[task-intent]: https://github.com/hao1939/may-agent/blob/4d5b55aed0d1197249fb53de600d4de9dfa29d2a/packages/sdk/src/task.ts#L10
[parent-validation]: https://github.com/hao1939/may-agent/blob/4d5b55aed0d1197249fb53de600d4de9dfa29d2a/src/app/app-task-reconciler.ts#L1357
[root-prerequisite]: https://github.com/hao1939/may-agent/blob/4d5b55aed0d1197249fb53de600d4de9dfa29d2a/src/app/app-task-runtime.ts#L1328
[request-children]: https://github.com/hao1939/may-agent/blob/4d5b55aed0d1197249fb53de600d4de9dfa29d2a/src/app/app-inbox-host.ts#L1256
[owned-timer]: https://github.com/hao1939/may-agent/blob/4d5b55aed0d1197249fb53de600d4de9dfa29d2a/src/app/core/scheduling/timer.ts#L1
[snapshot-cache]: https://github.com/hao1939/may-agent/blob/4d5b55aed0d1197249fb53de600d4de9dfa29d2a/src/app/app-task-store.ts#L183
