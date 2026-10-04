# Alex improvement migration receipt — 2026-10-04

Status: **team source activated; legacy continuation remains open**. Final reviewed candidate `677c785f89c5a2854eda2d2533f35fa5ee4dcc31` is an ancestor of Apps main `06f9c03922f523524d89341a88f783c2f373cfdf`. Source-fenced reload `alex-team-06f9c03922-20261004` completed successfully in event `6643042`; receipts: `/app/.state/alex-migration-20261004/team-activation-result.json` and `team-activation-admission.json`. Source baseline: Apps commit `64b901d1e4c95a385c4f1d633bbbbe9a99d6f367`. Host deployment receipt: `/app/projects/may-agent/.state/deploy-receipts/main-fc3b9cab3-alex-20261004.json`.

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
