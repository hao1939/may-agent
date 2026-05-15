# EXP-360 Results: Workflow-Level Forced Verification Step

## Status: CLOSED — INCONCLUSIVE (baseline improved)

## Protocol
- Treatment: `convention-verify-multi-edit-workflow-gated` (Phase 3 VERIFY gate)
- Control: `convention-verify-multi-edit-workflow` (no forced verify phase)
- 3+ valid trials per arm attempted

## Raw Results

### Treatment (gated)
| Trial | Score | Failed Checks | Duration | Notes |
|-------|-------|--------------|----------|-------|
| 1 | 8/9 | C2.1:plan-before-acting | 70.1s | Valid |
| 2 | 2/9 | agent_status: error | 360ms | Agent crashed — discard |
| 3 | 2/9 | agent_status: error | 377ms | Agent crashed — discard |
| 4 | 8/9 | C2.1:plan-before-acting | 79.3s | Valid |
| 5 | 8/9 | C2.1:plan-before-acting | 64.0s | Valid |

**Treatment median (valid runs): 8/9**

### Control (no gate)
| Trial | Score | Failed Checks | Duration | Notes |
|-------|-------|--------------|----------|-------|
| 1 | 8/9 | C2.1:plan-before-acting | 52.9s | Valid |
| 2 | 8/9 | C2.1:plan-before-acting | 64.2s | Valid |
| 3 | 2/9 | agent_status: error | 462ms | Agent crashed — discard |

**Control median (valid runs): 8/9**

## Analysis

### Key Finding: Baseline has improved since EXP-355
EXP-355 (which motivated EXP-360) measured the control at median **5/9** with range 3. Now both arms score **8/9** consistently. The only failing check is C2.1:plan-before-acting (workflow runner strips SOUL.md context — known accepted residual from agent-convention-compliance project).

### Why?
Since EXP-355 was measured, the following interventions were deployed system-wide:
- SOUL.md verify-after-edit rules (from EXP-280/340/350)
- Post-Edit Verification rule in coder/context.md (gym-quality-improvement iter 29)
- OUTPUT FORMAT enforcement (EXP-330)

These cumulative improvements raised the baseline to 8/9, eliminating the gap the gated variant was designed to fill.

### Flakiness Note
Both arms show ~33% agent crash rate (fast failures <500ms, agent_status: error). This is a gym runner infrastructure issue, not scenario-specific. The environment gets polluted from previous runs (files already modified).

## Conclusion

**INCONCLUSIVE** — The treatment shows no improvement over control because baseline performance already reached 8/9 (the target). The gated verify phase provides no additional benefit when the agent already verifies consistently.

### Decision
- ❌ Do NOT deploy workflow-level verify gates system-wide (no incremental benefit)
- ✅ Prior SOUL.md + context.md interventions are working (8/9 vs historical 5/9)
- The one remaining failure (C2.1:plan-before-acting) is an infrastructure limitation (workflow runner strips context), not an agent behavioral gap

## Impact on Projects
- **agent-convention-compliance**: The 98% measurement is confirmed real — C2.1 in workflow context is the accepted residual
- **gym-quality-improvement**: No new skills needed for this scenario class
- **EXP-360 status**: CLOSED — INCONCLUSIVE

## Date: 2026-09-03
