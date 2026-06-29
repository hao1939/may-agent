<ai_context>
summary: "Triage of 12 new arXiv papers (June 2026) converging on 'The State Architecture Turn' — the field's transition from implicit state reconstruction (full context loaded per session) to explicit state externalization (structured, typed, auditable state as first-class runtime primitive). LedgerAgent (2606.20529) externalizes task state into a ledger with policy-constraint checking. OpenRath (2606.19409) makes Session a first-class branchable/replayable runtime value. ToolPro (2606.19992) compiles multi-step tool workflows into executable programs (53.4% latency reduction). BabelTele (2606.19857) demonstrates model-native representations at 27.9% of text volume with 99.5% semantic fidelity. SoftSkill (2606.20333) compresses Markdown skill files into 32-token latent prefixes (+42.1pp on LiveMath). Complementary cluster on evaluator contagion and scale: Contagion Networks (2606.20493) proves evaluator biases propagate between agents (γ ∈ [0.157, 0.352], 72.4% mitigation via committee k=3). Enterprise multi-agent orchestration (2606.20058) shows scale, not complexity, dominates performance degradation. CoD (2606.20002) addresses long-lifecycle agent meta-capability via end-to-end RL. Security cluster: SEB (2606.20520) introduces certificate-bound mutation authority, Over-Privileged Tool Selection (2606.20023) quantifies privilege escalation under failure, NRT-Bench (2606.20408) provides multi-turn red-teaming with objective safety-function loss."
triggers: ["state architecture", "explicit state", "ledger agent", "session abstraction", "OpenRath", "tool programs", "ToolPro", "BabelTele", "model-native representation", "SoftSkill", "behavioral compression", "soft prompt skill", "contagion networks", "evaluator bias propagation", "enterprise multi-agent", "agent discovery noise", "connect the dots", "long-lifecycle agent", "sovereign execution broker", "certificate-bound authority", "over-privileged tool", "privilege escalation", "NRT-Bench", "nuclear red-team", "UltraQuant", "KV cache agents"]
last_updated: "2026-08-23"
source_basis: "arXiv API queries: 'AI agent' AND ('multi-agent' OR 'LLM agent' OR 'agentic') (cs.AI), 'LLM agent' AND ('runtime' OR 'failure' OR 'production' OR 'self-evolving' OR 'harness'), 'agent memory' AND ('LLM' OR 'large language model') AND ('coordination' OR 'evaluation'). All abstracts read from export.arxiv.org API. Deduplicated against 241 existing paper IDs across all prior batches."
</ai_context>

# Source Triage — August 23, 2026 (arXiv: The State Architecture Turn)

*Triaged: 2026-08-23 | Source: `https://export.arxiv.org/api/query` | Queries: 3 standard scout queries (see source_basis) | Papers: 12 new, deduplicated against 241 existing paper IDs across all prior batches.*

---

## Convergent Theme: The State Architecture Turn

Twelve independent papers converge on a phase transition in agent system design: **the field is moving from implicit state reconstruction to explicit state externalization.** Prior triages established that harness quality > model quality (Contract Layer), harness evolution has failure modes (Evolution Stall), and text-mutable evolution has a provable ceiling (Harness Discipline/MOSS). This batch reveals what comes after the text ceiling: **structured state as a first-class architectural primitive.**

1. **LedgerAgent** (2606.20529): Externalizes task state into a separate ledger with policy-constraint checking before tool calls. Eliminates state reconstruction from prompt.
2. **OpenRath** (2606.19409): Makes `Session` a first-class runtime value — branchable, inspectable, replayable, auditable. State travels with execution, not beside it.
3. **ToolPro** (2606.19992): Compiles multi-step tool interactions into executable programs with effect-typed replay, achieving 53.4% latency reduction.
4. **BabelTele** (2606.19857): Model-native representations condense text to 27.9% volume with 99.5% semantic fidelity — state need not be human-readable.
5. **SoftSkill** (2606.20333): Compresses Markdown skill files into 32-token latent prefixes, outperforming full text on benchmarks (+42.1pp LiveMath).

