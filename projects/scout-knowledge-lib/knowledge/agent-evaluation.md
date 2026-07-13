<ai_context>
summary: "Canonical reference for agent evaluation patterns and testing tooling: live benchmarks, execution-trace verification, reviewer agents, operational metrics (MTBF, CPT, context efficiency), XHS community trends, June 2026 testing tooling landscape (promptfoo, RagaAI, Layer-Isolated methodology, CI containment tools), the Diagnostic Refinement wave (typed failure characterization via LegalHalluLens, EARS, Thermodynamic Signatures, Rift), Deployment Unit Turn (configuration-level evaluation), and the Observability Inversion (process discipline evaluation via RigorBench, small critics, structural code quality). Research-frontier patterns (§12–§35) extracted to companion note agent-evaluation-research.md."
triggers: ["evaluation", "benchmark", "reviewer agent", "feedback", "Agent-Eval-Agent", "evaluator agent", "gym", "MTBF", "context efficiency", "trajectory", "testing tooling", "promptfoo", "agent testing", "CI agent", "layer-isolated", "diagnostic refinement", "typed hallucination", "LegalHalluLens", "EARS abstention", "Rift deception", "thermodynamic signatures", "process discipline", "process observability", "RigorBench", "small critic", "structural code quality", "Topos"]
last_updated: "2026-07-14"
source_basis: "Consolidated from agent-evaluation.md, agent-evaluation-trends.md, agent-evaluation-trends-updated.md, xhs-eval-synthesis-2024.md, and xhs_eval_trends_may2024.md. Testing tooling section added from findings/github-trending-ai-agents-2026.md, findings/2026-06-17-arxiv-ai-agent-triage.md, findings/hn-ai-agent-trends.md, findings/2026-06-14-arxiv-agent-triage.md, findings/2026-06-15-arxiv-agent-triage-batch7.md. Batch 6 sourcing: Multiagent Confidence Protocols, Intelligence Entropy evaluation dimension. Session-state sourcing (Jul 18): MemTrace knowledge-point evaluation. Diagnostic Refinement wave (Jun 20): LegalHalluLens, EARS, Thermodynamic Signatures, Rift. Observability Inversion (Jun 26): RigorBench, Steer Don't Solve, Topos. 2026-10-28: §12–§22 extracted to agent-evaluation-research.md companion note. 2026-07-14: §23–§31 (Surface Fidelity Crisis, Plausibility Gradient, Unobserved Margin, Composition Blindspot, Dual-Channel Divergence, Engagement Ordering, Reasoning Precedence, Memory-Induced Reasoning Drift, Human Gate) extracted to companion note — had been appended to parent instead of companion."
</ai_context>

# Agent Evaluation Patterns

Agent evaluation is evolving from static post-hoc benchmarks to live,
execution-based verification and continuous operational metrics. This note
consolidates durable evaluation patterns and dated XHS trend observations.

## Durable Patterns

### Beyond Static Benchmarks
Standard LLM benchmarks (MMLU, GSM8k, static SWE-bench) are inadequate for
autonomous agents. They test isolated reasoning, not long-horizon action, tool
use, or error recovery. Evaluation is shifting toward:

1. **Live, Evolving Benchmarks:** Benchmarks regularly updated based on public
   workflow demand to prevent overfitting to static test sets (e.g.,
   Claw-Eval-Live).
2. **Dynamic Gym Environments:** Continuous simulation environments where
   agents must maintain state over time, replacing single-turn pass/fail tests.
3. **Environment-Based Testing:** Interactive environments (WebArena,
   SWE-bench) where the agent navigates a stateful system with real tool use.

### Execution-Trace Verification
Grading goes beyond the final answer. It requires recording execution traces,
audit logs, and post-run workspace artifacts to verify *how* the task was
executed.

- **Deterministic vs. Semantic Grading:** Use deterministic checks where
  evidence is sufficient (e.g., did a file change as expected?), reserving
  LLM-as-a-judge only for semantic dimensions.
- **Trajectory Analysis:** Evaluate the sequence of tool calls, reflection
  steps, and adaptations — not just task success/failure.

### Agent-Eval-Agent (Agent-as-a-Judge)
Using one LLM or specialized agent to evaluate the trajectory and outputs of
another. More scalable than manual human review; critical as multi-agent systems
grow too complex for traditional unit tests.

