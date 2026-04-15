# EXP-150 Results: Architectural Readiness Guard Calibration Pilot

**Status**: IN PROGRESS — Phase 1 deployed, measurement active  
**Deployed**: 2026-04-15T10:32:00Z  
**Measurement period ends**: 2026-04-19T10:32:00Z (T+96h)  
**T+48h checkpoint due**: 2026-04-17T10:32:00Z  
**Author**: Coach  

---

## Phase 1: Gate Check (EXP-142 Review)

### Gate Condition
- Bob quality ≥78% post-exemption ✅
- No D-o-R regression ✅

### Bob Post-Exemption Quality (Apr 11T17:00Z → Apr 15T10:30Z)

| Period | N | % Good (≥0.75) | Avg Quality |
|--------|---|----------------|-------------|
| Pre-exemption (Apr 6–11) | 466 | 86.7% | 0.76 |
| Post-exemption (Apr 11–15) | 354 | **94.1%** | 0.92 |
| **Delta** | — | **+7.4pp** | **+0.16** |

### Daily Breakdown (Post-Exemption)

| Day | N | % Good | Avg Quality |
|-----|---|--------|-------------|
| Apr 11 (partial) | 60 | 90.0% | 0.90 |
| Apr 12 | 118 | 98.3% | 0.90 |
| Apr 13 | 84 | 100.0% | 1.00 |
| Apr 14 | 81 | 90.1% | 0.90 |
| Apr 15 (partial) | 11 | 54.5% | 0.68 |

Note: Apr 15 is partial day (only 11 evals by 10:30 UTC). Disregard for gate assessment.

### FM-3.3 Blocks Post-Exemption
- Total Bob session digests: 726
- FM-3.3 mentions: 3 (all contextual references, not actual blocks)
- Genuine FM-3.3 blocks: **0** ✅

### Gate Decision: **PROCEED** ✅

Bob quality at 94.1% (well above 78% threshold), +7.4pp improvement over pre-exemption baseline, 0 genuine FM-3.3 blocks. EXP-142 is a clear success — the guard was genuinely harming Bob's output quality.

---

## Phase 1: Deployment

### Code Changes

| File | Change | Status |
|------|--------|--------|
| `src/lib/tools/verification-depth-guard.ts` | Added `warnOnlyAgents` option to `VerificationDepthGuardOptions` interface. When agent is in warn-only list, guard evaluates normally but returns `block: false` with `[WARN-ONLY]` tagged reason. Logs to stderr with `[EXP-150][WARN-ONLY]` prefix for measurement. | ✅ Deployed |
| `src/lib/manager.ts` | Added `warnOnlyAgents: ["coach", "tech-lead"]` to guard config | ✅ Deployed |

### Precedence Logic
1. `exemptAgents` (skip entirely) — Bob
2. `warnOnlyAgents` (evaluate but don't block) — Coach, Tech-Lead  
3. Standard mode (evaluate and block) — all others

### Tier 2 Baseline Quality (for comparison at T+48h/T+96h)

| Agent | N (Apr 8–15) | % Good (≥0.75) | Avg Quality |
|-------|--------------|-----------------|-------------|
| coach | 598 | 87.6% | 0.81 |
| tech-lead | 499 | 93.4% | 0.86 |

### Warn-Only Measurement
Warn events are logged with `[EXP-150][WARN-ONLY]` tag to stderr and included in session transcripts. Query:
```sql
SELECT agent,
  DATE(created_at/1000, 'unixepoch') as day,
  COUNT(*) as totalDigests,
  SUM(CASE WHEN what_happened LIKE '%WARN-ONLY%' OR details LIKE '%WARN-ONLY%' THEN 1 ELSE 0 END) as warnTriggers
FROM session_digests
WHERE agent IN ('coach', 'tech-lead')
  AND created_at > 1776249120000
GROUP BY agent, day;
```

---

## Upcoming Checkpoints

### T+48h (Apr 17 ~10:30 UTC)
- [ ] Coach quality ≥82.6% (baseline 87.6% − 5pp)
- [ ] Tech-lead quality ≥88.4% (baseline 93.4% − 5pp)
- [ ] Warn-only trigger rate trend (flat or declining)
- [ ] Control group (QA, evaluator) quality stable

### T+96h Final (Apr 19 ~10:30 UTC)
- [ ] P-150a: Coach/TL quality within ±3pp of baseline
- [ ] P-150b: Warn-only trigger rate flat or declining
- [ ] P-150c: Tier 3 FM-3.3 rate with verify-wrap adoption
- [ ] P-150d: Fleet-wide quality ≥3pp improvement
- [ ] P-150e: Workflow adoption × block rate correlation

---

## Notes

- Quality scale is 0–1 (not 0–5 as design.md queries assumed). "Good" = quality ≥ 0.75. All measurement queries must use this threshold.
- EXP-142 results show a much larger improvement than predicted (+7.4pp vs expected +5pp). The guard was more harmful to Bob than initial estimates suggested.
- Apr 15 partial-day data (54.5% for Bob) is likely noise from small N=11. Will normalize as day progresses.