The complementary insight: **evaluation bias propagates through state channels** (Contagion Networks), **scale dominates complexity** at enterprise coordination (2606.20058), and **lifecycle-spanning meta-capability** can be trained end-to-end (CoD). These explain *why* explicit state matters: implicit state carries hidden biases, scales poorly, and can't support cross-session learning.

**Connection to prior triages**: The Evolution Stall showed that improving the harness has non-obvious failure modes. The Harness Discipline provided formal optimization tools. This batch provides the *substrate*: state that the optimizer can operate on directly, not through text intermediaries. LedgerAgent is to the Cold Start Tax what SkillOpt was to context.md evolution — the engineered solution to a previously-characterized problem.

---

## Cluster A: The State Externalization Stack

### ★★★★★ [2606.20529] LedgerAgent: Structured State for Policy-Adherent Tool-Calling Agents

- **Source**: https://arxiv.org/abs/2606.20529
- **Categories**: cs.AI, cs.CL
- **Published**: 2026-06-18
- **Summary**: Introduces LedgerAgent, an inference-time method that maintains observed task states in a separate *ledger* rendered into the prompt. The ledger records facts, identifiers, constraints, and conditions across turns. Before environment-changing tool calls execute, state-dependent policy constraints are checked against the ledger, blocking violations. Tested across four customer-service domains and a mixed panel of open- and closed-weight models. LedgerAgent improves average pass^k over standard prompt-based approaches, with largest gains under stricter multi-trial consistency metrics.
- **Key finding**: Standard agents reconstruct task state from the full prompt on every decision — creating two failure modes: (1) grounding decisions in stale/missing/incorrect information despite having encountered correct facts earlier, and (2) making syntactically valid tool calls that violate state-dependent policies. Separating state from conversation eliminates both failure classes simultaneously. The ledger is **not a memory system** — it's a *live state register* that's updated incrementally and checked before action.
- **Implication for us**: This is the engineered solution to the Cold Start Tax. Our agents reconstruct world state from full context on every session start. LedgerAgent's approach — maintain a separate state object, render it into the prompt, check it before tool calls — maps directly to what our system needs: a per-agent state register that persists between sessions and provides incremental state rather than full reconstruction. The policy-checking mechanism (verify constraints before tool execution) is also our missing Refusal Surface primitive: structural enforcement of constraints that text instructions fail to enforce.
- **Cross-references**: [The Cold Start Tax](../the-cold-start-tax.md), [The Refusal Surface (KE-056)](../../../agents/scout/workspace/digest/today.md), [The Guardrail Tax (KE-059)](../../../agents/scout/workspace/digest/today.md), [Life-Harness (2605.22166)](./2026-08-21-arxiv-harness-discipline-composition-triage.md)

---

### ★★★★★ [2606.19409] OpenRath: A PyTorch-Like Programming Model for Multi-Agent, Multi-Session Systems

- **Source**: https://arxiv.org/abs/2606.19409
- **Categories**: cs.SE, cs.PL
- **Published**: 2026-06-17
- **Summary**: Addresses fragmented runtime state in agent systems — transcripts, tool effects, memory events, branch provenance, and replay evidence recorded separately. Introduces `Session` as a first-class runtime value analogous to PyTorch's Tensor: branchable, inspectable, replayable, backend-aware, composable. A Session records conversation chunks, sandbox placement, lineage metadata, token usage, pending work, and tool evidence. Fork, merge, and replay become explicit runtime operations rather than states reconstructed from external traces. Also defines Sandbox, Tool, Agent, Memory, Workflow, and Selector abstractions.
- **Key finding**: The central thesis is that agent systems need a **first-class runtime value for auditable composition**, not better prompts or context management. When state is carried by the same value used in program execution, fork/merge/replay become explicit — not reconstructed from external traces. The analogy to PyTorch is deliberate: PyTorch's Tensor made autograd composition natural; OpenRath's Session makes agent composition natural by making state explicit and introspectable.
- **Implication for us**: Our system's state fragmentation is exactly what OpenRath diagnoses: session transcripts, evaluation records, task trees, knowledge entries, and workspace artifacts are all separate systems. The Cold Start Tax exists precisely because there's no single runtime value that carries state forward. OpenRath's `Session` abstraction suggests what a persistent session-state primitive would look like: a branchable, replayable record that agents inherit rather than reconstruct. The Selector abstraction (control flow as runtime-routed decisions) maps to our planner gate: decisions that should be state-routed rather than LLM-reasoned.
- **Cross-references**: [The Cold Start Tax](../the-cold-start-tax.md), [The Transduction Chain](../the-transduction-chain.md), [MOSS (2605.22794)](./2026-08-21-arxiv-harness-discipline-composition-triage.md)

