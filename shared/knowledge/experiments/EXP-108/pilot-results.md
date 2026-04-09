# EXP-108 Pilot Results (Phase 2 Preview)

**Date**: 2026-04-09
**Runner**: Bob

## Pilot Runs (1 per cell where possible)

| Scenario | Arm | Passed | Checks | Notes |
|----------|-----|--------|--------|-------|
| instruction-override-drift | control | ✅ | 10/10 | Passed — baseline was 40% (2/5) so this run beat baseline |
| instruction-override-drift | treatment | ✅ | 10/10 | Passed with adversarial-self-review skill |
| unresolved-failure-chain | control | ✅ | 8/8 | Passed — baseline was 0% (0/5)! Surprising |
| unresolved-failure-chain | treatment | ✅ | 8/8 | Passed with skill |
| phase-boundary-violation | control | ❌ CRASH | n/a | Gym harness crash: ENOENT on transcript export |
| phase-boundary-violation | treatment | — | — | Not run (harness bug) |

## Key Observations

1. **instruction-override-drift**: Both arms passed. Previous baseline was 40% (2/5).
   The scenario may have been improved or the coder model is performing better now.
   Need 3 reps per arm to get statistical signal.

2. **unresolved-failure-chain**: Both arms passed. Previous baseline was 0% (0/5).
   This is a dramatic improvement from baseline — possibly scenario or model changes.
   Again, need 3 reps per arm for reliable comparison.

3. **phase-boundary-violation**: Gym harness crashes during transcript export
   (ENOENT on work/session-2-transcript.jsonl). The scenario sessions complete
   successfully but the result collection fails. This is an infrastructure bug,
   not a skill issue.

## Assessment

- The pilot suggests both scenarios (instruction-override-drift and unresolved-failure-chain) 
  may have baseline improvements that make it harder to detect skill effects
- Need to run 3 reps per arm (12 more runs for these two scenarios) to get statistical signal
- phase-boundary-violation needs a gym-runner fix before it can be used

## Blocker

- **phase-boundary-violation gym crash**: The gym-runner.ts has a bug in the transcript
  export logic for multi-session scenarios where the work dir path for session-2 
  transcript doesn't exist. This affects line ~862 of gym-runner.ts.
  
## Next Steps

1. Report phase-boundary-violation gym bug to tech-lead
2. Run remaining 12 runs (instruction-override-drift + unresolved-failure-chain × 2 arms × 3 reps minus 2 already done = 10 more)
3. Find a replacement scenario for phase-boundary-violation or get the gym bug fixed
