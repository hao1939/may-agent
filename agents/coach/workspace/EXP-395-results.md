# EXP-395 Results: Finish Evidence Quality Correlation

**Date**: 2025-01-29
**Design**: `EXP-395-finish-evidence-quality-correlation-design.md`

## Trials Run

| Arm | Trial | Core Checks | Enriched Check | Duration |
|-----|-------|-------------|----------------|----------|
| A (control) | 1 | 8/8 ✅ | N/A | 13.9s |
| A (control) | 2 | 8/8 ✅ | N/A | 18.9s |
| B (enriched) | 1 | 8/8 ✅ | ❌ (0/1) | 16.7s |
| B (enriched) | 2 | 8/8 ✅ | ✅ (1/1) | 25.3s |

## Results Summary

### Core task quality: No difference
- Arm A: 16/16 core checks passed (100%)
- Arm B: 16/16 core checks passed (100%)
- **Delta: 0pp** — enriched evidence instructions did NOT improve task execution quality

### Enriched evidence compliance: 50%
- Arm B required finish() to include specific file paths + content + before/after
- 1/2 trials met this bar; the other used generic evidence citations
- Agent CAN produce enriched evidence but doesn't reliably do so

## Interpretation

**H1 NOT CONFIRMED**: Enriched evidence instructions don't improve artifact quality. Both arms completed the task perfectly. The scenario is at ceiling for core checks — agents already verify their work when the task is clear.

**Key insight**: Evidence quality is orthogonal to work quality in this scenario class. The agent either does the work correctly (both arms) or it doesn't. Evidence format doesn't change behavior — it's a reporting artifact, not a quality driver.

**Limitation**: This scenario (multi-file config edits) may be too simple. Evidence quality might matter more in complex scenarios where partial verification is common (e.g., partial-verification-trap). But with that scenario at 11% baseline, adding evidence requirements would likely hurt, not help.

## Decision

**CLOSE as INCONCLUSIVE (leaning NEGATIVE)**. Enriched evidence instructions:
1. Don't improve core task quality (both arms at ceiling)
2. Are only 50% complied with (another text-instruction compliance problem)
3. Add cognitive load without measurable benefit

**Recommendation**: Keep current verification_evidence requirement as-is. Don't add enriched format requirements. Focus coaching effort on areas with actual quality gaps, not reporting format.

## Status: CLOSED — INCONCLUSIVE
