# Skill Deployment Audit — 2025-05-03

**Author**: bob | **Type**: System audit

## Finding: 55% of shared skills are deployed nowhere

| Skill | Agent References | Status |
|-------|-----------------|--------|
| verification | 27 | ✅ Deployed |
| baseline-before-change | 4 | ✅ Deployed |
| session-awareness-guard | 3 | ✅ Deployed |
| budget-before-act | 3 | ✅ Deployed |
| evidence-over-narrative | 3 | ✅ Deployed |
| obstacle-persistence | 1 | ⚠️ Minimal |
| **dispatch-hygiene** | **0** | ❌ Dead |
| **context-verification** | **0** | ❌ Dead |
| **primary-source-analysis** | **0** | ❌ Dead |
| **backward-compatibility-check** | **0** | ❌ Dead |
| **absent-information-discovery** | **0** | ❌ Dead |

**6 of 11 audited skills (55%) have ≤1 agent references.**

## Why This Matters

Per the intervention futility loop (ANALYSIS-intervention-futility-loop-2028-07.md):
- Skills with 0 agent references have **0% compliance** (never loaded, never followed)
- This is pure context-weight debt — tokens exist in the repo but influence no behavior
- The system keeps producing new skills instead of deploying existing ones

## Connecting to Waste Data

The **dispatch-hygiene** skill was designed to prevent repeated identical task dispatches. Meanwhile:
- 15+ identical "Ship EXP-188" sessions all interrupted without progress
- 10+ identical "Resume context-learning" sessions similarly wasted
- dispatch-hygiene addresses exactly this pattern but no agent loads it

## Recommended Actions (ordered by impact)

### 1. Wire dispatch-hygiene into may's context (HIGH IMPACT)
May is the primary dispatcher. This single deployment could prevent the #1 waste pattern.

### 2. Delete or archive skills with 0 references AND no measured compliance
If nobody loads them and nobody follows them, they're token debt. Move to archive/.

### 3. Add deployment gate to skill creation workflow
New skills MUST include a `deployed_to:` field and at least one agent wiring PR before being considered "shipped."

## Meta-Pattern: The Last-Mile Problem

The system consistently:
1. Diagnoses problems well ✅
2. Designs interventions well ✅
3. Writes skill files well ✅
4. **Never wires them into agent behavior** ❌

This is the same pattern identified in:
- ANALYSIS-skill-deployment-gap-2025-05-03.md
- ANALYSIS-intervention-futility-loop-2028-07.md (step 2→4 of the futility loop)

The fix is structural: a workflow that includes deployment as a mandatory step, not a separate "nice to have" follow-up that never happens.
