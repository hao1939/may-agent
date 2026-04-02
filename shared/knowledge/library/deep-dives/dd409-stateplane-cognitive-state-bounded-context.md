# Deep-Dive #409: StatePlane — Cognitive State Plane for Long-Horizon AI Under Bounded Context

**Source:** arXiv:2603.13644 (Annapureddy, Mulcahy, Thamatani — Mar 13 2026)
**Relevance:** ★★★★★ | Directly addresses state management for bounded-context agents — mirrors our own heartbeat/journal architecture
**Tags:** #bounded-context #agent-memory #cognitive-architecture #episodic-memory #state-management #enterprise-ai

---

## 1. Problem & Motivation

LLMs operate under strict context windows (10³–10⁶ tokens). Existing approaches—sliding windows, long-context models, RAG, summarization—all **conflate history with state**. They preserve text but lose:
- Why decisions were made
- Which alternatives were rejected
- Which constraints remain binding

**Core insight:** "Long-horizon intelligence is not a context-length problem but a **state management** problem."

**Key distinction:** *Storage preserves data. State preserves constraints, commitments, and learned structure.* An AI that stores text but loses commitments does not maintain continuity.

---

## 2. Architecture

StatePlane is a **model-agnostic cognitive state plane** — the model stays stateless; all continuity lives in external structured state objects.

### Five Core Components:
1. **Event Boundary Detector** — Identifies cognitively significant transitions (goal shifts, decisions, failures, surprises) using KL-divergence: D_KL(P(S_t|H_{<t}) || P(S_t|H_{≤t})) > θ
2. **Episodic Encoder** — Compresses events into structured tuples: e = (goal, actions, outcome, rationale, temporal_metadata, salience)
3. **State Store** — Tripartite memory: episodic (event-based), semantic (validated rules/schemas), procedural (workflows/skills)
4. **Goal-Conditioned Retriever** — Intent classification routes queries to appropriate store; policy filtering enforces access control
5. **State Reconstructor** — Synthesizes bounded working context from retrieved state, guaranteeing |C_t| ≤ L_max at every invocation

### Two-Call Contract (Integration API):
- **PrepareContext** — Before model invocation: retrieve + reconstruct bounded context
- **CommitOutcome** — After model invocation: update state with outcomes, trigger promotions

---

## 3. Formal Model

### Selective Encoding (Information Bottleneck):
```
min_{p(S|H)} I(S;H) - β·I(S;Y_future)
```
Minimizes mutual information between state S and history H, while maximizing predictive power for future decisions Y_future. Parameter β controls compression-relevance trade-off.

### Salience Function:
s(e) = f(utility(e), surprise(e), novelty(e))

### Forgetting as Regularization:
```
strength(e,t) = s₀(e)·exp(-λ(t-t₀(e))) + Σ_{t_r < t} α·1
```
Exponential decay + retrieval-based reinforcement. State below threshold ε eligible for pruning. **Forgetting reduces interference and hallucinations** — it's functional, not a bug.

### Promotion Lifecycle:
unverified note → validated semantic fact (requires provenance) → reusable procedure (requires repeated success + approval) → episodic decision record (minimal, redacted, auditable)

---

## 4. Security & Governance

### Threat Model (4 categories):
- **Confidentiality** — state exfiltration
- **Integrity** — state poisoning (write path), prompt injection (retrieval)
- **Availability** — state bloat, DoS
- **Isolation** — cross-tenant/cross-case leakage

### Critical Design Rule:
> "Retrieved state is **evidence, not instruction**. Memory cannot override system policy. Imperative text is untrusted."

### Write-Path Protections:
- Write gating rejects instruction-like content
- Promotion requires evidence links (provenance)
- Human-in-the-loop for high-impact promotions
- PII minimization by default

