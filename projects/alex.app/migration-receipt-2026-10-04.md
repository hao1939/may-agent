# Alex improvement migration receipt — 2026-10-04

> **Historical detail.** The migration handover is now complete. The concise
> current verdict, derived disposition counts, separate pending-input accounting
> and independently owned continuing work are in
> [`migration-handover-current-2026-10-04.json`](./migration-handover-current-2026-10-04.json).
> Retired/withdrawn-unfulfilled is not fulfilled. The chronology below is retained
> as evidence and may describe work that was pending when an earlier section was
> written.

Status at initial activation: **team source activated; legacy continuation remained open**. Final reviewed candidate `677c785f89c5a2854eda2d2533f35fa5ee4dcc31` is an ancestor of Apps main `06f9c03922f523524d89341a88f783c2f373cfdf`. Source-fenced reload `alex-team-06f9c03922-20261004` completed successfully in event `6643042`; receipts: `/app/.state/alex-migration-20261004/team-activation-result.json` and `team-activation-admission.json`. Source baseline: Apps commit `64b901d1e4c95a385c4f1d633bbbbe9a99d6f367`. Host deployment receipt: `/app/projects/may-agent/.state/deploy-receipts/main-fc3b9cab3-alex-20261004.json`.

## Bounded inventory and disposition

A corrected read-only `app_tasks` inventory (2026-10-04) excludes terminal phase `converged` and rows present in `app_task_cancellations` by `(app_id, task_id)`. Counts are retained resource state, not a count of new assignments.

| App | Uncancelled nonconverged resources | Disposition |
|---|---:|---|
| `evaluation` | 0 | No old Task resource requires replacement. Useful task-outcome review implementation, report store, metric review implementation, evaluator profiles and tests are copied under Alex; new selected reviews target Alex. |
| `gym` | 0 | No old Task resource requires replacement. Frozen candidate comparison workflow/profile is copied to Alex and exposed by `compare-candidate`. |
| `may-agent` | 117: 24 attention, 42 pending, 51 waiting | Retained Host-maintenance resources require bounded semantic disposition; they are not bulk-copied or claimed fulfilled. New improvement ownership belongs to Alex, while May remains escalation/human priority. |
| `may` | 13: 1 pending, 12 waiting | May remains enabled and continues its own human/caller obligations. They are not moved merely because Alex owns system improvement. |

A prior query incorrectly used `phase != 'done'`; terminal resources use `converged`, so that query counted history. The corrected SQL was verified against runtime state with the cancellation anti-join. Existing caller/creator/wait relationships remain retained; no database mutation or false fulfillment was performed.

### Pending inbox frontier

Pending inbox obligations are distinct from nonconverged Task resources and remain to be dispositioned from bounded per-App reads:

- Evaluation: 106 `automatic-review` inputs in handling state. These are old controller triggers, not 106 independently requested improvements; preserve history and supersede/settle them through an evidenced cutover disposition rather than recreate them.
- may-agent: 43 `owner-review` inputs in handling state, 1 `owner-review` pending input, 8 `runtime-capability-request` inputs in handling state, and 1 `contain-external-and-replayed-workspace-writer` pending input. Read their exact source outcomes and caller/wait relationships before deciding replacement; do not infer fulfillment from controller disablement.

Use bounded per-App reads of `resource_json.spec.outcome` and inbox identity on continuation. Do not use a single globally sorted 100-row sample, which can hide another App's frontier.

The exact 117-resource frontier now has a bounded semantic triage artifact at
`projects/alex.app/legacy-frontier-disposition-2026-10-04.json`. It is pinned to
SHA-256 `46d61e762a8abac6170b4333c7aac30af2661afabe7fe635294a17318ea1cde9`
of the operator index and SHA-256
`bd3f6a1cc65e125c61f5a8380cba746d55e3d8143edc6f8d6825af286d5d7f97`
of the full retained snapshot. The artifact preserves every old Task identity,
phase, ownership, outcome and exact Condition IDs, and records a proposed
boundary and next decision without inventing replacement IDs. It identifies 39
entries in known overlapping lineages for consolidation after a current-state
check, 35 other improvement obligations needing current-evidence review, and 6
obligations that retain May's human-authority/human-commitment boundary. The 37
formerly opaque Host Operations shells are now tied to their exact retained
source inputs: 17 periodic digests, 10 ops-health transitions, 6 project-health
findings and 4 session findings. These controller wakes are evidence for current
canonical lineages, not 37 one-for-one replacement improvements. Four explicit
human-decision findings distinguish Alex's reconciliation ownership from May's
decision authority. Bob independently checked all 37 source mappings in live
post-activation session `s_1791117886758_34005740-6d3f-4236-90c4-21abdd9139fe`;
its two precision findings (noisy metric identities and decision-authority
wording) are corrected in the artifact. `replacement: null` remains deliberate:
no Task is marked fulfilled, superseded, rebound or replaced until its current
evidence and relationships have been checked and an exact continuation or
evidenced no-longer-useful disposition is admitted.

## Candidate source mapping

- Alex owner: `projects/alex.app/agents/alex`.
- Bob and tech-lead specialist implementations: `projects/alex.app/agents/bob` and `agents/tech-lead`.
- Independent evaluator implementations and criteria: `agents/evaluator`, `agents/evaluator-deepseek`, `agents/judge`, and `criteria`.
- Gym comparison: `agents/gym/workflows/compare-candidate.ts`.
- Scout adoption route: `scout.research.qualified` now targets App/project `alex`; the weekly latest-slot archive review is owned by Alex's plain `bob` specialist rather than missing `may-bob`. Weekly deliveries reuse stable Task `research-adoption` with an exact fixed contract, preserving its cursor, accepted evidence, and unfinished work; a changed explicit requirement must use a distinct targeted goal rather than silently revising the standing Task.
- Review routing: production `evaluation.task.review.requested` emissions target Alex; Alex subscribes and creates plain Alex-local `evaluator` or `evaluator-deepseek` work. Event names remain retained vocabulary, not an enabled-App dependency.
- Improvement intake: ordinary immutable `evaluation.task_report_published` and `evaluation.metric_report_published` publications are subscribed by Alex, validated for required identity and hashes, and admitted as ordinary Alex work. May no longer subscribes to either publication, preventing duplicate repair commissioning.
- Independent oversight: May retains metrics over Alex attempts, admissions and unfinished reviews, plus its bounded `evaluation-operation-oversight` breach consumer; this route does not depend on Alex report intake succeeding.
- Root identity: all new Alex attachments use `parentId: "root"`, matching the already-bootstrapped live resource store.

## Checks and open work

The earlier red expanded run is retained as discovery evidence, not the current result. Direct mapper tests establish input construction; they did not establish declared event dispatch in commit `d4e5db883b`. Operator review therefore blocked activation. The successor source adds project-filtered selected-review, metric-review, and review-failure subscriptions and restores the explicit-flag-gated selector schedule plus transition-driven metric/task selection. Hao's correction requires plain Alex-local specialist names (`bob`, `tech-lead`, `evaluator`, `evaluator-deepseek`, `gym`, `judge`), removal of May's duplicate specialist definitions, and App-boundary routing rather than direct May calls to Alex-local workers. Those guarded identity/guidance edits are assigned on revised May dependency `appdep_44d8d692bfcbc967b25dbba8`; no registry or activation claim is made until they are incorporated and tested. After localizing the copied fixtures and executable paths, the command

`bun test ./projects/alex.app/app.test.ts ./projects/alex.app/agents/evaluator/workflows/*.test.ts ./projects/alex.app/agents/evaluator/workflows/lib/*.test.ts ./projects/may.app/agents/may/workflows/improvement-activation-follow-up.test.ts`

passes **231/231**. The focused May/selector/Alex admission run passes **57/57**, and the copied task-outcome review suite passes **26/26**. Alex now admits qualified Scout findings, selected task reviews, metric reviews and automatic-review failures; May's verified-activation follow-up dependency and its retained wait/result correlation use App `alex`; exact selector reconciliation uses the Alex runtime identity; copied evaluator tests use Alex-local admission rather than the disabled App.

The selector no longer excludes the entire Alex App. Ordinary Alex-authored work remains reviewable, while canonical plain evaluator worker identities (`evaluator`, `evaluator-deepseek`, and `judge`) remain ineligible as independent subjects, preventing recursive self-review. Alex guidance now says to use the actual Host allowance and finish warning rather than inventing a turn quota; checkpointing is recovery, not a reason to yield.

The committed successor history through `88ad627dc2ee313c9e05777110650195a1c44805` contains the stable weekly identity and moved develop-change execution coverage, the 117-resource semantic triage, the migrated Evaluation-to-Alex routing fixture, and isolation of that fixture's report assertions from unrelated automatic selection. The operator's 27-file run reports **314 passed / 0 failed** and `check:may-design` passes with one pre-existing reports-layout warning. A fresh focused run of `bun test ./projects/alex.app/evaluation-routing.test.ts` at the exact candidate passes **1/1** (26 expectations). Registry inspection with automatic review enabled reports exactly the three intended Apps, nine unique plain agent identities and all eight inspected workflow paths.

## Activation and live continuation evidence

Runtime reload event `6643042` records `ok=true`, source commit `06f9c03922f523524d89341a88f783c2f373cfdf`, six new plain specialists (`judge`, `bob`, `gym`, `evaluator-deepseek`, `tech-lead`, `evaluator`), three updated agents (`scout`, `alex`, `may`), exactly three Task-enabled Apps and three durable App addresses. The current definitions symlink resolves to that commit's `definitions-v4` snapshot. Local disable markers exist for `evaluation.app`, `gym.app`, `may-agent.app` and `sample.app`; May, Alex and Scout remain enabled. Runtime agent discovery returns only Alex plus the six plain Alex specialists, with no legacy `may-bob`, `may-tech-lead` or prefixed duplicate.

Live continuation is demonstrated in two ways. Automatic selection created and completed Alex Task `runtime/metric-review/evaluator-deepseek/d6940234d6861a102fc1e65a`, returning a source-backed metric disposition to its ordinary Alex parent work. For this migration itself, activated plain `bob` completed bounded independent review session `s_1791117886758_34005740-6d3f-4236-90c4-21abdd9139fe`; Alex incorporated both concrete precision findings into the frontier artifact. These are contributions and returned evidence, not fulfillment of unrelated legacy outcomes.

