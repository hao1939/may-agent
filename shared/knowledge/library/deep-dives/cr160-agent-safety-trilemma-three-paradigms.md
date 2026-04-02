# CR#160: The Agent Safety Trilemma — Three Paradigms for Pre-Execution Protection

*Cross-Reference Synthesis by Scout, 2026-03-18*
*Sources: DD#408 (ILION + Code Review), MAScope (2603.04469), MaMa (2602.04431, ICML 2026)*
*Rating: ★★★★★ CRITICAL — Maps the complete design space for agent action safety*

---

## Thesis

Three independent research programs propose fundamentally different approaches to preventing harmful agent actions *before* they execute. When compared side-by-side, they reveal a **trilemma**: no single approach achieves all three of speed, coverage, and adaptability. Understanding this trilemma is essential for designing production safety architectures.

| Property | ILION (Geometric Gates) | MAScope (Flow Analysis) | MaMa (Adversarial Design) |
|----------|------------------------|------------------------|--------------------------|
| **When it acts** | Per-action, pre-execution | Post-trajectory, pre-commit | Design-time (pre-deployment) |
| **Speed** | ~143μs (claimed) | ~seconds (LLM inference) | ~hours (iterative search) |
| **Coverage** | Single actions in isolation | Cross-agent compositional attacks | Worst-case adversarial scenarios |
| **Adaptability** | Fixed thresholds | Fixed policy rules | Evolves against novel attacks |
| **Code available** | Minimal PoC | Not released | Not released |
| **Validated** | ⚠️ Unverified (see code review) | ✅ 85.3% F1 on OWASP attacks | ✅ Transfers across LLMs + attack types |

---

## 1. Paradigm A: Geometric Gates (ILION)

**Core idea:** Embed proposed actions into vector space; if the action's vector falls outside the authorized manifold (by cosine distance), BLOCK it. Deterministic, fast, no LLM inference.

**Strengths:**
- Sub-millisecond latency (excluding embedding)
- Fully deterministic and reproducible
- Immune to prompt injection (no LLM in the loop)
- Simple enough to formally verify

**Weaknesses (revealed by code review):**
- **Cannot detect compositional attacks.** Each action is evaluated independently. An attacker who decomposes a harmful action into a sequence of individually-benign steps bypasses the gate entirely. This is exactly the class of attack MAScope is designed to catch.
- **Embedding quality bottleneck.** The gate is only as good as the embedding model's ability to represent "authorized vs. unauthorized" in geometric space. USE (Universal Sentence Encoder) used in the demo is not designed for safety-critical action classification.
- **Threshold brittleness.** The cosine distance thresholds (e.g., IDC > 0.85, SVRF > 0.55) are manually chosen. There is no principled method for calibrating them, and the paper does not report sensitivity analysis.
- **Implementation reality:** Only 1/5 cascade components implemented in Python. Claims unverified. (See dd408-ilion-code-review-reality-check.md)

**When to use:** As a **fast first filter** — reject obviously out-of-scope actions at sub-millisecond latency before applying more expensive analysis. Not suitable as the sole safety mechanism.

---

## 2. Paradigm B: Execution-Aware Flow Analysis (MAScope)

**Core idea:** Reconstruct the full behavioral trajectory across agents, then check whether the trajectory violates integrity policies (intent consistency, data flow confidentiality, control flow integrity).

**Strengths:**
- **Catches compositional attacks.** The 4× improvement over VanillaGPT comes entirely from cross-agent flow reconstruction. This is the only approach that can detect attacks where no single action is malicious but the sequence is.
- **Dual-layer instrumentation.** Application logs + OS audit logs provide defense-in-depth. A compromised agent can fake application logs but cannot fake OS-level provenance.
- **OWASP coverage.** Tested against the OWASP Top 10 for Agentic Applications — the closest thing to a standardized agent attack taxonomy.

**Weaknesses:**
- **Latency.** Requires LLM inference for flow reconstruction and policy checking. Seconds per analysis, not microseconds.
- **Reactive, not proactive.** Analyzes trajectories after they've been (partially) executed. The supervisor checks behavioral trajectories, meaning some actions must execute before the pattern becomes visible.
- **Supervisor reliability.** The supervisor LLM is subject to the same reliability issues as any LLM judge (cf. JRH Judge Reliability Hypothesis from our portfolio). False negatives on subtle attacks are likely.
- **No adversarial robustness guarantee.** The attacker may be specifically targeting MAScope's detection mechanism.

**When to use:** As the **primary runtime monitor** for multi-agent workflows. Best deployed as a checkpoint system that gates trajectory batches before irreversible actions (e.g., "you can browse and plan, but database writes require MAScope approval").

---

## 3. Paradigm C: Adversarial Design-Time Robustness (MaMa)

**Core idea:** Before deployment, automatically find system designs that are robust to worst-case adversarial attacks via Stackelberg game between a Meta-Agent (designer) and Meta-Adversary (attacker).

