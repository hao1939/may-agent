# KE-402: Intervention Decision Tree — What Works and What Doesn't

**Date**: 2026-04-27
**Author**: Bob (Architect)
**Status**: Active
**Confidence**: High (synthesized from 20+ experiments, 400+ trials)
**Tags**: meta-finding, intervention-design, decision-framework
**Connects**: KE-002, KE-101, KE-123, KE-397, KE-399, KE-400, KE-401

## Core Finding

After 20+ experiments testing agent behavioral interventions, a clear decision tree emerges for choosing the right intervention type. Using the wrong intervention type wastes ~$5-15 per experiment with guaranteed null results.

## The Decision Tree

```
1. CLASSIFY the failure type (KE-401):
   ├── Activation gap (agent CAN do it, doesn't think to)
   │   → Checklist/reminder works (EXP-229: 0%→100% on silent-data-corruption)
   │   → Skill trigger conditions work IF agent reads them (KE-398)
   │
   ├── Reasoning chain gap (needs multi-step trace)
   │   → Structured workflow works (H-EXP-012: 58-93%)
   │   → Text instructions: 0% (KE-397, KE-002)
   │   → Skills: 0% (KE-399, EXP-224-228)
   │
   └── Conceptual gap (agent lacks domain model)
       → Agent identity/role switch works (KE-395: 0%→80%)
       → Domain knowledge injection: untested
       → Text/skills/coaching: 0% (KE-399, KE-400)

2. CHECK the intervention channel:
   ├── Structural (workflow, tool, runtime): WORKS (88-100%, KE-101)
   ├── Role context (agent identity): WORKS for conceptual gaps (KE-395)
   ├── Checklist/reminder: WORKS only for activation gaps (KE-401)
   ├── Skill files: 0% unless role context supports behavior (KE-399)
   ├── Text coaching/notifications: 0% (KE-400, N=9+ rounds)
   └── SOUL.md text changes: 0% (KE-002, 0/57 across all agents)

3. AVOID these traps:
   - Never stack 2+ interventions (KE-123: -12-15pp degradation)
   - Never use few-shot examples for discovery tasks (KE-133: -67pp)
   - Forced verification guards harm complex/creative tasks (KE-091)
   - Text constraints arrive too late in reasoning pipeline (KE-397)
```

## Quick Reference Table

| Failure Type | Best Intervention | Cost | Expected Effect |
|-------------|-------------------|------|----------------|
| Activation gap | Checklist + trigger skill | ~$3 | +30-100pp |
| Reasoning chain | Workflow restructure | ~$8 | +58-93pp |
| Conceptual gap | Role/identity switch | ~$3 | +80pp |
| Any type | Text/skill/coaching | ~$10 | 0pp (waste) |

## Anti-Pattern: The Coaching Loop

KE-400 proves that repeated coaching notifications don't improve compliance. The impulse to "try harder with more text" is the #1 source of wasted experiment budget. If one text intervention fails, a different text intervention will also fail. Switch channels entirely.

## Implication

Before designing any new intervention experiment:
1. Classify the failure (activation / reasoning / conceptual)
2. Pick the matching channel from the table
3. If the answer is "text/skill", STOP — redesign or defer

This decision tree should prevent 60-80% of future null-result experiments (~$50-80 savings per quarter).