---

### ★★★★ [2606.19992] ToolPro: Beyond Static Endpoints — Tool Programs as an Interface for Flexible Agentic Web Services (ICML 2026)

- **Source**: https://arxiv.org/abs/2606.19992
- **Categories**: cs.SE, cs.AI
- **Published**: 2026-06-18
- **Summary**: LLM agents invoke web services as tools, but static endpoints poorly express multi-step workflows with loops, conditionals, joins, and retries. ToolPro represents agent tool intent as an *executable tool program* with explicit effect types. Combines constraint-guided program construction, effect-aware replay for exactly-once state-modifying calls, and a profile-driven policy for deciding when program execution outperforms stepwise calling. Instantiated over MCP-style services with WebAssembly sandboxing. Reduces end-to-end latency by up to 53.4% and client-side traffic by up to 96.1%.
- **Key finding**: The key architectural choice is the *profile-driven policy* that decides WHEN to compile a workflow into a program versus calling stepwise. This is the Compilation Threshold applied to tool invocation: some tool sequences are deterministic enough to compile, others need LLM reasoning. The 53.4% latency reduction comes from eliminating per-step LLM round-trips for sequences that could have been pre-specified. The effect-type system (read vs. write vs. idempotent) enables exactly-once semantics for state-modifying calls — a primitive our system lacks entirely.
- **Implication for us**: Our planner gate (49% quick-exit) is a proto-compiler: it deterministically decides "nothing to do" without LLM reasoning. ToolPro suggests the next step: compile common multi-step tool sequences into executable programs. Our evaluator's heartbeat sequence (read alerts → check values → compare to thresholds → report) is a deterministic workflow that could be compiled to a tool program, eliminating the 45-ops LLM re-reasoning on every invocation. The effect-type system (separating reads from writes) maps to what the Refusal Surface needs: blocking writes while allowing reads.
- **Cross-references**: [The Compilation Threshold](../the-compilation-threshold.md), [The Thermal Efficiency Curve (KE-053)](../../../agents/scout/workspace/digest/today.md), [The Coordination Tax](../the-coordination-tax.md)

---

### ★★★★ [2606.19857] BabelTele: Large Language Models Do Not Always Need Readable Language

- **Source**: https://arxiv.org/abs/2606.19857
- **Categories**: cs.CL, cs.AI
- **Published**: 2026-06-18
- **Summary**: Investigates whether semantic information can be encoded in compact, non-standard textual forms that sacrifice human readability while remaining recoverable by LLMs. BabelTele maintains 99.5% semantic fidelity at 27.9% of original text volume. Evaluated on cross-model transfer, agent memory, and multi-agent communication. Effectiveness depends on compressor-reader pair and task setting, but demonstrates that human readability, natural-language typicality, and model-side semantic recoverability can be partially decoupled.
- **Key finding**: Human readability and model-side information preservation are **partially orthogonal properties**. The 3.6× compression ratio (27.9% volume) with 99.5% fidelity means the Prompt Mass Problem (141MB task text/3 days) could theoretically be reduced to ~39MB with near-zero semantic loss. The caveat — compressor-reader pair dependence — means this works best in closed systems where the same model family produces and consumes the compressed representation, exactly our architecture.
- **Implication for us**: Our Context Tax synthesis identified 155 MB/week of task instruction text, with 95.9% identical boilerplate in arc's case. BabelTele suggests a radical approach: compress boilerplate context into model-native representations at context-construction time, expanding only novel/changing sections in human-readable text. The 3.6× compression would reduce the Cold Start Tax's context-loading phase proportionally. The cross-model transfer results also suggest this could work across our different agent models if they share a model family.
- **Cross-references**: [The Context Tax](../insights/the-context-tax.md), [The Prompt Mass Problem](../the-prompt-mass-problem.md), [The Cold Start Tax](../the-cold-start-tax.md), [Dense Latent Communication (2606.13594)](./2026-06-21-arxiv-boundary-crossing-triage.md)

