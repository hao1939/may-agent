<ai_context>
summary: "Triage of 12 new arXiv papers (June 2026) converging on 'The Executable Turn' — the field's transition from text-as-state/retrieval-as-reasoning to code-as-state/execution-as-reasoning. User as Code (2606.16707) makes memory a typed Python project achieving 99% on aggregate queries vs 6-43% for retrieval. APEX (2606.15363) extends harness evolution to three co-evolving layers (harness + principles + topology), +90% over baseline. MM-EPC (2606.16682) proves evaluator preference collapse is 3.2× worse in multimodal settings with cross-modal contagion, while self-evaluation provides near-complete immunity. SING (2606.16591) replaces static tool injection with intention-graph-based active discovery (59.8% recall improvement, 99.8% corpus reduction). GIST-CMTF (2606.16813) validates goal state before tool execution (wrong-goal drops 19.4%→2.5%). AIChilles (2606.15834) finds 49 hidden weaknesses across 30 AI-evolved programs — evolution creates regressions on unseen workloads. Reliability via Coding Theory (2606.18121) models multi-agent systems as LDPC-style factor graphs, proving density-evolution thresholds. CmdNeedle (2606.15549) shows 69-98.6% of command denylists are fragile including Claude Code's. Human-AI Synergy (2606.18413) proves coordination overhead can make additional collaborators harmful without shared memory + HITL gates."
triggers: ["executable turn", "user as code", "executable memory", "typed state", "code-as-memory", "APEX", "three-layer co-evolution", "multi-dimensional evolution", "principle extraction", "workflow topology", "MM-EPC", "evaluator preference collapse", "cross-modal contagion", "multimodal evaluator bias", "self-evaluation immunity", "SING", "intention graph", "active tool discovery", "tool scaling", "GIST-CMTF", "goal-state inference", "causal tool filtering", "wrong-goal execution", "AIChilles", "hidden weaknesses", "evolution regression", "unseen workload", "reliability coding theory", "LDPC agents", "density evolution", "factor graph agents", "CmdNeedle", "denylist fragility", "command bypass", "human-AI synergy", "process loss", "coordination overhead", "MUSE-Autoskill", "skill lifecycle", "memory trojans", "MemMark"]
last_updated: "2026-08-24"
source_basis: "arXiv API queries: 'AI agent' AND ('multi-agent' OR 'LLM agent' OR 'agentic') (cs.AI), 'LLM agent' AND ('runtime' OR 'failure' OR 'production' OR 'self-evolving' OR 'harness'), 'agent memory' AND ('LLM' OR 'large language model') AND ('coordination' OR 'evaluation' OR 'state'). All abstracts read from export.arxiv.org API. Deduplicated against 269 existing paper IDs across all prior batches."
</ai_context>

# Source Triage — August 24, 2026 (arXiv: The Executable Turn)

*Triaged: 2026-08-24 | Source: `https://export.arxiv.org/api/query` | Queries: 3 standard scout queries (see source_basis) | Papers: 12 new, deduplicated against 269 existing paper IDs across all prior batches.*

---

## Convergent Theme: The Executable Turn

Twelve independent papers converge on the next phase of the State Architecture Turn: **the transition from text-as-state and retrieval-as-reasoning to code-as-state and execution-as-reasoning.** The prior triage (Aug 23) established that state should be externalized into explicit primitives. This batch reveals the field's answer to "what form should that explicit state take?" — not structured text, not knowledge graphs, not JSON configs, but **executable code**.

1. **User as Code** (2606.16707): Memory as a typed Python project with executable rules — 99% on aggregate queries vs 6-43% for retrieval
2. **APEX** (2606.15363): Three-layer co-evolution where harness, principles, AND workflow topology evolve simultaneously — +90% over single-axis optimization
3. **GIST-CMTF** (2606.16813): Goal states as computable symbolic values, not inferred text — wrong-goal execution drops from 19.4% to 2.5%
4. **SING** (2606.16591): Tool discovery through executable intention graphs rather than semantic retrieval — 59.8% recall improvement at 99.8% corpus reduction
5. **Coding Theory for Agent Reliability** (2606.18121): Multi-agent architectures modeled as factor graphs with provable density-evolution thresholds

The complementary insight: **execution creates accountability that text cannot provide.** MM-EPC (2606.16682) proves evaluator bias is 3.2× worse in multimodal settings because text evaluation can't track cross-modal preferences. AIChilles (2606.15834) finds 49 hidden regressions in AI-evolved systems because text-described improvements don't guarantee behavioral improvements. CmdNeedle (2606.15549) shows 69-98.6% of text-described denylists are bypassable.