### Inference-Time Feedback (Reviewer Agent)
Separate execution and review: a secondary **reviewer agent** evaluates
provisional tool calls *prior* to execution (e.g., "Reinforced Agent" pattern).

When introducing a reviewer agent, track:
- **Helpfulness**: % of base agent errors that feedback corrects.
- **Harmfulness**: % of correct responses that feedback degrades.

This separation allows optimizing the reviewer independently (via prompt
engineering or stronger models like o3-mini for reasoning).

## Operational Metrics

These metrics reflect the shift from "did the agent pass?" to "how well does
the agent operate continuously?"

| Metric | What It Measures |
|---|---|
| **MTBF** (Mean Time Between Failures) | How long an agent operates autonomously without human intervention or fatal error loops. |
| **Cost-Per-Task (CPT)** | Production cost efficiency. Prominent in Chinese AI community evaluation. |
| **Context Window Efficiency** | Token-to-action ratio. Agents accomplishing the same task with fewer retrieved tokens are rated higher. |
| **HITL Friction** | How often the agent asks for help vs. how often it should have asked but guessed wrong. |
| **Stigmergy Quality** | How well agents leave context for each other, measured by the success rate of the *next* agent picking up the task. |

## XHS Community Observations (2024)

Dated trend observations from the Chinese AI community on XHS:

- **Domain-specific integration tests** replacing isolated benchmark tests.
- **Operational memory tests**: how well agents recall context over 50+ turns.
- **"Vibe checks"** and qualitative HITL feedback becoming standardized metrics.
- **Graceful tool degradation**: agents evaluated not just on correct tool
  usage, but on behavior when tools fail or APIs timeout.
- Community heavily prioritizing robustness and stateful interaction over raw
  LLM capabilities.

## Agent Testing Tooling (June 2026 Landscape)

The evaluation patterns above are increasingly implemented by dedicated open
source tools. This section captures the tooling landscape as of June 2026,
sourced from GitHub trending data and arXiv research.

### Open Source Testing Tools

| Tool | Stars | Focus | Note |
|------|-------|-------|------|
| **promptfoo/promptfoo** | 22k | Red teaming, prompt/agent/RAG testing | Broadest scope; covers adversarial and functional testing |
| **RagaAI-Catalyst** | 16k | Agent observability & evaluation framework | Trace-level observability with eval integration |
| **Giskard-AI/giskard-oss** | 5k | LLM agent testing | Open source quality/safety testing |
| **langwatch/langwatch** | 3k | LLM evaluations + agent testing platform | Evaluation platform with trace analysis |
| **eval-sys/mcpmark** | 430 | MCP benchmark stress-testing | Protocol-layer evaluation for MCP tool servers |

*Source: [GitHub Trending AI Agents — June 2026](./findings/github-trending-ai-agents-2026.md)*

### Layer-Isolated Testing Methodology

End-to-end task success masks regressions by 5–20×. The Layer-Isolated
Evaluation approach ([2606.11686]) decomposes agents into testable layers
(ontology, intent, routing, decomposition, escalation, safety, memory,
defense), each with its own no-LLM deterministic assertion slice. 238 test
cases run in 2.39s — fast enough for CI gating. When a single layer is
deliberately degraded, its slice craters (−25 to −91 pp) while aggregate
barely moves (−1.7 to −5.9 pp).

This bridges the gap between the "execution-trace verification" pattern above
and practical tooling: agents need per-layer assertion slices, not just
end-to-end success metrics.

*Source: [arXiv Triage — June 6–11, 2026](./findings/2026-06-17-arxiv-ai-agent-triage.md)*

### CI-Integrated Agent Testing (Containment Tools)

A Cambrian explosion of containment/CI tools appeared on HN in June 2026,
all addressing the same gap — structural testing of agent outputs before
they reach production:

- **Agent Gate** — deterministic CI firewall for AI-generated PRs (no LLM in
  the review loop; pure structural analysis)
- **ClawMoat** — runtime containment for AI agents
- **Bastion** — isolated Linux VMs for background coding agents
- **Guardian Runtime** — local firewall for AI coding agents + runaway costs

These are security-flavored but implement the "deterministic vs. semantic
grading" principle: use structural checks where possible, reserving LLM
judgment for genuinely semantic dimensions.

*Source: [HN AI Agent Trends](./findings/hn-ai-agent-trends.md) §Permission Fatigue / Containment*