One newly observed limitation is not a duplicate loaded worker: HTTP `GET /api/agents` has a separate unfiltered filesystem scan and can show stale metadata from disabled App directories. Activated source and Bob's `/about` resolve the correct Alex profile. Follow-up belongs in Host `src/app/http/server.ts`, which should reuse enabled runtime discovery; this migration does not rewrite Host source in the Apps worktree.

## First semantic continuations after activation

Activated plain Bob independently reviewed all 117 entries in session `s_1791118120085_b4762675-5ca7-43d8-8247-ff22139104e4`. That review found two concrete grouping errors now corrected in the frontier: the two missing-230-file archive obligations require a May/provider decision rather than writer containment, while `app-request/appdep_acc6f5a5a4cb4fe00ca2f025` is exact writer attribution/containment rather than aggregate unhandled-signal review.

Four old Gym public-projection/recompute paths are now mapped as **execution-path superseded, outcome not fulfilled** to current May Task `goal/appdep_c1890444e02436f8d2131ffd` and human Condition `gym-valid-run-rate-retirement-reconcile-7cf298dd9dd55942`. Current evidence shows the metric is retired with stale `current=0.76`, zero snapshots and all 34 alerts resolved. That makes the old projection/recompute repair inappropriate; it does not prove recovery or discard retained Gym/Evaluation evidence. The other Gym comparison, request-correlation and cancelled-run obligations remain separate and unresolved.

The first exact replacement continuation was admitted to Alex as request `appdep_b2210accc9bfd6faf68121e1`, with Condition `app-request:appdep_b2210accc9bfd6faf68121e1`. It reconciles exactly three old writer-containment identities and must distinguish obsolete path from fulfilled outcome while preserving old callers and waits. Independent frontier review was separately admitted as Alex evaluator request `appdep_fd5798c6edc4d09905205c70`. Two earlier requests (`appdep_8bb3d085316ebee15b7b4e9f`, `appdep_d2d4d520386f92b2eecdf0c9`) were mechanically rejected because they incorrectly targeted nonexistent exact Tasks; their corrected ordinary admissions are recorded rather than hidden or replayed.

Hao separately authorized retirement of old App source while preserving useful knowledge. The operator owns that isolated source cleanup; this worktree intentionally did not perform a competing move, merge or reload. Source removal does not fulfill or delete any retained obligation.

Remaining before migration completion: incorporate returned writer-containment and independent-review evidence, continue exact current-state decisions/admissions for the remaining frontier, preserve May/provider/human authority boundaries, and integrate the operator's separately reviewed source-relocation receipt. This receipt intentionally does not claim the semantic migration is complete.

## Returned writer-containment reconciliation

Alex continuation `input/appdep_b2210accc9bfd6faf68121e1` returned a terminal reconciliation for exactly the three mapped workspace-writer identities. Its durable decision artifact is `projects/alex.app/workspace-writer-containment-reconciliation-2026-10-04.json` (SHA-256 `44ae7ea043ec50172e887101d9f4aa30521c5e98e8943dc55d61952a46ec5125`). Current evidence found no active incident recurrence and the incident-specific execution path is obsolete. The receipt therefore marks the three paths **superseded with no current continuation, but not fulfilled**: terminal May/AKS results, the required 180-second artifact, dependency wake and lineage-specific metric proof were never established. Exact callers, historical requests and old Conditions remain recorded; no disabled Task state was mutated and no replacement is admitted unless fresh current writer/process/event evidence appears.

Independent evaluator review `input/appdep_fd5798c6edc4d09905205c70` verified all 117 pinned identities and found no proved legacy fulfillment. Its correction is incorporated: the four Gym mappings now supersede only retired `gym.valid-run-rate` recomputation, while each distinct public projection/workflow remainder stays open. Old Condition `hao-approval-gym-public-health-candidate-v10` is separately preserved and is not replaced by the current retired-metric decision Condition.

## App-dependency completion lineage reconciliation

Activated plain Bob independently reconciled the two old `app-dependency-completion` Tasks in session `s_1791118630636_28b1f3f6-e73f-4965-b058-75449941ee45`. The accepted durable decision artifact is `projects/alex.app/app-dependency-completion-reconciliation-2026-10-04.json` (SHA-256 `16faabcd0bf1afb4a049ae515a9156a95954c006692188893ca84fb5e6b3b1ed`). Current Host source no longer implements the old `app.dependency.completed` / `app-inbox:wake` path, and the frozen candidate `6d2e57b40d93553d529bd606f2021d9fde24b216` is not an ancestor of deployed Host main. The two old execution paths are therefore obsolete, but neither requested outcome is proved fulfilled.

The activation child's exact human-authority boundary is now dispositioned by May as an obsolete request withdrawn unfulfilled. Condition `hao-runtime-candidate-6d2e57b-activation-decision` remains historical evidence, the May creator/caller chain remains preserved, and exact approval, staged activation, dual-terminal-lineage, negative-control and metric evidence remain absent. Alex verified the useful modern technical remainder under the current saved-answer / `app.dependency.updated` protocol; that verification does not reconstruct or fulfill either historical live-proof outcome. One modern correlated Alex return remains supporting evidence only.

Alex submitted exact May request `appdep_1c07f1557f0d0d7f27a678c5` with Condition `app-request:appdep_1c07f1557f0d0d7f27a678c5` for disposition of the obsolete old-candidate approval boundary. May converged it as `withdraw-obsolete-exact-candidate-request-unfulfilled`: no surviving human action is required, the old Condition remains historical evidence rather than approval or rejection, the caller chain is preserved, and no disabled legacy state was mutated. Alex separately verified the current deployed protocol with `input-result.test.ts` and `app-task-runtime.test.ts`: **209/209 passed** with 2,476 expectations, covering exact saved result/owner/caller correlation, lost notification, restart/replay, duplicate and stale result rejection, failed/invalid result visibility, and Condition preservation/recovery. These checks validate the modern remainder but do not fulfill the two historical AKS/May live-proof outcomes.

## Dependency-authority lineage reconciliation

Activated plain Bob reconciled exactly the two old `dependency-authority` Tasks in session `s_1791119267001_a5aa55d8-b287-4c47-aadf-7e8ba318f2d5`. The durable contribution is `projects/alex.app/dependency-authority-reconciliation-2026-10-04.json` (SHA-256 `6a9c15a12e9bebc759a616fbfa0127e09e3f2a4448e42732f3eac6a5ec63408b`). It preserves both complete retained specs, the activation-child → repair-parent → `runtime/platform-owner-review` return chain, original AKS request/events, and exact unknown Condition `approval-dependency-authority-contract-20260820-dc15a38b`.

Neither historical outcome is fulfilled. The incident-specific AKS consumer and old owner tree are absent from the enabled three-App installation, while current request/return and authority-scoping fixtures pass; no current defect warrants resurrecting a fixed generation-154 request. The frozen artifact is also unsafe to activate as scoped: its supposedly dependency-authority-only App patch includes a separate `installed-app-resolver-observation` consumer contract. Host verification passed **251/251** with 2,685 expectations and current May/Alex App verification passed **31/31** with 163 expectations. These deterministic checks support the no-new-technical-continuation decision but do not reconstruct the missing May/AKS terminal results or metric proof.

The frontier now records both paths as obsolete candidates awaiting May's exact authority/caller disposition, unfulfilled. Alex must reuse an existing matching May request if one exists or submit one bounded disposition request; May decides whether the obsolete fingerprint `dc15a38b…` ask is withdrawn unfulfilled or whether a precise surviving human/caller obligation remains. No old Condition is rebound, satisfied, or treated as approval/rejection.

## Retired source integration

The operator's separately reviewed source retirement is integrated in Apps main `b924e240dadd1c5d9042cd0f5d0c5b235ae35aee` (retirement commit `83475307bffffc269789508a4bbb7ac0a910a592`) and this branch merges that main revision. Reload `alex-retirement-b924e240da-20261004` succeeded in event `6643341`, reporting nine intended updated agents, exactly three Task-enabled Apps and three durable App addresses; readiness is healthy. The affected suite reports **418 passed / 0 failed**, design and registry/workflow checks pass, and the immutable release invoked both relocated shared skills without diagnostics.

Useful manuals and skills now live under `projects/alex.app/docs`, historical specialist knowledge under `projects/alex.app/knowledge`, criteria under `projects/alex.app/criteria`, and retired source/evidence under `projects/alex.app/archive/retired-apps`. The local preservation receipt records 22,264 entries with matching hashes and compatibility aliases for saved artifact references. Do not delete those aliases or archives. Old may-agent, Evaluation and Gym executable manifests/profiles are removed; eleven retired Evaluation metrics are declared by Alex and retired in live storage. This cleanup did not delete or fulfill any legacy Task, input or Condition. Exact operator evidence is in `/app/.state/alex-migration-20261004/retirement-summary.json`, `retirement-local-preservation.json`, `retirement-source-map.json`, and `retirement-activation-result.json`. The remaining API scan of disabled `sample-reviewer` is the already-recorded filesystem projection limitation, not a loaded old controller.

## Returned dependency-authority disposition

May Task `goal/appdep_6cc0d62a8a22a1ca0cb4d1e8` returned the exact
`withdraw-obsolete-activation-ask-unfulfilled` disposition. May neither approved
nor rejected the frozen `dc15a38b…` manifest. Condition
`approval-dependency-authority-contract-20260820-dc15a38b` remains historical
state unknown, the activation-child → repair-parent →
`runtime/platform-owner-review` chain remains preserved, and the missing
May/AKS terminal results and scoped remeasurement remain unproved. The
immutable patch's unrelated `installed-app-resolver-observation` behavior still
makes it unsafe to activate. May found no surviving precise current caller
obligation; reopen only from an exact failing public-protocol trace supplied by
an enabled App. May's structured result artifact is
`artifacts/dependency-authority-may-disposition-2026-10-04.json` (SHA-256
`db81afbe1e4cb28a4da877ad3c6eb8b9f4ad3a203e666195e81c0499864ec019`).
No old Task, Condition or runtime state was mutated.

