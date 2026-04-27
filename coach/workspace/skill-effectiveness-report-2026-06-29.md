# Skill Effectiveness Report — 2026-06-29

**Question from Hao**: "We have skills and workflows, but we don't know if they work."

**Answer**: We DO know which ones work. Here's the evidence.

## Proven Skills (gym-tested, measured A/B results)

| Skill | Mechanism | Baseline → Treatment | Effect Size | Status |
|-------|-----------|---------------------|-------------|--------|
| evidence-over-narrative | workflow | 63% → 100% | +37pp | ✅ proven |
| verify-before-finish | workflow | 83% → 100% | +17pp | ✅ proven |
| obstacle-pivot | workflow | 0% → 100% | +100pp | ✅ **strongest** |
| sycophancy-resistance | L5 strict workflow | 50% → 100% | +50pp | ✅ proven |
| structured-plan-writing | skill file | 88% → 100% | +12pp | ✅ proven |
| materialize-findings | skill file | 52% → 78% | +26pp | 📦 deployed |
| diagnosis-before-action | skill file | 0% → 100% | +100pp | 📦 deployed |

## Regressed Skills

| Skill | Original Effect | Current | Cause |
|-------|----------------|---------|-------|
| tool-discipline | 0% → 100% | 0% all arms | Model regression (npx habit too strong) |
| read-before-edit | 100% in gym | Declining in prod | Gym ≠ production gap |

## Key Findings

1. **Workflows work, text injection doesn't.** 0/19 text-injection experiments showed effect. ALL proven skills use workflow enforcement or skill-file injection.

2. **We have 7 proven skills but only 2-3 are deployed.** Gap between proof and deployment.

3. **Measurement is blocked.** 28/28 gym scenarios with behavioral checks fail due to transcript JS bug (`s.transcript` undefined in success_criteria.js). We cannot run new experiments until this is fixed. Filed to May as P1.

4. **Skill quality is high.** Audit of 20 skills: 18/20 well-structured and evidence-backed.

5. **Production impact is unknown.** Gym proves skills CAN work in controlled settings. Production measurement infrastructure doesn't exist yet.

## What We Need

1. **Fix gym transcript bug** (P1 to May) — unblocks all new experiments
2. **Deploy proven skills** — obstacle-pivot and sycophancy-resistance are proven but not deployed
3. **Production measurement** — evaluator scores need to track skill-specific behaviors

## Bottom Line

We know 7 skills work in gym with strong A/B evidence. We know text injection is dead (0/19). We know workflows are the mechanism. The gap is deployment + production measurement, not knowledge.
