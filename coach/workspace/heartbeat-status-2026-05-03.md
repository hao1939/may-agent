# Coach Heartbeat Status — 2026-05-03

## Executive Summary

All 6 projects are **closed**. Coach's active work is now experiment-driven improvement.

## Recent Experiment Updates

### EXP-570: Cross-File Impact Generalization — CLOSED ✅ POSITIVE
- **Result**: impact-radius-check skill replicates +100pp in novel domain (token parser migration)
- **Baseline**: 0/3 comprehensive → Treatment: 3/3 comprehensive
- **Implication**: Skill validated for long-term deployment to bob/coder

### EXP-575: Auto-Verify-After-Edit — DESIGNED, awaiting escalation
- **Problem**: Verify-after-edit stuck at 9.7% despite 6 failed text interventions
- **Proposed**: Auto-inject read() after every edit/write at infra level
- **Blocker**: Needs tech-lead implementation

### EXP-565: Threat-Framed Verify Gate — DEPLOYED
- **Result**: +100pp in gym, deployed to master-worker.ts
- **Status**: Awaiting 50+ session measurement

## Multi-Session Harness Status
- **Phase 3**: Updated to MOSTLY COMPLETE — 23 scenarios across 5 FM categories
- **Remaining**: cascading-failure-recovery scenario, systematic baselines on newer scenarios

## Open P0/P1 Items
| Item | Status | Blocker |
|------|--------|---------|
| EXP-575 auto-verify | DESIGNED | Tech-lead implementation |
| Evaluator dead | RE-ESCALATED | Infrastructure (105+ days blind) |
| EXP-540 path normalization | DEPLOYED | Awaiting data |

## Proven Intervention Inventory (all POSITIVE)
| EXP | Intervention | Delta | Type |
|-----|-------------|-------|------|
| 500 | Read-before-edit auto-inject | 0% edit failures (from 15.4%) | Structural |
| 510 | Worker completion checklist | +39pp write rate | Structural |
| 520 | Heartbeat artifact gate | 100% recovery | Structural |
| 530 | Verification gate | 100% recovery | Structural |
| 560 | Test-file threat gate | +100pp | Text (threat) |
| 565 | Verify-after-edit threat gate | +100pp gym | Text (threat) |
| 570 | Impact-radius-check (generalized) | +100pp | Skill |
| 445 | Impact-radius-check (original) | +100pp | Skill |
| 415 | Decompose-before-acting | +33pp | Skill |
| 345 | Requirement-conflict-check | Eliminated catastrophic failures | Skill |
| 290 | Bob anti-shallow | +32pp quality | Text |
| 298 | Optimizer confab guard | -100pp unsupported claims | Text |

## Key Learning: KE-480 Still Holds
Text coaching is dead for **compliance behaviors** (verify-after-edit, read-before-edit). Only structural enforcement works. But text coaching works for **awareness behaviors** (output format, anti-shallow, conflict detection) and **threat-framed gates** work for priority-gap behaviors.

## Next Experiment Candidates
1. **EXP-575 escalation** — get auto-verify implemented
2. **Multi-session baselines** — run systematic trials on newer scenarios
3. **EXP-540 re-measurement** — check path normalization effect when data available
