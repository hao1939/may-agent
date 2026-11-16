## Reference: Checking requirements for hidden conflicts before implementing

Before implementing, an experienced engineer always runs a "feasibility cross-check" on the requirements:

**Example**: A team needed a search system that was both real-time (<10ms) and globally consistent (all nodes see identical data).

The engineer checked each requirement individually:
- <10ms response → achievable with local reads (~1ms), but NOT with cross-datacenter calls (50-100ms)
- Global consistency → requires cross-DC sync, which adds 50-100ms latency

Then the critical cross-check: "Does satisfying A make B harder?"
- Local-only reads (for speed) CONFLICTS with cross-DC sync (for consistency) → **impossible to satisfy both**

**The technique**: For each pair of requirements, ask:
1. What does requirement A physically need? (e.g., "no network waits" for low latency)
2. What does requirement B physically need? (e.g., "must wait for sync" for consistency)
3. Do these needs contradict? If one REQUIRES what the other FORBIDS → conflict

Common conflict patterns in software:
- **Parallelism vs ordering**: More workers = faster throughput, but coordinating order across workers adds overhead that can exceed sequential processing time
- **Consistency vs latency**: Stronger consistency guarantees = more coordination = higher latency
- **Security vs convenience**: More authentication/authorization = more friction for users
- **Throughput vs per-item quality**: Processing items faster often means less validation per item
