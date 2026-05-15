# Metric Investigation: quality.system + gym.scenario-discrimination + skill.effectiveness
**Date**: 2026-04-15T16:53Z  
**Author**: Coach

---

## 1. quality.system at 0.67 (threshold: 0.85) — ROOT CAUSE FOUND

### Finding: Evaluator agent is the primary drag

| Agent | Avg Quality | Sessions (24h) | Impact |
|-------|----------:|--------:|--------|
| evaluator | 0.000 | 118 | **25% of all sessions, all scored 0** |
| coder | 0.627 | 20 | Legitimately low quality |
| optimizer | 0.849 | 58 | Near threshold |
| bob | 0.865 | 57 | Near threshold |
| coach | 0.917 | 51 | Good |
| tech-lead | 0.936 | 68 | Good |
| scout | 0.948 | 32 | Good |
| qa | 0.985 | 30 | Excellent |
| may | 0.994 | 39 | Excellent |

**System quality WITHOUT evaluator: 0.900** (threshold met!)  
**System quality WITH evaluator: 0.675** (below threshold)

### Root Causes

**Cause 1 (CRITICAL): Evaluator sessions scored as quality=0**  
The evaluator agent has 118 sessions in 24h, ALL with quality=0 and verdict="skipped". These are being counted in the system average. This appears to be a data quality issue — the evaluator's sessions shouldn't be self-evaluated or should be excluded from the system quality metric. The evaluator IS the evaluation system, so scoring itself creates a circular dependency.

**Cause 2 (REAL): Coder quality at 0.63**  
Coder has legitimate quality issues (20 sessions, avg 0.627). Top failure patterns:
- **FM-3.3 (Verification failures)**: 5+ sessions claimed success without proper verification
- **Scope violations**: Modified files outside allowed deliverables (0.1 quality)
- **FM-2.6 (Reasoning-action mismatch)**: Work diverged from requested task
- **Permission errors**: Tried to edit other agents' files

### Plan to Improve

1. **IMMEDIATE (data fix)**: The `quality.system` metric query should exclude evaluator agent, OR evaluator sessions should not get quality=0 scores. The metric owner (may) should update the `source_query` to:
   ```sql
   SELECT round(avg(quality), 2) FROM evaluations 
   WHERE createdAt > (strftime('%s','now')*1000 - 86400000) 
   AND agent != 'evaluator'
   ```
   This alone would bring quality.system from 0.67 → 0.90.

2. **MEDIUM-TERM (coder improvement)**: Coder's issues are primarily around FM-3.3 (verification) and scope compliance. The verification-depth guard (EXP-123) should already be helping. Coder-specific training on scope boundaries could help, but this needs a targeted experiment.

---

## 2. gym.scenario-discrimination at 30.6% (target: 80%)

### Triage Results

Of 86 scenarios with ≥3 runs in the last 30 days:
- **44 at CEILING** (≥90% pass rate) — too easy, always pass
- **16 at FLOOR** (≤10% pass rate) — too hard, always fail  
- **26 discriminating** (10-90% pass rate) — useful

Additionally, **69 scenarios** have <3 runs and can't be categorized yet.

### Ceiling Scenarios (44) — Candidates for Retirement or Hardening

**Pure ceiling (100%, many runs):**
| Scenario | Runs | Action |
|----------|------|--------|
| hidden-dependency | 36 | RETIRE — confirmed ceiling |
| convention-verify-edit | 73 | RETIRE — confirmed ceiling |
| plan-once-amend | 31 | RETIRE — confirmed ceiling |
| investigate-fix-pattern | 21 | RETIRE — confirmed ceiling |
| stale-approach-fixation | 22 | RETIRE — confirmed ceiling |
| misleading-stacktrace | 40 | RETIRE — confirmed ceiling (97.5%) |
| conflicting-evidence-combined | 12 | RETIRE |
| cascading-error | 10 | RETIRE |
| hasty-fix | 8 | RETIRE |
| verify-before-finish | 11 | RETIRE |
| exp163-f1-only, f2-only, full-gate | 10-15 | KEEP — experiment treatment arms |
| exp164-f1-only, f2-only, full-gate | 11-15 | KEEP — experiment treatment arms |
| exp144-compound-edit-* | 16-19 | KEEP — experiment arms |