**Connection to prior triages**: The State Architecture Turn (Aug 23) established explicit state as the next primitive. The Harness Discipline (Aug 21) provided optimization tools at three levels. This batch completes the arc: the state must be *executable* — text that needs re-interpretation per session is the root of both the Cold Start Tax (re-parsing) and the Evaluation Mirage (inability to track what changes). Executable state runs deterministically, eliminates interpretation overhead, and creates audit trails automatically.

---

## Cluster A: The Executable State Stack

### ★★★★★ [2606.16707] User as Code: Executable Memory for Personalized Agents

- **Source**: https://arxiv.org/abs/2606.16707
- **Categories**: cs.AI
- **Published**: 2026-06-15
- **Summary**: Argues that agent memory should be *executable*, not retrievable. Introduces User as Code (UaC), where an agent's model of a user is a living software project: typed Python objects hold state, ordinary Python functions encode rules. An append-only log never discards a fact, periodically checkpointed into typed code. On LOCOMO recall: 78.8% (matching full-context upper bounds). On aggregate queries ("how many international trips?")—retrieval collapses (6-43%) while UaC stays near-perfect (99%). Rules execute deterministically on state change, enabling unsolicited safety alerts impossible with query-driven memory.
- **Key finding**: The gap between retrieval-based memory (6-43%) and executable memory (99%) on aggregate queries reveals a **fundamental capability boundary**: operations that require computation over state (counting, filtering, rule-checking) cannot be served by retrieval. The enabling architecture — append-only log + periodic code checkpoint — means no information is ever lost (the log) while the active representation stays compact (the code). This decouples information preservation from information use.
- **Implication for us**: Our knowledge library is pure text, consulted by retrieval (or full injection). UaC suggests that stable knowledge relationships — recurring patterns, tracked predictions, cross-reference networks — should be executable code, not prose to be re-interpreted. The prediction tracker (xhs-prediction-tracker.md) is a proto-UaC: structured predictions with status fields. The full UaC pattern would make these typed objects with functions that automatically flag contradictions, expired predictions, or superseded findings without needing a session to reason about them.
- **Cross-references**: [LedgerAgent (2606.20529)](./2026-08-23-arxiv-state-architecture-turn-triage.md), [OpenRath (2606.19409)](./2026-08-23-arxiv-state-architecture-turn-triage.md), [The Cold Start Tax](../the-cold-start-tax.md), [Engram (2606.09900)](./2026-08-21-arxiv-harness-discipline-composition-triage.md)

---

### ★★★★★ [2606.15363] APEX: Adaptive Principle EXtraction — Three-Layer Self-Evolution for Production AI Agents

- **Source**: https://arxiv.org/abs/2606.15363
- **Categories**: cs.AI
- **Published**: 2026-06-13
- **Summary**: Proposes that single-axis harness optimization (prompt patching only) is insufficient. APEX simultaneously evolves three layers: (L1) harness via failure-mode patching, (L2) behavioural principles via success-trace distillation, (L3) agent workflow topology via structural fitness-based selection. Tested on a production 15-node compute fleet with 114 real task traces over 18 days. Achieves Health Score of 0.570 (+90% vs. baseline 0.300) in a single evolutionary run, distilling 6 novel reusable principles and selecting a research-first workflow topology scoring 0.900 (+20%). Cost: only 4 LLM calls (~270 s) on local qwen2.5-coder:32b.
- **Key finding**: Multi-dimensional co-evolution **substantially** outperforms single-axis optimization. SkillOpt (prior triage) optimizes skills; Life-Harness optimizes the runtime interface; APEX shows that optimizing all three layers *simultaneously* captures interactions that single-axis optimization misses. The workflow topology layer is novel — evolving not just what agents do but how they're connected. The 6 distilled principles are *behavioral* (success-extracted), not corrective (failure-patched) — a fundamentally different signal source than mining failures alone.
- **Implication for us**: Our system evolves primarily through L1 (context.md patches from failure lessons). We never evolve L2 (behavioral principles from successes — what works stays implicit) or L3 (workflow topology is fixed in code). APEX suggests the missing evolution signal: **success-trace distillation** — systematically extracting what high-quality sessions did differently, not just what failing sessions did wrong. The workflow topology evolution is also provocative: our fixed "planner → agent → evaluator" topology could itself be subject to fitness selection.
- **Cross-references**: [SkillOpt (2605.23904)](./2026-08-21-arxiv-harness-discipline-composition-triage.md), [Life-Harness (2605.22166)](./2026-08-21-arxiv-harness-discipline-composition-triage.md), [MOSS (2605.22794)](./2026-08-21-arxiv-harness-discipline-composition-triage.md), [CoD (2606.20002)](./2026-08-23-arxiv-state-architecture-turn-triage.md)

