# Cases, benchmarks, agents and runs

> **A case belongs to exactly one benchmark. Its definition lives in that
> benchmark's folder. Benchmarks are organized by purpose, not by agent.**

## Four different things

| Thing | Meaning | Example |
| --- | --- | --- |
| **Case** | One test situation, assignment, acceptable outcomes, forbidden effects and required evidence. | Correct a mistaken duration test without changing working source. |
| **Benchmark** | A purpose-based, versioned collection that owns its cases and evaluation rules. | `repair-and-verification` asks which layer to fix and what checks are sufficient. |
| **Agent / target** | The subject: an agent or workflow, candidate implementation and recorded execution setup. | Current Tech-lead or a proposed Tech-lead version. |
| **Run** | Execution connecting selected benchmark cases to one chosen target, with repeated trials and evidence. | Five `verified-code-work` cases × three trials = 15 case executions. |

A trial is one execution of one case. A case may span several turns or agents;
it is not necessarily one model call. Described helpers, actual helper calls and
agents that grade answers do not automatically become separately evaluated
subjects. The run evaluates its chosen subject and the assigned outcome.

```text
Purpose benchmark → owns its cases
Run = selected cases + benchmark rules + chosen agent/candidate + execution setup
```

A case definition is not a result. A passing result is not approval of the
expected answers or permission to release an agent change.

## Case versus benchmark: one owner

A case asks **“What should happen here, and what evidence would establish it?”**
A benchmark asks **“Which situations answer our evaluation question, and under
what rules?”**

- Each active case ID has exactly one benchmark owner and one authoritative body.
- All case-specific tasks, fixtures, expectations and checks stay under that
  benchmark's folder. Inline and directory formats are alternatives, not two homes.
- Do not reference the same case from several benchmarks or use another benchmark's
  expectation overlays. Shared generic scorers/utilities are fine.
- Add an example to an existing purpose benchmark when it answers the same question.
  Create another benchmark when the evaluation question or policy needs a distinct
  definition and report—not merely because another agent will be tested.
- If a genuinely different assignment or authority needs a different answer, define
  a distinct case/variant. Do not silently change the same case to help a target pass.

Each complete benchmark has one `subject_role`, `output_contract` and evaluation
kind. Cases vary the situation within that contract. Different subject roles or
execution/result contracts need different benchmarks, rather than role filters
inside one collection.

**Share tooling, keep cases local, choose agents at run time.**

## Benchmark versus agent: not 1:1

An agent can take several suitable benchmarks. A benchmark can evaluate different
compatible agents or candidates through separate runs. Benchmarks are no longer
named after the production agents they happen to assess.

For example, Tech-lead can take both `repair-and-verification` and
`worktree-scope-and-preservation`. Two Tech-lead candidates can take the same
`verified-code-work` cases without copying the definitions.

Compatibility matters: a research-only agent is not automatically a valid target
for an implementation assignment. Tools, authority, role context, output contracts
and required workflow entry points remain part of the assignment. A target override
is not proof that the new target is an appropriate comparison.

Purpose benchmark runs require `--target` / `--agent`. Case-level `agent_type`
metadata records a suggested/contextual role and supports direct legacy calls;
it does not define benchmark ownership or switch a run among agents. Several
targets need separate runs. Historical agent-name prefixes in case IDs are kept
for identity and provenance, not used as current collection names.

## Judgment and behavior are test purposes, not agent types

- **Judgment:** did the subject choose appropriately for the situation?
- **Behavior:** did observed work and outcomes satisfy the assignment?

Either can apply to a suitable role or workflow. Returning a good plan is not
behavior evidence merely because a workflow ran. Benchmarks declare a default;
cases may override it. Reports separate the two, and missing historical
classifications remain unknown.

## Where cases live

```text
projects/gym/
├── benchmarks/<purpose>/
│   ├── suite.json          # purpose, case_ids, core_cases, evaluator and policy
│   ├── cases.json          # Local inline case bodies, where used
│   ├── cases/<case-id>/    # Local directory bodies, where used
│   │   ├── case.json
│   │   ├── task.md
│   │   ├── expected.json
│   │   └── environment/
│   └── labels.json         # Optional approval catalog, not another answer key
├── archive/pre-purpose-layout/ # Old layout/uncurated cases, not an active catalog
└── .state/benchmarks/<run-id>/  # Frozen inputs, final workspaces and results
```

The loader rejects duplicate active IDs, missing local bodies, escaping case
directories and ambiguous selections. A benchmark cannot borrow a foreign case
by listing its ID. Production agent/App source remains outside the test definitions.
Grading-agent configuration is part of evaluation machinery, not a tested agent.

The active collection is 122 cases across thirteen purpose benchmarks. The smaller
17-case review selection spans seven of them; it is not one mixed-role benchmark
run. `core_cases` selects cases inside one benchmark. Counts already include core
cases. Core selection is neither a third evaluation kind nor human approval.
The additional one-case `bounded-task-completion` pilot is a separate whole
behavior benchmark for May, outside that core selection and still draft.

## “Scenario” means case, not another concept

New definitions and commands use **case**: `case.json`, `case_ids`, `core_cases`
and `--case`. Existing `--scenario` calls remain aliases, and old `scenario.json`
and manifest fields are readable for compatibility. Internal historical field
names are not a second registry or organizational layer.

The old global `scenarios/` source tree and agent-named benchmark definitions are
preserved in the archive. They do not compete with active ownership. A legacy
case can still be inspected/run diagnostically, but must be deliberately curated
into a purpose benchmark before it becomes active benchmark coverage. Archived
copies and frozen run snapshots are historical evidence, not additional owners.

One-to-one old benchmark names resolve through `benchmarks/compatibility.json`.
Split role collections return guidance rather than silently combine cases from
several owners. Historical reports remain readable; migrated comparisons require
fresh baselines. No old result or approval record is rewritten.

## Approval and comparison boundaries

New or revised expectations remain draft until named human review. Relocation
preserves existing case approval records; it does not invent new approval. Labels
for retired cases remain in the archive rather than the active pending-review list.
Approval of an answer key never approves the subject that passes it.

Runs freeze resolved tasks, files, expectations, graders and selected cases.
Baseline/candidate comparisons require matching frozen definitions and valid
execution evidence. Definition/scorer changes need a fresh baseline; changed
expected answers need human review. Human adjudications remain append-only.

See the [current review list](../benchmarks/REVIEW.md),
[core selection](../benchmarks/CORE.md) and
[test–improve–verify loop](test-improve-verify-loop.md).