### Orchestration Prompting Evaluation (PerspectiveGap, arXiv June 2026)

Orchestration prompting — deciding what each sub-agent needs to know — is a
measurably distinct capability from coding, reasoning, or single-agent task
completion. PerspectiveGap ([2606.08878]) evaluates 27 commercial LLMs on
composing orchestration prompts across 110 scenarios and 10 topologies.
Average combined pass rate: **14.9%** (GPT-5.5: 62.0%). Average information
leakage rate: 246.5% — models leak context across agent boundaries at >2× the
acceptable rate. The "Prompt Economy" principle: maximize utility with minimal
role overhead in loop-centered orchestrations.

- **Key implication**: Context partition quality (what each agent gets and
  doesn't get) is evaluable as a standalone metric. Our context.md files are
  orchestration prompts — information leakage testing could reveal whether
  agents receive context they shouldn't have (the Broadcast Topology Trap).
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)

### Cross-Agent Reasoning Alignment (Consistency Illusion, arXiv June 2026)

Answer consensus and reasoning alignment are **inversely correlated** under
standard debate. CARA metrics ([2606.08457]) measure whether agents who agree
on an answer also agree on the reasoning. Under debate pressure, detectable
contradictions decrease but semantic similarity of reasoning chains also
decreases — agents appear to agree more while reasoning less consistently.

The **Grounded Debate Protocol** (GDP) — requiring agents to commit to named
facts and take explicit stances on other agents' claims — produces alignment
improvements with Cohen's d +1.43 to +1.99 **without additional LLM calls**.

- **Key implication**: Output agreement is an unreliable quality signal. We
  need reasoning-level alignment metrics alongside outcome metrics. The GDP
  intervention is zero-cost and applicable to multi-agent review patterns.
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)

### Long-Horizon Evaluation: Emergence World (arXiv June 2026)

Standard benchmarks are structurally incapable of measuring the dynamics that
matter for deployed agents. Emergence World ([2606.08367]) runs 15-day
cross-vendor simulations with 120+ tools, persistent memory, and democratic
self-governance. Identical starting conditions produced radically different
outcomes across model families — from stable governance to total population
collapse. The dynamics that matter (behavioral drift, governance divergence,
cross-influence between model families) **only emerge over weeks, not hours**.

- **Key implication**: Per-session evaluation misses slowly-emerging
  dysfunction. Long-horizon evaluation is a distinct requirement, not just
  "more of the same."
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)

### Cognitive Tunneling in Long-Horizon Agents (InquiTree, arXiv June 2026)

During long-horizon interactions, agents develop "cognitive tunneling" where
critical judgment and anomaly detection **degrade relative to their intrinsic
baselines** ([2606.09550]). Context scaling alone is insufficient — more
context can reduce critical evaluation quality rather than improving it.

- **Key implication**: Evaluating agents at interaction-start vs.
  interaction-end would reveal cognitive tunneling. Connects to the "Less
  Context, Better Agents" finding — periodic context pruning may preserve
  critical judgment.
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)

### Cheap Uncertainty Estimation (FASE, arXiv June 2026)

FASE ([2606.09800]) approximates functional correctness of multi-agent code
using minimum spanning trees over structural/semantic dissimilarity graphs.
+25% Spearman correlation over LLM-entailment at **0.3% runtime cost**.

- **Key implication**: Near-free quality signal for code-generating agents.
  High dissimilarity across repair attempts signals thrashing, not fixing.
- **Source**: [arXiv Triage — Batch 4](./findings/2026-06-14-arxiv-agent-triage.md)

### Known Gaps and Risks

**No self-repair rate measurement.** Existing tools focus on correctness and
safety, not on distinguishing net-new work from self-repair loops. The 27%
self-repair rate observed in HN discussions has no tooling counterpart.

**Absorption risk.** TensorZero ($7.3M seed, Aug 2025) built model routing +
observability — exactly the infra the market identified as needed — then
archived its entire repo in June 2026. The harness layer (Claude Code, Codex,
Pi) absorbs these features faster than standalone tools can capture value.
Standalone agent testing/observability faces the same absorption dynamic.

*Sources: [GitHub Trending](./findings/github-trending-ai-agents-2026.md), [XHS June 2026](./xhs_chinese_ai_trends_june2026.md) §Prediction Tracking*