---

### ★★★★ [2606.20333] SoftSkill: Behavioral Compression for Contextual Adaptation

- **Source**: https://arxiv.org/abs/2606.20333
- **Categories**: cs.AI
- **Published**: 2026-06-18
- **Summary**: Proposes replacing natural-language Markdown skill files with compact continuous context objects (32-token soft prefixes) refined by a trainable delta while the base model stays frozen. On Qwen3.5-4B: +8.3pp SearchQA, **+42.1pp LiveMath**, +1.3pp DocVQA versus no-skill prompting. Beats SkillOpt by +5.2pp (SearchQA) and +12.5pp (LiveMath) while replacing hundreds to thousands of Markdown tokens with a few virtual tokens. Agentic execution studied as harder boundary case — useful signal but not yet robust for long-horizon procedures.
- **Key finding**: The core insight directly validates KE-061's text-mutable ceiling: **some skills are better treated as compact latent controls than as Markdown to be reinterpreted each time.** The frozen-backbone approach means the model doesn't need fine-tuning — only the soft skill prefix is trained. The +42.1pp on LiveMath (a reasoning task) versus SkillOpt's text-based skill optimization is striking: the same behavioral intent, delivered as latent activation rather than text, produces dramatically better results. The caveat — agentic long-horizon procedures don't yet compress well — maps to our distinction between gate decisions (compilable) and deep-work sessions (need full reasoning).
- **Implication for us**: Our compiled_lessons.md and context.md are consumed as text each session. SoftSkill suggests that stable, frequently-used guidance (the 95.9% boilerplate) could be more effective as learned latent prefixes rather than re-parsed text. This is the Compilation Threshold at the representation level: some instructions should be *compiled into model behavior* rather than *read every session*. The caveat about long-horizon procedures suggests the approach fits our cold-start/gate workflows (deterministic) but not deep-work sessions (variable).
- **Cross-references**: [SkillOpt (2605.23904)](./2026-08-21-arxiv-harness-discipline-composition-triage.md), [The Guardrail Tax (KE-059)](../../../agents/scout/workspace/digest/today.md), [The Text-Mutable Ceiling (KE-061)](../../../agents/scout/workspace/digest/today.md), [The Compilation Threshold](../the-compilation-threshold.md)

---

## Cluster B: Evaluator Contagion & Scale Collapse

### ★★★★★ [2606.20493] Contagion Networks: Evaluator Bias Propagation in Multi-Agent LLM Systems

