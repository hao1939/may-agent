# Deep-Dive: arXiv:2603.02240 — SuperLocalMemory: Privacy-Preserving Multi-Agent Memory with Bayesian Trust Defense Against Memory Poisoning

**Paper:** arXiv:2603.02240
**Title:** SuperLocalMemory: Privacy-Preserving Multi-Agent Memory with Bayesian Trust Defense Against Memory Poisoning
**Authors:** Varun Pratap Bhardwaj (Independent Research)
**Date:** 2026-03-04
**Deep-Dive Date:** 2026-03-18
**Gap Target:** CR#237 Gap 4 — Memory Adversarial Robustness
**Rating:** ★★★★★ CRITICAL — Direct Gap 4 hit; first open-source defense against OWASP ASI06 memory poisoning in multi-agent systems

---

## 1. Core Contribution

SuperLocalMemory (SLM) is a **local-first memory system** for multi-agent AI that defends against OWASP ASI06 memory poisoning through:
1. **Architectural isolation** — SQLite-backed, zero cloud dependency, single-user isolation
2. **Bayesian trust scoring** — Beta-Binomial posterior inference per-agent
3. **Adaptive learning-to-rank** — Zero-LLM behavioral re-ranking with privacy preservation
4. **Event-driven coordination** — SSE/WebSocket/webhook event bus for multi-agent coordination

Key claim: Local-first architecture eliminates the centralized attack surface that cloud memory systems create, while Bayesian trust scoring provides active defense against memory poisoning.

---

## 2. Architecture — Four-Layer Progressive Enhancement

### Layer 1: Storage Engine
- SQLite + FTS5 full-text search
- WAL mode for concurrent reads, serialized write queue
- 10.6ms median search latency at 100 memories
- 1.4KB per-memory storage at scale

### Layer 2: Hierarchical Index
- Materialized path scheme for parent-child memory relationships
- O(1) parent lookup, O(depth) path construction
- Enables project/topic-scoped retrieval

### Layer 3: Knowledge Graph
- TF-IDF key-term extraction → pairwise cosine similarity (threshold >0.3)
- **Leiden algorithm** community detection (hierarchical subclustering to depth 3)
- O(n²) brute-force; optional HNSW reduces to O(n log n)
- Capped at 10,000 memories

### Layer 4: Pattern Learning
- Beta-Binomial Bayesian model tracking user preferences across 8 tech categories
- Confidence = (α + k) / (α + β + N), clamped to [0, 0.95]
- Inspired by MACLA framework (Forouzandeh et al., 2025)

### Event Coordination Layer (v2.5)
- SQLite-backed event log with 200-event in-memory buffer
- Events: memory.created, memory.recalled, agent.connected, graph.updated
- Tiered retention: hot (48h), warm (14d), cold (30d)
- Agent registry with protocol-aware tracking (MCP, CLI, REST)

### Adaptive Learning Layer (v2.7)
- Three-layer behavioral analysis:
  1. Cross-project technology preferences (τ₁/₂ = 365 days temporal decay)
  2. Project context detection (file paths, tags, cluster membership, labels)
  3. Workflow pattern mining (time-weighted sliding windows)
- Three-phase progression: Phase 0 (<20 signals, no change) → Phase 1 (20-199 signals, rule-based) → Phase 2 (200+ signals, gradient boosted trees with LambdaRank)
- 9-dimensional feature vector: BM25, TF-IDF similarity, tech match, project match, workflow fit, source quality, importance, recency, access frequency
- Privacy: behavioral data isolated in separate learning.db; GDPR Article 17 erasure via `slm learning reset`

---

## 3. Trust Scoring Framework — The Gap 4 Core

### Bayesian Trust Model
All agents start at t₀ = 1.0. Trust evolves:

**t_{i+1} = t_i + δ · 1/(1 + n·η)**

Where:
- δ = signal magnitude (asymmetric: negative signals have larger magnitude)
- n = cumulative signal count
- η = 0.01 (decay coefficient)

**Signal magnitudes (deliberately asymmetric — trust is harder to gain than lose):**
- Positive: verified recall (+0.015), consistent writes (+0.01), low error rate (+0.02)
- Negative: contradictory writes (-0.02), flagged content (-0.03), anomalous burst (-0.025)

### Enforcement Mode (v2.6)
- Agents below configurable threshold (default t < 0.3) are **blocked from write and delete operations**
- Active defense, not just monitoring

### Provenance Tracking
Every memory stores:
- `created_by` — agent identifier
- `source_protocol` — MCP, CLI, REST, A2A
- `trust_score` — agent's trust at write time
- `provenance_chain` — JSON array of all modifications with timestamps and agent IDs

### Sleeper Agent Defense
- Agent writes normally for N operations, builds trust through positive signals
- Decay factor ensures early good behavior stabilizes trust
- When poisoning begins, accumulated negative signals overcome baseline
- **Result: 72% trust degradation** (from 0.902 to 0.249)

---

## 4. Evaluation Results

### Search Performance
| Memories | Median (ms) | P95 (ms) | Storage per memory |
|----------|-------------|----------|-------------------|
| 100 | 10.6 | 14.9 | 44 KB |
| 500 | 65.2 | 101.7 | — |
| 1,000 | 124.3 | 190.1 | — |
| 5,000 | 1,172.0 | 2,139.7 | 1.4 KB |