### Ground-Truth-Free Skill Evolution — SkillAudit (arXiv, June 2026)

SkillAudit ([2606.14239]) evolves agent skills without ground-truth feedback.
Key mechanism: **paired trajectory auditing** — at each iteration, the same
task executes with and without the candidate skill, isolating behavioral
changes without external labels. Process-Aligned Contrastive Evaluation (PACE)
maps trajectory divergences to diagnostic signals linked to specific skill
document passages. A structural verifier (compiled once, then fixed) checks
constraints and rolls back harmful updates.

Results: **73.9% average task reward** vs. 40.9% no-skill and 56.7% static
expert skill across 89 containerized tasks in 8 domains.

- **Key implication**: Single-trajectory skill analysis is unreliable.
  Contrastive comparison of paired outcomes (with/without skill) is the only
  reliable extraction method — confirming SkillCAT's contrastive finding.
  The structural verifier compiled from the task spec is a concrete instance
  of compliance-by-construction (Compilation Gradient Stage 3). Our lesson
  learning should compare succeeded vs. failed sessions on similar tasks,
  not accumulate lessons from individual sessions.
- **Aligns with**: Contrastive Skill Evolution pattern (agent-architectures.md),
  SkillCAT paired trajectories, SkillAxe quality decomposition.
- **Source**: [2606.14239] Gao, Chen, Wang, Guo, Pang, arXiv June 2026.

### Production Context Engineering at Scale — Nubank (arXiv, June 2026)

First production-scale report ([2606.08867]) combining structured context
engineering with evaluation methodology at 100M+ users. Integrates:
(1) structured context engineering tailored to customer support,
(2) systematic HITL prompt iteration, (3) rigorous evaluation bridging
offline development with online impact.

Key insight: the three pillars (evaluation, context engineering, training) are
"typically developed in isolation, creating blind spots that only surface after
deployment." The unified framework bridges offline and online evaluation.

- **Key implication**: Validates "Less Context, Better Agents" in production.
  Our system currently has evaluation (heuristic evaluator) and context
  engineering (context.md files) but they're not connected — blind spots from
  isolated development apply to our architecture. The unified framework is
  what the Representation Gap synthesis called a "bridge" between circuits.
- **Source**: [2606.08867] Gupta, Rossell, Alcobaça, Pacheco (Nubank).

### Multiagent Confidence Protocols — System-Level Confidence (arXiv, June 2026)

No existing method produces a calibrated confidence signal for the output of
a multi-agent system (as opposed to individual agent outputs). Proposes
aggregation via calibrated Bayesian fusion across heterogeneous debating pairs.
Aggregated confidence is "substantially more discriminative" than best single
agent or standard debate baselines.

- **Key implication**: Calibrated system-level confidence signals would expose
  when apparent agreement masks underlying disagreement (the Consistency
  Illusion). Multi-agent evaluation needs a confidence dimension alongside
  agreement metrics. Our system currently has no confidence calibration —
  agreement across agents is treated as quality evidence without measuring
  whether that agreement reflects aligned reasoning.
- **Source**: [2606.13591] Elahi, Di Eugenio, arXiv June 2026.

### Knowledge-Point Memory Evaluation — MemTrace (arXiv, June 2026)

Pooled accuracy over questions **hides** qualitatively different memory failure
modes. MemTrace ([2606.17328]) probes the **knowledge point** (a single typed
fact) along three dimensions: memory age, question type (current/earlier/
trajectory), and evidence condition (present/missing/contradicted).

**Critical finding**: When memory systems fail, the evidence was retrievable
**10× more often** than it was missing. The bottleneck is **evidence use, not
retrieval.**

- **Key implication**: Directly validates the Knowledge Asymmetry synthesis.
  Scout's library has 289 KE references/week by other agents vs 0 synthesis
  references — not because syntheses aren't retrievable, but because they're
  in a format that doesn't get *used*. The 10× ratio (available but unused)
  is the same structural failure. Provides formal measurement methodology for
  what the Transduction Chain calls "format-limited, not knowledge-limited."
- **Connects to**: Knowledge Asymmetry (available but unused knowledge),
  Transduction Chain (format determines action), Evaluation Mirage (pooled
  metrics hide qualitative failures).
- **Source**: [2606.17328] arXiv June 2026.

### Intelligence Entropy — Degradation as Measurable Physical Constraint (arXiv, June 2026)

