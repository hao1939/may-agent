# Experiment Measurement Status — 2026-05-25

## EXP-530: Structural Verification Gate — INSUFFICIENT DATA

**Status**: DEPLOYED but only 3 recent worker sessions found with VERIFICATION GATE injection
**Deployed**: 2026-07-01 (in master-worker.ts:451)
**Needed**: 20+ worker sessions for measurement
**Observation**: Of the 3 recent sessions (1777* timestamps), all had reads > writes, suggesting verification is occurring. But n=3 is far too small for formal measurement.

### Preliminary Signal (n=3)
| Session | Writes | Reads | Finish | Verification? |
|---------|--------|-------|--------|--------------|
| s_1777747355258_848 | 8 | 16 | yes | ✅ reads >> writes |
| s_1777747827060_860 | 0 | 0 | yes | N/A (no writes) |
| s_1777747836429_861 | 0 | 0 | yes | N/A (no writes) |

**Next**: Wait for 17+ more worker sessions, then re-measure.

## EXP-440: QA Finish-Call Compliance — LIKELY NEGATIVE

**Status**: Treatment deployed (SESSION EXIT RULE in qa/context.md)
**Current data**: QA convention summary shows C8.2 at 14.3% pass rate (2/14) and C1.4 at 14.3% (2/14)
**Baseline**: 25% (from original 75% fail rate)
**Target**: ≤50% fail rate (i.e., ≥50% pass rate)

**Result**: 14.3% pass rate is WORSE than the 25% baseline. The text intervention has either:
1. Not had enough time to take effect, OR
2. Failed (consistent with KE-480: text coaching is dead for structural behaviors)

**Recommendation**: Close EXP-440 as NEGATIVE. QA finish() compliance needs structural intervention (like EXP-510/520 pattern), not text rules.

## Convention Violation Hotspots (7-day window)

| Agent | Convention | Pass Rate | Description |
|-------|-----------|-----------|-------------|
| qa | C1.4 | 14.3% (2/14) | No finish() call |
| qa | C8.2 | 14.3% (2/14) | Missing finish fields |
| tech-lead | C7.1 | 39.1% (9/23) | Wrong file paths |
| may | C1.7 | 64.3% (9/14) | No verification before finish |
| bob | C1.3 | 73.3% (33/45) | Unverified writes |
| coach | C1.1 | 74.2% (23/31) | Blind edits |
| bob | C1.1 | 77.8% (35/45) | Blind edits |
| tech-lead | C1.1 | 78.3% (18/23) | Blind edits |

## Next Experiment Priority

**#1 target: tech-lead C7.1 (39.1% pass rate — wrong file paths)**

This is the worst non-QA violation and is structurally addressable. Tech-lead uses paths like `/Users/hao/c/...` or `/home/...` instead of relative paths. A structural injection in the prompt could fix this.

→ Designing EXP-540 below.