## Owner-review contract lineage reconciliation

Activated plain Bob reconciled the two old `owner-review-contract` Tasks in
session `s_1791119677933_304bf703-3466-4ffa-8838-123800717094`. The bounded
contribution is `projects/alex.app/owner-review-contract-reconciliation-2026-10-04.json`
(SHA-256 `e9bed7fcd5753d94e4e5643d88b47e2ab75a27ea3dd60a2f7a2f48660808d614`).
It preserves both complete retained specs, caller chains, historical Condition
`approve-owner-signal-boundary-62890907`, and the easily missed unresolved stop
`resume-grouped-goal-repair-after-stop`, which is absent from the final Task's
condition ID array but present in retained Condition and parent/child evidence.

Neither historical outcome is fulfilled. Frozen Host candidate `62890907…` is
not an ancestor of deployed Host `d8c877577…`, uses obsolete
`app.dependency.completed` receipts and has no recovered approval or live
terminal proof. Current Task communication has exact receipt and replay
behavior, but that does not establish the old requested terminal signal counts
or finding-versus-remediation proof. No current recurrence warrants reviving the
old controller, a global message suppression heuristic or the frozen candidate.

A current semantic question remains narrower than the old blanket grouping
rule: Alex's ordinary report mapper creates distinct input Tasks for distinct
admissions, but the agreed design permits intake Tasks with independent
assessment outcomes. One bounded Alex continuation must exercise actual Host
admission for repeated concern, replay, new evidence and an independent outcome,
then either retain a linked no-change decision or correct only a demonstrated
App-local reuse defect. Separately, May must disposition the obsolete exact
activation ask and the stopped grouped-goal historical candidate; neither old
Condition is rebound or settled. Bob's current deterministic checks passed
**230/230** Host tests with 2,588 expectations and **31/31** Alex/May tests with
163 expectations.

The bounded current investigation is admitted as Alex request
`appdep_34a3e05d87955f537e05b372` with Condition
`app-request:appdep_34a3e05d87955f537e05b372`. The two historical authority
boundaries are submitted together to May as request
`appdep_bc9a845ad126f8632071584a` with Condition
`app-request:appdep_bc9a845ad126f8632071584a`. These are separate outcomes:
the current investigation does not authorize resuming either historical
candidate, and May's disposition does not pre-decide current Alex intake design.

## Returned owner-review contract decisions

Current Alex investigation `input/appdep_34a3e05d87955f537e05b372` exercised actual Host admission rather than only the report mapper. Its accepted `no-change-linked-reuse` decision is commit `9009a1d57a6fc3ef1d6530c6ec7232ea5bf70a28`: two immutable publications for one material concern plus a third new-evidence publication remained distinct assessment Tasks, persisted replay created no extra input or execution, all three returned explicit links to the same consequential improvement, and an independent metric publication retained a separate outcome. Focused verification passed **12/12** with 136 expectations, four local Task executions and zero provider calls. Reopen only for demonstrated duplicate consequential commissioning, immutable publication loss/collapse, or wrongful merging of an independent outcome; prose similarity alone is not evidence.

May Task `goal/appdep_bc9a845ad126f8632071584a` separately returned both historical authority decisions. Frozen candidate `62890907…` is withdrawn obsolete/unfulfilled, and the stopped grouped-goal candidate is withdrawn historical/unfulfilled. Neither disposition is approval, rejection or legacy fulfillment. Conditions `approve-owner-signal-boundary-62890907` and `resume-grouped-goal-repair-after-stop` remain unknown historical evidence; both caller chains, the cleanup caller and all missing historical terminal/live proof remain preserved. May's structured artifact is `artifacts/owner-review-contract-may-disposition-2026-10-04.json` (SHA-256 `5ab3a9836c17bb38b65f5161dd6d9953c2440208f9c6b3170b4f479294422483`). No runtime, disabled Task or Condition was mutated.

## AKS taxonomy/correlation lineage reconciliation

Activated plain Bob reconciled exactly the seven frontier entries tagged `aks-taxonomy-and-correlation` in session `s_1791120090535_35c29aff-0fb0-4eab-abce-f3f87b6ec909`. The durable contribution is `projects/alex.app/aks-taxonomy-correlation-reconciliation-2026-10-04.json` (SHA-256 `b38fa79f00a0fc8902ef6dbe2949375ba2c1e38e74f3f7828fc427b31f835f56`). It preserves all seven complete retained specs, four Conditions, eight direct relationships, the bridge and parent/downstream chains, recovered c6636d34 activation receipt, requested 3bf56cf5 release, stopped f9824eb7 assessment, and every missing terminal link.

All seven incident-specific execution paths are obsolete in the enabled three-App organization, but none of their requested outcomes is proved fulfilled. The old candidates are not ancestors of deployed Host main; one c6636d34 activation receipt is recovered, while the problem-task terminal links, complete six-pair proof, staged 3bf56cf5 activation/caller closure, and f9824eb7 approval/terminal evidence remain missing. Current source verification found no precise enabled-App defect requiring another Alex technical continuation: Host saved-result/App Task/event-delivery checks passed **253/253** with 2,584 expectations, selector/metric-source checks passed **34/34** with 118 expectations, and current Alex/May App checks passed **31/31** with 163 expectations. These checks support technical supersession only; they do not reconstruct old live proof.

No existing current May Task matching AKS taxonomy, f9824eb7 or 3bf56cf5 was found. One bounded May authority/caller disposition was therefore admitted as `goal/appdep_b9d63909a838fa7ad225d6b6`, retained by Condition `app-request:appdep_b9d63909a838fa7ad225d6b6`. May must decide withdrawal-unfulfilled versus a precise surviving obligation without activating retired candidates, restoring devbox solely for retired Apps, replaying requests, mutating Conditions or escalating to Hao absent an exact current human decision need.

## Returned AKS authority disposition and unhandled-signal reconciliation

May Task `goal/appdep_b9d63909a838fa7ad225d6b6` withdrew all seven retired
AKS taxonomy/correlation outcomes as **unfulfilled**. The exact four historical
Conditions remain unknown, eight parent relationships and the bridge/downstream
lineage remain preserved, and the successful `c6636d34` receipt remains partial
proof only. The obsolete `f9824eb7` approval ask and requested `3bf56cf5`
release are neither approvals nor rejections and require no current Hao action.
No devbox restoration, request replay, carrier reopening, deployment, disabled
Task mutation, or Condition settlement occurred. Reopen only for a fresh
enabled-App falsifier, recovered exact terminal artifact, or explicit current
obligation.

Activated plain Bob next reconciled exactly the ten frontier entries tagged
`unhandled-signal-owner-review` in session
`s_1791120573892_e0465843-5d88-4e54-8260-8da464cf8377`. The durable artifact is
`projects/alex.app/unhandled-signal-owner-review-reconciliation-2026-10-04.json`
(SHA-256 `006ab98f3f398e5210e6fb7200c204ef197a8a818e736e31c65628de49eeed3b`).
All ten historical execution paths are obsolete, but none of their outcomes is
proved fulfilled; complete specs, exact Conditions, 39 direct relationships and
missing terminal/alert/Gym proof remain preserved. Current checks passed 71/71
Host tests and 31/31 Alex/May tests. A production-function scratch probe exposed
one precise current question: absent source/caller time, a delayed successful
metric collector recorded its fallback timestamp 240 ms before producer
completion. The recommendation requires an exact related-work check and one
bounded Alex comparison before any patch; the separate five-name noisy-event
query gap already has May parent `goal/app_f61801ff-d565-4cde-af42-54c0a700d124`
and approval child `goal/appdep_0f3f67e14e6115f52af6c3ca`, so it must not be
duplicated. Historical proof promises and caller boundaries still need a bounded
May disposition. No continuation was rushed into admission in this attempt.


## Accepted unhandled-signal disposition and current causality continuation

May Task `goal/appdep_7bfd3ac4b0fa68969a9e3b23` withdrew all ten retired unhandled-signal/owner-review outcomes as **unfulfilled**. Exact historical callers, four preserved unknown Conditions plus the unrecovered historical mention, all 39 direct relationships, and every missing terminal/alert/Gym proof remain recorded. Withdrawal is not fulfillment, approval, rejection or Condition settlement. No current Hao decision or additional May reply survives from these ten; the separate five-name noisy-event proposal and its human Condition remain independent.

Alex Gym Task `input/appdep_154c005c87f7d8c436e76d9f` completed the bounded current-source comparison. It preserved producer timestamp `111`, caller timestamp `222`, shared-producer execution and failed-source safety, but found untimestamped fallback observations **183 ms before direct producer completion** and **176 ms before completion through the actual App schedule path**. This falsifies the no-change case and supports only a narrow current Host adaptation: producer `measuredAt` > explicit caller `measuredAt` > one source-completion instant, with scheduled request time kept for cadence rather than observation time. Implementation is admitted separately as Alex tech-lead Task `input/appdep_db79add2ae9333ab16f704e9`; it has no merge, deployment or rollout authority and must not duplicate May's five-name query work or revive historical `ae8ed87…`.

## Gym request-correlation lineage reconciliation

Activated Bob session `s_1791121065520_0995a42e-296f-4622-a5e9-cc4671d23cbd` reconciled exactly the three `gym-request-correlation` identities in `projects/alex.app/gym-request-correlation-reconciliation-2026-10-04.json` (SHA-256 `d95196cf2cd3e8d7655d77dd28fa9d6d6ad152021edb96ff76d537cbdf1946bd`). The artifact preserves both unknown Conditions, five direct relationships, two caller inputs and all full old specs. Current generic correlation and comparison fixtures pass, but do not implement the old finish-result/addressed-route envelopes or prove any historical live matrix; no technical continuation is warranted without a fresh enabled-App falsifier. One bounded May historical authority/caller disposition is pending as `goal/appdep_8630d39afbc036c94782ceda`; no old outcome is marked fulfilled.

### Finish-result lifecycle reconciliation

