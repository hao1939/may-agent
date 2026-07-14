# Blocked Task Case Learning - 2026-07-10

Purpose: record representative blocked-task audits so the app can improve the
blocked-frontier review path without treating `blocked` as final or blindly
retrying unchanged work.

Current sampled state:

- `bun run health --json` at 2026-07-10T20:32Z showed 133 blocked leaves,
  zero overdue blocked waits, zero stale active tasks, and active movement.
- The blocked contract shape is mostly present: each sampled wait named a
  `waiting_for` condition, owner, observer, next check, and fallback.
- The remaining work is not "all blocked tasks are abandoned"; it is to find
  the blocked waits whose stated owner path, signal type, or resume condition is
  no longer truthful.

## Case: old GitHub pipeline wait after ADO migration

Task:

- `wait-secops-identity-system-assigned-run-28969586859-artifact-review-20260709`

Observed facts:

- The task is blocked under `aks-spec-verification-loop`.
- It waits for `github.workflow_run.completed` with run id `28969586859`.
- The current app design and pipeline execution path use Azure DevOps pipeline
  waits with `ado.pipeline_run.completed` when the app is waiting for a current
  ADO run.
- Only one current blocked task still uses `github.workflow_run.completed`.

Diagnosis:

- This is not enough evidence to convert the wait mechanically. The task text
  explicitly names an old GitHub run, so it may be a historical artifact
  visibility wait rather than a current execution wait.
- It is still a process risk because the watcher may be looking for a signal
  the current system no longer produces.

Suggested app action:

- App-ops should review this one task and decide one of three outcomes:
  1. replace it with an `ado.pipeline_run.completed` wait only if a real ADO
     successor run exists;
  2. reclassify it as `evidence.available` if it is only waiting for historical
     GitHub artifact visibility;
  3. create an exact follow-up/escalation if neither GitHub artifact access nor
     an ADO successor can be made reviewable.

Workflow lesson:

- Backend migration is a good blocked-frontier review signal. A blocked wait
  can be structurally valid but still semantically stale if its signal type
  belongs to an old execution backend.

## Case: capacity wait that is valid but should not be retried unchanged

Task:

- `wait-spec-rp-cluster-lifecycle-nodeless-cluster-crud-westus2-capacity-return-20260710`

Observed facts:

- The wait is for `azure.capacity.available`.
- It has a same-surface resume condition: retry only when westus2 staging
  managed-cluster create headroom materially changes or an owner-approved
  replacement surface exists.
- It has observer and fallback fields.

Diagnosis:

- This is a valid blocked wait. There is no evidence that another unchanged
  run would produce new information.

Suggested app action:

- Keep the holder until the next check/fallback. At fallback, refresh with
  current westus2 capacity/headroom evidence or replace it with a sharper
  owner/environment wait.

Workflow lesson:

- Capacity waits are not dead work when they name the exact surface and a
  fallback. The app should spend effort only when the wait is overdue, lacks
  evidence, or can be narrowed.

## Case: compact split-frontier holder with exact downstream owners

Task:

- `hold-compact-localdns-package-partial-frontier`

Observed facts:

- The compact holder names the exact LocalDNS downstream holders that own the
  remaining quarantined members.
- It forbids broad reruns while those exact holders are unchanged.
- It is observed by `feature-compact-loop-controller` on loop ticks.

Diagnosis:

- This is a healthy compact blocked shape. It keeps the feature package partial
  without pretending a broad compact rerun would help.

Suggested app action:

- Keep it blocked until one of the named downstream LocalDNS holders changes.
  Do not create a duplicate LocalDNS compact rerun from this holder alone.

Workflow lesson:

- Compact blockers should be projections of exact spec/frontier holders. A
  compact holder is useful when it prevents duplicate work and points to the
  real narrower wait.

## Case: compact holder with near-term fallback

Task:

- `hold-compact-egress-lockdown-package-partial-frontier-20260709`

Observed facts:

- The holder is a compact projection of the exact spec wait
  `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`.
- Its fallback is 2026-07-10T21:31:31.723Z.

Diagnosis:

- The holder is currently valid, but it is a good near-term test of whether the
  blocked-frontier review path refreshes or narrows holders at fallback time.

Suggested app action:

- Let the existing observer/fallback path handle it. If it remains true at
  fallback, refresh current evidence or replace it with a sharper holder; do
  not broad-rerun unchanged compact egress-lockdown.

Workflow lesson:

- Near-fallback blocked tasks are better watchdog samples than randomly chosen
  future waits.

## Case: app-ops audit found a false active-owner path

Task:

- `ops/refresh-overdue-spec-loop-blocked-family-batch1-20260710`

Observed facts:

- The app-ops audit reviewed 11 sampled spec-loop blocked families.
- It found 10 waits truthful as-is.
- It found one real gap: `hold-spec-serverless-virtualnodes-standard-extension-install-reviewed-frontier-20260707c`
  needs one bounded follow-up ask because prior wording referred to a
  nonexistent active domain task.

Suggested app action:

- Reviewer/planner should consume
  `evidence/archive/ops-refresh-overdue-spec-loop-blocked-family-batch1-20260710.md`.
- Preserve the serverless blocked holder, then create one bounded domain
  diagnosis/escalation follow-up for run `28673258682` and the
  `virtualnodes-ext` createHTTP=400/getHTTP=404 frontier.

Workflow lesson:

- A blocked wait can have a valid condition but still be wrong if it claims
  another active task owns the next step and that task does not exist. The
  blocked-frontier review should check claimed active-owner paths, not just
  fallback timestamps.

## General learning

- `blocked` is not complete. It is acceptable only when the wait is exact,
  watched, and has a fallback.
- The best review targets are not just the oldest blocked tasks. Prefer:
  near-fallback waits, old-backend signal types, waits that claim another task
  owns the next step, and compact holders with many downstream specs.
- The app should continue using planner/reviewer to mutate the task tree. This
  memo is evidence for the planner; it is not a direct runtime-state edit.
- App-ops repair retries must refresh their evidence identity, not only the
  target state. If a retry reuses a memo whose header still names the old
  attempt, the reviewer cannot easily tell whether the current attempt actually
  performed or verified the repair. The worker prompt now requires retry
  evidence to name the current attempt id and cite the supported read command
  plus live fields that prove the repair.
- Runtime state separation must be enforced in review prompts, not only in
  code. The row-60 holder repair was correctly visible through
  `bun run task-tree show`, but the reviewer rejected it after inspecting the
  stale checked-in `tasks/tree.json` snapshot. Reviewer and worker prompts now
  say to use the task-tree helper/live runtime tree and not treat
  `tasks/tree.json` as authoritative current state.
- Prompt guidance was still not enough for the row-60 loop: a later reviewer
  again rejected by reading `tasks/tree.json`. The task reviewer now has a
  deterministic guard for this stale-snapshot pattern: if the redo reason is
  based on checked-in `tasks/tree.json`, the worker cited supported runtime
  task-tree inspection, and the live target task contains the required exact
  wording, the reviewer accepts the repair instead of creating another redo.
- The same stale-fact problem appeared for feature compact loop state. The
  cluster-autoscaler compact repair had already updated the live
  `.state/feature-compact-loop/state.json` record to the five-carrier frontier,
  but the reviewer kept returning the old seven-carrier redo. The reviewer now
  checks the live compact-loop record before accepting that redo pattern. The
  fresh retry `a_ops-apply-normalize-spec-loop-blocked-frontier-family-20260711-state-rep_20260711020119`
  was accepted with `reviewer-used-stale-feature-compact-state-snapshot` and
  the task closed at `2026-07-11T02:02:32Z`.
- Acceptance metadata is not task closure. `update-accepted-review` can record
  why a repair is substantively accepted, but the task remains open until
  `project.task.reviewed` is applied or `mark-done` succeeds. The stuck-review
  repair correctly refused to force-close an active retry and then let the
  normal worker/reviewer/planner cycle close it after the retry completed.
- A visible "completed" child task is not project completion. On
  2026-07-11T03:00Z, `ops/normalize-spec-loop-blocked-frontier-family-20260711`
  and `ops/refresh-overdue-compact-package-partial-frontiers-20260711` both had
  accepted reviewer decisions while still appearing in the review frontier. The
  correct recovery was to re-emit canonical app events, not edit state: wake the
  planner with `project.planning.requested` for the accepted review task, and
  re-emit `project.task.completed` only when a review task still needed the
  reviewer to judge the current worker claim. The planner then marked both
  leaves done and rolled them up at 2026-07-11T03:01Z. UI/status language should
  distinguish "child repair completed", "review accepted", and "project/loop
  complete".
- Blocked-count reduction is not always the immediate win. On
  2026-07-11T03:04Z, the bootstrap-profile compact binding visibility repair
  replaced archived/missing anchors with one live holder:
  `hold-compact-bootstrap-profile-byo-acr-reviewed-create-cache-acr0-frontier-20260711`.
  That made the blocked count go up by one, but improved the process because the
  wait is now visible, exact, and has owner/resume/fallback fields. The planner
  then created the next active domain triage task for the create-cache-acr0
  frontier instead of leaving a hidden archived-id dependency.
- Follow-up review can race with manual/app-ops apply. On 2026-07-13, the
  focus metadata repair worker produced only a repair packet, so the reviewer
  correctly returned `followup`. While applying that follow-up, the target truth
  changed again: the diagnosis task
  `ops/diagnose-dev-infra-core-ado171990664-environment-overblock-20260713`
  had already been retired and replaced by the exact ADO wait
  `ops/wait-dev-infra-core-ado171990664-queue-result-20260713b`. The correct
  repair was not to replay the stale packet literally; it was to re-check live
  task-tree state, update focus/project metadata to the current exact wait, then
  close the original review with `--review-decision followup`. The planner also
  created a duplicate successor task after the follow-up decision; because the
  metadata repair had already landed, that successor was closed as `replaced`
  and its stale queued assignment was drained.
- Live validation progress requires a pipeline result. The same 2026-07-13
  dev-infra-core case has a real ADO run, `171990664`, but the run is still
  `notStarted`. That is not a test pass and not cluster creation proof. The
  app-visible state should remain one exact blocked wait for the ADO run result
  or artifact, with fallback escalation if the queue/result never arrives.
- Blocked waits must not point at completed diagnosis tasks as if they are
  still active owners. During the same ADO run `171990664` case, a later
  planner/worker update rewrote the exact wait to say an "active diagnosis"
  task owned the queue stall, but that diagnosis had already completed and been
  accepted. The correct wait shape is simpler: the wait itself owns the next
  ADO status/artifact check, records the last authenticated observation, and
  escalates only at the stated fallback if the run still has not moved.

## Routing result

Planner wake:

- A `project.planning.requested` wake was emitted with this memo and the
  app-ops audit as context.

Observed result:

- The planner/reviewer path consumed the app-ops audit and created
  `domain/review-spec-serverless-virtualnodes-standard-extension-install-frontier-20260710`.
- That task was assigned to `aks-explorer` and became active. This proves the
  missing active-owner path for the serverless extension-install frontier was
  repaired through the app mechanism instead of a manual task-tree edit.

Still open:

- The focused old-backend wait
  `wait-secops-identity-system-assigned-run-28969586859-artifact-review-20260709`
  still has `waiting_for.type=github.workflow_run.completed`.
- A second focused `project.planning.requested` wake was emitted for that exact
  task, but no new planner run was observed within the short verification
  window. This should be treated as a process-observability follow-up: either
  the wake was delayed/queued outside the sampled window, or human-steering
  events can be hidden behind other active planner work.

Next review target:

- Re-check the lone GitHub wait on the next blocked-frontier review. If it still
  has the old signal type, create a bounded app-ops task to classify it as
  historical artifact evidence, ADO successor wait, or exact escalation.

## Case: generic reviewed-blocked successor hid an exact publication wait

Tasks:

- `verify-bootstrap-profile-cache-direct-api-version-rerun-20260710-blocked`
- `ops/repair-bootstrap-profile-publication-wait-shape-20260710`
- `wait-compact-bootstrap-profile-api-version-repair-publication-return-20260710`

Observed facts:

- The reviewed worker result proved commit `1fca94a3c` or an equivalent
  descendant carrying the bootstrap-profile API-version repair was not on
  staging-visible `origin/dev`.
- The planner originally represented that as a generic reviewed blocked
  successor.
- App-ops later reviewed the overblock warning and replaced it with one exact
  publication wait,
  `wait-compact-bootstrap-profile-api-version-repair-publication-return-20260710`.
- The generic successor was marked done as replaced and archived by normal
  task-tree maintenance.

Diagnosis:

- The old shape was too vague. It said "blocked" but did not clearly distinguish
  project-side publication work from environment diagnosis or an unchanged live
  rerun.
- The corrected shape is one exact wait with a concrete resume condition:
  resume only after `origin/dev` contains the repair, then rerun the required
  policy checks and queue one same-spec ADO rerun.

App fix applied:

- `project-planner` now treats future blocked reviews that clearly describe an
  unpublished `origin/dev` repair plus rerun path as project-actionable backlog
  work instead of a generic external wait.
- The planner also backfills existing reviewed-blocked successors with that
  shape on the next planner wake.
- The design contract now says this is a narrow compatibility bridge; the
  cleaner future contract is a structured reviewer action such as
  `publish-domain-repair-and-rerun`.

Workflow lesson:

- `blocked` should name the real wait. If the wait is "publish the domain
  repair, then rerun", the app should not park it as generic blocked state. It
  should either create runnable project work or preserve one exact publication
  wait with owner, resume condition, and fallback.

## Case: refreshed wait kept stale resume timestamp

Task:

- `ops/wait-disabled-alert-alias-runtime-owner-decision-20260709j`

Observed facts:

- The wait had fresh `next_check_at` and `fallback_at` values, but its
  `resume_at` still pointed at the old overdue timestamp.
- The blocked-overdue metric treated the stale `resume_at` as actionable even
  though the task had just been refreshed.

Diagnosis:

- `task-tree update-text` merged blocker metadata by preserving the old
  `resume_at` when callers supplied a new `nextCheckAt` but no explicit
  `resumeAt`.
- That made a refreshed wait still look overdue to watchdog and metric paths.

Systemic fix:

- The SDK task-tree update path now treats a refreshed `nextCheckAt` as the
  default `resume_at` when no explicit `resumeAt` is provided.
- Added regression coverage in the SDK and app CLI tests.
- Refreshed the live wait through `bun run task-tree update-text`, not by
  manually editing `.state`.

Workflow lesson:

- For blocked waits, `next_check_at` and `resume_at` must move together unless
  the caller intentionally provides a different resume time. A split timestamp
  creates false overdue work.

## Case: compact holder orphan after downstream wait refresh

Task:

- `hold-compact-egress-lockdown-package-partial-frontier-20260709`

Observed facts:

- The compact holder was still blocked with July 9/10 review timestamps.
- The actual downstream spec wait
  `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702` had already been
  refreshed to the July 11/12 owner-response window.
- The compact state no longer referenced the compact holder. It referenced the
  sharper downstream waits instead.

Diagnosis:

- The compact projection repair recognized the generic
  `Hold compact feature ... on exact ... wait` holder shape, but not this
  timestamped custom holder text.
- The controller therefore left an orphan compact child under the loop even
  though the feature state had moved to sharper exact waits.

Systemic fix:

- The compact runtime projection now closes stale compact holder projections as
  `replaced` when the holder is no longer referenced by the feature state and
  the holder text explicitly names the sharper replacement wait.
- Added regression coverage for the timestamped egress-lockdown holder shape.
- Verified by emitting a real `project.task.tick` for `feature-compact-loop`.
  The task was archived as replaced, blocked leaf count dropped, and
  `aks-rp-e2e.process.blocked.overdue-unworked-count` returned 0.

Workflow lesson:

- A compact holder is useful only while it is the current projection. Once the
  feature state points at sharper exact waits, the loop should close the old
  projection instead of leaving it as another blocked surface.

## Follow-up: GitHub wait inference repair

Additional live observation:

- A newly accepted node-confidential artifact-recovery owner-return wait was
  initially created as `github.workflow_run.completed` for terminal GitHub run
  `28672036322`.
- The blocker text was not waiting for the GitHub run to finish. It was waiting
  for a returned owner/runtime response with recovered artifacts, a workflow
  surface diagnosis, or an exact decline/reroute.

Root cause:

- `scripts/task-tree.ts` inferred `github.workflow_run.completed` whenever the
  blocker text named GitHub and a run id.
- That was too broad. A task can mention a GitHub run as historical evidence
  while actually waiting for artifact recovery, owner response, or environment
  availability.

Fix:

- `scripts/task-tree.ts` now infers `github.workflow_run.completed` only when
  the blocker text actually waits for the run to complete, reach terminal
  state, finish, or report a conclusion.
- Artifact-recovery/owner-return text can now fall through to
  `environment.available` or `evidence.available`.
- `scripts/task-tree.test.ts` now covers both paths:
  - real GitHub run-completion waits stay `github.workflow_run.completed`;
  - owner artifact-recovery waits are not misclassified and existing bad waits
    are repaired.

Verification:

- `bun test ./scripts/task-tree.test.ts --timeout 30000` passed.
- `bun run typecheck` passed.
- `bun run task-tree repair-blocked-contracts --dry-run` identified exactly one
  safe live repair:
  `ops/wait-node-confidential-vm-snp-pool-run-28672036322-artifact-recovery-owner-return-20260710`.
- `bun run task-tree repair-blocked-contracts` applied that one repair.
- A later query found zero blocked leaves with
  `waiting_for.type=github.workflow_run.completed`.

App response:

- The planner consumed the focused human-steering event and created
  `ops/reclassify-secops-identity-system-assigned-github-run-28969586859-wait-20260710`.
- The old secops GitHub-era wait is no longer present as a blocked leaf; the
  active app-ops task now owns the evidence-backed reclassification.

Workflow lesson:

- Signal names must describe what the app is waiting for, not which historical
  system produced the evidence. A terminal GitHub run with missing artifacts is
  not a `github.workflow_run.completed` wait; it is an artifact/evidence or
  owner-response wait.

## Follow-up: compact exact wait holder projection repair

Additional live observation:

- Several compact features were blocked in `.state/feature-compact-loop`, but
  their visible task holders had stale text saying to "restore the missing
  compact blocked holder".
- Three exact compact holders had also been archived as `done` by stale
  passed-spec cleanup even though compact-loop state still had those features
  blocked.
- After restoring those holders, a direct compact projection probe still found
  compact state repairs for stale `taskId`, `nextCheckAt`, and `fallbackAt`
  fields.

Root cause:

- Exact compact wait holders were only protected when they carried the newer
  `context.featureCompactExactWait` flag. Legacy holders were recognizable by
  their name, conflict scope, and goal, but the stale cleanup path did not use
  those conventions.
- Runtime projection changed compact-loop state in memory, but state-only
  repairs could lose to a newer runtime-state timestamp during save.
- Three features could oscillate between two live blocked carriers because the
  projection retargeted from a live holder to a compatible shared wait, then
  the next projection sharpened it back.

Fix:

- Exact compact holders are now recognized by convention as well as by context:
  `feature-compact:*`, `feature-compact-wait:*`, and the standard "Hold compact
  feature ... on exact ... wait" goal shape.
- Stale exact holder text is refreshed from compact-loop state.
- Wrongly closed exact compact holders are reopened or recreated when the
  compact state still says the feature is blocked.
- State projection repairs now bump the touched feature record timestamp so the
  normal runtime-state merge persists the repair.
- Projection no longer retargets away from a live blocked carrier only because
  another compatible shared wait also exists.

Verification:

- `bun test ./workflows/feature-compact-loop.test.ts --timeout 30000` passed
  with 70 tests.
- `bun run typecheck` passed.
- `bun run integrity` passed with only the known domain-layout warnings.
- `bun run bundle` passed.
- A direct compact controller pulse reported projection repair work, and the
  follow-up direct projection probe returned `taskRepairCount: 0` and
  `stateRepairCount: 0`.

Workflow lesson:

- A blocked compact holder should stay visible if its feature is still blocked
  in compact state. Cleanup code must recognize the holder by stable naming and
  scope conventions, not only by the newest context flag.
- Projection must converge. If two valid wait carriers exist, the app should
  keep the current live blocked carrier unless it is missing, closed, replaced,
  or there is a proven sharper exact frontier.

## Case: compact holder was closed, then recreated with stale watch times

Tasks:

- `hold-compact-bootstrap-profile-cache-direct-create-cache-acr0-contradiction-frontier-20260710`
- `hold-compact-rp-cluster-lifecycle-package-partial-frontier`

Observed facts:

- The planner marked these leaves done because their immediate review work was
  accepted and sharper follow-up work existed.
- The underlying compact features were still blocked in
  `.state/feature-compact-loop/state.json`, so the compact runtime projection
  correctly recreated/reopened visible holder tasks.
- The recreated holders inherited old `next_check_at` / `fallback_at` values
  from compact state. That made newly-created holders look stale immediately.

Diagnosis:

- The word "completed" was misleading at the leaf level. The review leaf was
  closed, but the compact feature was not complete.
- Recreating a visible holder is valid when compact state still has a blocked
  feature, but the recreated holder needs a fresh watch window if the saved
  compact-state window is already expired.

Systemic fix:

- `feature-compact-runtime-projection` now preserves valid future watch times
  but replaces missing or expired compact holder `next_check_at` /
  `fallback_at` values when recreating or reopening exact compact holders.
- Added a regression test that starts with an expired compact state wait and
  verifies the recreated holder is not born overdue and compact state aligns
  back to the live holder.

Workflow lesson:

- Closing a leaf should mean "this work item was accepted/replaced", not "the
  underlying feature is finished". Durable loop state remains the source of
  truth for whether the feature/spec loop is complete.
- When the app reopens work from durable state, it must refresh the watch clock
  or immediately create the correct recovery task; otherwise the UI shows stale
  blocked work right after the system acted correctly.

## Case: review decision emitted but not applied quickly enough

Tasks:

- `reconcile-spec-loop-pending-localdns`
- `reconcile-spec-loop-pending-secops-fips`

Observed facts:

- The workers repeatedly completed broad spec-family fix-forward tasks with
  useful prose but without the required structured `FIX_FORWARD_RESULT` in
  `workflowResult.details.fixForward`.
- `task-reviewer` correctly rejected those completions as `redo` when the
  structured result was missing.
- During the review, the live task tree could temporarily show a task still in
  `review` even though `.state/task-reviewer-runs.jsonl` already contained a
  reviewer decision for the same current attempt.
- Later project movement showed the app did eventually apply/replace the
  LocalDNS and SecOps-FIPS family leaves: LocalDNS was archived, and SecOps-FIPS
  produced a structured fix-forward decomposition packet at
  `evidence/archive/reconcile-spec-loop-pending-secops-fips-20260710-fix-forward.md`.

Diagnosis:

- A reviewer decision is only half of the closure path. The task is not closed
  until `project-planner` applies the decision, stale-noops it with proof, or
  creates owned follow-up work.

## Case: stale GitHub rerun evidence reused for an ADO fix-forward task

Task:

- `reconcile-spec-loop-pending-secops-fips`

Observed facts:

- The live task context said `currentBackend: ado` and explicitly listed
  old/backend route-change facts as hints to re-evaluate.
- The worker completed with a structured fix-forward result, but the summary and
  evidence reused `evidence/archive/reconcile-spec-loop-pending-secops-fips-20260708.md`.
- That evidence was a July 8 GitHub Actions packet and claimed three
  `run-single-spec.yaml` GitHub reruns. It did not prove current ADO reruns,
  current ADO artifacts, or a current no-rerun ADO decision.

Diagnosis:

- The old reviewer contract checked that the fix-forward result was structured,
  but did not catch that the structured result still described the old execution
  backend as the current action.
- This is exactly the kind of blocked-task failure we want the app to handle:
  the task should not be accepted, and it should not be manually fixed. The app
  should reject the stale completion and create narrower work that rechecks the
  current ADO route.

Systemic fix:

- `task-reviewer` now has a deterministic guard for fix-forward tasks whose
  current backend is ADO. If the completion claims a current GitHub rerun,
  GitHub workflow, `run-single-spec.yaml`, or Actions run as the action, it
  emits `redo` unless the completion explicitly says GitHub is only historical
  evidence and names the current ADO fact.
- Added regression coverage in `workflows/task-reviewer.test.ts`.
- Re-emitted the live completion event through the app. The fixed reviewer
  emitted `redo`, and the planner replaced the broad stale task with
  `domain/reconcile-spec-loop-pending-secops-fips-ado-routing-20260710`.

