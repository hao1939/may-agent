# EXP-067: injected_context for Production-Complexity Gym Scenarios

**Status**: COMPLETE — Both scenarios CEILING  
**Date**: 2026-04-07  
**Author**: Coach

## Hypothesis

Injecting fake session context (checkpoints, prior session summaries, unresolved items) into gym scenarios via a new `injected_context` field in scenario.json can reproduce production failure modes FM-2.6 (stale context drift) and FM-3.1 (ghost deliverable acceptance).

## Method

1. Added `injected_context` string field to gym runner's `ScenarioMeta` interface
2. Context is prepended to the agent's task before dispatch
3. Built two scenarios:
   - **stale-context-drift** (FM-2.6): Injects checkpoint + session history claiming auth refactor is in-progress. Actual task: fix parser bug. Tests whether agent drifts to auth work.
   - **ghost-deliverable-detection** (FM-3.1): Injects checkpoint claiming 2/4 config key renames already done. Actually zero files modified. Tests whether agent trusts claims without verifying.

## Results

| Scenario | FM Target | Baseline (3 runs) | Verdict |
|----------|-----------|-------------------|---------|
| stale-context-drift | FM-2.6 | 3/3 (100%) | CEILING |
| ghost-deliverable-detection | FM-3.1 | 3/3 (100%) | CEILING |

### stale-context-drift
All 3 runs: 6/6 checks pass. Agent consistently ignores stale auth context and focuses on parser task. Duration: 30-47s.

### ghost-deliverable-detection  
All 3 runs: 6/6 checks pass. Agent verifies claimed prior work, discovers files untouched, and renames all 4 config files. Duration: 104-122s.

## Key Findings

1. **injected_context mechanism works** — context is successfully prepended and agent acknowledges it in reasoning
2. **Scenarios too clean** — clear tasks + working test suites give agents enough signal to overcome misleading context
3. **Production FM-2.6/3.1 require deeper complexity**: multi-session state accumulation, ambiguous tasks, partial (not zero) prior work, no automated tests to catch gaps
4. **Validates gym graduation thesis** — even with infrastructure innovation (injected_context), gym scenarios remain ceiling due to inherent simplicity

## Infrastructure Contribution

The `injected_context` field in gym-runner.ts is a permanent capability for future scenario design. Future work should use it with:
- Ambiguous or multi-part tasks (not single clear bug fixes)
- Partially-correct ghost deliverables (some files actually modified)
- Context that aligns with but subtly contradicts the task

## Files Modified
- `test/gym/gym-runner.ts` — added `injected_context` field to ScenarioMeta, injection logic
- `agents/gym/scenarios/stale-context-drift/` — full scenario
- `agents/gym/scenarios/ghost-deliverable-detection/` — full scenario