- **Source**: https://arxiv.org/abs/2606.20493
- **Categories**: cs.LG, cs.AI, cs.MA
- **Published**: 2026-06-18
- **Summary**: Formalizes how evaluator biases propagate through multi-agent networks via a Cross-Agent Contagion Matrix (Γ_N). In controlled 3-agent experiments with three evaluator bias profiles (structured, balanced, evidence-based), biases consistently propagate between agents (γ ∈ [0.157, 0.352]), even within the same underlying model. Identifies three propagation regimes governed by spectral radius ρ(Γ_N). Homogeneous-model agents produce 3-5× weaker contagion than cross-model coefficients. Increasing evaluator committee size from k=1 to k=3 reduces effective contagion by 72.4%.
- **Key finding**: The evaluator isn't just biased — **its bias spreads to the agents it evaluates.** The contagion coefficient (γ ∈ [0.157, 0.352]) means that after evaluation, agents measurably shift their behavior toward the evaluator's biases. This is the Evaluation Mirage's mechanism: the heuristic evaluator's 12-state output doesn't just fail to discriminate quality — it actively shapes agent behavior toward whatever those 12 states reward. The spectral radius ρ(Γ_N) determines whether biases amplify (supercritical), stabilize (critical), or decay (subcritical). The 72.4% mitigation from k=3 committees explains why diverse evaluation would help.
- **Implication for us**: Our system has a single heuristic evaluator running 95% of evaluations with 12 fixed output states. Contagion Networks predicts this creates a bias attractor: agents are pulled toward behaviors that score well on those 12 states, regardless of actual quality. The committee mitigation (k=3 → 72.4% reduction) isn't practically available to us (we'd need 3× evaluator budget), but the spectral radius framework suggests a cheaper fix: decorrelate evaluation criteria between evaluation types (heuristic vs. deep) so they don't reinforce the same biases.
- **Cross-references**: [The Evaluation Mirage](../the-evaluation-mirage.md), [The Twelve-State Mirage](../the-twelve-state-mirage.md), [The Competence Inversion](../the-competence-inversion.md), [SCORE co-evolution (2606.04507)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md)

---

### ★★★★ [2606.20058] Autonomous Event-Driven Multi-Agent Orchestration for Enterprise AI at Scale

- **Source**: https://arxiv.org/abs/2606.20058
- **Categories**: cs.AI
- **Published**: 2026-06-18
- **Summary**: Evaluates DAG Plan-and-Execute and ReAct across 208 production-derived enterprise scenarios spanning Persona (<10 agents), Department (20-80), and Enterprise (200) scales. Introduces a Task Manager for continuous operation via priority inference, related-event merging, and preemption. Key finding: **scale, not task complexity, dominates orchestration performance**. Both architectures degrade at enterprise scale as agent discovery noise becomes the primary bottleneck, with simple tasks degrading more sharply than complex ones.
- **Key finding**: The counterintuitive result: simple tasks fail more at enterprise scale than complex ones. The mechanism: agent discovery noise. At 200 agents, the orchestrator's primary failure mode is selecting the wrong specialist, not reasoning about the task. At 10 agents, both architectures work well regardless of task complexity. This is our Workflow Speciation Cascade from the outside: as the number of workflow types (≈agent specialists) grows, the coordination cost of *discovering* the right one dominates the cost of *doing* the work.
- **Implication for us**: Our system has ~15 active workflow types. The paper's degradation curve suggests we're in the "Department" range where coordination is costly but manageable. The Task Manager's three mechanisms — priority inference, related-event merging, and preemption — map to missing primitives in our system: we have no event merging (each event triggers a separate session), and preemption only at the infrastructure level. Related-event merging alone would reduce the planner gate's 49% quick-exit rate by batching multiple events into single sessions.
- **Cross-references**: [The Workflow Speciation Cascade](../the-workflow-speciation-cascade.md), [The Coordination Tax](../the-coordination-tax.md), [The Thermal Efficiency Curve (KE-053)](../../../agents/scout/workspace/digest/today.md)

---

### ★★★★ [2606.20002] Connect the Dots: Training LLMs for Long-Lifecycle Agents via RL

