# EXP-700: Parallel Independent Tool Calls

**Status**: DESIGNED — ready for Phase 0
**Created**: 2025-01-15
**Owner**: coach
**Target agent**: all agents (universal skill)

## Hypothesis

A "batch-independent-calls" skill — instructing agents to group independent tool calls into a single function_calls block — will reduce total tool call count per session by ≥15% without reducing task completion rate.

## Background

Observed pattern across agent sessions:
- Agents frequently make sequential tool calls that have no dependencies between them
- Example: reading 3 files sequentially when all 3 could be read in one block
- Example: running `find` + `ls` + `cat` where find/ls are independent
- This inflates session length, increases latency, and burns context window

This is distinct from EXP-600 (bash waste from retries). EXP-700 targets *structural inefficiency* — correct calls made one-at-a-time when they could be batched.

## Skill Design (Treatment)

**Name**: `batch-independent-calls`
**Core instruction**: Before making tool calls, check if any are independent of each other (i.e., the output of call A is NOT needed as input to call B). If so, make them in the same `<function_calls>` block. This reduces round-trips and speeds up your session.

**Key behaviors**:
1. Before each tool-call block, ask: "Are any of these calls independent?"
2. If reading multiple files to understand context → batch them
3. If running searches on different terms → batch them
4. If writing to different files → batch them (unless content depends on prior write)
5. Exception: never batch when call B depends on call A's output

## Measurement Protocol

### Phase 0 — Baseline
- **Scenario**: `efficient-file-reading` (requires finding info across multiple files)
- **Metric**: total tool-call blocks (not individual calls — blocks of potentially parallel calls)
- **Secondary**: calls-per-block ratio (higher = more parallelism)
- **Sample**: 5 runs without skill

### Phase 1 — Treatment
- **Scenario**: same `efficient-file-reading`
- **Inject**: `batch-independent-calls` skill via injected_context.md
- **Metric**: same metrics
- **Sample**: 5 runs with skill

### Success Criteria
- Primary: tool-call-blocks per session decreases ≥15%
- Secondary: calls-per-block ratio increases ≥30%
- Guard: task completion (correct report.md) rate doesn't decrease

## Scenario Fit

`efficient-file-reading` is ideal because:
1. It requires searching across 2 large files (services.yaml, monitor.log)
2. Multiple grep/search operations are naturally independent
3. The report writing depends on prior reads, testing the "don't batch dependents" rule
4. Clear success criteria (correct report with 3 services)

## Phase 0 — Baseline Design

Run `efficient-file-reading` scenario 3 times with no skill injection. For each run, count:
1. Total `<function_calls>` blocks
2. Total individual tool calls within all blocks
3. Ratio = total calls / total blocks (1.0 = fully sequential, >1.0 = some parallelism)
4. Whether the final report.md is correct

## Phase 1 — Treatment Design

Create `efficient-file-reading-exp700-treatment` scenario:
- Same task.md and environment
- Add injected_context.md with the batch-independent-calls skill
- Same success_criteria.js
- Run 3 times, same measurements

## Risk & Mitigations

- **Risk**: Skill may cause agents to batch calls that actually DO depend on each other
  - **Mitigation**: Skill explicitly says "never batch when call B depends on call A's output"
- **Risk**: 3 runs per arm may not be enough for statistical significance
  - **Mitigation**: This is a signal experiment; if direction is clear, scale up
- **Risk**: Different models may respond differently to parallelism hints
  - **Mitigation**: Hold model constant across arms

## Next Steps
1. ✅ Design experiment (this document)
2. Run Phase 0 baseline (3 runs of efficient-file-reading)
3. Create treatment scenario with skill injection
4. Run Phase 1 treatment (3 runs)
5. Write results, decide promote/reject
