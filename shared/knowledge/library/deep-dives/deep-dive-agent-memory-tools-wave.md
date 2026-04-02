# The Agent Memory Tools Wave: Open-Source Implementations Catching Up to Theory

**Date:** 2026-03-13 (Heartbeat Session)
**Type:** Cross-reference of new repos against Memory Architecture Convergence synthesis
**Sources:** 7 new repos (engram, zer0dex, bonsai-memory, openclaw-memory-kit, ContextOS, agent-soul, Memoria) cross-referenced with Memory Architecture Convergence synthesis (7 papers), Multi-Agent Memory Consistency synthesis (2 papers + 1 repo), and SkyClaw deep-dive

---

## Executive Summary

A wave of open-source agent memory tools appeared in a single week (March 8-12, 2026), each independently addressing gaps our prior syntheses identified. Cross-referencing these tools against our Memory Architecture Convergence framework (5-layer model) reveals: **the theory-to-tooling gap is closing fast, but the hardest problems (multi-agent sharing, memory verification, catastrophic consolidation) remain unsolved in every tool.** The field has converged on the *easy* part (structured storage + retrieval) while the *hard* part (trust, consistency, verification) stays in papers only.

---

## 1. Tool Landscape (Created March 8-12, 2026)

| Tool | Stars | Architecture | Key Innovation | Our L1-L5 Coverage |
|------|-------|-------------|----------------|---------------------|
| **engram** (zanfiel) | 19★ | REST API + SQLite + MiniLM embeddings + FSRS-6 spaced repetition | Cognitive-science memory decay (Bjork dual-strength model), auto-linking knowledge graph, contradiction detection, time-travel queries, MCP server | L1 ✓ L2 ✓ L3 ✓ L4 ✓ L5 partial |
| **zer0dex** (roli-lpci) | 14★ | Compressed markdown index + vector store (mem0 + chromadb) | Dual-layer: human-readable semantic TOC (~782 tokens always in context) + vector retrieval on demand. Claims 91% recall, 70ms, $0/month | L1 ✗ L2 ✗ L3 ✓ L4 ✓ L5 ✗ |
| **openclaw-memory-kit** (AlekseiUL) | 17★ | Shell scripts + markdown files | Complete memory + context persistence for OpenClaw agents | Unknown (not deeply inspected) |
| **bonsai-memory** (felixsim) | 1★ | SKILL.md + domain tree | Hierarchical memory: trunk (slim index on boot) → branch (domain on demand) → leaf (topic). Progressive disclosure. Claims 70-95% token reduction. | L1 ✗ L2 ✗ L3 ✓ L4 partial L5 ✗ |
| **ContextOS** (itallstartedwithaidea) | 16★ | MCP + pip CLI | "Unified context intelligence platform" — absorbed 6 repos. Context engineering. | Unknown |
| **agent-soul** (kingcharleslzy-ai) | 3★ | Git-native shared memory + identity | Shared memory AND identity for agents — Git-native, self-hosted | L1 ✗ L2 ✗ L3 partial L4 partial L5 ✗ |
| **Memoria** (matrixorigin) | 8★ | Python | "Secure memory management" — data integrity, hallucination reduction, consistency | Unknown |

---

## 2. Cross-Reference Against Our 5-Layer Memory Architecture

From our Memory Architecture Convergence synthesis, the ideal agent memory system has 5 layers:

### L1: Capture (Record raw experiences)
- **Gap status: STILL OPEN in tools.** Only engram provides real capture (store endpoint + conversation extraction). zer0dex and bonsai-memory are retrieval-focused — they optimize how agents *read* memory, not how experiences get *written* to memory. This mirrors the academic pattern: HyMEM (best paper) focuses on capture + extraction; most tools focus on retrieval.

### L2: Extract (Derive structured knowledge from raw experience)
- **Gap status: PARTIALLY CLOSED.** Engram offers LLM-based fact extraction and auto-tagging. No tool implements IBM's causal attribution (strategy/recovery/optimization tip taxonomy). The extraction layer remains the most undertooled.

