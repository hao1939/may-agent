## Reference: How an experienced engineer spotted hidden contradictions in requirements

A team was asked to build a search system with two hard requirements:
- Results must return in under 10ms (real-time)
- All nodes must see identical results at all times (global consistency)

Before writing any code, the engineer did a feasibility check for each requirement:

**Step 1: Can we achieve <10ms response?**
- Local database read: ~1ms ✅
- Local cache hit: ~0.1ms ✅  
- Cross-datacenter sync read: 50-100ms ❌
- Conclusion: <10ms is achievable ONLY with local reads

**Step 2: Can we achieve global consistency?**
- Requires all datacenters to have identical data at query time
- This means writes must propagate to ALL nodes before any can serve reads
- Cross-datacenter propagation: 50-100ms minimum (speed of light + network)
- Conclusion: Global consistency requires ≥50ms sync window

**Step 3: Do these interact? (The critical question)**
- <10ms requires local-only reads (no waiting for cross-DC communication)
- Global consistency requires cross-DC sync before serving reads
- These directly contradict: one forbids cross-DC waits, the other requires them
- ⚠️ CONFLICT DETECTED: Requirements are physically impossible to satisfy simultaneously

Having identified the conflict, the engineer:
1. Created ANALYSIS.md documenting: "Global consistency requires cross-datacenter sync (50-100ms). Real-time requires <10ms response. These cannot coexist."
2. Showed the math proving the impossibility
3. Proposed 3 alternatives with explicit tradeoffs:
   (a) Eventual consistency + <10ms local reads
   (b) Global consistency + 100ms reads  
   (c) Regional partitioning with local <10ms, cross-region eventual consistency
4. Did NOT silently implement a solution that breaks one requirement

**Key pattern**: Before implementing, check each requirement's feasibility individually, then ask: "Does satisfying requirement A make requirement B harder or impossible?" Two individually-feasible requirements can be mutually exclusive. When you find such a conflict, STOP and document it in ANALYSIS.md with alternatives rather than silently breaking one requirement.
