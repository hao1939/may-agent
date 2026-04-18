# EXP-183: Dreaming/Consolidation — Distilled vs Raw Session Memory

**Date**: 2026-04-18
**Status**: COMPLETE
**Predecessor**: EXP-180 (dead-ends memory)
**Hypothesis**: H-183a

---

## Research Question

Does periodic experience consolidation (distilling raw session logs into concise rules) improve agent performance compared to raw verbose logs or no memory?

## Background

OpenClaw uses a "dreaming" phase where agents periodically consolidate recent experiences into distilled lessons. The question is whether the *form* of memory matters — distilled rules vs raw session logs vs none.

This connects to KE-001 (context learning works for environmental knowledge) and KE-025 (instruction overhead paradox: more context hurts).

## Hypothesis

- **H-183a**: Consolidated distilled rules outperform raw session logs because they're concise and actionable (KE-025: less context = better)
- **H-183b**: Both memory forms outperform no memory (baseline)
- **H-183-null**: No difference — the agent either reads WORKSPACE_NOTES or doesn't, regardless of memory injection

## Design

### Arms

| Arm | Variant | Intervention | N | Notes |
|-----|---------|-------------|---|-------|
| A | baseline | No memory injection | 5 | Standard coder context |
| B | exp183-consolidated | 2-line distilled rules added to context.md | 5 | "Always read referenced files first" |
| C | exp183-raw-logs | ~20 lines of raw session logs in context.md | 5 | Verbose fake session history with same lesson buried in narrative |

### Scenario

- `stale-approach-fixation` — tests whether agent reads WORKSPACE_NOTES.md and avoids dead tool attempts. Perfect for memory/learning test.

### Metrics

- Primary: pass rate (7/7 criteria)
- Secondary: `read-workspace-notes` criterion pass rate, `no-dead-tool-attempts` criterion pass rate

### Decision Rule

- **Consolidated > raw**: H-183a confirmed if Arm B pass rate ≥ Arm C + 15pp
- **Memory helps**: H-183b confirmed if (B or C) ≥ A + 15pp
- **Null**: If all arms within 10pp of each other

## Execution

```bash
# Baseline (5 trials)
scripts/gym-batch.sh --scenario stale-approach-fixation --agent coder --trials 5 --timeout 10 --tag EXP-183

# Consolidated (5 trials)
scripts/gym-batch.sh --scenario stale-approach-fixation --agent coder --variants exp183-consolidated --trials 5 --timeout 10 --tag EXP-183

# Raw logs (5 trials)
scripts/gym-batch.sh --scenario stale-approach-fixation --agent coder --variants exp183-raw-logs --trials 5 --timeout 10 --tag EXP-183
```
