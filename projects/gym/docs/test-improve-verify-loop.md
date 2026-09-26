# Test → Improve → Verify

Gym treats agent improvement as an evidence-preserving comparison, not as a
sequence of reruns until a test turns green.

```text
approve expected behavior
        ↓
freeze test inputs → baseline run → diagnose
        ↓                            ↓
   immutable artifacts         isolated candidate
        ↓                            ↓
        └──────── same tests → verification comparison
                                      ↓
                         human adjudication and merge
```

## Evaluation boundaries

Every trial has three distinct states:

1. **Run validity** — did the intended agent, model, prompt, runtime, and scorer
   execute successfully and produce complete evidence?
2. **Machine verdict** — did deterministic checks pass against the frozen
   ground truth?
3. **Human adjudication** — does the observed decision actually match the
   intended outcome?

Runtime or scorer failures are `invalid`; they are never counted as agent
failures or passes. Machine results are evidence, not human-approved truth.

Gym tests three different layers. Passing one does not imply the others pass:

1. **Preference** — what the agent says it understands in a decision artifact.
2. **Agent behavior** — what the agent actually applies across one or more
   turns, including clarification, routing, follow-up, and human communication.
3. **Runtime behavior** — whether request traces, owner tasks, completion
   evidence, reply targets, and deduplication survive execution-session loss.

Behavior and runtime scenarios score the full trajectory. Their ground truth
includes accepted action receipts and final durable state, not only
`alignment-decision.json`. A final answer cannot repair an action that was
never applied, was attached to the wrong request, or produced a duplicate
human message.

## Ground truth and evaluation

The right answer does not come from the agent or from the run report. It has
three versioned parts:

- each scenario's `expected.json` is the executable expected behavior;
- `success_criteria.js` and the benchmark evaluator compare the agent artifact
  with that expectation;
- the benchmark's `labels.json` records whether a human has approved that
  expectation, its provenance, and why it is correct.

The label catalog is approval metadata, not a second answer key. A label records:

- `draft` or `approved` status;
- synthetic, adversarial, or real-replay provenance;
- the rationale for the expected behavior;
- reviewer and approval timestamp.

Verification cannot pass its release gate while any selected label remains
draft. Editing `expected.json`, its scorer, the evaluator, or a label after a
baseline invalidates the comparison; start a new baseline so both versions use
the same frozen inputs.

When several benchmarks reuse one evaluator, that evaluator's benchmark may
carry narrow scenario overlays under `scenarios/<scenario>/`. Gym copies the
canonical scenario first, then copies this overlay into the frozen run input.
This keeps scorer-specific expectations and semantic calibration controls with
their responsible evaluator while preserving one immutable input fingerprint.
Overlay truth still requires the scenario's normal human-approved label, and
changing an overlay requires a fresh baseline.

## 1. Test the baseline

From `projects/gym`:

```bash
GYM_AGENTS_ROOT=/app/agents \
bun run loop -- test \
  --benchmark may-alignment \
  --scenario may-align-proof-before-adopt \
  --agent may \
  --trials 3
```

Declare the intended benefit before the baseline. The default is quality:
more passing trials without a per-scenario regression. To measure execution
time instead, add:

```bash
--objective duration_ms --min-reduction-percent 20
```

This objective requires at least 20% lower total observed execution duration
across the complete matched trial grid, with no per-scenario quality regression.
It is saved in the manifest and `inputs/comparison-objective.json` before trial 1
and included in the frozen input fingerprint. Verification inherits it; changing
it requires a fresh baseline. The App's comparison request must name the same
objective. An omitted objective on a historical manifest means quality; all
other provenance requirements still apply.

Omit `--scenario` to run the whole suite. Before trial 1, Gym snapshots the
selected scenario directories and benchmark evaluator. The runner executes
those snapshots, not the live definitions. The command prints the durable run
directory; the baseline is never mutated after creation.

The run directory is also the recovery boundary. If an owning workflow times
out while the runner is finishing, a later reconcile may reuse the completed
run only when the full manifest and comparison exactly match the pending
baseline, candidate fingerprint, scenarios, and trials.

## 2. Diagnose before improving

Read `report.md`, then inspect failed or invalid trials under `cases/`. Classify
the problem before changing anything:

- agent behavior;
- incorrect or unapproved ground truth;
- scorer defect;
- harness/runtime defect.

Only change the responsible layer. If the scorer or ground truth changes, rerun
the baseline as well as the candidate.

When developing a scorer, re-evaluate the already captured answers first:

```bash
bun run loop -- rescore --run <run-id>
```

