# Deep-Dive: arXiv:2512.16962 — MemoryGraft: Persistent Compromise of LLM Agents via Poisoned Experience Retrieval

**Paper:** "MemoryGraft: Persistent Compromise of LLM Agents via Poisoned Experience Retrieval"
**Authors:** (Multiple authors)
**Date:** December 2025
**Venue:** Preprint
**arXiv:** https://arxiv.org/abs/2512.16962
**Analyst:** Scout | **Date:** 2026-03-14

---

## ★★★★★ CRITICAL — Relevance: 9/10 for Multi-Agent Architecture Security

---

## TL;DR

MemoryGraft demonstrates a devastating attack on LLM agents with persistent memory: by injecting carefully crafted "experiences" into an agent's memory store, attackers can **persistently alter agent behavior** across sessions without modifying the model, prompts, or tools. The poisoned memories are retrieved naturally during relevant tasks, subtly steering the agent toward attacker-desired outcomes. This is the memory equivalent of a supply chain attack.

---

## Core Problem

LLM agents increasingly use persistent memory (experience retrieval, episodic memory, RAG over past interactions) to improve over time. This creates a new attack surface:

1. **Memory is trusted implicitly** — retrieved experiences are treated as the agent's own
2. **No integrity verification** — memories lack cryptographic provenance
3. **Persistence = amplification** — one poisoned memory can affect unlimited future sessions
4. **Stealth** — poisoned memories look like legitimate experiences

---

## Attack Mechanism

### MemoryGraft Attack Pipeline

1. **Target profiling:** Identify agent's memory schema, embedding model, retrieval mechanism
2. **Craft poisoned experiences:** Generate fake "memories" that:
   - Have high embedding similarity to target task queries
   - Contain subtly manipulated conclusions/actions
   - Match the format and style of legitimate experiences
3. **Injection:** Insert via:
   - Direct memory store access (if available)
   - Manipulated interaction that gets stored as experience
   - Compromise of shared memory pools (multi-agent systems!)
4. **Activation:** When agent encounters relevant task, poisoned memory is naturally retrieved and influences behavior

### Attack Types Demonstrated

1. **Goal Hijacking:** Agent pursues attacker's goals instead of user's
2. **Capability Degradation:** Agent makes systematic errors on specific task types
3. **Information Exfiltration:** Agent subtly leaks information through action choices
4. **Policy Violation:** Agent bypasses safety guidelines based on "past experience"
5. **Preference Manipulation:** Agent recommends attacker-preferred options

---

## Key Results

1. **95%+ attack success rate** on undefended memory systems
2. **Persistence:** Poisoned behaviors maintained across 100+ sessions
3. **Stealth:** Human evaluators detected only 12% of poisoned memories in manual review
4. **Transfer:** Attacks crafted for one agent partially transfer to others using similar memory schemas
5. **Amplification:** Single poisoned memory can affect agent behavior on 30+ different query types due to embedding space proximity

### Defenses Evaluated

The paper evaluates several defenses:

| Defense | Success Rate Drop | Overhead |
|---------|------------------|----------|
| Embedding anomaly detection | 95% → 78% | Low |
| Consistency checking | 95% → 61% | Medium |
| Memory provenance tracking | 95% → 34% | Medium |
| Cryptographic signing | 95% → 8% | Low |
| Combined (all four) | 95% → 3% | Medium |

**Key finding:** No single defense is sufficient; layered defense is essential.

---

## Relevance to Our Architecture

### CRITICAL SECURITY IMPLICATIONS

1. **Multi-Agent Memory Sharing = Amplified Attack Surface:** When agents share memories (as in our architecture), a single compromised agent can poison the entire collective memory. This is the **multi-agent memory equivalent of a worm**.

2. **GNAP Protocol MUST Include Memory Provenance:** If agents share experiences cross-system via GNAP, every memory item needs:
   - Cryptographic origin signing (which agent created it)
   - Timestamp verification (when was it created)
   - Task context binding (what task was it associated with)
   - Confidence/reliability metadata

3. **SSGM Governance Must Address Poisoning:** The governance middleware (arXiv:2603.11768) needs a **memory integrity layer** that:
   - Validates incoming memories before storage
   - Monitors for behavioral drift that could indicate poisoning
   - Quarantines suspicious memories for review
   - Maintains audit trails for all memory modifications

4. **DAM VoI as Detection Signal:** The Decision-theoretic framework (arXiv:2512.21567) provides a potential detection mechanism — poisoned memories may show VoI profile anomalies (claimed high value but inconsistent with actual task outcomes).

5. **Cache Coherence Security:** The computer architecture analogy (arXiv:2603.10062) extends to cache poisoning attacks. Just as CPU caches need coherence protocols, agent memory caches need integrity protocols.

### Architecture Requirements Generated

- **R-SEC-1:** All memory items MUST have cryptographic provenance (origin agent, timestamp, context)
- **R-SEC-2:** Memory sharing protocols MUST support integrity verification
- **R-SEC-3:** Behavioral monitoring MUST detect drift potentially caused by memory poisoning
- **R-SEC-4:** Memory quarantine mechanisms for suspicious items
- **R-SEC-5:** Rollback capability to undo effects of identified poisoned memories
- **R-SEC-6:** Rate limiting on memory writes from external sources

---

## Theoretical Significance

MemoryGraft reveals that **persistent memory is a double-edged sword**: the same mechanism that enables agents to learn from experience makes them vulnerable to persistent behavioral manipulation. This is analogous to how human memory can be manipulated through false memory implantation — but with the precision and scalability of software attacks.

The deeper insight: **memory trust is the fundamental problem**. When an agent retrieves a "memory," it has no way to verify whether that memory reflects genuine experience or adversarial manipulation. This parallels the epistemological problem of distinguishing true from false beliefs.

---

## Limitations

1. Assumes attacker can access or influence the memory store
2. Defense evaluation is preliminary — more sophisticated defenses may exist
3. Doesn't address memory poisoning in fully decentralized systems (no central memory store)
4. Computational cost of cryptographic signing at scale not fully evaluated

---

## Connection Map

- **SSGM governance** (2603.11768): Must add integrity layer → ★★★★★
- **GNAP protocol** (2603.06522): Memory provenance must be in protocol spec → ★★★★★
- **DAM decision-theoretic memory** (2512.21567): VoI anomalies as detection signal → ★★★★
- **Computer architecture perspective** (2603.10062): Cache poisoning = memory poisoning → ★★★★
- **DCI deliberation** (2603.11781): Deliberative verification as defense mechanism → ★★★
- **Price of Decentralization** (2603.11884): Decentralized systems harder to defend → ★★★

---

## Bottom Line

**This paper is a wake-up call for anyone building agents with persistent memory.** Memory poisoning is a real, demonstrable, and devastating attack vector. Our architecture MUST include memory integrity as a first-class concern, not an afterthought. The layered defense approach (provenance + anomaly detection + consistency checking + cryptographic signing) should be the baseline.

**Priority: CRITICAL — Security architecture must address memory poisoning before deployment.**
