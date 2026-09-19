# Obligation coexistence rollout — 2026-09-20

**Status:** Candidate-only handoff. Nothing in this record proves merge, deployment, activation, or live recovery.

## Pinned source

1. Host PR 209, branch `may/task-health-strengthening-7b986648`, commit `11a331279681c135ff822cbc703280e2b8f99825`.
2. Compatible Apps/common-design candidate commit `a0be4b08325c4e570293558156396803ed20c596` in the `/app` repository.

Hao merges the Host PR. The Apps commit must be integrated only after the Host/SDK revision is available; its Evaluation typecheck intentionally depends on that newer contract. Recheck both exact revisions and the PR head immediately before merge. A changed commit requires a new review.

## Verification already completed

- Frozen Host full CI: 3,167 pass, 3 explicit deployment/catalog skips, 0 fail; GitHub Quality and Container passed.
- Exact-Host-SDK Evaluation validation: 175 tests and typecheck pass.
- Exact-Host-SDK May validation: typecheck pass; 23 focused approval/intake tests pass; ordinary May check has 94 pass and one explicit opt-in composition skip.
- Independent production-composition probes: 4 pass and 24 assertions.
- The bounded current-source trial completed all seven permitted model calls. It used real production reconciliation, public projections, report publication, May intake, exact-owner feedback, and an independent recheck in an isolated fixture. It preserved a genuine approval wait and unrelated controls. Its manifest is `/app/.state/review-pilots/task-obligation-root-cause-20260920/current-source-trial-final-a0be4b08/manifest.json`. The initial post-recovery judgment falsely treated `done`/`up-to-date` with `terminal=false` and `ready=false` as inconsistent; corrected guidance recognizes that an accepted outcome can be reconciled while its durable Task remains open for future input. One targeted readback of the same snapshot then assessed it as coherent; receipt and output are under `/app/.state/review-pilots/task-obligation-root-cause-20260920/current-source-trial-status-readback/`.
- Independent Bob and tech-lead reviews found no blocker on the final paired candidate.

These are source/candidate and isolated-trial checks, not installed-runtime evidence.

## Operator sequence

1. Merge PR 209 without rewriting its reviewed source. Record the resulting Host merge commit.
2. Integrate Apps commit `a0be4b08325c4e570293558156396803ed20c596` onto current `/app` main without replacing newer files. Resolve no semantic conflict without refreshed review.
3. Run the repository-required Host and App checks on the integrated revisions. Confirm the installed SDK exposes the reviewed Task reconciliation fields before loading the Apps.
4. Deploy the Host by the normal Host Operations procedure. Deployment authorization is separate from this candidate.
5. Reload/activate the May, Evaluation, and common App definitions only through the normal App-definition release procedure. Record the deployed Host revision and loaded definition hash. Source integration alone is not activation.
6. Leave live Evaluation spend unchanged by default. If Hao explicitly chooses the pilot, set `EVALUATION_AUTO_REVIEW_ENABLED=true`, `EVALUATION_AUTO_REVIEW_INTERVAL_MS=3600000`, `EVALUATION_ASSESSMENT_ALLOWANCE_INTERVAL_MS=86400000`, and `EVALUATION_ASSESSMENT_CALLS_PER_INTERVAL=2`; verify the source invariant `tasks.maxConcurrent: 1`. This permits at most 14 semantic Task-review calls per aligned week; it is not a dollar cap. Record the explicit configuration decision and activation receipt.

## Live checks after activation

Keep live acceptance bounded rather than replaying the destructive/stale/restart CI matrix:

- Use one isolated canary to verify distinct additions, same-identity updates, omission/empty preservation, and exact satisfaction/retirement.
- Verify one retained requested Evaluation review takes capacity before routine sampling and, if budget-deferred, remains queued until its exact `reviewAt`; distinguish unknown/truncated coverage from an empty backlog.
- Recheck the original `/todo` and Telegram/Conversation subjects through their existing owners, including the legitimate focused input associated with event `6361817`; do not delete or mark that input handled.
- Read back current Task state and linked artifacts. Distinguish not reviewed, deferred, insufficient evidence, assessed, and independently rechecked.

Portable CI and the retained composition probes already cover retry, failure, unblock, repair, stale/concurrent results, restart/read-back, checkpoint renewal, early completion, agent/workflow paths, human-action projection, and genuine legacy blocking. Do not reproduce that full matrix against production.

Request independent Evaluation through its existing mechanism for the external May delivery Task and the original release and CLI subjects. Evaluation must not assess its own implementation. If allowance blocks, retain the exact requests and report deferral; an isolated trial is separately labeled preparation evidence.

The original symptom is recovered only after the assigning-owner route, original release/CLI subjects, and healthy controls pass an independent live recheck. PR 201 remains deferred and merged CLI PR 204 remains accepted; do not rewrite stale task scope without its creator.

## Rollback

Before activation, rollback is source-only: revert the Apps integration and Host merge through the repositories' normal reviewed process. After activation, first disable new automatic sampling and restore the prior App-definition release and prior explicit Evaluation configuration. Preserve Task, event, report, allowance, and approval records. Keep the compatible Host revision while persisted `reviewAt`-only waits or newly accepted reconciliation results exist; downgrade it only after proving the older Host can read the pending state or after those obligations drain through normal authorized Task transitions. Any Host rollback uses Host Operations and a prior known-good revision. Do not rebuild or edit the production database, erase pending inputs, or weaken generation/creator fences.