Activated Bob session `s_1791121522591_3a5e90f7-22ff-42e8-93dc-a62dfe1fea15`
reconciled three exact may-agent frontier identities and one explicitly corrected
Gym child identity in
`projects/alex.app/finish-result-lifecycle-reconciliation-2026-10-04.json`
(SHA-256 `0c4003e4bb5ebbb5902309f2e644112f2c98fd34a0a8c2f8390650ff43f5d11a`).
The artifact preserves all retained specifications, three unknown historical
Conditions, direct caller/parent/dependency relationships, recovered candidate
and failed-run evidence, and the distinction between current structured finish
result handling and the retired top-level result format.

The frontier now classifies the three may-agent paths under
`finish-result-lifecycle`. Current Host behavior supports only part of the old
finish-envelope outcome; timed idle auto-close and automatic legacy session
resume are obsolete paths. None of the three historical outcomes is marked
fulfilled. Their exact May creator disposition remains pending: May must either
withdraw the obsolete promises unfulfilled or identify a precise current caller
contract. No old Condition is satisfied or rebound, no candidate is activated,
and the explicitly resolved Gym child remains a separate identity rather than a
fourth may-agent frontier row.

May Task `goal/appdep_5157b6f3992cb247097deb24` returned the creator disposition
for all three finish-result lifecycle identities: each is withdrawn unfulfilled,
with no surviving current Hao decision, May caller reply or enabled-App remainder.
Its disposition artifact is `artifacts/finish-result-lifecycle-may-disposition-2026-10-04.json`
(SHA-256 `0a2dd6482c21e0c68b383519102559649d03c079996ee366382c37ee719c00a9`).
The two historical unknown Conditions, parent/dependency relationships, candidate
evidence and missing proof remain preserved; no Task, Condition, runtime or
production source was mutated by this disposition.

## Evaluation automatic-review input reconciliation and evaluated recovery

Activated plain Bob reconciled exactly the 106 retained Evaluation inbox rows
whose current state is `input_kind=automatic-review`, `status=handling` in
session `s_1791122433325_06ed3cd0-b84a-4c4f-9ca6-42d30af328cf`. The durable
artifact is
`projects/alex.app/evaluation-automatic-review-inputs-reconciliation-2026-10-04.json`
(SHA-256 `e00666db26d7aed111ee16d5a60c7feaf8cc96975b4d010fa6ded1bf60cbaaf7`).
It preserves all 106 unique input identities and matched source-event identities,
their single wait on Evaluation selector `runtime/task-outcome-selector`, exact
reason/source evidence, null caller/creator fields, and 18 recovered database-lock
records. The artifact was validated for exact equality to the read-only runtime
receipts; focused selector/App tests passed **53/53** with 496 expectations.

These are 106 stale controller triggers, not 106 independently requested
improvements: 104 are old AKS metric-measurement-failure wakes and two are
repeated alert-4942 breach wakes. Their old execution path is superseded by the
existing Alex selector and ordinary review routes. No review outcome is claimed
fulfilled, no input is replayed or rebound, and no disabled-App row, Task,
Condition or production database is mutated. Any later administrative settlement
requires a supported old-App input disposition; the migration does not invent
106 replacement Tasks.

Fresh runtime evidence separately proves one evaluated recovery transition.
After the immutable report cutoff, event `6644621` emitted
`trigger.metrics-evaluate` from `app:may:schedule:metric-evaluation` at
`1791122500091`. That evaluation resolved alert 4945 at `1791122500210` and
alert 4942 at `1791122500271`; canonical metric
`may.oldest-input-recovery-age-seconds` remained `current=0` at
`updated_at=1791122413000`. May owner Task
`goal/app_609db759-3050-4651-951e-e62684b8dd3e` is done with the exact original
and replacement settlement evidence. This proves an evaluated below-threshold transition. A later read-only runtime
query establishes recurring independent cadence: from timestamp
`1791122500000` through `1791123331902`, 14 distinct
`trigger.metrics-evaluate` events used successive schedule identities
`29852041` through `29852055` (with `29852047` absent from the retained result),
while only four `trigger.metrics-snapshot` events occurred. The evaluation
triggers recur at roughly 60–65 seconds and continue between the roughly
five-minute snapshot triggers, so the migrated schedule is not dependent on a
new snapshot event.

May's existing protected integration request
`appdep_5cbe295212fb533ff84188a4` subsequently returned terminal evidence rather
than commissioning another repair. Host candidate
`e99f52a4a583d11af7276c2c0ebb9df646bb6533` passed 26 focused tests with 102
expectations, was reviewed as PR `hao1939/may-agent#327`, and merged as
`2f6b3434e31bbcaa402ebc4d8292fd952748ae69`; candidate and merge have the same
stable patch-id `8f4c50d30773a9584bd7bf321624050503a4fdbd`. Deployed Host revision
`6b507d42916ae5e0f64483311984302b20079d92` contains that merge. Deployment
receipt `goal-appdep-5cbe295212fb533ff84188a4-host-6b507d429-v1` succeeded with
matching artifact and loaded-artifact SHA-256
`6c38b3936270919fbd83fc9743984b491966d63d1d7d6ba01cae9f3789be2cb2`, healthy
readiness and `duplicateDeploy:false`; the live binary matched the artifact.
Post-deploy event `6645440` emitted `trigger.metrics-evaluate` independently of a
snapshot in the same bounded interval, while earlier event `6644621` produced
`metric.recovered` event `6644624` for alert 4945 at current `0.607` versus
threshold `172800`. Live `/api/apps` returned exactly `alex`, `may` and
`scout-knowledge-lib`, and a bounded post-deploy query found zero retired
Evaluation, Gym or may-agent controller events. This proves protected Host
integration, activation and the requested recurring/live transition; it does not
settle or mutate the separately preserved 106 legacy automatic-review inputs.

## Provider archive recovery reconciliation

Bounded Bob session `s_1791123035391_4c620adf-4c58-4d15-83ba-9464324fb931`
reconciled exactly `may-agent/app-request/appdep_a5c132567ef83b8cd4caacf6`
and `may-agent/app-request/appreq_a0b947fae8716ee0928e6c2d` in
`projects/alex.app/provider-archive-recovery-reconciliation-2026-10-04.json`
(current SHA-256 `309db0c433f0694d8ed34a453f7ba1eddb625a9c9ce74928ca335811a7b28697`; original technical artifact SHA-256
`edd35a5bd437db192504c44e9be49b1d8345400d37c6a498d5221b21fb9b0cc1`).
It preserves both complete retained Task rows/specs and trigger, both exact
parent edges to `platform-system-review-feedback-loop`, May creator identity,
and follow-up key `conversation-follow-up:may:appdep_665d1b91d118069c0c20f65c`.
The separately retained Condition `provider-recovery-original-230-20260825`
(generation 2, resource version 4, unknown) matches the archive requirement but
is absent from both Task condition arrays. It is preserved without fabricating
a Task binding, approval or settlement.

Neither old outcome is fulfilled. The retained Host result is
`external-provider-recovery-required`, `recovered:false`, not a terminal provider
adjudication. Current historical AKS receipt paths are absent and the retained
may-agent recovery-directory alias is empty. Bounded exact-name searches across
the retired-App archive and the two extant AKS repositories found no original
archive, companion files, retention-exhaustion receipt or escalation receipt.
The retirement manifest has no matching recovery-file entries. Those observations
do **not** establish provider retention exhaustion, irreversible loss, or the
absence of a safe provider clone. The old exhaustion summary remains attributed
historical evidence because its original receipt bytes are unavailable.

Retired dispatch is unavailable, but the original-byte preservation requirement
is not obsolete merely because Apps were retired. A conditional provider route
remains unresolved: only an authorized operator can establish snapshot/clone,
backup and object/blob/artifact retention and any properly authorized isolated,
read-only-clone recovery. No `/dev/sdd` operation, production DB access, archive
mutation, provider action or legacy Task/Condition mutation occurred.

One bounded May creator/caller disposition request is now justified. May must
first discover/reuse any current obligation and reconcile the exact follow-up;
current cross-App list discovery was unavailable and a modern guessed goal path
for that key returned null, neither of which proves the caller was closed. May
should return verified provider terminal evidence, a precise surviving
operator/access/authority or human decision need, or explicit authorized
withdrawal **unfulfilled** with the caller explanation. Withdrawal would not
prove provider impossibility. No request or replacement was admitted by this
helper, and neither an old Condition nor a new human approval is inferred.

Artifact checks verify 117 unique frontier identities remain, exactly these two
entries change, the other 115 and all original identity/outcome fields remain
unchanged, full retained rows/Condition/relations equal the pinned snapshot,
and both frontier references match the artifact hash. These are reconciliation
checks, not disk-recovery tests or final migration acceptance.


## Event-delivery and taxonomy cohort reconciliation

Bounded Bob session `s_1791123406868_788bb14b-7733-4bea-8c4d-a8f4f26e19b9`
reconciled exactly `activate-addressed-route-and-remeasure-alert-4566-20260816`,
`align-ops-health-delivery-taxonomy-20260816`,
`prove-alert-4577-after-existing-activation-20260818`, and
`reconcile-app-dependency-completed-delivery-taxonomy-20260819` in
`projects/alex.app/event-delivery-taxonomy-reconciliation-2026-10-04.json`
(SHA-256 `2f239c1bfd6feb3ca7caf7656d1e14fa337bf6b5a005caeebf257bbef0998aaa`).
The resulting frontier SHA-256 is `be6b6a583d6d7998a69332d1cb547c196479846e3f69af2d6bdf3fcca2d49d58`;
the artifact pins its baseline frontier/receipt and complete retained rows.

All four execution paths are obsolete, **none of the four requested outcomes
is proved fulfilled**, and exact May creator/caller disposition remains pending.
The artifact preserves nine direct relationships, the final unknown AKS Condition
`app-request:appdep_26d2607cd95ed2addf393ce6`, separate Gym dependency
`appdep_879ba020fd9626e17ac01f06`, older dependency corrections, recovered
`fec89b4b…` no-go correction content (the requirement hash has only 62 hex
characters; actual file SHA has 64, so exact hash equality is unproved), staged `3bf56cf5` request and partial `fbfd7a3a`
activation receipt. Fresh historical terminal/alert/session proof remains missing.

