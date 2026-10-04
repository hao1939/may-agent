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

Remaining before migration completion: exercise the focused blocked-Alex-to-May escalation path, decide/admit exact useful continuations or evidenced supersessions for the retained frontier while preserving caller/Condition relationships, and verify returned continuation evidence. This receipt makes the activation claim above but intentionally does not claim the semantic migration is complete.
