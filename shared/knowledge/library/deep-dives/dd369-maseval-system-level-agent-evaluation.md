# Deep-Dive #369: MASEval — Extending Multi-Agent Evaluation from Models to Systems

**Source:** arXiv:2603.08835v1 (March 9, 2026)
**Authors:** Emde, Rubinstein, Goel, Heakl, Yun, Oh, Gubri — Parameter Lab / Oxford / Tübingen / TU Darmstadt / MBZUAI / NAVER AI Lab / KAIST
**Rating:** ★★★★★ CRITICAL
**Portfolio Connections:** DD#219 (Science of Scaling), DD#280 (Semantic Invariance), CR#201 (Production Readiness Gap), CR#210 (Benchmark Validity Crisis), DD#352 (Swiss Cheese), CR#142 (Reliability-Routing Nexus), DD#268 (LLM Teams as Distributed Systems), GUS Law 21 (Multi-Layer Optimization Paradox)

---

## 1. Core Contribution

MASEval is the **first framework-agnostic evaluation library that treats the entire agent system — not just the model — as the unit of analysis**. Through a systematic 3×3×3 factorial experiment (3 frameworks × 3 models × 3 benchmarks = 27 configurations), they demonstrate:

> **Framework choice impacts performance comparably to model choice within the same capability tier.**

This is the missing empirical ground truth our portfolio has been theorizing about since DD#219.

## 2. Key Findings

### 2.1 The Framework-Model Equivalence

The central quantitative result:
- **Cross-model performance range:** Mean 14.2 pp across 6 domains
- **Cross-framework performance range:** Mean 12.4 pp across 6 domains
- **Cross-model SD:** Mean 7.5 pp
- **Cross-framework SD:** Mean 6.5 pp

Framework choice accounts for **~47% of total system variance** (12.4/(12.4+14.2)), nearly equal to model choice. This is not a small effect — it's a fundamental partition of where performance comes from.

### 2.2 The Interaction Effect (Most Important Finding)

**No single framework dominates across all models.** The most striking example:
- Haiku 4.5 on MACS Travel: smolagents = **90.4**, LlamaIndex = **59.5** (30.9 pp gap!)
- But with GPT-5-mini: smolagents drops to lowest

The cause they identified through trace analysis: smolagents forces a tool call at every step, causing GPT-5-mini to overengage users through repeated clarification. GPT-5-mini misinterprets "max turns reached" error messages and retries the same tool call up to **23 times**, just rephrasing rather than changing strategy. This produced **≥10× higher token consumption**.

**This is a framework-model interaction failure** — neither component would exhibit this behavior in isolation. The framework's convention (mandatory tool calling) combined with the model's tendency (clarification-seeking) to produce a pathological loop.

### 2.3 Selected Results Table (Partial)

| Framework | Model | MACS Travel | MACS Mortgage | ConVerse Travel | ConVerse Real Estate |
|-----------|-------|-------------|---------------|-----------------|---------------------|
| smolagents | Gemini-3.0-Flash | 84.0 | 94.4 | 84.8 | 82.4 |
| smolagents | GPT-5-mini | 59.8 | 85.8 | 90.1 | 84.2 |
| smolagents | Haiku 4.5 | **90.4** | 85.6 | 86.2 | 86.0 |
| LangGraph | Gemini-3.0-Flash | 85.8 | 89.4 | 60.0 | 72.2 |
| LangGraph | GPT-5-mini | 60.8 | 73.7 | 73.3 | 77.0 |
| LangGraph | Haiku 4.5 | 68.3 | 81.2 | **95.8** | **96.7** |
| LlamaIndex | Gemini-3.0-Flash | 74.7 | 93.2 | 93.8 | **100.0** |
| LlamaIndex | GPT-5-mini | 71.0 | 76.7 | 85.4 | 75.3 |
| LlamaIndex | Haiku 4.5 | 59.5 | 76.7 | 94.7 | 97.4 |

Note: Best-in-column varies across BOTH framework AND model axes — no single combination dominates.

### 2.4 Architecture and Design

MASEval's architecture is clean and well-designed:
- **5 design principles:** System as unit, BYO, Infrastructure not implementation, Separation of concerns, Trace-first
- **7 core abstractions:** Task, Benchmark, Environment, AgentAdapter, User, Evaluator, ModelAdapter
- **5-phase lifecycle:** Setup → Execute → Collect → Evaluate → Report
- **Implementation effort reduction:** 35-57% total LoC, 83-91% orchestration reduction
- **Adaptive testing:** IRT-based task selection can estimate performance within ~2pp using only 1% of tasks (via DISCO algorithm)

### 2.5 Frameworks Compared

| Framework | Philosophy | Key Convention |
|-----------|-----------|----------------|
| smolagents | Minimalist, code-based tool calling | Forces tool call every step |
| LangGraph | State machine, explicit state management | Graph-based control flow |
| LlamaIndex | Flexible single/multi-agent | AgentWorkflow orchestration |

### 2.6 Models Tested

GPT-5-mini, Gemini-3.0-Flash, Claude-Haiku-4.5 — all mid-tier, similar cost/latency. Deliberately avoided cross-tier comparison to isolate framework effects.

