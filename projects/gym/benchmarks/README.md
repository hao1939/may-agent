# Gym Benchmarks

> **Case = one test. Benchmark = a versioned collection of cases and evaluation
> rules. Agent/target = the subject. Run = their execution and retained results.**

A benchmark selects one or more cases and defines shared scoring, defaults,
reporting and human-review rules. It does **not** own or define the agent/App
being tested. The relationship is not 1:1: an agent can take several benchmarks,
and a benchmark can test compatible agents or candidate versions in separate runs.
A role in a name such as `bob-judgment` identifies the collection's focus and
usual target, not exclusive ownership.

“Scenario” means case in the existing paths and CLI; `suite.json` is the
machine-readable benchmark definition. For reuse, storage and target selection,
read [cases, benchmarks, agents and runs](../docs/cases-benchmarks-and-agents.md).

Benchmarks serve two purposes: **judgment** (choosing an approach aligned with
our expectations) and **behavior** (actually doing the expected thing). Declare
`evaluation_kind: "judgment"` or `"behavior"` in `suite.json`, with case-level
overrides when needed. Missing classifications remain unclassified. Report
these separately; do not present decision-only passes as execution evidence.
The role decision suites are judgment tests, not behavior coverage.
`core-behavior` is the first separately executable, draft behavior slice.

## Start with the small core selection

Start with [`REVIEW.md`](REVIEW.md) to review the proposed situations and expected
answers in plain language. [`CORE.md`](CORE.md) has the six draft expectation
pairs (12 judgment cases), five executable behavior cases, commands and details.
The review direction is approved; revised exact answers and checks remain draft.
`core_scenarios` in each participating suite defines its small core; other cases
remain extended regressions. Use `gym test --benchmark <suite> --core` to select
it. Selection is not human approval; all current core labels remain draft.
The suite's default role is used unless `--agent`/`--target` overrides it.
A separate [real-work proposal](REAL-WORK-REVIEW.md) describes a hosted diagnosis
repair with recovery and delivery. It is not executable or approved yet.

Before running, define acceptable choices/outcomes, forbidden choices/effects,
and the evidence that will establish or disprove them. A scorer is an
implementation of human-reviewed expectations, not an authority to approve
truth. See [expectations and limits](../docs/expectations-and-limits.md).

Keep hidden expectations outside the agent-visible fixture. Generated runs and
reports belong under `.state/`; approved labels and append-only human reviews
remain version-controlled with the benchmark.

---

## Single-File Case Authoring (`cases.json` or `suite.json#cases`)

Instead of scattering multiple files across `scenarios/<id>/` (`scenario.json`,
`task.md`, `expected.json`, `semantic_criteria.md`, `semantic_controls.json`,
`success_criteria.js`) and manually editing both `suite.json` and `labels.json`,
you can add a new benchmark case by editing **one file**:
`benchmarks/<benchmark>/cases.json` (or the `cases` array inside `suite.json`).

Cases without a label default to `draft`, with no reviewer or approval date.
Explicit `approved` labels require a non-empty `approved_by` and valid
`approved_at`; Gym rejects incomplete approval metadata. A separate label
catalog takes precedence over an inline label. The pending-review queue includes
drafts from both formats, including inline `review_status: "withheld"` controls.
Drafts can run for diagnosis, but cannot authorize verification. After truth
approval, create a fresh baseline before comparing a candidate.

All agent judgment benchmarks use the production `TaskReconcileResult` contract
(`output_contract: "task-agent-result"`, `artifact: "task-result.json"` via
`finish()`) and provide only situational facts and optional real workspace
`files` in the scenario—never prescriptive answer rules (`<Agent> should/must`):

```json
[
  {
    "id": "may-align-inline-example",
    "description": "What this case tests in plain language.",
    "task": "Clean up the obsolete projects.\n\n# Projects\n- `legacy-alerts`: inactive 120 days, fully superseded.\n- `auth-recovery`: active today.",
    "expected": {
      "human_answer": "Remove only legacy-alerts and keep auth-recovery active.",
      "exact": { "needs_clarification": false },
      "delegations": { "min": 0, "max": 1, "allowed_agents": ["tech-lead"], "async_required": true },
      "empty": ["preference_updates"],
      "response_target_words": 80
    },
    "label": {
      "status": "draft",
      "source": "synthetic",
      "rationale": "Example awaiting human review",
      "approved_by": null,
      "approved_at": null
    }
  }
]
```

### Role-Specific Judgment Suites

- `benchmarks/may-judgment/` (`may`)
- `benchmarks/alex-judgment/` (`alex`)
- `benchmarks/bob-judgment/` (`bob`)
- `benchmarks/tech-lead-judgment/` (`tech-lead`)
- `benchmarks/scout-judgment/` (`scout`)

Gym's `loadSuite()`, `loadLabels()`, `materializeScenarioOrInlineCase()`, `gym show`,
`gym run`, `gym test`, and `gym verify` automatically materialize the scenario
directory, wire `suite.evaluator`, and freeze its fingerprint inside the run
manifest.

---

## Zero-Config Ad-Hoc Scenario Benchmarks (`--scenario` without `--benchmark`)

To run diagnostic `gym test` on any existing scenario(s) in `scenarios/`
(for example `coder`, `tech-lead`, `scout`, or `alex/develop-change` scenarios)
without creating a `benchmarks/<name>/` folder first:

```bash
bun run gym test --scenario phantom-fix --target tech-lead --trials 1
```
When `--scenario` is passed without `--benchmark` (and the scenario is not in
the default `may-alignment` suite), Gym automatically synthesizes a frozen
`adhoc` benchmark snapshot from the scenario definitions.
These scenarios receive draft labels, rather than inferred human approval.
To verify a candidate, register the scenarios in a named benchmark with approved
labels and create a fresh baseline. Verification checks approval before starting
candidate execution.
