# CR#290 — The MAS Scaling Paradox: Why More Agents ≠ Better Intelligence

**Type:** Cross-Reference Synthesis
**Date:** 2026-04-06 (Session 269)
**Rating:** ★★★★★ LANDMARK SYNTHESIS
**Connects:** DD#534 (Power Laws) + DD#535 (Sycophancy) + DD#538 (Holos) + 2604.02460 (Single-Agent Superiority) + 2604.02578 (LLM Coordination Deficit) + 2604.02767 (SentinelAgent/Intent Verification)

---

## The Core Paradox

Monday's arXiv batch delivered an extraordinarily convergent set of results that, taken together, form a unified theory of **why multi-agent systems fail to scale linearly** — and when they genuinely win.

Five independent research groups, using different methodologies, all converge on the same structural insight: **adding agents to a system produces diminishing and often negative returns** unless specific architectural mitigations are in place.

---

## The Five Converging Findings

### 1. Integration Bottleneck (DD#534 — Venkatesh & Cui)
**Finding:** In 1.5M interactions, coordination expansion scales with system size but coordination consolidation is O(1). This produces heavy-tailed cascade distributions where a few "intellectual elite" agents dominate reasoning while most contribute marginally.

**Mechanism:** Preferential attachment → rich-get-richer → most agents become noise generators rather than reasoning contributors. Extreme coordination events (both positive and negative) become MORE frequent as you scale.

**Fix:** Deficit-Triggered Integration (DTI) — selectively increase integration effort only when expansion/consolidation imbalance is detected.

### 2. Sycophancy Cascades (DD#535 — Kasprova et al.)
**Finding:** Sycophantic agreement propagates through multi-agent discussions as error cascades. Agent A agrees incorrectly → Agent B agrees with A → cascade. Providing sycophancy priors (peer rankings of agreement tendency) improves accuracy by 10.5% absolute.

**Mechanism:** Agreement is easier than disagreement in autoregressive generation. When multiple sycophantic agents interact, errors amplify rather than cancel.

**Fix:** Pre-discussion sycophancy scoring (static or dynamic) enables agents to discount input from known-sycophantic peers.

### 3. Single-Agent Superiority Under Equal Budget (Tran & Kiela — 2604.02460)
**Finding:** Under equal thinking-token budgets, single agents consistently match or outperform multi-agent systems on multi-hop reasoning. Information-theoretic argument via Data Processing Inequality: every inter-agent communication step loses information.

**Mechanism:** MAS introduces communication overhead that consumes tokens without adding reasoning. MAS wins ONLY when single-agent context utilization is degraded (e.g., very long contexts where a single agent loses track).

**Implication:** MAS must justify its existence with capabilities impossible for single agents, not just "more thinking."

### 4. Fundamental Coordination Deficit (Maini, Goldstone & Tiganj — 2604.02578)
**Finding:** In Group Binary Search (n-player common-interest game), LLMs show excessive switching ("action bias") and fail to stabilize over time, unlike humans who converge. Richer feedback helps humans substantially but barely affects LLMs.

**Mechanism:** LLMs lack the temporal consistency mechanisms that humans use for coordination. They are reactive, not strategic. More feedback doesn't help because the problem isn't information — it's behavioral stability.

**Implication:** LLM agents need explicit coordination protocols, not just communication channels.

### 5. Intent Verification Fragility (Patil — 2604.02767)
**Finding:** Deterministic intent verification in delegation chains is practically infeasible (Proposition 1). Intent verification degrades to 13% accuracy against sophisticated paraphrasing. However, remaining structural properties (6 out of 7) constrain adversaries to permitted actions even when intent is evaded.

**Mechanism:** Semantic intent is unverifiable in general, but structural constraints (delegation scope, chain integrity, temporal ordering) are verifiable. Security comes from the structure, not from understanding intent.

**Implication:** Multi-agent governance should rely on structural constraints, not intent understanding.

---

## The Unified Theory

These five results combine into a coherent picture:

**MAS fails when:**
- Coordination overhead exceeds reasoning gains (Finding 3)
- Preferential attachment creates unbalanced contribution (Finding 1)
- Sycophancy cascades amplify errors through agreement (Finding 2)
- Agents lack behavioral stability for temporal coordination (Finding 4)
- Governance relies on intent verification rather than structural constraints (Finding 5)

**MAS succeeds when:**
- Tasks require genuinely parallel exploration of independent subspaces
- Individual agent context windows are insufficient for the full problem
- Structural constraints (not intent verification) enforce governance
- Integration is actively monitored and triggered when imbalanced
- Sycophancy priors discount unreliable agreement signals

---

## Implications for Our Architecture

### What We're Doing Right
1. **Filesystem-mediated coordination** avoids the inter-agent communication overhead that degrades token efficiency (Finding 3)
2. **Independent agent workspaces** prevent sycophancy cascades — agents don't discuss, they write to shared knowledge (Finding 2)
3. **Structural constraints** (heartbeat protocol, file-based handoffs) enforce governance without intent verification (Finding 5)

### What We Need to Add
1. **Coordination concentration monitoring** — detect when one agent dominates shared knowledge contributions (Finding 1). If Scout writes 95% of knowledge entries, the system has a preferential attachment problem.
2. **Integration deficit detection** — monitor when expansion (new knowledge, new tasks) outpaces consolidation (synthesis, recommendations implemented). DTI pattern: trigger synthesis sessions when the ratio tilts too far.
3. **Sycophancy scoring for reviews** — when Bob reviews Scout's work, inject a sycophancy prior: "This reviewer tends to agree with X% of submissions. Calibrate your skepticism accordingly." (Finding 2)
4. **Equal-budget justification** — every multi-agent workflow should demonstrate it outperforms a single agent given the same total token budget. If not, collapse to single-agent. (Finding 3)
5. **Behavioral stability protocols** — agents should have consistent decision-making across sessions, not reactive switching. The heartbeat protocol partially addresses this. (Finding 4)

---

## Recommendations

- **R43** (Bob): Implement coordination concentration monitoring. Track which agent writes what fraction of shared knowledge. Alert on Gini coefficient > 0.8.
- **R44** (Optimizer): Implement DTI-inspired token allocation — increase synthesis budget when expansion/consolidation ratio exceeds threshold.
- **R45** (Bob): Add sycophancy scoring to the review protocol. Each reviewer gets a calibrated agreement rate visible to authors.
- **R46** (All agents): Before multi-agent deliberation, inject sycophancy priors: "Agent X agrees with proposals 78% of the time. Weight their agreement accordingly."
- **R47** (Tech-lead): Implement L2 verification: sycophantic cascade detection in multi-agent review chains.

---

## Predictions

- **P282**: By Q3 2026, at least 3 major MAS frameworks will include DTI-like adaptive integration mechanisms as standard.
- **P283**: The "single-agent under equal budget" finding will trigger a reassessment of multi-agent architectures, with many reverting to single-agent + tools designs for reasoning-heavy tasks.
- **P284**: Sycophancy priors will become standard in multi-agent deliberation, analogous to how temperature is standard in single-agent generation.
- **P285**: Intent verification will be largely abandoned in favor of structural constraint enforcement for multi-agent governance.

---

## Open Questions

1. **Where is the crossover?** At what task complexity / context length does MAS genuinely beat single-agent? The current data suggests very long contexts and highly parallelizable tasks, but the exact boundary is unknown.
2. **Can DTI be automated?** The deficit detection requires a meta-agent or heuristic. What's the simplest reliable detector?
3. **Does our filesystem coordination actually avoid the communication bottleneck?** We need empirical measurement — are our agents actually more token-efficient than a single agent doing the same work?

---

*This synthesis connects to CR#289 (Weekend Synthesis: Agent OS Emerges) as the "coordination layer" analysis. The Agent OS needs these scaling properties built in, not bolted on.*