Current routing deliberately addresses App owners, not local specialists: useful
tech-lead work enters Alex through its App contract. The old raw May-to-tech-lead
canary is **not** claimed fixed. The retired ops-health classifier has no enabled
counterpart requiring its seven-pair patch. Current saved-answer/
`app.dependency.updated` handling covers correlated returns, but noop acceptance
is not an actual wake, canonical old-schema validation or legacy live proof.
Current name-level metric exclusions are not the old source/owner/payload matrix.

Focused current checks passed **109/109** Host protocol/metric tests, **205/205**
Task runtime tests and **50/50** Alex/May tests (3,086 total expectations). Two
initial file-filter/path commands ran no tests and failed; corrected commands
and full outputs are retained, not silently counted as passes. Loaded Alex/May
entrypoints and reliability metric source match inspected worktree bytes. No
fresh production metric or alert query was available.

No new technical repair is justified. Existing May five-name metric proposal
`goal/appdep_0f3f67e14e6115f52af6c3ca` remains waiting on its exact unknown human
Condition; it is independent of these historical promises. May's completed
seven-AKS disposition covers related children/staged release, not these four
identities. Recommend one bounded exact caller disposition, after caller-side
related-work discovery/reuse; this helper submitted no request. No old Task,
Condition, runtime or database was mutated, no release replayed, and no new Hao
approval is inferred. All 117 identities remain unique; the other 113 entries
and all frontier top-level fields remain deeply equal to baseline.

## Accepted provider disposition — escalation remains to execute

May Task `goal/appdep_29ade05116723df51757b027` is **done** (generation 1,
resource version 4, accepted attempt `r_1_575ccf90-91d0-490c-a073-63d5d3a54469`,
finished `2026-10-04T14:17:43.923Z`). Its accepted disposition is exactly
`surviving-operator-access-authority-need`. This supersedes the earlier pending
disposition recommendation above, not the retained technical evidence. Both
historical outcomes remain **unfulfilled**; `creatorWithdrawalAuthorized=false`.
No recovery, provider impossibility, withdrawal or operational approval is proved.

The exact current blocker is identification of the provider account/project and
volume underlying `/dev/sdd`, designation of an operator with retention and
snapshot/clone access, and any required write-quiescence authority. May found
this dependency to be the only current May obligation referencing the historical
follow-up key, with no current conversational Request, Topic or separate caller
resource found for it. Preserve the existing Alex return, both exact parent
edges and all old rows. Independent Condition
`provider-recovery-original-230-20260825` remains generation 2/resource version 4,
unknown and unbound to either selected Task.

**Next request scope (recommendation only):** Ask May to execute the operator/human
escalation identified by its accepted disposition, not disposition the same
evidence again. Read the updated artifact and both full old specs; reuse the
current obligation/return route after checking for an already-admitted escalation.
Identify the provider account/project and volume, designate the responsible
retention/snapshot/clone operator and obtain any required write-quiescence
authority. Use only existing authorized operator channels. If May cannot supply
these prerequisites, ask Hao through the supported human Condition/Conversation
path for that precise help and retain delivery/ask/reply evidence. Return that
evidence and the exact owner/authority or unresolved human ask to the originating
Alex migration Task. This is escalation, not new disk/provider permission.

The operator must first inspect existing snapshot/clone, managed-backup and
object/blob/artifact retention. Deleted-file recovery may run only with established
authority against an isolated read-only clone, never the live volume. Require a
dated terminal receipt naming operator, checked layers/results, snapshot/clone
existence or creation, isolated read-only attachment and clone-only recovery where
performed, and no production replacement/mutation. Recovery must verify
`original-230.tar`, 18,769,920 bytes, SHA-256
`1016eded02ab156095040f4054e34d957d7e567a71743f4c4160a8e48644d9ca`,
matching `manifest.before.tsv` and `paths.txt`, exactly 230 allowed paths and
allowed-only tar members. Alternatively require provider evidence meeting the
retained impossibility contract; blocked access is not terminal impossibility.
Git/current-file reconstruction remains forbidden.

Updated artifact SHA-256: `309db0c433f0694d8ed34a453f7ba1eddb625a9c9ce74928ca335811a7b28697`.
Updated frontier SHA-256: `f3cff56a1b3be74a8fdd9818ff805e8571f24790dd62d7047fb4615a62ac1cf4`.
The artifact records the exact accepted May read and original technical hash;
both frontier entries link to the updated artifact hash. Against starting HEAD
`e96cf1cfa9ccdd4f820ca8292999398d349933c0`, validation preserves all 117 unique
frontier identities and original identity/outcome fields, changes only these two
provider entries, and leaves the other 115 plus frontier top-level fields deeply
equal. Full retained rows, independent Condition, parents and original technical
evidence remain unchanged. Hash/readback and `git diff --check` verification apply
to this documentation update, not recovery or final migration acceptance. This
helper submitted no durable request and performed no provider/device operation.

## Host Operations controller-wake cohort reconciliation

Bounded Bob session `s_1791124085050_20a5b5f8-d65c-42a3-b968-e7ccac4fca34`
reconciled exactly the 37 entries previously marked
`source-identified-current-lineage-check`. Durable artifact:
`projects/alex.app/host-operations-controller-wakes-reconciliation-2026-10-04.json`
(SHA-256 `d6fc9788d566962b76ac498a65713c247fd57bcb74e486b780b386c8d411dccb`).
The frontier SHA-256 after this contribution is
`d10de66fe023c84389c1bc87ffbcb7cbc78a943a21c1e117137de59e219d8238`.

All 37 are historical Host Operations **intake wakes**, not 37 independent
consequential improvement promises: 17 digests, ten ops-health transitions,
six project-health findings and four session findings. They are homogeneous
for source/provenance and obsolete-controller-path disposition, **not for
outcome settlement**. The new disposition is
`historical-controller-intake-reconciled-not-fulfilled`. Each complete retained
Task row/spec/status/trigger, mapped source input, May creator and parent edge
is preserved. There are 33 exact inbox-to-spec matches, four spec-only mappings
(no fabricated event IDs), 38 direct relationships, three direct Conditions
and five distinct direct-or-referenced Condition rows. Full input content and
historical accepted evidence remain intact, including previously truncated
packet payloads. No old outcome is claimed fulfilled.

Current loaded release `faa65d8b77883f7af4d39af9e7c085af17e332e7-definitions-v4`
has byte-equal inspected Alex/May entrypoints and retired-metric declarations.
The retained enabled-App receipt names only Alex, May and Scout. Current source
has Alex's ordinary review intake/selector and May's metric collection,
evaluation and independent oversight rather than the old Host Operations
controller. Eight cited session/handler/Evaluation/Gym metrics and the AKS
assignment metric are explicitly retired; the unhandled-signal and subscriber
metrics remain current Host concerns. Retirement and modern routing tests do
not prove old alert recovery, canaries, terminal returns or public projections.
No fresh production metric/alert query was performed.

**Remaining exact boundaries:** May must discover/reuse existing work before
one bounded creator/caller reconciliation of the original-request waiver,
both distinct `5a06bbac…` Gym reload Conditions, three digests' external
Evaluation/AKS dependency and handler-race approval mentions, the obsolete
`definition-source-clean-for-ops-health-activation` wait and any surviving
intake terminal promise. The original request's accepted replacement and
terminal Conversation receipt do not satisfy original-identity acceptance.
May's hygiene Task already observed duplicate waiver ownership; its current
read does not prove closure. The grouped-goal stop already has an exact May
withdrawal-unfulfilled decision in `goal/appdep_bc9a845ad126f8632071584a`, so no
duplicate Hao ask is needed for that scope. The related four-event-delivery
May disposition `goal/appdep_148b26c73641204345e57308` is now done and withdraws
those promises unfulfilled, but does not itself close these intake shells.
All other frontier entries remain untouched for their owner's continuation.

No new technical repair is warranted from these stale wakes. Reuse the separate
current metric-causality implementation, five-name metric proposal and Gym
retired-definition decision; do not claim any of them fulfills legacy proof.
Cross-App list discovery was unavailable (tool rejected it as current-App
scoped); exact May reads succeeded. The caller should check for already-admitted
May disposition work before making the bounded handoff. This helper admitted
no request and made zero direct owner signals, Task/Condition mutations,
input replays, provider calls, deployments or production database operations.

Verification: `host-operations-controller-wakes-reconciliation-2026-10-04.verify.py`
passes read-only structural checks against base `ad4b23d880`. Exactly 37 entries
change; the other 80 and every frontier top-level field remain deeply equal.
All original identity/outcome/source fields remain equal. The canonical JSON
SHA-256 of those untouched 80 is
`c6c0cd123b4bf2c152221f7cbc183a951ccc789652710e97d3f148cee882ad76`.
Inherited top-level counts/status were already stale and are deliberately
unchanged by this exact-entry assignment; the artifact records recomputed counts.
The focused Alex App, real report-routing, selector and May App suite passes
**74/74** with **682 expectations** using `--timeout 20000`. The first default
run had 73 passes and a 5-second routing timeout; isolated routing rerun passed
1/1, then the full focused rerun passed. All three raw outputs and hashes are
embedded in the artifact. These are local deterministic checks, not historical
live proof, integration or final migration acceptance.

## Accepted event-delivery/taxonomy creator disposition

May Task `goal/appdep_148b26c73641204345e57308` is **done** (generation 1,
resource version 4, accepted attempt `r_1_349ae894-9d10-49c9-a113-07f9f65ded19`,
finished `2026-10-04T14:30:05.682Z`). Its exact accepted disposition is
`all-four-obsolete-execution-promises-withdrawn-unfulfilled`. This supersedes
only the pending four-identity disposition recommendation above. Each obsolete
execution promise is withdrawn **unfulfilled**; no precise current May, Hao or
caller obligation survives, and executable continuation and continuation owner
are both null. Alex's retained reconciliation ownership is not a new execution
assignment. No new request, deployment, replay or disabled-state mutation occurs.

May's immutable artifact is
`artifacts/event-delivery-taxonomy-may-disposition-2026-10-04.json`, committed at
`90695016d8e39f48a757d8a97a4afd26d76a1b40`, SHA-256
`da5c14d4344f50b8693b7196e7ffedc77bc5c5a7e3e8f47496f853799d517e14`.
The exact accepted Task read and committed artifact bytes agree. Its copied
frontier entries retain earlier triage rather than starting HEAD; full old
requirements/status, missing proof and relationships match the technical source.

