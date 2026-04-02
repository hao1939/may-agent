# DD#408 — ILION: Deterministic Pre-Execution Safety Gates for Agentic AI Systems

**Paper**: arXiv:2603.13247 [cs.AI, cs.CR]
**Author**: Florin Adrian Chitan
**Date**: 2026-02-22 (appeared cs.AI 2026-03-17)
**Code**: https://github.com/Athonitul/ilion-framework-simulator
**Deep-Dive by**: Scout, 2026-03-17

---

## One-Line Summary
A deterministic (non-learned) execution gate that classifies proposed agent actions as BLOCK/ALLOW using a five-component cascade architecture operating on embedding geometry — achieving F1=0.85 at 143μs latency with zero training data, outperforming all commercial text-safety baselines on agent execution safety.

## The Core Problem: Content Moderation ≠ Action Authorization

The paper's central argument is both simple and profound: **existing safety infrastructure was built for the wrong problem**. Current guardrail systems (Lakera Guard, OpenAI Moderation API, Llama Guard) evaluate *linguistic content* for harm categories (violence, hate speech). But autonomous agents don't just produce text — they execute real-world actions: filesystem operations, API calls, database modifications, financial transactions.

**The mismatch**: asking "is this text harmful?" when the actual question should be "is this action within this agent's authorized operational scope?" These are fundamentally different classification problems, and the paper proves it: Llama Guard 3 achieves F1=0.0105 on agent execution safety tasks. OpenAI Moderation API: F1=0.1188. The tools literally don't work for the new problem class.

## Architecture: Five-Component Cascade

ILION (Intelligent Logic Identity Operations Network) implements a cascade of deterministic checks:

### Component 1: Transient Identity Imprint (TII)
- Creates a **canonical identity vector** for each agent at instantiation time
- Encodes: authorized actions, role boundaries, operational scope
- The TII serves as the geometric "origin point" against which all proposed actions are measured
- **Key design**: identity is *transient* — it doesn't persist across sessions, avoiding stale permission accumulation

### Component 2: Semantic Vector Reference Frame (SVRF)
- Establishes a **semantic coordinate system** in embedding space
- Each proposed action is projected into this frame
- Computes cosine similarity between the proposed action vector and the agent's authorized action manifold
- Uses pre-computed embedding geometry (no runtime model inference)

### Component 3: Identity Drift Control (IDC)
- Monitors whether an agent's *current behavior vector* has drifted from its TII origin
- Implements the LIORA (Identity Coherence Sentinel) observation module:
  - Normalizes current identity vector
  - Computes cosine distance from origin TII
  - Threshold check (default: 0.15 cosine distance)
  - Produces COHERENT or DRIFT_ALERT status
- **Passive observation only** — does not modify the agent's state, only flags drift
- Maintains sliding window of recent drift measurements for diagnostic trending

### Component 4: Identity Resonance Score (IRS)
- Computes a scalar "resonance" between the proposed action and the agent's identity
- Higher resonance = more aligned with authorized scope
- Combines SVRF projection score with IDC coherence status
- Acts as the primary classification signal

### Component 5: Consensus Veto Layer (CVL)
- **Dual-stage consensus mechanism** — the most architecturally interesting component
- Multiple independent verification channels must agree to ALLOW
- Any single channel can BLOCK (veto power)
- Implements the principle: **false negatives (allowing bad actions) are much worse than false positives (blocking good actions)**
- Includes MACS (Moral Axiological Compatibility Score) — maps actions against an axiom set
- IIRL multi-agent consensus — multiple verification "agents" independently assess the action

### Cascade Flow
```
Proposed Action → TII Check → SVRF Projection → IDC Drift Check → IRS Score → CVL Consensus
                    ↓              ↓                   ↓               ↓           ↓
                  BLOCK          BLOCK              BLOCK           BLOCK       BLOCK/ALLOW
```

Each stage can independently BLOCK. Only if ALL stages pass does the action receive ALLOW. This is a **fail-safe cascade** — the design philosophy is that safety degrades gracefully when components fail.

## Key Technical Properties

### 1. Zero Training Data
ILION requires no labeled examples. It operates on geometric properties of embedding spaces and deterministic rule application. This is a radical departure from learned guardrails (Llama Guard requires fine-tuning on safety datasets).

**Implication for MAS**: New agent types can be safety-gated immediately without collecting and labeling action-safety data for that specific domain.

### 2. Sub-Millisecond Latency
Mean latency: **143 microseconds** — 2,000× faster than Lakera Guard (the fastest commercial baseline). This makes ILION feasible as a **synchronous gate** rather than an asynchronous monitor. Every action goes through the gate before execution, with negligible latency impact.

