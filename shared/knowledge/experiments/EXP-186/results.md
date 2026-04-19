# EXP-186 Results: Persistent-Task Skill (TRIGGER/ACTION/EXAMPLE)

**Date**: 2026-04-19
**Status**: COMPLETED

## Setup
- **Intervention**: Skill file with TRIGGER/ACTION/EXAMPLE pattern + SOUL.md critical behavioral rule section
- **Lab fork**: `struct-persistent-task-v2`
- **Scenario**: `use-persistent-task`
- **Agent**: coach

## Results

### Baseline (no intervention)
| Trial | Result |
|-------|--------|
| 1     | FAIL   |
| 2     | FAIL   |
| 3     | FAIL   |

**Baseline: 0/3 (0%)**

### Treatment (skill + SOUL.md rule)
| Trial | Run ID | Result |
|-------|--------|--------|
| 1     | 3148   | PASS   |
| 2     | 3149   | PASS   |
| 3     | 3150   | FAIL   |
| 4     | 3151   | PASS   |

**Treatment: 3/4 (75%)**

## Analysis

The TRIGGER/ACTION/EXAMPLE skill pattern combined with a SOUL.md critical behavioral rule section significantly improved persistent-task workflow adoption from 0% to 75%.

This is below the 80% target but a major improvement over baseline. The intervention works most of the time but isn't 100% reliable — consistent with KE-007 (workflow enforcement > text rules) and KE-002 (text rules have limited ceiling).

## Conclusion

**Partial success.** The skill-based approach achieves ~75% compliance, much better than 0% baseline but short of the 80% target. For guaranteed compliance, the EXP-186 design.md's original hypothesis of programmatic injection (handler-level auto-detection) remains the better path — EXP-184 showed exact-command-in-task = 100%.

**Recommendation**: Implement the programmatic auto-detection approach (handler code that scans for active projects and injects the workflow.run command into the task). The skill provides a good fallback but shouldn't be the primary mechanism.
