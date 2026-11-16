# Cases, benchmarks, agents and runs

> **A case is one test. A benchmark is a versioned collection of tests and
> evaluation rules. An agent is what we test. A run connects them and records
> what happened. Benchmarks do not own agents, and the relationship is not 1:1.**

## Four different things

| Thing | What it defines | Example |
| --- | --- | --- |
| **Case** | One situation, assignment, supplied context, acceptable outcomes, forbidden effects and required evidence. | Repair a mistaken duration test without changing correct source. |
| **Benchmark** | Why we test, which cases belong, shared defaults, how results are judged and reported, and human-review policy. | `core-behavior`, which selects five small work-execution cases. |
| **Agent / target** | The subject being evaluated: an agent or an agent/workflow entry point, with its candidate implementation and recorded runtime/model configuration. | `tech-lead`, a Tech-lead candidate, or `alex/develop-change`. |
| **Run** | An actual execution of selected benchmark cases against a selected target, with repeated trials and retained evidence. | Run the five behavior cases three times each against Tech-lead: 15 trials. |

A **trial** is one execution of one case. A case may involve several turns or
agents; it is not necessarily one model call. A passing trial is not an approval
of an agent, and a benchmark definition is not a result.

```text
Case A ─┐
Case B ─┼── selected by a benchmark ─────────┐
Case C ─┘                                  │
                                           ├── run → per-case evidence and results
Agent/target + candidate + execution setup ─┘
```

A case may inherit shared defaults or checks from its benchmark. Before running,
Gym freezes the resolved task, input files, expectations, scorer and selected
cases so the definition cannot drift halfway through a comparison.

## Case versus benchmark

A case answers **“What should happen in this particular situation, and what
would establish that it happened?”** It is the unit we inspect when a result
passes, fails or cannot be judged.

A benchmark answers **“Which situations together answer our evaluation question,
and under what rules?”** It is not just a folder of tasks or an agent name.
It brings case selection, evaluation, approval status and reporting together.

- One benchmark selects one or more cases.
- The same case can be reused by several benchmarks when its assignment and
  expected outcome really are the same. See the current storage rules below.
- Reusing a scorer does not make two cases identical or merge two benchmarks.
- Changing the assignment, authority or expected outcome is a revision or a
  different case—not an invisible adjustment to help a particular agent pass.
- Expected answers, checks and approval status are separate. New or revised
  expectations remain draft until reviewed. A machine pass cannot approve them.

## How to group cases

**Organize a benchmark around an evaluation question, not automatically around
an agent directory.** A role-focused question is valid, but it is not the only
way to group tests.

- Add a case when it supplies another useful situation for an existing question.
- Create a benchmark when the evaluation question, case selection or shared
  evaluation policy needs a distinct definition and report.
- Create a run—not a copied benchmark—when testing another compatible target,
  candidate or execution setup.
- Share a case definition when its assignment and expectations are genuinely
  unchanged. Use a separate variant when the role or authority changes the answer.
- Keep small reviewed selections and older regressions distinct. Do not combine
  unrelated tests merely because the same agent can execute them.

## Benchmark versus agent: not one benchmark per agent

**A benchmark describes the exam; an agent is a participant.**

An agent can be evaluated by several benchmarks. May already has alignment,
outcome-management and role-judgment benchmarks. Those ask different questions
about the same subject.

A benchmark can evaluate different compatible subjects: the current Tech-lead,
a candidate Tech-lead, or another implementation able and authorized to carry
out the same assignment. Use separate runs; do not copy the benchmark for every
candidate, runtime or model configuration.

Compatibility matters. A research-only agent is not automatically a valid
subject for a coding assignment. Role-specific authority, tools, output contracts
and required workflow entry points remain part of the test. A CLI target override
is not proof that the new target is an appropriate comparison.

### Why do we have names such as `bob-judgment`?

They identify a **role-focused collection and its usual target**, not ownership
of Bob's implementation and not an exclusive binding to one Bob version.

