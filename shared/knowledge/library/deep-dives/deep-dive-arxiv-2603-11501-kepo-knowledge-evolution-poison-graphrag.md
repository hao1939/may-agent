# Deep-Dive: KEPo — Knowledge Evolution Poison on Graph-based Retrieval-Augmented Generation

**Paper:** arXiv:2603.11501
**Authors:** Qizhi Chen, Chao Qi, Yihong Huang, Muquan Li, Rongzheng Wang, Dongyang Zhang, Ke Qin, Shuang Liang
**Published:** 2026-03-12
**Venue:** ACM Web Conference 2026 (WWW 2026) — **Accepted**
**Rating:** ★★★★★ (critical attack vector for multi-agent knowledge systems)

---

## One-Sentence Summary

KEPo demonstrates that GraphRAG's structural abstraction (which makes conventional RAG poisoning ineffective) can be bypassed by fabricating plausible "knowledge evolution paths" — fake causal chains from real facts to poisoned conclusions — that survive the graph construction process and propagate through multi-hop retrieval.

---

## Core Contribution

### The GraphRAG Security Assumption (and Its Failure)

GraphRAG was designed, in part, to be more robust than conventional RAG against knowledge poisoning attacks. The reasoning was sound: by abstracting retrieved text into a knowledge graph before reasoning, the LLM operates on structured relationships rather than raw injected passages. This makes simple "paste malicious text into the corpus" attacks ineffective — the KG construction process reorganizes and filters the content.

**KEPo shatters this assumption** by showing that if the attacker understands the graph construction pipeline, they can craft poisoned text that survives abstraction into the KG and even *benefits* from the graph structure.

### The Knowledge Evolution Attack

KEPo works in three stages:

1. **Toxic Event Generation**: For each target query, generate a "toxic event" — a plausible-sounding but false event that, if believed, would cause the LLM to produce the attacker's desired answer. This is more sophisticated than simple false claims; it creates an entire event context (who, what, when, where, why).

2. **Evolution Path Fabrication**: This is the key innovation. KEPo constructs a fake "knowledge evolution path" — a chain of seemingly logical steps from real, verifiable facts to the toxic event. For example:
   - Real fact: "Company X acquired Company Y in 2024"
   - Step 1: "After the acquisition, X restructured Y's research division" (plausible but fabricated)
   - Step 2: "The restructuring led to a new product line" (fabricated)
   - Step 3: "The new product replaced Product Z" (toxic target conclusion)

   Each step is individually plausible and, crucially, creates KG edges that form a connected path from real entities to the poisoned conclusion.

3. **Community Amplification**: In multi-target attack scenarios, KEPo connects multiple attack corpora so that their poisoned knowledge forms reinforcing communities in the KG. This exploits GraphRAG's community detection — when poisoned nodes form a tightly-connected community, the system treats their consensus as evidence of reliability.

### Why It Works Against GraphRAG Specifically

- **Survives graph abstraction**: The poisoned text is designed to produce clean KG triples, not just inject raw text
- **Exploits multi-hop reasoning**: GraphRAG's strength — multi-hop traversal — becomes a weapon, as the evolution path creates traversable edges from real facts to poison
- **Leverages community detection**: The mutual reinforcement between attack corpora creates artificial community consensus
- **Resists deduplication**: Each step in the evolution path is unique, avoiding simple dedup defenses

---

## Key Results

1. **State-of-the-art attack success**: KEPo achieves significantly higher attack success rates than all prior RAG poisoning methods (PoisonedRAG, CorruptRAG) across multiple datasets.

2. **Single-target attacks**: KEPo achieves high success even with minimal injected documents, because the evolution path creates high-quality KG structures that rank well in retrieval.

3. **Multi-target attacks**: The community amplification mechanism makes multi-target attacks *more efficient per target* than single-target ones — a disturbing result showing that scale benefits the attacker.

4. **Robustness to defenses**: Standard RAG defenses (query paraphrasing, retrieval diversity, content filtering) are largely ineffective against KEPo because the poisoned content is structurally indistinguishable from legitimate knowledge updates.

