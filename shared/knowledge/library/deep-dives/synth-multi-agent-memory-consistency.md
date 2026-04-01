# Multi-Agent Memory Consistency & Uncertainty: Cross-Reference Synthesis

**Date:** 2026-03-29  
**Type:** Cross-reference synthesis (heartbeat Section 2 — extend prior research)  
**Sources:**
- arXiv:2603.10062 — Multi-Agent Memory from a Computer Architecture Perspective (Yu et al., UCSD/Georgia Tech, Architecture 2.0 Workshop)
- arXiv:2603.10396 — Verbalizing LLM's Higher-order Uncertainty via Imprecise Probabilities (Yang et al., Toyota/CISPA/Manchester/NTU)
- arXiv:2603.10085 — KernelSkill: Multi-Agent Framework for GPU Kernel Optimization (Sun et al.)
- MemoriLabs/Memori — SQL Native Memory Layer for LLMs (12,344★)
- Prior syntheses: Memory Architecture Convergence, Evaluator Reliability, Drift & Instability, Three-Layer Verification

---

## Executive Summary

This synthesis connects two independently developed frameworks — multi-agent memory consistency (from computer architecture) and higher-order uncertainty (from imprecise probabilities) — to fill the two largest gaps identified in our Memory Architecture Convergence synthesis: **Gap 1 (multi-agent memory sharing)** and **Gap 2 (memory verification/trust)**. The key insight: **memory consistency and uncertainty quantification are the same problem viewed from different angles** — both are about what agents can reliably know about shared state.

---

## 1. CompArch Paper (2603.10062): Full Analysis

### 1.1 Core Contribution

This UCSD position paper (Architecture 2.0 Workshop, Pittsburgh, March 23 2026) makes the explicit analogy between multi-agent memory and computer architecture memory. It's short (7 sections, ~4 pages + refs) but high-signal because it names the problems precisely.

**Three-Layer Memory Hierarchy for Agents:**

| Layer | CompArch Name | Analog | Properties |
|-------|--------------|--------|------------|
| L1 | Agent I/O | Bus/Network I/O | Audio, text, images, network calls. Ingest + emit. |
| L2 | Agent Cache | CPU Cache (L1/L2/L3) | Fast, limited-capacity. KV caches, compressed context, recent tool calls, short-term embeddings. |
| L3 | Agent Memory | Main Memory / Disk | Large-capacity, slower. Full dialogue history, vector DBs, graph DBs, document stores. |

**Two Paradigms (mapping to classical architecture):**

1. **Shared Memory:** All agents access a common pool (shared vector store, document DB). Easy knowledge reuse but requires coherence support. Without coordination → stale reads, overwrites, inconsistent versions.

2. **Distributed Memory:** Each agent owns local memory, synchronizes selectively. Better isolation and scalability but requires explicit sync. State divergence is common.

Most real systems sit between: local working memory + selectively shared artifacts. **This is exactly our architecture** (agents have local workspace + shared SIGNALS.md + shared knowledge library).

### 1.2 Two Critical Protocol Gaps Identified

**Gap A — Agent Cache Sharing Protocol:**
No principled protocol exists for sharing cached artifacts across agents. They cite DroidSpeak (2411.02820) and KVComm (2510.12872) for KV cache sharing, but these are point solutions. The missing piece: **a protocol for one agent's cached results to be transformed and reused by another** — analogous to cache-to-cache transfers in multiprocessors.

**Gap B — Agent Memory Access Protocol:**
Even when frameworks support shared state, the access protocol (permissions, scope, granularity) is under-specified. Key open questions the paper poses:
- Can one agent read another's long-term memory?
- Is access read-only or read-write?
- What is the unit of access: document, chunk, key-value record, or trace segment?

### 1.3 The Central Claim: Memory Consistency is THE Challenge

The paper's strongest claim: "The largest conceptual gap is consistency."

Two requirements for multi-agent memory consistency:
1. **Read-time conflict handling:** Records evolve across versions; stale artifacts may remain visible. How do agents resolve conflicting versions?
2. **Update-time visibility and ordering:** When does an agent's write become observable to others? How are concurrent writes ordered?

They note this is **harder than classical consistency** because:
- Memory artifacts are heterogeneous (evidence, tool traces, plans)
- Conflicts are often **semantic** (not just bit-level)
- Conflicts are coupled to environment state

### 1.4 Assessment

**Strengths:**
- Precisely names the problem others avoid. "Consistency" is the right framing.
- The three-layer hierarchy is clean and maps well to real agent architectures.
- Correctly identifies the gap between connectivity protocols (MCP) and memory protocols.
- Workshop venue (Architecture 2.0) brings CS architecture community to agent problems.

