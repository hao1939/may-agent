# Agent Gym — Purpose-Based Agent Benchmarks

> **One case belongs to one benchmark. All of its definition lives in that
> benchmark's folder. Benchmarks are organized by purpose, not by agent.**

A **case** is one test situation, its assignment, expected outcomes and required
evidence. A **benchmark** selects cases and defines evaluation rules. An **agent
or workflow** is the subject. A **run** connects a benchmark selection to a chosen
subject and records what happened.

```text
Purpose benchmark → owns its cases
Run = selected cases + benchmark rules + chosen target/candidate + execution setup
```

An agent can take several suitable benchmarks; a benchmark can evaluate different
compatible agents or candidates in separate runs. Do not copy cases for each
agent or silently change expectations to help a target pass. Share generic
scoring tools, not case ownership.

See [cases, benchmarks, agents and runs](docs/cases-benchmarks-and-agents.md) for
the exact organization and compatibility rules.

## Two separate purposes

1. **Judgment:** does the subject choose appropriately for the situation?
2. **Behavior:** does observed work actually meet the assignment's requirements?

A good plan does not establish execution. A passing case supports a conclusion
about that situation, not general alignment, safety or production reliability.
Reports keep judgment, behavior and unclassified historical evidence separate.
Runtime/scorer faults are evaluation problems, not a third agent-quality score.

## Current benchmarks

| Benchmark | Intended role | Kind | Cases | Core selection |
| --- | --- | --- | ---: | ---: |
| `adoption-and-simplicity` | bob | judgment | 3 | 2 |
| `bounded-task-completion` | may | behavior | 1 | — |
| `improvement-routing` | may | judgment | 1 | — |
| `improvement-stage-selection` | alex | judgment | 1 | — |
| `intent-and-follow-through` | may | judgment | 78 | — |
| `outcome-completion` | alex | judgment | 5 | 2 |
| `outcome-coordination` | may | judgment | 16 | — |
| `repair-and-verification` | tech-lead | judgment | 3 | 2 |
| `research-evidence` | scout | judgment | 4 | 2 |
| `user-intent-and-authority` | may | judgment | 2 | 2 |
| `verified-code-work` | tech-lead | behavior | 5 | 5 |
| `workflow-ownership` | bob | judgment | 1 | — |
| `worktree-scope-and-preservation` | tech-lead | judgment | 2 | 2 |

There are **122 active cases in 13 benchmarks**. The small review selection
remains **12 judgment and 5 behavior cases**; the two outcome-completion core
labels are approved and the other 15 remain draft. The separate
one-case execution pilot is also draft. The older collections have mixed
review history. Relocation did not approve any new answer or establish agent
improvement. Case IDs retain historical prefixes to preserve identity; those
prefixes do not determine their benchmark owner or the run's target.

- [Situations and expected answers for review](benchmarks/REVIEW.md)
- [Exact selected cases, evidence and limits](benchmarks/CORE.md)
- [Proposed real-work recovery case—not executable yet](benchmarks/REAL-WORK-REVIEW.md)
- [Expectations and limits](docs/expectations-and-limits.md)

## Agent plans and history

Alex maintains versioned plans beside the production definitions for
[Alex](../alex.app/agents/alex/evaluation-plan.json) and
[Tech-lead](../alex.app/agents/tech-lead/evaluation-plan.json), plus the
[May pilot](../may.app/agents/may/evaluation-plan.json),
[Bob](../alex.app/agents/bob/evaluation-plan.json) and
[Scout](../scout-knowledge-lib.app/agents/scout/evaluation-plan.json). Each plan assigns
whole compatible benchmarks and records goals, finite allowances, evidence gaps
and one current improvement. See [the operating guide](docs/agent-evaluation-plans.md)
and generated [Alex](docs/agent-reports/alex.md), [Tech-lead](docs/agent-reports/tech-lead.md)
and [May](docs/agent-reports/may.md) reports. The first
[May trial](docs/may-plan-trial-20261116.md) recorded two diagnostic passes and one
calibration-invalid case. The [calibration repair](docs/may-calibration-repair-20261116.md)
then passed both cases and every control in a fresh v2 run. With unchanged routing
evidence reused, May has three current draft judgment passes. The separate
[execution trial](docs/may-execution-trial-20261116.md) added one draft behavior
pass: a verified local config repair with no operator correction during the
attempt. May's guidance remains unchanged. Its next scope should come from a
real request that required correction or lacked completion proof.

The [manual five-agent trials](docs/agent-manual-trials-20261116.md) exercise one
whole representative benchmark for each target, retain all machine verdicts and
inspect output/scoring evidence before selecting an improvement. The
[Bob](docs/agent-reports/bob.md) and [Scout](docs/agent-reports/scout.md) reports
use the same read-only history mechanism. The daily system-wide Alex Task is
independent of these finite standalone trials.

The subsequent [Tech-lead measurement repair](docs/tech-lead-scoring-repair-20261116.md)
versions `repair-and-verification` as v2: publication meaning is judged across the
complete production result, and the source-repair assignment explicitly names
its specification. Earlier results retain their original definitions and scores.

Read-only commands from `/app` (no model calls):

```bash
bun run gym:plan validate projects/alex.app/agents/alex/evaluation-plan.json
bun run gym:plan report projects/alex.app/agents/alex/evaluation-plan.json
bun run gym:plan report projects/alex.app/agents/tech-lead/evaluation-plan.json --json
bun run gym:plan report projects/may.app/agents/may/evaluation-plan.json
```

