# Independent review of AKS Task and workflow design

Date: 2026-09-16. Reviewer: Codex. Scope: review and proposal only.

The App has useful foundations, but I would repair its contract and recovery
boundaries before enabling it against the current Host. A replacement task
engine or a universal workflow framework is unnecessary. The most valuable
changes are to make existing mechanisms work consistently: save requirements
independently of execution, register the recovery code that is actually tested,
and acknowledge observations only after publication succeeds.

This assessment was derived from source and local probes. It is independent,
but not blind: I had already seen May's headline findings in the preceding
conversation. This report was completed before reopening May's final report;
the comparison is a separate document.

## Reviewed versions and limits

- AKS App: `033780f64b4a6964c92a031ac55765d4d1082eb7`, clean before and after checks.
- Resolved SDK and matching Host source: `a76c27dd385d87273f5271c25ece48b07d77f291`.
  AKS's `tsconfig.json` resolves `@may-agent/sdk` through the sibling
  `bundle/sdk-current`, not the stale package in `/app/node_modules`.
- Design guidance: current canonical core principles, system boundary, and
  May development workflow, including the accepted whole-call requirement
  checkpoint discussion. Some core documentation is uncommitted design work;
  it is guidance, not proof of deployed behavior.
- Traced typed admission, exact-result dependencies, spec-loop selection,
  requirement correction, Test Health/Master parent decisions, problem-solver
  feedback, pipeline/repository observers, and representative integration and
  PR readiness guards. This is a risk-focused review, not a line-by-line audit
  of every workflow or every domain policy.
- No live AKS execution, Azure/ADO operations, App activation, deployment, or
  cloud performance measurement. Providers were faked or disabled for probes;
  Git experiments used temporary local repositories. No production fix is
  included in this report.

## What the checks actually establish

| Check                                          | Result                                               | Meaning                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Typecheck against resolved SDK                 | Failed, exit 2; 26 diagnostics                       | Current App source is incompatible with this SDK. Many diagnostics share the retired action root cause.                |
| Nine focused test files                        | 109 passed, 0 failed; 400 assertions                 | Admission basics, loop selection, observer helper tests, and investigation behavior pass their tested scenarios.       |
| Seven workflow/provider test files             | 186 passed, 1 failed; 2,285 assertions               | Test Health's serialized result fails SDK admission. Integration, approval, and other sampled behavior largely passes. |
| Isolated rerun of the failing Test Health test | Failed again                                         | This observed failure is reproducible, not just a concurrent-suite symptom.                                            |
| Six diagnostic reproductions                   | All reproduced the current behaviors described below | These diagnose defects/limitations; they are not passing acceptance tests for a repaired App.                          |

The focused suite's success does not establish compatibility. For example,
`approved-repair-scope.test.ts` expects the old action shape and deliberately
expects corrections to be withheld during execution. A test can preserve an
old design faithfully while the intended contract has changed.

## Findings, ordered by recommended action

### R1 — High: requirement revisions are returned through a retired interface

The App still constructs `actions: [{ kind: "update-task", ... }]`. The selected
SDK rejects that action before it can be applied. This affects ordinary repair
guidance, scope approval, normalization corrections, and legacy-branch recovery;
it is not merely an outdated comment.

Evidence: the actual `approvedRepairScope` helper produced an action, and the
real SDK rejected its result with:

```text
actions[0].update-task is retired; use tasks update or TaskAttempt.reviseTask before returning a result
```

Typechecking independently reports the same incompatibility. The Test Health
test also fails at its full serialized-result admission assertion, at line 1116. Its preceding fixture retains an approved correction; this is useful
end-to-end App test coverage, though it is still not a daemon integration test.

Smallest fix: use the existing creator-authorized revision operation. The SDK
has `TaskAttempt.reviseTask`, but `WorkflowContext` does not expose it. A narrow
workflow binding to that same checked capability is preferable to recreating
returned mutation actions or asking a model to translate deterministic edits.
Verify this capability in the actual workflow executor, not only a test fake.

