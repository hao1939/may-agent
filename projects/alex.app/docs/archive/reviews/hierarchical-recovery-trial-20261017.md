# Hierarchical recovery trial — October 17

**Supports:** [Hierarchical recovery](../../proposals/unified-agent-recovery-20261017.md). Checks whether existing caller feedback, execution and retry can restore original work before adding Host machinery.

**Current source status:** #381 merged; see the [merge record](#381-merge-record).
Earlier review entries retain the status at the time of each check.

## Result

The saved caller path can recover a worker that cannot prepare its workspace.
The worker's first failure reached its caller without starting the worker's
model. A scripted supervising agent repaired the prerequisite through the real
bash tool, and ordinary automatic retry completed the original assignment.
No Host runtime change was needed for this path.

The negative cases preserved the limit: an unresolved worker exhausted its
configured two attempts, and its caller retained an operator-owned Condition.
Without a caller or declared operational route, the failed Task remained in
attention and no agent ran. Retaining failure evidence is not delivery to a
responsible agent; that case needs an App/installation route, not an inferred
Host-selected repair agent.

This is a controlled mechanical trial, not proof of autonomous diagnosis,
universal escalation, human message delivery or production cost savings.

## Revisions and reproduction

- Host source: `8646f7785c3b7d66bed2e2110c5cd43d10a38e15` (merged #380).
- Harness: local Host branch `experiment/hierarchical-recovery-20261017`,
  commit `fdabbc4af`, file `test/integration/hierarchical-recovery-trial.test.ts`.
- Run from that checkout: `bun test test/integration/hierarchical-recovery-trial.test.ts`.
- Host TypeScript check and targeted ESLint passed for the harness.
- Final trial: **3 passed, 37 assertions, 0 failures**, approximately 96 seconds.

The harness is retained on its experiment branch rather than added to #381 or
a permanent production experiment service. It uses temporary repositories and
databases, local Git remotes and scripted provider responses. It calls the real
App registry, Task controllers, inbox, managed-agent runner, bash tool and Git
workspace backend. There are no external model calls or live installation
mutations. Each case removes its fixture and closes its runtime.

## Scenario and observations

A supervising Task requests a sample from another App. Each App has its own
Git repository and normal Git Task workspace configuration. The worker's local
bare remote lacks the configured `ready` branch; real workspace preparation
fails before its agent can start. The supervisor has an independent valid
workspace and an existing request/return relationship with the worker.

| Case | Work and result | Managed invocations | Elapsed |
| --- | --- | --- | --- |
| Repair | Caller receives setup failure, uses `bash` to publish the fixture's `main` commit as remote `ready`, and waits. Automatic retry runs the worker, which reads `sample.txt`; both Tasks accept sample `42`. | Supervisor 3; worker 1; one repair command; 6 scripted provider responses | 32.2 s |
| Unresolved | Caller retains an operator ask. Worker exhausts two setup attempts, reports exhaustion to the caller and remains in attention. The original sample remains unfulfilled. | Supervisor 3; worker 0; no repair command; 3 scripted provider responses | 31.9 s |
| No route | Input goes directly to the worker without a caller or operational subscription. Two setup failures leave it in attention. No supervisor Task is created. | Supervisor 0; worker 0; no provider responses | 31.6 s |

The three supervisor invocations have distinct purposes: assignment, first
failure consideration and final result/exhaustion consideration. They do not
form a recurring checkpoint loop. The default first retry delay is 30 seconds;
the harness neither advances the clock nor manually requeues the worker.
The repair tool actually changes the remote, and readback verifies the repaired
ref. The worker's ordinary bash tool actually reads the sample after setup.

Provider usage is synthetic zero data, not a measurement of model cost. The
invocation counts and elapsed time establish mechanics for these fixtures only.

## Fixture failures and corrections

The initial fixture omitted a local branch. The Git backend legitimately fell
back to `HEAD`, so work ran without the intended setup failure. The harness also
initially watched the wrong project field on reconciliation events. Those runs
failed their final assertions and are excluded from successful-recovery evidence.
The corrected fixture uses a missing advertised remote branch and the actual
event field. The source was not changed to make the failure injection work.

## #381 cleanup review

#381 remains a separate mechanical recovery change. Its head
`a9cc67ef625bf01c530af46970cb45c87d4e3aa9` rechecks the manager after requesting
cancellation. An execution remains live until it and its joined helpers finish
cleanup, so recovery must retain the claim and active marker until then. The
same check applies with present or absent metadata and needs no extra polling
loop. Missing metadata can then be tolerated using the retained Task identity.

- Three new regressions fail with the cleanup fix removed. The already safe
  startup live-session path continues to pass.
- Focused recovery checks: **13 passed, 125 assertions**.
- Full local `bun run ci`: **3,822 passed, 3 installation-specific skips,
  0 failures, 22,029 assertions**; Host/SDK types, App boundary and lint passed,
  and browser coverage executed.
- [GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/39020849750)
  passed at that head. The cleanup review thread was answered and resolved.
- [PR #381](https://github.com/hao1939/may-agent/pull/381) was marked ready for
  review; independent review and merge remain separate. No deployment occurred.

## #381 common recovery rule

The subsequent review replaced the missing-file exception with one rule:
the retained Task identifies its attempt/session and old execution cleanup is
confirmed. Missing or unreadable metadata and a missing copied binding no longer
prevent ordinary continuation. Readable ownership conflicts still block cleanup,
including a conflict in otherwise damaged metadata. A readable detached process
reference still establishes liveness even if the status field is unusable.

Metadata validation now preserves readable fields for those checks. It does not
coerce damaged lifecycle state or manufacture an old completion. The fixtures at this revision retained results with terminal or unreadable
metadata; later review exposed the running-metadata gap below. Ordinary startup
and claim paths give the replacement the retained
Task and readable history with gaps disclosed. The manager's existing cleanup
check applies to all these cases. No recovery scheduler, executor switch, App
route or SDK contract was added.

The refinement is published at `e4513ce7e36d1ae8bb7df4164206b4aac5ba5f31`.
Before it, the focused set had 6 passes and 20 failures, including newly expected
continuation and changed diagnostic assertions. Further regressions reproduced
non-text optional errors breaking context construction and structured error or
completion-time fields breaking database reconciliation. The shared reader now
validates those lifecycle fields before they are used; invalid values follow
the same incomplete-history path. There is no field-specific recovery branch.

- Final focused checks: **29 passed, 203 assertions**.
- Final local `bun run ci`: **3,839 passed, 3 installation-specific skips,
  0 failures, 22,148 assertions**, with Host/SDK types, App-boundary checks,
  lint and browser coverage passing.
- [GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/39022911107)
  passed on the same final revision. Hosted tests also report 3,839 passed,
  three skips and zero failures. The existing cleanup thread remains resolved;
  the refinement still needs independent review.
- Isolated design checks pass with the existing root `reports` warning.

After integration into shared `/app`, Markdown integrity and executable design
examples passed, but the canonical App audit reported three missing `app.ts`
files. Its existing ignored compatibility symlinks `projects/evaluation.app`,
`projects/gym.app` and `projects/may-agent.app` point into retired App local
directories. They date from October 4 and are unchanged by this documentation
commit; the audit script also matches its preceding revision byte for byte.
The shared-root check therefore has three environment/layout errors, plus
`features` and `reports` layout warnings. Do not claim that complete shared-root
check passed. The isolated source check and Host CI are separate successful
results; this change does not remove the compatibility paths or alter App policy.

A missing test import was corrected before the retained red run; that harness
mistake is excluded from the reproduction. Logs are under the existing evidence
directory's `unified-history/` subdirectory. Earlier full/affected runs apply to
preceding revisions; they are retained without claiming final-revision coverage.
This remains synthetic incomplete-history evidence, not a live #381 deployment.
The PR is unmerged; independent review and rollout remain separate.

## #381 result preservation and repeated startup

Two further review comments exposed gaps in the common recovery rule. Running
or idle metadata with a saved result and missing transcript could overwrite the
result; the normal `session.end` persistence subscriber was a second writer.
Separately, incomplete metadata could leave SQL marked running, then the next
startup sweep dropped the retained Task binding and rejected recovery.

Source `e77b882c494908821198c90f5050a5d9c236abb9` fixes those paths. Cleanup
preserves saved result bytes, descriptors and outcome evidence without emitting
a new completion event. Confirmed shutdown can settle a stale running SQL row;
an existing terminal row is left intact, and damaged metadata is preserved.
Terminal sweeps obtain the exact session from the retained attempt and use the
same adapter conflict checks. Copied helper context does not establish ownership.
No schema migration, additional recovery loop or App policy is introduced.

All 12 initial review regressions failed before the fix. Final focused checks
pass **14 tests with 111 assertions**, including the production event writer,
runtime close/reinstallation over persisted SQL, ownership conflicts and helper
scope. The first complete CI run had 3,850 passes, three skips and two failures:
older restart fixtures omitted the retained session and expected conflicts to be
silently skipped. Commit `b5db6bbf9db7ed9a78b522ab05eb7db4c0035b34` supplies
the actual attempt/session relationship and asserts the shared adapter's
conflict error while retaining the untouched-state assertions. The integration
suite then passed 23 tests/130 assertions. Runtime source is unchanged from
`e77b882c49`. Full final-head CI status is recorded in the
[Quality and Container checks](https://github.com/hao1939/may-agent/actions/runs/39024528693).
These are portable fixtures; the PR remains unmerged and undeployed.

The proposal review also replaced an absolute no-extra-model-call trial with a
persistent-loop criterion. Occasional at-least-once reconsideration is acceptable
when work returns to quiet waiting or useful progress. The original-owner startup
failure and connected human return still require their own trials; #381 does
not implement those App routes.

## #381 startup cleanup ownership

Review of `b5db6bbf9db7ed9a78b522ab05eb7db4c0035b34` found another gap:
the generic startup scanner could remove an active process marker before Task
recovery read it. Missing metadata therefore became false evidence of process
exit. Terminal metadata had another early cleanup path with the same problem.
The preceding revision's full local CI passed 3,852 tests with three skips and
zero failures; it did not exercise this startup ordering.

Commit `765705cff25d8cd92c98cac974d805c10122ccba` gives startup and Task recovery the same execution-owner check
and descendant drain in `src/lib/session-cleanup.ts`. The scanner has one
cleanup entry point instead of independent terminal, sentinel and stale-session
paths. Cleanup does not write results or release Task claims. Aggregate orphan
cleanup is deferred while session cleanup is pending; delayed projections are
accepted instead of adding another ownership inference.

Four regressions failed on the preceding source and pass after consolidation.
They call `startBackgroundRuntime` with a real external owner process and delay
the existing recovery hook until the generic scanner has run. Missing,
unreadable, running and terminal metadata all retain the original claim and
markers while that owner lives. After its actual exit, recovery and an ordinary
scripted attempt complete the retained Task and preserve its saved result.
This uses a real owner subprocess and production startup entry point; the
recovery hook runs an in-process runtime, not the installed recovery worker.

Two further process tests at that revision exercised draining retained descendants
before clearing markers with missing or terminal metadata. The missing-history
case did not establish an ownership source; the next review corrects that gap.
Existing stale-session
fixtures now represent an exited process incarnation instead of marking the
still-live test process as the owner. The affected eight-file suite passes 152
tests/768 assertions before the two descendant cases. Final local `bun run ci`
passes **3,858 tests, three installation-specific skips, zero failures and
22,323 assertions** in 271.82 seconds. Host/SDK types, boundary checks and lint
also pass. [GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/39025821654)
record the checks on this same source. This is portable failure injection, not
a live deployment.

The process lesson is to trace all writers and startup ordering before changing
a state rule. More local guards and passing isolated tests did not establish
the common boundary. The proposal keeps the rule at its contract and retains
the detailed incident evidence here.

## #381 startup admission and validation

Review of `765705cff25d8cd92c98cac974d805c10122ccba` found that sharing a process
drain was insufficient. Startup still bypassed the Task adapter's identity check
and trusted an unchecked metadata cast. Terminal metadata with a conflicting
binding allowed startup to kill retained descendants and clear markers before
Task recovery rejected the conflict. Object-valued `endedAt` or `error` fields
caused invalid SQLite parameters and failed startup.

Three production-startup regressions reproduced these failures before the fix.
Commit `663c6a1a44c042cc2e7eca7474e18ca47b13cd31` gives cleanup admission one
owner in `session-cleanup.ts`: it cross-checks
readable scope and returns validated lifecycle metadata before cancellation or
drain. Startup resolves its SQL/file scope through the retained attempt with
primary-key lookups; it does not scan historical attempt JSON or require a new
index. Task recovery already supplies the exact retained attempt/session.
Unresolved startup scope stays pending. A helper's inherited binding is checked
but does not authorize missing-history recovery of that helper. Valid helper
metadata still supports cleanup without changing the parent Task.

The standalone missing-history fixtures previously allowed cleanup with neither
a retained Task nor valid metadata, contradicting the contract. They now verify
that descendants and markers survive until valid evidence is restored, then
cleanup succeeds. Full CI first reported **3,865 passed, three skipped and one
failure**: an older sentinel-only fixture expected unconditional marker removal.
Commit `db56e87ea4b111b0536f5772d1103fdef918c16a` corrects that expectation and
verifies cleanup after evidence returns; its 16-test crash-recovery suite passes.
The normal adapter can still stop a rejected session from
valid metadata even though that session was never admitted as a Task attempt.

The expanded startup cases cover absent SQL projections, conflicting bindings,
damaged optional fields and original-Task completion without rewriting saved
results. They call the production startup entry point with the existing recovery
hook held until after the generic scan; they do not exercise the installed
worker bootstrap or a live deployment.

Final head `db56e87ea4b111b0536f5772d1103fdef918c16a` passes local `bun run ci`:
**3,866 passed, three installation-specific skips, zero failures and 22,408
assertions**, with the test run taking 338.25 seconds. Host/SDK types, boundary
checks and lint pass. Node is 24.20.0 and Bun is 1.3.14.
[GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/39028001797)
both pass on that head. The isolated design check passes with the existing
root `reports` warning. The PR remains unmerged and undeployed.

From the Host checkout, the new startup cases can be run with:

```sh
bun test src/app/core/tasks/app-task-runtime.test.ts --test-name-pattern 'startup leaves conflicting|startup recovers damaged optional|startup cleans a readable helper'
bun test test/integration/crash-recovery.test.ts test/integration/resume-agent.test.ts
```

## #381 recovery identity review

Two further comments exposed fallback evidence overriding an established
boundary. With no SQL session projection, a copied binding naming another real
retained attempt could authorize startup cleanup. Separately, an exited
process marker was reduced to a null PID, allowing detached metadata's reused
PID to make the old owner appear live again.

Host commit `2a4cb4e703cfa08abb07da87928330b25bc13e59` tightens the existing
lookups and process check. A file copy must resolve to the attempt's exact
session. Helpers and prior workflow steps can use their independent SQL session
association; losing that association delays cleanup until repair instead of
triggering a historical scan. The marker reader now retains exited process
evidence, and the same PID cannot override a rejected instance. Legacy metadata
uses the existing process-start check when its timing survives. Missing usable
identity or timing remains conservative; this change does not reconstruct it.

Five new regression cases failed before the change: one real-attempt conflict,
two direct reused-PID cases, and two full-startup cases. The initial additional
attempt fixture omitted a required Task fence; that fixture was corrected
before collecting these failures. The actual startup tests hold Task recovery
until after the generic scan, then verify ordinary continuation without replacing
saved result or damaged metadata bytes. Contrasting cases keep live detached
workers protected with missing/unreadable markers and independent PIDs. Helpers
and prior workflow steps recover after their SQL association is restored.

The six affected suites pass **359 tests, zero failures and 3,816 assertions**
in 48.49 seconds. Design integrity, examples and App audit pass in the isolated
docs worktree, with the existing root `reports` warning.

The first full local CI run stopped at a Bun 1.3.14 native segmentation fault
reported while running `workflow-guards-integration.test.ts`. The runner counted
3,555 passes, three skips and 20 failures/aborted suites; this is not a passing
run. The isolated owning suite then passed nine tests and 45 assertions without
source changes. The native crash did not reproduce there, and its underlying
engine cause has not been established. A second complete `bun run ci` passes
without source changes: **3,877 tests, three installation-specific skips,
zero failures and 22,495 assertions** in 326.07 seconds. Host/SDK types, boundary
checks and lint pass. There are no automatic retries or skipped regressions.
The initial failure, isolated check and final run are retained as
`pr381-identity-ci.log`, `pr381-identity-crash-repro.log` and
`pr381-identity-ci-second.log` in the archive named below, alongside the focused
checks and `pr381-identity-sha256.json`.

[GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/39029465861)
both pass on `2a4cb4e703`. These are portable process and scripted Task tests,
not an installed recovery-worker bootstrap or live deployment. The PR remains
unmerged and undeployed.

From the Host checkout:

```sh
bun test src/app/core/tasks/app-task-runtime.test.ts src/app/adapters/executors/session-recovery.test.ts --test-name-pattern 'startup leaves conflicting|reused detached PID|PID rejected|honors a live detached|independent SQL association'
bun run ci
```

## #381 merge record

GitHub confirms [#381](https://github.com/hao1939/may-agent/pull/381) merged into
Host `main` at **2026-10-17 14:06:04 UTC**, as
`b25344cc6c8e73da90596e8aed83a964c0c8a330`. The reviewed head was
`2a4cb4e703cfa08abb07da87928330b25bc13e59`; its checks and limitations are recorded
above. The merge check fetched Host `main` and verified the commit. It did not
deploy or inspect the running installation, so deployed adoption is unverified.

The incomplete-history foundation is complete in source. The remaining proposal
work is to prove failure delivery, a usable recipient through real worker
startup, and return to the original assignment. Those are separate from the
portable cleanup regressions already passed.

## Live recovery example

A read-only follow-up checked the actual agent transcripts, durable Tasks,
request completion, GitHub and deployment receipt for alert **4987**. All times
below are October 17, 2026, Asia/Shanghai.

| Time | Recorded action and result |
| --- | --- |
| 00:45 | Evaluator's query used nonexistent column `type`. The tool returned the schema; the next query used `event_type` and succeeded in the same invocation. Report event `6676114` requested follow-up. |
| 00:47 | Alex retained its original input and asked May through request `appdep_5fa0f7561a87acc33bdb7ce4`, with a corresponding Condition. |
| 00:50–01:02 | May inspected source, edited the producer and its regression, and created [Host #375](https://github.com/hao1939/may-agent/pull/375). After review/checks, its subsequent attempt merged and deployed commit `234a027a3d6105b37c51ddd4a8849e3760cdde26`. |
| 01:02 | Deployment interrupted May's execution. Recovery recorded `previous-runtime-attempt-requeued`; the same Task resumed, checked the completed deployment, and retained the pending post-change measurement. |
| 01:45–01:47 | Persisted metric sample `2225918` measured zero at 01:45:39.887, below threshold five. May completed at 01:46:39; Alex resumed, accepted the return and retired its Condition at 01:47:49. Both original inbox items are done. |

The original Alex Task is `input/app_604dce90-29c6-4f73-899f-579a1ecf61ea`;
May's dependency Task is `goal/appdep_5fa0f7561a87acc33bdb7ce4`. Their retained
attempts record the same original identities and the request/Condition changes.
Final reconciliation events are `6676398` and `6676405`. The deployment receipt
`deploy-20261016T170212Z-1152697` confirms the source commit, matching loaded
artifact, healthy status and `duplicateDeploy: false`.

Representative original transcripts are retained in `.state/sessions/` under
`s_1792169101644_fc58f77e-60cb-4a0f-8896-315845c8e214` (query correction),
`s_1792169249061_003242d7-7f32-4023-a9f9-458df969ded4` (implementation), and
`s_1792170058874_86f147da-e4a1-451e-9e58-f1e5f5ce6cea` (merge/deploy).
The [earlier observation](recovery-contract-20261017.md#first-natural-observation-cut)
independently records the initial report and its limits before final verification.

This supports real-agent correction, addressed escalation, restart continuation
and return to the original owner. One extra post-deployment reconsideration
occurred; the work still finished. The new zero sample includes historical rows
aging out of a rolling window; it does not prove the code change alone caused
the whole decline. This incident exercised successful owner startup, not failure
before the owner can run or delivery and response through the human interface.
The readback sent no agent messages and performed no runtime changes.

## Remaining boundaries and next change

Keep existing caller failure returns. This trial supports hierarchical recovery
without requiring every App to acquire system-repair expertise. It does not
justify a new Host recovery scheduler, universal cross-Task budget, or executor
switch.

The runner was in process and agent definitions were registered by the fixture.
The trial does not establish that a real worker subprocess can load a healthy
recipient while another App's workflow/registry bootstrap is broken. It also
does not install a fallback route for production Tasks without a caller. Those
remain explicit proposal gaps. First exercise the declared App/operational route
and the real worker startup boundary; change Host only if that exposes missing
generic execution or delivery support.

A bounded real-model trial is still needed for recovery when the original owner
cannot start. The live incident above supports judgment in an already usable
execution environment. An operator Condition in the scripted harness establishes
a retained ask, not that a human interface presented it or that a human acted.

## Retained evidence

Logs and checksums are kept at
`/home/hao/workspace-archive/hierarchical-recovery-20261017/`:
`trial.log`, `trial-types.log`, `trial-lint.log`, `pr381-red.log`,
`pr381-focused.log`, `pr381-ci.log`, the two fixture-failure logs and `sha256.json`.
The final trial log SHA-256 is
`da54cc4c814de919754f8c9cd7a03ae12acf354dd5c0bb89b70cc449cc0dbab9`.