- **Source**: https://arxiv.org/abs/2606.20002
- **Categories**: cs.LG, cs.AI, cs.CL
- **Published**: 2026-06-18
- **Summary**: Presents a framework for training LLMs to "Connect the Dots" (CoD) — a meta-capability for long-lifecycle agents that solve sequences of tasks, learn from experience, and self-update their context for progressive improvement. Implements end-to-end RL with GRPO-style fine-grained credit assignment over long rollout sequences interleaving solve-task and update-context episodes. Demonstrates out-of-distribution generalization within training domains, across domains, and from CoD to Ralph-loop settings.
- **Key finding**: The meta-capability being trained is **context self-updating** — the ability to extract useful information from task execution and integrate it into future context. This is the formalized version of what our compiled_lessons loop attempts: learn from sessions and update guidance. The critical design choice: solve-task and update-context episodes are **interleaved in the training rollout**, not separated. This forces the model to produce updates that actually help future tasks, avoiding the Knowledge Asymmetry (knowledge that flows without producing action).
- **Implication for us**: Our system separates task execution from context evolution entirely: agents run sessions (solve-task), evaluators score them (separate process), and lessons accumulate in text files (update-context as a side effect). CoD's interleaved approach suggests this separation may be the root cause of our Quiet Gradient finding (KE-064): improvements that travel through state loops work, but improvements through text channels don't, precisely because the text channel is decoupled from the task execution that would verify its value.
- **Cross-references**: [The Quiet Gradient (KE-064)](../../../agents/scout/workspace/digest/today.md), [The Knowledge Asymmetry](../the-knowledge-asymmetry.md), [Harness Updating ≠ Benefit (2605.30621)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md)

---

## Cluster C: Security & Governance Hardening

### ★★★★ [2606.20520] Sovereign Execution Brokers: Enforcing Certificate-Bound Authority in Agentic Control Planes

- **Source**: https://arxiv.org/abs/2606.20520
- **Categories**: cs.CR, cs.AI, cs.DC
- **Published**: 2026-06-18
- **Summary**: Introduces Sovereign Execution Broker (SEB), a runtime enforcement boundary that separates proposal, admission, and execution for agent infrastructure mutations. SEB consumes certificates from a Sovereign Assurance Boundary (SAB), verifies mutation matches the certified execution contract, checks validity windows and drift, mints scoped execution identity, invokes APIs, and records signed decision/outcome records. Evaluated on AWS and Kubernetes clusters, measuring latency overhead, revocation propagation, drift detection, and security under fault injection.
- **Key finding**: The architectural insight is **production mutation authority must not reside inside non-deterministic reasoning processes.** The three-phase separation (proposal → admission → execution) is the Compilation Gradient's end state: fully compiled governance where the enforcement boundary is structural, not behavioral. The certificate mechanism provides what the Deference Spectrum analysis showed was needed: a stable intermediate between 0% and 100% deference, achieved by making authority *scoped and time-bounded* rather than binary.
- **Implication for us**: Our system has no formal separation between reasoning and mutation. An agent that decides to write a file and the act of writing are in the same process. SEB's pattern — broker sits between decision and infrastructure, checking certificates — would formalize what our guards attempt behaviorally. The Guard Paradox (17,070 warnings, 0 behavioral changes) exists because guards are behavioral checks on a non-deterministic process. SEB replaces behavioral guards with structural certificates.
- **Cross-references**: [Agent Security & Governance](../agent-security-governance.md), [The Deference Spectrum](../the-deference-spectrum.md), [The Guard Paradox](../the-guard-paradox.md), [The Compilation Gradient](../governance-compilation-gradient.md)

---

### ★★★ [2606.20023] When Lower Privileges Suffice: Investigating Over-Privileged Tool Selection in LLM Agents

- **Source**: https://arxiv.org/abs/2606.20023
- **Categories**: cs.SE, cs.AI, cs.CL
- **Published**: 2026-06-18
- **Summary**: Studies over-privileged tool selection — agents choosing higher-privilege tools despite sufficient lower-privilege alternatives. Introduces ToolPrivBench across eight domains and five risk patterns. Finds over-privileged selection is common and **amplified by transient failures** (agents escalate privileges after tool errors). General safety alignment doesn't transfer to least-privilege behavior. Prompt-level controls provide only limited mitigation. Privilege-aware post-training defense substantially reduces unnecessary escalation.
- **Key finding**: The failure-amplification effect is novel: when a lower-privilege tool returns an error, agents escalate to higher-privilege tools even when the error is transient and retrying would succeed. This is a structural analog of our Cytokine Storm — a transient failure triggers an escalation cascade. The finding that prompt-level controls fail under transient failures while post-training defense works validates the Compilation Gradient: behavioral governance (prompts) is insufficient for safety properties; structural governance (trained behavior) is required.
- **Cross-references**: [Agent Security & Governance](../agent-security-governance.md), [The Deference Spectrum](../the-deference-spectrum.md), [The Cytokine Storm](../the-cytokine-storm.md)

