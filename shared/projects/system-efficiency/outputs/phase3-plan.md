# Phase 3 Plan: Iteration Latency Optimization

## Goal
Reduce p95 iteration time from 18 minutes to <15 minutes. Reduce wasted iterations from failed attempts by 50%.

## Root Causes (from Latency Profile)
1. **Failed worker attempts** — iterations that produce nothing waste 15-20 min each
2. **Large file reads** — reading entire workflow files (500+ lines) adds 2-3 min per iteration
3. **Complex multi-step implementations** — tasks requiring >3 file operations hit timeout risk
4. **No early termination** — bad tasks run to full timeout before failing

## Strategy 1: Fast-Fail Pre-Validation
**Problem**: Workers attempt tasks they can't complete, wasting full iterations.
**Solution**: Before dispatching work, validate:
- Target files exist and are writable
- Required dependencies are available (e.g., vitest, jq)
- Task complexity is within single-iteration scope

**Implementation**:
- Create `agents/shared/workflows/task-validator.ts`
- Check file existence, tool availability, estimated step count
- Reject tasks with >5 file operations or missing prerequisites
- Return structured error in <30 seconds instead of failing after 15 min

**Effort**: 2 iterations | **Impact**: Eliminate ~30% of wasted iterations

## Strategy 2: Parallel File Operations
**Problem**: Sequential reads of multiple files add up.
**Solution**: Batch file reads when multiple files are needed for context.

**Implementation**:
- Identify iteration patterns that read 3+ files
- Use concurrent bash calls (`cat file1 & cat file2 & wait`)
- Pre-cache commonly-read files (master-worker.ts, project.md) in checkpoint state

**Effort**: 1 iteration | **Impact**: Save 1-2 min per multi-file iteration

## Strategy 3: Iteration Timing Instrumentation
**Problem**: No real-time visibility into iteration duration.
**Solution**: Add timing hooks to track where time is spent.

**Implementation**:
- Add `performance.now()` markers in master-worker.ts at:
  - Iteration start
  - After task dispatch
  - After each worker tool call
  - At iteration end
- Write timing data to `.state/timing/` per iteration
- Alert if any single step exceeds 5 minutes

**Effort**: 1 iteration | **Impact**: Enables data-driven optimization going forward

## Strategy 4: Task Complexity Estimation
**Problem**: Complex tasks get same timeout as simple ones.
**Solution**: Estimate complexity before dispatch, set adaptive timeouts.

**Implementation**:
- Score tasks: file count × operation type × dependency depth
- Simple (score <5): 10 min timeout
- Medium (score 5-10): 15 min timeout
- Complex (score >10): split into sub-tasks automatically

**Effort**: 2 iterations | **Impact**: Prevent timeout waste, improve task routing

## Success Metrics
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| p95 iteration time | 18 min | <15 min | Journal timestamps |
| Failed iteration rate | ~20% | <10% | Iterations with no output |
| Time-to-first-output | ~8 min | <5 min | First file write timestamp |
| Wasted iteration cost | ~4/20 iterations | <2/20 | Zero-output iterations |

## Implementation Order
1. **Iteration 18-19**: Task Validator (fast-fail) — highest ROI
2. **Iteration 20**: Timing Instrumentation — enables measurement
3. **Iteration 21**: Parallel File Operations — quick win
4. **Iteration 22-23**: Complexity Estimation — adaptive behavior

## Phase 3 Exit Criteria
- p95 < 15 minutes sustained over 10 iterations
- Failed iteration rate < 10%
- Timing data collected for all iterations
- All strategies implemented and tested
