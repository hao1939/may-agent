# Fix-Forward Loop

Status: accepted design direction; controller support is incremental

## Purpose

When a spec or compact package fails, the project should diagnose and fix the
failure before running the same input again. A repeated run is only useful after
something changed: spec, scenario test, runner, compact plan, target config,
environment readiness, or product/model understanding.

The simple rule:

```text
fail -> classify -> diagnose -> fix -> run -> verify
```

If nothing changed, do not run again. Create exact owned work, an exact wait, or
an escalation.

The complementary rule:

```text
pass -> record what worked -> reuse the pattern
```

A pass is not just a green result. It teaches which spec shape, carrier,
target, assertions, and cleanup pattern worked. A failure teaches what not to
repeat. Both should update the project knowledge used by future spec generation,
compact planning, and repair decisions.

## Scope

Fix-forward is a reusable domain workflow pattern, not a fourth durable loop and
not a new task-tree status.

It applies to:

- single-spec failures from `single-spec-verifier`;
- compact package failures from `feature-compact-planner`;
- grouped repair leaves created by spec or compact loop controllers;
- direct human/agent work that asks to repair one failing AKS test path.

Ownership follows the project model:

```text
domain/* -> aks-explorer fixes AKS specs, scenario tests, compact plans,
            runner behavior, target config, and model understanding
ops/*    -> app-ops fixes pipeline dispatch, workflow routing, metrics,
            watchdog, task-tree mechanics, and observability
```

The planner may create or dispatch the work, but it must not do the AKS domain
repair itself.

## Why Retry Is Not Enough

Retry handles transient failures. Many live-test failures are not transient:

- request shape is wrong;
- API version or target profile is wrong;
- VM size, OS, or architecture selection is incompatible;
- scenario test is not standalone;
- compact package selected incompatible specs;
- pipeline did not upload a real result artifact;
- the product behavior disagrees with the current model.

Running the same code against the same target usually returns the same failure.
The loop should spend effort on changing the input or understanding, not on
spending another live run.

## Progress Model

Each fix attempt records the failure class and two fingerprints:

```typescript
type FixAttempt = {
  attemptId: string;
  failureClass: string;
  inputFingerprint: string; // spec + scenario test + runner + plan + target
  errorFingerprint: string; // error class + message + failing assertion
  changedFiles: string[];
  diagnosis: string | null;
  runId: string | null;
  resultPath: string | null;
  createdAt: string;
};
```

Progress exists when at least one of these is true:

- input fingerprint changed;
- error fingerprint changed;
- a more specific diagnosis was recorded;
- the run reached a later product assertion;
- more checks passed;
- an exact wait or escalation was created from new facts.
- a reusable note was created that changes future routing, generation, carrier
  selection, or pass result handling.

No progress means:

```text
same input + same error + no new diagnosis + no new external fact
```

When no progress is detected, the item stays `error` in loop state unless it has
a valid exact wait. The controller or planner must create visible owned work:

- domain repair task;
- ops repair task;
- exact blocked wait;
- escalation;
- accepted terminal finding with proof.

Do not introduce a durable `stuck` status. In this project, `error` means
diagnosis or repair is still needed, and `blocked` means the wait is exact and
owned.

## Classification

Every failure needs a class. `unclassified` is a controller or worker bug.

Use `needs-diagnosis` when the system cannot classify from the initial result.
That is an action: create or run diagnosis before the next live attempt.

Recommended classes:

- `vm-size-unavailable`
- `vm-architecture-incompatible`
- `api-version-incompatible`
- `request-shape-invalid`
- `feature-flag-missing`
- `permission-denied`
- `capacity-exhausted`
- `product-behavior-mismatch`
- `scenario-test-not-standalone`
- `test-code-bug`
- `compact-plan-conflict`
- `pipeline-infrastructure`
- `missing-result-artifact`
- `needs-diagnosis`

Classification can use message matching, but message matching is only the first
pass. If the class is `needs-diagnosis`, the next step must inspect the spec,
scenario test, generated plan, target profile, run artifact, and relevant
official/API/source references.

Current controller field names:

- single-spec loop state uses `failureClass`, `inputFingerprint`, and
  `errorFingerprint`;
- compact loop state already uses `errorClass`; compact repair tasks also carry
  `inputFingerprints` and `errorFingerprints`;
