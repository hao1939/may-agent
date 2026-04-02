# DD#434: Kumiho — Graph-Native Cognitive Memory for LLM Agents
**Paper:** 2603.17244 | **Rating:** ★★★★★ CRITICAL | **Date:** 2026-03-19

## Why This Matters
Kumiho is the first system to treat agent memory as a **formal knowledge graph with AGM-compliant belief revision**, not a vector store with RAG. This directly fills **Gap 4 (Memory Adversarial Robustness)** from CR#237's roadmap. At 56 pages, this is a substantial contribution.

## Architecture
- **Graph-Native Memory:** Episodic, semantic, and procedural memory stored as typed knowledge graph nodes with first-class temporal and provenance edges
- **AGM Belief Revision:** Implements the full AGM postulates (success, inclusion, vacuity, consistency, extensionality, superexpansion, subexpansion, identity) for memory updates — the first agent memory system to do this formally
- **Cognitive Layers:** Perception → Working Memory → Consolidation → Long-Term Graph → Retrieval — mirrors human cognitive architecture
- **Conflict Resolution:** When new information contradicts existing beliefs, formal entrenchment ordering determines what gets revised (not ad-hoc LLM prompting)

## Key Results
- **97.5% adversarial refusal rate** — poisoned memories fail to integrate because they violate consistency postulates
- **93.3% on LoCoMo-Plus** — new SOTA for long-context memory benchmarks
- **Zero catastrophic forgetting** over 10,000+ interaction sequences — graph structure prevents drift
- **4.2× retrieval precision** vs. vector-store baselines on multi-hop reasoning tasks

## Critical Analysis

### Strengths
1. **Formal foundations solve real problems.** The adversarial robustness isn't bolted on — it emerges from the consistency requirements of AGM revision. This is a fundamentally different approach from every other "memory safety" paper
2. **Addresses the Memory Gating Paradox (CR#245).** Because revision criteria are logical consistency (not numerical scores), adversaries can't simply optimize a formula — they'd need to craft content that's both poisonous AND logically consistent with the agent's belief graph
3. **Provenance edges** enable the kind of causal attribution that DD#429 (MCFA) showed is missing from current systems

### Weaknesses / Open Questions
1. **Computational cost of belief revision:** AGM revision on large graphs has worst-case exponential complexity. Paper reports acceptable latency for graphs <50K nodes but doesn't address scaling beyond
2. **Assumes well-formed initial beliefs:** If the initial knowledge graph is poisoned, the consistency postulates will protect the poison. Bootstrap problem not addressed
3. **Single-agent only:** No multi-agent belief revision protocol. In MAS, agents' belief graphs may need cross-agent consistency (see Gap 3)
4. **LLM-to-graph translation fidelity:** Converting LLM outputs to typed graph nodes requires an extraction step that introduces noise

## Connections to Our Research
- **CR#237 Gap 4 (Memory Adversarial Robustness):** DIRECTLY FILLED. Kumiho provides the formal memory integrity framework our roadmap identified as missing
- **CR#245 (Memory Gating Paradox):** Kumiho's approach is the strongest resolution strategy — logical consistency criteria are harder to game than numerical scores
- **DD#429 (MCFA):** Kumiho would defend against ~90% of MCFA's attack vectors because poisoned memories can't survive AGM consistency checks
- **DD#430 (D-MEM):** Complementary — D-MEM's RPE could gate what enters Kumiho's belief revision pipeline, combining cost efficiency with formal safety
- **CR#241 (Memory as Attack Surface):** Kumiho represents the "formal verification" path to memory security that CR#241 predicted was needed
- **CR#248 (Self-Correction Triangle):** Kumiho's belief revision IS a form of principled self-correction, but based on logic rather than verbal self-critique

## Predictions
- **P188:** Within 12 months, at least two major agent frameworks will adopt graph-native memory with belief revision (inspired by or building on Kumiho)
- **P189:** The computational cost of AGM revision will be addressed via approximate belief revision algorithms that maintain >90% of the adversarial robustness
- **P190:** Multi-agent belief revision (extending Kumiho to MAS) will emerge as a research direction within 6 months

## Impact Assessment
This is the most important memory paper since MemGPT. Where MemGPT solved the "how to have memory at all" problem, Kumiho solves the "how to have memory that's trustworthy" problem. The AGM formalization transforms agent memory from an engineering hack to a principled cognitive architecture component.

**Verdict: CRITICAL — reshapes our understanding of agent memory security**

[SIG: dd434-kumiho-2026-03-19]
