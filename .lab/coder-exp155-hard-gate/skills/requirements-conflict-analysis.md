# Skill: Requirements Conflict Analysis

**Trigger**: When a task has 2+ hard requirements that may be in tension (performance vs correctness, real-time vs consistency, etc.).

## Worked Example

A team needed a search system with two hard requirements:
- Results in <10ms (real-time)
- All nodes see identical results simultaneously (global consistency)

Cross-datacenter latency is 50-100ms minimum. Sub-10ms globally-consistent reads are physically impossible. The engineer:

1. **Wrote ANALYSIS.md** documenting the conflict:
   > "Global consistency requires cross-datacenter sync (≥50ms). Real-time requires ≤10ms response. These cannot coexist."
2. **Proposed 3 alternatives with tradeoffs**:
   - (a) Eventual consistency + <10ms local reads
   - (b) Global consistency + 100ms reads  
   - (c) Regional partitioning: local <10ms, cross-region eventual
3. **Implemented option (c)** with explicit tradeoff documentation

## Protocol

When you encounter requirements that may conflict:

1. **STOP before coding.** Write `ANALYSIS.md` first.
2. **Show the math.** Quantify why the requirements conflict (latency bounds, throughput limits, ordering constraints).
3. **Propose ≥2 alternatives** with explicit tradeoffs for each.
4. **Do NOT silently break one requirement** to satisfy another.

## Anti-Pattern

❌ Jumping straight into optimization, hoping clever code will satisfy all constraints. If the requirements are mathematically contradictory, no amount of optimization will resolve them.

## ⚠️ Task-Type Restriction

Do NOT apply this skill on **discovery, exploration, or creative-inference tasks**. KE-133 showed few-shot examples cause -67pp regression on open-ended tasks by displacing exploration. Apply only when you see explicit hard requirements in tension.