- grouped repair tasks carry `workflow=fix-forward` in task context so workers
  know this is diagnose/fix/run/verify work, not blind retry work.

## Workflow Shape

Each fix-forward task should stay small:

```text
one failure or one coherent feature family
  -> classify
  -> diagnose
  -> apply bounded fix when safe
  -> run the smallest truthful verification
  -> report structured result
```

Expected task output:

```json
{
  "workflow": "fix-forward",
  "subject": {
    "kind": "spec | compact-feature | feature-family",
    "id": "spec.example"
  },
  "classification": "request-shape-invalid",
  "diagnosis": "The agentPool request used an x64 image with an Arm64 VM size.",
  "changedFiles": ["features/example/specs/example.json"],
  "verification": {
    "runId": "171234567",
    "resultPath": "runs/test-results/example/result.json",
    "status": "pass | fail | error"
  },
  "nextAction": "done | rerun-after-change | create-domain-repair | create-ops-repair | exact-wait | escalate"
}
```

The task may be one leaf when the fix is small. If diagnosis shows the repair is
larger, the leaf should complete with a concrete follow-up task proposal rather
than becoming an unbounded long-running session.

For compact work, prefer one feature or one exact branch over a broad family.
A family task is acceptable only when the members share the same current
repairable cause. If the family contains many already-known waits, the compact
controller should split those into feature-level blocked waits before creating
any family repair task.

## Agent Failure-Handling Contract

The agent should handle failures as a decision problem, not as a retry problem.
Code and tools collect facts; the agent judges the next action from those facts.
Collected facts are starting points, not ground truth. The packet tells the
agent where to look; the agent must verify current state before deciding.

For every failure, the agent must do this in order:

1. Name the subject: one spec, one compact feature, or one coherent feature
   family.
2. Classify the failure. If it cannot classify, use `needs-diagnosis` and run
   diagnosis before any rerun.
3. Read current facts directly from the live project surfaces before trusting
   stale summaries:
   - task tree and task trace;
   - durable loop state;
   - latest pipeline/run/result artifact;
   - current backend, target environment, and workflow/pipeline config;
   - relevant checked-in spec/test code, official docs/API/design docs, or
     mounted source when needed.
4. Preserve the raw failure facts: run id, result path, failing assertion,
   request/response excerpt, command, target, branch, and artifact refs when
   available.
5. Compare current facts against old claims. Ask: is the blocker still true, is
   the run actually terminal, is the spec still non-pass, did backend/env/config
   change, and is there already an active owner?
6. Compare the current input and error fingerprints with prior attempts.
7. Decide the smallest truthful next action:
   - apply a bounded domain fix and verify;
   - apply an ops fix and verify the pipeline/process;
   - create a focused follow-up task;
   - record an exact blocked wait;
   - escalate with proof;
   - accept a terminal finding with proof.
8. Write the result as structured output. Prose explains the judgment, but
   structured fields drive planner decisions.
9. Record the learning:
   - what pattern succeeded or failed;
   - what should be reused for similar specs;
   - what should be avoided;
   - what workflow rule should change if the same class appears again.

The agent must not:

- trust summaries, stale task text, previous agent claims, or old wait text
  without checking current files/runtime/pipeline facts;
- rerun the same input after the same error without a changed input,
  changed diagnosis, or new external fact;
- turn "I am unsure" into `blocked`;
- mark a task done because evidence was collected but no next action was chosen;
- hide a tool, provider, pipeline, or artifact failure as an AKS product
  failure;
- update assertions to match live behavior without checking official/API/design
  sources first.
- call a spec `pass` from a source/check-only proof, gated artifact, missing
  artifact, or aggregate result that lacks branch-level same-spec proof.

If the agent cannot make a safe bounded fix, that is still a useful result. It
should return the exact reason and one concrete next action, not keep searching
indefinitely.

## Minimum Diagnosis Packet

Before a fix-forward task can decide `rerun`, `blocked`, `escalate`, or
`terminal finding`, it needs a minimum diagnosis packet.

For a single spec:

- spec id and feature key;
- target profile, branch, and pipeline/run id;
- generated test or scenario test path;
- spec/model file path;
- failing phase and assertion;
- request/response or command excerpt that explains the failure;
- relevant official docs/API spec/design/source references checked;
- input fingerprint and error fingerprint before the decision.
- pass result facts when the result is being used to close the spec:
  run id, result path, same-spec or accepted alias mapping, failed verdict
  assertions, real-cluster requirement/observation, cleanup result, and model
  decision.

For a compact feature:

- feature key and compact plan path;
- included specs and cluster-sharing plan;
- feature-level target profile and branch;
- run id and result artifact path;
- first failing spec plus representative sibling failures;
- compact conflict, generated-test, runner, target, or product classification;
- input fingerprints and error fingerprints for the affected set.
- when closing as `done` or `exact-wait`, either a current-attempt evidence path
  or an explicit explanation that the cited older run/result/holder remains
  exact for the current fingerprint.

If the packet is incomplete because an artifact or pipeline result is missing,
the class is `missing-result-artifact` or `pipeline-infrastructure`, not a
domain failure.

## Agent/Workflow Failure Is A Separate Failure

A failed worker session is not the same as a failed AKS test.

Use this split:

- AKS test failed with usable artifacts: domain fix-forward.
- Generated test/spec/runner code failed before meaningful AKS proof: domain
  repair unless the failure is pipeline plumbing.
- Pipeline dispatch, auth, missing artifact, stale run lookup, or result upload
  failed: ops repair.
- Agent returned malformed JSON, empty output, or ignored the required
  structured fields: ops repair for the workflow/agent contract, while the
  original domain item remains open.
- Tooling cannot read required files or state: ops repair unless the missing
  file is itself the domain bug.

This prevents a bad agent turn from being recorded as product behavior, and it
prevents a real AKS failure from being hidden behind generic workflow failure.

## Product Behavior Mismatch

Do not automatically "update assertions to match reality" just because live
behavior differs from the model.

The domain worker must first compare:

- official docs and API specs;
- accepted product/design docs when available;
- source/context from the AKS repo;
- existing scenario intent;
- live result artifacts.

Then it chooses one of:

- spec/test bug: repair the test and rerun;
- model gap: propose a model/spec correction and verify;
- product bug or behavior regression: create a finding/escalation with proof;
- environment limitation: record exact wait or target constraint.

Live behavior is final authority for what happened, not automatic authority for
what should be expected.

## Green Results Need Review Too

Fix-forward does not only handle red results. It also protects green results
from being misleading.

Before a green result is used to close work, check the simple facts:

- Is the result for the same spec, or is the alias/successor clearly explained?
- Did it run on the expected backend and target?
- If the spec needs a real cluster, did the result actually create one?
- Are there any failed verdict assertions hidden under a green top-level status?
- For compact runs, is the branch for this specific spec passing?
- If the result path points at an old failed or aggregate result, where is the
  current result that makes the spec safe to close?

If those facts are missing, do not call it done. Send it to review or
fix-forward with the exact run/result that needs inspection.

## Exceptions Are Not Parking

Nothing is permanently excluded from live testing by a vague exception.

An exception must become one of:

- a runnable spec after repair;
- a compact/shared-cluster carrier path;
- a boundary spec that validates the unsupported behavior;
- an exact environment wait with observer and fallback;
- an escalation or product finding with proof.

"Intentionally excluded" without a concrete resume path is unfinished domain
work.

## Pipeline And Ops Failures

Use neutral pipeline language in domain tasks. Azure DevOps is the current live
proof backend, but the fix-forward pattern should not depend on a platform name
unless the failure is platform-specific.

Pipeline dispatch, authentication, missing artifacts, and workflow routing are
ops problems. They should create or dispatch `ops/*` work owned by `app-ops`.

Spec shape, generated tests, compact plans, runner behavior, and target profile
problems are domain problems. They should create or dispatch `domain/*` work
owned by `aks-explorer`.

## Capacity Special Case

Capacity failures are usually not code-fix failures.

For `capacity-exhausted`:

```text
record exact blocked wait
waitingFor = staging capacity/headroom
observedBy = capacity check, watchdog, or loop controller
fallbackAt = bounded recheck/escalation time
resumeAction = rerun only after capacity condition changes
```

Do not create repeated domain fix tasks for unchanged capacity failures.

## Workflow Responsibilities

