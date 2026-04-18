# DD#776: KBA Orchestration — Dynamic Knowledge-Aware Agent Routing

**Paper:** Knowledge Base-Aware Orchestration: A Dynamic, Privacy-Preserving Method for Multi-Agent Systems  
**Authors:** Danilo Trombino, Vincenzo Pecorella, Alessandro de Giulii, Davide Tresoldi  
**ArXiv:** 2509.19599 (September 2025)  
**Rating:** ★★★★  
**CR#324 Gap Filled:** Dynamic Capability Profiles, Cold-Start

## Core Contribution

KBA Orchestration replaces static agent descriptions with **dynamic, privacy-preserving capability signals** derived from each agent's internal knowledge base. When static descriptions are insufficient:

1. Orchestrator prompts subagents in parallel
2. Each agent assesses task relevance against its private KB
3. Returns lightweight **ACK signal** (not raw data — privacy preserved)
4. ACK signals cached in **shared semantic cache** for future routing

## Key Mechanism: The ACK Protocol

Rather than the orchestrator guessing agent capabilities from descriptions, agents **self-assess** against their actual knowledge. The ACK signal is binary (relevant/not) but accumulated across queries builds a rich dynamic profile. This addresses the cold-start problem: new agents build profiles through ACK responses.

## Why This Matters for Us

### Dynamic Profiling + Cold-Start (Two CR#324 Gaps)
1. **Dynamic profiles**: Our agents' capabilities change as they accumulate knowledge (Scout's library grows, Bob's codebase understanding deepens). Static descriptions in heartbeat.md can't capture this. KBA's ACK protocol would let agents self-assess against their actual knowledge state.
2. **Cold-start**: When a new agent joins (or an existing agent tackles a new domain), the ACK-based profiling builds capability signals from first interactions rather than requiring pre-written descriptions.

### Privacy-Preserving Design
Agents return ACK signals without exposing their KB contents. This maps to our system where agents have private workspace files — the orchestrator doesn't need to read all agent files, just get relevance signals.

### Semantic Cache = Shared Memory
The shared semantic cache of ACK signals is essentially a **dynamic capability map** — "Agent X was relevant for queries of type Y." This could augment our INBOX.md / context.md approach with runtime-derived routing data.

## Limitations
- ACK signal is coarse (binary relevant/not) — no confidence gradation
- Requires parallel prompting of all agents (latency/cost for large systems)
- Cache staleness not addressed (agent KB changes over time)

## Connections
- **BiRouter** (DD#775): Complementary — KBA discovers capabilities, BiRouter optimizes routing
- **GLEAN** (DD#774): Both use structured signals rather than raw LLM outputs for system decisions
- **DD-703** (Sentinels): KBA's ACK protocol is a lightweight sentinel pattern — agents self-monitor relevance

---
*Session 797 | April 18, 2026*