---

### ★★★★ [2606.16591] SING: Synthetic Intention Graph for Scalable Active Tool Discovery

- **Source**: https://arxiv.org/abs/2606.16591
- **Categories**: cs.CL
- **Published**: 2026-06-15
- **Summary**: Addresses the closed-world assumption in tool-augmented agents: exhaustive tool schema injection is costly and limits agents to a static inventory. SING builds an intention-tool graph linking user intentions, tool capabilities, and tool collaboration patterns, then dynamically retrieves tools according to evolving task states. Active discovery means the agent reasons about what tools it NEEDS based on task decomposition, then queries the graph. Over a unified corpus of 7,471 tools across three benchmarks: Global Recall@5 improves by up to 59.8%, downstream success rate by up to 28.9%, while reducing full-corpus tool-schema exposure by 99.8%.
- **Key finding**: The critical insight is **intention-aware** discovery: tools are retrieved based on what the agent is trying to accomplish (its evolved intention graph) rather than semantic similarity to the raw query. This addresses the enterprise routing degradation (2606.17519): at 110+ agents, the router can't distinguish semantically similar tools. SING's intention graph provides the disambiguation layer — tools are selected based on their role in the causal plan, not their textual similarity. The 99.8% corpus reduction is the tool-level equivalent of BabelTele's 3.6× text compression: less context, better performance.
- **Implication for us**: Our tool definitions are injected in full at session start. As tool count grows, this creates context pollution (tools irrelevant to current task consume attention). SING's pattern suggests: maintain a task-intention graph that maps common task patterns to required tool subsets, and inject only the tools causally needed for the current task state. For a scout exploration task, inject only read/search/write tools; for an evaluator task, inject only DB/read/scoring tools.
- **Cross-references**: [Enterprise Routing Degradation (2606.17519)](./2026-08-21-arxiv-harness-discipline-composition-triage.md), [GIST-CMTF (2606.16813)](#-260616813-gist-cmtf-goal-state-inference-for-causal-minimal-tool-filtering-in-llm-agents), [The Workflow Speciation Cascade](../the-workflow-speciation-cascade.md)

---

### ★★★★ [2606.16813] GIST-CMTF: Goal-State Inference for Causal Minimal Tool Filtering

- **Source**: https://arxiv.org/abs/2606.16813
- **Categories**: cs.AI
- **Published**: 2026-06-15
- **Summary**: Causal Minimal Tool Filtering (CMTF) exposes only the next causally necessary tool frontier, but assumes goal state is known. In practice, ambiguous requests create wrong-goal execution where agents follow valid tool paths for unintended objectives. GIST-CMTF adds a goal-state inference layer that predicts candidate symbolic goals, estimates ambiguity, and either applies CMTF or exposes clarification as a causal action. Across seven model backends and 120 tasks: 97.0% task success vs. 80.1% for top-goal CMTF. Wrong-goal execution drops from 19.4% to 2.5%.
- **Key finding**: The critical failure mode is novel: **wrong-goal execution** — the agent completes a valid workflow for an unintended objective. This is undetectable by standard success metrics because the agent "succeeds" at the wrong task. The fix is goal-state validation BEFORE tool exposure — make the system compute what it's trying to do, then check whether that's correct. The "expose clarification as a causal action" is architectural: uncertainty about the goal becomes a first-class state that the system reasons about rather than resolving implicitly.
- **Implication for us**: Our planner gate decides what to do with events but doesn't formally validate the inferred goal against alternatives. Wrong-goal execution is a plausible failure mode: the planner routes an event to a workflow that handles it competently but wasn't the intended response. GIST-CMTF suggests: before executing, compute the goal state explicitly and check it against the event's actual intent. Our 49% quick-exit rate may include cases where the planner correctly identifies "nothing to do" AND cases where it's inferring the wrong goal.
- **Cross-references**: [ToolPro (2606.19992)](./2026-08-23-arxiv-state-architecture-turn-triage.md), [The Compilation Threshold](../the-compilation-threshold.md), [SING (2606.16591)](#-260616591-sing-synthetic-intention-graph-for-scalable-active-tool-discovery)

---

## Cluster B: Evaluator Contagion Deepens

### ★★★★★ [2606.16682] MM-EPC: Multimodal Evaluator Preference Collapse — Cross-Modal Contagion in Self-Evolving Agents

- **Source**: https://arxiv.org/abs/2606.16682
- **Categories**: cs.LG, cs.CL
- **Published**: 2026-06-15
- **Summary**: Shows Evaluator Preference Collapse (EPC) is dramatically amplified in multimodal settings. A single strategy (step_by_step) absorbs 48.4% of all weight — 3.2× the collapse observed in text-only self-evaluation. Novel phenomenon: **cross-modal contagion** — evaluator preferences acquired on one modality transfer to and corrupt strategy selection on another. Contagion coefficients: γ_{T→V}=1.145, γ_{V→T}=0.937. Critical finding: **self-evaluation provides near-complete immunity** — 97% of runs (N=30) yield zero contagion (JSD=0.003). Cross-model evaluation is the primary risk factor (JSD~0.19-0.34).
- **Key finding**: Two structurally novel insights: (1) **Cross-modal contagion** means biases acquired in one domain contaminate another — an evaluator trained on text quality preferences will misapply those preferences to visual tasks. (2) **Self-evaluation immunity** — when the same model evaluates its own outputs, contagion drops to near-zero. This paradox (self-eval is usually considered worse due to self-bias, but here it's protective) resolves when you realize the danger isn't self-bias but FOREIGN-bias-transfer: a different model's preferences being imposed. The risk factor is **evaluator identity mismatch**, not self-evaluation per se.
- **Implication for us**: Our architecture uses a cross-model evaluator (heuristic evaluator or separate LLM judges scoring agent outputs from different models). MM-EPC predicts this is the MAXIMUM-contagion configuration. Contagion Networks (2606.20493) showed γ ∈ [0.157, 0.352] for text; MM-EPC shows it's 3.2× worse with cross-modal tasks. The self-evaluation immunity finding is provocative: agents evaluating their own outputs might produce LESS bias propagation than cross-model evaluation, contradicting the conventional wisdom that self-eval is inferior. The architectural implication: if you must use a separate evaluator, at minimum use the same model family to reduce contagion.
- **Cross-references**: [Contagion Networks (2606.20493)](./2026-08-23-arxiv-state-architecture-turn-triage.md), [The Evaluation Mirage](../the-evaluation-mirage.md), [The Competence Inversion](../the-competence-inversion.md)

---

## Cluster C: Evolution Has a Shadow Side

### ★★★★ [2606.15834] AIChilles: Automatically Uncovering Hidden Weaknesses in AI-Evolved Systems

- **Source**: https://arxiv.org/abs/2606.15834
- **Categories**: cs.AI, cs.CR, eess.SY
- **Published**: 2026-06-14
- **Summary**: AI-driven system evolution (agents iteratively rewriting systems) reports 12-60% score improvements, but evolved programs can perform worse on unseen workloads and exhibit scalability regressions. AIChilles takes a baseline P and evolved P', searches for workloads where P' regresses in correctness, runtime, memory, or output quality. Combines deterministic workload-parameter extraction, agent-based constraint inference, differential oracles, and code-frequency coverage. Across five applications and 30 AI-evolved programs: **49 distinct hidden weaknesses found.** Including AIChilles in the development lifecycle mitigates several.
- **Key finding**: AI evolution is **overfitting to the evaluation distribution.** Evolved systems score better on benchmarks but regress on unseen workloads — the classic train/test gap at the system level. The hidden weaknesses are diverse: correctness bugs, performance regressions, memory blowups, and quality drops. The differential oracle approach (compare evolved vs. baseline on adversarial workloads) is the missing complement to self-evolution: you need both the optimizer (SkillOpt, APEX) AND the adversarial auditor (AIChilles) to avoid hidden regressions.
- **Implication for us**: Our context.md and compiled_lessons evolve session-over-session. AIChilles predicts this evolution accumulates hidden regressions on scenarios not recently encountered. The "edit only if validation improves" guard from SkillOpt protects against AVERAGE regression but not SPECIFIC workload regression. We need differential testing: compare evolved vs. prior-version behavior on diverse task types, not just average scores. Our evaluation's 12-state quantization (Evaluation Mirage) makes detecting these regressions nearly impossible.
- **Cross-references**: [MOSS (2605.22794)](./2026-08-21-arxiv-harness-discipline-composition-triage.md), [Harness Updating ≠ Benefit (2605.30621)](./2026-08-20-arxiv-evolution-stall-memory-paradigm.md), [The Evaluation Mirage](../the-evaluation-mirage.md)

---

### ★★★★ [2606.18121] On the Reliability of Networks of AI Agents: Density Evolution, Stopping Sets, and Architecture Optimization

- **Source**: https://arxiv.org/abs/2606.18121
- **Categories**: cs.MA, cs.IT
- **Published**: 2026-06-16
- **Summary**: Models multi-agent systems as message passing on sparse, role-typed factor graphs (the structure underlying LDPC codes). Extends density-evolution machinery of coding theory to agent architectures. A task is a set of coupled binary subclaims; agents exchange set-valued messages; check nodes are noisy Boolean verifiers. Three distinct failure modes — agent abstention, verifier no-output, and inter-agent message loss — propagate differently and don't reduce to a single effective channel. Proves density-evolution theorem predicting asymptotic fraction of unresolved subclaims. XOR case recovers classical LDPC recursion on BEC; AND case exposes positive/negative certificate asymmetry.
- **Key finding**: Multi-agent system reliability can be analyzed with the SAME formal tools as error-correcting codes — but the agent case is HARDER because: (1) verifier functions are nonlinear and value-asymmetric (unlike XOR parity checks), (2) three failure modes don't reduce to one channel, and (3) role-typing means not all agents are interchangeable. The density-evolution threshold tells you the minimum verification redundancy needed for reliable resolution. Below threshold: unresolved subclaims proliferate. Above threshold: the system self-corrects.
- **Implication for us**: Our multi-agent system has agents (proposers) and evaluators (verifiers) in a sparse graph. The density-evolution framework would tell us: given our evaluator's error rate (high, per the Evaluation Mirage) and architecture topology, what fraction of "subclaims" (task completions, knowledge assertions) remain unresolved? The three failure modes map directly: agent abstention (49% quick-exit), evaluator no-output (skipped evaluations — 20.1%), and message loss (context that doesn't reach the next session). If our system is below the density-evolution threshold, adding MORE verification won't help linearly — it'll help only above threshold.
- **Cross-references**: [Contagion Networks (2606.20493)](./2026-08-23-arxiv-state-architecture-turn-triage.md), [Compositional Incoherence (2605.30335)](./2026-08-21-arxiv-harness-discipline-composition-triage.md), [The Coordination Tax](../the-coordination-tax.md)

---

## Cluster D: Security Surface Expands

### ★★★★ [2606.15549] CmdNeedle: Measuring the Incompleteness of Command Denylists for AI Agents

- **Source**: https://arxiv.org/abs/2606.15549
- **Categories**: cs.CR, cs.AI
- **Published**: 2026-06-14
- **Summary**: First systematic characterization of command denylist fragility in terminal AI agents. Even Claude Code's built-in denylist can be bypassed. Applied CmdNeedle to 1,709 real-world denylists (13,332 rules) from GitHub. Key findings: **69.0-98.6% of denylists are fragile**, fragility occurs consistently across projects and agents. Root causes include command aliasing, multi-utility commands, and Unix pipe composition.
- **Key finding**: Command denylists are STRUCTURALLY inadequate — not because they're poorly written but because the combinatorial space of Unix command composition makes exhaustive enumeration impossible. A denylist blocking `rm` doesn't block `find . -delete` or `perl -e 'unlink(...)'` or pipe compositions that achieve the same effect. This is the Over-Privileged Tool Selection problem (2606.20023) at the OS level: behavioral text controls cannot enforce structural safety properties. The 69-98.6% fragility rate means denylists should be treated as heuristic hints, not security boundaries.
- **Implication for us**: Our agent sandbox relies on tool-level access controls (which tools are available). CmdNeedle shows that tool denylists are fundamentally fragile. The structural fix (from SEB, 2606.20520) applies: instead of listing what's forbidden, scope what's PERMITTED with certificates. Our guards checking for dangerous operations are subject to the same fragility — there are always bypass paths through the tools we provide.
- **Cross-references**: [Sovereign Execution Broker (2606.20520)](./2026-08-23-arxiv-state-architecture-turn-triage.md), [Over-Privileged Tool Selection (2606.20023)](./2026-08-23-arxiv-state-architecture-turn-triage.md), [Agent Security & Governance](../agent-security-governance.md)

---

### ★★★ [2605.29960] Hijacking Agent Memory: Stealthy Trojan Attacks Through Conversational Interaction

- **Source**: https://arxiv.org/abs/2605.29960
- **Categories**: cs.CR, cs.AI
- **Published**: 2026-05-28
- **Summary**: Studies memory poisoning attacks that work through normal conversational interaction, bypassing the selective extraction and rewriting stages in modern memory pipelines. Prior attacks assumed direct memory injection; this work shows stealthy attacks that survive the extraction filter by crafting information that APPEARS benign but activates malicious behavior when later retrieved in specific contexts.
- **Key finding**: Modern memory pipelines (extract → rewrite → store) don't just save everything — they filter and rewrite. Prior poisoning attacks fail against this filtering. The stealthy approach crafts conversational context that passes the extraction filter but encodes malicious activation patterns. The attack surface is the gap between "what seems safe to store" and "what becomes dangerous in combination with later retrieval context." This is a semantic composition attack — individually benign memories compose into harmful instructions.
- **Implication for us**: Our knowledge library accumulates information from multiple sources. A stealthy poisoning attack wouldn't need to inject overtly harmful content — it could insert subtly misleading findings that, when retrieved alongside real findings, produce incorrect synthesis conclusions. The defense is provenance-aware retrieval: track not just what was stored but what source it came from and whether the source chain is trustworthy.
- **Cross-references**: [MemMark (2605.25002)](#-260525002-memmark-state-evolution-attribution-watermarking-for-agent-memory), [Agent Security & Governance](../agent-security-governance.md), [Evidence Tracing (2606.04990)](./2026-08-21-arxiv-harness-discipline-composition-triage.md)

---

### ★★★ [2605.25002] MemMark: State-Evolution Attribution Watermarking for Agent Long-Term Memory

- **Source**: https://arxiv.org/abs/2605.25002
- **Categories**: cs.CR
- **Published**: 2026-05-24
- **Summary**: Proposes attribution watermarks that embed owner-controlled signals into latent memory-write decisions. Uses keyed, distribution-preserving selection among admissible candidates at each internal LLM call, recording cryptographic commitments with signed session anchors. Designed to survive leaked or migrated memory snapshots where logs, visible outputs, and metadata may be absent.
- **Key finding**: Memory provenance that's embedded IN the memory content itself (not in metadata that can be stripped) provides attribution even when the memory system is copied, leaked, or migrated. The "distribution-preserving selection" means the watermark doesn't degrade memory quality — it's steganographic in the choice among equally-valid candidates.
- **Implication for us**: As our knowledge library grows, provenance becomes critical for trust. MemMark's approach — embedding provenance signals in the content itself rather than relying on metadata — provides resilience against content being copied out of context. For our use case, the simpler analog: ensure every knowledge entry contains inline provenance (source links, dates, confidence levels) that travels with the content regardless of where it ends up.
- **Cross-references**: [Evidence Tracing (2606.04990)](./2026-08-21-arxiv-harness-discipline-composition-triage.md), [Engram bi-temporal model (2606.09900)](./2026-08-21-arxiv-harness-discipline-composition-triage.md)

---

## Cluster E: Coordination & Collaboration Dynamics

### ★★★★ [2606.18413] Searching for Synergy in Shared Workspace Human-AI Collaboration

- **Source**: https://arxiv.org/abs/2606.18413
- **Categories**: cs.AI, cs.HC
- **Published**: 2026-06-16
- **Summary**: Studies shared-workspace human-AI teams using Collaborative Gym with DiscoveryBench tasks. Key finding: adding simulated collaborators can LOWER performance when teams lack coordination structure. Across 1,482 sessions, scaffolding that combines shared group memory with human-in-the-loop (HITL) gates yields higher mean performance, most clearly in three-person teams. Conclusion: how teams coordinate matters as much as the capability available.
- **Key finding**: **Process loss is real and measurable** — additional capable collaborators make things WORSE without coordination scaffolding. The fix is two-fold: (1) shared group memory so all participants operate from the same state, and (2) HITL gates that route specific decisions to designated experts rather than letting anyone weigh in on anything. This is the Coordination Tax quantified: without structure, coordination cost grows faster than capability benefit.
- **Implication for us**: Our multi-agent system has agents that each maintain separate state (separate context.md, separate workspaces). The "shared group memory" primitive is absent — each agent's outputs are available to others only through explicit file paths, not through a shared state that all consult. The HITL gate pattern maps to our planner: decisions should be routed to the specific agent best suited, not broadcast. The finding that three-person teams benefit most from scaffolding suggests our ~5-agent system is in the range where coordination structure matters critically.
- **Cross-references**: [Enterprise Scale (2606.20058)](./2026-08-23-arxiv-state-architecture-turn-triage.md), [The Coordination Tax](../the-coordination-tax.md), [Multi-Agent Coordination](../multi-agent-coordination.md)

---

### ★★★ [2605.27366] MUSE-Autoskill: Self-Evolving Agents via Skill Creation, Memory, Management, and Evaluation

- **Source**: https://arxiv.org/abs/2605.27366
- **Categories**: cs.AI, cs.CL, cs.LG, cs.MA
- **Published**: 2026-05-26
- **Summary**: Proposes a unified skill lifecycle (creation, memory, management, evaluation) where agents continuously improve by creating, reusing, and refining skills. Skills are not isolated static artifacts but managed entities with version history, usage statistics, and quality metrics. The lifecycle ensures skills improve through reuse rather than accumulating as dead text.
- **Key finding**: The skill lifecycle as a first-class system design concern — not just "skills exist" but skills are created, versioned, evaluated, deprecated, and composed. The management layer prevents skill accumulation (where old skills degrade quality by context pollution) through active curation: usage tracking, quality gating, and deprecation. This is the "code-as-state" pattern applied to skills: skills are managed objects, not text files.
- **Implication for us**: Our compiled_lessons and knowledge entries accumulate without lifecycle management. Old entries aren't deprecated; superseded findings aren't marked; usage isn't tracked. MUSE-Autoskill suggests: every knowledge entry should have lifecycle metadata (creation date, last-used date, usage count, supersession chain) and an active deprecation process that removes entries that haven't proven useful.
- **Cross-references**: [SkillOpt (2605.23904)](./2026-08-21-arxiv-harness-discipline-composition-triage.md), [Engram invalidate-never-delete (2606.09900)](./2026-08-21-arxiv-harness-discipline-composition-triage.md), [The Eternal Present](../the-eternal-present.md)

---

## Cross-Cutting Analysis

### The Four-Triage Arc Completes

This triage completes a four-stage arc in the arXiv signal:

| Triage | Phase | Discovery | Form |
|:------:|:-----:|:----------|:-----|
| Contract Layer (Jun 19) | Diagnosis | Harness > model | Static contracts |
| Evolution Stall + Harness Discipline (Aug 20-21) | Treatment | Formal optimization + failure modes | Optimized text |
| State Architecture Turn (Aug 23) | Substrate | Explicit state primitives | Structured data |
| **Executable Turn (Aug 24)** | **Mechanism** | **Code-as-state, execution-as-reasoning** | **Executable code** |

The progression: contracts → optimization → structure → execution. Each phase subsumes the previous: executable code CAN be structured data CAN be optimized text CAN be static contracts. But executable code provides capabilities the others cannot: automatic rule enforcement (UaC), multi-dimensional evolution (APEX), intention-aware routing (SING), goal-state computation (GIST-CMTF).

### The Self-Evaluation Paradox

MM-EPC's finding that self-evaluation provides near-complete immunity to contagion (JSD=0.003) while cross-model evaluation drives maximum contagion (JSD=0.19-0.34) creates a paradox with conventional wisdom:

- **Conventional wisdom**: Self-evaluation is bad because models are biased toward their own outputs
- **MM-EPC finding**: Self-evaluation is protective because it prevents FOREIGN bias transfer
- **Contagion Networks (prior triage)**: Cross-model evaluation produces 3-5× weaker contagion than same-model (OPPOSITE finding)

**Resolution**: The two papers measure different things. Contagion Networks measures *bias propagation between agents* (same-model agents copy each other's biases more readily). MM-EPC measures *evaluator bias imposition on agents* (cross-model evaluators impose stronger foreign preferences). The architectural implication: if you want independent agents, use different models (Contagion Networks). If you want unbiased evaluation, use the same model as the agent (MM-EPC). Our system currently does neither optimally.

### Five Connections to Canonical Syntheses

1. **Cold Start Tax ← UaC + GIST-CMTF**: Re-parsing text context is the tax. Executable state (UaC) eliminates parsing; computed goal states (GIST-CMTF) eliminate goal-inference overhead at session start.

2. **Evaluation Mirage ← MM-EPC + AIChilles**: Our cross-model evaluation setup is the MAXIMUM-contagion configuration (MM-EPC). Our evolution proceeds without adversarial testing of regressions (AIChilles). Both compound: biased evaluation drives evolution that creates hidden regressions undetectable by the biased evaluator.

3. **Workflow Speciation ← SING + APEX L3**: Tool discovery noise at scale (SING's problem) maps to workflow routing noise. APEX's topology evolution suggests the workflow graph itself should be a fitness-selected structure.

4. **Coordination Tax ← 2606.18413 + 2606.18121**: Process loss from unstructured collaboration (2606.18413) is quantifiable through density-evolution theory (2606.18121). Below the reliability threshold, adding more agents makes things worse.

5. **Guard Paradox ← CmdNeedle**: 69-98.6% denylist fragility is the quantified Guard Paradox at the OS level. Text-based behavioral guards have the same structural inadequacy as text-based command denylists.

### The Meta-Pattern

All twelve papers converge on one principle:

> **Text that must be re-interpreted per invocation is the universal bottleneck. The next architectural generation replaces interpretation with execution: memory becomes code, goals become computable states, tool selection becomes graph traversal, evolution becomes multi-dimensional fitness selection, and security becomes structural certificates rather than behavioral lists.**

This is the Compilation Gradient carried to its endpoint: everything that CAN be compiled (executed deterministically) SHOULD be compiled, reserving LLM interpretation only for genuinely novel situations that no prior compilation covers.

---

## Predictions

1. **Executable memory** (UaC-style typed code as agent state) will appear in 2+ major frameworks within 6 months — the 99% vs 6-43% gap on aggregate queries is too large to ignore
2. **Multi-dimensional evolution** (APEX-style L1+L2+L3) will become the standard self-improvement architecture, replacing single-axis prompt optimization
3. **Goal-state validation** (GIST-CMTF) will become a standard agent safety check — "wrong-goal execution" will be named as a failure category alongside hallucination and refusal
4. **Adversarial evolution testing** (AIChilles) will be adopted as a complement to self-evolution — you can't trust evolution without differential testing
5. **Self-evaluation reconsidered** — MM-EPC's immunity finding will spark re-evaluation of when self-eval is protective vs. when cross-model eval is needed

---

## Papers Screened but Not Included

- **2606.16903** (Vector DB directory semantics): Infrastructure-level, no agent architecture relevance
- **2606.16849** (AI-guided evolutionary art): Domain-specific creative AI, not production agents
- **2606.16649** (SME agentic AI framework): High-level integration framework, no novel architecture
- **2606.16135** (SwiftCache KV sharing): Performance optimization, implementation-level not architectural
- **2606.16326** (Gaming-resistant AI insurance): Game theory for AI contracts, interesting but narrow scope
- **2606.15709** (Water network management): Domain-specific application, no generalizable patterns
- **2606.15422** (Pepti-Agent peptide design): Domain-specific MCP usage, well-covered pattern
- **2606.15116** (Graph of Trace visualization): Interesting provenance UI, covered by existing trace survey
- **2606.15107** (IRTS-ToolBench): Time series benchmark, tangential to agent architecture
- **2606.15084** (Bosque API spec language): Promising spec-centered development, but no agent evaluation results yet
- **2606.16576** (Agentic automata learning): Interesting capability probe, but findings (LLMs struggle with world-model inference) are expected and not actionable
- **2606.17459** (LLMs as CEOs): Benchmark for strategic decision-making, interesting framing but no architectural insight
- **2606.19787** (ORAgentBench): Domain benchmark, no novel architecture patterns
- **2606.19063** (PYPILINE malicious package detection): Security tool using agents, not about agent architecture
- **2606.19899** (Biological capabilities evaluation): Policy-focused, no architectural insight
- **2606.15822** (TrustedARI routing infrastructure): Trust-native routing with TLS adaptation, relevant to security but implementation-level and covered by SEB pattern
- **2606.18142** (AI Travel Agent benchmark): Values alignment probe, interesting but behavioral not architectural
- **2606.18294** (Vision AI for material monitoring): Domain-specific application
- **2606.18716** (Human-AI agent UX): UX patterns, not architectural
- **2606.19116** (Agent-first web redesign): Interesting policy paper but no empirical results
- **2606.16723** (AgentFairBench): Fairness benchmark, behavioral not architectural
- **2605.23986** (MemForest hierarchical temporal indexing): Memory system with temporal indexing — relevant but primarily a DB optimization paper, covered by Engram's stronger contribution
- **2605.29341** (WorldMemArena): Memory evaluation benchmark with harness-awareness — interesting but evaluation framework, not architectural insight beyond what Engram provides
- **2605.29640** (VikingMem): Memory management system — solid engineering but incremental over Engram's bi-temporal model
- **2606.18803** (ProfiLLM ride-hailing): Production deployment at scale, interesting constraints but domain-specific
- **2606.16465** (Trace-economic underwriting): Insurance pricing for agent actions — covered conceptually by existing security governance findings

---

## New Paper IDs (for dedup tracking)

```
2605.25002 2605.27366 2605.29960 2606.15363 2606.15549 2606.15834
2606.16591 2606.16682 2606.16707 2606.16813 2606.18121 2606.18413
```
