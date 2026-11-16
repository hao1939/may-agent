# Agent evaluation plans and evidence

Status: plans, validation, read-only history reports and run commissioning are
implemented for Alex, Tech-lead, May, Bob and Scout. The first
[May diagnostic trial](may-plan-trial-20261116.md) completed two whole benchmarks:
two cases passed and one was invalid because of a calibration mismatch. A
[fresh v2 calibration trial](may-calibration-repair-20261116.md) then passed both
authority/clarification cases and every control, reusing unchanged routing
evidence. The separate [bounded execution trial](may-execution-trial-20261116.md)
then passed a synthetic local configuration repair, with artifact-matched
verification and no operator correction during the attempt. May has three current
draft judgment passes and one current draft behavior pass. At that point Alex
and Tech-lead had no current commissioned coverage. Later manual observations
are recorded below; representative real-work reliability remains unmeasured.

The subsequent [real-work selection review](may-real-work-review-20261116.md)
traced one corrected May request through retained creator acceptance. It leaves
May unchanged and adds no benchmark score: the historical recovery supports no
current tuning target, and its total correction cost remains unmeasured. May's
next cycle starts only from a concrete delivery problem or an explicitly chosen
efficiency investigation with bounded acceptance evidence.

The [hosted May pilot](may-hosted-cycle-20261116.md) subsequently admitted one
ordinary Alex Task and completed without operator correction after admission.
Alex chose `no_change`; the Host accepted and closed the Task. It used no new
benchmark or development calls. The audit adds final usage and current raw
receipt links missing from the owner's smaller record, and records target
discovery and cumulative-budget gaps before recurring operation. This proves
the bounded hosted no-change path, not candidate execution or restart recovery.

The user then authorized a daily review and clarified that May was the pilot,
not the scope boundary. The accepted [system-wide review policy](system-periodic-review-20261116.md)
lets Alex choose one supported problem across installed agents, Apps, workflows,
benchmarks, tools and the improvement process. May has no default priority;
reviewing every agent each day is not required. The same standing Alex Task
retains its first Host deadline for 2026-11-17 at 09:00 UTC. Subsequent observations
must rearm that Task, reuse changed evidence, keep no-change quiet and retain
incident allowances across days. Setup and the scope correction are verified;
the first due-day wake and recurring recovery remain unobserved.

The [manual five-agent pass](agent-manual-trials-20261116.md) then commissioned
one complete representative benchmark for May, Alex, Bob, Tech-lead and Scout:
twelve trials retained ten passes, one fail and one invalid. Bob and Scout now
have plans beside their definitions. Tech-lead's fail/invalid outcomes exposed a
reproduced publication-scoring defect and specification-grounding disagreement,
not an established prompt-tuning target. All labels remain draft; production
agent guidance and the standing Task are unchanged.

The subsequent [Tech-lead evaluation repair](tech-lead-scoring-repair-20261116.md)
versioned `repair-and-verification` as v2, with complete-result publication
judging and explicit source-specification grounding. One fresh complete run
passed all three cases and calibrated both graders on every control. V1 remains
historical; this changes measurement rather than establishing agent improvement.

The north star is **correct useful delivery, fewer operator corrections, and
acceptable total time/cost**. Alex owns improvement scope and follow-through.
Gym supplies evidence through its existing runner. A plan connects an agent's
responsibilities to whole benchmarks and one useful next improvement.

## Plans alongside production definitions

- [Alex plan](../../alex.app/agents/alex/evaluation-plan.json)
- [Tech-lead plan](../../alex.app/agents/tech-lead/evaluation-plan.json)
- [May plan](../../may.app/agents/may/evaluation-plan.json)
- [Bob plan](../../alex.app/agents/bob/evaluation-plan.json)
- [Scout plan](../../scout-knowledge-lib.app/agents/scout/evaluation-plan.json)
- Generated [Alex report](agent-reports/alex.md),
  [Tech-lead report](agent-reports/tech-lead.md), [May report](agent-reports/may.md),
  [Bob report](agent-reports/bob.md) and [Scout report](agent-reports/scout.md)

Each `evaluation-plan.json` has a schema version and a monotonically maintained
revision. Git retains prior source revisions; commissioned runs retain an exact
snapshot and content fingerprint. Increment the revision when editing a plan.

| Field | Meaning |
| --- | --- |
| `agent`, `owner`, `outcomes` | Subject, accountable maintainer and responsibilities that matter. |
| `benchmarks` | Canonical complete benchmark IDs, exact versions, measured goals and selected baseline run IDs or `null`. |
| `evaluation` | Target, configured model, trials, per-trial subject timeout and maximum benchmark runs per manual cycle. |
| `improvement` | One observed problem, evidence links, hypothesis, expected benefit, unchanged alternative, stopping criterion and next action. |
| `coverage_gaps` | Important responsibilities whose quality is not sufficiently measured. |
| `decisions` | Repository-relative paths to explicit structured owner decision records; initially empty. |

