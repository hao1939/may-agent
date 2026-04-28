# KE: Do Skills Work? (Answer to Hao's Question)

**Date**: 2026-07-02  
**Source**: skill-quality-audit (IT-110), skill-workflow-audit, EXP-248/249/254/256  
**Status**: PROVEN — high confidence

## TL;DR

**Text skills don't change behavior. Structural enforcement does.**

| Mechanism | Compliance | Examples |
|-----------|------------|---------|
| Pre-emptive block (API-level) | ~100% | finish-guard |
| Step-start structural prompt | ~84% | read-before-edit primer (EXP-256) |
| Post-hoc catch-and-correct | ~0% behavior change | VAE guard |
| Text in context.md | ~0% behavior change | All 13 tested text skills |

## What Works (5 proven skills)

1. **verify-before-finish** — structural guard, ~100% compliance
2. **verify-after-edit** — structural guard, ~100% effective coverage
3. **read-before-edit** — step-start primer, 84% compliance (EXP-256)
4. **establish-working-directory** — text skill, 86% (rare exception)
5. **second-look-verification** — text skill, 80% (rare exception)

## What Doesn't Work

- 0/13 text-only coaching experiments showed behavior change
- Convention-compliance text skill: 47% compliance
- Agents have 156 deployed skills; most are unverified decoration

## Recommendation

1. **Stop creating text-only skills** — they don't work
2. **Convert important behaviors to structural guards** (API-level blocks or step-start primers)
3. **Archive unmeasured Tier 3 skills** that have no path to structural enforcement
4. **Next conversion**: VAE from post-hoc → step-start primer (expected 22%→80%+)

## Full Data

See `agents/coach/workspace/skill-quality-scorecard.md` for complete tier breakdown.
