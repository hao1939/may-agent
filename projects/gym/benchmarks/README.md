# Gym Benchmarks

A benchmark groups stable scenarios with scoring policy, provenance, reporting,
and human-review rules. It does not own the agent or app being evaluated.

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
      "response_max_words": 80
    },
    "label": {
      "status": "approved",
      "source": "synthetic",
      "rationale": "Approved inline expectation",
      "approved_by": "hao",
      "approved_at": "2026-11-15T00:00:00Z"
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

To run `gym test` → `gym verify` on any existing scenario(s) in `scenarios/`
(for example `coder`, `tech-lead`, `scout`, or `alex/develop-change` scenarios)
without creating a `benchmarks/<name>/` folder first:

```bash
bun run gym test --scenario phantom-fix --target tech-lead --trials 1
bun run gym verify --baseline <RUN_ID> --candidate <LAB_FORK> --trials 1
```
When `--scenario` is passed without `--benchmark` (and the scenario is not in
the default `may-alignment` suite), Gym automatically synthesizes a frozen
`adhoc` benchmark snapshot from the scenario definitions.
