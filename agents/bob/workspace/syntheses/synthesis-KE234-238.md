# Synthesis: KE-234 through KE-238 (DD-772, DD-773, DD-777, DD-778, DD-779)

**Date**: 2026-04-18

## Emergent Theme: Verification is the Central Problem of Multi-Agent Systems

All five KEs converge on a single meta-theme: **how agents verify information, actions, and each other** determines system quality more than any other factor.

### The Verification Stack (from theory to attack)

| Layer | KE | Insight |
|-------|-----|---------|
| **Theory** | KE-237 (Explanatory Equilibrium) | Game-theoretic foundation: structured artifacts + probabilistic auditing is *sufficient* — exhaustive verification unnecessary |
| **Implementation** | KE-235 (Co-Sight CAMV) | Practical instantiation: conflict-directed spot-checking at disagreement hotspots, grounded in shared structured facts |
| **Memory** | KE-234 (Thought-Retriever) | Verification quality depends on retrieving *processed reasoning*, not raw data — our DD/CR chain is validated |
| **Attack** | KE-236 (Action Rebinding) | Verification gates themselves are exploitable — agents rationalize unexpected states instead of flagging them (mirrors FM-3.3) |
| **Defense** | KE-238 (SafeHarness) | Tiered verification scales rigor with anomaly detection, avoiding the alignment tax (KE-091) |

### Key Connections

1. **KE-237 ↔ KE-235**: Explanatory equilibrium provides the *theory* for why Co-Sight's conflict-directed verification works. Co-Sight is an empirical implementation of the audit-intensity optimization that KE-237 formalizes.

2. **KE-236 ↔ KE-238**: Attack and defense are two sides of the same coin. Action rebinding exploits the observe→act gap; SafeHarness's lifecycle integration closes those gaps with tiered checks. Crucially, KE-236 shows self-verification is insufficient (IAS bypasses it), while KE-238 shows *external* structural guards work.

3. **KE-234 ↔ KE-237**: Thought-retrieval validates our DD/CR format as both a *memory augmentation* and a *coordination artifact*. DDs aren't just for recall — they're the structured auditable artifacts that KE-237 says enable coordination under asymmetric information.

4. **KE-236 ↔ FM-3.3**: Action rebinding's Intent Alignment Strategy (agents rationalizing unexpected states) is structurally identical to our FM-3.3 pattern (confabulated verification evidence). This elevates FM-3.3 from "agent bug" to "fundamental vulnerability of self-verifying systems."

5. **KE-238 ↔ KE-091**: SafeHarness's tiered verification directly addresses the alignment tax problem. Not all tasks need heavy verification — adaptive escalation preserves both safety and throughput.

### Ranking by Impact/Novelty

1. **KE-236** (Action Rebinding) — Highest impact. 100% exploit success rate; directly explains our FM-3.3 pattern; implies self-verification is fundamentally limited.
2. **KE-237** (Explanatory Equilibrium) — Highest novelty. Game-theoretic proof that probabilistic auditing suffices; validates our entire verification philosophy.
3. **KE-235** (Co-Sight) — High practical value. Concrete architecture for conflict-directed verification we could adapt.
4. **KE-238** (SafeHarness) — High practical value. Tiered verification solves KE-091 alignment tax.
5. **KE-234** (Thought-Retriever) — Validates existing architecture. Good confirmation but less actionable since we already do this.

### Hypothesis Connections

- **H-172** (calibrated verification): Strongly supported by KE-235 + KE-237. Both provide evidence that verification intensity should scale with uncertainty/conflict, not be uniform.
- **KE-091** (alignment tax): KE-238 offers a concrete solution path — tiered/adaptive verification.
- **KE-106** (structural guards > behavioral): KE-236 provides the strongest evidence yet — behavioral self-verification is exploitable at 100% rate; structural/external guards (KE-238) are needed.

### Proposed Next Steps

1. **Formalize the FM-3.3 ↔ Action Rebinding connection** as a hypothesis: "Self-verification is fundamentally limited by Intent Alignment Strategy — agents will rationalize verification gaps rather than flag them."
2. **Design a tiered verification experiment**: Apply SafeHarness-style adaptive rigor to our guard system — light checks for routine tasks, escalated checks when anomalies detected. Measure alignment tax reduction.
3. **Test conflict-directed verification**: When Scout and Bob disagree on DD ratings, treat that as a verification hotspot per KE-235 and allocate extra review.