- `defaults.agent_type` supplies the usual target for `gym test` when no explicit
  `--agent` / `--target` is supplied. The old fallback is May if neither is set.
- Case-level `agent_type` supplies materialized case metadata; it does not make
  one benchmark run automatically switch among several agents.
- The current benchmark runner selects one target/candidate for a run. To assess
  several targets, use separate runs. Explicit workflow cases also carry their
  required entry-point context.
- The selected 17-case review set spans five role-judgment benchmarks plus
  `core-behavior`. It is not one executable 17-case, mixed-role benchmark.

Some cases describe helper agents or call real helpers. That does not automatically
produce separate benchmark results for each helper. The run evaluates its chosen
subject and the case's assigned outcome. Likewise, agents used to grade answers
are **evaluators**, not the subject being evaluated.

## Judgment and behavior are test purposes, not agent types

- **Judgment:** did the subject choose appropriately for the supplied situation?
- **Behavior:** did observed work and outcomes meet the assignment's requirements?

Either purpose can apply to any suitable role. An agent/workflow name does not
decide which one a test measures. A workflow returning a good written plan is
still only judgment evidence unless execution is actually observed and checked.
Benchmarks declare their default purpose; cases may override it. Reports keep
the two separate. Missing historical classifications remain unknown.

## Where things live today

```text
projects/gym/
├── benchmarks/<name>/
│   ├── suite.json          # Benchmark definition, selection and shared defaults
│   ├── cases.json          # Benchmark-local case bodies, where used
│   └── labels.json         # Optional approval catalog, not a second answer key
├── scenarios/<case-id>/    # Directory-format cases, including shared/legacy cases
│   ├── scenario.json      # Metadata
│   ├── task.md            # Assignment
│   ├── environment/       # Supplied workspace
│   ├── expected.json      # Expected outcomes/check configuration
│   └── ...                # Case checks and optional meaning-based judging files
└── .state/benchmarks/<run-id>/
    └── ...                # Frozen definitions, final workspaces, receipts/results
```

Evaluators can be shared or live with a benchmark/case; TypeScript scorers also
live under `src/scoring/`. Production agents and App workflows live in their own
agent/App source, outside these test definitions. Grading-agent configuration is
part of Gym's evaluation machinery.

**“Scenario” is the existing code/file name for a case—not another level of
organization.** `scenarios`, `scenario.json` and `--scenario` retain that spelling
for compatibility. `suite.json` is the machine-readable benchmark definition,
not an extra layer between a case and a benchmark.

For new benchmark-local cases, use `benchmarks/<name>/cases.json` or the `cases`
array in `suite.json`. Gym loads the local `cases.json` automatically. For a case
that genuinely needs reuse, keep one directory definition in `scenarios/<case-id>`
and reference that ID from each benchmark's `scenarios` list. Simply referencing
another benchmark's inline case ID does **not** import that case. Existing
benchmark/evaluator overlays may customize directory cases; inspect the resolved
inputs and review the resulting expectations rather than assuming identical IDs
mean identical tests.

Do not duplicate a case just because a second agent will take the same benchmark.
Do not move production agent instructions into case fixtures to establish a new
canonical agent definition. Fixture identities are isolated test context.

## Core, approval and comparisons

`core_scenarios` is a small **selection inside a benchmark**. `--core` selects it;
other cases stay available. It is not a third evaluation purpose, a new agent,
or automatic human approval. Counts for a benchmark already include its core.

Case approval is recorded in its benchmark context, through an inline label or
a separate label catalog. Approval of a shared case in one context is not
blanket approval of every overlay or later revision. It never approves the agent
that happened to pass it.

Baseline and candidate results must use the same frozen cases, expectations and
scorer, with execution conditions satisfying the comparison's checks. Changing
those definitions requires a fresh baseline; changing expected answers requires
human review. Historical results keep their original definitions.

For current situations and proposed answers, see [the review list](../benchmarks/REVIEW.md).
For execution and comparison details, see [the test–improve–verify loop](test-improve-verify-loop.md).