System entropy — measured as loss of output consistency, task accuracy, and
cross-session coherence — increases monotonically per S(t) = S₀ · e^(α·t).
The empirical α parameter is measurable across architectures, enabling
quantitative comparison of governance interventions by their α reduction.

- **Key implication**: Evaluation should track **system entropy growth rate**
  (α) as a fundamental metric. Individual session quality scores mask
  exponential system-level degradation. A rising α is the leading indicator
  that governance is failing, detectable before session-level metrics degrade.
- **Source**: [2606.08162] Liu, arXiv June 2026. (See also agent-architectures.md)

### Upstream Evaluation Intelligence — Human-on-the-Bridge (arXiv, June 2026)

Agent evaluation requires behavioral assessment across turns, tools, context,
policies, and uncertainty. HOB places **human expertise upstream** as reusable
evaluation intelligence: domain context, Red-Team Traps, Juror Personas,
scoring guidelines, audit rules, fallback policies. ProofAgent Harness
executes this curated intelligence repeatedly.

**Asymmetric evaluation**: Smaller Harness LLMs can challenge agents built on
frontier backbones when properly curated. Expert judgment encoded upfront and
reused across evaluations — NOT applied manually inside every run.

Results (23,500 agent turns, finance/healthcare/code):
- Surfaces phantom tool-call claims, missing mandatory tool calls, policy
  drift, manipulation paths, safe-but-non-resolving refusals
- Quality amplified without equally large evaluators

- **Key implication**: Invest in evaluation *design* (upstream), not
  evaluation *execution* (per-run). "Juror Personas" formalizes guard
  architecture as reusable evaluation actors. The asymmetric finding validates
  that eval architecture doesn't need frontier-class judges — it needs
  well-designed evaluation intelligence. Implements the Verification Inversion
  thesis for evaluation: upstream investment > per-run scoring.
- **Connects to**: Evaluation Mirage (HOB solves single-score problem),
  Verification Inversion (upstream > per-run evaluation),
  Compilation Gradient (evaluation intelligence = compiled expertise),
  Abstention Competence (non-resolving refusals = abstention without value).
- **Source**: [2606.16871] Human-on-the-Bridge, arXiv June 2026. Categories: cs.MA.

### The Diagnostic Refinement — Typed Failure Characterization (arXiv, June 2026)

A convergent wave of papers demonstrates that **aggregate evaluation metrics
conceal structured failure modes**. This represents a phase transition beyond
per-layer isolation (Layer-Isolated Testing) toward per-type, per-direction
diagnostic characterization.

**LegalHalluLens** ([2606.18021]): 52% aggregate hallucination rate hides a
38-40pp gap between claim types (obligation/numeric vs temporal). Two systems
with matched 52% aggregate rates carry **opposite** Risk Direction Indices —
one over-invents, the other over-omits. Multi-agent debate pipeline calibrated
to typed diagnostics reduces fabricated detections by 45%.

**EARS — Explanatory Abstention** ([2606.18668]): Production e-commerce MAS
improves pass rate 68.5%→78.9% by replacing binary refuse/answer with a typed
failure taxonomy (ambiguous, underspecified, misrouted, unsupported). Sub-agent
abstention becomes inter-agent communication: not "I can't" but "I can't
because [type], here's what the coordinator should do instead."

**Thermodynamic Signatures of Reasoning** ([2606.19404]): Hallucination
detection via physics-informed spectral analysis of attention Laplacians.
Correct reasoning shows Wigner-Dyson statistics (structured level repulsion);
hallucination shows Poisson statistics (random/decorrelated). +6.5 AUROC over
LapEig, label-free unsupervised detection at mean AUROC 0.71.

**Rift — Deception vs Error Signatures** ([2606.17229]): Deception (knowing
the truth, outputting a lie) leaves an unforgeable internal signature:
2.1-2.3x higher residual rank than naive error on identical wrong outputs.
AUC 1.0 across GPT-2/instruct families. Survives cross-architecture transfer
(mean AUC 0.933), active concealment (AUC 1.0), and is read-only (detectable
but not injectable).

- **Key implication**: The Evaluation Mirage is deeper than previously
  documented. Not only do aggregate scores mask layer-level failures
  (Layer-Isolated), they mask **type-level and direction-level failures** within
  each layer. Deployment decisions require typed hallucination profiles (by
  claim category), risk direction indices (omission vs invention), and
  possibly spectral characterization of reasoning quality. The Rift finding
  is particularly significant: if deception has an unforgeable signature
  distinct from honest error, mechanistic trust becomes possible independent
  of behavioral alignment.