Workflow lesson:

- Structured output is necessary but not sufficient. The reviewer must also
  check whether the worker used current facts for the task's current route.
- Backend names in a completion are not harmless wording. If the app now runs
  ADO, a current-action claim about GitHub reruns is a stale-result smell and
  should become a redo with exact feedback.
- The design already listed `aks-rp-e2e.process.task.review-not-applied-count`,
  but the metric sampler did not implement it. That meant the UI/design had a
  name for this black-hole shape, but the metrics system could not catch it.

Systemic fix:

- Added `aks-rp-e2e.process.task.review-not-applied-count` to
  `scripts/project-metrics.ts`.
- Registered the metric in `scripts/register-project-metrics.ts`.
- The metric counts only clear violations: a task remains in `review`, the
  current attempt has a `project.task.reviewed` row, and the planner-application
  grace window has passed.
- Added regression coverage in `scripts/project-metrics.test.ts`.

Verification:

- `bun test scripts/project-metrics.test.ts --timeout 30000` passed.
- `bun run metrics:sample aks-rp-e2e.process.task.review-not-applied-count --json`
  returned zero on the live project after the planner caught up, which matched
  the current task tree.

Workflow lesson:

- "Review emitted" is not enough. A review fact must be applied or explicitly
  stale-nooped. If it is not, the process sensor should catch it and wake
  app-ops instead of leaving humans to notice a review task sitting forever.
- Broad fix-forward tasks must not be accepted from prose. The structured
  result is the handoff contract that lets reviewer and planner make a safe
  next move.

## Case: app-ops repair task blocked by worker authority wording

Task:

- `ops/repair-compact-cluster-autoscaler-heptet-frontier-state-20260710`

Observed facts:

- The planner created the right app-ops repair task after compact run
  `171747047`: restore one live compact cluster-autoscaler VM-prerelease heptet
  holder and repair `features.cluster-autoscaler.frontierTaskIds`.
- The worker investigated correctly and wrote
  `evidence/archive/ops-repair-compact-cluster-autoscaler-heptet-frontier-state-20260710.md`.
- The worker did not apply the repair because Task Worker Mode said normal
  workers must not create/restore task-tree branches or edit app loop state.
- `task-reviewer` correctly returned `redo`: the live holder was still missing
  and compact state still had the wrong frontier ids.

Diagnosis:

- This was not a domain failure. The project had already found the exact
  desired repair.
- The app contract was ambiguous for app-ops tasks: app-ops is supposed to fix
  app-owned runtime state, but the generic worker prompt only allowed narrow
  existing-task metadata updates.
- A blind `redo` would likely repeat the same refusal because the task shape
  and prompt did not give the worker a supported path to apply the state repair.

Systemic fix:

- `default-task-worker` now detects explicit app-ops state repair tasks and
  adds a narrow "App-ops state repair authority" section.
- The exception is scoped to `app-ops` / `ops/*` tasks that explicitly mention
  task-tree or app loop-state repair.
- The worker may use task-tree CLI commands for task-tree changes and existing
  app store/controller/projection helpers for loop state, but still must not
  edit `.state/tasks/tree.json` directly or do unrelated planning work.
- Added regression coverage in `workflows/task-worker.test.ts`.

Workflow lesson:

- Domain workers should not own task-tree mechanics, but app-ops repair tasks
  sometimes must apply app-owned state repairs. The boundary needs to be
  explicit in the prompt, or the system creates the right task and then blocks
  the worker from doing it.
- `redo` is only useful when the next attempt has a changed condition. Here the
  changed condition is the clarified app-ops repair authority.

## Case: terminal-run review leaves needed a planner wake, not completion credit

Tasks:

- `domain/hold-compact-net-integration-mixed-frontier-20260710`
- `domain/hold-compact-rp-cluster-lifecycle-octet-package-partial-frontier-20260710`
- `wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709`

Observed facts:

- These leaves were in `review` after terminal Azure DevOps runs were observed.
- They were not proof that the compact loop was done. They were passive
  returned-run review holders.
- A `project.planning.requested` wake with reason
  `manual-review-frontier-push` moved the tree forward through normal app
  mechanisms.
- The planner accepted/replaced the passive holders and created concrete work:
  `domain/reconcile-compact-net-integration-run-171742498-mixed-frontier-20260710`,
  `ops/repair-planner-timeout-cluster-autoscaler-frontier-review-20260710`,
  and a fresh `reconcile-spec-loop-pending-secops-fips` attempt.
- Health briefly reported queued assignment rows, but `.state/task-assignments.jsonl`
  was empty and event traces showed `task-worker` workflows running. The warning
  cleared on the next health sample.

Diagnosis:

- "Review" means the app has a result to judge or convert; it is not final.
- Terminal pipeline waits must become one of: accepted pass/done, exact blocked
  holder, concrete artifact-reconciliation task, repair task, or escalation.
- A transient assignment warning can be a handoff race. Confirm with event trace
  and task-worker started/completed journal rows before treating it as stuck.

Workflow lesson:

- When terminal-run review leaves sit in the frontier, wake the planner through
  `project.planning.requested` and let it create/apply the next concrete task.
- Do not manually edit runtime state to clear review leaves.
- Health signals are hints; for suspected assignment stalls, check the local
  assignment file and event trace before creating repair work.

## Case: domain review found app-state drift, not domain work

Task:

- `domain/reconcile-compact-cluster-autoscaler-run-171747047-heptet-frontier-20260710`

Observed facts:

- The worker reviewed ADO run `171747047` and classified the seven
  cluster-autoscaler VM-prerelease members as unchanged/not executed.
- The worker also found app-state drift: compact-loop state pointed at the
  intended heptet frontier, but the live task tree lacked the corresponding
  blocked holder.
- The worker correctly refused to mutate the app task tree from a domain task.
  Its result was `blocked` on planner/app-ops authority.

Diagnosis:

- This is not a retryable domain failure. Running the same domain task again
  would likely repeat the same refusal.
- It is also not a true external wait. The next action is local app-owned state
  repair: restore or create the exact blocked holder and keep loop-state
  pointers aligned.

Systemic fix:

- `project-planner` now recognizes blocked review text that names app task-tree
  or loop-state repair plus planner/app-ops authority.
- For that shape, the planner creates runnable app-ops follow-up work instead
  of a passive blocked successor.
- Regression coverage was added in `workflows/project-planner.test.ts`.

Workflow lesson:

- Domain workers can discover app-state drift, but app-ops must apply app-owned
  task-tree or loop-state repairs.
- A `blocked` review should be read for the actual next action. If the next
  action is local app repair, keep the project moving with an `ops/*` task
  instead of treating it like quota, product, or human wait.

## Case: live pass still required an exact contract-repair successor

Task:

- `domain/review-spec-rp-cluster-lifecycle-upgrade-k8s-version-run-171671159-20260710`

Observed facts:

- Azure DevOps run `171671159` was terminal, artifact-complete, and passed for
  the implemented `spec.rp-cluster-lifecycle.upgrade-k8s-version` carrier.
- The reviewed bundle proved the implemented cluster-upgrade assertions, but
  the spec still declared `assert.nodepool-upgraded`.
- The worker evidence explicitly said the member should not be promoted out of
  the compact frontier yet; it should be replaced by one exact repo-local
  contract-repair item.
- The reviewer labeled the task `accept`, but the planner still applied the
  right concrete outcome: it created
  `domain/repair-spec-rp-cluster-lifecycle-upgrade-k8s-version-contract-mismatch-20260710`
  and updated the compact holder to a residual seven-member frontier plus that
  exact repair.

Diagnosis:

- The live run result was good evidence, but not final closure for the feature
  frontier. It proved the current probe, not every claim the spec advertised.
- The app should not require another broad rerun for this. The correct next
  move is a narrow repo-local decision: either split/remove the unproven claim
  or implement the missing nodepool verification and rerun only this exact
  spec.

Systemic fix:

- `task-reviewer` now has a deterministic guard for completions that say a live
  run/artifact passed while an exact contract mismatch or promotion blocker
  remains.
- That shape emits `followup` instead of relying on the reviewer agent to infer
  it from prose.
- Added regression coverage in `workflows/task-reviewer.test.ts`.

Workflow lesson:

- "Pipeline passed" means the returned carrier passed. It does not automatically
  mean the spec/model is complete.
- If the worker result says "passed, but this exact mismatch remains", the app
  should create one narrow successor and keep the broader feature frontier from
  reopening.

## Case: durable loop root appeared as review even though it was not complete

Task:

- `aks-spec-verification-loop`

Observed facts:

- Health showed `aks-spec-verification-loop` under the review frontier.
- The loop's own `workflowProgress` said `completionReady=false`, with 172
  pending specs, 5 error specs, 78 blocked wait leaves, and one follow-up leaf.
- Running `repair-rollups` reported that it reopened the durable loop root, but
  the raw task still appeared as `review` because the shared task tree derives
  parent state from child review state.
- The real review item was the child follow-up, not the durable controller root.

Diagnosis:

- This was a UI/frontier projection problem, not evidence that the spec loop was
  complete.
- Generic parent rollup state is useful for ordinary trees, but durable loop
  roots have their own progress contract. If `workflowProgress.completionReady`
  is false, the root should not be shown as a human-review completion item.

Systemic fix:

- App-level `summarizeTaskTree` now filters incomplete durable loop roots out of
  the review frontier while keeping the actual child review tasks visible.
- `repairTaskTreeRollups` now runs durable-loop reopening after generic rollup
  repair, so the repair trace is not immediately hidden by generic parent
  projection.
- Added regression coverage for an incomplete spec-loop root with a child review
  leaf.

Workflow lesson:

- Do not read a durable loop root's parent-derived `review` state as
  completion. The loop's `workflowProgress` is the authority.
- Humans should review concrete leaves. Durable loop roots should summarize and
  drive the loop until `completionReady=true` or an exact watched blocked state
  is the truthful pause.

## Case: terminal compact wait kept looping through review instead of returning to an exact wait

Tasks:

- `hold-compact-rp-cluster-lifecycle-execute-ready-octet-frontier-20260710`
- `domain-review-compact-rp-cluster-lifecycle-run-171715936-residual-fronti-2`

Observed facts:

- ADO run `171715936` was terminal and failed, so the compact controller moved
  the exact `rp-cluster-lifecycle` holder into review.
- Domain review evidence showed the run added no remaining same-package
  promotion after the later reviewed `new-vnet-lifecycle-vm-prerelease` pass.
- The truthful state was not another broad rerun. It was the same exact
  execute-ready octet wait, with `new-vnet-runner-variant` and
  `nodeless-cluster-crud` kept outside the branch.
- The reviewer asked for "Planner/app-ops metadata cleanup", but the generic
  follow-up path copied the domain owner. The domain worker then correctly
  refused to mutate app-owned task-tree state.
- Restoring the holder with ordinary text update was not enough: old terminal
  run metadata in context/trace would let the compact controller immediately
  harvest the same completed run and move it back to review.

Diagnosis:

- A terminal pipeline wait has two possible outcomes:
  - if artifacts prove pass/fail, advance the branch;
  - if artifacts prove "no promotion; the same exact wait still stands", return
    the holder to blocked with a frontier-change wait, not a run-completed wait.
- App-owned metadata cleanup is ops work. It should not be routed to the domain
  worker just because the reviewed task was a domain task.

Systemic fix:

- `project-planner` now routes follow-up reviews that clearly name app-owned
  task-tree/loop-state repair to `app-ops`, not the original domain owner.
- Added `task-tree refresh-blocked-wait` for the exact reviewed-wait case. It
  restores a leaf to blocked, writes a structured blocker contract, and strips
  terminal pipeline/GitHub wait metadata so the controller does not re-harvest
  the same completed run.
- `feature-compact-loop-controller` now treats only structured wait fields as a
  live pipeline wait source. Historical run IDs mentioned in blocker prose are
  evidence context, not a signal to re-harvest the same completed run.
- Added regression coverage in `workflows/project-planner.test.ts` and
  `workflows/task-tree-tools.test.ts`.

Workflow lesson:

- "Pipeline run is terminal" is a wake-up signal, not final truth. After review,
  the app must record the new truth: pass, repair, artifact gap, escalation, or
  the same exact wait with a different resume condition.
- When the required action is "fix the app/task tree state", route it to
  app-ops. Domain workers should produce evidence and AKS judgment, not mutate
  app-owned runtime state unless the task explicitly delegates that command.

## Case: assigned in the tree is not enough evidence that work is running

Tasks:

- `advance-rp-cluster-lifecycle-execute-ready-promotion-heptet-20260710`
- `review-rp-cluster-lifecycle-upgrade-k8s-version-run-171791171-20260710`

Observed facts:

- The task tree showed both tasks as assigned/active and
  `.state/task-assignments.jsonl` had assignment rows.
- The first local DB query used the wrong path and appeared to show no runtime
  events, which would have implied a dispatch gap.
- The real runtime DB is `/app/.state/may.db`. It showed matching
  `workflow:task-worker` sessions for both task IDs, both running under
  `aks-explorer`.

Diagnosis:

- A task-tree assignment row proves the planner selected work. It does not by
  itself prove the worker started.
- The authoritative runtime proof is a matching `workflow:task-worker` session
  or handled `project.task.assigned` event in the daemon state.

Suggested app action:

- Keep the health warning for queued assignments, but make investigation check
  the runtime DB/session layer before claiming the app is stuck.
- If a task is assigned without a matching worker session after the allowed
  dispatch delay, app-ops should wake the planner/watchdog or re-emit the
  assignment through the event bus instead of directly editing the task.

Workflow lesson:

- "Assigned" means the planner made a decision. "Running" means the runtime
  accepted it and started the worker session. Debug both layers before deciding
  a task is abandoned.

## Case: worker recommended a task-tree mutation but the task was accepted as done

Tasks:

- `advance-rp-cluster-lifecycle-execute-ready-promotion-heptet-20260710`
- `apply-rp-cluster-lifecycle-promotion-heptet-split-20260710`

Observed facts:

- The heptet worker produced useful evidence, but the actual result was a
  recommendation: replace the broad `rp-cluster-lifecycle` promotion holder
  with four smaller successor leaves.
- The planner initially accepted the task as done without applying the
  recommended tree mutation.
- The missing mutation left the compact frontier represented by older broad
  holder text instead of the exact successor leaves.
- After adding a reviewer guard, the app reprocessed the case as a follow-up.
  The planner then created the four exact successors:
  `domain/hold-rp-cluster-lifecycle-residual-promotion-quartet-20260710`,
  `domain/repair-rp-cluster-lifecycle-create-get-delete-mutation-gate-20260710`,
  `domain/repair-rp-cluster-lifecycle-stop-start-mutation-gate-20260710`, and
  `domain/verify-rp-available-agent-pool-versions-post-repair-rerun-20260710`.

Diagnosis:

- "Worker wrote a good recommendation" is not the same as "the task is done".
- If a task's acceptance requires an exact task-tree mutation, the reviewer must
  only accept after the mutation is already applied or the result proves the
  mutation is unnecessary.

Systemic fix:

- `task-reviewer` now converts `accept` to `followup` when the task asks for an
  exact task-tree mutation and the worker only returns a recommendation for the
  planner to apply.
- `project-planner` now treats app-owned task-tree scopes as app-ops work even
  when the task id is not under `ops/`. This prevents task-tree repair followup
  from being routed to a domain worker just because the source task was domain
  work.
- The live app behavior was verified: the original heptet split task was marked
  done only after the successor leaves were created, and the runnable successor
  leaves were assigned to workers.

Workflow lesson:

- A reviewer should judge the current state, not just the quality of the
  worker's note.
- Domain workers can explain what task-tree change is needed, but app-ops must
  apply app-owned task-tree/runtime mutations unless the task explicitly grants
  that authority.

## Case: parallel planner wake overrode a reviewer redo

Task:

- `reconcile-spec-loop-pending-secops-fips`

Observed facts:

- The worker again reused the stale July 8 GitHub rerun packet for a task whose
  live inputs said `currentBackend: ado`.
- `task-reviewer` correctly emitted `redo` for attempt
  `a_reconcile-spec-loop-pending-secops-fips_20260711000310`.
- A separate metric-breach planner wake was already running. It saw the same
  task in `review`, judged it inside the planner session, and marked the task
  `done` with an accepted summary.
- The result contradicted the latest reviewer decision and archived the task as
  completed even though the independent review said to retry.

Diagnosis:

- The app had two paths able to close review work:
  1. deterministic `project.task.reviewed` application, and
  2. general planner/app-ops task-tree mutation during metric/watchdog wakes.
- The second path can race with reviewer output. Once a reviewer has judged a
  current attempt, that decision must be the authority for closing the review
  task. A parallel planner wake should not convert a rejected completion into
  accepted done.

Systemic fix:

- `markTaskDone` now checks `.state/task-reviewer-runs.jsonl` for the latest
  reviewer decision for the current task attempt before closing a task still in
  `review`.
- If the latest decision is `redo`, `markTaskDone` refuses to close the task.
  The task must go through `reject-review` / `project.task.reviewed` handling.
- For non-redo review decisions, `markTaskDone` requires the caller to name the
  same `reviewDecision`, so a generic parallel planner wake cannot silently
  close a reviewed task without applying the reviewer result.
- `project-planner` now passes the explicit reviewer decision when it is the
  deterministic review-event handler applying `accept`, `followup`, `blocked`,
  or `escalate`.
- Added regression coverage in `workflows/task-tree-tools.test.ts`.

Workflow lesson:

- Review decisions are facts, not suggestions. Once emitted for the current
  attempt, app-ops must apply that decision or explicitly create a successor
  that explains why the live state changed; it must not independently accept
  the same worker claim from another wake.
- Metrics and watchdog wakes can shape new work, but they should not override a
  current reviewer verdict for the same attempt.

Follow-up verification:

- After the guard was committed, the same secops-fips task was re-opened and
  assigned again instead of staying falsely done.
- The first retry still reused stale GitHub evidence, so `task-reviewer` emitted
  `redo` for attempt `a_reconcile-spec-loop-pending-secops-fips_20260711001322`.
- The planner applied that redo and started a fresh attempt
  `a_reconcile-spec-loop-pending-secops-fips_20260711001442`.
- The fresh worker result used current ADO-era state and wrote
  `evidence/archive/reconcile-spec-loop-pending-secops-fips-current-ado-20260711.md`.
- The reviewer changed from `redo` to `followup`, and the planner created the
  active successor
  `ops-apply-reconcile-spec-loop-pending-secops-fips-state-repair`.
- Health moved from `attention` with review debt to `moving` with no review
  backlog.

Workflow lesson:

- A useful fix-forward loop may need more than one retry. The important thing is
  not that the first retry succeeds; it is that every retry is judged against
  current facts and the next state becomes more exact.

## Case: app-ops state repair inherited domain fix-forward rules

Task:

- `ops-apply-reconcile-spec-loop-pending-secops-fips-state-repair`

Observed facts:

- The planner created this task as an app-ops successor after the secops-fips
  domain reconciliation correctly returned `followup`.
- The app-ops worker created the two exact secops-fips ADO returned-run holders
  and rebound affected spec-loop rows away from the archived family holder.
- The reviewer still emitted `redo` because the task context had inherited
  `workflow: fix-forward` from the reviewed domain task, so the reviewer
  required domain `FIX_FORWARD_RESULT` fields even though the work was app-owned
  task-tree/loop-state repair.

Diagnosis:

- `project-planner` copied the reviewed task context wholesale when creating
  an app-ops state-repair successor.
- That copied domain workflow tag changed how the reviewer judged the successor.
  The result was process friction: a real app-ops repair could be rejected for
  missing domain-workflow boilerplate.

Systemic fix:

- App-ops state-repair successors no longer inherit `context.workflow` from the
  reviewed task.
- The successor still keeps the `reviewedTask` packet and conflict scope, so it
  remains traceable without being judged by the wrong domain workflow contract.
- Added planner regression assertions for blocked and follow-up review paths.

Workflow lesson:

- Task successors should inherit evidence and scope, not blindly inherit the
  worker contract. A domain task can produce an app-ops repair, but the app-ops
  repair must be reviewed as app-owned state work.

## Case: review-state task without a reviewer wake

Tasks:

- `hold-compact-bootstrap-profile-cache-direct-create-cache-acr0-contradiction-frontier-20260710`
- `aks-feature-compact-loop`

Observed facts:

- The compact loop moved a terminal Azure DevOps wait into `review` after run
  `171479025` completed failed.
- The task tree showed review work, but `.state/task-reviewer-runs.jsonl` had no
  current reviewer decision for that review state.
- `task-reviewer` only reacts to `project.task.completed`; a task merely being
  in `review` is not enough to wake the reviewer.
- The durable compact-loop root also entered `review` from a liveness/stall
  path even though current loop health described represented exact blocked-wait
  stewardship.

Diagnosis:

- The process had a missing-event shape. Some watchdog/controller paths can put
  a task into `review`, but if the corresponding `project.task.completed` event
  is lost or never created, the independent reviewer is not guaranteed to run.
- A review card on the UI is therefore not proof that anyone is judging it.
  The proof is a current-attempt reviewer row or a planner action that applies a
  reviewer decision.

Systemic fix:

- `project-execution-watchdog` now recovers review leaves that already have a
  worker claim or terminal pipeline wait review but no current reviewer
  decision.
- The watchdog re-emits `project.task.completed` for the exact attempt. For
  terminal pipeline waits without an attempt, it creates a deterministic
  terminal-wait review attempt and emits a `blocked` completion claim.
- The watchdog does not judge the result itself. It only restores the normal
  event path so `task-reviewer` remains the judge and `project-planner` remains
  the state applier.

Workflow lesson:

- State and events must close together. If a task is in `review`, the system
  needs either a reviewer decision for the current attempt or an explicit
  recovery event that recreates the missing review trigger.

## Case: compact state reopened a stale holder while a narrower ADO wait existed

Tasks:

- `hold-compact-bootstrap-profile-cache-direct-create-cache-acr0-contradiction-frontier-20260710`
- `domain/wait-bootstrap-profile-cache-direct-cache-switch-ado171800822-terminal-result-20260711`
- `aks-feature-compact-loop`

Observed facts:

- The live task tree already had a current blocked ADO wait for bootstrap-profile:
  `domain/wait-bootstrap-profile-cache-direct-cache-switch-ado171800822-terminal-result-20260711`.
- That wait had `waiting_for.type=ado.pipeline_run.completed` and run id
  `171800822`.
- Compact-loop durable state still pointed parent feature `bootstrap-profile`
  at the older holder
  `hold-compact-bootstrap-profile-cache-direct-create-cache-acr0-contradiction-frontier-20260710`.
- The newer wait used the narrower scope
  `feature-compact:bootstrap-profile:cache-direct-cache-switch`.
- The older holder had already been reviewed as stale/replaced, but projection
  could reopen it because it did not connect the narrower sub-feature wait back
  to the parent feature state.

Diagnosis:

- The compact loop had two visible carriers for the same underlying feature
  frontier: an old parent holder and a newer exact ADO run wait.
- The right source of truth was not "the old taskId in durable state"; it was
  the live blocked wait that named the current ADO run and narrower feature
  branch.
- This is a projection problem. Manually editing the task tree would only hide
  the symptom until the next controller pulse.

Systemic fix:

- Compact runtime projection now treats blocked ADO pipeline waits with
  `feature-compact:*` scope as exact compact waits.
- Sub-feature keys such as
  `bootstrap-profile:cache-direct-cache-switch` can represent their parent
  feature when the parent exists in compact-loop state.
- Projection rebinds the parent feature `taskId` to the live ADO wait instead
  of reopening the stale old holder.
- ADO pipeline waits keep their precise `waiting_for` payload; projection does
  not rewrite them into a generic compact wait.
- Added regression coverage:
  `reprojects blocked parent feature to live ADO subfeature wait instead of reopening stale holder`.

Workflow lesson:

- When a narrower live wait exists, it should own the feature frontier. Durable
  loop state should be reprojected to that wait instead of reviving an older
  parent holder.
- Compact projection must understand feature/sub-feature aliases, because the
  app often learns a sharper branch after the first broad package holder was
  created.

## Case: app-ops task wrote audit evidence in the domain repo

Task:

- `ops/repair-spec-verification-blocked-family-normalization-20260711`

Observed facts:

- The task declared app evidence output
  `evidence/archive/ops/repair-spec-verification-blocked-family-normalization-20260711.md`.
- The worker completed with a review claim saying that exact evidence file had
  been written.