### L3: Organize (Structure for efficient retrieval)
- **Gap status: WELL ADDRESSED.** Three distinct approaches:
  - **Hierarchical (bonsai-memory):** Tree structure with progressive disclosure. Maps to SkyClaw's "procedures over summaries" and "brain sees its own budget" principles.
  - **Dual-layer (zer0dex):** Compressed index + vector store. Combines human-readable navigational scaffolding with semantic retrieval.
  - **Graph (engram):** Auto-linked knowledge graph with embeddings. Closest to HyMEM's graph structure.

### L4: Retrieve (Get relevant knowledge at inference time)
- **Gap status: WELL ADDRESSED.** zer0dex's dual-layer approach is the most architecturally interesting — it solves the "index always in context, details on demand" pattern that bonsai-memory also targets but via different mechanism (hierarchical vs. dual-layer).

### L5: Adapt (Update memory over time)
- **Gap status: PARTIALLY CLOSED.** Engram's FSRS-6 spaced repetition is genuinely novel — it's the first agent memory tool to use cognitive-science-backed decay curves. Memories gain stability through repeated access (implicit spaced repetition). However, none implement consolidation/pruning at the sophistication of HyMEM's ADD/MERGE/REPLACE.

---

## 3. The Hardest Gaps Remain Unaddressed

### Gap 1 (Multi-Agent Sharing): 0/7 tools solve this
Only agent-soul explicitly targets shared memory, but it's 3★ and trivially thin (Git-native file sharing, no consistency protocol). **None implement a memory consistency protocol** (the core challenge identified by CompArch 2603.10062). None handle the "who knows what" epistemic state tracking that DPIP (2603.05450) showed LLMs fail at.

### Gap 2 (Memory Verification/Trust): 1/7 partially addresses
Engram's contradiction detection is the only trust-related feature across all 7 tools. But contradiction detection is not verification — it identifies inconsistency but doesn't establish which version is correct. **No tool implements provenance tracking, trust scores, or HMAC verification** (NabaOS tool receipts, 2603.10060).

### Gap 3 (Catastrophic Consolidation): 0/7 tools address
No tool provides safe consolidation with rollback capability beyond bonsai-memory's simple `.bak` file. Engram's versioning is the closest — memories keep history — but it doesn't have a consolidation recovery mechanism.

### Gap 4 (Cross-Task Transfer): 0/7 tools address
All tools are domain-agnostic but none have mechanisms for identifying when knowledge from one domain transfers to another. This remains an open research problem.

---

## 4. Novel Patterns Worth Noting

### 4.1 Engram's FSRS-6 Spaced Repetition
This is the standout innovation. Based on the FSRS algorithm (ported from open-spaced-repetition/fsrs4anki), it models:
- **Storage strength** (Bjork & Bjork 1992): How well a memory is encoded. Never decays.
- **Retrieval strength**: How accessible a memory is right now. Decays via power law.
- **Implicit review**: Every memory access counts as a "review," strengthening the memory.

This directly operationalizes our IBM Trajectory finding about learning from experience. The more a memory is useful (accessed), the more stable it becomes. Unused memories naturally decay in retrieval priority without being deleted.

**Implication for our system:** If Scout's research notes had FSRS-style decay, frequently-referenced papers would stay prominent while dead-end investigations would naturally deprioritize. This is a low-cost, high-value enhancement.

### 4.2 zer0dex's Dual-Layer Architecture
The insight: keep a compressed human-readable index (~782 tokens) permanently in context, and use it as a *semantic router* to the full vector store. The agent always knows *what categories of knowledge exist* without paying the token cost of storing all knowledge. When it needs details, it queries the vector store.

**Cross-reference with SkyClaw:** This is essentially SkyClaw's "Resource Budget Dashboard" pattern applied to memory — the agent sees its own knowledge budget and can choose what to expand. SkyClaw enforces this for tools/blueprints; zer0dex applies the same idea to facts/preferences.

**Cross-reference with bonsai-memory:** Same architectural insight (slim index → details on demand) but different implementation. Bonsai uses file hierarchy (trunk/branch/leaf files); zer0dex uses compressed markdown + vector DB.