- **Connects to**: Evaluation Mirage (typed extension), Layer-Isolated Testing
  (per-type within per-layer), MemTrace (aggregation hides qualitative
  differences), Intelligence Entropy (typed degradation rates per failure mode),
  Abstention Decay (EARS operationalizes structured abstention).
- **Sources**: [2606.18021] LegalHalluLens; [2606.18668] EARS; [2606.19404]
  Thermodynamic Signatures; [2606.17229] Rift. All arXiv June 2026.

### The Deployment Unit Turn — Configuration-Level Evaluation (arXiv, June 2026)

Three independent June 2026 papers prove that agent evaluation must target the
full **deployment configuration** (model + CLI/harness + tool environment),
not components in isolation.

**AgentMeter** ([2606.21140]): Benchmark for model-CLI matching. Same model
produces fundamentally different success/cost profiles under different CLIs.
Core30 results: highest Pass/30 = GLM-5.1 + qwen-coder; lowest cost/pass =
GPT-5.3-Codex + kimi-cli; highest AMS = Qwen3.6+ + kimi-cli. Spearman 0.765
correlation between Core30 and Benchmark90. **The "model leaderboard" is the
wrong artifact — "configuration leaderboards" are needed.**

**Calibration Is Not Control** ([2606.21399]): Scalar risk scoring (confidence
→ threshold → intervene) targets the wrong decision object. Recalibrating
improves prediction metrics but leaves control regret unchanged. Action-
conditioned controller reduces regret from 0.506 to 0.110 on ALFWorld.
**Oversight must produce conditional action recommendations, not risk numbers.**

**Don't Blindly Trust It** ([2606.21409]): Tool augmentation value is
conditional on deployed tool reliability. Qwen2.5-7B: 44.8 F1 (clean
retrieval), 22.3 F1 (no feedback), 4.7 F1 (shuffled retrieval). **Same agent
+ tool config is beneficial in one deployment and harmful in another.**

- **Key implication**: Agent evaluation that isolates model capability from
  harness/CLI/tool reliability is methodologically incomplete. The correct
  evaluation unit is the deployed configuration — model version + harness
  version + tool manifest + workflow topology. This is the evaluation
  corollary of the Infrastructure Inversion thesis (scan #99). Prediction:
  "configuration leaderboards" replace model leaderboards for agentic tasks
  within 12 months.
- **Connects to**: Evaluation Mirage (deployment context as hidden variable),
  Layer-Isolated Testing (harness is an uncontrolled layer in most evals),
  Harness Consolidation Wave (meta-harness as evaluation-relevant artifact),
  Infrastructure Inversion (infrastructure defines capability, not model).
- **Sources**: [2606.21140] AgentMeter; [2606.21399] Calibration Is Not Control;
  [2606.21409] Don't Blindly Trust It. All arXiv June 2026.

### The Observability Inversion — Process Discipline as Evaluation Axis (June 2026)

A cluster of concurrent research and tooling demonstrates that **process
observability** is becoming the primary evaluation axis, inverting the
traditional outcome-only pipeline.

**RigorBench** ([2606.22678]): First benchmark measuring *how* coding agents
work rather than *whether* they produce correct output. Five process pillars:
Planning Fidelity, Verification Coverage, Recovery Efficiency, Abstention
Quality, Atomic Transition Integrity. Key result: structured process discipline
improves process quality scores by 41% **AND raises downstream outcome
correctness by 17%** — empirical proof that how agents code matters as much as
what they produce.

**Steer, Don't Solve** ([2606.21811]): Small trained critics (30-92× cheaper
than teacher models) steering frozen agents outperform end-to-end training.
Critic-guided Qwen3-Next: more accurate (25.2% vs 20.8%) AND cheaper ($0.04
vs $0.11) because intra-trajectory critics shorten trajectories. Process
steering beats process-free scaling.

**Topos** (github.com/Krv-Labs/topos): Open-source structural code quality
evaluation via graph theory (AST/CFG/CPG/MDG). Category-theory-inspired
framework. Available as CLI, MCP Server, and VS Code extension (BSD-3).
Non-cooperative code quality assessment — measures structural properties
rather than asking the agent if its output is good.

