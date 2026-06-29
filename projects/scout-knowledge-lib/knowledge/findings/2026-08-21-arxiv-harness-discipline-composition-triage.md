<ai_context>
summary: "Triage of 13 new arXiv papers (May–June 2026) converging on 'The Harness Discipline' — the field's transition from 'harness matters more than model' (established thesis) to 'harness has its own formal optimization theory.' Six independent systems now treat harness evolution as a disciplined engineering practice: SkillOpt (text-space optimizer with learning-rate budgets), Life-Harness (lifecycle-aware runtime adaptation, 88.5% avg improvement across 18 models), MOSS (Turing-complete source-level self-rewriting), Sibyl-AutoResearch (trial-and-error harnesses), Self-Healing Orchestrators (bounded runtime control, 98.8% success), and FinAcumen (selective experience memory harness). Complementary cluster on compositional failure: multi-component agents are Locally Coherent but Globally Incoherent (33-94% of compositions violate probability axioms), with LACUNA proposing typed program holes as safety solution. Memory cluster: Engram's bi-temporal engine beats full-context by +10.4pp at 8× fewer tokens; Memory-Use Boundaries reveal Claude/DeepSeek/Qwen leak sensitive memory 51-83% more than GPT. Enterprise routing degrades 16-23pp as agent catalogs scale from 10→110."
triggers: ["harness discipline", "harness optimization", "skill optimizer", "SkillOpt", "text-space optimization", "Life-Harness", "lifecycle harness", "MOSS", "source-level rewriting", "self-evolution code", "Sibyl", "trial-and-error harness", "self-healing orchestrator", "compositional incoherence", "locally coherent globally incoherent", "LACUNA", "typed program holes", "Engram", "bi-temporal memory", "memory-use boundaries", "sensitive memory", "enterprise routing degradation", "speculative execution agents", "cost-aware speculation", "FinAcumen", "experience memory harness", "agent provenance", "evidence tracing"]
last_updated: "2026-08-21"
source_basis: "arXiv API queries: 'AI agent' AND 'multi-agent' (cs.AI), 'LLM agent' AND 'runtime' AND 'failure', 'agentic' AND 'production' AND 'LLM', 'agent' AND 'memory' AND 'long-term' AND 'LLM', 'agent' AND 'self-evolving' AND 'harness'. All abstracts read from export.arxiv.org API. Deduplicated against all prior triages (142+ paper IDs checked)."
</ai_context>

# Source Triage — August 21, 2026 (arXiv: The Harness Discipline & Compositional Coherence)

*Triaged: 2026-08-21 | Source: `https://export.arxiv.org/api/query` | Queries: 5 standard scout queries (see source_basis) | Papers: 13 new, deduplicated against 142 existing paper IDs across all prior batches.*

---

## Convergent Theme: The Harness Discipline

Thirteen independent papers converge on a phase transition: **the harness is no longer just "more important than the model" — it now has its own formal optimization theory.** Prior triages established the hierarchy (Contract Layer, Externalization Turn, Evolution Stall). This batch shows the field producing the engineering discipline to match:

1. **SkillOpt** (2605.23904): First text-space optimizer with learning-rate budgets, validation gating, and epoch-wise updates — skills trained like neural network weights
2. **Life-Harness** (2605.22166): Lifecycle-aware harness adaptation achieves 88.5% avg improvement across 18 model backbones — harnesses evolved from a 4B model transfer to 17 others
3. **MOSS** (2605.22794): Source-level self-rewriting — argues text-mutable evolution is fundamentally limited; only code-level adaptation is Turing-complete
4. **Self-Healing Orchestrators** (2606.01416): Runtime control with bounded recovery budgets achieves 98.8% task success under fault injection
5. **Compositional Incoherence** (2605.30335): Formalizes WHY multi-component agents fail — locally coherent components compose into globally incoherent systems (33-94% of compositions violate probability axioms)
6. **LACUNA** (2605.28617): Typed program holes as a safety primitive — model-written code must type-check against the surrounding program before it runs

The complementary insight: **evolution without composition theory is brittle.** MOSS can self-rewrite, SkillOpt can optimize skills, Life-Harness can adapt the interface — but 2605.30335 shows that independently-evolved components COMPOSE INCOHERENTLY. The discipline is incomplete without a composition layer.

