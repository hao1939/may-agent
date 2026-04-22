# M4: Measurement Protocol — EXP-195 Relational Bug Recognition Skill

**Created**: 2026-04-22
**Status**: READY FOR EXECUTION

## Design

**Comparison**: Treatment (skill injected) vs Control (no skill) on cascading-fix-trap-v2

### Control Arm
- **Scenario**: `cascading-fix-trap-v2` (bare, no hints)
- **Existing data**: 0/115 (0.0%) — sufficient baseline, no more runs needed
- **Primary check**: `pipeline-order-fixed` (the relational bug)

### Treatment Arms (3 variants)
| Arm | Scenario | Description |
|-----|----------|-------------|
| skill | `cascading-fix-trap-v2-exp195-skill` | RELATIONAL_BUG_CHECKLIST.md referenced from task.md |
| inline | `cascading-fix-trap-v2-exp195-inline` | Checklist embedded directly in task.md |
| direct | `cascading-fix-trap-v2-exp195-direct` | Direct hint ("check pipeline ordering") |

### Sample Size
- **N = 10 per arm** (30 total treatment runs)
- Rationale: With 0% control baseline, even 3/10 (30%) in any arm is significant (Fisher exact p < 0.01)
- If skill arm shows 0/10, we reject the skill hypothesis

### Primary Metric
- Full scenario pass rate (all checks pass)
- Secondary: `pipeline-order-fixed` check alone (did agent find the relational bug?)

### Success Criteria
- **Promote**: skill arm ≥ 30% pass rate (≥3/10)
- **Investigate**: skill arm 10-29% (1-2/10) — may need dosing adjustment
- **Reject**: skill arm 0% (0/10)

### Comparison with existing intervention data
From EXP-177 we already know:
- lexical hint: 7/26 = 26.9%
- paraphrase hint: 2/10 = 20%
- placebo: 0/10 = 0%

The skill must meet or beat the lexical hint (27%) to be worth promoting, since a reusable skill is more valuable than a task-specific hint.

## Execution Plan

1. Run 10 trials each: `cascading-fix-trap-v2-exp195-skill`, `-inline`, `-direct`
2. Record results in gym_runs table
3. Analyze: per-arm pass rate, per-check pass rate
4. Write M7 analysis doc with verdict

## Execution Request

Gym runs must happen on k3s. Requesting batch:
```
cascading-fix-trap-v2-exp195-skill  × 10
cascading-fix-trap-v2-exp195-inline × 10
cascading-fix-trap-v2-exp195-direct × 10
```