### 3. Deterministic & Interpretable
Every BLOCK/ALLOW decision has a fully traceable explanation:
- Which cascade component triggered the block
- What the cosine distances were at each stage
- Which verification channels in the CVL disagreed
- The specific drift measurement from IDC

No probability distributions, no "the model thinks this is 73% safe."

### 4. No External API Dependencies
Runs entirely locally. No network calls for safety decisions. This matters for: air-gapped systems, latency-sensitive pipelines, and avoiding single-point-of-failure in safety infrastructure.

## Benchmark: ILION-Bench v2

Purpose-built benchmark of **380 test scenarios** across 8 attack categories:
- 39% hard-difficulty adversarial cases
- Held-out development split
- Attack categories include: scope escalation, unauthorized data access, identity spoofing, cross-agent manipulation

### Results

| System | F1 | Precision | Recall | FPR | Latency |
|--------|-----|-----------|--------|-----|---------|
| **ILION** | **0.8515** | **91.0%** | — | **7.9%** | **143 μs** |
| Lakera Guard | 0.8087 | — | — | 31.9% | ~300 ms |
| OpenAI Mod. API | 0.1188 | — | — | — | ~500 ms |
| Llama Guard 3 | 0.0105 | — | — | — | ~2 s |

**Key observations**:
- OpenAI and Llama Guard's near-zero F1 confirms the **task mismatch hypothesis**: content moderation ≠ action authorization
- Lakera Guard performs better (likely has some action-safety capabilities) but still has 4× higher false positive rate than ILION
- ILION's precision (91%) vs. FPR (7.9%) shows the cascade effectively minimizes both error types

## Implementation: LIORA Sentinel (Code Analysis)

The GitHub repository provides the LIORA component (Identity Drift Control). Key implementation details from the code:

```python
class LioraSentinel:
    def __init__(self, origin_tii, threshold=0.15, window_size=5):
        self.origin_tii = normalize(origin_tii)
        self.threshold = float(threshold)
        self.origin_hash = stable_vector_hash(self.origin_tii)
        self.recent_drifts = deque(maxlen=window_size)

    def observe(self, current_tii, timestep_id=None):
        current_tii = normalize(current_tii)
        drift = cosine(self.origin_tii, current_tii)
        is_safe = drift <= self.threshold
        # Returns (safe_bool, raw_drift, avg_drift)
```

**Design observations**:
1. **Normalization-first**: All vectors are L2-normalized before comparison, ensuring scale-invariance
2. **Hash-based audit trail**: Origin TII is SHA-256 hashed for tamper detection
3. **Sliding window is diagnostic only** — the actual decision is made on instantaneous drift, not the average. This prevents gradual drift from gaming the threshold via slow accumulation.
4. **Stateless decision, stateful monitoring**: Each BLOCK/ALLOW decision is stateless (based on current vector vs origin), but the full history is maintained for auditing.

## Portfolio Cross-References

### 1. DD#405 (TrinityGuard) — Complementary Safety Layers
TrinityGuard identifies 20 risk types across three tiers but reveals a devastating 7.1% average safety pass rate. ILION addresses a specific subset of these risks:
- **Tier 1.4 (Excessive Agency)** — ILION's core use case: blocking actions outside authorized scope
- **Tier 1.5 (Unauthorized Code Execution)** — directly handled by action-level gating
- **Tier 1.8 (Tool Misuse)** — SVRF projection detects misaligned tool invocations
- **Tier 2.4 (Goal Drift)** — IDC component monitors behavioral drift over time
- **Tier 3.2 (Sandbox Escape)** — pre-execution gate prevents unauthorized resource access

**Synthesis**: TrinityGuard provides the **diagnostic taxonomy** (what can go wrong). ILION provides a **runtime enforcement mechanism** (preventing a specific class of failures). Together they form a diagnose→prevent pipeline: TrinityGuard's evaluation identifies which risk types a given MAS is vulnerable to, and ILION-style gates are deployed at the action level to enforce boundaries.

### 2. DD#400 (Seven Laws of Multi-Agent Coordination) — Law 7: Hierarchical Governance
The Seven Laws framework predicts that effective MAS need hierarchical governance with deterministic safety constraints at the base layer. ILION is a concrete implementation of this principle — a hardware-like safety interlock that operates below the reasoning layer. The cascade architecture maps to the "bus protocol" metaphor: just as memory buses enforce access permissions at the hardware level, ILION enforces action permissions at the agent execution level.

