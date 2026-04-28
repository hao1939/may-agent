# Workflow Reliability Baseline

## Measurement Period
Last 14 days (estimated from system-output-audit data)

## Current Worker Iteration Success Rate
- **Total worker iterations observed**: ~15
- **Iterations producing a deliverable file**: ~5
- **Success rate: ~33%** (target: 90%)

## Failure Modes

| Mode | Frequency | Description |
|------|-----------|-------------|
| No output (read-only) | ~50% | Worker reads/analyzes but never calls write(). Session ends with zero files produced. |
| Announcement without execution | ~15% | Worker states intent ("I will now write...") but doesn't actually call write(). |
| Redundant investigation | ~10% | Worker spends entire iteration reading files already summarized in the task. |
| Timeout/stall | ~5% | Worker runs out of context or time before producing output. |
| Wrong task | ~5% | Worker produces output unrelated to the assigned milestone. |

## Key Observations

1. **Read-before-write is the #1 killer.** Most failed iterations start with 3+ read/bash calls before attempting any write. By then the worker has consumed context budget on analysis instead of output.

2. **Explicit "write first" instructions help but aren't sufficient.** Even with "WRITE FIRST" in all-caps, workers still read first ~60% of the time.

3. **Orchestrator intervention is the current workaround.** The orchestrator has written deliverables directly in at least 3 cases where the worker failed repeatedly.

4. **Success correlates with task specificity.** When the task includes exact file path + content structure, success rate jumps to ~60%. Vague tasks ("investigate and report") have ~10% success rate.

## Recommendations for Milestone 2

1. **Enforce write-within-3-calls rule**: Reject/restart iterations where the first 3 tool calls are all reads.
2. **Include content templates in tasks**: Give workers a markdown skeleton to fill in, not just a topic.
3. **Cap reads at 2 per iteration**: Force workers to write after at most 2 read calls.
4. **Track per-iteration file output**: Log whether each iteration produced ≥1 file for ongoing measurement.

## Baseline Summary

| Metric | Current | Target |
|--------|---------|--------|
| Success rate (file/iteration) | 33% | 90% |
| Crash/timeout rate | ~5% | <2% |
| Mean time to deliverable | Often never | <1 iteration |