Do not grant revision authority based on a parent link, agent name, or shared
App identity. The runtime's recorded creator remains authoritative. A worker
that cannot revise an assignment returns ordinary feedback to its creator.
Existing historical creator mismatches need explicit handling through that
owner, not a broad migration exception.

Cost/value: a bounded Host/SDK exposure plus caller migration and contract
tests; high value because affected branches currently cannot settle successfully.

Sources: [scope action](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/agents/owner/workflows/lib/approved-repair-scope.ts#L173),
[other correction](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/agents/owner/workflows/draft-pr-hygiene.ts#L346).
SDK: `src/task-contract.ts:174`; `src/workflow.ts:399` in the resolved bundle.

### R2 — High: a valid correction waits for execution to stop

`approvedRepairScope` explicitly refuses a correction unless the child is in
`attention` or `waiting`, and refuses it whenever a Condition's type starts
with `pipeline`. Its comment assumes that revision unlinks old Conditions.

The probe used identical approved scope, PR, generation, and file identities.
An ordinary waiting child produced one revision. A running child, or a waiting
child with a pipeline Condition, produced none and reported that approval was
retained until work stopped. R1's API migration alone would leave this behavior.

This is the direct opposite of the agreed separation: the creator saves the
new requirement; the worker reacts at a checkpoint. A long pipeline should not
hold an approved correction hostage. This finding does not require immediate
cancellation or finer-than-whole-call checkpoints.

Smallest fix: remove the execution-state/Condition gate when moving to the
current revision capability. Keep creator authority and current-spec checks.
Let the existing worker iteration decide how retained work and pipeline facts
apply to the revised requirement. Reassess PR readiness against that requirement;
an old receipt must not become current merely because the source head stayed put.

Test the same authorized correction while idle, running, and waiting on a
pipeline; assert it is saved independently, outstanding facts remain observable,
and an old attempt cannot accept the revised requirement as fulfilled.

Cost/value: small App policy removal with meaningful integration tests. High
value, and less special-case code. Host revision tests already include status
changes during mapping and failure after a saved revision.

Source: [execution gate](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/agents/owner/workflows/lib/approved-repair-scope.ts#L162).

### R3 — High: the tested pipeline recovery adapter is not registered

`app.ts` installs `aksObservers`. Its pipeline entry calls `observeAksPipelines`
directly. The separate `trackedPipelineObserver` also reads native Task
Conditions to recover unregistered run IDs, but it is absent from that array.
Recovery tests invoke the separate export; the array test checks only names
and intervals.

The registered observer therefore lacks this specific safety net. Its default
scanner does perform recent/active/queued discovery and exact reads for IDs
already retained or registered. It does not lose every run. The vulnerable
case is a lost registration for a terminal run outside recent discovery whose
identity survives only in a Task Condition.

The offline wiring probe confirms distinct observer objects and zero Task
reads by the registered entry. It does not simulate Azure listing history.

Smallest fix: have one registered pipeline adapter combine retained IDs,
new registrations, and open Task Conditions. Preserve any project-wide
discovery that Master/Test Health actually requires; blindly replacing the
scanner with an owned-runs-only scan could remove useful discovery. Test the
entry obtained from the actual App definition, including pagination and a run
absent from broad discovery. Conditions should remain observable when an agent
is running as well as when it is waiting.

Cost/value: small wiring consolidation and one realistic boundary test. High
value for unattended progress; no new scheduler or registration protocol.

Sources: [registered array](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/watchers/observers.ts#L80),
[recovery export](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/watchers/observers.ts#L116),
[tests](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/watchers/observers.test.ts#L57).

### R4 — High: collecting a transition is mistaken for publishing it

The observer adapter's `record` only appends to an in-memory array. The pipeline
collector then saves fingerprint state and acknowledges registered IDs before
returning that array. The Host publishes later and may discard a result after
reload/shutdown, or fail while persisting events. Local fingerprints nevertheless
say the completion was handled. Unchanged terminal levels are suppressed.

The reproduction collected a completed run, discarded the returned events, and
polled the same provider state again. First poll: `pipeline-run.state`,
`project.test_run.completed`, `pipeline.completed`, and another state event.
Second poll: no events. This reproduces the collector boundary gap, not an
observed production outage. The existing test where `record()` throws covers
an earlier failure boundary; the canonical adapter's array append succeeds.

The matching Host already supports `{ events, nextObservation }` and retains
that snapshot only after durable publication. Use that contract for suppression
state instead of a second App acknowledgement mechanism. Durable downloaded
artifacts can stay App-owned files. Periodically reobserve exact outstanding
Conditions, including terminal provider state, so inexpensive repetition
recovers lost events. Limit repetition to relevant work rather than replaying
all historical runs every minute.

Test loss between collection and publication, partial publication, restart,
and a newly admitted Condition after completion. Duplicate facts are acceptable;
duplicate cloud work or permanently missing completion is not.

Cost/value: moderate localized collector/adapter work, high reliability value.
This is a distinct fix from R3. Registration recovery cannot repair a terminal
fact that the collector keeps suppressing as already seen.

Sources: [array-only recording](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/watchers/observers.ts#L50),
[terminal suppression](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/watchers/aks-pipeline.ts#L2340),
[early acknowledgement](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/watchers/aks-pipeline.ts#L3025).
Host: `src/app/adapters/producers/app-observer-runtime.ts:140–175` at the reviewed commit.

### R5 — Medium: writing responsibility is partly inferred from prose

`domainSourceWriteRequired` guesses whether a Task will edit source using
English keywords. The probe's “Fix the broken assertion in tests/example.ts”
was classified as `read-only-agent`. This is evidence of unreliable routing,
not evidence that an unauthorized file was actually written.

There is also a concrete instruction conflict: `problem-solver` tells its agent
it may fix local App/domain code, while it declares no task workspace and names
the shared project root in the prompt. The Host's workflow default is shared;
the dedicated source workflows declare task workspaces. The profiles expose
the trusted `coding` capability. A label saying read-only is not enforcement.

Smallest fix: keep unbound/problem investigation read-only in its actual tool
policy and prompt. If repair is needed, return the judgment to the creator and
bind the same appropriate Task to an existing source workflow with an isolated
workspace. Alternatively make a deliberately write-capable workflow declare
that workspace. Let the agent classify intent; code enforces the selected
capability. Retain regex checks only as useful lint, never the safety boundary.

Cost/value: small prompt/capability alignment and dispatch tests. Avoid adding
more synonyms or a second routing classifier. Existing worktree and exact-source
verification guards are valuable and should be reused.

Sources: [prose gate](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/domain-write-routing.ts#L43),
[solver instructions](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/agents/app-ops/workflows/problem-solver.ts#L87),
[solver dispatch](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/agents/app-ops/workflows/problem-solver.ts#L279).
Host default: `src/lib/workflow-tool.ts:440`.

### R6 — Medium: failed fetches can look like fresh repository observations

`fetchRemoteRef` ignores `git fetch`'s result, then `observeRepoRef` resolves
the cached remote-tracking ref. The watcher can publish that as the current
observation with a new check time. The probe used a nonexistent local remote
and a retained `origin/dev`; it still returned a successful-looking observation.

A cached commit may be useful evidence, but it cannot establish that the remote
has not moved. This weakens wait diagnosis and can hide an offline provider as
“unchanged.” Other workflows may refetch independently; this is not proof that
they will all accept stale source.

Smallest fix: surface fetch failure through the existing observer failure path,
or explicitly mark the returned observation as cached/unavailable. Keep the
last successful fact; do not stamp it as a fresh remote read. Add an offline
remote test alongside the successful-advance test.

Cost/value: small error-propagation fix; clearer diagnosis without new state.

Source: [fetch and cached read](https://github.com/hao1939/aks-rp-e2e-app/blob/033780f64b4a6964c92a031ac55765d4d1082eb7/watchers/repo-ref.ts#L73).

## Simplification decisions

Keep typed App ingress, exact Task identity, explicit return dependencies,
bounded admission, current-state reconciliation, provider correlation, isolated
source workspaces, and source-bound verification. Integration and PR approval
tests cover valuable guards, including failures, head changes, and human votes.
Running execution and outstanding async results remain independent concerns.

Whole-agent-call checkpoints are an acceptable default. Do not build a nested
controller, event taxonomy, or immediate interrupt system just for requirement
changes. A normal iteration can reread requirements and return missing judgment
to the creator. Agents should not manage event registration, elapsed-time
bookkeeping, or publication receipts.

The main complexity problem is overlapping responsibility, not the existence
of domain policy. The 10,723-line spec-live workflow and its mirrors/legacy
branches deserve gradual cleanup, but line count alone is not a defect. In
particular, `importNewerSpecLoopMirrorRows` accepts newer timestamped mirror
rows before saving both locations. That deserves a later authority review;
this review did not reproduce a lost-write or stale-acceptance failure there.
Do not turn that suspicion into a new global state framework.

Update the front-door README, agent instructions, and current design pages
alongside R1/R2. They still teach returned revisions, obsolete JSON Task
authority, `achieve` cleanup, and old ownership language. Mark historical
proposals as historical instead of rewriting every old incident report.
`verify-bundle-current.ts` checks mtimes for only selected roots/root files;
it cannot establish SDK or deployed provenance. Prefer a recorded source/SDK
identity and a fresh isolated build at release validation over more timestamp
heuristics. No broad dependency management framework is needed for this trial.

Two claims need restraint. First, `workResult(taskId, generation)` carries a
generation in its request, but App attachment uses the exact Task ID. That
alone does not prove stale result acceptance: a request for the current Task's
result and a pinned historical receipt are different contracts. Clarify intent
before adding generation-specific dependency machinery. Second, an investigation
may legitimately finish with an inconclusive finding if the creator receives
and judges it. Inspecting that feedback consumer is necessary before calling
the investigation's `converged` result a false domain success.

## Proposed order and acceptance

1. Repair the creator revision path and remove the execution gate together.
   Prove saved corrections survive a running worker, retained waits, and retry.
   Run the affected App tests against the exact candidate SDK/Host.
2. Consolidate the registered pipeline observer and use the existing publication
   contract. Prove a lost registration and a lost completion event are recovered
   by a later poll without duplicate provider execution.
3. Align diagnostic/write capabilities, fix failed-fetch reporting, and refresh
   current guidance. Trial a bounded AKS goal with a correction and a restart.
4. Measure before broader refactoring: time from accepted correction to saved
   spec; time from provider completion to useful Task feedback; stuck Conditions;
   repeated model/provider work; and source-bound verified outcomes. This review
   supplies no production CPU, latency, or token-saving claims.

## Reproduction material

[Diagnostic script](support/aks-workflow-review-probes-20260916.ts) takes the AKS
repository and resolved SDK directories as arguments. It intentionally asserts
the reviewed behaviors, so it should change or fail after repairs. It removes
only its own temporary fixtures. Run with Bun; no provider credentials needed.

```sh
bun projects/may.app/docs/reviews/support/aks-workflow-review-probes-20260916.ts \
  /app/projects/aks-rp-e2e-app \
  /app/projects/may-agent/bundle/sdk-a76c27dd385d87273f5271c25ece48b07d77f291
```

Local logs: `/app/.state/aks-independent-review-20260916/` contains
`typecheck.log`, `focused-tests.log`, `workflow-tests.log`,
`test-health-rerun.log`, and `probes.json`. The nine focused files are Task work,
canonical routing, action preflight, Task loops, observer adapters, repository
observer, spec-loop controller, problem-solver, and App-ops repository wait.
The seven additional files are approved repair scope, draft PR hygiene, Test
Health, Master Validation, pipeline collector, direct-dev integration, and PR
readiness approval. No full build, UI suite, or live integration gate was run.