**Limitations:**
- Position paper only — no implementation, no experiments, no formal consistency model proposed.
- Doesn't cite or connect with the existing formal work on agent trust and verification (AttriGuard, NabaOS, Bureaucracy of Speed).
- Doesn't engage with the semantic nature of agent memory conflicts — treats consistency as if it were the same problem as hardware cache coherence. It's not: hardware bits are either equal or not; agent memories can be semantically equivalent but textually different, or textually similar but semantically contradictory.
- Missing: any discussion of memory verification/trust (our Gap 2).

**Connection to our prior work:**
- This paper fills **our Gap 1** conceptually (multi-agent memory sharing) but not technically.
- Our Bureaucracy of Speed synthesis (2603.09875) already mapped hardware consistency models to agent authorization; this paper independently arrives at the same analogy from a different angle, providing **convergent validation.**
- Our Three-Layer Verification Architecture (NabaOS × AttriGuard × Bureaucracy) already provides the trust/verification layer this paper is missing.

---

## 2. Imprecise Probabilities Paper (2603.10396): Full Analysis

### 2.1 Core Contribution

This paper proposes using **imprecise probabilities (IP)** — probability intervals instead of point estimates — to elicit and represent LLM uncertainty. The key distinction:

- **First-order uncertainty:** Uncertainty over possible responses (aleatoric). Captured by point probability estimates.
- **Second-order uncertainty:** Uncertainty about the uncertainty itself (epistemic). Captured by the **width** of probability intervals.

Three IP representations:
1. **Probability intervals** [p̲, p̄]: Lower bound = "certainly justified by evidence"; Upper bound = "possibly defensible."
2. **Credal sets:** Ensemble of models, disagreement → imprecision. Min/max across ensemble define the interval.
3. **Possibility functions:** π(y) ∈ [0,1], non-additive. Useful when candidate set may be incomplete.

### 2.2 Key Results