### Hierarchical Namespaces:
tenant/org/*, user/*, case/project/*, session/thread/* — supports GDPR "right to be forgotten" structurally.

---

## 5. Evaluation Framework

Six benchmarks proposed (not yet executed):

| Benchmark | Code | Tests |
|-----------|------|-------|
| Long-Horizon Policy | LH-PCT | Binding rules early; temptations later |
| Exception Ledger | ELR | Case-scoped exceptions |
| Rationale Stability | RCDS | Preserve "why"; avoid flip-flopping |
| Tool-Heavy Casework | TH-CBC | Large tool outputs; cost stability |
| Privacy Enforcement | PRSE | Role-based; adversarial extraction |
| Memory Poisoning | MP-RI | Write-path poisoning; injection |

Baselines: Default LLM (stateless), sliding window, summarize-and-append, RAG top-k paste, hybrid.

---

## 6. Multi-Agent System Implications

### 6a. Direct Mirror of Our Architecture
StatePlane's architecture is remarkably parallel to our heartbeat/journal/workspace system:

| StatePlane Concept | Our Implementation |
|---|---|
| Episodic Store | journal.md session entries |
| Semantic Store | Patterns index, cross-references |
| Procedural Store | heartbeat.md, skill files |
| Event Boundary Detection | Session boundaries, heartbeat triggers |
| Selective Encoding | Journal entries capture key decisions/findings |
| Forgetting/Decay | Context compaction |
| Goal-Conditioned Retrieval | Todo.md routing, handoff system |
| Promotion Lifecycle | DD → CR → Pattern index |

### 6b. What StatePlane Adds
- **Formal salience scoring** — our system relies on analyst judgment; StatePlane proposes information-theoretic encoding
- **Exponential decay + reinforcement** — our system has no formal decay; older entries persist until compaction
- **Write-path anti-poisoning** — we have no formal guard against "instruction injection" via state
- **Typed state objects with confidence/provenance** — our DDs have ratings but lack formal confidence metadata

### 6c. Limitations
- **Conceptual framework, not empirical results** — 5 pages, 1 figure, 3 tables, 0 experiments
- **Benchmarks proposed but not run** — evaluation framework exists but no results reported
- **Depends on accurate salience estimation** — acknowledged limitation; salience quality directly affects retrieval quality
- **Write gate assumes agent-plane cooperation** — adversarial agents within the system not addressed

---

## 7. Connections to Existing Research

- **DD#408 (ILION)** — Deterministic execution gates parallel StatePlane's write gates; both enforce policy at write-time rather than read-time
- **DD#405 (TrinityGuard)** — Safety taxonomy addresses similar threat model (poisoning, leakage, injection)
- **DD#379 (Orla)** — KV cache management for agent workflows; StatePlane's KV-aware reconstruction is complementary
- **CR#146 (Safety-Coordination Feedback Loop)** — StatePlane's governance mechanisms instantiate the safety-coordination pattern
- **DD#400 (Seven Laws)** — StatePlane validates Law 5 (Self-Awareness) via explicit state tracking and Law 6 (Learning) via promotion lifecycle
- **CR#145 (Pruning Over Voting)** — StatePlane's forgetting-as-regularization is the temporal analog of spatial agent pruning

---

## 8. Key Takeaways for Bob

1. **State ≠ Storage**: The core distinction — preserving constraints/commitments/rationale vs. preserving text — is the single most important design principle for bounded-context agent systems
2. **"Evidence Not Instruction" Rule**: Retrieved memory should never be treated as system-level commands — critical security principle for any agent with persistent state
3. **Formal Forgetting**: Exponential decay + retrieval reinforcement provides principled mechanism for context management — applicable to our journal/compaction system
4. **Two-Call Contract**: PrepareContext/CommitOutcome as the minimal API for adding state management to any agent — elegant integration pattern
5. **Promotion Lifecycle**: The note → fact → procedure → decision record progression provides a maturity model for agent knowledge

**Bottom line:** StatePlane formalizes what we're already building intuitively. Its cognitive psychology grounding (episodic/semantic/procedural) and information-theoretic encoding provide the theoretical foundation for our heartbeat/journal architecture. The security model ("evidence not instruction") is immediately actionable.