Each workflow has a distinct role in the fix-forward cycle. No workflow should
take on another's job.

### task-worker: run the assigned workflow and preserve failures

The task worker is responsible for preserving the difference between:

- workflow/agent failure;
- pipeline/process failure;
- domain test failure;
- external/environment wait.

When the agent emits structured fix-forward output, the worker should pass it to
review unchanged. When the agent or provider fails before producing structured
output, the worker should surface that provider/workflow error directly and not
replace it with a generic empty summary. The planner can then create ops repair
work for the broken workflow path.

### single-spec-verifier: try to fix before blocking

When a spec fails, the verifier should attempt known fixes before creating a
blocked wait. These are fixes the agent has proven it can do:

```text
vm-size-unavailable        → try D4s_v3 (Gen1+Gen2) or D4ads_v6 (Gen2)
api-version-incompatible   → try latest available from az provider show
request-shape-invalid      → check Go source for correct shape
feature-flag-missing       → register via az feature register or send header
permission-denied          → check role, try Owner grant if MSI available
capacity-exhausted         → DO NOT fix, create timed wait instead
```

If the fix attempt produces a different error: progress, continue the cycle.
If the fix attempt produces the same error: create a blocked wait with full
evidence of what was tried.

The verifier should not loop forever. One fix attempt per failure class per
run. If it cannot fix, it reports a structured result and stops.

### watchdog: detect dead-end blocked tasks

The watchdog does not fix. It observes and escalates.

The watchdog should scan blocked tasks for:

1. **Expired fallback**: `fallbackAt` is in the past, no active repair work
   exists. Action: create a review task or emit `project.planning.requested`
   with the expired blocker as context.

2. **Stale owner-human wait**: blocked with `owner: human` for >48h and the
   blocker is an agent-fixable class (vm-size, api-version, request-shape,
   feature-flag). Action: create a fix-forward task to re-examine whether the
   agent can now handle it.

3. **No progress detected**: same input fingerprint and error fingerprint
   across multiple attempts with no code changes between them. Action: escalate
   with evidence.

4. **Capacity returned**: a capacity-blocked task where the staging subscription
   now has headroom. Action: release the wait, move to runnable.

5. **Rerun wave completed**: a task waiting for queued pipeline runs that have
   already reached terminal state. Action: release the wait.

6. **Retry-drained or stranded loop work**: durable loop records are still
   non-pass or pending, but direct retry guards prevent new dispatch and there
   is no active owner/review/fix-forward task for the affected family. Action:
   create or wake a grouped stall/review task with the current facts. Do not
   blindly reset attempts, and do not hide the residue behind exact wait
   stewardship unless each affected record is represented by a real exact wait
   or accepted terminal disposition.

7. **Backend, environment, or workflow route changed**: the execution route
   changed since the recorded attempts, such as GitHub Actions to Azure DevOps,
   target environment wiring, auth path, runner schema, or result artifact
   contract. Action: surface the change as a re-evaluation reason. The agent
   decides whether to rerun, repair, split, keep waiting, escalate, or emit a
   retry-reset directive.

The watchdog should not create domain fix tasks directly. It should wake the
planner or create a review task. The planner or reviewer then decides whether
to dispatch domain work or ops work.

### reviewer: judge blocked tasks that need a second opinion

When the verifier blocks a task with `owner: human` or the watchdog detects a
stale blocker, the reviewer can provide structured judgment:

```text
reviewer examines:
  - the blocker condition
  - the error evidence and classification
  - the fix attempts already made (from fingerprint history)
  - the Go source and official docs for the affected scenario
  - whether the environment has changed since the block
  - current task/loop/runtime/pipeline state, read directly during review

reviewer recommends:
  - agent-fixable: "the agent should try X" → planner creates fix-forward task
  - genuine-external: "this truly needs human/infra action" → keep blocked
  - product-finding: "this is correct product behavior" → record finding
  - stale: "the original blocker no longer applies" → release the wait
```

The reviewer does not mutate the task tree. It emits `project.task.reviewed`
with a structured recommendation. The planner consumes it and applies the
decision.

For malformed or incomplete fix-forward output, the reviewer should not infer
success from prose. It should recommend `redo`, `followup`, or `escalate` with
the missing fields named explicitly.

