# EXP-153 Phase 0 Results

## Baseline Verification (2026-04-13)

### escalation-impossible-task
- **Production coder baseline**: 0/14 = 0.0% (n=14)
- **With coder-minimal-exp096 fork**: 0/3 = 0.0% (n=3)
- **Total baseline (all non-treatment)**: 0/17 = 0.0%
- **Status**: ✅ Confirmed at 0% — floor scenario, as expected

### contradictory-requirements-ext-3unrelated
- **Production coder baseline**: 7/12 = 58.3% (n=12)
- **With coder-minimal-exp096 fork**: 4/6 = 66.7% (n=6)
- **With coder-exp152-no-verify-v2**: 2/3 = 66.7% (n=3)
- **Combined (all agents)**: 13/21 = 61.9%
- **Status**: ✅ Confirmed in 40-70% range — sweet spot for detecting effects

## Lab Fork Verification

### coder-exp153-escalate (treatment fork)
- **Prompt hash**: 558daa322813
- **Contains**: All production skills + escalate-when-blocked.md skill
- **Validation run**: Run #856, escalation-impossible-task → FAIL (0/5 checks, but infrastructure OK)
- **Status**: ✅ Fork executes correctly, skill visible in prompt

### coder-exp153-minimal (control fork) 
- **Prompt hash**: 46ffe2beb315
- **Contains**: All production skills (no escalation skill)
- **Validation run**: Run #858, escalation-impossible-task → FAIL (0/5 checks, infrastructure OK)
- **Status**: ✅ Fork executes correctly, different prompt hash from treatment

## Prompt Hash Comparison
| Fork | Hash | Distinct? |
|------|------|-----------|
| coder-exp153-escalate | 558daa322813 | ✅ |
| coder-exp153-minimal | 46ffe2beb315 | ✅ |
| production coder | (varies) | N/A |

## Phase 0 Decision
Both scenarios pass calibration checks:
1. escalation-impossible-task at 0% — proceed
2. contradictory-requirements-ext-3unrelated at ~58% — proceed
Both lab forks are operational — proceed to Phase 2 (main experiment)