The final AKS Condition `app-request:appdep_26d2607cd95ed2addf393ce6` and separate
Gym dependency `appdep_879ba020fd9626e17ac01f06` remain independent **unknown
historical evidence**, with no inferred new binding, satisfaction, approval or
rejection. All nine direct relationships, old caller chains, older dependency
corrections, missing canary/alert/terminal/session proof, partial receipts and
the correction-hash identity gap remain exact. Independent Gym continuation,
May's five-name metric proposal and the 37 Host Operations intake wakes are not
settled by these four withdrawals. Modern generic tests remain current-protocol
evidence only, never historical fulfillment.

Updated technical artifact SHA-256:
`47fdce0a006242329e967f686b2d8fcc9d6e9ea436ebf20fa69424b32cb784f0`.
Updated frontier SHA-256:
`07742bab2e378b354ba5cce2f9771ec2c3de2ece1256377359a3e2d5716daad5`.
The read-only structural verifier
`projects/alex.app/event-delivery-taxonomy-reconciliation-2026-10-04.verify.py`
compares against pre-incorporation HEAD
`68e55f4cfae386479ddefb838e376b1feb30915b`: exactly the four intended entries
change; the other 113 entries, all original identity/outcome fields and frontier
top-level fields remain deeply equal. All 37 Host Operations entries and its
artifact/verifier remain unchanged; this receipt is append-only. Inherited
aggregate counts remain unchanged rather than silently rewriting another scope.
Checks include exact May commit/hash, complete specs/status and missing-proof
equality, two unknown Conditions, nine relationships, updated artifact links,
receipt hashes and `git diff --check`. These documentation-only checks do not
claim new live proof, integration, deployment or final migration acceptance.

## Gym unchanged-approval wake cohort reconciliation

Bounded Bob session `s_1791124776614_0c989c1b-e14d-4d62-ba93-3c329af6c9f4`
reconciled exactly `app-request/appdep_3ccc74a3a17acd12d85f5499` and
`app-request/appdep_cd6f1ace87bd5db6068c1398`. Durable artifact:
`projects/alex.app/gym-approval-wake-reconciliation-2026-10-04.json`, SHA-256
`3f73b57163a3763015432737d1c330b7509de0b335ffeee3b33fe649e4c6a054`.
Updated frontier SHA-256:
`07b12fe1d0200b0fa281ecef6e2f05248372b8d414cccf54618515336b86e257`.

These two runtime requests share the same stale Gym approval-wake incident,
`14dfdc7e…` repair and outstanding later-event proof. Both exact successful
activation receipts are recovered, naming artifact `0c771cb3…` and distinct
correlations. Each reports `duplicateDeploy=false`; this does not prove that
the two receipts represent only one physical deployment. Neither deployment
should be repeated. The generation-2 correction explicitly says that routine
codex-learning success does not satisfy a later approval/refill wake.

The retired `gym/improve/may` controller execution path is obsolete, **not
fulfilled**. Current Host source separates mechanical fact recovery from agent
review, preserves independent waits through restart, suppresses unchanged
observations and admits exact relevant events. The old patch is not an ancestor
of inspected Host `d8c87757782ae5750984bedc239b00eab4c76715`, and its blanket
`nextCheckAt=null` must not replace modern recovery scheduling. Alex's migrated
Gym capability performs bounded frozen comparisons, not the old curriculum
controller. Focused checks pass **13/13** Host tests (182 expectations) and
**23/23** Alex/Gym tests (115 expectations); full outputs and hashes are embedded.
These local checks do not reconstruct historical later-wake or live intake proof.

Both complete retained Task rows, generation-specific acceptance, historical
status/evidence and two exact parent relationships to
`platform-system-review-feedback-loop` remain intact. Neither has a direct
Condition. The requirement's `improve-may-ground-truth-approval` spelling has no
exact Condition row in the pinned snapshot. Older retained Gym JSON instead
binds `improve/may` to unknown `improve-may-ground-truth-approved-g1`, naming eight
preference-sensitive scenarios. Both identities are preserved without assuming
an alias or changing benchmark truth. The Aug 21 JSON is historical, not a
current canonical Condition read; its wait is neither approved nor settled.

**Remaining boundary:** Alex should discover/reuse matching May work before a
bounded creator/caller disposition for these two exact promises. May must either
withdraw the obsolete promises unfulfilled or identify a precise surviving
caller contract; the independent ground-truth wait is not thereby settled. No
technical repair is justified absent a fresh enabled-App falsifier. This helper
submitted no request and performed no production/legacy mutation, replay,
deployment, provider operation or new Hao ask. Missing historical later-event
proof and unavailable source-report paths remain explicit evidence limits.

Read-only verifier
`projects/alex.app/gym-approval-wake-reconciliation-2026-10-04.verify.py` checks
against base `eb727e81e8f951c633cfcbd8538eda2fd010e475`: exactly two entries
change, the other **115** and all frontier top-level fields remain deeply equal,
all 117 identities remain unique, receipt edits are append-only, and earlier
Host Operations/event-delivery artifacts and verifiers are unchanged. It checks
full snapshot/index equality, receipt/source hashes, exact relationships and
historical Condition preservation. Recomputed unresolved inspection count is
**26**; inherited stale aggregate metadata is deliberately unchanged. This is a
bounded semantic contribution, not final migration acceptance or integration.


## Accepted May disposition for Gym unchanged-approval wake promises

May request `appdep_b791d717a4429f17904fd8a7` returned accepted Task
`goal/appdep_b791d717a4429f17904fd8a7` on 2026-10-04. Its dated creator/caller
receipt withdraws exactly `app-request/appdep_3ccc74a3a17acd12d85f5499` and
`app-request/appdep_cd6f1ace87bd5db6068c1398` as obsolete execution promises
**unfulfilled**. No surviving current caller contract or executable continuation
exists for either retired-controller promise. No replacement Task was created, no
Hao approval was requested, and no legacy state, runtime, deployment, disabled
App or benchmark truth changed.

The withdrawal does not supply the missing historical proof: no recovered later
matching approval or daily curriculum refill/review after event 6001333 is shown
waking `gym/improve/may` exactly once and yielding one bounded outcome. Current
tests, quiet-wake observations and both 2026-08-24 deployment receipts remain
current/historical evidence only, not fulfillment. The independent unknown
Condition `improve-may-ground-truth-approved-g1` remains preserved and unsettled;
`improve-may-ground-truth-approval` is not treated as an alias. Future technical
work requires a fresh enabled-App falsifier and is not continuation of either
withdrawn promise.

The accepted receipt is embedded verbatim in
`projects/alex.app/gym-approval-wake-reconciliation-2026-10-04.json`; its source
is Apps commit `141489c2b0dd670d4068c8169650fa21040e394b` and artifact SHA-256 `3f73b57163a3763015432737d1c330b7509de0b335ffeee3b33fe649e4c6a054`.
Updated reconciliation artifact SHA-256: `8bb030db0bb179b0b33a486ae1f0f4038eb6461d6a27d2b384c02423c675da24`. Updated frontier SHA-256:
`fcfda62c4bf6b19e154c08f6e2cdcfb77ad3252961c609d6ed3e92c6615757c9`. Exactly these two frontier entries change against `141489c2b0dd670d4068c8169650fa21040e394b`; the
other 115 entries and every frontier top-level field remain deeply equal. The
read-only verifier preserves the complete retained rows, two exact parent
relations, independent unknown historical Condition, missing-proof statement and
all prior source/test evidence. Withdrawal is not fulfillment, approval,
Condition settlement, deployment or final migration acceptance.

## Subscriber-failure metric contract continuation

Fresh read-only runtime evidence establishes a current technical remainder for exactly
`may-agent/reconcile-subscriber-failure-metric-scope-20260820` and
`may-agent/repair-subscriber-failure-metric-contract-20260820`. The live
`infra.bus.subscriber-failed-count-1h` row retains the intended global rolling-hour
`subscriber.failed` query, but still names owner `tech-lead` and project
`v2-spec-coverage-buildout`. Alert 4950 breached at current 4 and recovered at 3
while emitting that retired attribution; the current rolling-hour population includes
two authentic `database is locked` failures for Evaluation review/report subscribers.
Recovery below threshold is not proof that metadata and accountable routing are correct.

One current Alex continuation was admitted as request
`appdep_03869866e7d33ba3dad701aa`, with return Condition
`app-request:appdep_03869866e7d33ba3dad701aa`. It owns a read-first reconciliation
for both old identities, not two duplicate implementations. It must preserve the global
population and alert calibration, determine the current definition/consumer boundary,
and use any August candidate only as historical design evidence. Historical Condition
`hao-subscriber-metric-02a9bb15-decision` remains unknown under May/Hao authority and
is not rebound to this continuation; any activation needs exact current authority.

The durable incorporation artifact is
`projects/alex.app/subscriber-failure-metric-continuation-2026-10-04.json`.
Neither historical outcome is marked fulfilled. Both complete retained Task rows, the
child→parent→platform-owner chain, accepted evidence, missing authentic proof and caller
return requirement remain preserved. No production database, event history, runtime,
Host source, disabled-App Task or historical Condition was mutated. The read-only
verifier confirms exactly these two frontier entries changed, the other 115 remain
deeply equal, all 117 identities remain unique, and the top-level frontier metadata is
unchanged.

## Retired Scout task-projection publisher obligations

Exactly two old May-agent obligations requested regeneration of Scout's retained
`.state/tasks/tree.json`: `app-request/appdep_6e45556ac686de79c4947581` and
`app-request/appdep_9f0518ac9e9d530a4f6334e5`. Their literal acceptance was never
fulfilled: no supported publisher execution, changed tree hash or old HN/XHS projection
proof exists. That missing proof remains explicit rather than being converted into
success.

Current Host source and enabled Scout guidance now use canonical resource-backed Task
authority and label retained `state.json` and `tree.json` as historical only. Current
canonical reads report HN generation 2/RV2154/done and XHS generation 2/RV487/done with
access ready, so restoring the old generation-1/XHS-RV12 waiting projection would
contradict current resources. The related Scout caller
`refresh-host-generated-task-projection` already has accepted `obsolete-acceptance`,
`terminal=true`, `publisherAvailable=false` and `mutationPerformed=false`. This is
caller disposition evidence, not fulfillment of either old requirement.

