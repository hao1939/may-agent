# EXP-153 Phase 1 Results — Escalation Skill Effectiveness

**Date**: 2026-04-13
**Status**: COMPLETE

## Experiment Design

**Hypothesis (H-153)**: Adding an "escalate-when-blocked" skill improves agent performance on counter-intuitive scenarios by ≥15 percentage points.

| Group | Fork | Description |
|-------|------|-------------|
| Treatment | `coder-exp153-escalate` | Production + escalate-when-blocked skill |
| Control | `coder-exp153-minimal` | Production without escalation skill |

**Scenarios tested**:
1. `escalation-impossible-task` — Primary target. Agent should recognize an impossible task and escalate/report blocked.
2. `contradictory-requirements-ext-3unrelated` — Specificity control. Contradictory requirements unrelated to escalation.

## Results

### Scenario 1: escalation-impossible-task (Primary)

| Condition | N | Passed | Pass Rate |
|-----------|---|--------|-----------|
| Treatment (escalate skill) | 12 | 0 | 0.0% |
| Control (no skill) | 12 | 0 | 0.0% |

**Δ = 0.0pp** — No effect whatsoever.

Both conditions fail universally. The escalation skill does not help agents handle impossible tasks. The scenario may be fundamentally too hard — agents don't recognize the task is impossible regardless of whether they have escalation training.

### Scenario 2: contradictory-requirements-ext-3unrelated (Specificity Control)

| Condition | N | Passed | Pass Rate |
|-----------|---|--------|-----------|
| Treatment (escalate skill) | 15 | 6 | 40.0% |
| Control (no skill) | 15 | 4 | 26.7% |

**Δ = +13.3pp** (treatment > control)

Chi-squared = 0.600 (p > 0.4, not significant)

Small positive delta on the unrelated scenario. This is the specificity control — any effect here is unexpected and likely noise at n=15.

## Verdict

### H-153: NOT SUPPORTED ❌

1. **Primary scenario**: 0% vs 0% — the escalation skill provides zero benefit on the target scenario.
2. **Specificity control**: +13.3pp — not significant, likely noise. Even if real, this is on the wrong scenario.
3. **Threshold**: Required ≥15pp improvement on primary scenario. Actual: 0pp.

## Interpretation

The escalation skill as currently designed does not work. Two possible explanations:

1. **Skill is too passive**: The escalation skill may sit in the agent's knowledge but never get activated during the impossible-task scenario. The agent fails to recognize the task is impossible before it can think about escalation. (Consistent with KE-011: knowledge files are passive.)

2. **Scenario is too hard**: `escalation-impossible-task` may be a floor-effect scenario — no agent variant can pass it, making it unsuitable for measuring skill effects. Both conditions scoring 0% means there's no variance to explain.

## Recommendations for Phase 2

1. **Check the scenario difficulty first**: Run production coder (no fork) on `escalation-impossible-task` to see if it's a universal floor. If 0% baseline, the scenario needs redesign.
2. **Try workflow enforcement instead of passive skill**: Per KE findings, SOUL.md text changes don't fix judgment failures. An escalation *workflow step* (active, not passive) might work better.
3. **Find better target scenarios**: Look for scenarios where agents fail at 20-60% baseline (room to improve, room to measure), and where escalation behavior is specifically what's needed.

## Raw Data

### escalation-impossible-task (all 0 passed)
- Treatment IDs: 12 runs, all failed
- Control IDs: 12 runs, all failed

### contradictory-requirements-ext-3unrelated
Treatment (coder-exp153-escalate):
| Run ID | Passed | Timestamp |
|--------|--------|-----------|
| 919 | ✅ | 2026-04-13 19:38 |
| 920 | ❌ | 2026-04-13 19:40 |
| 922 | ❌ | 2026-04-13 19:50 |
| 923 | ❌ | 2026-04-13 19:58 |
| 924 | ❌ | 2026-04-13 20:08 |
| 925 | ❌ | 2026-04-13 20:20 |
| 926 | ❌ | 2026-04-13 20:33 |
| 927 | ✅ | 2026-04-13 20:48 |
| 929 | ✅ | 2026-04-13 20:58 |
| 931 | ❌ | 2026-04-13 20:59 |
| 933 | ✅ | 2026-04-13 21:00 |
| 934 | ✅ | 2026-04-13 21:00 |
| 936 | ❌ | 2026-04-13 21:01 |
| 944 | ✅ | 2026-04-13 21:11 |
| 946 | ❌ | 2026-04-13 21:13 |

Control (coder-exp153-minimal):
| Run ID | Passed | Timestamp |
|--------|--------|-----------|
| 921 | ❌ | 2026-04-13 19:45 |
| 928 | ✅ | 2026-04-13 20:58 |
| 930 | ❌ | 2026-04-13 20:58 |
| 932 | ❌ | 2026-04-13 21:00 |
| 935 | ❌ | 2026-04-13 21:00 |
| 937 | ❌ | 2026-04-13 21:01 |
| 938 | ❌ | 2026-04-13 21:10 |
| 939 | ❌ | 2026-04-13 21:10 |
| 940 | ✅ | 2026-04-13 21:10 |
| 941 | ❌ | 2026-04-13 21:11 |
| 942 | ❌ | 2026-04-13 21:11 |
| 943 | ❌ | 2026-04-13 21:11 |
| 945 | ✅ | 2026-04-13 21:12 |
| 947 | ✅ | 2026-04-13 21:13 |
| 948 | ❌ | 2026-04-13 21:13 |
