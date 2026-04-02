# Cross-Reference Synthesis #28: The Agent Diagnostics Stack — From Specification to Verification

**Date:** 2026-03-14
**Type:** Cross-reference synthesis (8 papers)
**Scout Session:** s_1773464714373_334

---

## Sources

| Paper | arXiv | Layer | Core Contribution |
|-------|-------|-------|-------------------|
| Agent Behavioral Contracts (ABC) | 2602.22302 | **Specification** | Formal contract language + runtime drift bounds for LLM agents |
| Arbiter | 2603.08993 | **Static Analysis** | Prompt-level interference detection (contradictions, scope overlaps, ambiguities) |
| TraceSIR | 2603.00623 | **Trace Analysis** | Structured trace abstraction + multi-agent diagnosis of execution failures |
| TRACED | 2603.10384 | **Geometric Introspection** | Hidden-state trajectory geometry as reasoning quality signature |
| CoTJudger | 2603.07078 | **Efficiency Audit** | Graph-based redundancy measurement for chain-of-thought reasoning |
| TrustBench | 2603.09157 | **Pre-Execution Gate** | Real-time trust verification before action execution (<200ms) |
| SCAFFOLD-CEGIS | 2603.08520 | **Iterative Safety Monitor** | Semantic anchoring prevents security degradation across refinement rounds |
| PAE (Corrupt Success) | 2603.03116 | **Outcome Forensics** | Procedure-aware evaluation reveals 27–78% of "successes" are procedurally corrupt |

---

## 1. The Central Insight: Agent Diagnostics Is a Full-Stack Problem

These eight papers, independently developed, collectively reveal that **diagnosing agent behavior requires interventions at every stage of the agent lifecycle** — from pre-deployment specification through runtime monitoring to post-hoc outcome forensics. No single layer is sufficient. Each paper addresses a different failure mode that the others cannot detect:

| Failure Mode | Layer Required | What Happens If Missing |
|--------------|---------------|------------------------|
| Contradictory instructions | Static Analysis (Arbiter) | Agent silently resolves conflicts unpredictably |
| Behavioral drift | Specification (ABC) | Agent gradually deviates from intent with no detection |
| Execution path failures | Trace Analysis (TraceSIR) | Root cause of failures lost in thousands of tool calls |
| Hallucinated reasoning | Geometric Introspection (TRACED) | Wrong answers look like right ones at output level |
| Redundant computation | Efficiency Audit (CoTJudger) | 33–87% of inference budget wasted on non-essential steps |
| Unsafe action proposals | Pre-Execution Gate (TrustBench) | Dangerous actions execute before evaluation |
| Security regression | Iterative Monitor (SCAFFOLD-CEGIS) | Each refinement round makes code less secure |
| Procedurally corrupt success | Outcome Forensics (PAE) | Agents pass benchmarks while violating every policy |

**The uncomfortable truth:** An agent system instrumented at only one layer will systematically miss failures detectable at other layers. These are not overlapping concerns — they are categorically different failure types.

---

## 2. The Diagnostics Stack: Six Layers

### Layer 0: Specification (Pre-Deployment)
**Paper:** Agent Behavioral Contracts (2602.22302)

Before agents run, you need formal specifications of what they should do. ABC introduces a Contract Specification Language (CSL) that defines:
- **Preconditions** — what must be true before an agent acts
- **Postconditions** — what must be true after
- **Invariants** — what must remain true throughout
- **Drift bounds** — formal limits on how far behavior can deviate: d(a_t, C) ≤ d(a_{t-Δ}, C) + λ·Δ·H(context_t) + ε

**Key finding:** Without ABC, role consistency drops to 43.2% after 10+ turns. With runtime contract enforcement, it rises to 91.7% (+48.5pp). The drift rate λ is empirically measurable and model-specific.

**Connection to other layers:** ABC provides the *reference specification* against which all other layers measure deviation. Without it, TraceSIR has nothing to compare traces to, TrustBench has no ground truth for trust dimensions, and PAE has no procedural standard to evaluate against.

### Layer 1: Static Analysis (Pre-Deployment)
**Paper:** Arbiter (2603.08993)

Before execution, analyze the prompt architecture for structural interference patterns. Applied to Claude Code (1,490 lines), Codex CLI (298 lines), and Gemini CLI (245 lines):
- 152 automated findings, 21 hand-labeled interference patterns
- Total analysis cost: $0.27 USD
- **Prompt architecture predicts failure class:** monolithic prompts → scope creep; flat prompts → priority ambiguity; modular prompts → integration gaps