For compact fix-forward output, the reviewer also checks evidence freshness. A
`done` or `exact-wait` result must cite current attempt evidence, or explicitly
state why a prior evidence path, run id, or wait holder still proves the current
input fingerprint. Useful prose without that structured proof is rejected for
redo.

This closes the loop: verifier tries to fix → blocks if it can't → watchdog
detects stale blocks → reviewer judges → planner creates new fix work or
confirms the wait.

### planner: coordinate, don't do domain work

The planner consumes watchdog alerts and reviewer judgments. It creates or
dispatches work but does not do the AKS domain repair itself.

```text
watchdog: "task X has expired fallback"
  → planner creates review task for reviewer
  → reviewer: "agent can fix this, try new VM size"
  → planner creates fix-forward task for aks-explorer
  → aks-explorer fixes and reruns
  → verifier reports result
```

### loop controllers: classify and create repair work

Loop controllers should:

1. classify every non-pass result;
2. record input and error fingerprints;
3. create domain repair work for fixable AKS/spec/test/plan issues;
4. create ops repair work for pipeline/app/process issues;
5. keep exact waits as `blocked` only when the blocked contract is satisfied;
6. reset retry/fix attempts only after a relevant repair changed the fingerprint;
7. refuse to mark a feature/spec done without live proof or accepted terminal
   disposition.

Retry budgets may remain as a churn guard, but they are not a terminal verdict.
When a budget is exhausted, the result must become visible repair work, exact
wait, escalation, or accepted terminal finding.
Budget exhaustion is a signal for renewed judgment, not a command to retry and
not permission to park forever. Code should collect the stalled facts and make
them visible. The agent should verify current state and try to find a different
workable path. Only after that judgment should the planner reset attempts,
dispatch a rerun, create repair work, keep an exact wait, escalate, or close the
item with proof.

## The Closed Loop

```text
spec fails
  → single-spec-verifier: classify, try known fix, rerun
  → still fails? create blocked wait with evidence

blocked wait sits
  → watchdog: detect expired fallback or stale blocker
  → watchdog wakes planner

planner receives watchdog alert
  → creates review task

reviewer examines blocker
  → "agent can fix" → planner creates fix-forward task
  → "genuine external" → planner refreshes the wait
  → "stale blocker" → planner releases the wait

fix-forward task runs
  → aks-explorer applies fix, reruns
  → pass? done
  → different error? progress, continue
  → same error? back to blocked with updated evidence
```

No task stays blocked forever without periodic re-examination. The watchdog
ensures every blocked task is revisited when its fallback expires.

## Success Criteria

The fix-forward design is working when:

- no loop item stays `error` without visible repair, exact wait, escalation, or
  accepted terminal finding;
- no item remains `unclassified`;
- every failed run has a minimum diagnosis packet or a precise reason why the
  packet could not be collected;
- repeated same-input/same-error attempts stop quickly;
- every exception has a concrete unblock path or accepted terminal finding;
- capacity waits resume only when the capacity condition changes;
- expired fallbacks trigger re-examination within one watchdog cycle;
- `owner: human` waits are periodically reviewed for agent-fixable blockers;
- live passes link a real pipeline run and result artifact.
- agent/provider/workflow failures create ops repair work instead of being
  counted as AKS domain proof.

## Implementation Notes

Start small:

1. Add classification and fingerprint fields to spec and compact loop records.
2. Make the single-spec-verifier attempt known fixes before creating blocked
   waits (vm-size, api-version, request-shape, feature-flag).
3. Make the watchdog scan for expired fallbacks and stale `owner: human` waits,
   and create review tasks.
4. Make the reviewer emit structured recommendations for blocked task judgment.
5. Make the planner consume reviewer recommendations and create fix-forward
   tasks.
6. Route repair work by scope: `domain/*` to `aks-explorer`, `ops/*` to
   `app-ops`.
7. Add reset semantics: completed repair task must name the affected
   spec/feature and the fingerprint it changes.
8. Make task-worker preserve provider/agent errors separately from domain test
   failures.
9. Make fix-forward task prompts require the minimum diagnosis packet and
   structured next action.
10. Add metrics for loop errors with no visible owner and for repeated
    same-fingerprint attempts.
11. Apply the pattern first to compact package failures, then reuse it for
    single-spec failures.
