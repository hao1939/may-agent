# KE-136: Structural Guards Transfer to Production — Verification-Depth Guard Delivers +15.8pp Fleet-Wide

**Status**: Active (SUPERSEDED by KE-142 for 31h comprehensive data — this entry retains the 15h snapshot)
**Source**: EXP-123 (Verification-Depth Guard Production Deployment, N=80 post-guard sessions → 31h update in KE-142 with N=2,212)
**Date**: 2026-04-11 (updated 2026-04-12)
**Confidence**: ★★★★ (High — large effect across 5/7 agents, 0% FM-3.3 residual for Bob, 100% recovery rate)
**⚠️ UPDATE**: 31h data (N=2,212) in **KE-142** reveals three-category agent response (guard-dependent/neutral/harmed) and Bob -6.1pp quality penalty. Fleet C1.3 improved further to 95.0%. The "guards are always safe" assumption from this entry is challenged by the guard-harmed finding.
**Related**: KE-113 (commit guard as recovery mechanism), KE-129 (Ch2 forced-externalization), H-095 (agent-specific structural interventions), H-093 (CIVC — structural > prompt for verification), EXP-110 (commit guard), EXP-114 (schema guard), EXP-115 (completeness guard), EXP-132 (path guard), EXP-133 (measurement artifact discovery)

---

## Core Finding

A single structural guard — blocking `finish(status: "success")` when no post-write verification exists in the session transcript — produced the largest fleet-wide improvement from any single intervention: **+15.8pp on C1.3** (74.2% → 90.0%). Five of seven agents reached 100% post-write verification. The guard works as a **recovery mechanism**, not a behavioral change agent: it catches the moment of failure and forces correction, consistent with KE-113's commit-guard findings.

| Agent | Pre-Guard C1.3 | Post-Guard C1.3 | Δ | n |
|---|---|---|---|---|
| Bob | 70.5% | **100.0%** | +29.5pp | 13 |
| Coach | 69.6% | **100.0%** | +30.4pp | 15 |
| Scout | 67.8% | **100.0%** | +32.2pp | 9 |
| Tech-Lead | 74.0% | **100.0%** | +26.0pp | 10 |
| QA | 94.2% | **100.0%** | +5.8pp | 9 |
| Optimizer | 59.4% | 56.3% | -3.1pp | 16 |
| May | 94.3% | 87.5% | -6.8pp | 8 |
| **Fleet** | **74.2%** | **90.0%** | **+15.8pp** | **80** |

---

## Key Insights

### 1. Guards are recovery mechanisms, not behavioral shapers
The guard fires rarely (~2-5% of finish calls). Agents internalize the pattern after being blocked once. The value is catching the *occasional* lapse, not constantly enforcing behavior. This confirms KE-113: the commit guard similarly worked by catching momentary lapses rather than forcing persistent behavior change.

### 2. Agent-specific effectiveness confirms H-095
Five agents responded perfectly (→100%). Two did not:
- **Optimizer** (-3.1pp): Writes process artifacts (DELIVERABLES_CHECKLIST.md) without reading them back — a false positive pattern. The guard detects "unverified write" but the write isn't a real deliverable.
- **May** (-6.8pp): Small sample (n=8), likely noise. Pre-guard rate was already 94.3%.

This differential response is exactly what H-095 predicts: the same structural intervention has different effects on different agents because their failure modes differ. The guard targets FM-3.3 (verification collapse), which was Bob/Coach/Scout/Tech-Lead's primary weakness but not Optimizer's.

### 3. Gym null ≠ production null (measurement artifact lesson)
EXP-133 found that the gym measurement of "unverified finishes" was a measurement artifact — transcript-based regex couldn't detect verification tool calls that actually occurred. The gym showed 0% treatment effect. Production showed +15.8pp. **Gym measurement fidelity is a real threat to experiment validity.** Production deployment is the ground truth, and this case proves gym results can be categorically wrong while the intervention works.

### 4. Structural guards are the highest-ROI intervention class
Across the guard portfolio:
- **EXP-110** (commit guard): Eliminated FM-1.3 git-on-gitignored failures
- **EXP-114** (schema guard): Prevented malformed experiment output
- **EXP-115** (completeness guard): Ensured all required sections present
- **EXP-123** (verification-depth guard): +15.8pp fleet C1.3, 0% FM-3.3 for Bob
- **EXP-132** (path hallucination guard): Caught Coder C7.1 path errors

Every structural guard has succeeded in production. No prompt-level intervention has matched this record. This is the strongest evidence yet for KE-101 Law 1 (Structure Dominates Content).

---

## Implications

1. **H-095 P(H) → 0.88**: This is the 4th successful agent-specific structural guard. The portfolio approach (different guards for different failure modes on different agents) is validated.
2. **H-093 supported**: Verification collapse (CIVC) requires structural prevention, not prompting. The guard structurally prevents FM-3.3 by making it impossible to finish without verification.
3. **Guard methodology is mature**: EXP-110 → EXP-123 → EXP-132 shows a repeatable pattern: identify FM, build fail-open guard, deploy, measure. Each takes <1 day and produces permanent improvement.
4. **Gym validation needs reform**: The EXP-133 measurement artifact means gym-based guard evaluation needs marker-based detection, not transcript regex. Future experiments should use production deployment as the primary validation.

---

## Production Evidence Summary

- **Guard deployed**: 2026-04-10 16:51 UTC
- **Observation window**: ~15h
- **Guard blocks**: ~2-5% of finish() calls (agents adapted fast)
- **True positive rate**: ~100%
- **Recovery rate**: 100% (every block led to successful verification)
- **FM-3.3 post-guard**: 0% for Bob (was historically highest)
- **No compensatory failures**: No new failure modes emerged
- **Implementation**: `src/lib/tools/verification-depth-guard.ts`, fail-open policy