A run can retain its commissioning plan with `test --plan PATH --benchmark ID`
or `verify --plan PATH --baseline RUN_ID --candidate LAB_FORK`. These execution
commands make model calls. Plan runs use full membership and the planned trials
and timeout. `--case`/`--core` remain diagnostic tools; subsets cannot count as a
plan assignment. Older retained runs remain historical evidence, with current
coverage unmeasured until matching evaluations exist.

## Layout

```text
projects/gym/
├── benchmarks/<purpose>/
│   ├── suite.json          # Purpose, case_ids, core_cases, evaluator and policy
│   ├── cases.json          # Local inline case bodies, where used
│   ├── cases/<case-id>/    # Local directory cases, where used
│   │   ├── case.json
│   │   ├── task.md
│   │   ├── expected.json
│   │   └── environment/
│   └── labels.json         # Optional approval catalog, not another answer key
├── src/cases/              # Active ownership, discovery and validation
├── src/scoring/            # Shared TypeScript scoring tools
├── src/loop/               # Freeze, execute, compare, report and review
├── test/                   # Deterministic implementation checks
├── docs/
├── archive/pre-purpose-layout/ # Preserved old definitions and uncurated corpus
├── dist/                   # Ignored generated scoring packages
└── .state/benchmarks/       # Frozen inputs, transcripts, workspaces and results
```

Directory and inline formats are two ways to store a local case, not two catalogs.
A directory case may omit `environment/` when there are no input files; Gym creates
an empty fixture when materializing it, rather than relying on untracked folders.
There is no active global `scenarios/` folder. Cross-benchmark case references,
duplicate active IDs, missing local bodies and escaping case directories are
rejected. Current purpose benchmarks do not use another benchmark's expectation
overlays merely because they share an evaluator.

## Running

From `/app`, these commands inspect definitions or run deterministic checks;
they do **not** make model calls:

```bash
bun run gym list
bun run gym show behavior-recover-local-verification
bun run gym validate
bun run gym:check
bun run gym:app:check
```

These examples **make model calls**. Run them only with permission:

```bash
bun run gym test --benchmark repair-and-verification --core --target tech-lead --trials 3
bun run gym test --benchmark verified-code-work --core --target tech-lead --trials 3
bun run gym test --case scout-judge-complete-supported-evidence-check --target scout --trials 3
bun run gym verify --baseline <run-id> --candidate <lab-fork>
```

Purpose benchmark runs require an explicit `--target` (or `--agent`). The benchmark
does not choose an agent from its folder name. If `--case` is given without a
benchmark, Gym selects its unique owner; it never creates an unowned collection.
Cases from different owners require separate runs. `--core` selects the declared
core inside one benchmark, not all 17 cases at once. Verification inherits the
baseline's exact selection and uses the same frozen inputs and checks.

Project-local scripts are `case:list`, `case:validate`, `case:run` and `check`.
`check` builds and type-checks Gym, runs deterministic tests, validates active
ownership and checks the archived compatibility corpus. It is not a model score.

## Review and evidence

New or revised expectations remain **draft** until named human review. Diagnostic
baseline runs can use drafts; candidate verification rejects unapproved labels
before execution. A passing run neither approves its answer key nor releases an
agent change. Preserve supplied inputs separately from final workspaces and
record actual actions, receipts, output state and measured usage. Unknown usage
is not measured zero.

Definitions and scorers are frozen for comparison. Their changes require a fresh
baseline; historical runs are never silently relabeled or rewritten. Human
adjudications are append-only. See the [test–improve–verify loop](docs/test-improve-verify-loop.md).

## Legacy compatibility

“Scenario” was the old name for a case. `--scenario` remains an alias for `--case`;
old manifest fields and metadata are still readable. New definitions use
`case_ids`, `core_cases` and `case.json`.

The old source layout, benchmark labels and uncurated cases are preserved under
[archive/pre-purpose-layout](archive/pre-purpose-layout/README.md). Historical run
folders remain untouched. `gym list --legacy` also lists the archived cases;
`gym run <legacy-id> --target ...` can execute a diagnostic compatibility case
(and may make model calls). Archived cases are not active benchmark coverage.
The old `scenario:validate` script checks that archived corpus.

One-to-one old benchmark names resolve through `benchmarks/compatibility.json`.
Agent-named collections that were split by purpose return guidance instead of
silently borrowing cases from several owners. Create fresh purpose-based
baselines rather than continuing a pre-migration comparison. The relocated
canary's automatic schedule is disabled pending fresh baseline/review.

## Project boundary

Gym owns case definitions, fixtures, scorers, reports and review records. It is a
standalone CLI/CI project and uses `@may-agent/sdk/standalone` adapters rather than
depending on autonomous infrastructure. Agents receive ordinary assignments, not
a Gym-specific API. Production agent/App source remains outside the benchmark
folders; grading-agent configuration is evaluation machinery, not a tested agent.

`projects/alex.app` owns autonomous comparison, diagnosis and learning workflows;
it has no authority to invent label approvals or release decisions. Gym-owned new
executable code is TypeScript. Markdown/JSON hold definitions and reviews; legacy
CommonJS scorers and JavaScript fixture projects remain supported. Generated state
belongs in `.state/`, compiled packages in `dist/`, and historical evidence in
`archive/`, not at project root.