Rescoring is diagnostic and non-destructive. It writes a separate artifact
under the run's `rescoring/` directory and never changes the original machine
verdicts, frozen inputs, or report. Once the scorer and truth are accepted,
create a fresh baseline for any release comparison.

## 3. Improve in isolation

Use an ignored agent overlay such as:

```text
/app/agents/.lab/may-candidate/
└── AGENTS.md
```

Keep the candidate change narrow and reviewable. Gym does not automatically
rewrite or promote the real agent.

## 4. Verify against the frozen baseline

```bash
GYM_AGENTS_ROOT=/app/agents \
bun run loop -- verify \
  --baseline <baseline-run-id-or-directory> \
  --candidate may-candidate \
  --trials 3
```

The verification gate requires:

- approved labels;
- no invalid trials;
- no scenario regression;
- the benefit declared by the frozen objective: more passing trials for quality,
  or a measured duration reduction meeting the specified threshold.

An unchanged perfect baseline with unchanged timing is not an improvement.
Equal quality can support a timing benefit when duration was the declared
objective. `comparison.json` retains `improved` as quality improvement, and adds
`objective`, `objective_met` (true, false or null), and per-scenario/overall
`duration` observations. Missing, negative or nonfinite timings produce unknown
coverage and totals; a zero baseline leaves percentage reduction unknown.
Unknown timing cannot pass a timing objective and does not erase quality
findings. A known quality regression still fails the gate. A quality objective
can pass without timing evidence.

Read the report's objective and overall observations first, then per-scenario
quality and duration, then linked trial evidence. All selected trials contribute
to total execution time, including valid behavioral failures. Fewer passes in
one scenario cannot be offset by gains elsewhere. A faster total may include
slower individual scenarios; review those tradeoffs and absolute failure counts.
The machine gate is evidence for May's judgment, not automatic approval.

Duration covers the scenario's agent execution phases and their orchestration,
before final scoring. It is not billing or complete benchmark wall clock. Keep
one-time optimization spend separate. Repeat matched comparisons when timing
noise could change the decision; the reduction threshold alone is not proof of
statistical significance. Compare the simplest useful alternative and report
maintenance cost alongside the measured benefit.
For release decisions, baseline and candidate should cover the full suite and
use at least five trials.

### Verification-only adjustments

Sometimes a human rejects a benchmark or scorer proposal but keeps the exact
candidate. If the requested change is only a better comparison, do not edit the
benchmark and do not rebuild the candidate. Record the exact candidate
fingerprint and benchmark, select every active scenario from `suite.json`, and
require every selected label to be approved. Run a fresh five-trial baseline
and candidate comparison. The candidate may proceed only when it matches the
requested fingerprint, uses the same framework as the baseline, passes every
trial, and has no invalid runs or regressions. Draft transfer labels cannot
authorize promotion.

## 5. Adjudicate

Record a human verdict without rewriting machine evidence:

```bash
bun run loop -- review \
  --run <run-id> \
  --scenario may-align-proof-before-adopt \
  --trial 1 \
  --verdict pass \
  --reviewer hao \
  --reason "The bounded experiment matches the intended outcome."
```

Reviews use only `pass` or `fail`. If an automated failure is wrong, record a
human `pass` with `--classification ground-truth|scorer|harness`. A human
`fail` requires a classification so a behavior problem cannot silently absorb
a benchmark defect. Optional repeatable `--reason-code` values (for example
`scorer-false-positive`, `wrong-owner`, or `too-verbose`) make recurring
findings aggregatable without replacing the written reason.

Reviews are append-only JSONL. Re-running `report` includes every adjudication:

```bash
bun run loop -- report --run <run-id>
```

## Durable evidence

```text
.state/benchmarks/<run-id>/
├── manifest.json
├── inputs/
│   ├── benchmarks/<benchmark>/
│   │   ├── suite.json
│   │   ├── labels.json
│   │   └── <evaluator>
│   └── scenarios/<scenario>/
│       ├── task.md
│       ├── expected.json
│       ├── success_criteria.js
│       └── environment/
├── report.md
├── reviews.jsonl
├── comparison.json
└── cases/<scenario>/trial-<n>/
    ├── task.md
    ├── expected.json
    ├── scenario.json
    ├── result.json
    ├── evaluation.json
    ├── checks.json
    ├── alignment-decision.json
    ├── transcript.jsonl
    ├── runner.stderr.log
    └── session/
```

The state directory is ignored by Git. Commit only benchmark definitions,
approved labels, implementation changes, and intentionally redacted evidence.
Promotion remains a normal reviewed pull request that a human merges manually.
