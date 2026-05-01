# KE-DRAFT: Intervention Effectiveness Hierarchy

**Date**: 2028-07-02
**Author**: bob
**Source**: Synthesis of 20+ gym experiments (EXP-013 through EXP-296)

## Summary

After 20+ controlled experiments, the evidence is overwhelming: **the mechanism of delivery matters more than the content of the intervention**. Here's the hierarchy ranked by empirical effectiveness:

## Effectiveness Hierarchy (best → worst)

### Tier 1: Infrastructure Enforcement (90-100% effect)
- Remove the bad option from the environment entirely
- Example: Remove npx from PATH (EXP-226 showed ALL prompt approaches failed; only infra fix works)
- Example: Circuit breaker stops retry loops regardless of agent reasoning

### Tier 2: Workflow Enforcement / L5 Strict Gates (85-100% effect)
- Force agent through mandatory phases with materialization gates
- Agent MUST produce intermediate artifact before proceeding
- Examples:
  - obstacle-pivot workflow: 0% → 100% (EXP-013, strongest result ever)
  - evidence-over-narrative workflow: 5/8 → 11/11 (EXP-268)
  - sycophancy-resistance L5 strict: 3/6 → 9/9 (EXP-024/025)
  - verify-before-finish workflow: 5/6 → 6/6 (EXP-224)

### Tier 3: Environmental Nudges / L4 (60-80% effect)
- Pre-create files, scaffold structure, provide templates
- Agent discovers the structure and follows it without being told
- Example: materialize-findings-concise nudge: 81% checks (EXP-023) — matched skill injection
- Limitation: Weaker on cadence/timing behaviors

### Tier 4: Skill File Injection (50-80% effect, narrow conditions)
- Works ONLY for procedural tasks with clear steps
- Must be loaded at session start, not discovered passively
- Examples:
  - structured-plan-writing: 7/8 → 8/8 (EXP-019)
  - efficient-file-reading: 6/8 → 8/8 (EXP-018)
- **Critical**: 0/29 agents discover passive skill resources (KE-011)

### Tier 5: Text Injection / Context.md Rules (0-15% effect)
- Declarative rules in prompts ("always do X", "never do Y")
- **0/19+ consecutive text-injection experiments showed meaningful production lift**
- Declaring outcomes has 0% effect; only structuring process helps
- Example: read-before-edit deployed to 4 agents, compliance DECLINED (KE-023)
- Example: classify-then-act text: 0% effect (EXP-017, EXP-032)

## Decision Rules

When designing an intervention:

1. **Can you remove the failure mode from the environment?** → Do that (Tier 1)
2. **Is this a judgment failure?** → Only workflow gates work (Tier 2). Text rules are 0/57 on judgment (KE-002)
3. **Is this a process/procedural failure?** → Workflow or skill injection (Tier 2-4)
4. **Is the behavior discoverable?** → Environmental nudge if yes (Tier 3)
5. **Must you use text?** → Structure it as a forced process with intermediate checkpoints, not as a declarative rule

## Anti-Patterns (proven failures)

| Pattern | Why It Fails | Evidence |
|---------|-------------|----------|
| "Always do X" rules | Declaring outcome ≠ changing behavior | 0/19 experiments |
| Stacking 2+ interventions | Combined degrades by 12-15pp | KE-123 |
| Few-shot for discovery tasks | Template-following displaces exploration | -67pp regression, KE-133 |
| Passive skill resources | Nobody reads them | 0/29 adoption, KE-011 |
| Gym success → production success | Controlled ≠ realistic context | read-before-edit: 11/11 gym, declining production |

## Implications for New Experiments

1. **Default to workflow enforcement** for any behavioral change
2. **Measure in production**, not just gym (gym results overestimate by ~30pp)
3. **Build measurement before deployment** (lesson from EXP-297)
4. **Test one thing at a time** — stacking is proven harmful

## Relationship to KE-402

KE-402 provides the decision tree organized by failure type (activation gap vs reasoning chain gap vs conceptual gap). This document complements it by:
1. Ranking intervention **mechanisms** by empirical effect size with specific experiment citations
2. Highlighting the **gym-production gap** (30pp overestimate)
3. Providing explicit anti-patterns with evidence

Consider merging key findings (gym-production gap, stacking penalty) into KE-402.

## Status

DRAFT — companion to KE-402. Merge gym-production gap and anti-patterns into KE-402 if validated.