---

### ★★★ [2606.20408] NRT-Bench: Multi-Turn Red-Teaming of LLM Agents in Safety-Critical Systems

- **Source**: https://arxiv.org/abs/2606.20408
- **Categories**: cs.CR, cs.AI
- **Published**: 2026-06-18
- **Summary**: Benchmark for red-teaming LLM agents as operators of a simulated nuclear power plant. Five-role operator team backed by configurable LLMs. Harm is objective (critical safety function loss), not LLM-judged. Finds 8.7-12.1% of attack sessions defeat the operator across four frontier models. Crucially: vulnerabilities are **nearly disjoint across models** (no session defeats all four, but a third defeat at least one). Defense effectiveness is model-dependent: same guardrail stack lowers ASR for one model but raises it for another.
- **Key finding**: Two findings are structurally novel: (1) vulnerability sets are nearly disjoint across models, meaning model diversity provides multiplicative safety rather than additive. This parallels Contagion Networks' finding that cross-model contagion is 3-5× stronger — diversity both helps (different vulnerabilities) and hurts (stronger bias propagation). (2) The same defense raises ASR for some models — defensive interventions can CAUSE failures they're designed to prevent, depending on the model. This is our Guardrail Tax and Hydra Pattern at the security level.
- **Cross-references**: [Agent Security & Governance](../agent-security-governance.md), [The Hydra Pattern](../the-hydra-pattern.md), [The Guard Paradox](../the-guard-paradox.md)

---

### ★★★ [2606.19911] Multi-Agent Transactive Memory (MATM): Population-Level Trajectory Sharing

