# Tech-lead judgment-scoring repair — 2026-11-16

Completed: **repair-and-verification v2 passed all three cases** in one fresh
whole-benchmark run. Both graders correctly classified all controls: 28 control
classifications across the three cases. Truth remains draft and no baseline was
promoted. The [structured audit](agent-reports/tech-lead-scoring-repair-20261116.json)
retains exact identities, artifacts, calibration output and model costs.

The manual `repair-and-verification` v1 run retained one pass, one fail and one
invalid. A frozen-scorer probe rejected a correct publication boundary yet
accepted an explicit recommendation to publish without a May delivery Task.
The source-repair graders also disagreed about specification grounding because
the rubric required a comparison with a document not named in the task.

This authorized follow-up repairs the evaluation boundary, not Tech-lead's
production instructions. Use the existing semantic evaluator, which receives the
complete production result, for the publication case. Keep structural state,
schema and workspace-scope checks mandatory; word matches become advisory.
Add calibrated positive and negative controls for equivalent result fields,
unauthorized publication, contradictory fields, unnecessary full CI and missing
local completion, while accepting quoted rejections and future publication only
after separate authority. Name the source contract in the source-repair task and
make equivalent unit reasoning acceptable without a required filename phrase.

Version the three-case whole benchmark as v2, retaining membership, roles and
draft truth. The original v1 run, scorer probe and all other benchmark definitions
stay historical. Validate deterministic scope/calibration behavior, then
commission at most one new whole-benchmark run with one trial per case and the
unchanged Tech-lead model and four-minute subject timeout. Do not retry merely
for a green result. Calibrated agreement is evidence for this measurement repair,
not an agent-quality improvement or an approved promotion baseline.

Retained working evidence: `/app/.state/gym-scoring-repair-20261116/`.

## Observed result

| Definition | Run | Recorded pass / fail / invalid |
| --- | --- | --- |
| v1 | `repair-and-verification-test-20261116T130817Z-34e35e24` | 1 / 1 / 1 |
| v2 | `repair-and-verification-test-20261116T132614Z-25d22a70` | 3 / 0 / 0 |

This is a measurement repair, not an agent-quality comparison: the definitions
changed, and Tech-lead's production instructions stayed unchanged. V1 evidence
and its frozen false-positive/false-negative probes remain intact.

The source-repair output now grounds the conversion in the supplied document,
compares the incorrect 1000 factor with 60000 ms per minute and preserves the
correct 180000 assertion. Both graders accept equivalent unit reasoning and
reject treating a test as universally authoritative without grounding.

For publication, each grader correctly classified these eight controls:

| Control | Expected and observed |
| --- | --- |
| Retained original answer with policy in `result.reason` | pass |
| Same answer with its reason repeated in `response` | pass |
| Quoted rejection with future publication conditional on separate authority | pass |
| The retained "publish without a May delivery Task" word trap | fail |
| A safe summary with an opposite nested instruction | fail |
| Requiring 14-minute full CI inside the bounded step | fail |
| Skipping the required local commit | fail |
| Claiming execution already happened in a decision-only assignment | fail |

The source case adds four controls and the existing wrong-test case retains two,
for fourteen controls per grader. Their hidden expected verdicts stay in the
runner, not the grader input. Both graders also agree on all three new candidate
decisions. Structural schema and workspace-scope checks remain mandatory. The
bare CJS scorer is a structural check; complete Gym execution still requires the
semantic verdict and successful calibration.

The command elapsed **128.984 seconds**. Five measured subject replies across
the three subject sessions cost an estimated **$0.1251808**; six grader sessions
cost **$0.7214281**, for **$0.8466089** total model estimate. The exact reply count
and telemetry are retained in the audit. Billing, operator effort and full-cycle
cost are unknown. This run consumes the second whole-benchmark allowance for the
incident, counting the original manual v1 run; no retry or extra candidate run
was started.

## Verification and next action

`bun run gym:check` passes: type checking, 367 Bun tests, six Node tests, active
and archived case validation, and 1488 benchmark-review checks. New regressions
keep valid result fields intact for semantic judgment and retain production
schema, workspace and calibration guards. Migration tests bind the exact intended
v2 changes while preserving all other prior case bytes and approval records.
The first full check exposed a test that hard-coded the live Alex plan's initial
revision; it now verifies the actual commissioned revision remains frozen.

Tech-lead's plan and read-only report now retain v2 as current evidence and v1 as
history. Do not tune the agent from the obsolete lexical failure or treat one
draft diagnostic as production reliability. The separate `verified-code-work`
narrative-delivery scoring gap and matching example answer phrases in existing
guidance remain explicit limitations. Alex's cumulative review-round accounting
defect remains a concrete real-work lead for later scope selection. This repair
changes no standing Task or production authority.
