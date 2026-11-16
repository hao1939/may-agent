## Reference: How an experienced engineer handled conflicting requirements

A team was asked to build a search system with two hard requirements:
- Results must return in under 10ms (real-time)
- All nodes must see identical results at all times (global consistency)

The engineer recognized that cross-datacenter network latency is 50-100ms minimum, making sub-10ms globally consistent reads physically impossible. Instead of silently breaking one requirement, they:

1. Wrote ANALYSIS.md documenting the fundamental conflict: "Global consistency requires cross-datacenter sync (50-100ms). Real-time requires <10ms response. These cannot coexist."
2. Showed the math: global sync requires ≥50ms, real-time requires ≤10ms — a physical impossibility
3. Proposed 3 alternatives with explicit tradeoffs:
   (a) Eventual consistency + <10ms local reads
   (b) Global consistency + 100ms reads
   (c) Regional partitioning with local <10ms, cross-region eventual consistency
4. Implemented option (c) with explicit tradeoff documentation

**Key pattern**: When requirements contain a mathematical or physical impossibility, ALWAYS analyze feasibility first, document the conflict in ANALYSIS.md, and propose alternatives with explicit tradeoffs before implementing.