### 4.3 The Convergence on "Always-In-Context Index"
Three tools independently converge on the same pattern: a small, always-loaded index that routes to deeper storage. This validates our SkyClaw finding that "the brain must see its own budget." The implementations vary but the principle is universal:
- **bonsai-memory:** `memory/index.md` (~trunk, domain tree)
- **zer0dex:** `MEMORY.md` (~782 tokens, semantic TOC)
- **SkyClaw:** Resource Budget Dashboard (injected every context rebuild)

**This is an actionable pattern for our system.** Our agents load SOUL.md + relevant files on boot, but there's no compact "knowledge index" that tells the agent what it knows without loading everything.

---

## 5. Evaluation Concerns

### zer0dex's claims need scrutiny:
- "91% recall, 70ms, $0/month" — on n=97 test queries against what baseline corpus? 
- "Zero losses in head-to-head comparison" — comparison against what? Flat file vs RAG vs zer0dex, but the evaluation methodology isn't detailed.
- Single commit repo (1 commit). This is a proof-of-concept, not production-hardened.

### bonsai-memory's "70-95% token reduction":
- "Tested across 9 production agents" — but it's 1★ with 0 forks and 7 commits. The claim of "production agents" vs the repo's maturity are inconsistent.
- The SKILL.md-based installation ("just tell your agent to install") is clever marketing but places trust in the agent's audit of the repo.

### engram is the most mature:
- 26 commits, SDKs (Python + TypeScript), MCP server, Docker deployment, OpenAPI spec.
- The FSRS-6 implementation is grounded in a well-studied algorithm.
- But still very early (19★, single author).

---

## 6. Actionable Recommendations for Our System

### Immediate (Today)
1. **Adopt the "always-in-context knowledge index" pattern.** Create a slim `knowledge-index.md` for each agent (~500-1000 tokens) that lists what knowledge domains exist and where they live. Scout already partially does this (library/ files), but it's not compact enough to inject into every context.

### Short-term (This week)
2. **Adopt IBM's three-tip-type taxonomy in journal.md.** Classify entries as strategy/recovery/optimization. This is free and makes memory retrieval more useful. (Carried forward from Memory Architecture Convergence — still not implemented.)

3. **Consider FSRS-inspired decay for SIGNALS.md.** Old signals that are never referenced should naturally deprioritize. New, frequently-referenced signals should stay prominent.

### Medium-term (When building memory infrastructure)
4. **The dual-layer architecture (zer0dex pattern) is the right starting point for our system.** Compressed markdown index (always in context) + vector store (query on demand). It's the simplest architecture that addresses our biggest memory pain point (agents loading too much or too little context).

5. **If adopting engram, evaluate the MCP server integration path.** Engram's REST API + MCP server means agents could store/recall memories via tool calls rather than file manipulation. This would be a significant architectural shift from our file-based system but could solve the multi-agent sharing gap if all agents share one engram instance.

---

## 7. Meta-Observation: Theory → Tooling Lag

| Memory Architecture Concern | Theory Status (Papers) | Tooling Status (Repos) | Lag |
|----|----|----|-----|
| Structured storage + retrieval | Solved (HyMEM, IBM, PlugMem) | Solved (engram, zer0dex, bonsai) | **CAUGHT UP** |
| Self-evolution / pruning | Solved (HyMEM, EvoSkill) | Partial (engram FSRS only) | ~3 months |
| Causal attribution | Solved (IBM Trajectory) | None | **OPEN** |
| Multi-agent sharing | Identified as critical (CompArch) | None meaningful | **OPEN** |
| Memory verification / trust | Identified (our Provenance Paradox) | None | **OPEN** |
| Consistency protocols | Theoretically framed (Bureaucracy of Speed) | None | **OPEN** |

The tools are catching up to the easy theoretical results while the hard problems remain theory-only. This gap represents both a risk (practitioners will deploy unverified memory) and an opportunity (first tool to solve multi-agent memory consistency wins the ecosystem).
