# Systemic pattern review: offline design trial

September 27, 2026. This supports the [proposal](../../design/systemic-pattern-review-20260927.md).
The live selector, Tasks, report publication, May intake and agent definitions
are unchanged. The prototype reads SQLite in read-only mode and runs isolated
native evaluator sessions with only `finish`. It creates no live review or repair
Task and sends no messages to people.

## Frozen observation

The cut is **2026-09-27 08:11:43.617 UTC**, the timestamp of an existing Evaluation
report. Both cohorts select attempts started in fixed adjacent 24-hour windows;
only outcomes finished before each cut are counted as settled. Read-back used
Host source `7f349322cc7ebb564856fd596e1d217edb64f2c5` and App source
`6d90a00267e21e2b43a46c1e1c48fb94ed556a9e`. These are inspected source identities,
not claims about the historical deployed binary/definitions.

| Retained cohort | Earlier 24 hours | Latest 24 hours |
| --- | ---: | ---: |
| May App settled attempts | 271 | 222 |
| May App failed attempts | 10 (3.69%) | 23 (10.36%) |
| Exact Conversation settled attempts | 207 | 208 |
| Exact Conversation failed attempts | 1 (0.48%) | 22 (10.58%) |
| Missing-reply failures in that Conversation | 0 | 19 |

The 22 Conversation failures consumed 1,317,277 ms of recorded failed-attempt wall
time. That is not a measured savings opportunity, billing cost or outage duration.
The previous App cohort actually had more failed-attempt wall time despite fewer
failures, because it included long timeouts. Counts alone are not an impact rank.

The original report reviewed Task
`may/conversation_ec854e2f09f1c38566a25857_successor_2`. Its 20-event history exposed
only one missing-reply failure and recovery. All three attempted process reads
were unavailable because the reader used `workflowRunId` as a session ID. The
failure/retry events are `6457486` and `6457495`; May's no-action intake is
`6457552`. The source report remains at:

```text
/app/.state/evaluation/reports/task-outcomes/evaluator-deepseek/may/task-obligation-v1/
conversation_ec854e2f09f1c38566a25857_successor_2-b96ad3df6e14cdc4-ef255144f8b6.json
```

The source is real historical evidence. Cases C–G are labeled synthetic controls;
their identifiers and outcomes are not production observations.

## Iterations and limits

1. **Count actual attempts.** The replay reads Conversation and native agent
   executions as well as workflow attempts. It preserves recovered failures,
   interrupted outcomes, accepted waits and unknowns. The two-window May read
   returned 493 projected rows in approximately 11 ms in this local sample.
   `EXPLAIN` uses only the App prefix of the existing Task index: this is not
   proof of a time-indexed query or performance at larger history volume.
2. **Supply aggregates with existing instructions.** The baseline used a projected
   historical snapshot, shared criteria and the existing report fields. With only
   recent history, the reviewer accepted current recovery. Adding aggregate context
   made the same configured reviewer notice 19 repeated missing-reply failures and
   recommend investigation. It also incorrectly claimed all incidents recovered,
   attributed a definite authoring defect, and called the recorded effort avoidable.
   This is useful detection with unacceptable causal/recovery overstatement.
3. **Make evidence limits prominent.** The refinement removes duplicated population
   breakdowns, places recovery/cause/avoidability uncertainty beside the observations,
   and adds the general [review guidance](review-guidance.md). It tests the same
   historical case plus a previously unseen control in which later success handles
   a different input. The workload and wrong-output cases were also rerun after
   their first-round gaps. This changes context and guidance together; it does not
   isolate their individual causal effects.
4. **Calculate comparisons and label the denominator.** The refined historical
   run still called every cycle settled, and used 186 instead of 14 as the number
   of attempts outside the affected Task. The workload-mix run interpreted settled
   as successful, then added failures again. The final context supplies calculated
   subgroup rates and the explicit definition “total terminal attempts, including
   failures”. It also supplies one verified equal-input recovery pair, with the
   other 21 failure recovery attributions explicitly unknown. Counts and rates are
   dependable code work, not questions for the model to reconstruct.

Each judgment is one native run using the installed reviewer configuration's
`deepseek-v4-flash` model through the configured gateway, with fallback disabled.
The canonical evaluator instructions and shared criteria are supplied; only the
finish tool is available so the model cannot silently supplement the frozen case
with live filesystem evidence. The trial brief projects the production assessment
contract; it does not run `task-outcome-review` or its publication code. Cases are
frozen separately from [expectations](expectations.json), which the model never
receives. Run time limit is 180 seconds per case. Unknown gateway tariffs are not
treated as zero cost.

Structured completion alone is not a pass. A useful finding with invented recovery,
cause or savings remains a failed claim-quality check. The development runs exposed
these gaps rather than qualifying the model as a trustworthy automatic fixer.

