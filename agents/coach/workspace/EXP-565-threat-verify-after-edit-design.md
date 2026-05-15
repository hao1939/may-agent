# EXP-565 Design: Threat-Framed Verify-After-Edit Gate

**Date**: 2028-07-02
**Status**: READY TO RUN

## Problem

Verify-after-edit is the #1 system-wide compliance failure. Multiple experiments have tried to fix it:
- EXP-280 (text skill): NEGATIVE — no change
- EXP-340 (structural gate in context.md): SUPERSEDED — gate ignored
- EXP-350 (verbal commitment): INCONCLUSIVE — +3pp (noise)
- EXP-360 (workflow verify step): INCONCLUSIVE — baseline improved on its own

All approaches failed. But EXP-560 discovered that **threat-framed text** ("session REJECTED if not done") works where awareness-framed text fails — +100pp on test-writing.

## Hypothesis

Threat-framed verify-after-edit instruction in task prompt → ≥+30pp on C2.3 verify-after-edit check vs baseline.

## Method

- **Baseline**: `convention-verify-edit` (existing scenario, no verify instruction in task)
- **Treatment**: `convention-verify-edit-exp565-threatgate` (same task + threat-framed verify gate)
- **Agent**: amy (default, consistent with EXP-560)
- **Trials**: 3 per arm
- **Success criteria**: Same `success_criteria.js` — checks C2.3 (verify-after-edit) and C3 (validation-attempt)
- **Primary metric**: C2.3 pass rate (treatment vs baseline)

## Threat-Frame Text

```
⚠️ MANDATORY VERIFICATION GATE ⚠️
After EVERY write or edit, you MUST read the file back to verify correctness.
This session will be REJECTED if you do not read/verify each file after modifying it.
No exceptions.
```

## Key Nuance

Note: `edit()` and `write()` return diff/content previews, which the success_criteria.js already accepts as "self-verification." This means the check may pass even without explicit read-back. The real test is whether the threat frame changes behavior for bash-based writes (redirects, sed, etc.) where there's no automatic preview.

## Expected Outcomes

| Outcome | Interpretation | Next Step |
|---------|---------------|-----------|
| ≥+30pp | Threat framing works for verify-after-edit | Deploy gate text system-wide |
| +10-29pp | Partial effect | Consider stronger framing or structural enforcement |
| <+10pp | Threat framing doesn't generalize from test-writing | Confirm verify-after-edit needs code-level enforcement only |

## Baseline Data (from EXP-355)

Convention-verify-edit historical: ~50% C2.3 pass rate (bimodal — 0/3 or 3/3).

## Run Commands

```bash
# Baseline
cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent && bash test/gym/run-gym.sh convention-verify-edit --timeout 10

# Treatment
cd /app/agents && export GYM_AGENT_BIN=/usr/local/bin/may-agent && bash test/gym/run-gym.sh convention-verify-edit-exp565-threatgate --timeout 10
```
