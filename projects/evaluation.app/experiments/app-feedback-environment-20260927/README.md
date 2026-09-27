# Repairing the App feedback boundary — September 27, 2026

The local baseline is release **v5.2.0**, Host `d116978576cf1be9c830f999f2e3001119c70348`.
Its deployment receipt reports healthy activation and matching built/loaded SHA
`4c23e4c5968a741e0d1b8b60f869e448c3df7a75e393bbd6d077bdb4fe29be60`.
The source candidate is Host `00e0f73f`; merge, activation and behavioral proof
are separate observations.

## Findings and smallest changes

| Observed problem | Change | Limit |
| --- | --- | --- |
| May repeatedly fulfilled a Request without a response, then failed settlement | One shared result schema checks reply requirements before finish and during settlement | Authority, stale revisions and external effects still require transactional checks |
| Evaluation called a linked approval overdue using creation time | Expose the scheduler's current checkpoint and attach computed validity to exact linked Task reads | A due checkpoint warrants inspection; it does not establish a defect |
| Dashboard called completed sessions a success rate | Name the API field and presentation `sessionCompletionRate` | Task-attempt reporting remains separate; neither metric certifies useful output |
| Review treated cancelled `attention` as active work | Use the existing independent `closed` observation | No new lifecycle state or migration is needed |

Human input, Request closure, delegation and cancellation require a nonblank
reply. Automated observations and updates keeping a Request open can stay quiet.
The schema does not decide whether a new human Request exists or whether an
explanation is useful; those remain App judgment.

The exact false-deadline case had observation `2026-09-27T01:55:22.616Z` and
`reviewAfterMs=86400000`. Its next checkpoint is **September 28 at 01:55:22.616Z**,
not a deadline based on the older creation date. The regression includes both
before-due and due cases and checks that current empty Conditions supersede
historical diagnostic entries.

## Verification

- 56 focused Host tests passed, including a real tool loop with scripted model
  choices. An invalid finish stays in the same attempt, then a corrected finish
  closes the Request. This tests mechanics, not unscripted model behavior.
- Evaluation: 219 tests passed; syntax and type checks passed. Its combined
  check stops on pre-existing formatting in five unchanged files (`app.ts`,
  `public-task-evidence.ts`, `task-process-evidence.ts`, its test, and
  `task-report-store.ts`). No passing full-App-check claim is made.
- Common design integrity, typed examples and canonical App checks passed.
- First full Host CI caught the newly exported schema helper missing from the
  reviewed SDK export fixture. The fixture was updated and its test passed;
  final complete CI and local candidate activation are recorded below when run.

Operational logs and exact snapshots are under
`/app/.state/review-pilots/app-feedback-environment-20260927/`.

## Remaining oversight investigation

May received ordinary input event `6459711`, request
`app_0c7e42b1-2dc6-4b13-abe9-56523e6581ef`, to independently inspect Evaluation
failure and unavailable-owner handling using existing routes. This is a
read-only assignment, not authorization to apply a generated improvement.

Known current boundary: `evaluation.review_failed` routes to Evaluation's
existing owner-review Task. Evidence-acquisition failures emit that fact.
Reviewer execution failure returns an incomplete result; the external review
subscription deliberately excludes Evaluation-owned work. Establish the actual
caller/owner response before adding a route. Automatic unavailable-owner
supervisor fallback remains a disclosed design limitation.

A successful release, one corrected result or one accepted report does not prove
the whole unattended improvement loop. Keep independent proof for selection,
useful diagnosis, isolated comparison, human approval, exact application and
post-activation behavior. Do not create a live improvement solely to manufacture
an end-to-end success claim.