- The file was not present under `/app/projects/aks-rp-e2e.app/evidence`.
- The file was present under the domain workspace:
  `/app/projects/aks-rp-e2e/evidence/archive/ops/repair-spec-verification-blocked-family-normalization-20260711.md`.
- The content was useful: it identified the shared BYO UDR prerequisite
  owner-input pair and explained why direct consolidation would lose exact
  per-spec resume semantics.

Diagnosis:

- The worker did domain-quality audit work, but wrote the app-ops artifact to
  the wrong repository.
- This makes the review path fragile because the task output points to an app
  artifact that does not exist, even though a same-named artifact exists in the
  domain repo.
- The root cause is prompt ambiguity: app-ops tasks operate on app state, but
  the generic worker prompt emphasized that evidence notes stay in the domain
  workspace.

Systemic fix:

- `default-task-worker` now says app-ops task outputs and app audit evidence
  paths listed in the assigned task, such as `evidence/archive/ops/*.md`, are
  rooted at the app directory unless the task explicitly names an absolute path
  or the domain workspace.
- Added task-worker regression coverage that runs an app-ops task with separate
  app and domain directories and asserts the prompt carries the app-rooted
  output rule.

Workflow lesson:

- The app is the organizer, so app-ops audit artifacts belong with the app
  unless the task explicitly asks for domain evidence.
- A task being in `review` with a plausible summary is not enough. The reviewer
  and planner need artifact paths to match the declared outputs, or they should
  reject/retry with corrected output placement.

## Case: terminal ADO wait is not done until artifacts are classified

Tasks:

- `domain/wait-rp-cluster-lifecycle-stop-start-repaired-ado171798563-result-20260711`
- `domain/classify-rp-cluster-lifecycle-stop-start-ado171798563-artifacts-20260711`

Observed facts:

- The stop-start compact frontier was narrowed to one exact wait on Azure
  DevOps run `171798563`.
- The watchdog correctly observed that the ADO run became terminal with
  conclusion `success` and moved the wait into `review`.
- The first completion only said the pipeline was terminal and that artifacts
  should be inspected. It did not inspect the returned artifact/result JSON.
- The task reviewer rejected that as `redo`: a terminal pipeline state is not a
  spec verdict.
- The planner then replaced the passive completed-run wait with
  `domain/classify-rp-cluster-lifecycle-stop-start-ado171798563-artifacts-20260711`,
  an active domain task that owns artifact/result inspection.

Diagnosis:

- "Pipeline completed successfully" means the execution host finished, not that
  the selected AKS spec passed.
- A terminal-run wait should never close only from pipeline status. It must
  become artifact classification work unless the result artifact was already
  inspected and cited.
- The watchdog/reviewer/planner chain works when each step keeps its boundary:
  watchdog detects terminal run, reviewer rejects handoff-only completion, and
  planner creates the exact artifact-classification successor.

Systemic fix:

- `task-reviewer` now rejects accepted completions that cite missing durable
  `evidence/archive/*.md` memos. This prevents a worker from making a task look
  done while the proof file is absent.
- Verified the live runtime path: the terminal ADO wait was rejected and
  replaced by an active classifier task instead of being accepted as done.

Workflow lesson:

- Treat terminal pipeline waits as "ready to inspect", not "done".
- The next concrete domain task should name the run id, spec id, repaired
  commit, expected artifact evidence, and exact classification outcome:
  pass, repair follow-up, or exact blocker.

Follow-up observed on 2026-07-11:

- The classifier task correctly landed as `blocked`, not `done`, because the
  artifact bundle was still unavailable.
- The planner then converted it into one exact blocked wait:
  `domain/wait-rp-cluster-lifecycle-stop-start-ado171798563-artifact-recovery-shared-ado-auth-return-20260711`.
- That is the right shape: a blocked classifier should not stay as an open
  review task once the reviewer accepts the blocker. It should become one
  exact wait with run id, resume condition, fallback, and owner lineage.
- A second runtime issue appeared: that artifact-recovery wait still contained
  `waiting_for.type = ado.pipeline_run.completed`, so the watchdog moved it
  back to `review` because the run was already terminal.
- The planner repaired the live tree to a clearer authenticated-artifact
  classification holder:
  `domain/wait-rp-cluster-lifecycle-stop-start-ado171798563-authenticated-artifact-classification-shared-ado-auth-return-20260711`.
- The watchdog was updated so artifact-recovery/auth-capable-runtime waits are
  not re-harvested as terminal pipeline waits. Terminal pipeline state is only
  the signal to start artifact classification; after classification says
  artifacts are inaccessible, the next wait is artifact recovery, not pipeline
  completion.

## Case: do not collapse truthful spec waits, but repair stale mirrored holders

Tasks:

- `ops/normalize-spec-loop-blocked-frontier-family-20260711`
- `hold-compact-cluster-autoscaler-vm-prerelease-environment-heptet-frontier-20260710`

Observed facts:

- The app-ops audit reviewed LocalDNS and cluster-autoscaler blocked families.
- LocalDNS had four old blocked leaves, but they represented different real
  waits: residual create HTTP 400, quota/headroom, owner/source response, and
  one exact hosts-plugin branch.
- Cluster-autoscaler spec-loop leaves were also still exact and should remain
  separate.
- The stale part was the mirrored compact cluster-autoscaler holder. It claimed
  seven downstream carriers, but three named child tasks no longer existed in
  the live tree.
- The planner accepted the audit and repaired the compact holder text so it now
  points only to the five live downstream carriers.

Diagnosis:

- "Many blocked leaves in one feature" does not automatically mean duplication.
  The app must compare the actual waiting condition, not just feature name.
- A mirrored family holder can become stale even when the underlying exact
  spec-loop leaves are still correct.
- Dead child references are a concrete bug because future reviews may wait on
  work that no longer exists.

Workflow lesson:

- First audit whether waits are truly the same wait.
- If they are distinct, keep them separate and record why.
- If a parent or compact projection references missing child tasks, repair that
  projection even when the underlying child waits are still valid.

## Case: compact holder text must match current compact artifacts

Task:

- `ops/repair-spec-localdns-blocked-family-representation-20260711`

Observed facts:

- The first LocalDNS repair correctly found the spec-loop waits were distinct,
  but the refreshed compact holder still mixed current compact-quarantined
  members with specs that were no longer compact-quarantined.
- The reviewer rejected that claim because `spec.localdns.hosts-plugin` was
  treated as compact quarantine even though current compact artifacts listed it
  as ready, and the holder omitted the two VM-prerelease specs from the
  compact-quarantined set.
- The retry inspected live task-tree state, spec-loop state, and
  `features/localdns/compact/staging.*` artifacts together.
- The accepted repair kept the four distinct spec-loop waits, narrowed the
  residual HTTP 400 wait to drop recovered `cni-matrix` coverage, and refreshed
  the compact holder to separate active downstream waits from stale compact
  exclusion residue.

Diagnosis:

- A feature-level compact holder is not just a summary of blocked spec-loop
  leaves. It must also match the current generated compact artifact.
- A compact artifact can still list stale excluded/quarantined residue for specs
  that spec-loop state already normalized to pass. The holder must say that
  plainly instead of turning those rows back into active waits.
- The reviewer was useful here because it compared the worker claim against the
  current artifact, not just against the task text the worker changed.

Workflow lesson:

- For compact-holder repair, always inspect three sources before claiming done:
  live task tree, loop state, and the generated compact artifacts.
- Do not collapse exact spec-loop waits only because they share a feature.
  Collapse or repair only when the wait condition is the same, or when the
  parent/compact projection is stale.
- If compact artifacts and spec-loop state disagree, record the disagreement as
  artifact residue versus active wait coverage. Do not silently choose one view.

## Case: artifact recovery is not the same as terminal classification

Tasks:

- `ops/recover-bootstrap-profile-ado171800822-artifact-access-20260711`
- `domain/review-bootstrap-profile-ado171800822-terminal-artifact-classification-20260711`

Observed facts:

- The first terminal-wait review for ADO run `171800822` could not classify the
  result because the worker did not have local Azure DevOps artifact access.
- The planner correctly replaced that passive blocker with active recovery work
  instead of leaving it as a generic environment wait.
- The recovery worker restored `az pipelines` artifact access, downloaded
  `plan-inputs` and `slice-01-test-results`, and proved the exact
  `spec-runner/result.json` still reports `create-cache-acr0` timing out after
  `4500000ms` under API version `2026-04-02-preview`.
- The reviewer did not accept recovery as final classification, because the
  task acceptance also required creating/assigning the exact successor review
  task or sending a concrete handoff.
- The planner then accepted the recovery as useful, archived it, and created
  `domain/review-bootstrap-profile-ado171800822-terminal-artifact-classification-20260711`
  to consume the downloaded artifacts and reconcile the exact feature frontier.

Diagnosis:

- Restoring artifact access is a support step. It proves the evidence is
  available, but it does not itself close the domain question unless the task
  explicitly also performs the terminal classification.
- A worker memo that says "planner should create the successor" is useful but
  not closure. The app must either create the successor or mark a concrete
  handoff/escalation.
- The reviewer/planner split worked here: reviewer rejected incomplete closure,
  and planner converted the useful evidence into the next exact task.

Workflow lesson:

- Terminal pipeline state means "ready to inspect", not pass/fail truth.
- Artifact recovery means "we now have evidence", not "the feature frontier is
  reconciled".
- The healthy path is: terminal wait -> artifact recovery if needed -> exact
  artifact-backed classification task -> pass, repair, or exact blocked wait.

## Case: useful diagnosis still needs a concrete successor

Tasks:

- `domain/diagnose-bootstrap-profile-create-cache-acr0-runtime-frontier-20260711`
- `domain/investigate-bootstrap-profile-create-cache-acr0-runtime-frontier-20260711`
- `ops/repair-overdue-compact-package-partial-watch-family-20260711`
- `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`

Observed facts:

- The bootstrap-profile diagnosis proved the `create-cache-acr0` timeout from
  ADO run `171800822` is an exact single-spec runtime frontier under API
  `2026-04-02-preview`, not the shared westus2 capacity family and not a fresh
  repo-local defect.
- The reviewer did not accept the diagnosis as final closure because it only
  recommended the next branch shape. It did not create or prove a concrete
  successor.
- The planner applied that follow-up correctly by replacing the diagnosis with
  `domain/investigate-bootstrap-profile-create-cache-acr0-runtime-frontier-20260711`.
