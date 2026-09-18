# Improvement-loop live verification, September 19, 2026

This record supplements, and does not rewrite, the
[September 18 rollout](evaluation-improvement-rollout-20260918.md). The human
authorized deployment of the already reviewed and merged loop plus supervised
correction of rollout prerequisites. That authority was not blanket approval for
future generated improvements.

## Current installed state

- Host `0d25ab157ad7de6693be46781ca65a8341017804` is live. Deployment
  correlation `improvement-loop-rollout-0d25ab1-20260918` completed with its
  receipt source commit matching that intended Git commit. Receipt `artifactSha`,
  `loadedArtifactSha`, and the independently measured live binary SHA all equal
  `303b6b4166a8d18fe0b95e67815fa6379fbd137f3c4e3b556c52a3593b8b38b5`;
  health is `healthy`.
- App definitions `9eab4e18cb56cd3fabdb0a803579f4bc38d7e35c` are loaded. The pinned
  reload completed at event `6352472`, and an independent check matched the
  current release manifest to that source revision.
- The deployed SDK release was correct, but `/app/node_modules/@may-agent/sdk`
  was an older copied package. Dynamic App imports use normal package
  resolution, so the valid `sdk-current` artifact alone did not prove adoption.
  The old copy was preserved and the installation was corrected to the existing
  stable `sdk-current` linkage. A fresh process in the active May release then
  resolved `sdk-0d25ab15`, exposed `events.read`, and the same eight previously
  failing App tests passed.

The first deployment attempt produced no deployment receipt or activation. Its
portable archive tests inherited `MAY_TASK_ATTEMPT_CHILD=1`, correctly refused
to initialize fixture databases, and failed before staging or restart. The exact
merged source was operationally retried with `MAY_TASK_ATTEMPT_CHILD` removed
for the whole approved deploy invocation. A focused Host candidate makes the
permanent correction narrower: only the portable archive-test command loses the
worker flag, while the parent receipt, build and runtime database guard retain
it:
`0d25ab157ad7de6693be46781ca65a8341017804..00a380b54be022017f0d455d2212f011fe124a90`.
It is committed, reviewed, and tested as [Host PR #199](https://github.com/hao1939/may-agent/pull/199),
but is not live. Hosted Quality and Container checks passed for exact head
`00a380b54be022017f0d455d2212f011fe124a90`; integration is waiting for the
independent maintainer approval required by repository rules. The next step is
for an eligible maintainer to review and approve that exact head, after which it
can be merged and deployed through the existing receipt-bound path without the
outer environment workaround.

## Real loop observation

May explicitly requested review of the closed Task
`conversation/app_05d8a913-ff96-48a5-87ea-5c95850ddc37` through
`review-task-outcome` request event `6352497`. Evaluation publication event
`6352505` assessed it at evidence hash
`9b72e9b47ad6029124411465fcee9a28f6d088c2415628a0e63d1eb7b3ae3121`.
Independent read-back matched both immutable JSON and Markdown hashes. May's
intake was automatic: it reread the current subject and converged at event
`6352528` with an agent-owned, justified no-change disposition. This was useful
successful work, no user-impacting defect or worthwhile opportunity was
evidenced, recurrence risk was not indicated, and leaving the behavior unchanged
was the simpler option. May created no candidate, comparison, approval packet,
deployment, or duplicate tracking Task.

This is production-path evidence for an explicitly requested real Evaluation
publication, readable report bytes, automatic May intake, and May's necessity
judgment. It is not automatic-selector proof or human approval. It is deliberately
a no-op trial and does not demonstrate that a future behavioral candidate
improves outcomes.

The report's `sourceRevision` is `425c6c77917857187953944f50a1f74a853359a4`,
not the loaded App revision above. `task-outcome-review.ts` obtained that value
from the manually configured `EVALUATION_SOURCE_REVISION`. The field can be
stale and must not be treated as executed-code identity. The immutable report is
preserved as emitted; the loaded release manifest and activation event are the
adoption evidence.

## Synthetic composition coverage

Codex reran the maintained composition harness against the canonical installed
sources for the connected positive and full-follow-up scenarios. Their denial
prelude also covered cancelled, terminal, new-generation and superseded owner
state. Broader negative, stale, mismatched, duplicate, actor-binding, target-drift
and failure cases remain covered by the previously retained matrix and focused
unit/integration tests; they were not all rerun in this live-rollout harness.
Provider input and provenance in these deterministic production-module fixtures
were simulated. The run used no external Telegram send and made no live source
mutation.

Consequently, exact packet/application mechanics have exercised composition
evidence, but no fixture is a human decision. An actual authenticated human
Telegram reply has not yet occurred and remains explicitly unverified.
Independent post-adoption Evaluation of a real worthwhile improvement also
remains future work; a daily sample is not a substitute for that explicit
follow-up.

## Verification and retained evidence

Operational evidence is retained under
`.state/review-pilots/improvement-loop-live-20260919/`, including:

- `deployment-independent-check.json` and
  `apps-activation-events-independent.json` for live Host/App identity;
- `sdk-link-correction.json` and `apps-sdk-resolution-after.log` for actual SDK
  resolution after the installation correction;
- `live-report-independent-readback.json` and
  `live-disposition-independent.json` for the real Evaluation-to-May no-op;
- `composition-independent-positive.json` and
  `composition-independent-full-follow-up.json` for explicitly synthetic
  composition coverage;
- `deploy-env-regression-strengthened.log` for the bounded temporary-Git-fixture
  regression (26 pass, zero fail); and
- `deploy-env-candidate-ci-portable.log` for full Host verification (3,137 pass,
  three explicit skips, zero fail).

The earlier failed deployment, stale-SDK test run, misconfigured inherited-env
CI run, and first harness invocation without `RESULT_PATH` are retained as
failures rather than relabeled as runtime success.

## Release observations, not a new mechanism

The combined live and synthetic evidence distinguished source integration,
artifact staging, dependency resolution, process readiness, loaded App
definitions, model behavior, human approval, source application, activation and
independent outcome review; it did not show a live human approval or beneficial
post-adoption review. Future release work should seek one small common way to
expose intended versus actual Host/SDK/App identities and the next verification
action using existing receipts and authorities. It should also define what new
attempts load while older work drains. Those are observations for a later
proposal, not authorization to add a release registry or broaden this
correction.