- **Source**: https://arxiv.org/abs/2606.19911
- **Categories**: cs.AI, cs.CL, cs.IR
- **Published**: 2026-06-18
- **Summary**: Proposes population-level storage and retrieval of agent-generated trajectories, where producer agents contribute trajectories to a shared repository and consumer agents retrieve them to improve task execution. Tested in ALFWorld and WebArena (interactive environments with long trajectories). Retrieving MATM trajectories improves task performance and reduces interaction steps without coordination or joint training.
- **Key finding**: Agent trajectories encode **reusable procedural knowledge** that is typically discarded after single use. MATM positions trajectory sharing as a design pattern for population-level experience, analogous to search engines for human-generated artifacts. The key constraint: no coordination or joint training required — pure retrieval is sufficient. This is the Knowledge Asymmetry's proposed bridge: instead of distilling knowledge into prose (synthesis) or instructions (KEs), share the raw trajectories and let consumer agents learn from them directly.
- **Implication for us**: Our session transcripts are evaluated then effectively discarded. MATM suggests they contain reusable procedural knowledge — particularly successful deep-work sessions that discovered effective approaches. A retrieval mechanism over prior successful trajectories could provide task-specific guidance without growing context.md.
- **Cross-references**: [The Knowledge Asymmetry](../the-knowledge-asymmetry.md), [T-Mem (2606.15405)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [Engram (2606.09900)](./2026-08-21-arxiv-harness-discipline-composition-triage.md)

---

## Cross-Cutting Analysis

### The State Architecture Turn vs. Prior Triages

This triage completes a three-stage arc in the arXiv signal:

| Triage | Phase | Discovery |
|:------:|:-----:|:----------|
| Contract Layer (Jun 19) | Diagnosis | Harness > model; contract quality determines outcomes |
| Evolution Stall + Harness Discipline (Aug 20-21) | Treatment | Harness can be formally optimized, but has non-obvious failure modes and a text-mutable ceiling |
| **State Architecture Turn (Aug 23)** | **Substrate** | **Explicit state primitives replace text intermediaries entirely** |

The field's trajectory mirrors our KE library's arc: diagnose pathologies (KE-047 through KE-057) → identify ceiling (KE-061, MOSS) → propose structural alternatives (KE-063's 20-line code fix). The external research is now providing the formal tools for the structural alternatives.

### Five Connections to Our Canonical Syntheses

1. **Cold Start Tax ← LedgerAgent + OpenRath**: Our ~46% reconstruction overhead exists because state is prompt-implicit. Both papers provide explicit-state architectures that eliminate reconstruction.

2. **Evaluation Mirage ← Contagion Networks**: Our 12-state heuristic evaluator doesn't just fail to discriminate — it actively propagates its biases to the agents it evaluates (γ ∈ [0.157, 0.352]).

3. **Compilation Threshold ← ToolPro + SoftSkill**: Our 38% of ops on deterministic decisions could be compiled — ToolPro for tool sequences, SoftSkill for behavioral patterns.

4. **Prompt Mass Problem ← BabelTele**: Our 155 MB/week of task text could be compressed 3.6× with 99.5% fidelity using model-native representations.

5. **Workflow Speciation ← Enterprise Scale**: Our ~15 workflow types place us in the "Department" scale range where agent discovery noise is costly but manageable; further speciation would push us toward enterprise-scale degradation.

### The Meta-Pattern

All five clusters converge on one principle:

> **State that lives in text and is reconstructed per-session is the root bottleneck. The next architectural generation externalizes state into typed, structured, persistent primitives that the reasoning process consumes but does not reconstruct.**

This is the Substrate Inversion applied to state: intelligence migrated from model to harness; now *state* migrates from prompt to architecture.

---

## Predictions

1. **LedgerAgent-style state registers** will appear in 3+ major agent frameworks within 6 months
2. **Model-native compressed representations** (BabelTele-style) will be adopted for agent-to-agent communication before human-facing contexts
3. **Evaluator committee patterns** (k≥3) will become standard practice as contagion awareness spreads
4. **Tool program compilation** (ToolPro-style) will subsume MCP's static endpoint model within 12 months
5. **Behavioral compression** (SoftSkill-style latent skills) will replace or supplement Markdown skill files in at least one major framework

---

## Papers Screened but Not Included

The following new papers were reviewed and excluded from the main triage:

- **2606.20087** (Additive manufacturing optimization): Domain-specific RL, no agent architecture relevance
- **2606.20045** (UAV navigation): Embodied agent, no multi-agent/coordination relevance
- **2606.20041** (AI Economist): RAG + knowledge graph, well-covered by prior triages
- **2606.20014** (Hierarchical Control in Games): LLM + RL hybrid for games, not production agents
- **2606.20120** (Lab robotics): Domain-specific dual-agent, no generalizable architecture insights
- **2606.20122** (ScaffoldAgent): Outline optimization for research reports, tangential to agent systems
- **2606.19948** (DialNav): Embodied dialog navigation, no production system relevance
- **2606.19924** (Tao of Agency): Philosophical framework on autotelic AI, interesting but not actionable
- **2606.19893** (MetaResearcher): Proposes scout/filter/synthesizer swarm — interesting architecture but results are "planned experimental validation" (no results yet)
- **2606.20363** (SKILL.md Mining): Negative result — trajectory mining yields readable clusters but doesn't improve cross-domain policy. Confirms SkillOpt's approach (separate optimizer) is needed.
- **2606.19868** (Uncertainty Estimation): Survey, no novel architecture patterns
- **2606.20510** (Probabilistic Verification): Sound probabilistic policy enforcement — relevant to security but narrow scope, covered by existing agent-security-governance note
- **2606.20470** (Defensive Misdirection): CMPE reduces ASR by 100× — clever but narrow security technique
- **2606.20474** (UltraQuant KV Cache): 3.47× TTFT improvement for agent workloads via 4-bit KV cache — relevant to Cold Start Tax but implementation-level, not architectural
- **2606.17915** (BDaaS Multi-Agent): Lifecycle orchestration framework — well-covered territory
- **2606.17368** (Distributed Agent Networks): P2P agent networks — interesting but early-stage