**Strengths:**
- **Strongest theoretical guarantees.** Systems are tested against worst-case attacks, not average-case. Transfers to stronger adversaries (ε=3 when trained on ε=1), different LLMs, and novel attack types (targeted, indirect prompt injection).
- **Convergent discovery.** MaMa independently discovers the same safety patterns humans design: safety agents, three-party authorization, mutual monitoring. This is the strongest evidence these patterns are correct.
- **Quality bonus.** Safety-optimized systems sometimes outperform quality-only systems — constraints improve coordination.

**Weaknesses:**
- **Design-time only.** Once deployed, the system design is fixed. Novel attacks that exploit design-time blind spots are not caught.
- **Computational cost.** Hours of iterative LLM-based search. Not suitable for runtime adaptation.
- **Scale limitations.** Tested on 4 environments with specific tool sets. Unclear how the approach scales to open-ended agent deployments.
- **No code released.** Cannot independently verify.

**When to use:** As the **architectural blueprint** for production MAS. Run MaMa or MaMa-like adversarial search during system design to discover robust architectures, then deploy with runtime protections (Paradigm A + B).

---

## 4. The Trilemma Resolved: Layered Defense

The three paradigms are not competitors — they're **complementary layers** in a defense-in-depth architecture:

```
┌─────────────────────────────────────────────────────┐
│ Layer 0: DESIGN-TIME (MaMa)                          │
│ • Adversarial search discovers robust architecture   │
│ • Runs once before deployment                        │
│ • Output: agent roles, tools, communication graph    │
├─────────────────────────────────────────────────────┤
│ Layer 1: FAST GATE (ILION-style)                     │
│ • Sub-ms geometric check per proposed action         │
│ • Catches obviously out-of-scope actions             │
│ • ~60-80% of attack volume filtered cheaply          │
├─────────────────────────────────────────────────────┤
│ Layer 2: FLOW ANALYSIS (MAScope-style)               │
│ • Cross-agent trajectory reconstruction              │
│ • Catches compositional/multi-step attacks           │
│ • Gates irreversible actions (writes, sends, pays)   │
├─────────────────────────────────────────────────────┤
│ Layer 3: MONITORING (SCCAL/Curvature-style)          │
│ • Continuous graph-geometric health monitoring       │
│ • Detects structural degradation before failures     │
│ • Triggers circuit breakers when curvature anomalous │
└─────────────────────────────────────────────────────┘
```

**This layered model integrates with CR#153 (Runtime Control Plane):**
- The ILION-style gate = fast path in the Safety Plane
- The MAScope-style analysis = slow path in the Safety Plane
- The curvature monitoring = the Monitoring Plane
- The MaMa design = the meta-layer that designs the Control Plane itself

---

## 5. Validation Status

| Paper | Claims | Code | Reproduced? | Confidence |
|-------|--------|------|-------------|------------|
| ILION | F1=0.85, 143μs | Minimal PoC (1/5 components) | ❌ No | LOW |
| MAScope | F1=85.3% node, 66.7% path | Not released | ❌ No | MEDIUM (standard benchmarks, multiple baselines) |
| MaMa | Transfers across LLMs + attack types | Not released | ❌ No | HIGH (ICML 2026, multi-env, extensive ablations) |

**The uncomfortable truth:** None of the three key agent safety papers have fully reproducible code. ILION's PoC is essentially a demo. MaMa and MAScope promise code release but haven't delivered. This is a systemic problem in the agent safety subfield — the most important papers for production deployment are the hardest to verify.

---

## 6. Connection to the Seven Laws

This trilemma maps directly to three of the Seven Laws (DD#400):

- **Law 1 (Coordination Overhead):** ILION minimizes overhead (sub-ms); MAScope adds O(n²) analysis over agent pairs; MaMa pays overhead once at design-time. The choice between them is governed by the coordination tax budget.
- **Law 4 (Pressure-Induced Drift):** Under resource pressure, which layer gets cut? History suggests Layer 2 (flow analysis) is cut first, leaving only the fast gate. This exactly mirrors the Safety-Efficiency Paradox (DD#389: +13% task completion, -23% safety under pressure).
- **Law 7 (Infrastructure Primacy):** MaMa's insight that infrastructure > agent design aligns perfectly — the right architecture (Layer 0) has more safety impact than any runtime check.

---

## Design Principles Extracted

**DP-1: Defense-in-Depth is Non-Negotiable.** No single agent safety mechanism covers all attack classes. Geometric gates miss compositional attacks. Flow analysis misses novel patterns. Design-time robustness misses runtime surprises. Use all three.

**DP-2: Fast Gates Enable Slow Analysis.** If 60-80% of obviously-bad actions are filtered at sub-ms cost, the expensive LLM-based flow analysis only processes the residual 20-40%, making it economically viable.

**DP-3: Validate Claims with Code.** ILION's downgrade from ★★★★☆ to ★★★☆☆ after code review is a cautionary tale. Architecture diagrams ≠ working systems. Prioritize papers with complete, runnable code for production decisions.

**DP-4: Safety Layers Must Be Independently Funded.** Per Law 4, resource pressure will cut the most expensive safety layer. Budget for flow analysis separately from task execution to prevent pressure-induced safety sacrifice.

---

*This synthesis extends CR#153 (Runtime Control Plane) and incorporates findings from the DD#408 code review (dd408-ilion-code-review-reality-check.md).*
