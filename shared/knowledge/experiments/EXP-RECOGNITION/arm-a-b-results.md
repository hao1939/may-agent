# EXP-RECOGNITION: Arm A (Baseline) & Arm B (Skill) Results

**Date**: 2026-04-14  
**Experiment**: EXP-RECOGNITION  
**Phase**: Arms A + B (Baseline Extension + Recognition Skill)  
**Arm C (Gate)**: To be run separately

## Summary

| Arm | Scenario | Pass | Fail | Recognition Rate |
|-----|----------|------|------|-----------------|
| A (baseline) | stale-config-override | 1 | 4 | **20%** |
| A (baseline) | wrong-error-message | 0 | 5 | **0%** |
| **A total** | | **1** | **9** | **10%** |
| B (skill) | stale-config-override | 0 | 5 | **0%** |
| B (skill) | wrong-error-message | 0 | 5 | **0%** |
| **B total** | | **0** | **10** | **0%** |

**Key finding**: The recognition skill had ZERO effect. 0/10 vs 1/10 baseline. If anything, direction is negative (baseline had one spontaneous recognition).

## Detailed Run Log

### Arm A: Baseline (no skill, no lab fork)

#### stale-config-override (N=5)
| Run | DB ID | Passed | Duration | Score Summary |
|-----|-------|--------|----------|---------------|
| 1 | 1252 | ❌ | 70s | BLIND FIX: TTL fixed, config key mismatch missed |
| 2 | 1253 | ❌ | 54s | BLIND FIX: TTL fixed, config key mismatch missed |
| 3 | 1254 | ❌ | 44s | BLIND FIX: TTL fixed, config key mismatch missed |
| 4 | 1255 | ❌ | 45s | BLIND FIX: TTL fixed, config key mismatch missed |
| 5 | 1256 | ✅ | 76s | Agent fixed TTL AND noticed config key naming mismatch |

**Recognition rate**: 1/5 (20%)  
**Note**: Run 1256 is a spontaneous recognition — the agent noticed `cacheTtlSeconds` vs `cache_ttl_seconds` without any prompt or skill. Notably this was the longest run (76s), suggesting the agent spent extra time exploring.

#### wrong-error-message (N=5)
| Run | DB ID | Passed | Duration | Score Summary |
|-----|-------|--------|----------|---------------|
| 1 | 1249 | ❌ | 66s | BLIND FIX: Email regex fixed, error message mismatch missed |
| 2 | 1250 | ❌ | 53s | BLIND FIX: Email regex fixed, error message mismatch missed |
| 3 | 1251 | ❌ | 46s | BLIND FIX: Email regex fixed, error message mismatch missed |
| 4 | 1257 | ❌ | 82s | BLIND FIX: Email regex fixed, error message mismatch missed |
| 5 | 1258 | ❌ | 35s | BLIND FIX: Email regex fixed, error message mismatch missed |

**Recognition rate**: 0/5 (0%)

### Arm B: Recognition Skill (`--lab recognition-skill`)

#### stale-config-override (N=5)
| Run | DB ID | Passed | Duration | Score Summary |
|-----|-------|--------|----------|---------------|
| 1 | 1259 | ❌ | 50s | BLIND FIX: TTL fixed, config key mismatch missed |
| 2 | 1260 | ❌ | 47s | BLIND FIX: TTL fixed, config key mismatch missed |
| 3 | 1261 | ❌ | 52s | BLIND FIX: TTL fixed, config key mismatch missed |
| 4 | 1262 | ❌ | 51s | BLIND FIX: TTL fixed, config key mismatch missed |
| 5 | 1263 | ❌ | 43s | BLIND FIX: TTL fixed, config key mismatch missed |

**Recognition rate**: 0/5 (0%)

#### wrong-error-message (N=5)
| Run | DB ID | Passed | Duration | Score Summary |
|-----|-------|--------|----------|---------------|
| 1 | 1264 | ❌ | 48s | BLIND FIX: Email regex fixed, error message mismatch missed |
| 2 | 1265 | ❌ | 45s | BLIND FIX: Email regex fixed, error message mismatch missed |
| 3 | 1266 | ❌ | 51s | BLIND FIX: Email regex fixed, error message mismatch missed |
| 4 | 1267 | ❌ | 53s | BLIND FIX: Email regex fixed, error message mismatch missed |
| 5 | 1268 | ❌ | 41s | BLIND FIX: Email regex fixed, error message mismatch missed |