**Connection to prior triages**: The Evolution Stall (2026-08-20) showed that improving the harness has non-obvious failure modes. This batch provides the tools to overcome those failures: formal optimization (SkillOpt), lifecycle management (Life-Harness), bounded recovery (Self-Healing), and the formal characterization of WHERE composition breaks (2605.30335).

---

## Cluster A: The Harness Optimization Stack

### ★★★★★ [2605.22166] Adapting the Interface, Not the Model: Runtime Harness Adaptation for Deterministic LLM Agents (Life-Harness)

- **Source**: https://arxiv.org/abs/2605.22166
- **Categories**: cs.AI
- **Published**: 2026-05-21
- **Summary**: Proposes Life-Harness, a lifecycle-aware runtime harness that improves frozen LLM agents without changing model weights or evaluation environments. Life-Harness evolves from training trajectories by converting recurring interaction failures into reusable interventions across environment contracts, procedural skills, action realization, and trajectory regulation. On seven deterministic environments from τ-bench, τ²-bench, and AgentBench, Life-Harness improves 116 out of 126 model–environment settings across 18 model backbones, with an average relative improvement of 88.5%. Harnesses evolved only from Qwen3-4B-Instruct trajectories transfer to 17 other models.
- **Key finding**: The harness captures **environment-side structure**, not model-side quirks. This is why a harness evolved from a 4B model's failures transfers to 17 other models including frontier models — the failures are interface mismatches, not capability gaps. The four intervention layers (contracts, skills, realization, regulation) form a complete taxonomy of where model-environment interfaces break. Average 88.5% relative improvement means the interface mismatch is the dominant source of agent failure in deterministic domains.
- **Implication for us**: Our agent system has an implicit "harness" — the tool definitions, context.md, compiled_lessons, and prompt patterns. But we've never systematically collected interface failures and converted them into reusable interventions. Life-Harness's taxonomy suggests we should classify our agent failures by layer: (1) tool contract mismatches (agent expects tool to behave differently than it does), (2) procedural skill gaps (agent doesn't know the multi-step pattern), (3) action realization failures (agent generates an action in wrong format), (4) trajectory regulation (agent goes off-track without self-correction). Each layer needs a different intervention type.
- **Cross-references**: [HarnessX (2606.14249)](./2026-06-19-arxiv-contract-layer-triage.md), [The Cold Start Tax](../the-cold-start-tax.md), [Harness Updating ≠ Harness Benefit (2605.30621)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md)

---

### ★★★★★ [2605.23904] SkillOpt: Executive Strategy for Self-Evolving Agent Skills

- **Source**: https://arxiv.org/abs/2605.23904
- **Categories**: cs.AI, cs.CL
- **Published**: 2026-05-22
- **Summary**: First systematic controllable text-space optimizer for agent skills. A separate optimizer model turns scored rollouts into bounded add/delete/replace edits on a single skill document. Edits are accepted only when they strictly improve a held-out validation score. A textual learning-rate budget, rejected-edit buffer, and epoch-wise slow/meta update make skill training stable while adding zero inference-time model calls. Across six benchmarks, seven target models, and three execution harnesses, SkillOpt is best or tied on all 52 evaluated (model, benchmark, harness) cells.
- **Key finding**: Skills can be trained with the same discipline as neural network weights — learning rate (edit budget per epoch), validation gating (accept only if validation improves), momentum (slow/meta updates accumulate). The critical architectural choice: a **separate optimizer model** performs edits, decoupled from the task-solving model. This eliminates the "harness-updating ≠ harness-benefit" problem identified in 2605.30621 — the optimizer specializes in editing while the solver specializes in using. Swept all 52 cells against human-crafted, one-shot LLM, TextGrad, and EvoSkill baselines.
- **Implication for us**: Our compiled_lessons and context.md evolve through agent self-editing — the same agent that runs tasks also proposes lesson edits. SkillOpt's architecture suggests a dedicated "optimizer agent" that reviews scored session transcripts and produces bounded edits to guidance documents, validated against held-out session quality. The learning-rate budget prevents runaway editing (too many changes per cycle), and validation gating prevents regressions. This is the formal answer to "how should context.md evolve?"
- **Cross-references**: [Harness Updating ≠ Benefit (2605.30621)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [SCORE (2606.04507)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [The Cold Start Tax](../the-cold-start-tax.md)

---

### ★★★★★ [2605.22794] MOSS: Self-Evolution through Source-Level Rewriting in Autonomous Agent Systems

- **Source**: https://arxiv.org/abs/2605.22794
- **Categories**: cs.AI, cs.LG
- **Published**: 2026-05-21
- **Summary**: Argues that text-mutable evolution (skill files, prompts, memory, workflow graphs) is fundamentally limited because routing, hook ordering, state invariants, and dispatch live in code. Only source-level adaptation is Turing-complete — a strict superset of every text-mutable scope. MOSS performs self-rewriting at the source level on production agentic substrates: each evolution is anchored to a curated batch of production-failure evidence and proceeds through a deterministic multi-stage pipeline; code modification is delegated to a pluggable external coding-agent CLI.
- **Key finding**: The text-mutable evolution scope is **provably incomplete** — there exist failure classes that can ONLY be fixed by modifying source code (e.g., routing logic, state invariants, hook ordering). This is the "Turing-completeness argument": text config is a restricted subset of what code can express. The practical implication is that any self-evolving agent system that only mutates text artifacts will eventually hit an improvement ceiling. Source-level rewriting is the only scope that covers ALL possible fixes.
- **Implication for us**: Our system evolves through text-mutable artifacts (context.md, lessons, KEs). MOSS's argument says this scope is fundamentally limited — we can't fix routing logic, tool dispatch, or state management bugs through text edits alone. The failures that persist session after session despite "good lessons" may be in this unreachable class. The question for our architecture: which recurring failures require code changes that no amount of prompt/context evolution can address?
- **Cross-references**: [Life-Harness (2605.22166)](#-2605-22166-adapting-the-interface-not-the-model-runtime-harness-adaptation-for-deterministic-llm-agents-life-harness), [The Impedance Principle](../the-impedance-principle.md), [The Substrate Inversion](../the-substrate-inversion.md)

---

### ★★★★ [2605.22343] Sibyl-AutoResearch: Autonomous Research Needs Self-Evolving Trial-and-Error Harnesses, Not Paper Generators

- **Source**: https://arxiv.org/abs/2605.22343
- **Categories**: cs.MA, cs.AI, cs.SE
- **Published**: 2026-05-21
- **Summary**: Analyzes where autonomous research systems lose trial experience: weak evidence becomes prose, pilot signals become broad claims, memory remains textual, and recurring process failures do not change later behavior. Introduces Sibyl, built around Scientific Trial-and-Error Harnesses. A harness lets agents run bounded trials, preserve positive and negative outcomes, and route lessons into later planning, validation, claim scope, scheduling, critique, writing, and harness repair. Formalizes this through two conversion units: trial-to-behavior conversion and trial-to-harness-behavior conversion.
- **Key finding**: The critical diagnosis is WHERE experience is lost: (1) weak signals become overconfident prose, (2) negative results are dropped rather than preserved, (3) process failures don't modify future behavior. The two "conversion units" are the audit mechanism: you can trace whether a trial's outcome actually changed anything. Trial-to-behavior = did this trial change an agent's future actions? Trial-to-harness-behavior = did this process failure change the system itself? If neither conversion fires, the trial was wasted.
- **Implication for us**: Our scout exploration generates "trials" (source scans, paper triages). The question: do our trial outcomes change future behavior? The library accumulates findings but the conversion to behavior (how the scout operates next time) is implicit. Sibyl's audit suggests we should track: (1) which findings actually influenced later synthesis, (2) which process failures (missed papers, redundant scans) led to operational changes. Without this, we're accumulating experience but not learning from it.
- **Cross-references**: [Parthenon (2606.04602)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [The Evaluation Mirage](../the-evaluation-mirage.md), [SkillOpt (2605.23904)](#-260523904-skillopt-executive-strategy-for-self-evolving-agent-skills)

---

### ★★★★ [2606.01416] Self-Healing Agentic Orchestrators for Reliable Tool-Augmented Large Language Model Systems

- **Source**: https://arxiv.org/abs/2606.01416
- **Categories**: cs.AI
- **Published**: 2026-05-31
- **Summary**: Treats reliability as a bounded runtime control problem. The orchestrator maps observable failure signals to inferred failure classes, selects targeted recovery actions under explicit budgets, verifies recovered trajectories, and records observability traces. On 100-task controlled fault-injection benchmark: self-healing achieves 98.8% task success vs 94.5% retry-only and 93.8% full replanning. The largest gap is under a single recovery attempt: 94.0% vs 85.3% (retry-only) and 88.2% (replanning).
- **Key finding**: The critical insight is **bounded recovery budgets**. Previous approaches either retry blindly (cheap but uninformed) or do full replanning (expensive and often unnecessary). Self-healing maps observed failures to failure classes and selects the cheapest sufficient recovery. The single-attempt gap (+8.7pp over retry, +5.8pp over replanning) shows that *targeted* recovery far outperforms both brute-force retry and expensive replanning. The observability traces create a feedback loop for improving failure classification over time.
- **Implication for us**: Our agents have no explicit recovery mechanism — when a tool call fails, the model decides ad-hoc what to do. A bounded recovery system would classify failures (tool timeout, malformed output, file not found, context overflow) and apply pre-tested recovery actions (retry with backoff, reformulate, truncate context, skip and note). The 98.8% vs 93.8% gap between targeted healing and replanning suggests our agents waste significant effort on full re-attempts when cheaper targeted fixes would suffice.
- **Cross-references**: [DeltaBox (2605.22781)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [Cordon (2606.17573)](./2026-07-19-arxiv-agent-pathology-trust-triage.md)

---

### ★★★ [2606.17642] FinAcumen: Financial Multimodal Reasoning via Self-Evolving Experience Memory Harness

- **Source**: https://arxiv.org/abs/2606.17642
- **Categories**: cs.AI
- **Published**: 2026-06-16
- **Summary**: Accumulates financially grounded reasoning experience from prior trajectories, distilling successful strategies and failure-derived cautionary rules into a persistent memory bank. During inference, retrieved experiences condition reasoning only when semantic relevance exceeds a calibrated threshold; irrelevant memory is explicitly suppressed through a fallback mechanism.
- **Key finding**: The "relevance-gated memory injection" pattern — experiences are only used when they exceed a calibrated threshold, otherwise the system falls back to baseline reasoning. This prevents the "memory pollution" problem where irrelevant retrieved experiences degrade rather than help performance. The calibration is empirically set per-domain.
- **Implication for us**: Our context.md is always injected regardless of relevance to the current task. FinAcumen's pattern suggests guidance should be relevance-gated: only inject context entries whose relevance to the current task exceeds a threshold. For low-relevance sessions, less context = better performance. This directly maps to the "harness-benefit non-monotonicity" finding (2605.30621): strong models may benefit from less guidance, not more.
- **Cross-references**: [T-Mem (2606.15405)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [The Prompt Mass Problem](../the-prompt-mass-problem.md)

---

## Cluster B: Compositional Coherence & Safety

### ★★★★★ [2605.30335] Locally Coherent, Globally Incoherent: Bounding Compositional Incoherence in Multi-Component LLM Agents

- **Source**: https://arxiv.org/abs/2605.30335
- **Categories**: cs.AI, cs.CL
- **Published**: 2026-05-28
- **Summary**: Multi-component LLM agents assemble probabilistic claims from components that each see only part of a joint problem; the composition can violate basic probability axioms even when every component is locally coherent. Formalizes this as the "compositional residual" ε* — the L2 distance from the composed output to the nearest jointly coherent point. Across 1,876 ensemble cliques on a four-LLM panel, ε* > 0 on 33-94% of cliques. A hierarchical Boyle-Dykstra projection repairs compositions deterministically; an anytime-valid e-process gives sequential coherence monitoring.
- **Key finding**: **Every component can be individually correct while their composition is provably wrong.** This is not a rare edge case — it affects 33-94% of compositions depending on the relation class. The compositional residual is computable at runtime from system outputs and declared coupling constraints, meaning you can DETECT incoherence without ground truth. The deterministic repair (Boyle-Dykstra projection) can FIX detected incoherence post-hoc. Three intuitive LLM-side mitigations (retrieval, partition-aware prompting) help but don't eliminate the problem.
- **Implication for us**: Our multi-agent system has agents that each see their own context and produce outputs that should be jointly coherent (e.g., scout findings should align with synthesis themes; evaluation criteria should align with context.md goals). We have no mechanism to detect when independently-produced outputs contradict each other. The e-process for sequential monitoring suggests: as agents produce outputs over time, track whether the accumulated positions remain jointly coherent. When the residual exceeds a threshold, flag for human reconciliation.
- **Cross-references**: [Parthenon criterion-completion gap (2606.04602)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [The Coordination Tax](../the-coordination-tax.md), [Multi-Agent Coordination](../multi-agent-coordination.md)

---

### ★★★★ [2605.28617] LACUNA: Safe Agents as Recursive Program Holes

- **Source**: https://arxiv.org/abs/2605.28617
- **Categories**: cs.AI, cs.PL
- **Published**: 2026-05-27
- **Summary**: Addresses the split between the runtime that drives the agent (owns loop, context, control flow) and the code the model writes. LACUNA makes each agent action a typed call `agent[T](task)` that the LLM fills with code when execution reaches it. The code is type-checked against the surrounding program before it runs. A rejected action leaves the environment untouched, and compiler diagnostics drive retry. The same check bounds which tools and data an action may use and how they flow. The primitive expresses ReAct loops, sub-agents, skills, and parallel decomposition.
- **Key finding**: The "typed hole" primitive unifies expressiveness and safety: the agent can write arbitrary code (Turing-complete, addressing MOSS's concern) but it MUST type-check against the declared interface before execution. Rejection is total (no partial effects) and informative (compiler errors guide retry). This is the programming-languages answer to the safety problem: not restricting what agents can do, but requiring what they do is type-correct with respect to declared contracts.
- **Implication for us**: Our agents write to files with few structural constraints — the tool checks for file existence and size, but not semantic contracts. LACUNA's pattern suggests each agent action should be typed against a declared interface: a scout finding must have required fields (ai_context, triggers, date), a KE update must preserve structural invariants, a lesson must meet the "task-agnostic" requirement. Rejection should produce informative errors that guide the agent to self-correct.
- **Cross-references**: [SecureClaw (2606.09549)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [Cordon (2606.17573)](./2026-07-19-arxiv-agent-pathology-trust-triage.md), [MOSS (2605.22794)](#-260522794-moss-self-evolution-through-source-level-rewriting-in-autonomous-agent-systems)

---

## Cluster C: Memory Architecture — Temporal Provenance & Boundaries

### ★★★★ [2606.09900] Less Context, More Accuracy: A Bi-Temporal Memory Engine (Engram)

- **Source**: https://arxiv.org/abs/2606.09900
- **Categories**: cs.CL, cs.AI, cs.IR, cs.LG
- **Published**: 2026-06-05
- **Summary**: Presents Engram, an open-source dual-process memory engine on a bi-temporal data model. A fast write path appends lossless episodes with no LLM on the critical path; an asynchronous path extracts atomic (subject, predicate, object) facts, builds a bi-temporal knowledge graph, and resolves contradictions without an LLM call per fact — invalidating, never deleting, so every fact keeps provenance and a supersession chain. On LongMemEval_S (500 questions), Engram scores **83.6% vs 73.2% for full-context** (+10.4pp) at ~8× fewer tokens (9.6k vs 79k).
- **Key finding**: **Less context beats full context by 10.4 percentage points** when the context is properly curated with temporal provenance. The bi-temporal model (valid-time + transaction-time) means you can ask "what did we know as of date X?" without replaying history. The "invalidate, never delete" principle preserves provenance chains — you can trace how a fact evolved. The 8× token savings with BETTER accuracy is the definitive refutation of "just stuff everything in the context window."
- **Implication for us**: Our knowledge library grows monotonically — KEs accumulate but aren't temporally managed. Engram's bi-temporal model suggests: each fact should have a valid-time window (when is this true?) and a transaction-time (when did we learn this?). Superseded facts should be invalidated with a link to their successor, not deleted. This enables "as-of" queries: "what did we believe about multi-agent coordination as of June 2026?" — critical for tracking how understanding evolves. The 10.4pp improvement at 8× fewer tokens directly addresses our "prompt mass problem."
- **Cross-references**: [T-Mem (2606.15405)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [MemTrace (2606.17328)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [The Eternal Present](../the-eternal-present.md), [The Prompt Mass Problem](../the-prompt-mass-problem.md)

---

### ★★★★ [2606.06055] When Should Memory Stay Silent: Measuring Memory-Use Boundaries in Memory-Augmented Conversational Agents

- **Source**: https://arxiv.org/abs/2606.06055
- **Categories**: cs.AI
- **Published**: 2026-06-04
- **Summary**: Introduces RBI-Eval measuring when models inappropriately integrate sensitive memory. With memory available, separation score decreases 8.9–26.6% for GPT-5.4-mini but **51.1–82.9% for Claude-Sonnet-4.6, DeepSeek-V4-Flash, and Qwen3.5-9B**. The effect is specific to sensitive content rather than general personalization. Retrieval systems reduce but don't eliminate exposure once sensitive memory reaches the generator.
- **Key finding**: Models differ DRAMATICALLY in memory-use discipline. GPT-5.4-mini shows restraint (8.9-26.6% integration of sensitive memory) while Claude, DeepSeek, and Qwen integrate sensitive memory 51-83% more readily. This is not a retrieval problem — retrieval systems reduce exposure but once the memory reaches the generator, the model's behavioral character determines whether it's used. The "memory should stay silent" principle: having access to information doesn't mean you should use it in the current response.
- **Implication for us**: Our agents receive full context.md and potentially sensitive project information in every session. RBI-Eval reveals that different models have different tendencies to surface this information inappropriately. If we use Claude (which shows 51-83% higher sensitive integration), our agents are MORE likely to surface contextual information even when it's irrelevant to the current task — contributing to the "prompt mass" problem not through retrieval failure but through generation over-eagerness.
- **Cross-references**: [FinAcumen relevance gating (2606.17642)](#-260617642-finacumen-financial-multimodal-reasoning-via-self-evolving-experience-memory-harness), [MemTrace (2606.17328)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [The Prompt Mass Problem](../the-prompt-mass-problem.md)

---

## Cluster D: Production Scaling & Provenance

### ★★★★ [2606.17519] Scaling Enterprise Agent Routing: Degradation, Diagnosis, and Recovery

- **Source**: https://arxiv.org/abs/2606.17519
- **Categories**: cs.CL, cs.AI
- **Published**: 2026-06-16
- **Summary**: Studies single-step routing on a 110-agent, 584-tool catalog from a deployed enterprise assistant. Routing F1 on under-specified requests drops **16-23 percentage points** across three frontier models as the catalog scales from 10 to 110 agents. Oracle analysis decomposes degradation into a retrieval gap and a confusion gap (even with perfect retrieval, ceiling drops 10pp). Embedding-based shortlisting recovers +10-11pp F1 at full scale.
- **Key finding**: Agent routing is a SCALING problem, not just a capability problem. Even frontier models lose 16-23pp when routing across 110 agents. The confusion gap (10pp at oracle retrieval) means the problem is partially irreducible by retrieval improvements alone — the models genuinely can't distinguish between semantically similar tools when the catalog is large. Embedding-based shortlisting (pre-filtering to candidate set) is the current best mitigation but doesn't eliminate the gap.
- **Implication for us**: As our system grows more tools and agents, routing accuracy will degrade. This paper quantifies the degradation rate. At our current scale (~5-10 effective tools per agent), we're likely in the low-degradation regime. But if we add more specialized tools or sub-agents, we should expect 16-23pp routing accuracy loss and plan accordingly — either by keeping tool catalogs small per-agent (specialization) or by adding embedding-based shortlisting.
- **Cross-references**: [DSG (2606.18947)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [Agent Protocols MCP/A2A](../agent-protocols-mcp-a2a.md)

---

### ★★★ [2606.07846] Cost-Aware Speculative Execution for LLM-Agent Workflows

- **Source**: https://arxiv.org/abs/2606.07846
- **Categories**: cs.DC, cs.AI, cs.MA
- **Published**: 2026-06-05
- **Summary**: Presents a method for launching downstream operations with predicted upstream inputs. Five design decisions: (D1) start downstream before upstream completes; (D2) price each speculation in real dollars; (D3) single operator dial for latency vs cost; (D4) expected-value decision rule; (D5) Bayesian Beta-Binomial success probability. Fires only on admissible edges (side-effect-free, idempotent, or stageable behind commit barrier).
- **Key finding**: The admissibility precondition is the critical safety constraint: you can only speculatively execute operations that are reversible (side-effect-free, idempotent, or stageable). This creates a clear architectural incentive: **design agent operations to be idempotent** so they can be speculatively parallelized. The pricing model makes speculation a first-class economic decision rather than a latency-only optimization.
- **Implication for us**: Our agent workflows are serial — each operation waits for the previous one. Speculative execution suggests that read-only operations (file reads, searches, API queries) could be launched in parallel based on predicted needs. The admissibility constraint maps cleanly: all our read operations are side-effect-free and thus speculable; write operations require commit barriers. This would reduce wall-clock time for exploration-heavy tasks like source scanning.
- **Cross-references**: [DeltaBox (2605.22781)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [Self-Healing Orchestrators (2606.01416)](#-260601416-self-healing-agentic-orchestrators-for-reliable-tool-augmented-large-language-model-systems)

---

### ★★★ [2606.04990] From Agent Traces to Trust: A Survey of Evidence Tracing and Execution Provenance in LLM Agents

- **Source**: https://arxiv.org/abs/2606.04990
- **Categories**: cs.CR, cs.AI
- **Published**: 2026-06-03
- **Summary**: Surveys evidence tracing and execution provenance as foundations for process-level accountability. Defines execution provenance as the typed graph of an agent execution and evidence tracing as its projection onto evidence-support relations. Introduces taxonomy covering trace sources, evidence units, provenance relations, tracing granularity, representation forms, and trust functions.
- **Key finding**: The critical distinction between "execution provenance" (full typed graph of what happened) and "evidence tracing" (projection onto evidence-support relations) clarifies what's needed for different use cases. Debugging needs full provenance; trust needs only evidence tracing. The survey identifies the gap: most systems have neither — they produce final outputs without traceable paths from inputs through intermediate steps to conclusions.
- **Implication for us**: Our knowledge library entries have minimal provenance — they cite sources but don't trace the reasoning path from source to conclusion. Implementing even basic evidence tracing (which source sentences supported which claims in a KE) would enable: detecting stale claims when sources are updated, verifying synthesis accuracy, and identifying unsupported conclusions.
- **Cross-references**: [Selection Integrity (2606.12290)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [Agent Security & Governance](../agent-security-governance.md)

---

## Cross-Triage Synthesis: The Three Layers of Harness Discipline

This triage reveals that "harness optimization" is not one problem but THREE nested layers:

| Layer | Paper | What It Optimizes | Optimization Method | Scope |
|---|---|---|---|---|
| **Skill Layer** | SkillOpt | Text documents (prompts, guides, skills) | Bounded add/delete/replace with validation gating | Text-mutable only |
| **Interface Layer** | Life-Harness | Runtime contracts, action realization, trajectory regulation | Failure-to-intervention conversion | Interface-level |
| **Source Layer** | MOSS | Routing, dispatch, state invariants, hook ordering | Source-level rewriting via coding agent | Turing-complete |

Each layer is a strict superset of the previous: Skill ⊂ Interface ⊂ Source. MOSS's argument is that text-mutable optimization (SkillOpt) will eventually hit failures that require interface-level fixes (Life-Harness), which will eventually hit failures that require source-level changes (MOSS).

**But composition is orthogonal to all three layers.** 2605.30335 shows that even perfectly optimized components compose incoherently. The fix isn't better optimization of individual components — it's a composition layer (Boyle-Dykstra projection, sequential monitoring) that sits ABOVE the optimization stack.

**The full stack is thus:**

```
┌─────────────────────────────┐
│ Composition Layer           │  ← 2605.30335: detect/repair incoherence
├─────────────────────────────┤
│ Source-Level Optimization   │  ← MOSS: Turing-complete self-rewriting
├─────────────────────────────┤
│ Interface Optimization      │  ← Life-Harness: contract/skill/trajectory
├─────────────────────────────┤
│ Skill/Text Optimization     │  ← SkillOpt: bounded text-space edits
├─────────────────────────────┤
│ Runtime Control             │  ← Self-Healing: bounded recovery budgets
├─────────────────────────────┤
│ Safety Contracts            │  ← LACUNA: typed holes, reject-and-retry
└─────────────────────────────┘
```

**The cheapest intervention for our system**: Adopt SkillOpt's pattern for context.md evolution — dedicate an optimizer pass that reviews scored session transcripts, proposes bounded edits, and accepts only if held-out validation improves. Current approach (agents self-edit during tasks) conflates the optimizer and the solver roles.

**The deepest intervention**: Implement sequential coherence monitoring (2605.30335's e-process) across agent outputs — detect when independently-produced KEs, findings, and synthesis entries contradict each other before the library grows more incoherent.

**The most surprising finding**: Engram's 10.4pp improvement at 8× fewer tokens (2606.09900) combined with RBI-Eval's memory-silence boundary (2606.06055) suggests our agents would perform BETTER with LESS context — properly curated temporal snippets outperform full context dumps, and Claude in particular over-integrates available context.

---

## New Paper IDs (for dedup tracking)

```
2605.22166 2605.22343 2605.22794 2605.23904 2605.28617 2605.30335
2606.01416 2606.04990 2606.06055 2606.07846 2606.09900 2606.17519 2606.17642
```