| Case | Observation from the first two rounds | Assessment |
| --- | --- | --- |
| A: recent history only | Accepted current recovery; no unsupported 24h recurrence claim | Expected baseline limitation |
| B: historical aggregates | Detected the 19 repeated missing-reply failures; overclaimed recovery/cause/avoidable cost | Detection useful; claim quality failed |
| C: singleton provider failure | Accepted recovery and recommended no deeper review | Desired disposition; called attempts “Tasks” once |
| D: missing aggregate source | Preserved current recovery; broader coverage unavailable | Desired scoped uncertainty |
| E: changed workload mix | First dismissed population as outside scope; refinement recognized mix effect but double-counted failures in denominator | Scope improved; arithmetic failed |
| F: successful but wrong output | Both runs caught 170 versus required 120, despite zero attempt failures | Defect supported; invented verification-procedure claims remain |
| B refined | Preserved current coherence and detected recurrence; supplied an incorrect other-Task denominator and “every cycle settled” claim | Detection improved; not claim-quality acceptance |
| G: different-input success | Identified missing disposition of original input and kept later contribution | Correct recovery distinction; speculated about a dependency between the inputs |

The extra causal/dependency assertions in F/G are not supported by the fixture.
They reinforce the boundary: May must verify material interpretation before action.
Do not turn this small sample into a success percentage or a claim of no false
positives. The final two targeted runs are recorded with their exact judgments.

### Final targeted results

Both final runs met the specific acceptance being tested:

- **Historical recurrence:** kept current recovery, identified 19 repeated
  missing-reply failures, used correct subgroup rates (other Tasks: 1/14 versus
  9/64), confirmed exactly one equal-input recovery, and left the other 21
  recovery attributions, cause and avoidability unassessed. It recommended
  inspecting a rejected decision and its validation rule. One minor terminology
  error called Request IDs App IDs; this was not a flawless general assessment.
- **Workload mix:** reported overall 2.727% → 18.273% with unchanged executor
  rates of 1% and 20%, and correctly attributed the overall change to mix. It
  preserved the healthy Task and treated B's underlying cause as unknown.

The final historical summary said:

> The App failure-rate increase is entirely concentrated in 22 handler settlement
> failures on this one Task, 19 with the same 'requires a reply' rejection; cause
> is unassessed because execution links are absent, supporting a smallest-useful
> investigation rather than the snapshot's stronger 'no improvement candidate' claim.

[trial-results.json](trial-results.json) retains all run identities, receipt and
prompt hashes, manual claim review, and both complete final judgments. There were
12 structured completions across three model-review rounds; **12 completions are
not 12 quality passes**. Per-run duration was 30.286–103.483 seconds; total native
run duration was 689.160 seconds. Recorded usage: 95,850 uncached input tokens,
300,480 cache-read tokens and 65,382 output tokens across 28 replies. Price remains
unknown. This small proof does not establish a cost-effective production cadence.

The frozen original summary remains unchanged. The replay now also emits the
complementary Task cohort used by the final context. The observed May cohort
contained Conversation and native agent attempts, not workflow attempts; live
workflow navigation remains an explicit implementation acceptance case.

Validation passed: offline arithmetic/evidence checks, historical projection
reproduction, native trial script syntax and formatting, document links, and
`bun run check:may-design` (document integrity, executable SDK examples and canonical
App checks). No runtime implementation or live rollout is claimed.

## Reproduce

`replay.py --self-test` checks window boundaries, zero activity, interrupted versus
failed outcomes, historical-cut leakage, and a valid wait coexisting with an earlier
failure. These are arithmetic/evidence checks, not model-quality tests.

```bash
python3 replay.py --self-test
python3 replay.py --database /path/to/may.db --app may \
  --end 2026-09-27T08:11:43.617Z --output /tmp/attempt-summary.json
bun judgment-trial.ts /path/to/may-agent /path/to/evaluation.app \
  ./cases.json /tmp/systemic-trial-round-1
bun judgment-trial.ts /path/to/may-agent /path/to/evaluation.app \
  ./refined-cases.json /tmp/systemic-trial-round-2
bun judgment-trial.ts /path/to/may-agent /path/to/evaluation.app \
  ./final-cases.json /tmp/systemic-trial-round-3
```

For another App, supply `--task` for its exact focal Task. The native trial uses
the normal configured model environment; credentials are not stored here or in
arguments. It refuses to overwrite existing receipts. Model replay requires the
Host dependencies and configured DeepSeek route; the data replay and checks use
only Python's standard library. Retained attempts can change through pruning, so
the committed frozen projection is the evidence for this result, not a promise
that rerunning a historical query recreates identical bytes.

Local runtime receipts and transcripts are retained under
`/app/.state/review-pilots/evaluation-systemic-20260927/round-{1,2,3}`. Transcript
contents and provider tokens are not copied into this source experiment.

## What remains to prove

- Exact public navigation reaches real failed Conversation/native/workflow
  executions; current mocked `s_` workflow links do not prove that integration.
- The periodic selector observes a recovered-only population and actually admits
  the representative Task review, while preserving ordinary sampling and budget.
- May turns the report into a recorded value judgment and reuses linked work;
  repeat observations do not produce duplicate Tasks or Telegram noise.
- Collection/read failures remain visible through the existing owner path.
- An applied candidate improves comparable behavior without reducing useful work.

This is a design/evidence trial. It does not establish false-positive/negative
rates, model superiority, sustained autonomous detection, or live closure of the
execution → evaluation → improvement → approval → application loop.