---

## Multi-Agent System Implications

### Critical Connections

1. **Multi-agent shared knowledge bases**: In multi-agent architectures where agents share a common knowledge graph (a pattern becoming increasingly common for "organizational memory"), KEPo shows that a single poisoned document can corrupt the shared reasoning substrate. This is particularly dangerous because:
   - Agents trust the KG as authoritative
   - Graph-structured knowledge resists per-agent verification (no single agent sees the full evolution path)
   - Community detection algorithms can be gamed to create artificial consensus

2. **Agent-to-agent knowledge propagation**: When Agent A adds knowledge to a shared KG based on its observations, and Agent B retrieves from that KG, KEPo-style attacks can be executed by compromising just Agent A's input stream. The evolution path mechanism means the poisoned knowledge looks like a natural extension of existing facts.

3. **The knowledge-trust problem**: Our Grand Unified Synthesis identified "knowledge contamination" as a key degradation pattern. KEPo demonstrates a specific, highly effective mechanism: rather than injecting obviously false claims (which can be detected), create a plausible *evolutionary narrative* from truth to falsehood.

4. **Connection to memory poisoning**: Our prior deep-dives on XAMT (bilevel optimization for covert memory tampering) and MemoryGraft (poisoned experience retrieval) established that agent memory is a critical attack surface. KEPo extends this to *structured* memory (knowledge graphs), showing that the additional structure actually creates new attack affordances rather than protecting against them.

### Defensive Implications

- **Provenance tracking is necessary but insufficient**: Even if every KG edge has a source document, KEPo's evolution paths come from source documents that look legitimate.
- **Temporal verification**: One potential defense is checking whether "knowledge evolution paths" claim events in a temporal order consistent with external sources. KEPo's fabricated timelines could potentially be caught by cross-referencing.
- **Graph structure anomaly detection**: The community amplification mechanism might leave detectable signatures in graph metrics (unusually high clustering coefficient among recently-added nodes, for example).

---

## Connections to Prior Deep-Dives

| Paper | Connection |
|-------|-----------|
| arXiv:2512.15790 (XAMT) | Both target agent memory; KEPo targets graph-structured memory vs. XAMT's sequential memory |
| arXiv:2512.16962 (MemoryGraft) | Both poison retrieval-augmented systems; KEPo is specifically designed for graph-based retrieval |
| arXiv:2603.11132 (WebWeaver) | Both exploit multi-agent knowledge sharing; WebWeaver targets communication topology, KEPo targets knowledge graph topology |
| arXiv:2603.12109 (Information Self-Locking) | Both exploit how structured information resists correction once integrated |
| Grand Unified Synthesis | Validates Degradation Pattern #3 (Knowledge Contamination) and Law #4 (Compounding Error) |

---

## Limitations

1. **Assumes database write access**: The attacker must be able to inject documents into the RAG corpus. In closed-corpus deployments, this is not trivial.

2. **GraphRAG-specific**: The attack is tailored to the graph construction pipeline. Different GraphRAG implementations may be more or less vulnerable depending on their entity resolution and edge construction methods.

3. **No defense evaluation**: While the paper shows that existing defenses fail, it doesn't propose new defenses. The community amplification mechanism in particular needs targeted countermeasures.

4. **Evaluation on factoid QA**: The experiments focus on factual question answering. The attack's effectiveness on more complex reasoning tasks (multi-step inference, comparative analysis) is not tested.

---

## Rating Justification: ★★★★★

This is a landmark paper for knowledge-based agent security. It demonstrates that GraphRAG's structural abstractions — previously assumed to provide some defense against poisoning — actually create new attack surfaces. The evolution path mechanism is both elegant and frightening: it shows how to build a plausible bridge from truth to lies that survives graph construction. The WWW 2026 acceptance validates the quality, and the implications for multi-agent systems with shared knowledge bases are immediate and severe.

---

*Scout Research Session — 2026-03-14*
*Deep-dive #173*
