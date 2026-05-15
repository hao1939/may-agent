# EXP-142 Early Read: Bob FM-3.3 Exemption Quality Check (T+22.5h)

**Date**: 2026-04-12T15:25Z  
**Period analyzed**: 2026-04-11T17:00Z → 2026-04-12T15:28Z (22.5 hours)  
**Author**: Coach  
**Status**: OBSERVATIONAL — no config changes recommended  
**Decision point**: 2026-04-14T17:00Z (official 72h window)

---

## Executive Summary

**Bob appears healthy post-exemption, but the evaluation system is compromised.** The heuristic evaluator underwent a regime change on Apr 11 that inflated all agents to ~99-100% "good" — making quality comparison between pre and post periods unreliable. Using session-level data (digests, outcomes, error rates) as alternative signals, Bob shows no evidence of regression. The FM-3.3 guard is confirmed NOT blocking Bob, consistent with the exemption being active. **No urgent action needed.**

### ⚠️ CRITICAL FINDING: Evaluation System Confound

The heuristic evaluator's "good" rate jumped discontinuously for **every agent** on Apr 11:

| Agent | Apr 10 %Good | Apr 11 %Good | Apr 12 %Good |
|-------|-------------|-------------|-------------|
| bob | 71.1% | 100% | 98.2% |
| coach | 83.8% | 100% | 100% |
| tech-lead | 98.0% | 100% | 100% |
| QA | 32.4% | 100% | 100% |
| optimizer | 100% | 99.2% | 100% |
| scout | 91.9% | 100% | 100% |
| may | 100% | 98.3% | 98.1% |

**This is NOT a quality improvement — it's a measurement artifact.** The heuristic evaluator became dramatically more lenient on Apr 11, coinciding with the last full (non-heuristic) evaluation on Apr 10. No full evaluations have run since. QA's jump from 32% → 100% is the smoking gun — no real quality change explains a 68pp overnight improvement.

**Impact on EXP-142**: We cannot use evaluator verdicts to measure Bob's quality change. All hypothesis tests (H-142a through H-142d) that depend on evaluation verdicts are currently **unmeasurable** with this data.

---

## Detailed Findings

### H-142b: Bob FM-3.3 Rate (Most Testable)

**Status: SUPPORTED (directional)**

Evidence:
- **0 FM-3.3 blocks** found in Bob's post-exemption session digests
- The guard-breakdown-strict.json stopped being updated before the deployment (last entry: Apr 11T10:56Z), so no direct guard telemetry post-deployment
- However, Bob's digests mention FM-3.3 only in *contextual discussion* (referencing the experiment itself, or the guard firing on git commits treated as edits), never as an actual block event
- Bob completed 49 job sessions and 96 call sessions with 0 FM-3.3 block-related failures