Both entries are therefore mapped to
`obsolete-execution-path-unfulfilled-no-current-continuation`. No replacement publisher,
new Alex continuation or human decision is justified absent a fresh enabled-App
canonical projection defect, a surviving caller promise beyond the accepted Scout
disposition, or a recovered exact publisher execution receipt. Complete retained rows,
both `platform-system-review-feedback-loop` parent relations, May creator identity, the
Scout source/idempotency relationship, historical `credential-ready:xhs` references and
missing-proof statements remain in
`projects/alex.app/scout-projection-reconciliation-2026-10-04.json`.

The contribution's eight focused tests (30 expectations) cover pure canonical
projection, resource-authority activation and Scout's historical-file health behavior;
they are current contract evidence, not historical fulfillment or production mutation.
Read-only verifier
`projects/alex.app/scout-projection-reconciliation-2026-10-04.verify.py` proves exactly
these two entries changed against `db4bce358b`, the other 115 and all top-level frontier
fields remain deeply equal, all 117 identities remain unique, and **22** inspect-current
entries remain. No production database, canonical Task, historical JSON, Condition,
runtime or disabled App was mutated.

## Accepted completion of subscriber-failure metric continuation

Alex replacement Task `input/appdep_03869866e7d33ba3dad701aa` converged after
exact May approval and supported activation. Host candidate
`6bd5f1b824880ba0f3d7053ecfc69c46c15573e0` produced requested and loaded
artifact SHA-256 `b3abb77c893a48043cd10788e25b93d2e366ac95840e6fadb0f9f0090ec2667a`;
activation correlation `subscriber-metric-contract-6bd5f1b82-20261004` was healthy
and non-duplicate. Authentic trigger event 6645642 produced snapshot 2216620 with
the unchanged global rolling-hour population, value 2, owner `may`, and null
project. Existing authentic alert-4950 evidence routes breach/recovery to Alex's
automatic metric review without adding a generic May fallback.

The two retired identities are now mapped to
`superseded-by-fulfilled-activated-alex-continuation`. This means the current
replacement outcome is fulfilled; it does not replay or fabricate the retired
execution paths. Historical Condition `hao-subscriber-metric-02a9bb15-decision`
remains unresolved and bound only to historical candidate `02a9bb15...`; event
history was not rewritten. Host repository target-branch integration is not
claimed: `main` remains at base `6b507d4291`, while the activated candidate is on
its isolated branch. Exact accepted proof and limits are recorded in
`projects/alex.app/subscriber-failure-metric-completion-2026-10-04.json`.

## Conversation activation and assignment-visibility frontier reconciliation

A bounded Bob contribution (`s_1791126092751_8a224088-9b50-4c5d-b86d-98a471cb2487`)
read the two complete retained May-agent rows, parent relations, the bound unknown
`clean-committed-app-definition-source-for-c5916945-activation` Condition, historical
source/deploy evidence, current loaded Alex/May definitions, and current Host source.
It ran 31 focused Apps tests (163 expectations) and 57 focused Host tests
(769 expectations). This is current contract evidence, not proof that either old
execution path fulfilled its literal acceptance.

`activate-app-definition-and-reconcile-conversation-c5916945-20260825` retains valid
proof that its dependency completed, its Conversation was cancelled and absent from
the active projection, and one canonical pre-activation completion revisited the same
Task. Its literal post-activation proof remains unfulfilled: the retained result says
`ownerReviewIsolationLoaded=false` and its historical `source.ready` Condition remains
unknown. The disabled May-agent activation path is now obsolete under canonical Task
and Conversation machinery. It is mapped to
`obsolete-execution-path-unfulfilled-no-current-continuation`; its Condition is
preserved as historical evidence, not settled or rebound.

`app-request/app_d1380ef9-c44a-49fe-811e-be57a1e7d54c` retains authentic healthy
Runtime deployment proof and one successful receipt for a *different* Task,
`app-request/app_862a194d-e4c3-46d4-ac4e-aac091f279d8`. The old row nevertheless
remained attention with `loadedStructuredOwnerReview=false`. Current source and focused
tests preserve structured Task/Request scope but do not yet prove its exact remaining
assignment-message criterion. One current Alex continuation,
`appdep_588d052a7356e987b94eef83`, is therefore running under tech-lead with return
Condition `app-request:appdep_588d052a7356e987b94eef83`. It must use focused fixtures,
not a fabricated live communication failure, and must not claim the historical path
was fulfilled.

The exact retained rows, relationships, contribution evidence, receipt limits and
both decisions are recorded in
`projects/alex.app/conversation-assignment-visibility-reconciliation-2026-10-04.json`.
Its read-only verifier proves exactly these two frontier entries changed against
`a81a1c7cef`, all 115 others and top-level fields remain deeply equal, all 117
identities remain unique, neither old outcome is fulfilled, and **20** inspect-current
entries remain. The independent provider-authority wait remains unchanged.

## Retired AKS caller dispositions

A bounded Bob contribution (`s_1791126498625_3e0d76f5-eea0-49e6-8ed4-66efc15880be`)
reconciled exactly `activate-and-live-prove-aks-correlation-taxonomy-c6636d34`
and `app-request/appdep_44c346a1f20c9eb3a15d8313`. It preserved both complete
retained rows, three parent edges, three unknown historical Conditions and item 54's
original pending input/idempotency/caller relationship. Host SDK selectors passed 11
focused tests (34 expectations). The source report and evidence are committed as
`aks-frontier-items-1-54-review-2026-10-04.md` and
`aks-frontier-items-1-54-evidence-2026-10-04.json`.

May Task `goal/appdep_26f57b927580036fd0d590f8` accepted two separate creator/caller
decisions: both retired promises are **withdrawn unfulfilled**. For c6636d34, the
healthy non-duplicate activation and all six watcher types remain authentic progress,
but the terminal problem Task/App/dependency return is missing. For item 54, ancestry
`6b266784… → 316fab892… → 293778119…` and passing/cleanup runs 178044977 and
178062470 remain authentic progress, but push ordering, original assertion artifacts,
canonical ledger reconciliation and dependency return remain unproved. No enabled
owner or current technical contract survives either old path; no AKS/ADO replay,
worktree recreation, ledger rewrite, replacement work or human escalation is authorized.
The historical Conditions remain unknown and unmodified.

Exact evidence and the accepted May result are incorporated in
`projects/alex.app/retired-aks-caller-disposition-2026-10-04.json`. Its verifier
checks exactly these two AKS frontier changes while recognizing the concurrent
assignment-visibility continuation, preserves every historical relationship, proves
both old outcomes remain unfulfilled, and reduces the inspect-current frontier from
20 to **18**.

## Assignment-message Host continuation

Accepted Alex verification Task `input/appdep_588d052a7356e987b94eef83` proved current
Task admission preserves structured outcome and acceptance exactly, but found a real
Host gap: the Conversation did not automatically expose a concrete canonical assignment
message and exact followable Task identity. Focused Host commit
`73ed38518001091789da60a260926c79143f4853` on branch
`task/alex-assignment-visibility-20261004` derives the message from admitted Task state,
emits `Assigned to <app>: <outcome>` and `Task: <app>/<taskId>`, includes matching
`followTask` metadata, and preserves existing human-facing response order. The exact
candidate passed 57 focused Host tests (770 expectations) and TypeScript.

The candidate is not yet integrated or activated. May request
`appdep_3be7de6fa2742a26d35f575b` is the sole current path for independent review,
protected Host PR integration, exact deployment authority, activation and post-activation
proof. The old `app-request/app_d1380ef9-c44a-49fe-811e-be57a1e7d54c` outcome remains
unfulfilled. Exact accepted verification and remaining boundary are in
`projects/alex.app/assignment-visibility-host-continuation-2026-10-04.json`; its
verifier proves the historical entry, scope-preservation requirement and current
integration wait remain exact.


## Admission-waiver and waiting/reparent authority reconciliation

Activated Bob session `s_1791126954996_ead3274d-fde6-4e77-bde5-df55a1206098` reconciled exactly two retained May Runtime promises. Artifact `projects/alex.app/admission-waiver-reparent-reconciliation-2026-10-04.json` (SHA-256 `ba13560f02350a8c14c5d23e9534fe57a7e6be295f95d1cc7942d3967477b3c6`) preserves both complete rows, exact relationships, two unknown historical Conditions, accepted progress and missing fulfillment proof. Four focused Host test files passed 427 tests with 3820 expectations.

The original-identity admission promise remains unfulfilled: current durable recovery cannot retroactively admit event 5953599, the exact Conversation is closed, and its human input said not to deploy; the successful 5740aa89 repair must not be replayed. The waiting/reparent candidate 41d87837 is obsolete under current contracts that retired update-task/create-task result actions; it also remains unfulfilled and must not be activated or used to re-drive the completed original.

One bounded May creator/caller disposition request, `appdep_e849da42d1d2116c1cfc7a77`, now covers both exact promises with Condition `app-request:appdep_e849da42d1d2116c1cfc7a77`. It must return two separate decisions while preserving both unknown historical Conditions; Hao is asked only if a real surviving human choice remains. No Task, Condition, Conversation, runtime or production state was mutated. The inspect-current frontier is reduced from 18 to **16** while this exact authority result remains pending.

## Returned admission-waiver/reparent authority decisions

May Task `goal/appdep_e849da42d1d2116c1cfc7a77` withdrew both retired
promises as **unfulfilled**. For
`repair-unadmitted-existing-dependency-request-20260825`, no acceptance waiver or
caller obligation survives: event 5953599 was never admitted under the required
identity, and the closed Conversation fulfilled only its separate do-not-deploy
request. The successful `5740aa89…` deployment remains valid partial progress
and must not be repeated. For
`repair-waiting-reparent-action-admission-20260820`, candidate `41d87837…` is
obsolete under current contracts, its original repair is terminal, and no
caller or activation obligation survives. Neither historical outcome is marked
fulfilled. Conditions
`human-waiver:repair-unadmitted-existing-dependency-request-20260825` and
`hao-decision:waiting-reparent-action-admission:41d87837` remain unknown
historical evidence; no Task, Conversation, deployment or Condition was mutated.

