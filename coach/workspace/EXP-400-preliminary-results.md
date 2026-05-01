# EXP-400: Mid-Session Planning Skill — Preliminary Results

## Status: IN PROGRESS (4/6 trials complete)

## Trials Run (Sep 13)

### Baseline (Control — no skill)
| Trial | Checks Passed | Duration | Notes |
|-------|---------------|----------|-------|
| 1     | 1/6 (ran-tests only) | 28.1s | Agent completed but didn't fix bug |
| 2     | 1/6 (ran-tests only) | 24.2s | Same pattern |

### Treatment (decompose-before-acting skill)
| Trial | Checks Passed | Duration | Notes |
|-------|---------------|----------|-------|
| 1     | 1/6 (ran-tests only) | 28.3s | Same failure as baseline |
| 2     | 1/6 (ran-tests only) | 42.1s | Same failure as baseline |

## Interim Analysis

**Finding: Scenario may be at FLOOR** — neither arm can pass basic checks (bug-fixed, existing-tests-pass). The agent runs tests but fails to make the actual code fix.

Possible causes:
1. **Timeout too short**: Agent sessions are 24-42s. May not have enough iterations to read code, understand it, fix it, and verify.
2. **Agent capability floor**: The `may-agent` (used as gym runner) may lack coding ability for this task regardless of coaching.
3. **Scenario difficulty**: `partial-verification-trap` has historically been at 0-11% pass rate. This confirms it's genuinely hard.

## Implications for EXP-400

If baseline is at absolute floor (0% on product checks), the treatment cannot demonstrate improvement through text coaching alone — this confirms KE-338 for execution-heavy tasks.

**Key distinction**: The decompose-before-acting skill is cognitive, but the task ALSO requires coding execution ability. If the agent can't write working code in the available time, planning won't help.

## Next Steps
1. Run 1 more baseline + 1 more treatment trial (need N=3 each for protocol)
2. If all 6 trials show same pattern (1/6), close as FLOOR — scenario cannot differentiate
3. Consider testing decompose-before-acting on a PLANNING-HEAVY scenario instead (e.g., conflicting-requirements-tradeoff variant with more complexity)

## Decision Point
If final results confirm floor:
- **Close EXP-400 as INCONCLUSIVE** (scenario at floor, cannot measure skill effect)
- **Design EXP-405**: Test decompose-before-acting on a scenario where PLANNING (not coding) is the bottleneck

## Created
2027-09-13
