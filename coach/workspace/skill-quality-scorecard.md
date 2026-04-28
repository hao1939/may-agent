# Skill Quality Scorecard — 2027-10-10

## Executive Summary

**Answer to Hao's question ("do skills work?"):** Partially. Structurally-enforced skills achieve 84-100% compliance. Text-only skills achieve 22-57%. Investment should go to structural enforcement, not more text skills.

**Key evidence chain:**
- EXP-248: Measured activation rates across all agents (observational)
- EXP-254: Post-hoc guards produce 0% behavioral change (catch-and-correct only)
- EXP-256: Step-start priming achieves 84.2% RBE compliance (vs 50% baseline) ✅

## Tier 1: PROVEN (gym + production evidence)

| Skill | Mechanism | Compliance | Evidence |
|-------|-----------|------------|----------|
| verify-before-finish | Structural (finish-guard blocks) | ~100% | EXP-248: 90%→100% after guard |
| verify-after-edit | Structural (post-hoc guard) | ~100% effective* | EXP-164: 10/10, EXP-254: 568 recovery steps |
| read-before-edit | Structural (step-start primer) | 84.2% | EXP-256: 50%→84.2%, KE-411 |
| establish-working-directory | Text skill | 86% | EXP-amy-path: 0.69→0.86 quality |
| second-look-verification | Text skill | 80% | EXP-044: 8/10 |

*VAE: agents still skip it (13.6% self-compliance) but guard injects recovery reads, so effective coverage is near 100%.

## Tier 2: MEASURED but weak

| Skill | Mechanism | Compliance | Evidence |
|-------|-----------|------------|----------|
| convention-compliance | Text skill | 47% | WAVE2-VALIDATION: 7/15 |
| evidence-over-narrative | Text skill | Unknown | Deployed to 5 agents, no measurement |

## Tier 3: DEPLOYED, NEVER MEASURED

| Skill | Agent(s) | Risk |
|-------|----------|------|
| closing-the-loop | ~~ALL~~ REMOVED 2026-07-01 | MEDIUM — EXP-253 showed no degradation on removal |
| reading-metrics | ALL | LOW |
| escalation | ALL | LOW |
| diagnosis-before-action | coder | HIGH |
| search-governance | scout | MEDIUM |
| materialize-findings-concise | scout | MEDIUM |
| security-awareness-when-editing | tech-lead | LOW |
| post-delivery-readback-verification | tech-lead | HIGH |
| knowledge-base-navigation | bob | MEDIUM |
| obstacle-pivot | bob, amy, coder, tech-lead | MEDIUM |

## Tier 4: REJECTED/ARCHIVED

| Skill | Reason |
|-------|--------|
| Data Flow Audit (discovery) | EXP-195/198: 0% effectiveness |
| Text coaching (all forms) | 0/13 experiments showed behavior change |

## Intervention Hierarchy (proven)

| Tier | Mechanism | Compliance | Examples |
|------|-----------|------------|----------|
| 1 | Pre-emptive block (API-level) | ~100% | finish-guard |
| 2 | Step-start structural prompt | ~84% | rbe-primer (EXP-256) |
| 3 | Post-hoc catch-and-correct | ~0% behavior change | read-before-edit guard, VAE guard |
| 4 | Text in context.md | ~0% behavior change | All text-only skills |

## Next Actions
1. Convert VAE guard from post-hoc (Tier 3) to step-start primer (Tier 2) — expected 22%→80%+
2. Measure Tier 3 unmeasured skills via production session sampling
3. Archive skills that have no structural enforcement path
