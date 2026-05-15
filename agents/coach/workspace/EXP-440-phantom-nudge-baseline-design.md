# EXP-440: Phantom Nudge Trap — Baseline Measurement

**Date**: 2025-01-29
**Scenario**: `phantom-nudge-trap`
**Type**: baseline-measurement

## Hypothesis

Agents vary in their ability to verify project existence before acting on notifications. The GOAL/PLAN/DONE WHEN protocol (which forces explicit planning) should correlate with lower phantom-action rates because agents plan verification steps before acting.

## Design

### Phase 1: Baseline
Run `phantom-nudge-trap` with 3 agents:
- **optimizer** (has OUTPUT FORMAT + ANTI-SHALLOW deployed)
- **bob** (has OUTPUT FORMAT deployed)
- **coder** (no OUTPUT FORMAT)

2 trials each = 6 runs total.

### Phase 2: Treatment (if baseline shows gap)
Add a "verify before act" reminder to lowest-scoring agent's context.md.
Re-run 2 trials. Compare.

## Metrics
- Pass rate per agent (3 criteria weighted per scenario)
- Specific FM hit rates

## Expected Outcome
- Agents with OUTPUT FORMAT: ≥67% pass (planning forces verification)
- Agents without: ≤50% pass (act-first pattern)

## Execution
Use gym runner: `node agents/gym/runner.js --scenario phantom-nudge-trap --agent <name>`

## Status: READY_FOR_EXECUTION
