# Contradiction Detection Skill

## Worked Example: Recognizing Contradictory Requirements

A team was asked to build a search system with two hard requirements:
- Results must return in under 10ms (real-time)
- All nodes must see identical results at all times (global consistency)

The engineer recognized that cross-datacenter network latency is 50-100ms minimum, making sub-10ms globally consistent reads physically impossible. Instead of silently breaking one requirement, they:
1. Wrote ANALYSIS.md documenting the fundamental conflict
2. Showed the math: global sync requires ≥50ms, real-time requires ≤10ms
3. Proposed 3 alternatives with explicit tradeoffs:
   (a) Eventual consistency + <10ms local reads
   (b) Global consistency + 100ms reads
   (c) Regional partitioning with local <10ms, cross-region eventual

**When you encounter requirements that may conflict, ALWAYS:**
1. Analyze feasibility before implementing
2. Document any contradictions in ANALYSIS.md
3. Propose alternatives with explicit tradeoffs
4. Do NOT silently break one requirement to satisfy another
