# Alex improvement migration receipt — 2026-10-04

Status: **candidate in progress; not activated**. Source baseline: Apps commit `64b901d1e4c95a385c4f1d633bbbbe9a99d6f367`. Host deployment receipt: `/app/projects/may-agent/.state/deploy-receipts/main-fc3b9cab3-alex-20261004.json`.

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

The selector no longer excludes the entire Alex App. Ordinary Alex-authored work remains reviewable, while canonical evaluator worker identities including the migrated `alex-evaluator*` profiles remain ineligible as independent subjects, preventing recursive self-review. Alex guidance now says to use the actual Host allowance and finish warning rather than inventing a turn quota; checkpointing is recovery, not a reason to yield.

Remaining before cutover completion: run independent review of the exact diff, commit/integrate the candidate, activate it, verify only May/Alex/Scout are registered with no old controllers, exercise live Alex admission/contribution/return, exercise a focused blocked-Alex-to-May escalation fixture, and complete bounded semantic disposition/replacement for the retained may-agent frontier. This receipt intentionally makes no activation or completion claim.
