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

Omit `--scenario` to run the whole suite. Before trial 1, Gym snapshots the
selected scenario directories and benchmark evaluator. The runner executes
those snapshots, not the live definitions. The command prints the durable run
directory; the baseline is never mutated after creation.

## 2. Diagnose before improving

Read `report.md`, then inspect failed or invalid trials under `cases/`. Classify
the problem before changing anything:

- agent behavior;
- incorrect or unapproved ground truth;
- scorer defect;
- harness/runtime defect.

Only change the responsible layer. If the scorer or ground truth changes, rerun
the baseline as well as the candidate.

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
- at least one improved scenario.

An unchanged perfect baseline therefore does not masquerade as an improvement.
For release decisions, baseline and candidate should cover the full suite and
use at least five trials.

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