- The compact package-partial repair showed the same pattern in a blocked-holder
  form: the audit found missing AAD-RBAC row-37 holder coverage, and the planner
  restored `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
  as the concrete downstream wait before closing the repair.

Diagnosis:

- "We know the right next step" is not the same as "the project can move."
  The task tree must contain the next active task or exact blocked holder.
- A useful memo should be accepted only when either the task acceptance was
  audit-only or the planner immediately converts the memo into concrete work.
- Restoring an exact blocked holder can be real progress when it replaces hidden
  drift with a visible wait condition, owner, resume condition, and fallback.

Workflow lesson:

- Reviewer should keep rejecting or following up on diagnosis-only claims when
  the acceptance requires a successor.
- Planner should convert accepted evidence into exactly one of: active successor,
  exact blocked holder, or explicit escalation.
- Closing a repair is safe only after the live tree carries the next state, not
  merely after an evidence file describes it.

## Case: review claim needs the canonical event path

Tasks:

- `ops/repair-private-cluster-jumpbox-followup-lineage-20260711`
- `wait-private-cluster-jumpbox-key-execution-surface-return-20260704`
- `hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix`

Observed facts:

- The private-cluster repair worker completed and moved the task to `review`
  with a concrete `done` claim and evidence memo.
- Health still showed the claim as review-pending until the existing completion
  claim was re-emitted through `project.task.completed`.
- After the re-emit, the task-reviewer accepted the claim and the planner marked
  the repair done, then rollup archived the completed leaf.
- The accepted repair did not bypass review: the reviewer checked the proof
  lineage, the affected live holders, and the remaining resume/observer/fallback
  fields before closure.

Diagnosis:

- A worker completion in the task tree is not enough by itself when the review
  event is missed or not consumed promptly.
- The correct recovery is to re-emit the same completion claim through the
  canonical app event path, so the reviewer remains the judge and the planner
  remains responsible for applying the decision.
- Manual state mutation would have hidden the process issue and skipped the
  acceptance check.

Workflow lesson:

- For review-pending leaves with a real worker claim and no current reviewer
  decision, use a canonical `project.task.completed` re-emit.
- Do not mark the task done directly. The closure path must remain:
  worker claim -> reviewer decision -> planner apply -> rollup.
- Evidence should name both the repaired downstream holder and the process step
  that made the review move again.

## Case: follow-up memo must become live work

Tasks:

- `domain/triage-bootstrap-profile-byo-acr-create-cache-acr0-environment-frontier-20260711`
- `domain/investigate-bootstrap-profile-create-cache-acr0-live-system-frontier-20260711`
- `hold-compact-bootstrap-profile-byo-acr-reviewed-create-cache-acr0-frontier-20260711`
- `hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-investigation-return-20260711`

Observed facts:

- The triage task produced useful evidence and the reviewer agreed with its
  direction, but the reviewer returned `followup` because the task only
  recommended the next investigation. It did not create or prove that successor.
- A planner wake converted the review result into concrete live work by creating
  `domain/investigate-bootstrap-profile-create-cache-acr0-live-system-frontier-20260711`.
- The created task was initially runnable but idle. Assigning it through
  `task-tree assign` moved it to active, and the worker started at
  2026-07-11T03:10:34Z.
- After the successor was active, the temporary compact review holder was marked
  done and replaced with
  `hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-investigation-return-20260711`,
  which is the truthful blocked compact-facing wait while the investigation
  runs.
- Health moved from `attention` with review/runnable backlog to `moving` with no
  review backlog and no runnable idle work.

Diagnosis:

- A good triage memo is not movement until the task tree contains the exact next
  active task, blocked holder, or escalation.
- Planner follow-up can create the right successor but still leave it runnable
  and idle. Health's `frontier.runnable-idle` signal is the practical check for
  that gap.
- A compact holder in `review` should not remain as a parking lot once an active
  successor exists. It should be closed or replaced by an exact wait that names
  what it is waiting for.

Workflow lesson:

- For `followup` reviewer decisions, verify three things in order: successor was
  created, successor was assigned/started, and the old review holder was closed
  or replaced.
- Do not call this complete when the pipeline run says `completed`; here
  `completed` meant ADO finished with `failed`. Project progress was the
  artifact-backed triage and successor handoff, not a passing test.
- The clean shape after repair is: active investigation owns the next work;
  compact loop has one exact blocked holder pointing at that active
  investigation; review frontier is empty.
- When manually re-emitting app events, use the app's project id
  `aks-rp-e2e`, not the folder name `aks-rp-e2e.app`. A wrong target can be
  accepted by the daemon but miss the app handler, making it look like the
  planner ignored a valid wake.

## Case: code should annotate facts, not judge from prose

Observed facts:

- The task reviewer had paths that could override or reshape a reviewer result
  from prose checks. Those paths now keep the reviewer decision and append
  validation notes unless a hard structured contract is missing.
- The planner converted some accepted reviews into follow-up tasks when an app
  invariant was still false. It now records `review_accept_invariant_failed`
  and leaves the review unapplied, so app-ops/reviewer decides the next move.
- Pipeline waits were partly recovered by extracting run ids from goal or
  blocker text. The watchdog now requires structured run metadata such as
  `waiting_for.runId`, `context.adoRunId`, or trace run fields before it treats
  a blocked task as an external pipeline wait.
- Compact runtime projection now preserves structured `waitingFor` and explicit
  `frontierTaskIds` instead of collapsing them to a single shared wait inferred
  from wording.

Diagnosis:

- Text is useful evidence, but it is not a contract. If code infers intent from
  phrases such as "queued run", "shared wait", or "planner should", it can make
  silent project decisions that the owner never reviewed.
- The stable boundary is: code validates structured fields and records hard
  invariant failures; the agent/reviewer decides accept, redo, follow-up,
  blocked, or escalation.

Workflow lesson:

- Workflow outputs that expect code action must include structured fields.
  Examples: queued pipeline run id, affected spec ids, waiting condition,
  `waitingFor.type`, and explicit frontier task ids.
- When a structured field is missing, do not guess from prose. Keep the work
  reviewable, record the missing contract, and let the owner decide the next
  move.

## Case: terminal run review and compact routing need structured contracts

Observed facts:

- Terminal Azure DevOps wait reviews could produce a useful evidence memo, but
  the default worker only forwarded deliverable paths and generic prose. The
  reviewer could not consume that as a same-spec live result without guessing.
- Compact exact-wait owner routing used to inspect blocker reason text for
  words like capacity, owner, promotion, or kubeconfig. That silently moved work
  between agents based on prose.
- Compact retry reset had a fallback that inferred a rerun from accepted task
  wording. The spec loop already required explicit `specRetryReset`, so compact
  loop was inconsistent.

Diagnosis:

- Evidence files are useful for humans, but app-owned follow-up needs explicit
  structured result fields.
- Owner routing and retry reset are project decisions. Code can consume
  declared fields, but it should not infer those decisions from summary text.

Workflow lesson:

- Terminal pipeline wait reviews must emit `SPEC_RESULT_REVIEW` with run id,
  spec id, result path, spec status, artifact refs, and live proof fields.
- Compact wait owner routing must use explicit supported owner fields or
  `waiting_for.type`. Unknown prose falls back to `aks-explorer`.
- Compact retry reset must use `compactRetryReset`; accepted rerun wording alone
  is not enough.

## 2026-07-13 Refresh

Current sampled state:

- `bun run tasks:summary` at 2026-07-13T06:36Z showed 145 tasks, 142 leaf tasks,
  one active leaf, 139 blocked leaves, two done leaves, no runnable work, and no
  review queue.
- The only active leaf was
  `ops/reconcile-repo-dirty-checkpoint-slices-20260713c`, owned by `app-ops`.
- `aks-spec-verification-loop` remained blocked with 69 blocked child waits.
  Its controller progress reported 486 pass, 5 error, 173 stranded pending, and
  zero dispatchable pending.
- `aks-feature-compact-loop` remained blocked with no pending/running/error
  compact items, 33 done compact items, and a blocked frontier represented by
  exact compact wait holders.

## Case: Shared Worker/Model Auth Outage Normalized Behind One Holder

Tasks:

- `domain-diagnose-rp-operation-status-polling-run-171938111-claim-failures`
- `ops/wait-shared-worker-model-auth-capability-return-20260713`

Observed facts:

- The domain diagnosis worker did not inspect ADO run 171938111 artifacts. It
  failed before useful domain work because the model/provider auth path returned
  a token-expired 401.
- The planner normalized the dependent domain branch behind
  `ops/wait-shared-worker-model-auth-capability-return-20260713`.
- The shared wait now carries exact approval lineage: request event `3116409`,
  message `3116412`, path
  `shared-worker-model-auth-capability-outage-20260713`, and packet
  `evidence/archive/ops-escalate-shared-worker-model-auth-capability-outage-20260713-packet.md`.
- The shared holder carries its own scheduled review trigger with
  `resume_at` / `next_check_at` at `2026-07-13T12:00:00Z`; a separate
  `ops/review-1200-shared-worker-model-auth-family-lineage-20260713` leaf was
  later consolidated away so the family is represented by one live wait instead
  of two blocked leaves.
- The dependent RP operation-status diagnosis branch has the same 12:00Z
  earliest watch time and explicitly names the shared wait as the owner of auth
  recovery, so it should not start a branch-local auth retry before the shared
  family review window opens.

Diagnosis:

- This is a valid shared outage holder. The domain branch should not retry the
  artifact diagnosis or create duplicate auth repair work while the shared
  worker/model auth capability is unresolved.

Suggested app action:

- Keep one exact shared holder for the auth outage.
- Resume the domain diagnosis only after a returned owner/runtime decision or a
  fresh bounded worker run proves the auth capability recovered.
- Let the shared holder's 12:00Z review trigger be the next owner action. If
  nothing changed by then, refresh the same shared holder/review lineage instead
  of creating duplicate per-branch auth blockers.

Workflow lesson:

- Environment/tooling outages should be deduplicated into one exact family
  holder. Dependent domain tasks should point to that holder instead of each
  inventing separate repair or blocked states.
- A healthy shared outage has one live family holder carrying the external wait
  and an explicit review schedule. A separate watch leaf is optional; if it
  duplicates the holder, consolidate it.

## Case: LocalDNS Compact Holder Is A Healthy Projection

Task:

- `hold-compact-localdns-package-partial-frontier`

Observed facts:

- The holder is blocked on exact downstream holders:
  `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`,
  `wait-localdns-create-http400-residual-family-return-20260704`, and
  `hold-spec-localdns-windows-nodepool-unsupported-nonlive-evidence-ceiling-20260712`.
- It also excludes stale/resolved residue rather than treating every old
  LocalDNS-related item as active compact debt.

Diagnosis:

- This compact holder is doing the right job: it preserves the feature-level
  compact frontier while pointing to the narrower spec/frontier blockers that
  actually need to change first.

Suggested app action:

- Do not broad-rerun LocalDNS compact work from this holder alone. Resume only
  when one named downstream holder changes, or when the compact package
  projection itself is regenerated with different represented frontier.

Workflow lesson:

- A compact loop can be blocked in a useful way when it is a projection of exact
  downstream waits. The app should distinguish healthy projection waits from
  abandoned compact work.

## Case: Focus Approval Is A Real Human Wait

Task:

- `focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711`

Observed facts:

- The task is blocked on a returned `project.approval.submitted` lineage, not on
  missing worker capacity or hidden runnable work.
- The live wait names request event `3069971`, message `3069974`, original
  message `3065844`, and path
  `focus-review-off_track-approval-refresh-20260712`.

Diagnosis:

- This is a true external owner wait. Duplicating approval asks would make the
  lineage less clear.

Suggested app action:

- Preserve the exact same-lineage wait until the matching approval returns, or
  until app-ops refreshes the same lineage with sharper evidence at fallback.

Workflow lesson:

- A blocked task can be correct even when it is frustrating. The key is whether
  it names the exact wait and a watcher/fallback. The app should not multiply
  approval requests just because the branch remains blocked.

## Case: Dirty Checkpoint Reconciliation Is Active Resolution, Not A Blocker

Task:

- `ops/reconcile-repo-dirty-checkpoint-slices-20260713c`

Observed facts:

- The planner replaced an overdue repo checkpointability review window with this
  active app-ops task.
- Its goal is to inspect dirty groups in `/app/projects/aks-rp-e2e`, separate
  net-integration compact/spec changes from rp-cluster-lifecycle/spec-model/
  runner changes, and either prove one coherent checkpointable slice or refresh
  one exact mixed blocker.

Diagnosis:

- This is current active process-recovery work. It should not be counted as a
  dead blocked branch.

Suggested app action:

- Let the active worker finish. If it produces a coherent checkpoint slice,
  review and apply that result. If it proves the repo is still mixed, keep one
  exact blocker that names the remaining slices instead of leaving broad dirty
  state as ambient project debt.

Workflow lesson:

- When a review window expires, the useful next move is a concrete active owner
  task with evidence output, not another passive future-window holder.

## Case: Checkpointability Review Must Turn Evidence Into The Next Frontier

Tasks:

- `ops/reconcile-repo-dirty-checkpoint-slices-20260713c`
- `ops/reconcile-mixed-runner-knowledge-map-projection-bundle-20260713`
- `domain/resolve-mixed-knowledge-map-projection-checkpoint-frontier-20260713`

Observed facts:

- The dirty-checkpoint review first reduced generic dirty-repo ambiguity to one
  mixed runner/knowledge-map projection bundle.
- The follow-up projection-bundle task then identified one coherent
  checkpointable slice: net-integration compact authority, including
  `runner/feature-compact.ts`, net-integration compact outputs, and five
  net-integration specs.
- The same evidence narrowed the residual blocker to generated
  `model/knowledge-map/*` projections that co-mingle RP lifecycle, CCP
  MarinerV2 alias-rehome, and LocalDNS multipool alias-rehome lineages.
- The reviewer accepted that result, and the planner converted it into active
  work:
  `domain/resolve-mixed-knowledge-map-projection-checkpoint-frontier-20260713`.

Diagnosis:

- This is the intended process shape. A broad project concern became exact
  evidence, then exact evidence became a concrete next active domain task.

Suggested app action:

- Keep driving the new active domain task. Its output should decide whether the
  mixed model projection can checkpoint as one combined slice or must wait for a
  smaller prerequisite slice/owner decision.

Workflow lesson:

- Evidence-only checkpoint reviews are useful only if the reviewer/planner turns
  them into the next live frontier. The successful shape is:
  dirty group review -> accepted evidence -> exact successor task -> active
  owner work.

## Case: Review Handoff Can Lag But Should Close Through The Canonical Path

Task:

- `ops/reconcile-mixed-runner-knowledge-map-projection-bundle-20260713`

Observed facts:

- The worker completed at 2026-07-13T06:44Z and moved the task to review.
- Re-emitting `project.task.completed` woke the task reviewer, which produced an
  `accept` decision at 2026-07-13T06:45Z/06:46Z.
- Planner application lagged briefly, then the journal showed the normal close:
  task marked done at 2026-07-13T06:47Z, successor task created, successor
  assigned, and successor worker started at 2026-07-13T06:48Z.

Diagnosis:

- The right response to a review-pending task with a valid worker claim is not a
  direct task-tree edit. The correct recovery is to keep using the canonical
  completion/review/planner path and verify the journal closes the loop.

Suggested app action:

- If review-pending lasts beyond the watchdog window, re-emit the completion
  fact or trigger the review-pending watchdog. Do not mark done directly unless
  the planner applies an accepted review.

Workflow lesson:

- "Accepted by reviewer" and "closed in task tree" are different states. Always
  verify the journal has the planner-side `task_marked_done` and any successor
  assignment before calling the branch unstuck.

## Case: Actionable Warning Can Be Stale After Shared-Holder Normalization

Task:

- `domain-diagnose-rp-operation-status-polling-run-171938111-claim-failures`

Observed facts:

- `bun run task-tree packet` still reports this task in
  `blocked_action_warnings` as `environment-overblock`.
- The live task itself is already normalized behind
  `ops/wait-shared-worker-model-auth-capability-return-20260713`, which carries
  exact approval/send proof for the shared worker-model token-expired 401
  outage.
- The dependent task's next check is earlier than the shared holder's 12:00Z
  next check, but overdue metrics report zero because the shared outage is
  represented.

Diagnosis:

- The warning is partly stale or over-broad. It is useful as a reminder that the
  branch depends on environment/tooling recovery, but it should not imply a new
  per-branch diagnosis/setup task while the shared auth holder is the live
  recovery carrier.

Suggested app action:

- App-ops should either suppress/normalize this warning while the branch points
  at the exact shared holder, or refresh the dependent task's blocker so
  `waiting_for` explicitly references the shared auth-capability wait and aligns
  its next check with the shared holder.

Workflow lesson:

- `blocked_action_warnings` should not keep flagging a dependent branch after
  the branch has been deduplicated behind one exact shared recovery holder,
  unless the warning message names that shared holder as the action.

## Case: Sampled Compact Holders Are Healthy Exact Waits

Tasks:

- `hold-compact-workload-autoscaler-package-partial-frontier`
- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-app-monitoring-westus2-managed-cluster-capacity-frontier-20260710`
- `hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b`
- `hold-compact-ccp-agent-reviewed-exception-frontier`

Observed facts:

- Workload-autoscaler is held by an exact two-member split frontier: VPA
  cert-renewal evidence ceiling and KEDA upgrade HTTP 400 runtime frontier.
- AAD/RBAC is held by a residual reviewed-exception trio with three named
  downstream holders.
- App-monitoring is a projection of the shared westus2 managed-cluster capacity
  family, not an independent compact rerun candidate.
- Bootstrap-profile is held on ADO run `171800822` and the exact
  `create-cache-acr0` timeout/runtime frontier.
- CCP-agent is held by one exact downstream owner-decision wait for the
  tunnelfront konnectivity migration lineage.

Diagnosis:

- These are not evidence of project abandonment. They are compact projections of
  narrower waits with owners, next checks, fallback actions, and "do not rerun
  unchanged" instructions.

Suggested app action:

- Keep them as blocked wait holders until the named downstream condition
  changes. Review at their scheduled windows, but do not broad-rerun their
  compact features from the compact holder alone.

Workflow lesson:

- For compact loops, the right unit of action is usually the named downstream
  holder, not the feature-level compact holder. Healthy compact blockers should
  explain exactly which lower-level surfaces must change first.

## Case: Watched App-Ops External Waits Should Not Look Actionable Again

Task:

- `domain-diagnose-rp-operation-status-polling-run-171938111-claim-failures`

Observed facts:

- The branch is blocked behind the shared worker-model auth-capability holder.
- That holder has a future review window, exact approval/send lineage,
  observer, observation method, and fallback.
- A stale `environment-overblock` warning kept suggesting the dependent branch
  still needed a new per-branch environment repair.

Diagnosis:

- The dependent branch is not abandoned and should not be reworked in parallel
  while the shared holder is the truthful owner. The warning was too broad for
  an already watched app-ops external wait.

Suggested app action:

- Suppress the actionable warning when an app-ops external wait has owner,
  future gate, observer, observation method, and fallback. If the shared holder
  expires, review the holder family rather than creating branch-local duplicate
  repair tasks.

Workflow lesson:

- Warnings should point to the live owner of the problem. Once branches are
  deduplicated behind a shared exact wait, the app should watch the shared wait
  and avoid re-opening each dependent branch.

## Case: Compact Loop Backend Wording Drift

Task:

- `aks-feature-compact-loop`

Observed facts:

- The task context already points at ADO pipeline `ado-pipeline-467665`.
- The task goal and acceptance text still said GitHub plan-execute workflow.
- The loop had no runnable compact work, but stale wording could mislead a
  future agent into looking for GitHub workflow evidence instead of ADO runs.

Diagnosis:

- This is process text drift from the GitHub-to-ADO migration. It is not proof
  that the compact loop should rerun; it is a task-contract maintenance issue.

Suggested app action:

- Keep task goals and acceptance criteria aligned with the actual execution
  backend. Legacy internal metric field names can be cleaned separately, but the
  user-visible task contract should say ADO.

Workflow lesson:

- When infrastructure migrates, the app should refresh durable loop contracts,
  not only code paths. Otherwise a valid blocked loop can send future reviewers
  toward stale evidence.

## Case: Project Approval Wait Is Healthy When The Lineage Is Exact

Tasks:

- `focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711`
- `ops/review-0040-project-approval-owner-return-primary-blocker-lineage-20260714b`
- `ops/repair-project-approval-escalation-closure-hygiene-20260713`

Observed facts:

- The focus branch is blocked on a specific `project.approval.submitted`
  lineage with request event `3069971`, message `3069974`, original message
  `3065844`, pathId `focus-review-off_track-approval-refresh-20260712`,
  explicit approvalId/waitId, accepted decisions, observer, next check, and
  fallback.
- The scheduled app-ops review leaf
  `ops/review-0040-project-approval-owner-return-primary-blocker-lineage-20260714b`
  is future-windowed for `2026-07-14T00:40:00Z` and explicitly says not to start
  early or send duplicate approval asks.
- The currently active app-ops task
  `ops/repair-project-approval-escalation-closure-hygiene-20260713` is already
  auditing this approval/escalation closure family after evaluation feedback.
- That app-ops task completed, the reviewer accepted it, and the planner rolled
  it up. Its evidence is
  `evidence/archive/ops-repair-project-approval-escalation-closure-hygiene-20260713.md`.

Diagnosis:

- This is a healthy blocked wait, not hidden runnable work. The app has a
  single same-lineage approval wait, a scheduled review window, and one active
  hygiene audit. Creating another approval request or duplicate repair task now
  would make the lineage harder to reason about.

Suggested app action:

- Let the active hygiene task finish. If it finds a closure/accounting gap, the
  reviewer/planner should apply one minimal repair. If it finds no gap, preserve
  the current exact approval wait and scheduled review leaf.
- After the accepted no-op audit, do not create another closure-hygiene sibling
  for the same family unless new evidence appears. Wait for the named approval
  return or the scheduled review window.

Workflow lesson:

- Human approval waits should be judged by lineage quality, not by age alone.
  Exact request/message/approval IDs plus a future review window are a better
  signal than broad "project not moving" pressure.
- A good ops audit can close as evidence-backed no-op. That is still progress:
  it prevents duplicate work and confirms the current blocked holder is the
  right owner.

## Case: GitHub-Named Auth Wait Can Still Be Valid After ADO Migration

Task:

- `wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704`

Observed facts:

- The task name and goal mention GitHub Actions auth-preflight 401, but the
  blocker is not waiting for a current GitHub workflow to execute the live plan.
- The wait carries an exact approval packet lineage for
  `shared-authenticated-artifact-result-recovery-family-20260712`, with
  approvalId/waitId and packet
  `evidence/archive/ops-escalate-shared-auth-runtime-and-github-artifact-owner-return-family-20260712.md`.
- Its scope is historical/source/artifact access and auth-capability recovery
  for defender-profile plus repaired Windows rerun candidates; it explicitly
  excludes compact defender-profile and unrelated OIDC/workload-identity
  surfaces that have sharper separate frontiers.

Diagnosis:

- This is not the same as stale "run the old GitHub workflow" wording. After the
  ADO migration, GitHub references can still be valid when the blocked surface
  is historical artifact/source access or owner-approved recovery evidence.

Suggested app action:

- Keep this holder until its `2026-07-13T20:40:00Z` review/fallback window or
  until a same-lineage approval/recovery signal lands. Do not mechanically
  rewrite it to ADO unless a real ADO successor run/evidence source exists for
  the same truth.

Workflow lesson:

- Backend migration reviews must distinguish execution backend waits from
  evidence-access waits. The app should update stale task wording when it points
  to the wrong executor, but should preserve GitHub-named waits when GitHub is
  the actual artifact/source surface being recovered.

## Case: Stale Assignment Recovery Must Prove Worker Start

Task:

- `ops/reconcile-spec-loop-runners-feature-set-contract-20260713`

Observed facts:

- The task was created to reconcile a real contract mismatch: the live
  `aks-spec-verification-loop` context says `priorityFeatureSet=runners`, but
  its inputs still included
  `../aks-rp-e2e/.github/workflows/feature-sets/dev-infra-core.txt`.
- The first assignment row was not consumed by a worker. The health signal
  `aks-rp-e2e.process.assignment.not-consumed-count` returned `1`.
- The planner later requeued the orphan-stale active task, confirmed it
  runnable, reassigned it to `app-ops`, and the task tree recorded
  `task_worker_started` for the fresh attempt at `2026-07-13T07:06:35Z`.
- After the repair, `task-tree assignments` returned an empty queue and
  `assignment.not-consumed-count` returned `0`.

Diagnosis:

- A cleared assignment queue alone is not enough proof. The durable evidence of
  recovery is the combination of no queued assignment, active task trace updated
  to the fresh attempt, and `task_worker_started` for that same attempt.

Suggested app action:

- Keep the task active until the worker writes its evidence memo and completion
  claim. If the same task becomes stale-active again, the watchdog/planner
  should revalidate whether the session still exists before requeueing or
  creating a duplicate repair task.

Workflow lesson:

- For dispatch issues, measure the whole handoff: assignment queued, assignment
  consumed, worker started, and completion/review. Counting only queued rows can
  miss an active-without-progress case; counting only active tasks can miss a
  stuck assignment row.

## Case: Focus Off-Track Can Still Produce Bounded No-Live Work

Task:

- `domain/reconcile-rp-lifecycle-no-live-maturation-slice-20260713`

Observed facts:

- The planner woke from a focus-plan review whose result was `off_track`, but
  the attached facts said the focus itself was still directionally correct and
  blocked by owner-return/shared-auth lineages.
- The planner preserved the existing approval/owner-return blockers and created
  one bounded no-live domain task instead of changing the project direction or
  sending duplicate approval asks.
- The new task explicitly forbids live execution and asks the worker to advance
  one repo-local RP lifecycle slice or record the exact remaining dependency.

Diagnosis:

- `off_track` is not automatically a strategy pivot. It can mean the current
  strategy is externally blocked and needs a smaller safe work item inside the
  existing approved focus.

Suggested app action:

- Let the bounded no-live task finish and require a concrete evidence note. If
  it cannot advance repo-local artifacts, the result should sharpen the exact
  wait rather than broaden into another generic lifecycle audit.

Workflow lesson:

- Focus-plan handling should separate "wrong direction" from "right direction
  but blocked." The app can keep moving by creating narrow repo-local work that
  respects the current blockers.

## Case: Dependent Waits Need Structured Shared-Holder Lineage

Task:

- `domain-diagnose-rp-operation-status-polling-run-171938111-claim-failures`

Observed facts:

- The task was correctly normalized behind the shared worker/model auth outage
  holder `ops/wait-shared-worker-model-auth-capability-return-20260713`.
- The blocker prose named the shared holder, the 12:00Z family review, and the
  rule not to spawn duplicate per-branch auth repair.
- The structured `waiting_for` field still used the generic helper default:
  `type=frontier.changed`, `taskId=domain-diagnose-rp-operation-status-polling-run-171938111-claim-failures`.
- That meant humans could understand the wait, but watchdog/planner code saw a
  self-referential wait instead of the exact shared approval lineage.
- The blocker was repaired through `task-tree update-text --blocker-json` so
  `waiting_for` now points to the shared approval lineage:
  `type=project.approval.submitted`,
  `taskId=ops/wait-shared-worker-model-auth-capability-return-20260713`,
  `pathId=shared-worker-model-auth-capability-outage-20260713`, plus the
  approval id, wait id, request event id, and message id.
- After the repair, blocked-contract integrity metrics remained clean:
  missing waiting-for count `0`, missing owner count `0`, and missing fallback
  count `0`.

Diagnosis:

- The previous state was not a domain blocker problem; it was a process-shape
  weakness. `refresh-blocked-wait` is useful for quick normalization, but its
  default `frontier.changed` wait can be too generic for dependent waits that
  already have an exact shared holder.

Suggested app action:

- Keep the task blocked behind the shared auth holder until the exact approval
  return or reviewed auth recovery lands. Do not rerun the spec branch while the
  shared holder remains the active recovery carrier.
- When creating dependent blocked leaves, prefer carrying the shared holder's
  structured lineage into `waiting_for` rather than only mentioning it in prose.

Workflow lesson:

- "Agent decides, code collects info" still requires structured facts. The
  agent can decide that a branch waits on a shared holder, but the task tree
  must store that holder lineage in machine-readable fields so watchdog,
  planner, UI, and metrics all see the same process truth.

## Case: Accepted Reviews Can Still Carry Required Next Work

Tasks:

- `ops/classify-unpublished-repo-change-breach-20260713`
- `ops/apply-classify-unpublished-repo-change-breach-20260713-state-repair`

Observed facts:

- The unpublished-change classifier worker completed and the reviewer accepted
  it with high confidence.
- The same accepted review also returned a structured `reviewAction`:
  `actionKind=app-state-repair`, with the goal to create a bounded
  publish-state reconciliation successor for the ahead-1/behind-1 branch
  divergence.
- The planner originally marked the accepted review done but did not create the
  successor, leaving the agent's structured next action as archived review
  metadata instead of live work.
- The planner was updated so accepted reviews with structured project actions
  create runnable successors before closing the reviewed task. The regression
  test `turns accepted reviews with structured app-state repair actions into
runnable app-ops work` now passes in `workflows/project-planner.test.ts`.
- Because the original review task had already been archived, the missed
  successor was backfilled through the supported task-tree command as
  `ops/apply-classify-unpublished-repo-change-breach-20260713-state-repair`.
- The backfilled task was assigned to `app-ops`, the assignment queue cleared,
  and the journal recorded `task_worker_started` for the same attempt at
  `2026-07-13T07:21:36Z`.

Diagnosis:

- This was not a domain ambiguity. The reviewer agent had already decided the
  next process move. The code failed to route that structured decision when the
  decision was `accept`.

Suggested app action:

- Let the active app-ops publication-reconciliation task finish and review its
  evidence. It should reconcile or precisely block the branch publication state
  before any mixed checkpoint or cleanup is attempted.

Workflow lesson:

- `accept` means the reviewed task's own acceptance was satisfied; it does not
  mean there is no next work. If the reviewer attaches a structured
  `reviewAction`, planner code should route that action into live work and avoid
  inferring a different next step from prose.

## Case: Compact Holder Cites Archived Downstream Holder

Tasks:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`
- `domain/aad-rbac-run-command-access-carrier-split-mounted-source-review-20260712`
- `ops/reconcile-aad-rbac-compact-stale-run-command-holder-lineage-20260713`

Observed facts:

- The live compact holder `hold-compact-aad-rbac-package-partial-frontier`
  still names three downstream blockers, including
  `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`.
- `task-tree show hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`
  no longer finds a live task.
- The run-command-access branch has newer archived review evidence:
  `.state/tasks/archive/done-leaves-20260712001633000.json` shows
  `domain/aad-rbac-run-command-access-carrier-split-mounted-source-review-20260712`
  completed and was accepted.
- `.state/spec-loop/state.json` now represents
  `spec.aad-rbac.run-command-access` as `pending` with
  `catalogStatus=environment`, `catalogSpecState=reviewed-exception`,
  `terminalDisposition=true`, and a resume condition that says not to rerun the
  same unsplit workflow slice unchanged.
- The compact holder's prose is understandable to a human, but it points at a
  task id that the live task tree cannot observe, so the holder is stale as a
  process link.
- A bounded app-ops repair task was created and assigned:
  `ops/reconcile-aad-rbac-compact-stale-run-command-holder-lineage-20260713`.
  Its job is to collect fresh live/archive/spec-loop evidence and either repair
  the holder through supported task-tree commands or create the exact successor
  wait/follow-up if domain judgment is still needed.
- The first worker attempt reached the wrong no-op conclusion because it cited
  checked-in `tasks/tree.json` as if it were the live task tree and claimed the
  missing holder still existed.
- `task-reviewer` rejected that attempt at `2026-07-13T07:34:07Z` with `redo`:
  live `bun run task-tree show
hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`
  returned not found, while live `hold-compact-aad-rbac-package-partial-frontier`
  still referenced that missing holder.
- `project-planner` applied the redo at `2026-07-13T07:34:11Z` and assigned a
  fresh retry attempt
  `a_ops_reconcile-aad-rbac-compact-stale-run-command-holder-lineage-20260713_20260713073411`
  to `app-ops`.
- The retry produced a better audit and stopped claiming no-op closure, but it
  still did not apply the required repair or create a successor. Reviewer
  returned `followup` at `2026-07-13T07:38:21Z`.
- Planner applied that follow-up and created active app-state repair work:
  `ops-apply-reconcile-aad-rbac-compact-stale-run-command-holder-lineage-20`.
  Health at `2026-07-13T07:38:39Z` showed that repair as the only active
  frontier item.
- The app-state repair was accepted at `2026-07-13T07:42:20Z` because it fixed
  controller-visible compact loop state: aad-rbac no longer carries the missing
  run-command holder in `frontierTaskIds`, and the repair memo/evidence paths now
  point at the current reviewed-exception/domain source of truth.
- The reviewer also recorded an important caveat: stale holder text still
  appears in the live task-tree holder goal/blocker and copied compact
  `blockedReason` prose. That means the machine-facing compact state improved,
  but the human/process-facing edge can still mislead the next worker.
- A follow-up app-ops task was therefore created and assigned:
  `ops/reconcile-aad-rbac-visible-holder-text-parity-20260713`. Its scope is
  limited to visible task-tree text parity for
  `hold-compact-aad-rbac-package-partial-frontier`; it must not broad-rerun
  aad-rbac or change compact execution state unless a current blocker condition
  changed.
- Direct `task-tree assign` created a queued assignment row but did not by
  itself wake a worker. Re-emitting the canonical `project.task.assigned` event
  through May caused `task-worker` to consume the assignment, start
  `s_task_ops_reconcile-aad-rbac-visible-holder-text-parity-20260713`, and drain
  the queue. This is a process distinction: task-tree mutation records state;
  event emission is what wakes work.
- The visible-holder repair completed and reviewer accepted it at
  `2026-07-13T07:48:13Z`: live `hold-compact-aad-rbac-package-partial-frontier`
  text no longer cites the missing holder id and preserves only the two live
  downstream waits plus current run-command reviewed-exception/domain evidence.
- Planner applied that accepted review at `2026-07-13T07:49:07Z` and created a
  separate active follow-up,
  `ops/verify-residual-missing-wait-target-breach-20260713`, because the
  available missing-wait-target metric sample was stale pre-repair. That
  follow-up was assigned and consumed normally by `app-ops`.
- The residual verifier completed and was accepted at `2026-07-13T07:50:58Z`.
  Its fresh metric recompute for
  `aks-rp-e2e.process.blocked.missing-waiting-for-count` returned `0`, a direct
  runtime blocked-leaf audit found zero offenders, and
  `hold-compact-aad-rbac-package-partial-frontier` now carries structured
  `blocker.waiting_for` metadata. Planner applied the accept at
  `2026-07-13T07:51:03Z`.

Diagnosis:

- This is not evidence that AAD-RBAC should be rerun. The domain evidence still
  says the unchanged run-command-access slice should not be broad-rerun.
- The defect is lineage freshness: a compact projection remained blocked on a
  named downstream holder after that holder left the live tree.
- There are two separate freshness surfaces:
  controller-visible runtime state and human-visible task-tree blocker text.
  Fixing only the runtime state is not enough when the live task tree still
  advertises a missing holder as the wait target.
- There is also a separate closure surface: after the text repair is accepted,
  metric clearance still needs fresh evidence. A stale pre-repair metric sample
  must not be used to prove that the current process shape is healthy.
- The final closure proof came from two current reads, not from the worker's
  summary alone: the project metric source command returned `0`, and the direct
  blocked-leaf audit over `.state/tasks/tree.json` found no blocked leaves
  missing structured `waiting_for`.
- The first app-ops attempt exposed a second process defect: stale checked-in
  task snapshots can still mislead workers even after the runtime-state
  separation design is documented. Reviewer enforcement is currently catching
  this, but worker prompts and evidence habits still need pressure toward live
  task-tree helpers.

Suggested app action:

- Let the app-ops repair complete, then require reviewer evidence that no live
  blocked task still depends on the missing holder id unless the repair
  intentionally recreates a live replacement holder.
- When a repair is accepted with a caveat that visible task-tree text remains
  stale, create a follow-up instead of leaving the caveat buried in reviewer
  prose. Humans and future workers read the holder text first; stale prose is an
  operational defect even if the controller state is cleaner.
- When a follow-up is created manually with task-tree commands, make sure the
  corresponding app event is emitted or the assignment can sit queued without a
  worker. Planner-created follow-ups are better because the planner emits the
  assignment event as part of the normal app flow.
- Future compact-loop pulses should treat missing downstream holder ids as a
  repair signal. The controller should create a reconciliation task or refresh
  the compact projection instead of leaving a missing id embedded in the live
  blocker.
- For retries after a stale-state redo, require the worker evidence to quote the
  supported live commands and the exact live fields it relied on. A memo that
  only says "inspected task tree" is not enough when stale checked-in snapshots
  also exist.
- A diagnosis task that only recommends `planner/app-ops should add a repair`
  should not be accepted when its own acceptance requires applying the repair or
  creating the successor. Reviewer should return `followup`, and planner should
  materialize the bounded repair task.

Workflow lesson:

- A compact holder is only useful if it points to current narrower truth. When
  the downstream holder is archived, replaced, or reduced into spec-loop state,
  the compact projection must refresh its machine-readable and human-readable
  lineage. Otherwise the project appears truthfully blocked while the process
  graph has lost the edge it is waiting on.
- The current app process worked after reviewer intervention: bad worker
  conclusion -> reviewer redo -> planner retry. The next improvement is to stop
  workers from making the stale snapshot mistake in the first place, not to
  bypass review.
- The improved process also worked on the second pass: useful audit ->
  reviewer follow-up -> planner-created active repair. That is the right
  pattern for blocked tasks where the domain truth is known but app-owned
  lineage metadata still needs mutation.
- The third lesson is sharper: review acceptance should not end the case when it
  explicitly names a remaining stale visible edge. Either the original
  acceptance must require both runtime-state and task-tree text parity, or the
  planner/app-ops path must immediately create a narrow visible-text repair.
- The fourth lesson is about closure: reviewer acceptance can close the repair
  but still create the next verification task when health evidence is stale.
  That keeps the project moving without pretending the metric has recovered.
- The complete successful pattern for this case was:
  stale blocked edge found -> bad no-op rejected -> fresh audit creates
  follow-up -> loop-state repair accepted with caveat -> visible holder repair
  accepted -> fresh metric verification accepted. Each step had one owner and
  one bounded next action.

## Case: No-Publish Checkpoint Review Is Still Progress

Task:

- `ops/reconcile-unpublished-repo-dirty-checkpoint-slice-20260713`

Observed facts:

- The unpublished-change metric remained high after branch reconciliation:
  `/app/projects/aks-rp-e2e` was `dev...origin/dev [ahead 1]` with 23 staged
  tracked modifications.
- The app created and assigned a bounded app-ops task to classify whether any
  coherent done-owned checkpoint slice existed.
- The worker ran the app-root checkpoint helper:
  `bun run --silent domain:checkpoint -- --json`.
- The helper returned `recommendation=hold` for all touched slices:
  `feature:net-integration`, `feature:rp-cluster-lifecycle`, `model`, and
  `runner`.
- The worker also ran the relevant domain check, `bun run check`, which failed
  because tracked runtime/generated evidence files are present.
- The reviewer accepted the worker result because it mapped every staged file to
  current ownership and produced a concrete no-publish verdict instead of
  pretending the dirty tree was checkpointable.

Diagnosis:

- This is a successful ops result even though it did not reduce the metric. The
  task proved the current staged set is mixed unfinished work, not a coherent
  done-owned publication slice.

Suggested app action:

- Do not commit the current staged set unchanged.
- Treat the next owner move as branch-publication reconciliation first, then
  split feature-local residue from shared `model/knowledge-map/*` and
  `runner/feature-compact.ts` carriers before trying another checkpoint.
- Keep the unpublished-change metric active as a pressure signal, but route it
  to slice separation rather than bulk commit/cleanup.

Workflow lesson:

- A metric can push the app to investigate, but it must not force the wrong
  outcome. For publication metrics, the app should prove slice ownership and
  repo checks before creating a commit. A reviewed "no publish" result is useful
  when it names the exact ownership split needed next.

## Case: Review Decision Needed Event Re-Emission To Materialize Repair

Task:

- `ops/review-aad-rbac-compact-environment-overblock-warning-20260713`

Observed facts:

- The worker completed at `2026-07-13T07:56:29Z` and moved the task to review.
- The evidence memo concluded the AAD-RBAC compact holder was already a
  truthful mixed residual frontier, not a real broad environment-overblock
  family.
- The task reviewer judged the claim as `followup` at `2026-07-13T07:57:37Z`.
  The reviewer accepted the diagnosis but found the required app-owned
  projection repair had not been applied.
- The task tree still showed the task in `review` until the canonical
  `project.task.reviewed` event was re-emitted with the reviewer decision.
- After the event was re-emitted, planner closed the review task and created
  the exact active repair task:
  `ops/repair-aad-rbac-compact-projection-parity-20260713`.

Diagnosis:

- This was not a domain blocker. It was process handoff friction: the reviewer
  had made the right decision, but planner had not applied it yet.
- The correct recovery was not a task-tree JSON edit and not a manual direct
  repair. The correct recovery was to replay the canonical reviewed event so
  planner could apply the already-made agent judgment.
- The reviewer did the right thing by returning `followup`: diagnosis-only work
  should not be accepted as final when acceptance requires an actual projection
  repair.

Suggested app action:

- Add an observability/checkpoint signal for `review` tasks whose latest
  reviewer run has a decision but whose task still remains in `review` after a
  short grace period.
- The watchdog recovery should re-emit `project.task.reviewed` from the latest
  structured reviewer row, then let planner apply it. It should not invent a
  new decision in code.
- Keep the planned repair bounded: update only the AAD-RBAC compact projection
  state so `frontierTaskIds` contains the two exact live downstream waits, while
  keeping `spec.aad-rbac.run-command-access` represented by reviewed-exception
  evidence.

Workflow lesson:

- Agent decides; code carries the decision. If the agent decision is already in
  `task-reviewer-runs.jsonl` but planner has not applied it, the system should
  replay the event bridge rather than recompute or override the decision.
- A `followup` review is healthy when it creates one bounded repair task. It is
  unhealthy only when it stays as a passive review record and no planner action
  follows.

## Case: Archived Lineage Proof Still Needs Current State Verification

Tasks:

- `ops/reconcile-missing-aad-rbac-compact-review-lineage-20260713`
- successor:
  `ops-apply-reconcile-missing-aad-rbac-compact-review-lineage-20260713-sta`

Observed facts:

- The app created a concrete app-ops task after planner saw an AAD-RBAC compact
  review lineage anomaly.
- The worker correctly proved that
  `ops/repair-aad-rbac-compact-projection-parity-20260713` was a real task and
  was removed from the live tree by normal done-leaf compaction into
  `.state/tasks/archive/done-leaves-20260713080822523.json`.
- The worker also found the archived repair memo and the live holder text for
  `hold-compact-aad-rbac-package-partial-frontier`.
- The reviewer returned `followup`, not `accept`, because current
  `.state/feature-compact-loop/state.json` still had only one
  `aad-rbac.frontierTaskIds` entry:
  `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`.
  It was missing
  `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`.
- Planner accepted the reviewer judgment and created one narrow successor repair
  task instead of reopening broad AAD-RBAC compact work.

Diagnosis:

- The lineage question had two parts:
  1. whether the missing repair task was real or archived; and
  2. whether the current controller-visible compact state still matched the
     accepted repaired meaning.
- The worker answered the first part well, but overclaimed the second part.
- The reviewer did the right thing by preserving the useful archive finding
  while requiring a narrow state-parity repair for the current loop state.

Suggested app action:

- Keep the successor repair bounded to app-owned AAD-RBAC compact state:
  restore `frontierTaskIds` to exactly the two downstream waits and keep
  `spec.aad-rbac.run-command-access` represented by reviewed-exception/domain
  evidence only.
- Do not reopen broad AAD-RBAC compact planning or rerun the compact package for
  this process issue.
- For similar lineage-reconciliation tasks, require the worker evidence to
  include a current readback of every controller-visible state field it claims is
  already correct.

Workflow lesson:

- Proving a task was archived is not the same as proving the current system state
  is correct.
- A no-op recommendation must be grounded in current live readback of the exact
  mutable state, not only archived evidence, holder prose, or previous reviewer
  summaries.
- `followup` is the right outcome when the worker finds useful history but a
  current state mismatch remains. The follow-up should be one bounded repair,
  not a broad retry.

## Case: Restored Fleet Holders Still Need Compact Projection Parity

Tasks:

- `hold-compact-fleet-reviewed-exception-split-frontier-20260709`
- `hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708`
- `hold-spec-fleet-vm-prerelease-rpapi-auto-upgrade-matrix-lineage-only-frontier-20260707`
- `hold-spec-loop-pending-fleet-vm-prerelease-umbrella-nonlive-20260705b`

Observed facts:

- Fleet compact state referenced downstream wait ids in its blocked reason, but
  one referenced reviewed-exception holder and one spec-loop bridge were missing
  from the live task tree.
- A normal planner wake did not fully repair the issue; a focused
  human-steering wake with the exact missing ids let the planner restore both
  holder tasks through the normal task-tree mechanism.
- After the repair, both missing tasks exist again and the spec-loop record for
  `spec.fleet.vm-prerelease-rpapi-auto-upgrade-matrix` points at an existing
  nonlive bridge.
- The compact-loop record for `fleet` still has `frontierTaskIds: []` while its
  blocked reason names the two downstream waits. That means the task tree was
  repaired, but the controller-visible compact projection is still not fully
  aligned.

Diagnosis:

- A blocked compact holder can look valid at the task-tree level while its
  machine-readable compact-loop projection is stale or incomplete.
- Restoring missing holder tasks fixes visibility, but it does not prove the
  loop controller will see the same frontier shape on the next pulse.

Suggested app action:

- Create or route one bounded app-ops repair for Fleet compact projection parity.
  It should make the compact-loop state explicitly represent the same exact
  downstream waits named by the holder, or explain why Fleet intentionally has
  an empty `frontierTaskIds` list.
- Do not reopen a broad Fleet compact rerun just to fix this projection issue.

Workflow lesson:

- Every lineage repair needs two readbacks before acceptance: task-tree
  visibility and loop-state projection parity.
- Holder prose is not enough. The workflow must check the structured fields that
  controllers actually consume.

## Case: Metric Family Re-scope Must Match Worker Evidence

Tasks:

- `ops/repair-blocked-missing-owner-metric-and-fleet-warning-20260713`
- successor:
  `ops/investigate-blocked-missing-owner-metric-staleness-20260713`

Observed facts:

- Planner first created a repair task around a blocked missing-owner metric plus
  Fleet warning integrity.
- A later metric wake re-scoped the live task text toward
  `aks-rp-e2e.process.blocked.missing-fallback-count`, but the task id and much
  of the worker evidence still focused on
  `aks-rp-e2e.process.blocked.missing-owner-count`.
- The worker produced useful evidence: the Fleet holder was the sampled offender,
  the holder had since been repaired, and fresh missing-owner recompute returned
  zero offenders.
- The reviewer returned `redo` because the final acceptance text required
  missing-fallback evidence, including `fallback_at` / `fallback_action`
  validation. That evidence was not in the worker memo.
- Planner then removed the stale repair leaf and created the narrower successor
  `ops/investigate-blocked-missing-owner-metric-staleness-20260713`.

Diagnosis:

- The work was not wrong, but it answered the metric family named by the original
  task, not the metric family named by the final acceptance criteria.
- Re-scoping an active task can silently invalidate the worker's evidence shape
  unless the worker re-reads the current task before completing.

Suggested app action:

- When planner changes the goal or acceptance for an active task, the worker
  must treat the current live task text as authoritative before submitting a
  completion claim.
- Reviewer should keep rejecting completion claims whose evidence proves the
  wrong metric family, even if the evidence is otherwise useful.
- The follow-up should stay narrow: investigate stale metric row/snapshot
  behavior for the named metric, not reopen Fleet domain work.

Workflow lesson:

- Task id, trigger metric, goal, and acceptance must agree before the worker
  claims done.
- A useful diagnosis is not enough if it proves the wrong current acceptance
  criterion.
- The reviewer is the safety net for this class of drift; planner should convert
  useful-but-misaligned evidence into one bounded successor, not broad redo work.

## Case: Metric Rows Lag Behind Live Task Repair

Task:

- `ops/investigate-blocked-missing-owner-metric-staleness-20260713`

Observed facts:

- The prior Fleet holder breach was real when sampled:
  `hold-compact-fleet-reviewed-exception-split-frontier-20260709` lacked the
  relevant blocked-contract field at the sampled time.
- The live task tree was repaired before the persisted metric row recovered.
- A fresh metric recompute against live state returned zero offenders.
- The next scheduled `metrics-snapshot` run later updated the persisted row and
  recovered the alert.
- The app worker documented the behavior in `design/project-observability.md`.

Diagnosis:

- The stale point is the periodic metric snapshot boundary, not the live
  blocked-leaf scan. `metrics.current`, `metric_snapshots`, and open alerts can
  truthfully lag behind a just-repaired task until the next snapshot cycle.

Suggested app action:

- During metric triage, first read the sampled offender from the DB, then
  immediately rerun the metric `source_command` or equivalent live-state check.
- If the live recompute is clean, treat the alert as snapshot-lag evidence and
  wait for the next snapshot/recovered event unless the same offender repeats.
- Only create repair work when the live recompute still names an offender, or
  when repeated lag creates enough operational noise to justify platform-level
  event-driven resampling.

Workflow lesson:

- Metrics are strong signals, but persisted metric rows are not always the
  freshest source of truth. For blocked-task hygiene metrics, live task-tree
  recompute decides whether repair is still needed now.

## Case: Stale Warning Dispatch After Blocked-Contract Repair

Tasks:

- `ops/diagnose-missing-observer-metric-offender-20260713`
- `ops/investigate-fleet-environment-overblock-warning-false-positive-20260713`

Observed facts:

- Persisted missing-observer and blocked-actionable signals both pointed back to
  `hold-compact-fleet-reviewed-exception-split-frontier-20260709`.
- Fresh live recomputes returned zero offenders and no Fleet
  `environment-overblock` warning.
- The Fleet compact holder now has the required observer metadata, exact
  waiting contract, restored downstream reviewed-exception lineage, and a
  `compact.frontier.changed` wait shape that the warning logic intentionally
  suppresses.
- Reviewer accepted both investigations. Planner closed and archived both tasks
  without reopening broad Fleet reruns.

Diagnosis:

- The warnings were real enough at dispatch time, but by review time the
  blocked-contract repair had already made the live tree healthy. The remaining
  issue was stale dispatch timing, not a current Fleet holder defect.

Suggested app action:

- For warning/metric repair tasks, always reproduce the warning from a fresh
  packet or metric recompute before changing task-tree shape.
- If a warning no longer reproduces and the named holder has the exact wait
  contract, close the task as stale-premise/no-op evidence.
- Reopen warning logic only if a fresh packet still emits the same warning for a
  holder that has the expected exact wait shape.

Workflow lesson:

- A task can be valid when created and stale by the time the worker inspects it.
  The workflow should preserve the evidence, close the stale premise, and avoid
  inventing new domain work from old warning packets.

## Case: Due Review Windows Must Use The Earliest Watch Time

Tasks:

- `ops/review-1030-compact-app-routing-vm-prerelease-environment-quartet-lineage-20260713`
- successor:
  `ops/review-1030-compact-app-routing-vm-prerelease-environment-quartet-lineage-20260714`

Observed facts:

- The 2026-07-13 app-routing quartet review leaf had
  `resume_at=2026-07-13T10:30:00Z`,
  `next_check_at=2026-07-13T10:30:00Z`, and
  `fallback_at=2026-07-14T10:30:00Z`.
- After 10:30Z, `blocked-actionable-count` and
  `blocked-overdue-unworked-count` were still zero, because the overdue metric
  considered the future fallback before the due resume/next-check window.
- A manual `project.watchdog.check.requested` used the watchdog's better model:
  it looked at the earliest next-check/resume/fallback time, woke the planner,
  and the planner closed the 2026-07-13 review leaf.
- The planner refreshed the exact app-routing quartet wait and created the
  2026-07-14 successor review leaf without reopening broad compact reruns.

Diagnosis:

- The app behavior was recoverable through the watchdog, but the metric model was
  weaker than the watchdog model. A due review window is owner work even when
  the fallback deadline is still in the future.

Suggested app action:

- Treat the earliest valid `next_check_at`, `resume_at`, or `fallback_at` as the
  watch time for blocked-overdue metrics.
- Continue using watchdog/planner for the action: verify the due wait, close or
  refresh it with evidence, and create a future successor only when the same
  exact wait remains true.

Workflow lesson:

- `fallback_at` is the last-resort timeout, not the first time the app should
  look. Metrics, watchdog, and UI should all present the earliest watch time so
  scheduled review leaves do not silently sit past their review window.

## Case: Review Task Labels Can Drift From Structured Watch Time

Task:

- `ops/review-1200-net-integration-compact-authority-frontier-lineage-20260713`

Observed facts:

- The task id and output file name contain `1200`, so it looks like a noon
  review at a glance.
- The structured blocker says the real review window is
  `resume_at=2026-07-13T18:15:00Z` and
  `next_check_at=2026-07-13T18:15:00Z`, with fallback on
  `2026-07-14T12:00:00Z`.
- The goal also says "At the next owner-review window" rather than hard-coding
  noon. The structured blocker is internally consistent and the overdue metric
  correctly reports zero.

Diagnosis:

- This is not an overdue blocked task. It is a human-readability issue: the task
  label is stale or approximate, while the structured blocker carries the real
  schedule.

Suggested app action:

- Treat `blocker.next_check_at` / `resume_at` as authoritative for scheduling,
  metrics, and watchdog action.
- In UI and review summaries, show the structured watch time next to the task id
  so a stale label does not create false urgency.
- When creating future review leaves, prefer ids that match the actual watch
  time, or use neutral ids when the review window may be adjusted.

Workflow lesson:

- Task ids are useful handles, not source of truth. For blocked work, the app
  and human should read the structured blocker first: owner, waiting_for,
  next_check_at/resume_at, fallback, and observer.

## Case: Blocked Frontier Can Refill With Parallel Exact Reconciliations

Tasks:

- `domain/reconcile-localdns-compact-stale-residue-and-frontier-sync-20260713`
- `domain/reconcile-aad-rbac-compact-projection-trio-and-frontier-sync-20260713`
- `ops/reconcile-unpublished-change-count-dirty-tree-attribution-20260713`

Observed facts:

- At 2026-07-13T10:37Z the planner created and assigned the LocalDNS compact
  reconciliation leaf from an all-blocked frontier.
- The LocalDNS worker was genuinely active, not stale bookkeeping:
  `sessions.status=running`, `opCount` advanced from 58 to 68, and
  `lastActivityAt` advanced while the task stayed active.
- The LocalDNS holder prose said the compact frontier should be exactly three
  downstream blockers, but controller-visible feature-compact state still listed
  a fourth `frontierTaskIds` entry:
  `wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703`.
- While LocalDNS was still active, later planner wakes created two more
  independent active leaves: an aad-rbac compact projection reconciliation and
  an app-ops dirty-tree attribution task for a real
  `unpublished-change-count` breach.

Diagnosis:

- A fully blocked frontier is not automatically idle. The owner/planner can
  still create bounded reconciliation leaves when current state shows projection
  drift, dirty unpublished work, or stale controller-visible metadata.
- The app is now using useful parallelism: independent compact projection work
  and app-ops process work can run at the same time without broad reruns or
  direct task-tree edits.

Suggested app action:

- Keep using bounded reconciliation tasks when holder prose, compact-loop state,
  generated artifacts, and spec-loop rows disagree.
- Compare structured controller-visible fields, not only summaries. For compact
  holders, check at least `frontierTaskIds`, blocker prose, current compact
  diagnostics, and spec-loop task ids before accepting a no-op claim.
- Preserve conflict scopes so unrelated compact features and app-ops process
  repairs can run in parallel, while the same feature stays single-owner.

Workflow lesson:

- "Blocked" means no direct live rerun is truthful yet; it does not mean no work
  can happen. The useful work is to reconcile exact projections, prove the same
  wait is still exact, or make dirty/unpublished state attributable.
- The process is healthy when the planner converts all-blocked pressure into a
  few small active investigations instead of one broad retry or passive waiting.

Follow-up at 2026-07-13T10:53Z:

- The first aad-rbac app-state sync claim was review-rejected because the memo
  claimed the row-37 holder was added, but the live compact-loop state still
  omitted it from `features.aad-rbac.frontierTaskIds`.
- The accepted successor
  `ops-apply-reconcile-aad-rbac-compact-projection-trio-and-frontier-sync-2`
  fixed the actual controller-visible state and replaced the rejected attempt.
- LocalDNS progressed from broad mismatch diagnosis to a concrete worker claim:
  keep `spec.localdns.cni-matrix` blocked, normalize the two VM-prerelease specs
  into consumed pass history, and regenerate LocalDNS compact artifacts. This is
  still pending reviewer acceptance.
- Dirty-tree attribution progressed from a recommendation memo to an active
  app-ops repair task that should create concrete publish/revert owner leaves
  for the under-owned dirty groups.

Extra lesson:

- Reviewer readback of live state is not ceremony; it caught a false success
  claim and forced the project to do the real repair.
- Parallelism is useful when each branch has a narrow conflict scope:
  aad-rbac projection repair, LocalDNS metadata repair, and dirty-tree
  attribution could move at the same time without stepping on each other.

Follow-up at 2026-07-13T10:56Z:

- LocalDNS became a two-stage repair. The domain worker fixed the checked-in
  feature metadata and regenerated compact artifacts, but reviewer correctly
  left the task as follow-up because app-side holder/projection state still
  needed synchronization.
- The next app-side LocalDNS repair task is now visible:
  `ops-apply-domain-reconcile-localdns-compact-stale-residue-and-frontier-s`.
  It should update `hold-compact-localdns-package-partial-frontier` and
  `.state/feature-compact-loop/state.json` from the regenerated five-member
  active frontier plus two consumed pass-history members.
- Dirty-tree attribution also moved from memo to real ownership leaves:
  `domain/publish-or-revert-feature-compact-consumed-pass-history-rollout-20260713`
  and `domain/publish-rp-cluster-lifecycle-residual-frontier-writeback-20260713`.
  They are correctly waiting while the parent dirty-tree app-ops repair still
  owns the shared conflict scope.

Process lesson:

- Directly calling a workflow function is not the same as delivering an event
  through the daemon. A manual planner wake can create/assign a task in the
  task tree without starting a real worker session. Always verify the assigned
  task has a backing `sessions` row before treating it as active.
- If a manual wake creates an active task without a worker session, requeue it
  with an explicit stale-active reason so health shows a truthful runnable leaf
  instead of a fake active one.
- After requeue, the normal planner/dispatcher path can pick the task back up
  with a fresh session. In this case the LocalDNS app-state sync was reassigned
  as app-ops with session
  `s_task_ops-apply-domain-reconcile-localdns-compact-stale-residue-and-frontier-s_retry_20260713105628`
  and a matching `task_worker_started` journal entry.

Follow-up at 2026-07-13T11:04Z:

- The feature-compact consumed-pass-history owner leaf reached review and the
  reviewer accepted it. The useful domain lesson is that a dirty generated
  model tree is not automatically part of the same semantic slice as a runner
  behavior change. The accepted memo split the work cleanly:
  9 runner/net-integration consumed-pass-history files belong together, while
  the current knowledge-map dirty files belong to the RP lifecycle residue.
- The correct outcome was not "publish all dirty files." It was an owner
  decision: do not publish the consumed-pass-history slice as-is; revert or
  regenerate it unless a synchronized accepted model truth update ships with
  it.
- The review handoff had a small race. Before manually applying an accepted
  review, inspect the journal/planner runs for an already-applied
  `task_marked_done` and successor assignment. In this case the planner had
  already accepted the feature-compact leaf and assigned
  `domain/reconcile-rp-cluster-lifecycle-residual-frontier-writeback-20260713`
  before the manual `mark-done` command ran again.
- Current healthy state after the handoff: no runnable backlog and no review
  backlog; the RP lifecycle residual frontier task is active with a real worker
  session. That is the app moving correctly, even though the larger spec and
  compact loops remain blocked on exact wait holders.

Workflow lesson:

- For dirty-tree blocked work, first split by semantic ownership, then by
  generated projection ownership. A generated file should follow the source of
  truth that produced it, not the nearest visible dirty feature.
- "Review accepted" is not the same as "planner has applied it." Check both:
  the reviewer decision and the task-tree/journal state. This avoids duplicate
  manual application and makes it clear whether the app itself is driving the
  next step.

Follow-up at 2026-07-13T11:25Z:

- `domain/review-virtualmachines-spot-pool-eviction-run-171845974-20260713`
  exposed a different handoff bug. The worker wrote a durable artifact review
  memo with a valid `SPEC_RESULT_REVIEW` block proving run `171845974` passed
  live with cleanup, and the reviewer accepted the task, but the archived task
  completion still carried `workflowResult.workflow = default-task-worker`.
- Because the structured result stayed only inside the evidence memo, planner
  did not run the normal `spec-result-review` writeback path. The visible
  symptom was concrete: `.state/spec-loop/state.json` still had
  `spec.virtualmachines.spot-pool-eviction` as `pending`, with `lastRunId =
171845974` but no `lastResultPath`.
- The systemic fix is in `workflows/default-task-worker.ts`: always scan the
  worker session result and cited deliverables for a `SPEC_RESULT_REVIEW` block.
  If one is present, emit the completion as `workflow = spec-result-review`
  even when the task did not have explicit `terminalPipelineWaitReview`
  context.
- Regression coverage was added in `workflows/task-worker.test.ts` for a plain
  review task without terminal-wait context. `bun test workflows/task-worker.test.ts`
  now passes all 26 tests.
- For the already-archived current case, the project state was repaired through
  the supported helper, not by hand-editing JSON:
  `bun run spec-loop update-successor spec.virtualmachines.spot-pool-eviction ...`.
  The row is now `pass` with result path
  `workspace/domain-review-virtualmachines-spot-pool-eviction-run-171845974-20260713/download/runs/test-results/test_20260711161602701_h4tmyw_716962/artifacts/virtualmachines-spot-pool-eviction/spec-runner/result.json`.

Process lesson:

- Artifact-backed evidence is not enough if the structured result is stranded
  in prose or a memo. The app needs the structured completion payload so the
  reviewer/planner path can update loop state automatically.
- Code should not decide whether the review is true; the agent/reviewer still
  decides that. Code should transport the agent's explicit structured result to
  the planner.
- When using helper CLIs, avoid empty flag values. Use explicit clear flags such
  as `--clear-resume-condition`; an empty shell argument can be parsed as the
  next flag name.

Follow-up at 2026-07-13T11:33Z:

- A blocked-only frontier can be process-healthy while still hiding semantic
  projection drift. Health, blocked-contract metrics, unowned-work metrics, and
  loop-unrepresented metrics all returned clean, but the aad-rbac compact
  projection was still under-specified.
- The live holder `hold-compact-aad-rbac-package-partial-frontier` correctly
  said the residual trio includes the secops capacity wait, the row-37
  managed-v2 owner wait, and run-command evidence-only. Current
  `.state/feature-compact-loop/state.json` only listed the secops wait in
  `frontierTaskIds`, even though its summary claimed both live holders.
- Root cause: the exact frontier lived in prose. The generic compact runtime
  projection only used structured fields and feature scopes. The row-37 task is
  a valid cross-loop carrier but has no aad-rbac conflict scope, so controller
  projection could drop it again on the next pulse.
- Applied the existing bounded aad-rbac state repair script again, then fixed
  the systemic path:
  `workflows/lib/feature-compact-runtime-projection.ts` now trusts explicit
  structured `frontierTaskIds` / `compactFrontierTaskIds` after validating the
  named task exists and is blocked.
- Updated
  `scripts/ops-apply-reconcile-aad-rbac-compact-projection-trio-and-frontier-sync-2-20260713.ts`
  so it writes `context.compactFrontierTaskIds` onto the live holder and syncs
  compact-loop state from the same holder contract.
- Added a regression test proving that explicit compact frontier ids survive
  projection even when one carrier lacks a feature conflict scope.

Process lesson:

- A clean "no actionable blocked work" metric means the wait contracts are
  structurally complete; it does not prove every projection is semantically
  complete.
- For cross-loop compact frontiers, the app should store agent-reviewed carrier
  identity in structured context. Code should validate those named tasks exist
  and are blocked, not rediscover the frontier from prose or conflict-scope
  heuristics alone.

Follow-up at 2026-07-13T11:45Z:

- The runner priority feature set is close but not complete. Current
  `ci/feature-sets/runners.txt` resolves to 66 specs in spec-loop state:
  60 pass, 6 pending, 0 error.
- The six runner residues are not a single retry bucket. They are six exact
  waits across five blocker shapes:
  `spec.rp-cluster-lifecycle.new-vnet-runner-variant` is pipeline-only/nonlive
  runner lineage, `spec.rp-cluster-lifecycle.nodeless-cluster-crud` is shared
  westus2 managed-cluster capacity/headroom,
  `spec.rp-nodepool-lifecycle.rollback` is rollback environment/history
  lineage, `spec.virtualmachines.auto-zone-single-sku` and
  `spec.virtualmachines.auto-zone-mixed-sku` are the same
  `availabilityZones=[auto]` request-shape boundary, and
  `spec.nap.full-cleanup-source-equivalent` is the NAP execution-surface
  owner-return wait.
- The blocked contracts for those waits are structurally healthy: each names a
  blocker, observer, resume condition, next check, and fallback. None was due
  at the 11:43Z sample, and none should be reopened as an unchanged rerun.
- The process gap is readability and ownership, not missing wait structure.
  The broad spec loop says `priorityFeatureSet=runners`, but the runner
  residuals were only visible by joining the feature-set file, spec-loop state,
  and the task tree. That makes it too easy to ask "is runner done?" and get a
  vague blocked-loop answer.
- Created one normal app-ops backlog task,
  `ops/review-runners-priority-residual-frontier-20260713`, to make the app
  produce a compact runner residual evidence note. It must verify the 66/60/6
  counts, name each governing wait and schedule, and create a follow-up only if
  a wait condition changed.

Process lesson:

- For a priority feature set, the app should keep an owner-readable residual
  view separate from the low-level loop controller state. The view does not
  decide that a wait is wrong; it collects the current facts so the agent can
  decide whether to keep, replace, escalate, or wait.
- A runnable app-ops review task is better than manually changing spec-loop
  state. It lets the normal planner/worker/reviewer path decide what changed,
  while keeping the project moving when the main frontier is otherwise
  blocked-only.

Follow-up at 2026-07-13T12:16Z:

- Case: `ops/wait-shared-worker-model-auth-capability-return-20260713`
  represented a shared worker/reviewer model-auth outage after repeated
  `Github_copilotException` 401 failures. The app correctly avoided spawning
  many duplicate per-branch auth blockers and kept one shared family wait.
- A bounded owner review,
  `ops/review-1200-shared-worker-model-auth-capability-lineage-20260713`,
  initially failed twice from model context overflow. The useful fix was not a
  bigger wait or another domain blocker; it was prompt narrowing in the worker
  path. Ops-owned bounded reviews should not receive unrelated ADO live-run
  boilerplate.
- After prompt narrowing, the same review succeeded and proved the shared auth
  wait was stale: no formal approval return existed, but later bounded
  app-ops worker and reviewer sessions completed successfully on the same
  runtime surface.
- The reviewer did the right thing by creating an apply follow-up instead of
  accepting a memo-only result. The first apply worker then exposed the next
  gap: the dependent branch
  `domain-diagnose-rp-operation-status-polling-run-171938111-claim-failures`
  had already been archived as `done/replaced`, and the worker reported no
  supported restore/unarchive command.
- The next app-owned task,
  `ops-apply-ops-apply-review-1200-shared-worker-model-auth-capability-line`,
  is the right narrower successor: it is explicitly authorized to close or
  replace the stale shared auth wait and either restore the archived branch or
  create one exact retry successor for run `171938111`.

Process lesson:

- A blocked family can be resolved in stages: first normalize duplicate
  blockers behind one shared wait, then review whether the wait is still true,
  then apply the state repair. Do not skip the apply step; a review memo that
  says "replace this wait" is not the same as replacing it.
- When the affected branch has already been archived, app-ops needs a simple
  supported path: either restore from archive or create a new successor that
  names the archived task, archive file, evidence, and exact retry scope. If
  restore is not available, successor creation is enough; the project should
  not loop on "cannot unarchive" as a blocker.
- Code should collect and route the facts: prompt size, session outcomes,
  task state, archive location, and supported command availability. The agent
  should decide whether the old wait is stale and what exact successor is
  truthful.

Follow-up at 2026-07-13T12:40Z:

- Case: the spec loop still reported 5 `error` rows even though each row
  already carried accepted reviewer evidence, a structured successor
  disposition, and a resume condition. The affected specs were HCP gRPC,
  KMS trust-service public/private KV, two Network ACNS Hubble UI branches,
  and serverless virtual nodes mounted VMSS.
- The real blocker was not five fresh failures. The agent had already judged
  them as exact waits or reviewed frontiers. Code failed to align the state
  row from raw `error` to `pending` wait after that judgment.
- Fixed the spec-loop controller so a raw `fail/error` row with an existing
  structured successor/resume condition is normalized to `pending` during the
  normal controller pulse. This is not code making a product judgment; it is
  code applying the agent's already-recorded judgment consistently.
- After the pulse, spec-loop state moved from `488 pass / 171 pending / 5
error` to `488 pass / 176 pending / 0 error`. The loop is still blocked, but
  now it is truthfully blocked on represented waits instead of mixing stale
  raw errors with wait stewardship.

Process lesson:

- A spec-loop `error` should mean "unhandled error needs diagnosis" or "fresh
  failed execution needs classification." Once the agent accepts a wait,
  successor, or resume condition, the status should stop being raw `error`.
- This kind of cleanup should happen in the controller pulse because the app
  owns state alignment. The agent decides whether the evidence is enough; code
  only keeps the ledger consistent with that decision.

Follow-up at 2026-07-13T12:45Z:

- After the stale raw spec-loop errors were normalized, the app still reported
  a blocked-only frontier. I sampled the process metrics that should catch
  dead-end blocked work:
  `aks-rp-e2e.task.no-work-with-gaps`,
  `aks-rp-e2e.process.unowned-work-count`,
  `aks-rp-e2e.process.blocked.overdue-unworked-count`, and the missing
  waiting-for/observer/owner/fallback blocked-contract metrics. All returned
  `0`.
- I also checked two suspicious-looking blockers by hand:
  `wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704`
  and
  `ops/review-1200-net-integration-compact-authority-frontier-lineage-20260713`.
  Both were structurally valid waits. The first is a GitHub-named
  artifact/auth recovery wait, not an old GitHub execution request. The second
  has a misleading `review-1200` id, but its structured `resume_at` is
  `2026-07-13T18:15:00Z`.
- Cleaned up current app typecheck drift so future process fixes can be
  verified: stale generated repair scripts were adjusted to current helper
  types, `default-task-worker` now guards compacted prompt spreads, and
  `task-tree-tools` imports the hygiene summary type it uses.

Process lesson:

- A blocked-only frontier is not automatically broken. First ask whether the
  blocked-contract metrics are clean and whether any wait is due. If those
  checks are clean, the right action is to wait for the next structured review
  window or returned signal, while making the UI/health output clearer.
- Human-readable task ids can drift from structured wait times. The app and
  humans should trust `resume_at`, `next_check_at`, and `fallback_at` over the
  task id label. A future cleanup can improve naming, but it should not reopen
  a valid wait.

Follow-up at 2026-07-13T12:50Z:

- Case: the user asked about the runners task and the dev-infra-core task while
  the app health view showed a blocked-only frontier. I rechecked the current
  task tree, spec-loop state, ADO metadata, and local ADO artifact workspace.
- Runners is the current priority feature set for `aks-spec-verification-loop`.
  Its inventory is `66` specs: `60 pass`, `6 pending`, `0 fail/error`. The six
  pending specs are all represented by exact reviewed waits, so the current
  runners branch is not stuck on an unowned worker failure.
- The old dev-infra-core live-pass focus is no longer a current frontier item.
  It was accepted and archived after ADO run `171529035` passed the staging
  feature-set run. A later speedup proof run, `171538136`, also completed
  successfully and its artifacts are now present locally under
  `../aks-rp-e2e/workspace/dev-infra-core-runtime-speedup-20260709/run-171538136/`.
- That means the old "artifact unavailable" text in the archived
  dev-infra-core speedup lineage is stale as an environment fact, but it is not
  a current blocked leaf. If the 30-minute speedup goal is reopened, the app
  should create a fresh domain task that reviews run `171538136` artifacts and
  decides the next speedup move. It should not treat archived stale blocker text
  as an active project blockage.
- A fresh current plan for `ci/feature-sets/dev-infra-core.txt` resolves to
  `30` runnable specs and `29` clusters, with all `30/30` specs already `pass`
  in spec-loop state. This proves correctness coverage is healthy, but compact
  efficiency is still weak for the current selector.

Process lesson:

- First separate "active blocked frontier" from "historical archived blocker
  text." The app should only drive current frontier leaves automatically. When
  a human wants to revisit an archived goal, create a new explicit task that
  cites the archived evidence and the current facts.
- A completed proof run can still reveal a new improvement task. For
  dev-infra-core, the speedup proof succeeded and improved runtime, but the
  current planner still creates almost one cluster per spec. The next useful
  task is not "unblock dev-infra-core"; it is "review current dev-infra-core
  compact efficiency and identify safe cluster-sharing opportunities."

Follow-up at 2026-07-13T13:00Z:

- Case: after the blocked-only frontier reached the scheduled review window,
  the app created two concrete app-ops audit tasks instead of remaining idle:
  `ops/recover-mounted-source-invalidated-spec-frontier-blockers-20260713`
  and
  `ops/recover-mounted-source-invalidated-compact-frontier-blockers-20260713`.
- Both tasks audited the blocked frontier against mounted `/app/sources/aks-rp`
  and current checked-in compact/domain authority. They converged on the same
  stale family: CCP security-patch Windows reviewed-exception wording.
- The worker did not mutate the tree directly. It wrote apply-ready evidence,
  then the reviewer/planner path accepted the result and applied the repair.
  The spec-loop wait
  `wait-ccp-security-patch-reviewed-exception-owner-response-20260708` now
  states the exact Windows2022/Windows2025 source-unauthorized/source-change
  frontier. The compact holder was replaced by
  `hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier-20260713`,
  which points at the sharpened Windows wait and preserves MarinerV2 as retired
  historical evidence rather than a live blocker.
- Health after the apply returned to blocked-only stewardship with no active or
  review work, but the frontier is now more precise. That is real progress even
  though the total blocked count stayed at `141`.

Process lesson:

- A good blocked-frontier recovery does not always reduce the blocked count
  immediately. Sometimes the correct move is to replace vague/stale blocker
  meaning with a narrower exact wait. That prevents future loops from asking
  the same old question and gives the next review a sharper resume condition.
- This case matches the intended separation: code routed/scheduled/validated
  the work, the agent judged mounted-source truth, and planner applied the
  accepted structured repair. We should preserve that pattern for future
  blocked-family cleanup.

Follow-up at 2026-07-13T13:05Z:

- Case: after the mounted-source blocker cleanup, the planner created
  `ops/repair-project-approval-return-visibility-or-escalation-20260713` for
  the project-level off-track focus approval-return family.
- The task audited the exact focus approval lineage
  `focus-review_off_track` / `focus-review-off_track-approval-refresh-20260712`
  and the linked project-level owner-return blocker.
- The worker found no controller-visible returned
  `project.approval.submitted` decision for that lineage. It therefore
  recommended preserving the existing focus wait and project-level blocker
  without sending a duplicate approval ask.
- The reviewer/planner accepted the claim, marked the task done, and archived
  it. The frontier returned to blocked-only stewardship, but with the approval
  wait explicitly revalidated rather than silently ignored.

Process lesson:

- "No returned decision found" can be a valid completed recovery task when it
  proves the existing wait is still exact and prevents duplicate asks. The task
  should close with a clear note that the wait remains truthful, not stay in
  review forever.
- Project-level approval waits should be audited by checking controller-visible
  return evidence first. If no return is visible, preserve the same lineage and
  avoid creating a new request that would split human context.

Follow-up at 2026-07-13T13:22Z:

- Case: the VirtualMachines agentpool compact frontier had a good domain memo
  but still needed the app-owned state repair. The reviewer correctly converted
  `domain/reconcile-virtualmachines-agentpool-split-frontier-visible-members-20260713`
  into the app-ops follow-up
  `ops-apply-reconcile-virtualmachines-agentpool-split-frontier-visible-mem`.
- The app-ops worker generated and ran the supported repair script
  `scripts/ops-apply-reconcile-virtualmachines-agentpool-split-frontier-visible-mem-20260713.ts`.
  The repair created four exact compact holder leaves for
  `cli-add-multi-sku`, `managedsystem-combined`, `pool-delete-rest`, and
  `vmas-to-vms-migration-slb`, tightened
  `hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b`,
  and synchronized `.state/feature-compact-loop/state.json`.
- The completion was proven by the normal app path: `task_worker_completed`,
  then `task_marked_done`, plus the accepted evidence memo
  `evidence/archive/ops-apply-reconcile-virtualmachines-agentpool-split-frontier-visible-mem-20260713.md`.
  Health then returned to blocked-only stewardship with no active or review
  work.
- A separate LocalDNS follow-up,
  `ops/apply-localdns-compact-controller-visible-state-repair-20260713`, was
  intentionally created as blocked, not active, because it is gated by the
  refreshed broadened focus approval wait. That is a real waiting condition,
  not an orphaned repair.

Process lesson:

- Do not judge an app-ops repair from the existence of a generated script alone.
  The proof is the full path: worker completion, accepted review/planner action,
  and repaired task-tree or loop-state fields.
- A blocked app-state repair can be correct when it names the exact approval or
  resume condition. The problem is not "blocked"; the problem would be a blocked
  task without owner, condition, observer, or fallback.
- For compact frontier work, better progress often means making hidden members
  explicit as exact holders, not triggering a new ADO run. Live reruns should
  wait until one represented same-surface frontier actually changes.

Follow-up at 2026-07-13T13:28Z:

- Case: the runner/dev-infra-core focus looked like it could be "pushed
  forward" by local task-tree repair, but no Azure DevOps run was active. That
  would not prove live validation.
- Before dispatch, the domain repo was clean but ahead of ADO `origin/dev` by
  one commit: `2c9d7c78a`. Running the pipeline before publishing would have
  tested stale remote code. The commit was pushed to ADO first.
- A real ADO run was then queued for pipeline `467665` on branch `dev`:
  `171990664`, commit `2c9d7c78a366856b80f6f1cc8165f5757c25bfc8`,
  `feature_set=dev-infra-core`, `target=staging`, `parallel=5`, `slices=5`,
  `slice_max_parallel=5`.
- The run was made visible to the task tree as
  `ops/wait-dev-infra-core-ado171990664-live-validation-result-20260713`, a
  blocked wait with `waiting_for.runId=171990664`, the ADO run URL, branch,
  commit, feature set, target, next check, and fallback.

Process lesson:

- Local app movement and live validation movement are different. A live
  validation task is not really moving unless a current pipeline run id exists
  and the task tree knows how to inspect it when it finishes.
- Always check pipeline-visible source before dispatch. If the domain repo has
  unpublished commits, push first or explicitly record that the run is testing
  older code.
- A manual dispatch should still be converted into a project-visible wait.
  Otherwise the app cannot close the loop when the run succeeds, fails, or
  uploads no usable artifacts.

Follow-up at 2026-07-13T16:05Z:

- Case: ADO run `171990664` for `feature_set=dev-infra-core` moved from
  queued to terminal `completed/failed`, but still published no artifacts.
- Authenticated timeline inspection showed this was not a test failure and did
  not create AKS clusters. The plan step succeeded and selected 30 specs / 29
  clusters, then `Live dependency preflight` failed before slice execution.
- The exact preflight blockers were:
  - `spec.rp-nodepool-lifecycle.multi-agentpool-runner`: selected scenario test
    depends on mounted private AKS RP source.
  - `spec.kms.v2-private-vnet-integration-private-kv-lifecycle`: selected
    scenario test shells out to Azure CLI instead of scenario-lib REST helpers.
- The old ADO wait/recheck tasks were removed after terminal review, but the
  frontier had no runnable repair work until two exact domain repair tasks were
  added:
  - `domain/repair-rp-nodepool-multi-agentpool-runner-self-contained-20260713`
  - `domain/repair-kms-private-vnet-private-kv-remove-az-cli-20260713`

Process lesson:

- A terminal ADO run with no artifacts still needs log/timeline inspection
  before classification. If it failed in preflight, do not mark planned specs as
  pass/fail and do not wait for missing artifacts forever.
- Preflight failures should create exact repair tasks for the cited policy
  violations. The next live validation step is a rerun only after those repairs
  land and are visible to ADO.
- "Plan selected N clusters" is not proof of cluster creation. Cluster creation
  starts only after the execute slice runs; here it never ran.

Follow-up at 2026-07-13T16:16Z:

- Case: the two dev-infra-core preflight blockers were split into exact repair
  tasks instead of leaving the failed feature-set run as one generic blocker.
- `domain/repair-kms-private-vnet-private-kv-remove-az-cli-20260713` found the
  KMS carrier already repaired on `dev` at commit `87b67098a`. It verified
  private-source policy, live-admission policy, and check mode, then reused the
  already queued ADO run `171997614`.
- ADO run `171997614` succeeded and published `slice-01-test-results`. The
  downloaded `result.json` showed
  `spec.kms.v2-private-vnet-integration-private-kv-lifecycle` passed in
  staging/westus2. The shared-cluster artifact proved real cloud work:
  resource group `rg-plan-001-5134-t9jlsq-745500`, cluster
  `aks-plan-001-5134-t9jlsq-745500`, and `cleanupStatus=complete`.
- `domain/repair-rp-nodepool-multi-agentpool-runner-self-contained-20260713`
  produced commit `40ab1483a`, making the multi-agentpool runner self-contained
  and live-admissible. The first worker result still named a push blocker, but
  the actual root cause was only the credential-helper PATH used during that
  worker attempt. Retrying with `/app/.state/.local/bin` in PATH pushed
  `40ab1483a` to ADO `origin/dev`.
- After publication, the same-spec ADO rerun `172009175` was queued and
  represented as
  `wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175`.

Process lesson:

- Exact preflight repair tasks can finish quickly when they prove the policy
  surface directly. After repair, always verify the remote branch that ADO will
  run, not only the local branch.
- A reviewer may accept "committed locally" as repair completion, but live
  validation still needs remote publication plus a visible ADO wait. If a task
  result mentions a push blocker, re-check the current shell/credential state
  before treating it as a durable external blocker.
- A passing ADO run is strongest when backed by three facts together:
  pipeline result, downloaded `result.json`, and cluster/resource cleanup
  artifact. Use all three before marking a spec as live-passed.

Follow-up at 2026-07-13T16:21Z:

- Case: `wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175` was
  inspected after the repair commit `40ab1483a` was pushed and the same-spec
  ADO rerun was queued.
- Live ADO state still reported `status=notStarted`, `result=null`,
  `startTime=null`, and zero artifacts for run `172009175`.
- The wait is valid because it now carries the exact ADO run id, pipeline id,
  branch, commit, target, selected spec, next check, and fallback. The right
  action is to recheck the same run when it starts or finishes, not create a new
  environment diagnosis yet.
- The app-ops warning triage
  `ops/triage-rp-nodepool-multi-agentpool-run-172009175-warning-20260713`
  completed and was accepted. It concluded the same thing: keep the wait-only
  blocked leaf until terminal artifacts exist or the fallback window expires.

Process lesson:

- A queued ADO run with no `startTime` is still useful project state when it is
  fresh and exact. It should be represented as a blocked external wait, not as a
  failure and not as a live pass.
- The app should distinguish three ADO states:
  queued/not started means wait and recheck; terminal/no artifacts means inspect
  timeline/logs; terminal/with artifacts means review `result.json` and cleanup
  proof.
- A repair is not fully verified until its successor run either passes with
  artifacts or fails with enough logs to create the next exact repair.

Follow-up at 2026-07-13T16:21Z:

- Case: a raw tree scan appeared to find
  `focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711`
  as blocked without blocker metadata.
- `bun run task-tree show` proved the real task has a complete blocker:
  `category=human-approval`,
  `waiting_for.type=project.approval.submitted`, owner `human`, next check, and
  fallback.
- The apparent missing blocker came from a duplicate summary copy under
  `project.context.current_focus_proposal`, not from the live task record.

Process lesson:

- Blocked-frontier audits must inspect the authoritative task record, not every
  nested summary object in `tasks/tree.json`. Context snapshots can reuse task
  ids but are not the task state.
- The task-tree helper output is the safer source for one-task review. Bulk
  scanners should only walk `tree.tasks`, or they should explicitly ignore
  `context` snapshots.
- This false positive is useful: it shows why app code should collect facts and
  present evidence, while the agent judges the real task state from the
  authoritative path.

Follow-up at 2026-07-13T16:31Z:

- Case: `ops/wait-project-approval-owner-return-primary-blocker-20260713`
  looked healthy in prior metric-recovery evidence, but the current
  authoritative `bun run task-tree show` output showed `blocker` had regressed
  to prose-only text.
- The prose still described the right wait, but the structured fields were
  missing from the live task payload: no `waiting_for.type`, no `observed_by`,
  no `observation_method`, no `next_check_at`, and no `fallback_at`.
- A bulk scan over `tree.tasks` confirmed this was the only blocked leaf still
  missing watcher metadata outside child rollups.
- The current frontier also had real motion: ADO run `172009175` moved to
  `inProgress`, `ops/repair-exact-ado-wait-warning-proving-case-shape-20260713b`
  was active, and
  `domain/reconcile-vm-prerelease-cluster-autoscaler-mounted-source-20260713`
  was active.
- Created and assigned
  `ops/repair-project-approval-owner-return-structured-wait-regression-20260713`
  so app-ops owns the regression rather than silently hand-editing the task
  state.

Process lesson:

- Do not trust a recovered metric only because it recovered earlier. Re-read
  the current authoritative task payload when a long-lived wait is still in the
  frontier.
- A blocked wait is only machine-watchable when the structured fields survive:
  `waiting_for`, `observed_by`, `observation_method`, `next_check_at`, and
  `fallback_at`. Prose alone is human-readable but not enough for watchdog
  closure.
- If a focus/frontier refresh rewrites a structured blocker as prose, the
  systemic fix is to repair the refresh path or add regression coverage, not to
  repeatedly patch the single task by hand.

Follow-up at 2026-07-13T16:42Z:

- The app-ops repair
  `ops/repair-project-approval-owner-return-structured-wait-regression-20260713`
  found the exact runtime bug: `refreshBlockedWait()` rebuilt blockers with
  generic defaults when a caller did not supply a new wait target.
- For exact approval-return waits, that meant a refresh could preserve the
  human-readable condition but replace the real machine contract with
  `waiting_for.type = frontier.changed` and generic
  `observed_by.trigger = task-tree.refresh-blocked-wait`.
- The repair restored
  `ops/wait-project-approval-owner-return-primary-blocker-20260713` to a
  structured `project.approval.submitted` wait with lineages, observer,
  next-check, resume, and fallback fields.
- The repair also changed `workflows/lib/task-tree-tools.ts` so
  `refreshBlockedWait()` preserves existing structured blocker fields unless
  the caller explicitly provides replacements, and added a regression test for
  preserving approval-return metadata.

Process lesson:

- Refresh helpers must preserve exact wait identity by default. If a caller only
  wants to refresh prose or timing, it should not have to restate the whole
  machine-readable wait contract.
- A long-lived blocked wait can be valid and still suffer representation drift.
  The watchdog/app-ops review should check both: is the wait semantically still
  true, and is the structured watcher still exact?
- When a repair task fixes both runtime state and code, the review should prove
  both sides: current `task-tree show` for the live wait, plus a regression test
  that prevents the same drift from recurring.

Follow-up at 2026-07-13T16:54Z:

- Case: `domain/apply-cluster-autoscaler-vm-prerelease-source-provenance-frontier-split-20260713`
  was accepted after it updated repo-local compact/spec artifacts to split the
  VM-prerelease cluster-autoscaler frontier into an e2ev3 suite-native quartet
  and an e2ev2-overlay trio.
- The accepted domain task left `/app/projects/aks-rp-e2e` dirty with 11
  intended files. A separate publish task was needed:
  `domain/publish-cluster-autoscaler-vm-prerelease-frontier-split-20260713`.
- The publish task validated and committed the intended changes locally as
  `90fdd1710`, but its worker could not push because its environment could not
  find the Azure DevOps auth-capable `az` path.
- The shell environment did have `/app/.state/.local/bin/az`; pushing from the
  current shell succeeded and `origin/dev` now resolves to
  `90fdd1710cbd004954cdfd516584bc36a0ae6d01`.

Process lesson:

- Accepted repo-local domain mutations still need a publication check. A clean
  app-local review is not enough when future ADO runs and workers read
  `origin/dev`.
- If a worker reports an ADO push blocker, verify whether it is a real auth
  blocker or just a PATH/helper mismatch. The same machine may already have an
  auth-capable `az` at `/app/.state/.local/bin/az`.
- Publication tasks should prove three facts: exact intended diff, validation
  command result, and remote branch visibility after push.

## Case: manual assignment is not the same as dispatched work

Tasks:

- `domain/review-rp-nodepool-multi-agentpool-ado-run-172009175-pass-20260713`
- `ops/repair-assignment-not-consumed-metric-consume-lag-20260713`

Observed facts:

- ADO run `172009175` had already reached terminal success and artifacts were
  downloaded, but the exact wait
  `wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175` still said to
  wait for terminal artifacts.
- Creating and assigning the domain review task with `bun run task-tree assign`
  changed the task tree to `active` and wrote an assignment row, but no worker
  started until the canonical `project.task.assigned` event was emitted.
- The same queue shape appeared again for
  `ops/repair-assignment-not-consumed-metric-consume-lag-20260713`: task state
  was `active`, `.state/task-assignments.jsonl` still had the assignment row,
  and `worker_started_at` was absent.
- Emitting the normal event with `may-agent --emit project.task.assigned ...`
  caused `task_worker_started` to appear and drained `bun run task-tree
  assignments` back to `[]`.

Diagnosis:

- `task-tree assign` is a state/queue helper, not a complete worker dispatch.
  In normal app flow, the planner or loop controller drains the queued
  assignment and emits `project.task.assigned`; direct manual assignment can
  leave a task looking active while no worker has been woken.
- The assignment-not-consumed metric was useful because it exposed this gap as
  a process issue instead of letting the task sit silently in active state.

Suggested app action:

- Keep using the canonical event path for manual recovery: either wake the
  planner so it drains and dispatches queued assignments, or emit the exact
  `project.task.assigned` event when intentionally debugging a single assigned
  task.
- Add or keep an app-ops repair path for queued assignments that are active but
  lack `worker_started_at`, because that state is not real progress.
- Do not treat active task state alone as proof that work is happening. Check
  `task-tree assignments` and the task trace for `worker_started_at`.

Workflow lesson:

- The task tree records intent; the event bus starts work. A healthy process
  needs both.
- Manual debugging should preserve the same event semantics as the app. If we
  bypass the event, metrics should catch it and app-ops should convert it into
  a concrete dispatch/observability repair.

Follow-up at 2026-07-13T17:08Z:

- Re-emitting the original `project.task.completed` fact for
  `domain/review-rp-nodepool-multi-agentpool-ado-run-172009175-pass-20260713`
  restored the normal review path. The reviewer accepted the ADO run evidence
  but returned a follow-up because the exact wait leaf was still live.
- The planner created
  `ops-apply-review-rp-nodepool-multi-agentpool-ado-run-172009175-pass-2026`.
  That app-ops task used the supported `task-tree mark-done` path to close
  `wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175` from the reviewed
  terminal-pass evidence.
- A later readback of `bun run task-tree show
  wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175` returned `Task not
  found`, which is correct after archival. The reviewer accepted the apply task
  because the archived done-leaves bundle records the stale wait as completed.
- The assignment metric false-positive was also repaired in code:
  `scripts/project-metrics.ts` now checks for a fresh running
  `workflow:task-worker` session before counting a queued assignment as not
  consumed. `scripts/project-metrics.test.ts` covers both the repaired
  false-positive case and the true stale-assignment case.

Process lesson:

- When a review task is stuck in `review` with a worker claim but no reviewer
  row, the right repair is to replay the missing completion fact, not to mark
  the task done by hand. That keeps the reviewer as the judge and the planner as
  the state mutator.
- A metric should count the real process condition, not an intermediate queue
  artifact. An assignment row is not a problem when the matching worker session
  is already running and fresh.

## Case: closed waits can remain alive through stale focus metadata

Tasks:

- `wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175`
- `ops/repair-focus-owner-return-stale-ado-lineage-20260713`
- `ops/repair-focus-owner-return-metadata-drift-root-cause-20260713`

Observed facts:

- ADO run `172009175` proved a real live pass for
  `spec.rp-nodepool-lifecycle.multi-agentpool-runner`, including result
  artifacts and shared-cluster cleanup evidence.
- The exact wait leaf was closed through the supported task-tree path and later
  readback showed `Task not found`, which is correct after archival.
- Even after the wait was no longer live, focus/owner-return metadata still
  named `wait-rp-nodepool-multi-agentpool-runner-ado-run-172009175` as part of
  the current blocked-holder set.
- A one-off stale-lineage cleanup removed the bad live reference, but the
  follow-up root-cause task found the broader issue: focus metadata and project
  current-focus prose had no integrity check after waits were archived or
  replaced.

Diagnosis:

- Closing a wait is not enough if another live task carries copied holder lists
  in `context.observations`, progress-review evidence, or project focus prose.
- The project can look blocked on already-settled work when summary/focus fields
  are treated as durable routing truth but are not validated against the live
  task tree.
- This is an app-process bug, not an AKS domain bug. The right repair is a
  reusable consistency check that compares focus metadata to live task states.

App action taken:

- `scripts/lib/focus-metadata-audit.ts` now audits focus-plan linked active,
  review, and blocked task ids, plus owner-return live-holder prose that claims
  a current blocked set.
- `scripts/check-integrity.ts` fails on focus metadata drift.
- `scripts/project-metrics.ts` includes focus metadata drift in the task-tree
  problem metric so watchdog/evaluation can catch it without manual inspection.
- Targeted tests in `scripts/check-integrity.test.ts` and
  `scripts/project-metrics.test.ts` cover the stale run-172009175 owner-return
  pattern.

Process lesson:

- For blocked-task recovery, always verify both the leaf state and the summary
  metadata that points to it.
- A completed wait should disappear from live blocked-holder sets. If it still
  appears, do not re-open the wait; repair the metadata producer or add an
  integrity signal that catches the stale reference.
- When a pattern repeats after a one-off cleanup, the next task should be a
  root-cause app-ops repair with a metric or integrity gate, not another manual
  text refresh.

## Case: active diagnosis duplicated a same-lineage evidence ceiling

Tasks:

- `hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b`
- `domain/diagnose-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260713c`
- `domain/diagnose-bootstrap-profile-byo-acr-create-cache-acr0-runtime-surface-20260713`

Observed facts:

- The compact holder for
  `spec.bootstrap-profile-byo-acr.cache-direct-cache-switch` is blocked on the
  exact run `171800822` frontier: managed-cluster create step
  `create-cache-acr0` timed out after `4500000ms` under runtime API
  `2026-04-02-preview`, with last poll state `CreatingAgentPools: 0/1 nodes
  completed`.
- At `2026-07-13T16:08Z`, the task
  `domain/diagnose-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260713c`
  was accepted as completed. Its evidence memo says the async operation
  `8e0e36d1-3ed3-4073-b7a1-d8f887417990` and node resource group
  `MC_rg-plan-001-0335-69ezcw-903180_aks-plan-001-0335-69ezcw-903180_westus2`
  are only pointers, not lower-level proof, so the existing
  `create-cache-acr0` holder remains the strongest truthful local frontier.
- At `2026-07-13T17:24Z`, the planner created a new active task,
  `domain/diagnose-bootstrap-profile-byo-acr-create-cache-acr0-runtime-surface-20260713`,
  asking almost the same same-run/same-spec question: check whether run
  `171800822`, the same async operation, or the same node resource group expose
  a narrower first failing surface below `create-cache-acr0`.

Diagnosis:

- The planner made a useful kind of move by converting a passive blocked holder
  into active domain diagnosis instead of blindly waiting.
- The problem is that it did not first recognize an accepted same-lineage
  evidence ceiling. Same spec, same run id, same async operation id, same node
  resource group, and same requested lower-level question had already been
  reviewed and accepted one hour earlier.
- This creates repeat work without adding new evidence. It also risks making
  the project look active while it is re-answering an already-settled question.

Suggested app action:

- Before creating a blocked-holder diagnosis task, the planner should scan
  accepted recent evidence for the same diagnosis identity:
  `specId + sourceRunId + firstFailingStep + asyncOperationId/nodeResourceGroup`
  plus the requested question, such as "narrow below create-cache-acr0".
- If an accepted memo already states the current evidence ceiling and no newer
  artifact or material runtime change exists, do not create a duplicate domain
  diagnosis. Refresh the holder with a pointer to the accepted ceiling, or set
  the next check/fallback to ask only for genuinely new evidence.
- If the planner still creates a new diagnosis, the task goal should explicitly
  say what new evidence or new question makes it different from the accepted
  prior diagnosis.

App action taken:

- The manual learning wake was consumed by the planner. It left the already
  active diagnosis attempt alone, which avoided interrupting in-flight work,
  but created `ops/repair-duplicate-same-lineage-diagnosis-guard-20260713` to
  fix the process path that allowed the duplicate dispatch.
- The repeated diagnosis
  `domain/diagnose-bootstrap-profile-byo-acr-create-cache-acr0-runtime-surface-20260713`
  completed and was accepted. It reached the same evidence-ceiling conclusion:
  run `171800822`, async operation
  `8e0e36d1-3ed3-4073-b7a1-d8f887417990`, and node resource group
  `MC_rg-plan-001-0335-69ezcw-903180_aks-plan-001-0335-69ezcw-903180_westus2`
  still do not narrow below `create-cache-acr0`.
- The planner applied the accepted review, refreshed
  `hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b`,
  and marked the duplicate diagnosis done without replacing the holder.

Process lesson:

- "Turn a blocked wait into active diagnosis" is the right instinct, but it
  needs a same-lineage history check.
- A duplicate-diagnosis guard should not be a hard code judgment about domain
  truth. Code can collect candidate prior evidence and identity fields; the
  planner/reviewer agent should decide whether the new task is genuinely new or
  a duplicate.

## Case: future-window review leaves duplicated governed family waits

Tasks:

- `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
- `ops/review-1800-shared-westus2-managed-cluster-capacity-family-lineage-20260713b`
- `ops/review-1800-westus2-managed-cluster-capacity-family-lineage-20260713`
- `hold-compact-localdns-package-partial-frontier`
- `ops/review-1800-localdns-compact-frontier-lineage-20260713`
- `ops/review-1800-localdns-compact-split-frontier-lineage-20260713`

Observed facts:

- At `2026-07-13T17:36Z`, the project had no runnable, active, review, or
  waiting leaves. It had only blocked leaves.
- No blocked leaf was overdue yet. The nearest project/loop rollup check was
  `2026-07-13T17:45:28Z`, and many exact blocked holders had
  `next_check_at` / `resume_at = 2026-07-13T18:00:00Z`.
- The shared westus2 capacity family wait already carries the 18:00Z review
  contract:
  `wait-shared-westus2-managed-cluster-capacity-family-return-20260703` has
  `next_check_at = resume_at = 2026-07-13T18:00:00Z`, `fallback_at =
  2026-07-14T18:00:00Z`, and says the review should preserve or sharpen one
  exact westus2 managed-cluster capacity/headroom family.
- Two project-level 18:00Z review leaves also exist for the same capacity
  family:
  `ops/review-1800-shared-westus2-managed-cluster-capacity-family-lineage-20260713b`
  and `ops/review-1800-westus2-managed-cluster-capacity-family-lineage-20260713`.
- The LocalDNS compact holder already carries an 18:00Z review contract for the
  regenerated five-member frontier plus two consumed pass-history members.
- Two project-level 18:00Z review leaves also exist for that same LocalDNS
  compact lineage:
  `ops/review-1800-localdns-compact-frontier-lineage-20260713` and
  `ops/review-1800-localdns-compact-split-frontier-lineage-20260713`.
- Existing evidence
  `evidence/archive/ops-repair-project-review-window-frontier-decomposition-20260713.md`
  had already classified
  `ops/review-1800-shared-westus2-managed-cluster-capacity-family-lineage-20260713b`
  as a duplicate passive review leaf that should be folded into
  `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`, but
  that duplicate still exists in the live tree.

Diagnosis:

- A future review leaf is useful only when it adds a distinct review surface.
  When the governed family wait/holder already carries the same scope, same
  review window, same fallback, and same observation contract, a separate
  project-level review leaf is duplicate passive work.
- The app has two related failure modes here:
  1. an accepted or useful decomposition audit was not fully applied to the live
     tree; and
  2. later blocked-frontier repair created another sibling review leaf for the
     same family instead of reusing or sharpening the existing governed wait.
- This is different from a normal all-blocked state. Waiting until 18:00Z is
  reasonable, but waking multiple duplicate leaves at 18:00Z would waste agent
  time and can produce inconsistent refresh decisions for the same lineage.

Suggested app action:

- Before creating a future-window review leaf, compare it to existing governed
  waits/holders by lineage, affected scope, `next_check_at`, `resume_at`, and
  `fallback_at`.
- If an existing family wait already carries the exact review contract, refresh
  that wait/holder instead of creating a separate project-level passive review
  leaf.
- If two review leaves are genuinely different, their goals should state the
  difference explicitly. Otherwise, fold the duplicate leaves into the single
  governed family wait/holder before the review window opens.
- The planner should consume the prior decomposition audit and either apply it
  or record why the prior fold recommendation is no longer valid.

## Case: approval-governed ready holder with self-referential wait target

Task:

- `domain/hold-rp-cluster-lifecycle-ready-carriers-visible-backlog-20260713`

Observed facts:

- At `2026-07-13T17:49Z`, the project was moving with active app-ops work:
  `ops/reconcile-localdns-blocked-frontier-visible-shape-20260713` and
  `ops/reconcile-rp-lifecycle-ready-holder-visible-shape-20260713`.
- The RP cluster lifecycle ready holder prose says it is blocked behind the
  governing approval/owner-return wait
  `ops/wait-project-approval-owner-return-primary-blocker-20260713`.
- Its structured `blocker.waiting_for` instead points back to itself:
  `{ "type": "blocker.resolved", "taskId":
  "domain/hold-rp-cluster-lifecycle-ready-carriers-visible-backlog-20260713" }`.
- The active RP reconciliation task acceptance requires matching approval-wait
  lineage for the RP lifecycle ready/backlog families.

Diagnosis:

- This is not an exact wait even though the prose is mostly clear. A blocked
  holder waiting for itself cannot be consumed as a real resume signal.
- The useful repair is not a blind retry. App-ops should re-check the live
  approval carrier and either link this holder to the governing approval wait,
  replace it with a sharper holder, or document why the self-reference is only
  stale metadata and the current holder should remain.

Suggested app action:

- Let `ops/reconcile-rp-lifecycle-ready-holder-visible-shape-20260713` consume
  this finding as part of its current live reconciliation work.
- Future blocked-frontier review should flag `waiting_for.taskId == task.id`
  as a high-value sample for agent review. Code can collect the mismatch; the
  agent should decide the correct governing wait or replacement.

## Case: matured future-window review leaf still blocked on itself

Tasks:

- `ops/review-1800-bootstrap-profile-byo-acr-runtime-frontier-lineage-20260713`
- `ops/review-1800-ccp-compact-represented-owner-decision-family-lineage-20260713`
- Related due holder sample:
  `hold-compact-localdns-package-partial-frontier`

Observed facts:

- At `2026-07-13T18:01Z`, the project had one active app-ops task
  (`ops/review-unpublished-knowledge-map-drift-20260713`) and no runnable,
  review, waiting, or assignment rows.
- Many blocked leaves had `next_check_at` / `resume_at` equal to
  `2026-07-13T18:00:00Z`, so the review window was open.
- The `ops/review-1800-*` future-window leaves still had `state: blocked`
  after the window opened.
- Their structured wait target pointed to themselves, for example
  `{ "type": "blocker.resolved", "taskId":
  "ops/review-1800-bootstrap-profile-byo-acr-runtime-frontier-lineage-20260713" }`.
- The task prose says "Do not start before 2026-07-13T18:00:00Z"; after that
  timestamp the task should be eligible for app-ops review, not waiting for
  itself to resolve.

Diagnosis:

- A future-window review leaf is a delayed review request. Its resume signal is
  time plus any named lineage evidence, not the leaf resolving itself.
- Once `resume_at` / `next_check_at` is in the past, a self-referential
  `waiting_for.taskId` turns the leaf into a dead end: no external event can
  satisfy "this task is resolved" because this task is the one that should now
  run.
- This is related to the earlier self-referential RP holder bug, but the
  correct handling is different. A governed holder should be linked to its
  upstream owner/approval wait. A matured future-window review leaf should be
  unblocked/requeued or replaced by one exact app-ops review task.
- The app should also dedupe by lineage before waking all 18:00Z leaves. Some
  due leaves may be passive duplicates of governed holders, while others are
  the single intended review surface.

Suggested app action:

- When a blocked task has `resume_at` or `next_check_at` in the past and
  `waiting_for.taskId == task.id`, treat it as an actionable process-hygiene
  sample for app-ops review.
- The planner/watchdog should ask an agent to classify each matured future
  review leaf as one of:
  1. unblock/requeue this exact review task;
  2. fold it into an existing governed wait/holder for the same lineage;
  3. replace it with one sharper successor; or
  4. keep it blocked only with a real external owner/event wait and refreshed
     `next_check_at` / `fallback_at`.
- Code should collect the due/self-reference facts. The agent should decide
  whether the right action is unblock, fold, replace, or keep-wait.

## Case: transient model/provider failure during blocked-frontier review

Tasks:

- `ops/review-1805-westus2-capacity-frontier-family-lineage-20260713`
- `ops/review-1810-localdns-compact-split-frontier-lineage-20260713`
- `ops/review-1815-ccp-compact-reviewed-exception-frontiers-20260713`

Observed facts:

- The planner correctly created and assigned overdue blocked-frontier review
  work after the 18:00Z window opened.
- The workers did not perform domain review. They returned only
  `OpenAI API error (429): 429 No deployments available for selected model`.
- The reviewer recognized this as missing evidence:
  - westus2 and CCP were reviewed as `redo`;
  - LocalDNS was reviewed as `blocked` with `retry-after-tooling-recovery`;
  - no AKS/domain conclusion was accepted from the failed worker attempts.

Diagnosis:

- A model/provider availability error is infrastructure noise, not a product
  blocker and not evidence about the AKS feature frontier.
- The correct next action is to retry the same task after cooldown with the
  same scope and acceptance criteria. Creating a new domain holder, widening
  the blocker, or marking the family as reviewed would hide the real work.
- The reviewer should keep this distinction loud: "worker could not run" is
  different from "worker ran and found the feature still blocked."

Suggested app action:

- Treat provider 429/no-deployment failures as retryable execution failures for
  the same task.
- Preserve the exact original review scope and required output artifact on
  retry.
- If repeated provider failures exhaust a bounded retry window, escalate as an
  app/runtime availability problem, not as an AKS-domain blocker.

## Case: overdue blocked-wait review memo without state change

Tasks:

- `ops/review-1826-compact-loop-overdue-blocked-frontier-wave-20260713`
- `ops/review-1827-project-overdue-blocked-frontier-wave-20260713`
- `ops/review-1830-traffic-applink-compact-frontier-pair-20260713`
- `ops/repair-1840-localdns-compact-frontier-projection-sync-20260713`
- `ops/repair-1845-ccp-security-patch-holder-represented-metadata-sync-20260713`

Observed facts:

- The watchdog/planner correctly created concrete review tasks for overdue
  blocked frontier samples.
- Several workers produced useful evidence memos that classified the current
  lineage accurately, but explicitly made no runtime task-tree or loop-state
  mutation.
- The reviewer did not accept those memos as closure when the affected waits
  still had stale `next_check_at` / `fallback_at`, stale represented metadata,
  or stale projection state.
- The reviewer converted those cases into concrete app-state repair successors:
  refresh the affected waits in place, fold stale review leaves into the exact
  holder, or apply metadata/projection sync.
- The LocalDNS projection repair is the positive example: after the worker
  actually updated `.state/feature-compact-loop/state.json` and proved the
  exact three frontier ids, the reviewer accepted it.

Diagnosis:

- For overdue blocked-wait work, analysis is not enough. The project is stuck
  because a wait is still overdue, stale, or incorrectly represented.
- A review memo is useful input, but it does not remove passive overdue debt
  unless it is paired with one of:
  1. an applied task-tree/loop-state repair;
  2. a replacement with one sharper successor;
  3. a closure/unblock backed by evidence;
  4. an explicit escalation or external wait with refreshed watch/fallback; or
  5. an active/review successor that owns the concrete mutation.
- The worker and reviewer boundary worked well here: the worker gathered facts
  and the reviewer insisted that stale waits need an actual app-state outcome.

Suggested app action:

- Make overdue blocked-wait review workflows ask for both a decision and an
  apply path. If the worker cannot safely mutate state, it should return a
  structured repair packet that the planner can immediately convert into an
  app-ops apply task.
- Keep rejecting "memo only" completions for overdue waits when the live
  frontier still shows stale timing, stale represented ids, or stale loop
  projection.
- Treat accepted projection repairs as the reusable happy path: show before
  state, apply the bounded repair, show after state, and cite the evidence path.

## Case: active repair shortcut must be offender-aware

Tasks:

- `ops/review-1825-spec-loop-overdue-blocked-frontier-wave-20260713`
- `ops-apply-review-1825-spec-loop-overdue-blocked-frontier-wave-20260713-s`
- `hold-compact-windows-eligibility-frontier-20260707`
- `hold-compact-net-integration-package-partial-frontier`
- `ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized`
- `ops/review-1200-net-integration-compact-authority-frontier-lineage-20260713`

Observed facts:

- The spec-loop overdue repair correctly restored
  `ops/review-1825-spec-loop-overdue-blocked-frontier-wave-20260713` as an
  active exact carrier for the 37 sampled waits.
- A later live metric sample still reported four different overdue offenders:
  the Windows compact holder, net-integration compact holder, Windows owner
  wait, and net-integration authority watch leaf.
- The planner initially no-oped the four-offender wake because an app-ops
  blocked-overdue repair was already active.
- That active task did not actually cover the four new offender ids. It covered
  the 37 spec-loop waits.
- After the planner shortcut was made offender-aware, the app reprocessed the
  four-offender wake, refreshed those four exact waits with future review
  windows, and `aks-rp-e2e.process.blocked.overdue-unworked-count` recomputed
  to zero.

Diagnosis:

- "Some active app-ops blocked-overdue work exists" is not enough evidence to
  suppress a metric wake.
- The no-op is valid only when the active/review task covers the current
  trigger's exact offender ids, either through structured `blockedTaskIds` /
  `auditedBlockedTaskIds` / `offenderTaskIds` or an exact matching
  blocked-overdue scope.
- Broad active repair shortcuts are dangerous because they can hide unrelated
  stale waits while making health look "moving".
- The useful division is: code collects exact offender ids and active coverage;
  the agent decides whether the covered lineage is the same work or a separate
  repair family.

Suggested app action:

- Keep `settled-active-noop` optimizations offender-aware for overdue blocked
  metrics. If the trigger names offenders, every live blocked offender should
  be covered by the active/review work before the planner skips owner review.
- Preserve the old fast path only for triggers without exact offender ids.
- When a wake names offenders not covered by active work, run the planner
  owner pass even if the frontier is otherwise active-only.
- Record the exact current offender ids in task context when creating repair
  tasks so future no-op and accept-invariant checks can reason structurally
  instead of by prose.

## Case: exact carrier must be durable while successors are built

Tasks:

- `ops/review-1825-spec-loop-overdue-blocked-frontier-wave-20260713`
- `ops-apply-review-1825-spec-loop-overdue-blocked-frontier-wave-20260713-s`
- `aks-spec-verification-loop`

Observed facts:

- The spec-loop overdue repair tried to use
  `ops/review-1825-spec-loop-overdue-blocked-frontier-wave-20260713` as the
  active exact carrier for 37 overdue spec-loop waits.
- The reviewer correctly rejected later apply attempts when live readback showed
  the carrier was `done`, not active/review, and the apply task still carried
  broad `ops:blocked-overdue:spec-loop` self-suppression.
- A later readback showed the carrier task was not present in the live task
  tree, while the apply task was active and still depended on restoring that
  same reviewed task.
- The app had already created sharper same-lineage review leaves for LocalDNS,
  cluster-autoscaler, private-cluster, and serverless, but the broad carrier was
  still the only thing preventing the 37-wait self-excluded residue from
  returning.

Diagnosis:

- A completed review task is a poor durable coverage carrier. Normal review
  application and parent rollup are allowed to mark it done and archive it.
- Retrying a repair that repeatedly revives a done/review task is fragile. The
  repair can look correct for a moment, then disappear again when the tree
  performs normal cleanup.
- For blocked-frontier stewardship, "exact active coverage" needs a task whose
  purpose is to be the holder, not a prior review leaf that the system is also
  trying to retire.

Suggested app action:

- When a broad overdue review finds residue that still needs exact coverage,
  create or retarget a durable holder task for that coverage instead of relying
  on the completed review task to stay active.
- If the app must temporarily use a review task as a carrier, mark it with
  explicit protection/structured coverage so parent rollup cannot archive it
  until successor holders exist and the self-excluded baseline proves the
  residue is gone.
- Remove broad self-suppression from apply tasks before using them as evidence
  for overdue metric closure; the evidence should come from exact covered wait
  ids on active/review holders.
- Prefer retiring the broad carrier only after same-lineage successor holders
  are live and a self-excluded recompute shows zero or a named smaller residue.

## Case: retry oversized repair as a smaller successor, not the same packet

Tasks:

- `ops/review-1870-rp-lifecycle-nodepool-environment-overblock-repair-20260713`
- `ops/review-1895-rp-lifecycle-nodepool-overblock-repair-slim-20260713`

Observed facts:

- `ops/review-1870-rp-lifecycle-nodepool-environment-overblock-repair-20260713`
  failed before doing domain work because the worker request exceeded the model
  context window.
- The reviewer correctly treated that as a process failure, not as a real
  blocked AKS/environment wait.
- The planner did not blindly retry the same oversized packet. It created
  `ops/review-1895-rp-lifecycle-nodepool-overblock-repair-slim-20260713` with a
  narrower goal: inspect only the visible RP backlog holders and the current
  visibility repair leaves.
- The slim successor was assigned and consumed by the worker, leaving no
  assignment backlog.

Diagnosis:

- "Worker could not fit the packet" means the app should shrink the work shape.
  It is not evidence about the domain blocker.
- Retrying the identical large context would likely repeat the same failure and
  waste the review loop.
- The clean recovery is a same-lineage successor with fewer inputs and a
  concrete decision target.

Suggested app action:

- When a task fails with a context-window/process-size error, create or requeue
  a slim same-lineage successor instead of preserving the same prompt shape.
- The slim task should name the few task ids or holders to inspect and should
  still require one concrete tree move or exact no-op decision.
- Keep the original failed task in review/done history as evidence, but let the
  slim successor own forward progress.

## Case: overdue timing must use the canonical earliest-time rule

Tasks:

- `ops/review-1825-spec-loop-overdue-blocked-frontier-wave-20260713`
- `ops/review-1900-spec-loop-overdue-carrier-restoration-20260713`

Observed facts:

- A worker claimed the original 37 spec-loop waits were no longer overdue
  because fallback windows had moved into the future.
- The reviewer rejected that claim after checking the canonical metric logic:
  overdue uses the earliest finite `next_check_at`, `resume_at`, or
  `fallback_at`, not `fallback_at` alone.
- The sampled waits still had an earliest overdue time through
  `next_check_at`/`resume_at`, so retiring the carrier was unsupported.
- The planner created
  `ops/review-1900-spec-loop-overdue-carrier-restoration-20260713` to restore
  truthful controller-visible coverage while exact successors or refreshed
  windows catch up.

Diagnosis:

- A wait is only non-overdue when every relevant review/resume/fallback timing
  used by the metric has moved out of the overdue window.
- Evidence based on one timestamp field can contradict the metric and should
  not close the task.
- The reviewer was right to distrust the worker's conclusion and force a
  canonical replay.

Suggested app action:

- Any worker claiming an overdue wait is cleared must cite the same time rule
  as `scripts/project-metrics.ts`: earliest finite `next_check_at`,
  `resume_at`, or `fallback_at`.
- Refresh actions should update the full intended timing set, not only
  `fallback_at`, when the goal is to remove overdue pressure.
- Reviewer should continue rejecting overdue-closure claims that do not include
  canonical metric replay evidence or equivalent structured readback.

## Case: do not close the only controller-visible carrier before a replacement exists

Tasks:

- `ops/review-1900-spec-loop-overdue-carrier-restoration-20260713`
- `ops-apply-review-1900-spec-loop-overdue-carrier-restoration-20260713-sta`

Observed facts:

- `ops/review-1900-spec-loop-overdue-carrier-restoration-20260713` proved that
  the historical 37 spec-loop overdue waits were hidden only because that review
  task was still controller-visible.
- A self-excluded replay showed all 37 waits became uncovered again when the
  carrier itself was excluded.
- The reviewer correctly returned `followup`, not `accept`, because closing the
  task would remove the only live coverage for the same overdue residue.
- The planner created
  `ops-apply-review-1900-spec-loop-overdue-carrier-restoration-20260713-sta` to
  preserve or replace the open carrier before final closure.
- The apply task restored `ops/review-1900...` as an active holder with
  `ops:blocked-overdue:spec-loop`, moved the broad scope off the apply task, and
  attached the 37 exact blocked/audited ids to the reopened carrier.

Diagnosis:

- A carrier review is not ordinary done work when its own open state is what
  keeps the metric truthful.
- Closing a carrier and then relying on the closed task's evidence is a process
  gap: closed evidence is useful for history, but it is not controller-visible
  coverage.
- A follow-up apply task is the right shape when the review result is "useful
  evidence, but do not close yet."

Suggested app action:

- Before accepting a carrier review, run or cite a self-excluded coverage check.
- If the self-excluded residue is still nonzero, first create or reopen an
  active/review carrier with exact structured coverage.
- The temporary apply task must not keep the broad conflict scope itself; it
  should move coverage to the durable carrier and then complete for review.

## Case: unpublished generated artifacts need generator plus publish lineage

Task:

- `ops/reconcile-unpublished-knowledge-map-drift-owner-and-publish-path-20260713`

Observed facts:

- The unpublished-change metric found seven modified files under
  `../aks-rp-e2e/model/knowledge-map`.
- The reconciliation traced all seven files to the same generator:
  `ops/review-1880-serverless-standard-metadata-parity-repair-20260713`.
- The changes were one coherent serverless-standard evidence-id/path rename from
  the older 2026-07-10 evidence to the current 2026-07-11 evidence.
- A later metric-alert triage session published the exact seven-file slice as
  commit `e3ca49d86`, pushed it to `origin/dev`, and resampled
  `aks-rp-e2e.process.unpublished-change-count` back to `0`.

Diagnosis:

- Unpublished generated model files are not automatically bad or orphaned.
  They need ownership proof.
- The useful question is: which task generated the files, is the slice coherent,
  and is there a visible commit or discard path?
- The metric did the right fallback job by exposing hidden repo drift, but the
  app should prefer a visible publish path immediately after legitimate
  generator work.

Suggested app action:

- For generated artifacts, record both the generator task/session and the
  publisher commit/session in the close evidence.
- If all changed files belong to one coherent accepted slice, publish only that
  slice and cite the commit hash.
- If ownership cannot be proven, create the smallest exact repair/discard
  follow-up instead of silently leaving local drift.

## Case: review-only overdue findings must turn into apply work

Tasks:

- `ops/review-overdue-jwt-authenticator-shared-owner-return-20260713`
- `ops-apply-review-overdue-jwt-authenticator-shared-owner-return-20260713-`
- `ops/review-overdue-trusted-access-ta-gateway-family-waits-20260713`
- `ops-apply-review-overdue-trusted-access-ta-gateway-family-waits-20260713`
- `ops/review-overdue-spec-loop-localdns-family-waits-20260713`
- `ops-apply-review-overdue-spec-loop-localdns-family-waits-20260713-state-`

Observed facts:

- The overdue-unworked metric first exposed exact stale waits, then the planner
  split them into small review tasks by family.
- The JWT, trusted-access, and LocalDNS workers produced useful evidence and
  correctly identified that the same blocked waits still governed.
- Those workers did not mutate task-tree or loop state. They returned
  planner-ready refresh guidance instead.
- The reviewer rejected those as final closure and returned `followup`: if the
  wait remains true, the app must actually refresh the wait or create a sharper
  successor.
- The planner converted those follow-up reviews into concrete app-ops apply
  tasks.
- The JWT apply task used the supported task-tree refresh path, was accepted,
  and the overdue metric remained at `0`.

Diagnosis:

- This is the healthy split between review and apply. Review-only evidence is
  useful, but it is not enough to close overdue blocked-wait work.
- A worker saying "here is the exact command" still leaves the project stuck
  unless a supported app-state mutation or successor task happens.
- The reviewer/planner pair should keep enforcing this: no stale wait is
  considered handled until the live tree/projection changes or a real successor
  owns the remaining action.

Suggested app action:

- Keep converting review-only overdue findings into app-ops apply tasks with
  exact blocked ids and evidence paths.
- Apply tasks should show before/after readback for the named waits and cite the
  support command or helper used.
- If an apply task cannot safely mutate, it should return a specific blocker or
  escalation; it should not close with another recommendation-only memo.

## Case: metric wake should split overdue waits into applyable waves

Tasks:

- `ops/repair-spec-loop-overdue-owner-return-wave-20260713`
- `ops/repair-spec-loop-overdue-net-private-contract-wave-20260713`
- `ops-apply-repair-spec-loop-overdue-net-private-contract-wave-20260713-st`
- `ops/repair-spec-loop-overdue-environment-frontier-wave-20260713`
- `ops-apply-repair-spec-loop-overdue-environment-frontier-wave-20260713-st`

Observed facts:

- After the owner/artifact repair closed, the live
  `aks-rp-e2e.process.blocked.overdue-unworked-count` metric exposed 21
  overdue blocked waits.
- Emitting a `metric.breach` event for that metric caused the planner to split
  the offenders into three coherent waves: owner-return/source-authority,
  net/private-contract, and environment/frontier.
- The owner-return wave directly refreshed all six named waits and was accepted.
- The net/private-contract and environment/frontier workers produced useful
  evidence packets but did not mutate the live task tree because they believed
  the initial worker dispatch did not explicitly authorize bounded task-tree
  updates.
- The reviewer correctly rejected both memo-only results as final closure. The
  planner created apply successors, those successors refreshed the named waits
  through supported task-tree commands, and reviewer/planner then closed them.
- The metric returned to `0` while active/review/apply work covered the
  offenders, and the final accepted apply tasks proved the live waits had future
  watch windows.

Diagnosis:

- The metric-to-planner path works when the breach is emitted: it can turn a
  large blocked-only frontier into focused family work.
- The remaining friction is worker prompt clarity. A task whose acceptance says
  "refresh or replace these named waits" should be understood as authorizing
  bounded supported task-tree refresh commands for exactly those waits.
- The reviewer/planner fallback is doing the right thing, but it costs an extra
  cycle. The better first pass is for the family repair worker to either apply
  the supported refresh directly or explicitly return why mutation is unsafe.

Suggested app action:

- When planner creates overdue blocked-wait repair waves, include the exact
  affected task ids and make the mutation boundary explicit: supported
  `task-tree refresh-blocked-wait` / `update-text` is allowed only for those ids.
- Keep reviewer enforcement strict: recommendation-only memos do not close
  overdue waits unless another active/review/apply successor already owns the
  runtime mutation.
- Prefer family waves over one giant umbrella. The three-wave split made review,
  apply, and acceptance readable while still handling 21 offenders quickly.

## Case: blocked-only frontier after overdue recovery

Sampled at:

- `bun run health --json` at 2026-07-13T19:23Z.
- `bun run metrics:sample aks-rp-e2e.process.blocked.overdue-unworked-count --json`.
- Representative `task-tree show` / readback of the spec loop, compact loop,
  focus approval holder, LocalDNS compact holder, workload-autoscaler compact
  holder, and the shared auth/artifact family waits.

Observed facts:

- The immediate process metric was healthy:
  `aks-rp-e2e.process.blocked.overdue-unworked-count = 0`.
- The task frontier had no runnable, active, review, or waiting leaves.
- The remaining visible leaves were blocked waits:
  69 under the spec loop, 51 compact-loop blocked feature holders, and several
  project-level approval/environment holders.
- The feature-reference loop was complete: 305 done, 0 pending/running/error.
- The spec loop still had 486 passing specs and 178 pending specs, but zero
  dispatchable pending work because all remaining pending work was represented
  by exact blocked holders.
- The compact loop still had 33 done features and 51 blocked compact holders.
- Representative blocked holders had structured wait contracts:
  `waiting_for`, owner, observer, resume condition, next check, and fallback.
- Several project-level owner/artifact waits are scheduled for the next review
  or fallback at 2026-07-13T20:40:00Z; none were overdue at the 19:23Z sample.

Diagnosis:

- This is a parked but not currently abandoned state. The app should not invent
  domain work just because the frontier is blocked-only.
- A blocked-only frontier is still risky if every holder waits for humans or
  external signals, but the correct next move depends on the holder:
  approval waits need a returned decision or resend at fallback; environment
  waits need refreshed environment evidence; frontier waits need source/runtime
  change evidence; artifact waits need exact artifact/result recovery.
- The app handled the previous overdue wave correctly: metric breach produced
  focused review waves, reviewer rejected memo-only closures, planner created
  apply follow-ups, and supported task-tree refreshes moved the overdue metric
  back to zero.
- The next useful pressure point is not a blind rerun. It is the next scheduled
  review/fallback window for the exact wait families, especially the 20:40Z
  owner/artifact and ADO artifact-result group.

Suggested app action:

- Keep the current waits parked until their named signal or review window lands.
- At each review/fallback window, create small family-scoped app-ops work:
  refresh, replace, unblock, or escalate the exact holders; do not reopen broad
  unchanged live runs.
- For approval/artifact waits, the worker must collect current facts itself:
  check event returns, message/approval ledger, artifact/result availability,
  and current task-tree state before deciding whether to resend, escalate, or
  keep the wait.
- Parent loop controllers should report that execution is drained by exact wait
  stewardship, but they should not be treated as the real blockers. The real
  blockers are the child wait leaves.

Workflow lesson:

- "No runnable work" is not automatically a bug. It becomes a bug when the
  blocked waits are overdue, missing observer/fallback metadata, or unsupported
  by an active/review/apply carrier when a metric says action is required.
- The useful systemic pattern is:
  metric or schedule catches a due blocked wait -> planner creates a focused
  family review -> worker gathers hot facts -> reviewer judges the claim ->
  planner applies a concrete live-state change or preserves an exact wait with
  fresh evidence.

## Case: exact owner/artifact handoff after memo-only recovery

Tasks:

- `ops/recover-secops-fips-authenticated-artifact-visibility-family-20260713`
- `ops/send-secops-fips-github-auth-artifact-recovery-handoff-20260713`
- `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`

Observed facts:

- The recovery worker found useful current facts for runs `28618650515` and
  `28621344506`: no local app-visible bundles, no `gh` helper, and `GH_TOKEN`
  returned `401 Bad credentials` for run/artifact/log API requests.
- The reviewer correctly returned follow-up because the first worker produced
  a memo but did not update or replace the live wait.
- The planner/app-ops follow-up then routed an exact owner handoff to
  `human:operator`, wrote durable evidence, and rebound the live wait to
  `project.approval.submitted` for the same lineage.
- Reviewer accepted only after live task-tree readback showed the wait had
  updated outputs, future watch metadata, and the exact approval-return
  metadata.

Diagnosis:

- This is the desired shape for blocked task recovery. The first result was
  valuable but not sufficient; the project only moved after the live wait was
  updated and the human-return path existed.
- The app should preserve this distinction. A memo can explain the answer, but
  the task is not handled until the state tree has a concrete next carrier.

Suggested app action:

- For every artifact/approval recovery task, require before/after live readback
  of the exact wait.
- If a worker cannot mutate state, it must return an exact follow-up ask with
  task id, wait lineage, evidence path, and requested owner signal.
- Reviewer should continue rejecting memo-only closure for blocked waits that
  still need a handoff, refresh, replacement, or escalation.

Workflow lesson:

- "Agent decides, code applies supported mutation" works when the decision is
  visible in task-tree state. It fails when the decision remains only in prose.

## Case: due approval-return wait refreshed after hot event check

Task:

- `wait-compact-managedsystem-cli-default-payload-owner-decision-return-20260711`

Observed facts:

- At 2026-07-13T19:31Z, the wait had reached its `next_check_at` /
  `resume_at` window of `2026-07-13T19:30:00Z`.
- A local metric recompute returned:
  `aks-rp-e2e.process.blocked.overdue-unworked-count = 1` with this task as
  the only offender.
- The task was an already-sent approval-return wait for
  `path.managedsystem.cli-create-default-payload`, with stable `approvalId`,
  `waitId`, `pathId`, and send-proof evidence.
- The app planner processed a focused planning wake asynchronously. The HTTP
  event API returned `workflowStarted: false`, but the later planner run still
  handled the wake.
- The planner collected hot facts before deciding:
  no matching `project.approval.submitted` event existed for the exact
  approvalId, waitId, or pathId.
- The app refreshed the same exact wait in place, preserved the same
  approval-return lineage, advanced the review/fallback window to
  `2026-07-14T19:30:00Z`, and did not reopen any unchanged compact rerun.
- A fresh metric sample returned the overdue-unworked metric to `0`.

Diagnosis:

- This is the desired behavior for an approval-return wait whose check window
  matures: verify current returned-decision evidence first, then either apply
  the returned decision or refresh/escalate the same exact wait.
- The right fix was not a new compact run. The blocker was missing owner return
  for an already-sent adjacent CLI default-payload decision.
- The API response field `workflowStarted: false` is not enough to conclude the
  event was ignored. The reliable evidence is planner-run/journal movement and
  the live task-tree/metric result.

Suggested app action:

- For due approval-return waits, planner/app-ops should always check current
  event/message/approval state using the exact lineage identifiers before
  deciding.
- If no return exists, refresh or escalate the same lineage with a future
  review/fallback. Do not create a duplicate send-required holder unless the
  send proof is missing or invalid.
- When manually nudging the app, prefer a narrow `project.planning.requested`
  or metric breach containing the exact offender ids. Then verify via
  planner-runs, journal, task-tree readback, and metric recompute.

Workflow lesson:

- A metric breach is a good way to make overdue wait debt explicit, but the
  planner should still decide from hot facts. In this case it did: no approval
  return was visible, so the correct outcome was a same-lineage refresh.

## Follow-up: dangling compact holder mapping needs applied repair

Tasks:

- `ops/audit-live-blockers-for-archived-active-lineage-20260713`
- `ops/reconcile-virtualmachines-agentpool-live-holder-mapping-20260713`
- `ops-apply-reconcile-virtualmachines-agentpool-live-holder-mapping-202607`
- `hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b`

Observed facts:

- The archived-lineage audit repaired seven stale blocked-frontier references
  and left one exact offender: the VirtualMachines agentpool maintained compact
  holder still cited three holder ids that were not live tasks.
- The first reconciliation task collected the right facts and proved the
  mapping was dangling, but returned only a planner-ready memo.
- The reviewer correctly returned `followup` instead of accepting the memo as
  closure because the live holder mapping was still untruthful.
- Planner created the apply successor
  `ops-apply-reconcile-virtualmachines-agentpool-live-holder-mapping-202607`.
- The apply worker restored the three missing exact compact holders, resynced
  the maintained holder, updated `.state/feature-compact-loop/state.json`, and
  wrote the apply evidence memo.
- Reviewer accepted only after live readback showed the restored holder ids
  existed, the maintained holder mapped all represented members to live holders,
  and feature-compact-loop state had no missing frontier/task references.

Diagnosis:

- This was not a live AKS rerun problem. It was a process/state-integrity
  problem: compact state claimed exact downstream owners that no longer existed
  in the live task tree.
- The important boundary held: the agent judged the meaning from evidence, and
  code/app mechanisms applied supported task-tree and loop-state mutations.
- The project should not close a "reconcile" task just because it describes the
  fix. It should close only after a concrete apply task leaves the live state
  truthful or creates an exact successor.

Suggested app action:

- Keep rejecting memo-only closure when a blocked holder still points at
  nonexistent current tasks.
- For compact maintained holders, reviewer should verify both sides before
  accepting: task-tree holders exist, and feature-compact-loop state points only
  at live holder ids.
- When a repair restores exact holders, preserve the maintained holder instead
  of reopening broad compact reruns if the represented member meanings are
  already known.

Workflow lesson:

- A compact holder is only useful if its represented members point to live
  current holders. If the mapping is dangling, the next move is an app-state
  repair or truthful reduction, not a new pipeline run and not a memo-only
  closure.

## Follow-up: self-referential blocked holders need a real governing wait

Tasks:

- `domain/hold-rp-nodepool-lifecycle-execute-ready-promotion-visible-backlog-20260713`
- `domain/hold-rp-nodepool-lifecycle-ready-subset-pass-sync-visible-backlog-20260713`
- `domain/hold-rp-nodepool-lifecycle-execute-ready-promotion-visible-backlog-20260713b`
- `domain/hold-rp-nodepool-lifecycle-ready-subset-pass-sync-visible-backlog-20260713b`
- `ops/wait-project-approval-owner-return-primary-blocker-20260713`

Observed facts:

- The planner found two project-level RP nodepool backlog holders whose blocker
  lineage effectively pointed back to themselves instead of to the real
  governing wait.
- The app replaced both holders with `20260713b` versions and marked the older
  holders `done` with resolution `replaced`.
- The replacement holders now point at the single governing project-level
  owner-return wait, `ops/wait-project-approval-owner-return-primary-blocker-20260713`.
- No pipeline rerun was started. This was a task-tree lineage repair, not a
  product/test execution change.

Diagnosis:

- A blocked holder must say what external condition or owner-return signal can
  wake it. If it points back to itself, nothing can make progress: the task is
  "waiting because it is waiting."
- The correct fix is to retarget or replace the holder so it names the true
  upstream wait. Keeping the old holder blocked only preserves a dead end.

Suggested app action:

- Treat self-referential blocker lineage as process debt. The planner/app-ops
  path should replace or retarget it to a concrete governing wait.
- Prefer a narrow replacement holder with the same domain meaning and corrected
  blocker contract over broad replanning or live reruns.

Workflow lesson:

- Blocked is only useful when it carries a real wake condition. If the wake
  condition is self-referential, the app should repair the blocked contract
  before asking domain workflows to do more work.