Plans contain references rather than copied scores. Strict validation rejects
unknown fields, case filters, expectation overrides, duplicate assignments,
incompatible role/result contracts, stale benchmark versions, missing evidence,
and disagreement with the adjacent production `agent.json` identity/model.
Missing measurements remain unknown, rather than zero.

## Whole benchmarks with coherent contracts

Every active benchmark declares `subject_role`, `output_contract` and
`evaluation_kind`. All of its cases share those contracts. Different versions or
implementations of a compatible subject take the same complete benchmark.
Different subject roles or execution/result contracts need different benchmarks.
Each case retains one authoritative owner; generic scoring code can be shared.

The mixed `authority-and-scope` collection was split into
`user-intent-and-authority` (May), `worktree-scope-and-preservation` (Tech-lead)
and `workflow-ownership` (Bob). The mixed `adoption-and-simplicity` collection
became `improvement-stage-selection` (Alex), `improvement-routing` (May) and a
Bob-only `adoption-and-simplicity` v2. These are whole collections, not role
conditions. The split preserved all 119 case bodies and approval records.
Subsequently, `user-intent-and-authority` v2 revised only one case's semantic
rubric and controls to repair calibration. Its task, expected answer and draft
truth status are unchanged, and retained runs preserve the original v1 inputs.

Alex takes `outcome-completion` and `improvement-stage-selection`. Tech-lead
takes `repair-and-verification`, `verified-code-work` and
`worktree-scope-and-preservation`. May's initial finite pilot takes
`user-intent-and-authority` and `improvement-routing`; its two larger benchmark
collections remain outside that pilot. Bob takes `adoption-and-simplicity` and
`workflow-ownership`; Scout takes `research-evidence`. The
[manual five-agent pass](agent-manual-trials-20261116.md) selects one complete
representative benchmark per agent, rather than all of each plan's assignments.
May now also takes the separate one-case `bounded-task-completion` behavior
benchmark; its synthetic config repair is outside the core review selection.
The 17 selected cases remain draft; diagnostic results are not promotion gates.
The [known delivery-claim scoring gap](benchmark-scoring-gaps.md) remains explicit
in `verified-code-work` and must be repaired before claiming that benchmark's
narrative-honesty coverage. The new May benchmark has its own calibrated report
checks; it does not change Tech-lead's retained definition.

## Read and validate evidence

From `/app`, these commands are read-only and make no model calls:

```bash
bun run gym:plan validate projects/alex.app/agents/alex/evaluation-plan.json
bun run gym:plan report projects/alex.app/agents/alex/evaluation-plan.json
bun run gym:plan report projects/alex.app/agents/tech-lead/evaluation-plan.json --json
bun run gym:plan report projects/may.app/agents/may/evaluation-plan.json
```

Use `--runs PATH` to inspect another retained `benchmarks/` directory, including a
standalone experiment's copied evidence. The default respects `GYM_STATE_DIR`,
otherwise `projects/gym/.state/benchmarks`. Markdown goes to stdout; redirect it
to a new report file. The command never rewrites retained runs or renders into
their directories. JSON exposes full manifest identities and evidence limits.

The view shows goals, latest current whole-benchmark results, retained history,
failures, resource evidence, decision references, gaps and one next action.
Judgment, behavior and unclassified historical evidence remain separate. Runtime
invalidity and label status are separate from passed/failed counts. Target usage
and timing do not establish grader cost, total-cycle cost or operator effort.
Partial or missing resource telemetry stays unknown.

Current coverage requires complete membership/trials, completed execution,
matching commissioning setup and effective benchmark inputs, retained input,
harness and candidate integrity, consistent result verdicts and observed model/
framework/prompt identity. The original source-capture fingerprint remains intact;
when review prose changes, the reader authenticates that capture and compares
the actual suite, cases, fixtures, labels, scorer and judge definitions. It does
not treat a review document as another authoritative rubric.

A history read validates the recorded measurement under its frozen harness.
Reports expose `harness_matches_current`; an older harness does not erase valid
measurement history. New verification still requires the current execution
harness to match the baseline exactly, and comparisons require matching recorded
identities. Use the retained harness for a later matched execution, or commission
a separately authorized fresh baseline when the execution harness changes. Historical
runs without a commissioning plan remain inspectable history, never silently
reassigned to a new benchmark. Current coverage identifies tested subjects by
fingerprint; it does not establish that their source is installed or active.

Comparison series bind the frozen input/scorer/judge identities, benchmark,
model/framework, trial count, evaluation kind and comparison objective.
Candidate and prompt identities remain visible as the things being tested.
Candidate gates are recomputed only for current matched baseline/candidate pairs
using the existing comparison checks. Draft truth, invalid trials and missing
identity prevent a valid promotion comparison. Selected baselines must be
complete current test runs with approved truth and no invalid trials.