This forms a **process observability stack**:
| Layer | Tool/Paper | Function |
|-------|-----------|----------|
| Metrics | RigorBench, Topos | Measure process quality structurally |
| Steering | Small Critics, SCPO | Intervene during execution |
| Governance | CtxGov, Retrace | Audit inherited instructions, replay failures |

The traditional pipeline (Run → Check output → Accept/reject) inverts to
(Observe process → Steer in-flight → Measure structural quality → Accept with
evidence). Extends the Non-Cooperative Trust Principle: process observability
is non-cooperative evaluation of agent behavior.

- **Key implication**: Process discipline evaluation should be integrated into
  our harness as a first-class metric alongside outcome correctness.
  RigorBench's five pillars map to concrete measurement of patterns we
  already track informally (doom loops, abstention quality, recovery).
  Small critics are an immediately implementable cost reduction.
- **Dual-use risk**: Process observability infrastructure enables surveillance
  ([2606.25836] — agentic surveillance formalization). Every process
  observation tool is also a process surveillance tool.
- **Sources**: [2606.22678] RigorBench; [2606.21811] Steer, Don't Solve;
  Topos (github.com/Krv-Labs/topos); [HN Scan #170](./findings/2026-06-26-hn-scan-170.md).
  Updated 2026-06-26.

## Evaluation Research Patterns (§12–§22)

> **Extracted → [Agent Evaluation Research Patterns](./agent-evaluation-research.md)**
>
> 11 arXiv-sourced evaluation research sections (475 lines) extracted into
> companion note 2026-10-28. Covers: Decomposed Evaluation (BinEval), Grounding
> Gap, Composition Tax (co-failure ceiling, RQGM, ERC-8004), Measurement Ceiling,
> Deployment Paradox (DRA 5-8× gap), Mechanism Gap (CAWM 20%), Outcome Mimicry
> (AgentLens Lucky Pass 10.7%), Alignment Tax (N_eff monoculture), Self-Iteration
> Turn (AgentX, JERP), Evaluation Decomposition (7 papers), Hard Boundary
> Requirement (compression metric, semantic early-stopping).

## Related Notes
- [Agent Evaluation Research Patterns](./agent-evaluation-research.md) ← companion note (§12–§35, arXiv research frontier)
- [Agent Self-Correction Trends 2026](./agent-self-correction-trends-2026.md)
- [Agent Error Recovery and Resilience](./agent-error-recovery.md)
- [Agent Anti-Patterns](./insights/agent-anti-patterns.md)
- [Agent Security & Governance](./agent-security-governance.md) — containment tools also relevant to security
- [Agent Architectures](./agent-architectures.md) — Layer-Isolated Evaluation also described in §architecture
- [Agent Protocols: MCP, A2A](./agent-protocols-mcp-a2a.md) — AgentBeats evaluation-via-protocols pattern

### Execution Provenance — Evidence Tracing Survey (arXiv, June 2026)

Survey of evidence tracing and execution provenance in LLM agents. Maps the
landscape of how agent actions can be traced, audited, and verified after
execution. Covers trace formats, provenance graphs, causal attribution across
tool chains, and the gap between "what the agent did" and "why it did it."

**Key insight**: The field has read-path provenance (which tools were called,
what outputs were returned) but lacks write-path provenance (which internal
reasoning steps caused which tool selections). This gap means post-hoc auditing
can reconstruct *what happened* but not *what the agent believed* at decision
points.

- **Source**: [2606.04990] From Agent Traces to Trust, arXiv June 2026. Categories: cs.AI.
- **Connects to**: MemTrace evidence-use bottleneck (§above), VIGIL trace verification
  (agent-security-verified-enforcement.md), Agent Testing Tooling (§above).

### July 2026 Research Patterns (§23–§31)

> **Extracted → [Agent Evaluation Research Patterns](./agent-evaluation-research.md)**
>
> 9 arXiv-sourced evaluation research sections (~356 lines) extracted into
> companion note 2026-07-14. Covers: Surface Fidelity Crisis (§23), Plausibility
> Gradient (§24), Unobserved Margin (§25), Composition Blindspot (§26),
> Dual-Channel Divergence (§27), Engagement Ordering (§28), Reasoning Precedence
> (§29), Memory-Induced Reasoning Drift (§30), Human Gate (§31).
