# Purpose benchmarks

> **One case → one benchmark → one folder. Choose the agent when running it.**

A case is a test situation, assignment, expected outcomes and required evidence.
A benchmark owns its cases and answers an evaluation question. An agent can take
several suitable benchmarks; a benchmark can evaluate different compatible agents
or candidates in separate runs. Benchmarks do not own production agents.

## Active collections

| Benchmark | Cases | Core | Kind |
| --- | ---: | ---: | --- |
| `authority-and-scope` | 5 | 4 | judgment |
| `outcome-completion` | 5 | 2 | judgment |
| `adoption-and-simplicity` | 5 | 2 | judgment |
| `repair-and-verification` | 3 | 2 | judgment |
| `research-evidence` | 4 | 2 | judgment |
| `verified-code-work` | 5 | 5 | behavior |
| `intent-and-follow-through` | 78 | — | judgment |
| `outcome-coordination` | 16 | — | judgment |

Of the 17 selected cases, the two outcome-completion core cases now have explicit
version-2 approval; the other 15 remain draft. Older approvals retain their original
review records; moving files neither approves new answers nor establishes agent
improvement. See [the review list](REVIEW.md), [core details](CORE.md) and
[proposed real-work recovery case](REAL-WORK-REVIEW.md).

## One authoritative home

```text
benchmarks/<purpose>/
  suite.json
  cases.json              # Optional inline case bodies
  cases/<id>/             # Optional directory bodies instead
    case.json
    task.md
    expected.json
    environment/
    semantic_criteria.md  # When needed
    semantic_controls.json
  labels.json             # Optional approval metadata
```

A local inline case and a directory case are alternative formats, not duplicate
sources. An absent `environment/` means no fixture files; materialization creates
the empty directory, so a clean Git checkout behaves the same as a working tree. No case is imported from another benchmark. Shared evaluator code is
allowed; another evaluator's case overlays do not supply active expectations.
The old global `scenarios/` tree is archived, not another active catalog.

Case IDs remain unique across active benchmarks so `gym show <id>` and `--case`
resolve one owner. Historical agent-name prefixes in IDs are retained for stable
identity, not treated as collection names or execution targets.

## Benchmark definition

```json
{
  "name": "example-purpose-v1",
  "version": 1,
  "purpose": "The evaluation question this collection answers.",
  "evaluation_kind": "judgment",
  "case_ids": ["example-case"],
  "core_cases": ["example-case"],
  "artifact": "task-result.json",
  "evaluator": "../intent-and-follow-through/score-decision.cjs"
}
```

`case_ids` selects local directory/inline definitions. `cases.json` is loaded
automatically; embedded `suite.json#cases` is also supported. `core_cases` is an
optional reviewable selection within this benchmark, not approval or a new kind
of evaluation. A case may override the benchmark's `evaluation_kind`; judgment
and behavior evidence must always be reported separately.

Targets are supplied through `--target` / `--agent`, not benchmark-owned agent
defaults. Case-level `agent_type` metadata remains a context/compatibility hint;
it does not switch a benchmark run between agents. Role, capability, authority,
output-contract and workflow-entry requirements still determine suitable targets.

## Case authoring

For a small case, add an object to the local `cases.json`:

```json
{
  "id": "example-case",
  "description": "What the test establishes.",
  "evaluation_kind": "judgment",
  "agent_type": "tech-lead",
  "output_contract": "task-agent-result",
  "task": "The assignment, relevant facts and execution boundaries—not an answer key.",
  "files": {},
  "expected": {
    "human_answer": "The proposed acceptable outcome, pending human review.",
    "response_target_words": 90
  }
}
```

Supply meaning-based rubrics and labeled examples where open-ended judgment
requires them. Put large fixture files under that benchmark's case folder. Keep
protected material and evaluation expectations out of the agent's supplied input.
New IDs need one owner; do not copy cases to test another agent or candidate.

Missing labels are draft, with no invented reviewer/date. Explicit approvals need
a reviewer and valid timestamp. A separate label catalog takes precedence over an
inline label and is approval metadata, not a second answer key. Withheld examples
keep their existing withheld status. New or revised answers need human review.

## Runs and compatibility

`gym test --benchmark <purpose> --case <id> --target <agent>` selects an owned
case. Omitting `--case` runs that benchmark's collection; `--core` selects its core.
Do not combine `--case` and `--core`. With `--case` but no benchmark, Gym resolves
the unique owner. It does not construct an unowned ad hoc collection or combine
foreign cases into one benchmark. These execution commands make model calls.

The loader rejects duplicate ownership, missing bodies and escaping case paths
before execution. Runs freeze resolved inputs and graders, store per-trial final
workspaces/receipts and preserve judgment/behavior classification. Baseline and
candidate comparisons require matching frozen definitions and approved labels.

`--scenario` remains a compatibility alias. Old one-to-one benchmark names map
through `compatibility.json`; split agent-named collections are retired with
purpose-selection guidance. The [old layout](../archive/pre-purpose-layout/README.md)
and historical results remain preserved. A moved collection needs a fresh baseline.

See [organization](../docs/cases-benchmarks-and-agents.md),
[expectations and limits](../docs/expectations-and-limits.md) and
[the comparison loop](../docs/test-improve-verify-loop.md).