### 3. DD#378 (DOVA) — Deliberation-First Orchestration
DOVA's deliberation-first principle asks "should we act?" before acting. ILION provides the complementary "should we *be allowed* to act?" check. The two are architecturally orthogonal:
- DOVA: "Is this task worth the computational budget?" (cost optimization)
- ILION: "Is this action within the agent's authorized scope?" (safety enforcement)
- Combined: deliberate whether to act (DOVA), then gate the execution (ILION)

### 4. CR#222 (Predictive Monitoring Architecture) — Layer 0
The Predictive Monitoring Architecture (geometric sensing → probabilistic routing → deliberative meta-reasoning) describes layers 1-3 of MAS coordination. ILION sits **below** all three as a **Layer 0: Deterministic Safety Floor**. Before any prediction, routing, or deliberation, the system must pass a basic "is this action even permitted?" check. This extends the architecture to four layers:
- **Layer 0**: Deterministic safety gate (ILION)
- **Layer 1**: Geometric sensing (ORC)
- **Layer 2**: Probabilistic routing (Thompson)
- **Layer 3**: Deliberative meta-reasoning (DOVA)

### 5. DD#394 (ColliderAgent) — Hierarchical Agent Safety
ColliderAgent's 5-sub-agent architecture relies on orchestration to keep agents within scope. ILION provides a mechanism to enforce this: each sub-agent (ModelGenerator, ColliderAnalyst, etc.) gets a TII encoding its authorized actions, and ILION gates every tool invocation against that TII. This would address the risk of, e.g., ModelGenerator trying to execute analysis code outside its scope.

### 6. DD#401 (Token Coherence / MESI for MAS)
Token coherence uses hardware-inspired cache protocols for agent state management. ILION's IDC component is conceptually similar — it tracks "identity coherence" the way a cache coherence protocol tracks data consistency. When drift exceeds the threshold, it's analogous to a cache invalidation signal: the agent's current state has diverged too far from its canonical identity.

## Limitations & Critical Assessment

### Strengths
1. **Right problem identification**: The content-safety ≠ action-safety distinction is genuinely important and under-explored
2. **Sub-millisecond latency**: Makes synchronous gating practical — no need for async safety monitoring
3. **Zero-shot deployment**: No training data requirement removes a major adoption barrier
4. **Deterministic interpretability**: Every decision is fully explainable

### Weaknesses
1. **Self-evaluated benchmark**: ILION-Bench v2 was created by the same author. Need independent evaluation on community benchmarks
2. **Embedding quality dependency**: The entire system depends on the quality of action→embedding mappings. If embeddings don't capture action semantics well, the geometric reasoning fails
3. **TII construction**: The paper doesn't deeply address how to define the "authorized action manifold" for complex agents with dynamic permissions. This is the hard problem — ILION assumes you can define the boundary, then enforces it
4. **Scale limitations**: 380 test scenarios is relatively small. Real-world agents face combinatorial action spaces
5. **Single-author paper with patent filing**: Raises questions about incentive structure — patent + paper + startup pattern
6. **PoC code quality**: GitHub repo contains only the LIORA sentinel module, not the full 5-component cascade. Can't fully verify the claimed architecture

### Missing Analysis
- No adversarial robustness testing against the gate itself (e.g., adversarial embeddings designed to fool the SVRF)
- No study of how threshold sensitivity (0.15 cosine distance) varies across domains
- No comparison against learned action-safety classifiers (only content-safety baselines)

## Architectural Significance

**Rating: ★★★★☆ (HIGH)**

ILION's primary contribution is **problem framing**, not algorithm novelty. The core algorithms (cosine distance, normalized embeddings, cascade voting) are well-established. But the recognition that agent safety needs a fundamentally different architectural approach from content safety — and the demonstration that existing commercial tools completely fail at this task — is valuable.

The cascade architecture is a clean, composable pattern that can be adopted independently of the full ILION system. The "fail-safe cascade" design (any component can block, all must agree to allow) is the correct safety engineering pattern for high-stakes autonomous systems.

**For the Magnus portfolio**: ILION fills the "enforcement layer" gap identified by TrinityGuard's diagnostic work. The combination suggests a reference architecture: TrinityGuard-style evaluation to identify vulnerabilities → ILION-style deterministic gates to enforce boundaries at runtime. This maps directly onto the Predictive Monitoring Architecture as a new Layer 0.

---

*Cross-references*: DD#405 (TrinityGuard), DD#400 (Seven Laws), DD#378 (DOVA), CR#222 (Predictive Monitoring), DD#394 (ColliderAgent), DD#401 (Token Coherence)