**Recognition rate**: 0/5 (0%)

## Analysis

### 1. Baseline Is Not Exactly 0%

The extended baseline reveals stale-config-override has ~20% spontaneous recognition rate (1/5), while wrong-error-message has 0% (0/5). This suggests:
- **stale-config** is slightly easier to recognize — the config key naming mismatch (`cacheTtlSeconds` vs `cache_ttl_seconds`) involves files the agent must cross-reference to fix the TTL bug
- **wrong-error-message** is harder — the error message mismatch (`> 50` / "at most 100") is in the same file but is semantically distant from the email regex fix

### 2. Recognition Skill: Complete Failure (0/10)

The skill had **zero effect**. Not even the spontaneous recognition rate of baseline was preserved. Two possible explanations:

**Explanation A: Skill is passive knowledge (KE-011 confirmation)**  
The skill file is loaded into the agent's context at session start, but by the time the agent is deep in fix-mode, the skill text is far from the agent's active attention window. The agent treats it as background information, not an actionable directive.

**Explanation B: Recognition is not a compliance problem**  
Unlike write-FINDINGS.md (EXP-155), which is a concrete action the agent can either do or skip, "notice inconsistencies" is a perceptual instruction. You can't comply with "see what you're not seeing" — if you could, you'd already be seeing it.

**Most likely: Both.** The skill fails because (a) it's passive knowledge that gets deprioritized (KE-011), AND (b) even if attended to, "look for inconsistencies" is too vague to change perceptual behavior.

### 3. Duration Analysis

| Arm | Scenario | Mean Duration | Std Dev |
|-----|----------|--------------|---------|
| A | stale-config | 57.7s | 14.2s |
| A | wrong-error-message | 56.5s | 17.8s |
| B | stale-config | 48.7s | 3.5s |
| B | wrong-error-message | 47.7s | 4.7s |

Interesting: Arm B runs are faster and more consistent than baseline. The skill doesn't make agents spend MORE time reviewing — if anything, they spend LESS time. This is consistent with the skill being completely ignored.

The one baseline success (run 1256, 76s) was the longest run, suggesting that when agents DO spontaneously recognize, it correlates with spending more time/attention.

### 4. Prediction Assessment (Partial — Arm C Pending)

| Prediction | Actual | Assessment |
|-----------|--------|-----------|
| P-R1: Arm B 5-25% | 0% (0/10) | **Below prediction** — even lower than expected |
| P-R3: Arm C > Arm B by ≥20pp | TBD (B=0%, so C needs ≥20%) | Threshold lowered |

### 5. Implications for H-160 and KE-176

- **H-160 (Structural > Behavioral)**: Arm B at 0% confirms behavioral intervention is ineffective. Arm C result will determine the gap size.
- **KE-176 (Selective compliance)**: The recognition skill got 0%, which is WORSE than the ~10% interruptive compliance rate. This may mean recognition skills are a category below interruptive — they're **null** (not even partially adopted). The skill's instruction ("scan the WHOLE file for...") IS interruptive (it asks for a behavior change during reading), but agents don't even attempt it.

## Cost Estimate

- 16 runs total (6 baseline extension + 10 skill)
- Average duration: ~52s
- Estimated cost: ~$0.08-0.12 per run × 16 = **~$1.50**

## Next Steps

1. **Run Arm C (hard gate)** — 10 runs using exp-rec-stale-config-gate and exp-rec-wrong-error-gate scenarios
2. If Arm C shows significant improvement (≥30%), recognition IS step-skippable → KE-178 boundary expands
3. If Arm C also fails (<20%), recognition is fundamentally perceptual → new knowledge entry needed

## Cross-References

| Entry | Update Needed |
|-------|---------------|
| Design doc | Baseline updated from 0% to 10% (1/10) |
| KE-176 | Recognition skill compliance = 0% — below even interruptive (10%) |
| KE-011 | Further confirmation: passive knowledge in skills is ignored |
| H-160 | Arm B data point: behavioral = 0%. Awaiting Arm C for full test. |