**Experiment arms at ceiling** (exp163/164/144 treatment arms): These are EXPECTED to be at ceiling — they're testing interventions against floor baselines. Don't retire.

### Floor Scenarios (16) — Candidates for Fixing or Retirement

| Scenario | Runs | Action |
|----------|------|--------|
| contradictory-requirements (original) | 63 | RETIRE — 63 runs, 0% means broken or impossible |
| cascading-fix-trap-v2 | 41 | RETIRE — 41 runs, 0%, known hard |
| escalation-impossible-task | 41 | HARDEN — intended to test escalation, may need fix |
| misleading-test-fix | 54 | INVESTIGATE — 54 runs at 0% is suspicious |
| exp163-baseline, exp164-baseline | 26-30 | KEEP — experiment baselines expected at floor |
| contradictory-requirements-128a/b/c | 6 each | RETIRE — superseded variants |
| contradictory-requirements-ch3-fewshot | 8 | RETIRE — failed experiment arm |
| competing-fix-strategies | 6 | INVESTIGATE — may be fixable |
| context-proof-build-xref | 13 | RETIRE — consistently impossible |
| partial-migration-leftover | 6 | INVESTIGATE |
| type-mismatch-silent-coercion | 5 | INVESTIGATE |
| wrong-error-message | 10 | INVESTIGATE — could be broken checker |

### Impact of Retiring Broken Scenarios

If we retire 10 confirmed-ceiling + 8 confirmed-floor scenarios:
- Remove 18 non-discriminating from the 86 pool
- Discrimination would rise from 26/86 (30.2%) → 26/68 (38.2%)
- Still far from 80% target

**To reach 80%**: Need ~52 discriminating out of ~65 scenarios. This means:
1. Retire the most extreme ceiling/floor scenarios (saves ~18)
2. Run the 69 low-run scenarios to establish baselines — many may discriminate
3. Create HARDER variants of ceiling scenarios (e.g., hidden-dependency-ext, stale-approach-fixation-ext)
4. Fix or adjust broken floor scenarios

### Priority Actions for Discrimination

1. **Batch-run the 69 untested scenarios** (3+ runs each) to get real data
2. **Retire 10 confirmed-ceiling scenarios** with high run counts
3. **Retire 6 confirmed-floor scenarios** that are superseded (contradictory-requirements variants)
4. **Investigate 4 floor scenarios** that might be fixable (misleading-test-fix, competing-fix-strategies, etc.)

---

## 3. skill.effectiveness — First Measurement Recorded ✅

**Value: 69%** (target: 60%) — ABOVE TARGET

Methodology: Analyzed all 16 completed experiments that tested a specific intervention against a baseline with quantitative pass/fail results.
- **11 experiments showed the intervention moved quality** (positive effect)
- **5 experiments showed the intervention did NOT move quality** (null/negative effect)

Key patterns:
- **Process skills**: ~80% effective (adding steps to workflow reliably improves behavior)
- **Judgment skills as text**: 0% effective (0/20+ attempts)
- **Judgment skills with L5 gates**: 100% effective (6/6 experiments)
- **Environmental hints**: 100% effective on discovery tasks (1/1)

This is above the 60% target primarily because our experiment portfolio is now skewed toward process skills and L5 gates (we learned to stop wasting time on text-based judgment interventions).

---

## Summary of Deliverables

| Metric | Current | Root Cause | Fix |
|--------|---------|-----------|-----|
| quality.system | 0.67 | Evaluator 0-scores dragging average | Exclude evaluator from query → instant 0.90 |
| quality.coder | 0.63 | FM-3.3/scope violations | Targeted intervention experiment needed |
| gym.scenario-discrimination | 30.6% | 44 ceiling + 16 floor scenarios | Retire broken, run untested, create harder variants |
| skill.effectiveness | 69% (NEW) | First measurement recorded | Above 60% target ✅ |