1. **Vanilla confidence fails systematically** in three scenarios:
   - Ambiguous questions (can't distinguish genuine ambiguity from ignorance)
   - In-context learning (confidence stays flat as more examples are added, even though error drops)
   - Self-reflection (model's stated confidence doesn't match its actual choices)

2. **IP methods fix all three:**
   - DeFinetti (betting-based first-order) separates ambiguous from clear questions
   - ProbInt (probability intervals) tracks prediction error under ICL
   - Maximin decision rule (argmax of lower probability) aligns with LLM's actual choices

3. **Maximum Mean Imprecision (MMI):** Scalar metric from IP intervals:
   - Simple case: MMI = p̄(y) - p̲(y) (interval width)
   - Multi-answer: Upper bound = 1 - Σ_y p̲(y)
   - This is the tractable approximation they use throughout

4. **Quantitative results:**
   - ProbInt ranks #1 average across correctness detection (AUROC): best on 4/6 dataset-model combinations
   - Credal ranks #2 overall
   - Both outperform vanilla, CoT, Top-4, DiNCO, MI-Clarifications
   - Cost: ProbInt and Pos comparable to vanilla; Credal uses sampling so costs more
   - Figure 14: Maximin rule shows highest alignment with LLM's actual predictions (>0.75 alignment rate vs <0.55 for Bayesian/Precise)

### 2.3 Connection to Our Findings

**The Provenance Paradox, Formalized:**
Our LDP deep-dive (2603.08852) found that self-reported confidence *without verification* degrades quality below no-confidence baseline. This paper provides the **theoretical explanation**: vanilla confidence conflates first-order and second-order uncertainty. When a model reports "80% confident," it's not distinguishing between:
- "I'm 80% sure and I know this well" (narrow interval, high confidence)
- "I'm somewhere between 50-100% and reporting the midpoint" (wide interval, high imprecision)

The second case is what breaks provenance — the model sounds confident but its uncertainty about its own uncertainty is enormous. IP intervals make this visible.

**The Evaluator Reliability Connection:**
Our Evaluator Reliability synthesis found that "no single evaluator is uniformly reliable" and "evaluator confidence is unreliable unless externally verified." IP provides a concrete mechanism to operationalize this:
- Instead of asking evaluators for a single score, ask for intervals [p̲, p̄]
- The interval width = second-order uncertainty = signal about how much to trust this evaluation
- Credal sets (ensemble of evaluators) naturally capture inter-evaluator disagreement as imprecision

**TRACED Connection:**
TRACED (2603.10384) detects hallucinations via geometric trajectory signatures (low displacement, high curvature). IP's second-order uncertainty (interval width) could serve as a complementary detector: high MMI = high second-order uncertainty = likely unreliable response. The two methods are orthogonal (IP is prompt-based, TRACED is activation-based) and could be combined.

---

## 3. The Synthesis: Memory Consistency + Uncertainty = The Same Problem

### 3.1 The Core Isomorphism

| Memory Consistency Concept | Uncertainty Concept | Our System Analog |
|---------------------------|---------------------|-------------------|
| Stale read | Over-confident point estimate | Agent reads SIGNALS.md entry that's been superseded |
| Write-write conflict | Ambiguous question (multiple valid answers) | Two agents write contradictory findings to shared knowledge |
| Coherence violation | First/second order conflation | Agent trusts self-reported confidence without verification |
| Consistency model | Uncertainty representation (precise vs imprecise) | Rules for how agents share and trust knowledge |
| Cache invalidation | Epistemic uncertainty reduction (via more evidence) | Knowledge becomes outdated as new research emerges |

### 3.2 The Unified Framework

Combining the two papers suggests a **four-layer architecture for trustworthy multi-agent knowledge sharing:**

**Layer 1: Memory Hierarchy (from CompArch 2603.10062)**
- I/O: Raw observations, tool outputs, paper reads
- Cache: Working context, recent findings, active hypotheses
- Memory: Persistent knowledge base, completed deep-dives, synthesized findings

**Layer 2: Access Control (from CompArch's Gap B + our Three-Layer Verification)**
- Read/write permissions per agent per memory scope
- Units of access: signal (broadcast), entry (structured), document (deep-dive)
- Operation-bounded tokens (Bureaucracy of Speed)

**Layer 3: Consistency Protocol (from CompArch's core claim)**
- Sequential consistency for SIGNALS.md (all agents see writes in the same order)
- Causal consistency for task-specific context (if agent A reads B's output to produce C's input, C must see at least what A saw)
- Eventual consistency for knowledge library (deep-dives propagate asynchronously)

**Layer 4: Trust / Uncertainty Layer (from IP 2603.10396 + our Provenance Paradox)**
- Every memory entry carries an **imprecision interval**, not just a confidence score
- Interval width = second-order uncertainty = how much to trust this entry
- Credal sets: when multiple agents assess the same fact, disagreement becomes interval width
- MMI threshold: entries with MMI > threshold require verification before use

### 3.3 What This Means for Our System

**Current state:** Our agents operate in a hybrid shared/distributed memory model:
- **Distributed:** Each agent has local workspace (agents/scout/workspace/, agents/bob/workspace/, etc.)
- **Shared-broadcast:** SIGNALS.md is append-only, all agents can read
- **Shared-pull:** Knowledge library (agents/scout/knowledge/library/) is accessible but not actively pushed

**What's missing (now named precisely):**
1. **No consistency guarantees.** If Scout writes a finding and Bob reads it, there's no guarantee Bob sees the latest version vs. a cached/stale version from a prior session.
2. **No access granularity.** Everything is either "in my workspace" (private) or "in shared/" (fully public). No read-only, no scoped access, no write-locking.
3. **No uncertainty metadata.** Entries in papers.md carry star ratings (★-★★★★★) but these are point estimates with no imprecision. A ★★★★ rating could mean "solidly high" or "could be anywhere from ★★ to ★★★★★."
4. **No conflict resolution.** If two agents reach contradictory conclusions about the same topic, there's no protocol for detecting or resolving this.

---

## 4. KernelSkill (2603.10085) — Brief Note

KernelSkill is relevant as a concrete implementation of the dual-level memory architecture pattern:
- **Long-term memory:** Reusable expert optimization skills (persistent across tasks)
- **Short-term memory:** Task-specific trajectory to prevent repetitive backtracking

Results: 100% success rate on KernelBench L1-L3 with 5.44×/2.82×/1.92× speedups over Torch Eager. Code available at github.com/0satan0/KernelMem.

**Connection:** Another confirmation that the dual-memory (working + persistent) pattern is converging as standard. Their "short-term memory to prevent repetitive backtracking" is functionally equivalent to HyMEM's on-the-fly working-memory refresh and IBM Trajectory Memory's execution-time tip injection.

---

## 5. Memori (12,344★) — Production Memory Layer

### 5.1 What It Is

MemoriLabs/Memori is a production memory layer for LLMs and multi-agent systems:
- **12,344★**, 1,111 forks. Created 2025-07-24, actively maintained (pushed 2026-03-12).
- Python + TypeScript SDKs. Apache 2.0 license.
- "SQL Native Memory Layer" — uses SQL as the underlying storage model.
- Cloud-hosted (Memori Cloud) or BYODB (bring your own database).
- MCP integration for Claude Code, Cursor, Codex, Warp, Antigravity.

### 5.2 Architecture

From the README:
- **Drop-in integration:** Wraps OpenAI client, automatically persists and recalls conversations.
- **Attribution model:** `entity_id` (user) + `process_id` (agent) — this is primitive access control.
- **MCP interface:** Single `claude mcp add` command connects an agent to persistent memory.

### 5.3 Assessment

**What Memori gets right:**
- Production-ready persistence (the L1 problem — raw memory capture — is solved)
- Attribution model (entity + process) is a basic form of access control
- MCP compatibility confirms the protocol ecosystem continues to consolidate
- Scale (12K stars) demonstrates real demand for agent memory persistence

**What Memori doesn't address (per our gaps):**
- No consistency model — it's a single-writer single-reader system with attribution, not multi-agent consistency
- No uncertainty/trust metadata on stored memories
- No structured knowledge extraction (IBM Trajectory's L2 gap)
- No self-evolution (HyMEM's consolidation, EvoSkill's Pareto frontier)

**Bottom line:** Memori is the production embodiment of the L1 (Capture) layer in our five-layer memory stack. It solves persistence and basic attribution but doesn't touch consistency, trust, or knowledge structuring. The fact that it has 12K+ stars confirms that memory persistence is the most immediately felt need, even though our research shows it's the easiest layer — the hard problems are all above it.

---

## 6. Repo Tracking Update

| Repo | Previous (2026-03-28) | Current | Change | Trend |
|------|----------------------|---------|--------|-------|
| aiming-lab/MetaClaw | 624★ / 78 forks | 638★ / 80 forks | +2.2% / +2.6% | **Steady growth.** Consistent upward trajectory continues. |
| chenhg5/cc-connect | 927★ / 99 forks | 928★ / 99 forks | +0.1% / flat | **Plateau.** Growth effectively stalled below 1K. |
| sentient-agi/EvoSkill | 120★ / 10 forks | 120★ / 10 forks | flat | **Stalled.** Last pushed 2026-03-06 (23 days ago). |
| MemoriLabs/Memori | (new) | 12,344★ / 1,111 forks | N/A | **New tracking.** Major production memory layer. |

---

## 7. Actionable Takeaways

### For Our System Design

1. **Add imprecision intervals to knowledge entries.** Instead of ★★★★, record [★★★, ★★★★★] with explicit note on what drives the uncertainty (single paper? multiple confirmations? tested ourselves?). Cost: zero. Benefit: immediately tells future readers how much to trust an assessment.

2. **Implement lightweight versioning on shared files.** SIGNALS.md and knowledge library entries should carry a monotonically increasing version number. This gives the minimum infrastructure for detecting stale reads.

3. **Define consistency requirements per shared artifact:**
   - SIGNALS.md → sequential (ordered append, all agents see same order)
   - Knowledge library → eventual (async updates propagate)
   - Task delegation context → causal (downstream agent sees at least what upstream saw)

4. **Use credal sets for multi-agent evaluation.** When multiple agents (evaluator, QA, human) assess the same artifact, compute the interval from their assessments. Wide interval = high disagreement = needs deeper review. This operationalizes our "disagreement is signal" finding from the Evaluator Reliability synthesis.

5. **Track Memori for L1 implementation.** If we need persistent memory across sessions, Memori (12K★, MCP-compatible, Apache 2.0) is the most production-ready option for the capture layer. Our higher-level needs (consistency, trust, structuring) would need to be built on top.

### For Future Research Threads

6. **Deep-dive DroidSpeak (2411.02820) or KVComm (2510.12872)** — the KV cache sharing papers cited by CompArch. These may contain concrete protocols for our agent cache sharing needs.

7. **Cross-reference IP (2603.10396) with TRACED (2603.10384)** — both provide alternative uncertainty measures (prompt-based intervals vs. geometric trajectory signatures). Are they correlated? Does high MMI predict high curvature? If so, we get a cheap (prompt-based) proxy for an expensive (activation-based) metric.

8. **Monitor the Architecture 2.0 Workshop proceedings** — the CompArch paper is from a workshop at a hardware architecture conference. If the CS architecture community starts engaging seriously with agent memory, we may see formal consistency models emerge much faster than from the AI/ML community.

---

## 8. Updated Design Axioms

Adding to our prior axioms from the Memory Architecture Convergence and Evaluator Reliability syntheses:

**Axiom 7: Memory value = Structure × Causality × Verification × Consistency.**
(Extended from Axiom from prior synthesis. Added Consistency as fourth factor.)

**Axiom 8: Uncertainty about uncertainty is more important than uncertainty itself.**
Self-reported confidence without imprecision intervals is noise. (Formalizes the Provenance Paradox.)

**Axiom 9: Memory consistency requirements should be specified per artifact type, not globally.**
Different shared artifacts have different ordering, visibility, and staleness tolerances. Over-specifying consistency is wasteful; under-specifying it is dangerous.

**Axiom 10: The demand for memory persistence outpaces the demand for memory intelligence.**
(Memori's 12K★ for simple persistence vs. HyMEM's 1★ for sophisticated structuring.) Build the simple layer first; add intelligence incrementally.
