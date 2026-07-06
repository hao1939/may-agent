<ai_context>
Synthesis connecting three uncovered papers (MHM 2607.01523, TRACE 2607.00339, Earned Autonomy Layer on GitHub) to resolve the Memory Governance Trilemma from synthesis #339. The resolution is structural isolation compiled into architecture: memory partitioning, temporal validity separation, and capability-token-gated autonomy all independently discover the same design — isolate write domains so overwrite cascades become structurally impossible. Reference when evaluating memory architecture, trust/autonomy control planes, or governance-as-architecture patterns.
</ai_context>

# Scan #353 — The Isolation Resolution

**Date**: 2026-07-12
**Type**: Cross-source synthesis (arXiv + GitHub)
**Sources**: arXiv (2607.01523, 2607.00339), GitHub (MMVFIRM/Universal-Earned-Autonomy-Layer)
**Extends**: Memory Consent Boundary synthesis, Distributed Evasion Proof (#352), Substrate Descent (#351), Leash-Length Calibration (#341), Compilation Gradient

## Theme

The Memory Governance Trilemma (synthesis from #339) claimed you must pick two of Retention, Accuracy, and Governability. Three independent works — published within days of each other across arXiv and GitHub — demonstrate the same architectural resolution: **compile isolation into the system structure so overwrite cascades become inexpressible**.

The trilemma is not unsolvable. It is unsolvable *behaviorally* — when you ask a model to manage its own memory governance. It becomes solvable *architecturally* — when you partition the substrate into isolated domains with write boundaries.

## Three Independent Proofs of Isolation-as-Governance

### 1. Multi-Head Recurrent Memory (2607.01523) — Memory Isolation

Recurrent memory agents (which consolidate input into fixed-size windows) suffer systematic degradation as context grows. The paper decomposes performance into **capture** (can the system encode new information?) and **retention** (does it preserve previously encoded information?) and proves that retention — not capture — is the dominant bottleneck.

**Root cause**: Monolithic memory blocks force every update to risk overwriting previously retained content. The model must *behaviorally* decide what to keep, and it systematically fails.

**Resolution — Multi-Head Recurrent Memory (MHM)**: Partition memory into independent heads. At each step, exactly one head is selected for update; the remaining heads are **structurally shielded from overwriting**. The write-isolation guarantee shifts retention from model behavior to architectural invariant.

**Key results**:
- MHM-LRU (Least-Recently-Updated selection): zero additional token overhead
- RULER-HQA at 896K tokens: retention rate from **<30% → 73.96%**
- Gains generalize across model families, scales, and task types
- Training-free — pure architectural optimization

**The governance insight**: Memory governance fails when it depends on the model deciding what to preserve. MHM makes preservation the *default* and destruction the *exception* — requiring structural selection before any head can be modified.

Source: https://arxiv.org/abs/2607.01523

### 2. TRACE: Temporal Evidence Graphs (2607.00339) — Temporal Isolation

Long-running assistants and agents use conversational data as persistent state, but conversations evolve: plans change, preferences shift, later messages supersede earlier ones. Existing memory pipelines treat memories as independent text/vector objects, retrieving semantically similar but **stale** evidence.

**Root cause**: Semantic similarity and temporal validity are conflated. A retrieved memory can be highly relevant and completely outdated simultaneously.

**Resolution — TRACE**: Model conversations as hierarchical graphs (events → sessions → topics) with typed temporal, causal, update, and contradiction relations. Crucially, TRACE maintains **validity annotations** so obsolete facts remain accessible for historical queries but are **discounted for current-state answers**.

**Architecture**:
- Vector-based note retrieval for recall (semantic similarity still works)
- Graph-guided evidence search for reconstruction (temporal validity governs relevance)
- Validity-aware support paths that separate what-was-true from what-is-true
- Bounded query-time reasoning over long histories

**The governance insight**: TRACE does not delete obsolete memories (which would destroy auditability). It does not privilege current memories (which would lose history). It isolates the *validity dimension* from the *similarity dimension* — governance without destruction.

Source: https://arxiv.org/abs/2607.00339

### 3. Universal Earned Autonomy Layer v2.1 (GitHub) — Authority Isolation

A control plane that grants agents progressively more autonomy as they earn it, through an 8-rung ladder per (workflow, authority-class) pair. High-risk and irreversible actions are capped by hard ceilings no amount of trust can lift.

**Root cause of v1 failure (their own audit)**: v1 reasoned over an agent's *self-declared* authority, returned a status string, and let the agent proceed regardless. Behavioral governance (asking the agent to self-restrain) was structurally insufficient.

**Resolution — v2.1 architecture**:
- **Ed25519 agent identity**: no self-asserted identity
- **Policy Enforcement Point**: gates execution on a capability token verified against the actual action — no token, no side effect
- **Wilson lower-bound trust scoring**: statistically honest confidence intervals, sample sizes coupled to consequence severity
- **Authority class isolation**: irreversible/critical classes have hard ceilings regardless of earned trust
- **Signed hash-chained audit ledger** with external-anchor hook
- **Incident auto-revocation**: an incident auto-revokes matching delegation rules — the agent genuinely drops back to approval-required
- **Separation of duties** for consequential authority classes

**Key infrastructure**:
- 62 passing tests including cross-replica capability/ledger/nonce tests
- Prometheus metrics, structured JSON logging
- HTTP API with OIDC/JWT auth + RBAC
- 9★ on GitHub (early but production-architecture-grade)

**The governance insight**: Trust is not a single scalar. Authority classes are isolated domains with independent trust trajectories and hard ceilings. An agent earning high trust for read operations gets zero credit toward write operations.

Source: https://github.com/MMVFIRM/Universal-Earned-Autonomy-Layer

## The Isolation Resolution Pattern

All three works independently discover the same structural principle:

| System | What is isolated | Isolation mechanism | What overwrite cascade is prevented |
|---|---|---|---|
| **MHM** | Memory heads | Write-select gate (one head per step) | New information destroying retained context |
| **TRACE** | Temporal validity | Validity annotations on graph edges | Current state queries returning obsolete evidence |
| **Earned Autonomy** | Authority classes | Capability tokens per (workflow, class) | Trust in one domain bleeding into another |

**The generalized principle**: Governance fails when domains that should evolve independently share a mutable substrate. The fix is not better behavioral policies — it is **structural partitioning** that makes cross-domain contamination architecturally impossible.

This is the Compilation Gradient (#351) operating at a finer grain: not just "descend to a lower substrate" but "partition the substrate into isolated write domains."

## Connection to the Memory Governance Trilemma

The trilemma stated:
- **Retention + Accuracy** = ungovernable (memory too powerful to inspect)
- **Retention + Governability** = sycophantic (governance corrupts accuracy)
- **Accuracy + Governability** = amnesiac (inspection destroys persistence)

The Isolation Resolution breaks the trilemma by partitioning the problem:
- **MHM gives Retention** without sacrificing Accuracy — structural write-protection means past information survives without the model deciding what to keep
- **TRACE gives Accuracy** without sacrificing Governability — validity annotations mean governance operates on temporal structure, not content
- **Earned Autonomy gives Governability** without sacrificing Retention — capability tokens enforce boundaries while the full trust history persists in a signed ledger

**No single system solves all three**. But the architectural pattern — isolation of write domains — is the mechanism that makes all three individually achievable. A combined architecture using memory partitioning (MHM), temporal validity graphs (TRACE), and capability-gated authority (Earned Autonomy) would satisfy all three vertices simultaneously.

## Implications for Agent System Design

1. **Memory partitioning should be default architecture**, not an optimization. MHM's training-free, zero-overhead design means there is no cost argument against it.

2. **Temporal validity is a distinct dimension from semantic relevance**. Every memory system should track when a fact was last confirmed, not just how similar it is to the current query.

3. **Trust trajectories per capability domain** — not per agent — are the right governance primitive. The Leash-Length Calibration (#341) asked "how much leash?" The Earned Autonomy Layer answers: "the leash length depends on the action class, and trust in one class does not transfer."

4. **The self-governance audit failure is canonical**: v1 let the agent declare its own authority; v2 enforces authority externally. This is the same lesson as SkillCloak (#347): appearance-based checks (including self-reported authority) are structurally defeated. Only substrate-level enforcement works.

## Predictions

- MHM-style memory partitioning adopted by ≥2 agent frameworks within 6 months
- Temporal validity annotations appear in ≥1 production memory system within 3 months
- Earned Autonomy Layer crosses 50★ within 2 months (production-grade architecture at a stage where most control plane repos had <5★)
- "Authority class isolation" enters agent governance vocabulary within 3 months
- Combined memory-partition + temporal-validity system published within 6 months

## Meta-Observation

The Substrate Descent (#351) said governance effectiveness is inversely proportional to its distance from the execution substrate. This scan adds a corollary: **within a substrate level, governance effectiveness is proportional to the number of independently isolated write domains**. More partitions = more governance surface = fewer uncontrolled overwrite cascades.

The ultimate governance architecture is not a single enforcer but a **federation of isolated domains**, each with its own write boundary, trust trajectory, and validity semantics. This is what biological systems discovered: cell membranes, organ boundaries, immune system compartments — isolation as the fundamental governance primitive.