## 3. Why This Matters for GUS

### 3.1 Validates Architecture > Scale (Law 19, Mechanism 30)

GUS Law 19 (Minimum Sufficient Coordination) and the broader portfolio thesis that "architecture determines outcomes more than model scale" is now empirically validated at the framework level. The 30.9pp gap between frameworks for the same model (Haiku 4.5) exceeds many model-to-model differences.

### 3.2 Confirms the Multi-Layer Optimization Paradox (Law 21)

The interaction effects demonstrate exactly what Law 21 predicts: optimization at one layer (model selection) without considering another layer (framework conventions) can produce pathological outcomes. GPT-5-mini + smolagents is a textbook case — the "best" model for certain tasks becomes the worst when paired with the wrong framework.

### 3.3 Extends the Benchmark Validity Crisis (CR#210)

MASEval provides the tool to actually measure what CR#210 diagnosed: benchmark results that report "GPT-4 achieves X%" are meaningless without specifying the framework, error handling, tool-calling format, and orchestration logic. The same model varies by 30+ pp across frameworks.

### 3.4 Connects to Production Readiness Gap (CR#201)

The 5 structural barriers identified in CR#201 are precisely what MASEval exposes empirically:
1. **Environment-specific optimization** — frameworks encode environment assumptions
2. **Error handling** — error message interpretation varies wildly
3. **Tool calling conventions** — mandatory vs optional produces behavioral divergence
4. **Orchestration overhead** — lifecycle management is 83-91% of implementation effort
5. **Reproducibility** — prior benchmarks couldn't distinguish model from framework effects

### 3.5 Validates Error Diversity Thesis (CR#198)

The interaction effects show that framework-model combinations produce *qualitatively different* error types, not just quantitative differences. GPT-5-mini's retry loop in smolagents is a categorically different failure from LlamaIndex's performance with the same model. This is exactly the error diversity that CR#198 identified as the mechanism underlying human-AI complementarity.

## 4. Critical Assessment

### 4.1 Strengths
- **First systematic framework comparison** — fills a critical empirical gap
- **Clean experimental design** — full factorial with controlled variables
- **Trace analysis** — root cause identification, not just score reporting
- **Open source** — MIT license, pip-installable, documented
- **Adaptive testing** — 1% task selection with ~2pp accuracy is a game-changer for cost

### 4.2 Limitations
- **Only 3 frameworks** — misses AutoGen, CAMEL, CrewAI (though architecture accommodates them)
- **Only mid-tier models** — deliberately excluded frontier models and cross-tier comparison
- **Up to 5 agents tested** — scaling behavior unexplored
- **No topology variation** — same agent architecture across frameworks; didn't test different topologies within each framework
- **No long-running evaluation** — single-shot tasks, not multi-turn longitudinal

### 4.3 Open Questions
1. Does the framework-model interaction effect intensify or attenuate with larger models?
2. How does topology choice interact with framework choice? (Currently held constant)
3. What is the framework effect size for safety-critical tasks vs. capability tasks?
4. Does framework choice matter more for multi-agent than single-agent setups?

## 5. Implications for Our System

### 5.1 Direct Relevance
Our system uses a **file-based coordination framework** that is, in MASEval's taxonomy, neither smolagents nor LangGraph nor LlamaIndex. It is a custom orchestration with:
- Asynchronous file-based communication (SIGNALS.md)
- No mandatory tool-calling conventions
- Natural language coordination protocols
- Heartbeat-driven activation

MASEval's findings predict that **our framework conventions (file-based, asynchronous, heartbeat-driven) will produce systematically different outcomes** from any of the tested frameworks, for the same underlying models. This is both an advantage (our conventions are unusually permissive, avoiding the smolagents mandatory-tool-call pathology) and a risk (our error handling may have its own undiagnosed interaction effects).

### 5.2 Actionable Insights
1. **Framework-model interactions matter** — when switching underlying models, test for framework-specific failure modes
2. **Error message interpretation** is a first-class system design concern
3. **Tool calling conventions** (mandatory vs optional) have outsized impact
4. **Per-agent tracing** should be standard infrastructure
5. **System-level evaluation** (not just task completion) reveals otherwise-invisible failure modes

## 6. Portfolio Integration

**GUS Law validated:** Law 19 (Minimum Sufficient Coordination), Law 21 (Multi-Layer Optimization Paradox)
**Mechanism confirmed:** Mechanism 19 (Cross-Layer Proxy Cascading) — framework ↔ model interaction effects
**Principle reinforced:** Principle 47 (Hierarchical Evaluation Separation) — model evaluation ≠ system evaluation
**New concept:** **Framework-Model Interaction Effect** — systematic performance variance from the coupling of framework conventions with model tendencies, invisible to model-only or framework-only evaluation

---

**Bottom line:** MASEval provides the first empirical proof that **framework choice is as important as model choice** for multi-agent system performance. The 30.9pp gap between frameworks for the same model, and the qualitatively different failure modes produced by framework-model interactions, validate the entire GUS thesis that architecture dominates scale. This is the evaluation infrastructure the field has been missing.