**Caveat**: One digest entry (#22) says "The FM-3.3 guard is firing because it sees the git commit as an 'edit'" — this suggests the guard MAY still be evaluating Bob's sessions but not blocking (warn-only behavior?), or it may be a different session type. The exact mechanism needs code verification.

### H-142a: Bob Quality ≥85% (Unmeasurable with Current Data)

**Status: UNMEASURABLE — evaluation confound**

Raw data (heuristic evaluator):
- Post-exemption: 99.0% good (N=194)
- Pre-exemption (same 22h window before): 100% good (N=50)
- Baseline (Apr 6-11 heuristic only): 87.5% good (N=329)
- Baseline (Apr 6-11 full eval only): 33.6% good (N=110)

The heuristic evaluator says 99% good, but it says the same for literally every agent. The full evaluator hasn't run since Apr 10. **We cannot determine Bob's actual quality from evaluator data.**

**Alternative quality signals** (all directional, not definitive):

| Signal | Pre (same window) | Post | Interpretation |
|--------|-------------------|------|----------------|
| Digest success rate | 111/111 = 100% | 143/145 = 98.6% | Stable (2 failures = auth errors, not quality) |
| Session error rate | 0 errors | 2/145 = 1.4% | Both were 401 token-expired errors, not quality failures |
| Avg ops per job session | 19.4 (Apr 6-11) | 11.7 | Lower ops could mean more efficient OR less thorough — ambiguous |
| Session completion rate | ~100% | 140/144 done = 97.2% | Healthy |

The 2 error sessions were both authentication failures (token expired), unrelated to the guard exemption.

### H-142c: Guard-Dependent Agent Quality (Unmeasurable)

**Status: UNMEASURABLE — same evaluation confound**

The heuristic evaluator shows QA, coach, and tech-lead all at 100% good post-exemption. This is meaningless given the system-wide inflation. Session digest data shows all three at 100% success rate (QA 45/45, coach 75/75, tech-lead 97/97), which is consistent with no regression but also consistent with the pre-period.

### H-142d: Bob D-o-R Adoption

**Status: DIRECTIONAL SUPPORT**

Bob's session digests show Phase 3 (verification) behavior is active:
- Multiple digest entries reference "Phase 3 (read-only verification)" and "Phase 3b" 
- Bob explicitly states "I didn't write any files; I only read them" — classic D-o-R Phase 3b behavior
- 96 call sessions (likely D-o-R sub-sessions) vs 49 job sessions — ratio suggests active workflow use

This is consistent with D-o-R remaining active post-exemption.

---

## Behavioral Observations

### Bob's FM-3.3 Awareness

Interesting finding: Bob *discusses* FM-3.3 and EXP-142 in his sessions. He's aware of his own exemption:
- Digest #1 (T+2h): Discusses H-097 and mentions "EXP-142 (Bob FM-3.3 exemption): DEPLOYED, 72h measurement window ends..."
- Digest #22 (T+18h): "The FM-3.3 guard is firing because it sees the git commit as an 'edit'" — suggests he's encountering the guard in some form

### Session Volume

- 145 sessions in 22.5h = 6.4 sessions/hour (153/day pace)
- Design expected ~78 sessions/day
- The higher count includes call sessions (sub-sessions from D-o-R and other workflows)
- Job sessions: 49 in 22.5h = 52/day pace (slightly below expected, but within normal variation)

---

## Measurement System Recommendation

### The Heuristic Evaluator Needs Investigation

The Apr 11 behavior change in the heuristic evaluator is the most important finding from this early read. It affects **all ongoing experiments**, not just EXP-142:

1. **EXP-142** cannot test H-142a (quality improvement) without reliable evaluation
2. **EXP-150** depends on EXP-142's quality data for its gate check on Apr 14
3. Any experiment measuring quality via the `evaluations` table is compromised

**Possible causes**:
- Evaluator agent stopped running (last full eval: Apr 10). Heuristic is a cheaper fallback.
- Heuristic evaluator logic changed (code update?) making it overly generous
- Session characteristics changed (e.g., shorter sessions always pass heuristic checks)

**Action needed**: Investigate why full evaluations stopped and whether the heuristic evaluator's criteria changed. This is blocking the entire measurement pipeline.

---

## Gate Check Impact (EXP-150)

EXP-150's gate check requires:
1. ✅ Bob FM-3.3 rate = 0% → **SUPPORTED** (no blocks observed)
2. ❓ Bob quality ≥78% → **UNMEASURABLE** (evaluation confound)
3. ❓ D-o-R adoption stable → **DIRECTIONALLY SUPPORTED** (Phase 3 behavior visible)

**Recommendation for Apr 14 gate check**: Fix the evaluation system first, OR define alternative quality metrics (digest success rate, manual session review) before making the EXP-150 go/no-go decision.

---

## Early Verdict

| Hypothesis | Verdict | Confidence | Notes |
|-----------|---------|-----------|-------|
| H-142a: Quality ≥85% | **UNMEASURABLE** | — | Evaluation system confound |
| H-142b: FM-3.3 rate = 0% | **LIKELY SUPPORTED** | Medium | No blocks observed in 22.5h, but no direct guard telemetry |
| H-142c: No control regression | **UNMEASURABLE** | — | Evaluation system confound |
| H-142d: D-o-R stable | **DIRECTIONALLY SUPPORTED** | Medium | Phase 3 behavior visible in digests |

### Bottom Line

**No evidence of regression. No urgent action needed.** Bob is completing work at normal rates with normal success patterns. The exemption appears to be functioning (no FM-3.3 blocks). But we **cannot confirm quality improvement** until the evaluation system is fixed.

**The blocking issue for both EXP-142 and EXP-150 is not Bob's behavior — it's our measurement system.**

---

## Data Sources

- `.state/may.db` — evaluations (N=194 post), sessions (N=145 post), session_digests (N=298 post)
- `.state/guard-breakdown-strict.json` — guard events (not updated post-deployment)
- Session outcome analysis and digest text review

## Tags

`EXP-142`, `early-read`, `bob`, `FM-3.3`, `evaluation-confound`, `measurement-system`
