# KE-343: Defect Category Enumeration Has Zero Effect on Relational Bug Discovery

**Date**: 2026-06-22
**Source**: EXP-202
**Confidence**: High
**Connects**: KE-341, KE-342, H-181, H-187

## Core Finding

Meta-cognitive defect category enumeration has zero effect on relational bug discovery (0/10 on cascading-fix-trap-v2). The gap between naming a bug category ("ordering bugs") and recognizing a specific instance in code is absolute.

## Evidence

- EXP-202: 10 trials with enumeration checklist listing 5 bug categories including "ordering bugs: operations in wrong sequence" → 0/10 pass, 0/10 pipeline-order-fixed
- Baseline (amy, no intervention): 0/5, identical pattern
- All 15 trials: value bug found ✅, ordering bug missed ❌
- 8th consecutive intervention arm scoring 0% on pipeline-order-fixed (across EXP-195/198/199/201/202)

## Mechanism / Why

The discovery bottleneck is NOT hypothesis generation at the category level. The agent receives "consider ordering bugs" and presumably considers it, but cannot bridge from category to instance. The operationalization gap — going from "ordering bugs exist" to "these specific pipeline steps are in wrong order" — requires code-level relational reasoning that the agent lacks.

## Implications

### 1. All single-agent interventions on relational bug discovery are exhausted
8 arms across 5 experiments (procedures, tools, remasking, enumeration) all score 0%. Only direct naming of the specific bug (40%) works. No prompt-level intervention can substitute for the underlying capability.

### 2. Sharp threshold between specific and categorical hints
"The pipeline steps are in the wrong order" → 40%. "Consider ordering bugs" → 0%. The useful information is in the *specific instance*, not the *category*.

### 3. Multi-agent or execution-trace approaches are the remaining frontier
If a single agent can't discover relational bugs even with category guidance, the next approach should externalize the reasoning: one agent traces execution, another interprets the trace.

## Actionable

- Do NOT design more single-agent prompt interventions for relational bug discovery — they are exhausted
- Next experiment should test multi-agent decomposition (trace + interpret)
- H-187 resolved as FALSIFIED

## Open Questions

- Would a chain-of-thought forcing function (not just "consider" but "write out your analysis of each category") work?
- Is the threshold between specific and categorical hints sharp for non-relational bugs too?