## Commission a bounded evaluation

After reviewing the plan and evidence, the following examples **make model
calls**. They have not been run as part of this implementation:

```bash
bun run gym test --plan projects/alex.app/agents/alex/evaluation-plan.json --benchmark outcome-completion
bun run gym verify --plan projects/alex.app/agents/alex/evaluation-plan.json --baseline RUN_ID --candidate LAB_FORK
```

`--plan` supplies the planned target, trials and subject timeout. A run rejects
incompatible assignments, subsets and changed trial/timeout allowances before
execution. Verification of a commissioned baseline requires a plan. `--case`
and `--core` remain useful diagnostic selectors, but subsets cannot satisfy a
whole-benchmark assignment.

New manifests retain `evaluation_plan` metadata and an exact snapshot under
`commission/evaluation-plan.json`. Commissioning metadata is outside frozen
benchmark inputs: changing the planning decision alone does not change the test
or make a baseline/candidate comparison invalid.

Alex accounts for the maximum runs **across the manual cycle**, including
baselines, candidates and retries. The runner enforces per-run selection,
trial count and subject timeout; it does not claim cumulative cost/run-budget
enforcement. Validate the plan and its selected evidence before commissioning.
Plans add no scheduler and trigger no automatic evaluations or model calls.

## Explicit decisions and actual delivery

A passing gate does not establish adoption, source readiness, integration or
activation. Missing owner decisions stay unknown; do not infer them from prose.
A decision record referenced by `decisions` contains:

```json
{
  "schema_version": 1,
  "agent": "alex",
  "owner": "alex",
  "run_id": "EXACT_RETAINED_RUN_ID",
  "benchmark": "outcome-completion",
  "benchmark_version": 1,
  "candidate_fingerprint": "EXACT_CANDIDATE_FINGERPRINT",
  "input_fingerprint": "EXACT_FROZEN_INPUT_FINGERPRINT",
  "disposition": "defer",
  "evidence": "projects/alex.app/docs/comparison/owner-decision.md",
  "source_readiness": "unverified",
  "integration": "not-applied",
  "activation": "unknown",
  "created_at": "2026-11-16T00:00:00Z"
}
```

This is a schema example, not an actual decision. Supported dispositions are
`adopt`, `reject`, `defer`, `no-change`; delivery fields remain independent.
Reports validate the agent/owner, exact retained run, benchmark, candidate and
input identity, retained integrity, timestamp, enums and linked evidence.
The owner supplies the decision and supporting source; Gym does not confer
integration or release authority. Preserve prior decisions as dated records.

## How Alex drives improvement

1. Read the plan and report when starting authorized improvement work. Separate
   agent failure from expectation, scorer and runtime defects.
2. Select one supported user problem and record a bounded hypothesis and stopping
   criterion. Reuse sufficient current evidence; more benchmarks alone do not
   justify another cycle.
3. Establish matched baselines, implement the smallest useful candidate and run
   affected complete benchmarks plus relevant complete regression benchmarks.
4. Judge useful delivery and regressions with appropriate review. Record the
   owner decision, operator corrections, elapsed time and measured cycle cost.
5. Retain the actual delivery status and update the one next action. A helper's
   recommendation or passing score does not finish an unfulfilled outcome.

The plans keep Alex's evidenced cumulative-round accounting defect from session
13 and Tech-lead's narrative-delivery scoring gap visible. The demonstrated
judgment-scoring boundary was repaired in v2. Alex's
[local accounting repair](../../alex.app/docs/comparison/alex-review-rounds-repair-20261116.md)
now has deterministic reentry, command-change, cancellation and concurrency
coverage; activation and hosted transfer remain unverified. The separate
behavior/narrative defect remains open. May's observed calibration defect passed a bounded
fresh v2 diagnostic trial with both graders classifying every control correctly.
Its original revision-1 pilot and the revision-3 v2 commissioning snapshots remain
intact. The earlier execution run retains its revision-5 commission and the manual
repeat retains revision 10; the current May plan is revision 11. May completed a local config repair, preserved
unrelated work, verified the final artifact and accurately reported local
delivery. Both graders classified every report control correctly. No May
guidance change or owner decision followed. These results exercise planning,
measurement repair and small synthetic completion; they do not demonstrate an
agent quality improvement or production delivery.

For May, a next tuning scope should come from a recent real request with operator
correction or missing completion proof. Select a reproducible problem and useful
acceptance evidence before tuning the agent, and retain current benchmarks as
regressions. If no supported defect exists, leave May unchanged. Expanding
benchmark count alone does not justify another cycle. Keep execution and
judgment evidence separate. Bob and Scout now have profiles and manual evidence;
Alex's standing system-wide Task owns later prioritization across targets. Its
first due wake, rearming and recovery remain unobserved.
