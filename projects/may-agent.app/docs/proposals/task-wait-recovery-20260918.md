# Recovering unanswered input after wait corrections

Status: merged locally and deployed on September 18, 2026. Host `e0e0b846`
includes the original wait recovery candidate `afcefe76`, PR #195 integration
`9b649b91`, and equivalent historical admission recovery. Paired App release:
`425c6c7791`. The original experiment below remains historical evidence;
the rollout section distinguishes portable mechanics from observed live behavior.

## Evidence and scope

Evaluation setup delivered its implementation and reports, but final closure
needed operator assistance. An unnamespaced review wait could not be published
through public event ingress. After correction, the accepted final review
cleared current Conditions while many original/feedback receipts remained
handling: their saved waits referred to replaced Conditions. Separately, repeated
self-unblock actions were classified as stale and immediately retried.

The attempt to let the worker revise its own acceptance was correctly refused.
Trying to publish an unregistered fact through the ordinary registered-event
interface was also an operator error. Neither justifies loosening authority.
Supported owner cancellation eventually retired the old inputs neutrally;
this was assisted closure, not proof those inputs independently succeeded.

## Small common fixes

1. At an already eligible attempt, return inputs with removed or changed saved
   waits through the existing continued-input context. Compare both Condition
   identity and generation. Keep unrelated unchanged waits separate. Bind an
   outcome only through normal accepted-result settlement after the input has
   been supplied for consideration.
2. Include continued-input context in the managed-agent prompt even when the
   new-event list is empty, as can happen at a review/recovery checkpoint.
3. Run the existing prohibition on self-unblock before stale-target validation.
   Report the actionable error through ordinary paced failure recovery, retaining
   the unaccepted candidate. Preserve real concurrency and creator fences.
4. Require namespaced Condition types in the shared SDK schema, normalizer and
   low-level runtime validation, matching public ingress. Do not require a
   centrally registered event for every custom operator fact. Choosing a real
   producer and the appropriate route remains capability/App guidance.

No new input schema, persistence field, migration, queue, controller, retry
policy or Task lifecycle is introduced. Reconsideration is not permission to
complete an unrelated ask. Accepted outcome, receipt fulfillment and explicit
Task closure remain distinct.

## Regression experiment

The pre-fix code fails portable regressions for renamed/revised waits,
unnamespaced wait admission and useful self-action recovery feedback. The
candidate uses the production Task store, admission, claim, wait observation and
settlement paths to exercise:

- original input plus correction across Condition replacement and SQLite reopen;
- unchanged independent input still awaiting its own review;
- a late input preventing acceptance of an earlier result;
- exact accepted-attempt linkage for the reconsidered inputs;
- continued input in the actual managed-agent prompt without a new event;
- one invalid self-action, preserved diagnosis, paced retry and corrected result;
- schema/normalizer agreement, retaining valid custom namespaced facts.

Scripted executor decisions prove these mechanics, not model judgment. They do
not repair historical receipts in the live installation. Runtime rollout and
any retrospective owner action require separate exact, authorized operations.

Validation at the candidate: `bun run check:ci` passes; the full portable
`bun run test` passes 3,117 tests with 3 intentional installation-dependent
skips and 14,178 assertions. New Markdown links resolve and `git diff --check`
passes. The App design-integrity check still reports the unchanged
`workflows.md` exceeding its 900-line limit (909 lines on both baseline and
candidate); it is not reported as a passing gate. No installation test, model
trial, image build or deployment was run for this candidate.

## Relationship to PR #195 and Gym

[Host PR #195](https://github.com/hao1939/may-agent/pull/195) exposes the existing
creator-authorized revision operation to Task-owned workflows and preserves
declared outputs in Task reads. That adapter repair is complementary: it does
not recover obsolete input waits, reclassify self-actions or validate wait event
types. Self-revision remains forbidden with either change.

Review at PR revision `889d53f1`: its GitHub Quality/Container checks pass;
48 focused revision, workflow and read tests also pass locally. Its base is
published main `dd548cab`, which predates the local shared Task-context work.
A merge preview against the current candidate conflicts in the workflow adapter
and workflow-tool tests. During integration, carry the existing fenced revision
capability in `TaskExecutionContext`, including agent-invoked workflows, instead
of limiting the new exposure to direct Task workflow dispatch. Integration
`9b649b91` now implements that shared capability and adds a caller-tool regression
alongside the direct-workflow test. The combined focused checks pass 56 tests;
checks on the PR alone did not establish that combined behavior.

The automatic improvement proposal belongs to
[Gym's report-driven design](../../../gym.app/design/report-driven-improvement.md).
The common contract already supplies the required Task/input/caller mechanism.
Gym can compare isolated behavior candidates; it must not teach an agent to work
around broken Host correlation. Final human approval is required before promotion.

## Rollout and observed limits

The final Host revision passes `check:ci` and the complete portable suite:
3,121 pass, 3 intentional installation-dependent skips, zero failures and
14,220 assertions. The paired common design check also passes; the earlier
workflow document length failure was resolved in the integrated design source.
Matching binary, SDK, Console and UI artifacts were activated with the immutable
App source, and readiness plus artifact/revision identity checks passed.

The live Gym trial exposed old inputs with missing admission links and two saved
aliases. Recovery now reuses aliases only when every bound authority and result
field agrees, ignoring only the admission timestamp. Thirteen equivalent inputs
settled through normal Host recovery after restart. One conflicting historical
input remains unlinked: recovery must not guess its accepted answer. Task
cancellation and historical results remain unchanged. The focused inbox suite
passes 41 tests, including conflict preservation and idempotent recovery.

The initial cutover used the existing fenced operator APIs to retire 41 exact
obsolete Gym Tasks and import 675 historical completion receipts, linking 271
inputs. This was an explicit operator migration, not autonomous agent repair.
The follow-up deployment needed no repeat migration. The initial UI permission
and history-compatibility failures, restoration evidence and successful
activations remain in the installation's ignored review evidence directory.

Live May first submitted an invalid Topic-less follow-up, received a useful
error with paced recovery, then corrected it. That demonstrates this recovery
path in use; it does not prove every historical wait correction through a model.
The App trial and the remaining benchmark limitations are recorded in
[the improvement-loop rollout](../../../may.app/design/evaluation-improvement-rollout-20260918.md).