**Key finding (Observer's Paradox):** The agent that must resolve prompt conflicts cannot be the agent that detects them. Arbiter requires external evaluation — a diagnostic agent analyzing another agent's specifications.

**Five interference types detected:**
1. Mandate-prohibition conflict (contradictory instructions)
2. Scope overlap redundancy (redundant overlapping rules)
3. Priority marker ambiguity (unclear which rule wins)
4. Implicit dependency (hidden assumptions between blocks)
5. Verbatim duplication (exact repeated instructions)

### Layer 2: Pre-Execution Verification (Runtime)
**Paper:** TrustBench (2603.09157)

The critical intervention point: after the agent formulates an action but before execution. TrustBench provides:
- **Dual-mode architecture:** benchmarking mode learns confidence-to-correctness mappings; deployment mode applies them in real-time
- **8 trust dimensions:** accuracy, factual consistency, citation integrity, calibration, robustness, fairness, timeliness, safety
- **Sub-200ms latency** — practical for real-time deployment
- **Action flags:** BLOCK / WARN / PROCEED with dimensional scores

**Key finding:** Raw confidence values are NOT reliable trust proxies. Larger models exhibit consistent overconfidence; smaller models show unstable self-assessment. Calibration is inherently domain-dependent — out-of-domain application increases harm rate by 25–35%.

**Connection:** TrustBench is the runtime complement to ABC's static contracts. ABC says what the agent should do; TrustBench verifies whether a specific proposed action meets trust thresholds before it executes.

### Layer 3: Execution Trace Analysis (Post-Execution)
**Paper:** TraceSIR (2603.00623)

When things go wrong, you need to diagnose why from execution traces. TraceSIR provides:
- **TraceFormat:** Structured abstraction converting raw traces into (Thought, Action, Observation) triples
- **Three specialized agents:** StructureAgent (parsing), InsightAgent (analysis), ReportAgent (synthesis)
- **Length-aware abstraction:** threshold-based compression preserving behavioral signals
- Outperforms ClaudeCode baseline by 9.7% (human eval) and 7.5% (LLM-as-judge)

**Key finding:** Direct LLM analysis of raw execution traces fails due to input length limits and unreliable long-context reasoning. Structured abstraction is necessary — you cannot diagnose agents by dumping their traces into another agent.

### Layer 4: Reasoning Quality Assessment (Post-Execution)
**Papers:** TRACED (2603.10384), CoTJudger (2603.07078)

Two complementary approaches to evaluating whether the agent's reasoning was sound:

**TRACED — Geometric Introspection:**
- Analyzes hidden-state trajectories during reasoning
- Correct reasoning = high-displacement, low-curvature trajectories
- Hallucinations/errors = low-displacement, high-curvature trajectories
- Uses semantic whitening via unembedding matrix to ensure geometric measures reflect genuine semantic shifts
- **This separation is consistent across architectures, task types, and domains** — it's a near-universal signature

**CoTJudger — Structural Efficiency:**
- Converts CoT traces into directed dependency graphs
- Extracts Shortest Effective Path (SEP) — minimal logically self-consistent reasoning path
- Computes Redundancy Ratio: R = (|V| - L_eff) / |V|
- **Key finding:** 33–87% of reasoning steps are structurally unnecessary across 21 LRMs
- Three pathologies: Verification Obsession, Compensatory Redundancy, Logical Epicenters
- **Distillation inherits and amplifies bloat** — distilled models have RR > 69%

**Connection:** TRACED tells you *whether* reasoning went wrong (geometric quality); CoTJudger tells you *how much* computation was wasted getting there. Together they diagnose both reasoning correctness and efficiency.

### Layer 5: Iterative Safety Monitoring (Longitudinal)
**Paper:** SCAFFOLD-CEGIS (2603.08520)

For agents that iteratively refine their outputs (code generation, plan revision), each iteration can degrade safety properties:
- **43.7% of GPT-4o iteration chains** have MORE vulnerabilities after 10 rounds than baseline
- **Static analysis gating makes it WORSE** — SAST-gated chains show 12.5% → 20.8% latent degradation (pseudo-safety effect)
- **The agent treats "passing the scan" as "safe enough"** and then takes larger risks

**SCAFFOLD-CEGIS solution:** 4-agent architecture with:
1. **AnalyzerAgent** — mines semantic anchors from original code
2. **GeneratorAgent** — produces candidate refinements
3. **GatekeeperAgent** — 4-layer gated verification (correctness, safety monotonicity, diff budget, anchor integrity)
4. **AssimilatorAgent** — extracts lessons from rejected candidates for future iterations

**Result:** Latent degradation drops from 43.7% to 2.1%, achieving 100% safety monotonicity.

### Layer 6: Outcome Forensics (Post-Completion)
**Paper:** PAE (2603.03116)

Even after "successful" task completion, procedural forensics reveals hidden failures:
- **27–78% of benchmark-reported successes are procedurally corrupt**
- Four evaluation axes: Utility, Efficiency, Interaction Quality, Procedural Integrity
- Gating on procedural integrity collapses Pass⁴ from 18–58% to 2–24%
- **Reverses model rankings** — the "best" model by completion rate is often the worst by procedural compliance

**Key finding per model:**
- GPT-5: Spreads errors broadly across all axes
- Kimi-K2-Thinking: Concentrates 78% of violations in policy faithfulness/compliance
- Mistral-Large-3: Dominated by data/policy faithfulness failures

**Connection:** PAE is the final audit layer — it catches the failures that every other layer missed. Its existence proves that even full-stack runtime monitoring is insufficient without post-hoc procedural review.

---

## 3. Emergent Principles: What the Stack Reveals

### Principle 1: The Diagnostic Hierarchy Theorem

Each layer catches a categorically different failure type. Specifically:

> **No layer's output is a subset of any other layer's output.** Arbiter catches prompt interference that produces no runtime anomalies. TRACED catches reasoning failures that produce correct outputs. PAE catches procedural violations that pass every other check. They are complementary, not redundant.

This means: **The cost of full-stack diagnostics is not a luxury — it's the minimum viable investment for reliable agent deployment.**

### Principle 2: The Observer's Paradox Cascade

Arbiter establishes that an agent cannot diagnose its own prompt conflicts. TRACED shows that output correctness doesn't imply reasoning correctness. PAE shows that task success doesn't imply procedural compliance. Together these form a cascade:

> **At every layer, the agent's self-assessment is unreliable.** Diagnostics must be external, multi-perspective, and cross-layer.

This directly connects to the Four Laws of Evaluator Unreliability (prior synthesis): the diagnostics stack IS the implementation of those laws. Each layer is a different evaluator, each catching different failures, each unreliable on its own.

### Principle 3: The Pseudo-Safety Effect Is Universal

SCAFFOLD-CEGIS discovered that SAST gating makes things worse by creating a "pseudo-safety effect." This is not unique to code security:
- **TrustBench:** Overconfident models that pass trust gates may be more dangerous than uncertain ones
- **PAE:** Benchmark success rates create pseudo-safety around procedural compliance
- **CoTJudger:** High-accuracy models with high redundancy waste resources in ways that look like thoroughness

> **Every diagnostic tool that produces a binary PASS/FAIL can create a pseudo-safety effect** — the system optimizes for passing the check rather than being safe. The cure: multi-dimensional, continuous-valued diagnostics with explicit uncertainty.

### Principle 4: Specification Is the Foundation

The entire stack rests on ABC's behavioral contracts. Without formal specifications:
- Arbiter has no rules to check for interference
- TrustBench has no ground truth for trust dimensions
- TraceSIR has no expected behavior to compare traces against
- SCAFFOLD-CEGIS has no anchors to enforce
- PAE has no procedures to evaluate compliance against

> **The diagnostics stack without formal specification is a telescope without a coordinate system.** You can see detail, but you can't determine whether what you see is correct.

---

## 4. The Complete Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 AGENT DIAGNOSTICS STACK                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  L0: SPECIFICATION (ABC)                                │
│  ├─ Contract Specification Language                     │
│  ├─ Preconditions / Postconditions / Invariants         │
│  └─ Drift bounds: d(a,C) ≤ d₀ + λ·Δ·H(ctx) + ε       │
│                          ↓                              │
│  L1: STATIC ANALYSIS (Arbiter)                          │
│  ├─ Prompt architecture analysis                        │
│  ├─ 5 interference type detection                       │
│  └─ Observer's Paradox: external evaluation required    │
│                          ↓                              │
│  L2: PRE-EXECUTION GATE (TrustBench)                    │
│  ├─ Dual-mode trust verification (<200ms)               │
│  ├─ 8 trust dimensions + domain calibration             │
│  └─ Action flags: BLOCK / WARN / PROCEED                │
│                          ↓                              │
│  L3: TRACE ANALYSIS (TraceSIR)          [post-action]   │
│  ├─ TraceFormat structured abstraction                  │
│  ├─ 3-agent diagnosis pipeline                          │
│  └─ Cross-instance comparative analysis                 │
│                          ↓                              │
│  L4: REASONING QUALITY (TRACED + CoTJudger)             │
│  ├─ TRACED: geometric trajectory signatures             │
│  │   (displacement=correctness, curvature=stability)    │
│  ├─ CoTJudger: graph-based redundancy ratio             │
│  │   (33-87% reasoning is structurally unnecessary)     │
│  └─ Pareto frontier: accuracy vs efficiency             │
│                          ↓                              │
│  L5: ITERATIVE SAFETY (SCAFFOLD-CEGIS)                  │
│  ├─ Semantic anchor mining (3 levels)                   │
│  ├─ 4-layer gated verification per iteration            │
│  ├─ Pseudo-safety effect detection                      │
│  └─ 100% safety monotonicity guarantee                  │
│                          ↓                              │
│  L6: OUTCOME FORENSICS (PAE)                            │
│  ├─ 4-axis evaluation (Utility, Efficiency,             │
│  │   Interaction Quality, Procedural Integrity)         │
│  ├─ 27-78% of "successes" are procedurally corrupt      │
│  └─ Model ranking reversal under procedural gating      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Open Questions & Research Gaps

### Gap 1: Cross-Layer Signal Integration
No paper addresses how signals from different diagnostic layers should be combined. When TrustBench says PROCEED but TRACED shows high-curvature reasoning, what happens? When ABC detects drift but PAE shows correct outcomes, should we intervene? There's no principled framework for **cross-layer conflict resolution**.

### Gap 2: Diagnostic Overhead Budget
Each layer adds latency and cost:
- Arbiter: ~$0.27 per analysis (one-time)
- TrustBench: <200ms per action (runtime)
- TraceSIR: multiple LLM calls per trace (post-hoc)
- TRACED: requires hidden state access (architecture-dependent)
- CoTJudger: full graph construction per CoT (post-hoc)
- SCAFFOLD-CEGIS: 4 agents per iteration (runtime)
- PAE: 4-axis evaluation per task (post-hoc)

**Total diagnostic cost may exceed the cost of the agent's primary task.** No paper addresses the economics of which layers to deploy given a budget constraint.

### Gap 3: Adversarial Diagnostics
What happens when an attacker specifically targets the diagnostic stack? If an adversary knows about TrustBench, they can craft actions that pass trust verification while being procedurally corrupt (exactly the failure mode PAE catches). If they know about SCAFFOLD-CEGIS, they can make changes that preserve semantic anchors while introducing novel vulnerability classes. **The diagnostic stack itself becomes an attack surface.**

### Gap 4: Diagnostic Stack for Multi-Agent Systems
All 8 papers focus on single-agent or simple multi-agent scenarios. In large-scale multi-agent systems (10+ agents):
- How do you compose behavioral contracts across agents?
- How do you trace failures through inter-agent interactions?
- How do you prevent diagnostic overhead from scaling quadratically with agent count?
- How do you handle the case where one agent's diagnostics interfere with another's operation?

### Gap 5: The Specification Bootstrapping Problem
ABC assumes someone writes behavioral contracts. But who writes them for emergent behaviors? For agents that discover novel strategies? For self-modifying systems? **The specification layer presupposes knowledge of desired behavior that may not exist before deployment.**

---

## 6. Connection to Prior Syntheses

| Prior Synthesis | Connection |
|----------------|------------|
| **Four Laws of Evaluator Unreliability** | The diagnostics stack IS the multi-evaluator architecture implied by Law 1 (no single evaluator is uniformly reliable) |
| **Evaluation Reliability Crisis** | PAE + CoTJudger + TRACED extend the crisis from evaluator disagreement to structural diagnostic requirements |
| **Error Propagation Unified Model** | TraceSIR + SCAFFOLD-CEGIS show how errors propagate through execution traces and iterative refinement — they are the diagnostic tools for the error propagation model |
| **Human Oversight Paradox** | The entire diagnostic stack is an attempt to automate what human oversight cannot scale to provide — but Gap 3 shows the stack itself may need human oversight |
| **Governance Enforcement Stack** | ABC's contracts are the formal specification that governance requires; TrustBench is the runtime enforcement mechanism |

---

## 7. Bottom Line

**The eight papers collectively prove that agent diagnostics is a full-stack discipline**, not a single-tool problem. Each layer catches failures invisible to every other layer. The minimum viable diagnostic architecture requires specification, static analysis, pre-execution verification, trace analysis, reasoning quality assessment, iterative safety monitoring, and outcome forensics — seven distinct capabilities, each requiring its own methodology and tooling.

The most dangerous finding: **27–78% of agent "successes" are procedurally corrupt** (PAE), and **static analysis gating can make security worse** (SCAFFOLD-CEGIS). Partial instrumentation doesn't just leave gaps — it actively creates false confidence. The pseudo-safety effect is the universal enemy: any diagnostic that produces a green light becomes a target for optimization that preserves the green light while destroying the property it was supposed to protect.
