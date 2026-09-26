# Gym comparison objectives: implementation and trial

September 26, 2026. Isolated source branch:
`fix/gym-efficiency-comparison-20260926`. This change adds observed execution
duration as a comparison objective while preserving separate quality evidence.
It does not deploy an agent change or train model weights.

## Problem and resulting behavior

Previously, Gym required more passing trials to support a candidate. A faster
candidate with unchanged quality could only receive a hold. A comparison also
appeared near the bottom of the report, and regenerating the report after a human
adjudication omitted its saved comparison.

The owner can now declare either the existing quality objective or a minimum
reduction in measured execution duration. The runner saves it before baseline
execution and verification inherits it. The App checks the same objective on
input and return. The report shows the current comparison first and retains it
when human reviews are recorded.

The smallest implementation uses timing already supplied by the runner. Model
calls, tokens and money remain deferred until complete, consistent measurements
exist. Duration is not a cost estimate. No new workflow, scheduler, approval
mechanism or learning controller was introduced.

The shared parser/type is in `projects/gym/src/loop/objective.ts`, exposed as
`@may-agent/gym/comparison`. The runner stores the objective in its manifest and
frozen inputs; `compareRuns` computes independent quality and duration results.
The App imports that same contract. Existing callers and historical manifests
without an objective retain quality semantics. All existing evidence, framework,
truth and regression requirements remain in force.

## How to use and read it

Declare the duration objective on the baseline command, for example:

```bash
bun src/loop/cli.ts test --benchmark may-alignment --agent may --trials 3 \
  --objective duration_ms --min-reduction-percent 20
```

Verification uses its existing command; it inherits the baseline objective.
The Gym workflow request repeats the same objective:

```json
{ "objective": { "metric": "duration_ms", "min_reduction_percent": 20 } }
```

Read the report's comparison summary first: the requested benefit, measured
attainment, quality observations, evidence coverage and gate. Then inspect
per-scenario results and exact trial artifacts. `improved` retains its original
quality meaning. `objective_met` records whether the measured benefit target was
met, independently of quality; null means unknown. Thus a measured duration
benefit and a quality regression can both be true, and the gate still fails.

Human review considers absolute quality, remaining failures, slower cases,
variance, maintenance cost and the simpler alternative. A supported measurement
does not approve application or establish statistical confidence. The assigning
owner retains the existing human approval process.

## Trial and checks

The production baseline CLI, verification CLI and App receipt path were exercised
with a deterministic scenario executor. Four scenarios used synthetic truth,
model/framework identities and execution timings. These are contract tests, not
real model-performance results or human-approved production benchmark labels.

| Control                                                      | Observed result                                           |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| Same quality; duration 1,000 to 700 ms per trial; target 20% | Benefit met, quality unchanged, candidate supported       |
| Same quality; unchanged duration                             | Benefit unmet, hold                                       |
| Faster duration; a required scenario loses a pass            | Benefit met and quality regression both visible, hold     |
| Same quality; missing candidate timing                       | Duration target unknown, hold                             |
| Request names a different objective                          | Rejected before candidate execution                       |
| Returned comparison names a different objective              | Output not accepted, hold                                 |
| Baseline manifest threshold edited after execution           | Frozen objective mismatch, hold before scenario execution |

Additional controls cover exact threshold attainment, insufficient reduction,
invalid objective values, zero baseline timing, negative/nonfinite/missing
timing, quality improvement with unavailable timing, unchanged historical
quality semantics, aggregate pass counts hiding a per-scenario regression,
report ordering and comparison preservation after adjudication. Existing
partial/invalid runs, truth and provenance checks, subprocess failure and
cancellation tests remain passing.

Validation commands are the normal `bun run check` in `projects/gym` and
`projects/gym.app`. Logs, diagnostic script and source identity are retained in
[/app/.state/review-pilots/gym-efficiency-comparison-20260926](/app/.state/review-pilots/gym-efficiency-comparison-20260926).

## Rereading retained real-model evidence

The diagnostic script verifies the retained PR #230 index hashes and joins
scores with the original behavior review by run and receipt identity. It does
not rescore or modify those runs.

| Observation                               |   Baseline | PR #230 candidate |
| ----------------------------------------- | ---------: | ----------------: |
| Full contract checks passed               |      15/17 |             15/17 |
| Model calls                               |        136 |                90 |
| Request bytes                             |  7,574,755 |         4,345,716 |
| Sum of historical experiment elapsed time | 627,378 ms |        415,405 ms |
| Reuse case passes                         |        5/5 |               4/5 |
| Compaction case passes                    |        1/3 |               2/3 |

The candidate used fewer calls and input bytes in the retained trial. Equal
aggregate quality concealed different outcomes by case. The new report design
makes both the efficiency benefit and the quality tradeoff visible; it does not
treat one as erasing the other.

These historical runs are diagnostic evidence, not eligible new Gym comparison
baselines. They used different Host revisions and uneven trial counts between
scenarios; this refinement's duration threshold was not predeclared. Their
`elapsedMs` timer also differs from Gym's `duration_ms` boundary. No production
gate result, monetary savings claim or population reliability claim follows.

The next behavior experiment should use the final runner, a fresh baseline,
the same framework and a predeclared objective. An instruction candidate is
within the existing comparison scope. Choose repeated cases and stable load
appropriate to the decision; avoid treating a small timing fluctuation as
proof of improvement.