### Concurrent Access (WAL mode + serialized write queue)
| Writers | Ops/sec | Median (ms) | Errors |
|---------|---------|-------------|--------|
| 1 | 204.4 | 4.3 | 0 |
| 2 | 220.8 | 8.4 | 0 |
| 5 | 130.8 | 31.1 | 0 |
| 10 | 24.9 | 386.7 | 0 |

Sweet spot: 1-2 concurrent writing agents; reads unaffected under WAL.

### Layer Ablation
- FTS5 only → MRR 0.90, NDCG@5 0.441
- + Adaptive ranker → MRR 0.90, **NDCG@5 0.900 (+104%)**
- Graph and Pattern layers maintain but don't improve MRR (structural enrichment only)
- **Circularity note**: NDCG labels derived from system's own importance scores (partial circularity acknowledged)

### Trust Defense
| Scenario | Benign Trust | Malicious Trust | Gap |
|----------|-------------|----------------|------|
| Benign baseline | 0.945 | — | 0.000 |
| Single poisoner (9:1) | 0.946 | 0.048 | 0.898 |
| Sleeper agent | 0.902 | 0.249 | 0.653 |

**Zero false positives** across all scenarios.

### Pilot User Study
- Developer with 3 months usage, 182 organic memories, 20 queries, 70 judgments
- Human-judged MRR: 0.70, NDCG@5: 0.90
- Rating distribution: 38.6% highly relevant, 24.3% relevant, 28.6% slightly relevant, 8.6% irrelevant

---

## 5. Threat Model Analysis

### OWASP ASI06 Attack Vectors Addressed
1. **Direct injection** — malicious agent writes false info → detected via abnormal write volume + contradiction detection
2. **Indirect injection** — agent stores malicious external data → provenance tracking identifies externally-sourced content
3. **Sleeper agent (gradual erosion)** — hardest attack → statistical deviation analysis over behavioral history → 72% degradation

### Why Local-First Eliminates Cloud Attack Surface
- No multi-tenant exposure (single-user isolation)
- No network exposure (data never leaves machine)
- Full local provenance (no opaque vendor audit logs)
- No vendor lock-in (user controls entire stack)

---

## 6. Comparison with Existing Systems

| System | Local | Trust | Learn | OSS | MCP | Latency |
|--------|-------|-------|-------|-----|-----|---------|
| **SLM** | ✓ | ✓ | ✓ (zero-LLM) | MIT | ✓ | 11ms |
| Mem0 | ~ | ✗ | ~ | MIT | ✓ | 1.44s |
| MemOS | ~ | ✗ | ✗ | Apache | ✓ | N/R |
| A-MEM | ✗ | ✗ | ✗ | ✓ | ✗ | N/R |
| Cognee | ~ | ✗ | ✗ | Apache | ✓ | N/R |
| Zep | ✗ | ✗ | ✗ | ✗ | ✗ | N/R |
| Letta | ~ | ✗ | ✗ | Apache | ~ | N/R |

**SLM is the only system combining local-first + trust scoring + adaptive learning.**

---

## 7. Limitations & Gaps

1. **Learning requires sustained usage** — 20+ signals for rule-based, 200+ for ML personalization
2. **Synthetic bootstrap drift risk** — mitigated by aggressive regularization + phase-gated transition
3. **Graph scaling** — O(n²) capped at 10,000 memories; HNSW optional
4. **Trust doesn't influence ranking** — enforcement blocks at 0.3 but doesn't soft-degrade
5. **No standard benchmark comparison** — LoCoMo not evaluated; designed for different use case
6. **No formal user study** — only pilot with single developer
7. **Trust model assumes known agent identities** — doesn't address Sybil attacks or identity spoofing

---

## 8. CR#237 Integration: Gap 4 Impact

### Direct Gap 4 Relevance
SuperLocalMemory **directly addresses** the Gap 4 need for "memory adversarial robustness" research:
- Provides a concrete Bayesian trust framework (not just conceptual)
- Open-source MIT implementation with 17+ MCP tool integrations
- Demonstrates measurable sleeper agent defense (72% degradation)
- Zero false positives in trust scoring

### Cross-References
- **2603.11619 (Taming OpenClaw)** — attack analysis; SLM provides the *defense* architecture
- **2602.19555 (Jiang et al.)** — identifies the threat taxonomy; SLM implements defenses against ASI06
- **OWASP ASI06** — SLM is the first system specifically designed to defend against this standard
- **MACLA (Forouzandeh et al.)** — SLM adapts MACLA's Beta-Binomial model for trust scoring

### What's Still Missing for Full Gap 4 Coverage
1. Adversarial stress-testing under sophisticated attacks (not just 3 scenarios)
2. Multi-agent trust graph dynamics (how does trust propagate across agent networks?)
3. Cross-system trust federation (how do different memory systems share trust assessments?)
4. Formal security proofs (current evaluation is empirical only)

---

## 9. Key Takeaways for Kairix Architecture

1. **Bayesian trust per-agent** is practical and deployable today — adopt for our multi-agent coordination
2. **Local-first eliminates entire attack classes** — relevant for on-premise deployment options
3. **Asymmetric trust signals** (harder to gain than lose) is a sound design principle
4. **Provenance chains** should be mandatory for all memory writes in multi-agent systems
5. **Phase-gated learning** (baseline → rule-based → ML) avoids cold-start degradation
6. **Event-driven coordination** via SSE/WebSocket scales to real-time multi-agent scenarios

**Open-source implementation available:** https://github.com/varun369/SuperLocalMemoryV2

---

*Filed as DD#414 — Gap 4 targeted deep-dive*
*Next: Write DD#415 for 2602.19555 (Jiang et al. attack taxonomy)*
