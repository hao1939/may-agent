# Existing Task backlog live disposition — 2026-11-08

**Supports:** [Carry work through change and interruption](../../2a-design/system-model.md#carry-work-through-change-and-interruption).
**Choice basis:** [Simple first](../../1-principles/core-principles.md#simple-first): apply scoped owner decisions through existing guarded controls.

The [November 7 trial](task-backlog-disposition-trial-20261107.md) stopped after
evidence collection, eight substantive reviews and isolated closure verification.
It did not apply those decisions to live work. This was an execution gap, not
an installed operator-capability blocker. The backlog reader remains read-only;
its `owner-review` route is neither a closure decision nor an automatic job.

## Applied owner decisions

On November 8, 00:34–00:36 Asia/Shanghai (November 7, 16:34–16:36 UTC), nine
reviewed Alex assignments were closed in the live installation:

| Assignment | Scope ended |
| --- | --- |
| `input/app_000c3f79-58a6-46ab-9b71-5bed7565c977` | Finite report intake and supported disposition. |
| `input/app_00806e77-7fe4-47bc-8082-d5063f98fa9f` | Finite report intake and supported disposition. |
| `input/app_02353566-bfd6-4b17-85ed-265e27794304` | Finite report intake and supported disposition. |
| `input/app_0263968f-de1a-443d-a65f-e460c5715b54` | Finite report intake and supported disposition. |
| `input/app_033b87ed-2104-4947-963f-0aaf5b4e90e1` | Finite report intake and supported disposition. |
| `review/alex-input-app_004df513-2f74-4641-8aea-c4cce1d7b1cf-1-current-evaluator--e2e6e52126dd` | Independent bounded snapshot assessment. |
| `review/alex-input-app_004df513-2f74-4641-8aea-c4cce1d7b1cf-current-current-eval-a658d6ff80f9` | Independent bounded snapshot assessment. |
| `review/alex-input-app_16722bb9-58b9-46d4-a124-4f9a462c23d4-current-current-eval-8b385f88ad4c` | Independent bounded snapshot assessment. |
| `input/app_9ad9d5ec-02b5-4b94-a105-ef6c85815694` | Alert-5013 bounded latency investigation; supported no-change decision. |

For the first eight, the full original assignment, accepted scope and current
generation/version/accepted-attempt identity matched the individually reviewed
evidence. Immutable publications were reverified with the existing readers.
Their subjects' independent work, cleanup and caller promises remained owned.
Closing a report assignment does not certify its subject as fulfilled.

The ninth assignment permitted an evidence-backed no-change disposition. Its
accepted decision artifact was reverified at SHA-256
`d71a9da25931e3007f51f21e03da037e74ed64a98018241ff902adfd9286dcfb`.
Closure preserves the inconclusive root-cause finding and future reconsideration
thresholds; it does not certify all future latency issues as resolved.

Each operation used the installed operator `task.close` with an explicit reason,
`expectedGeneration`, `expectedResourceVersion` and exact `afterResult` accepted
attempt. No direct database mutation was used. Accepted control receipt event
IDs were `6685825`, `6685827`, `6685829`, `6685831`, `6685833`, `6685835`,
`6685837`, `6685839` and `6685847`. Exact read-back confirmed `status: closed`
and `terminal: true`. The older SDK may display `done` with `closed: true`.

## Verification and remaining work

At the final verification snapshot, the original 531 owner-review candidates
contained **nine closed and 522 still open/converged**. The complete current
545-record population contained 526 converged, nine closed, five waiting and
five cancelled. Population changes from the earlier 544-record/six-wait trial
occurred before these operations and were not caused by the closures.

All 536 resources outside the nine closures, all five current Conditions and
all nine accepted attempts were unchanged from the fresh pre-operation snapshot.
Facts, results and independent waits were preserved. This used the existing
installed operator capability; no Host deployment, restart or PR merge occurred.

Local operational evidence is retained under
`.state/task-disposition-live-20261108/`: `before.json`, `prepared-plan.json`,
`latency-review.json`, `operations.jsonl` and `verification.json`. These are
private installation records, not source fixtures. The apply scripts have
already run and must not be blindly replayed.

The next ten remaining identities are saved in `next-batch-ids.json`. They are
prepared candidates, not completed semantic reviews. No automatic owner-review
job for the remaining 522 was started by this operation.

Continue bounded review against each assignment's original scope. Apply and
verify each justified ending as the review finishes. Otherwise retain a concrete
next action in the existing Task: continue useful work, wait on its exact external
dependency, or preserve a standing purpose with a declared wake route. An idle
label alone supplies none of those decisions. Where creator authority is missing,
use the supported trusted App/operator route rather than guessing provenance.

## Follow-through across the three loaded Apps

The subsequent bounded review used a new baseline captured at
2026-11-08T11:47:42.438Z, after the nine operations above. It contained 756 idle
Tasks. Each saved page was reviewed against original input/acceptance, accepted
results and exact caller obligations. Batches held at most ten decisions.

| App | Baseline idle | Additional verified closures | Retained baseline |
| --- | ---: | ---: | ---: |
| Alex | 514 | 480 | 34 |
| May | 178 | 163 | 15 |
| Scout | 64 | 54 | 10 |
| Total | 756 | 697 | 59 |

These 697 closures are additional to the earlier nine. They cover finite report
intakes, independent assessments and completed bounded assignments. Four ended
invalid or insufficient-evidence assessment scopes as non-success: one pinned
snapshot had changed and three selected Evaluation workers as independent
subjects. None was recorded as a published positive assessment or fulfillment
of its subject. Scout closure decisions checked actual immutable publication
commits and canonical files, not helper summaries that only said a candidate
was ready; 51 output blobs were verified from their accepted commits.

Each close used the installed trusted operator control with fresh generation,
resource version and accepted-attempt fences and an individual disposition
reason. Read-back confirmed all 697 closed and terminal. Each receipt preserves
the exact accepted attempt/evidence, facts/result, original input/acceptance and
Conditions. No direct database writes, cancellation, deletion, disk cleanup,
mass retry or new review Task was used for this pass.

### Retained responsibilities and moving population

The [59-entry retention ledger](task-backlog-retained-20261108.json) records
reviewed identities, accountable owners, reasons and next evidence/return routes.
It is a dated decision record, not another queue or authority to replay controls.

- **37 standing/reusable routes:** Alex 23, May 8 and Scout 6. These retain
  declared input, schedule or relevant-change routes, including Conversations
  and stable metric/reviewer routes.
- **22 finite obligations:** Alex 11, May 7 and Scout 4. These retain actual
  implementation, delivery, receipt, human-decision or verification work.
  Several protected-delivery requirements were missed; creator non-success or
  remedial disposition remains required. Merge or convergence cannot supply
  retrospective approval.

The final snapshot at 2026-11-08T12:06:49.055Z contained:

| App | All Tasks | Closed | Idle | Waiting | Running | Cancelled | Attention |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Alex | 553 | 508 | 34 | 5 | 1 | 5 | 0 |
| May | 494 | 351 | 15 | 11 | 0 | 114 | 3 |
| Scout | 97 | 78 | 9 | 1 | 1 | 0 | 8 |

There were **58 currently idle Tasks**. Of the 59 retained baseline Tasks,
57 were idle and two running: Alex's worktree-capacity admission correction and
Scout's HN scan. One new Alex arrival,
`input/app_7192688f-9733-426b-a267-f6e6f43634d4`, was idle. Existing waiting and
attention work outside the baseline remains owned. Eight non-target records
changed during ordinary runtime activity; no whole-database invariance claim is
made. Per-target preservation is verified by the individual closure receipts.

### Recurrence repair and remaining integration gap

Review Task IDs previously depended only on subject/evidence/reviewer. A later
admission for the same unpinned subject could select its already closed Task.
The App mapping now includes the durable admitted-input identity: replay keeps
the same Task, while a later independent admission gets another finite Task.
Pinned and unpinned regression cases preserve input and acceptance. Stable
metric and Conversation routes retain their reusable identities.

Focused mapping, disposition-reader and selector checks passed: **74 tests,
0 failures, 821 expectations**. This repairs admission after closure; it does
not consume or close future accepted review results.

Source commit `6a7e49843c5d2c8cccd7615b991472856d43f8d4` was activated through
the supported pinned App-definition reload at 2026-11-08T12:09:27.697Z.
Request `finite-review-admission-20261108-6a7e49843c` was accepted as event
`6691799`; correlated completion `6691805` reported `ok: true`, the same full
source commit and three task-enabled Apps. The active source link and release
manifest match that commit. Loaded Alex `app.ts` matches the committed bytes,
SHA-256 `11dfcf174a51a1cae5351cf8353d72e1ba6408c17472945c16e7d2e6a67fffaf`.
No Host binary deployment or restart was needed. Existing executions retain
their selected snapshot; the reload establishes source for newly selected work.
Exact request, admission, completion and source verification are retained in
the private evidence directory as `reload-*.json`.

The required `bun run check:may-design` passed design integrity and executable
examples, but the canonical-App check still fails on the existing retired aliases
`evaluation.app`, `gym.app` and `may-agent.app`, which lack canonical `app.ts`.
Those paths were unchanged. The five existing root-layout warnings also remain.

The source boundary remains explicit: workers cannot self-close;
`ctx.closeTask` is creator-authorized; App-created roots need trusted App/operator
disposition. `AppTaskPolicy` has no trusted post-result closure hook, and the
outcome selector does not consume completed reviews for root closure. Do not
hide privileged socket mutations inside a workflow or observer to bypass those
boundaries. Completing this authorized result-consumption path and demonstrating
a new finite assignment's ending remains the first milestone. Budgets and a
new cleanup controller are deferred.

Private operational evidence is retained in
`.state/task-disposition-followthrough-20261108/`: saved read batches,
`operations.jsonl`, individual `closed-*.json` receipts, final inventory and
`verification.json`. The latter indexes all 697 receipt hashes and verifies the
baseline remainder. Plans already ran; re-read current identities before any
further action. The public retention ledger contains navigation and judgments,
not the full private transcripts.