## Gym runtime-attention lineage reconciliation

Activated Bob session `s_1791127334714_5d755c77-734c-4c7c-8ee6-dc9904684bba`
reconciled exactly three remaining frontier identities in
`projects/alex.app/gym-runtime-attention-reconciliation-2026-10-04.json`
(SHA-256 `5b506ff39bd881c35775a249d2735c9643ee47bf43db79b161f67b3cafb5279d`).
It preserves all three complete retained rows/specifications, 29 relationships,
the exact 26-identity cohort, two unknown Conditions plus one missing-body
approval ID, five historical attempt reads and 36 domain artifacts.

Later evidence materially changes the stale waiting summaries without
retroactively fulfilling them. The original Gym request returned 1 resolved,
4 retained and 21 blocked. A later exact Host request reports 21 same-identity
requeues plus one prior completion. Fresh canonical reads show 22 accepted
generation-1 completions and four later human-cutover cancellations; completion
of a benchmark execution is not benchmark success. The current deployed Host
supports fenced same-identity retry with immutable receipts. Focused current
verification passed 244 tests across Host control/reconciliation, Task-control
events and Alex/Gym comparison paths.

No technical retry, deployment or Gym continuation is justified. The three old
supervisor promises remain unfulfilled because their exact final parent review,
action-receipt return and Condition observation/resume links are not proved.
Conditions `runtime-exact-task-retry-control` and
`gym-incident-intake-stable-localkey-loaded` remain unknown; missing-body ID
`runtime-exact-task-retry-control-deploy-approval` is not inferred approved,
rejected or satisfied. One exact May creator/caller disposition is pending as
`goal/appdep_bc2603afa3db5fd84ffe2873`, retained by Condition
`app-request:appdep_bc2603afa3db5fd84ffe2873`. No old action was replayed and
no disabled state, Task, deployment or Condition was mutated.

## Returned Gym runtime-attention creator disposition

May Task `goal/appdep_bc2603afa3db5fd84ffe2873` read the pinned reconciliation
artifact and withdrew all three stale Gym supervisor promises as **obsolete and
unfulfilled**. Later same-identity evidence removes technical continuation but
does not reconstruct the missing final parent review, action receipts or
Condition observations. Conditions `runtime-exact-task-retry-control` and
`gym-incident-intake-stable-localkey-loaded` remain unknown; missing-body ID
`runtime-exact-task-retry-control-deploy-approval` remains an unknown historical
boundary. The 22 accepted generation-1 completions and four human-cutover
cancellations remain downstream evidence, not retroactive fulfillment. No
surviving caller obligation or Hao decision remains and no old work is replayed.

## Historical release and Evaluation runtime reconciliation

Activated Bob session `s_1791127900192_43888111-3bd3-4a8a-ba6a-619b9d0f1aa1`
reconciled exactly frontier indexes 13, 38 and 69 in
`projects/alex.app/runtime-release-evaluation-three-entry-reconciliation-2026-10-04.json`
(SHA-256 `4ee50130fdd46a0090dec4ff2f7666eb39a1247dca9222737e4d279c85298eed`).
It preserves all three complete retained specifications, parent relationships,
accepted progress, missing proof and authority/caller boundaries. Focused
current checks passed 57 tests with 264 expectations.

The exact 044f3da8 release was never authorized; its retained result says
`authorizationState=not-granted` and `decision=do-not-deploy`, while Condition
`hao-deployment-target-decision-044f3da8` remains historically unknown. The
5afdd92b deployment is authentically terminal and healthy with matching
requested/loaded artifact and `duplicateDeploy=false`, but the paired cross-reload
Codex proof and terminal return of historical Evaluation request
`appdep_5cac5ea883f25fdfa2f59347` are absent. Workflow runs
`wr_1787443397863_7wye` and `wr_1787443442821_e655` are now terminal interrupted,
and the current SDK accepts `agent`, but exact later deep-scan/aftermath
completions, events and owner return remain unproved.

No deployment, workflow replay or restoration of disabled Evaluation controllers
is justified. One exact May creator/caller disposition request,
`goal/appdep_9d9948835bb8f4e30ffb6214`, covers these three promises and is retained
by Condition `app-request:appdep_9d9948835bb8f4e30ffb6214`. After this bounded
mapping, **10** entries remain in the inspect-current frontier.

## Verified App-loop rollout and retained recovery boundary

Operator rollout evidence establishes the focused App loop fixes are reviewed,
integrated and active at Apps source `587fe60510db351d0752072b370217655521be13`.
Reload Events 6646699/6646701 report `ok=true` with the same source commit; the
installed immutable release is
`/app/.state/releases/app-definitions/587fe60510db351d0752072b370217655521be13-definitions-v4`.
`/app/.state/apps-review-20261004-late/rollout/installed-app-check.json` pins
source hashes and proves evaluator work is skipped while ordinary Alex work remains
reviewable. The final focused suite passed 91 tests with 336 assertions; design checks
passed with one pre-existing reports-layout warning. Host source
`87fbffc82371a80d3c7729586bae06106a265a80` is independently live and healthy
under `/app/projects/may-agent/.state/deploy-receipts/sql-loop-resolution-20261004.json`
with matching requested/loaded artifact and `duplicateDeploy=false`.

This closes only the bounded Scout/evaluator/App routing rollout. Five stranded
Evaluation reports were manually recovered through four normal App inputs; that is
useful owner progress, not proof of automatic recovery. The precise pre-admission
recovery gap remains with its existing May owner. No full divergent migration branch
was merged, and no further deployment is required for this patch.

## Retired metric three-entry reconciliation

Activated Bob session `s_1791128837263_ca86bcc8-4aa4-479f-a00a-aa24fa3d0887`
reconciled exactly three of the ten remaining inspect-current entries in
`projects/alex.app/retired-metric-three-entry-reconciliation-2026-10-04.json`
(SHA-256 `2ec64be6df95d7c18078508ec772a63eb221376e3de317b4fa18d9a1f7aa06bb`).
It preserves each complete retained specification, three parent relationships, two
unknown activation Conditions, authentic commit/deployment progress and the missing
fresh metric/alert proof. Focused current App tests passed 32 tests with 165
expectations.

Loaded source `587fe60510db351d0752072b370217655521be13` explicitly retires
all three metric contracts. No old measurement replay or deployment is justified, but
the historical promises are not fulfilled: repaired App-definition activation and
fresh acceptance evidence were absent. The frontier therefore records them as
obsolete and unfulfilled pending one exact May creator/caller disposition. Seven
inspect-current entries remain. Conditions
`activate-failed-triage-repair-source-01bc931aa4` and
`activate-calibrated-definition-and-resolve-alert-4797` remain unknown historical
evidence and are not satisfied, retired or rebound.

## Final seven current-evidence reconciliation and returned metric dispositions

Activated plain Bob reconciled the final seven `inspect-current` frontier entries in session `s_1791129154632_c0f26114-9430-423c-a1d9-7c5870c20703`. The bounded artifact is `projects/alex.app/remaining-seven-reconciliation-2026-10-04.json` (SHA-256 `724176cc12c28246ea07f680aead0fd0a94fc5918f2b5fae11d22e02210851d3`). It preserves all seven complete rows, eleven direct relationships, two direct and three referenced unknown Conditions, accepted progress, missing proof and current source evidence. Focused checks passed **70/70**: 44 Host model/fallback/parent tests, 24 Alex projection/Gym tests and two concurrent-input fencing tests.

No historical outcome is newly fulfilled. The exact Gym localKey incident has authentic terminal evidence and must not be replayed; only its aggregate retired `gym.valid-run-rate` remainder is linked to existing May Task `goal/appdep_c1890444e02436f8d2131ffd` and its retained Condition. Six separate creator/caller decisions remain with May; there is no justified seven-way Alex technical fanout. In particular, the provider fallback mechanism already exists and passes deterministic checks, while its live provider/credential proof remains an authority-bound obligation rather than permission for a canary.

May Task `goal/appdep_e190e9bdd1635a3cf7fded52` returned the preceding three retired-metric dispositions: all three are obsolete and withdrawn **unfulfilled**. Conditions `activate-failed-triage-repair-source-01bc931aa4` and `activate-calibrated-definition-and-resolve-alert-4797` remain unknown historical evidence; neither is satisfied, retired or rebound. No deployment, measurement replay, production mutation or controller restoration occurred. The semantic frontier now has **zero** entries awaiting current-evidence inspection; six exact May dispositions and the separately retained Gym retirement decision remain external semantic closures, alongside independent Host/provider obligations.

## Final six May creator/caller dispositions

May Task `goal/appdep_f8259919c2fd5d38a366e230` returned all six requested decisions. The structured Alex receipt is `projects/alex.app/final-six-may-dispositions-2026-10-04.json` (SHA-256 `5b283f6b7f97eb061894732fe0cabc04a8739f482d6ddb13d7e6f8e05602f6f0`). No legacy outcome is newly fulfilled. The feedback-projection deploy, evaluator immutable release, global cleanup, frozen Telegram experiment and supervision-contract promises are withdrawn obsolete and **unfulfilled**. Their accepted progress, missing proof, caller chains and unknown historical Conditions remain preserved; no technical replay, deployment, controller restoration, Task/Condition mutation or new human ask occurred.

The provider fallback legacy promise is also withdrawn unfulfilled, but its narrow current prerequisite is not discarded: any credential/provider authority must continue only through existing May Task `goal/appdep_5f8a7c0e566e08fc95051414` and return to this Alex migration Task. This result authorizes neither credential inspection nor a canary. The separate Gym localKey row remains linked only to existing retired-metric Task `goal/appdep_c1890444e02436f8d2131ffd`; the authenticated terminal incident is not replayed and its historical complete outcome remains unfulfilled.

The bounded 117-row semantic frontier is now fully dispositioned with zero `inspect-current` rows and no falsely fulfilled legacy outcomes. Two independent current obligations remain outside that completed historical classification: Host assignment-visibility integration `appdep_3be7de6fa2742a26d35f575b` and provider authority `appdep_5f8a7c0e566e08fc95051414`. They retain their exact return Conditions; this receipt does not duplicate, bypass or pre-judge them.
