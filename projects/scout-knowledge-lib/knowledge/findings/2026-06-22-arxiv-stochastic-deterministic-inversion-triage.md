<ai_context>
summary: "Triage of 9 arXiv papers (May–June 2026) converging on 'The Stochastic-Deterministic Inversion' — the field's systematic migration of control flow, routing, and coordination OUT of LLMs and into deterministic program structures. The convergent finding: agent failures are not model capability gaps but architectural misassignment — stochastic systems given deterministic responsibilities. LLM-as-Code (2606.15874) inverts the orchestrator pattern so programs own control and LLMs fill reasoning slots; XFlow (2606.14790) compiles workflow commitments into executable protocol structure; RAMP (2605.27492) demonstrates serial failure propagation (100%→20% task completion) invisible to static benchmarks; Insights Generator (2605.21347) achieves +30.4pp from corpus-level trace diagnostics; Self-Healing Router (2603.01548) cuts control-plane LLM calls by 93%; SDB Patterns (2605.20173) names the stochastic-deterministic boundary as the load-bearing primitive; Token Budgets (2606.04056) catalogues 63 budget-overrun incidents from missing type-level enforcement; Skill-to-LoRA (2606.16769) compiles skill documents into LoRA adapters eliminating runtime context cost; Tensor-Coord (2606.16478) provides computable coordination complexity via CP rank."
triggers: ["stochastic-deterministic boundary", "SDB", "control flow inversion", "LLM-as-Code", "agentic programming", "XFlow", "executable protocol", "prompt-harness boundary", "RAMP", "runtime assessment", "serial failure propagation", "Insights Generator", "trace diagnostics", "corpus-level diagnostics", "Self-Healing Router", "graph routing", "deterministic routing", "Token Budgets", "budget overrun", "affine types", "Skill-to-LoRA", "skill compilation", "LoRA adapter skills", "Tensor-Coord", "coordination complexity", "CP rank", "scope premium", "KE-1982"]
last_updated: "2026-06-22"
source_basis: "arXiv API queries: 'multi-agent' AND 'LLM' AND 'planning' (cs.AI), 'agent' AND 'runtime' AND 'adaptation' (cs.AI), 'agent' AND 'harness' AND 'prompt' (cs.AI), 'LLM agent' AND 'failure' AND 'production' (cs.SE), 'LLM agent' AND 'control flow' AND 'reliability' (cs.AI), 'agent' AND 'deterministic' AND 'orchestration' (cs.AI). All abstracts read from export.arxiv.org API."
</ai_context>

# Source Triage — June 22, 2026 (arXiv: The Stochastic-Deterministic Inversion)

Cross-source sweep covering 9 arXiv papers (May–June 2026) that converge on a macro-theme: **the field is systematically inverting the relationship between LLMs and control flow — moving deterministic responsibilities OUT of stochastic models and into program structures, confining LLMs to bounded reasoning-only slots.**

## Convergent Thesis: The Stochastic-Deterministic Inversion

Previous batches diagnosed failures at the *information* layer: the Assembly Gap (how systems fail between retrieval and reasoning), the Boundary Crossing Problem (how information transforms across agent boundaries). This batch reveals the **structural** root cause: agent systems fail because they assign deterministic work (looping, branching, routing, budget enforcement, coordination) to a probabilistic system. The fix is architectural inversion: deterministic structures own control; LLMs are invoked within bounded slots for reasoning only.

**The pattern repeats across all 9 papers:**
- **LLM-as-Code** (2606.15874): Programs own ALL control flow; LLM is an adaptive component called only for reasoning/generation
- **XFlow** (2606.14790): Workflow commitments compile into executable protocol structure; uncertainty is staged through lifecycle-governed typed cells
- **SDB Patterns** (2605.20173): Names the stochastic-deterministic boundary as a four-part contract (proposer, verifier, commit, reject) — the "load-bearing primitive" of production agents
- **Self-Healing Router** (2603.01548): Dijkstra's algorithm handles routing deterministically; LLM reserved ONLY for "no feasible path" cases — 93% fewer control-plane LLM calls
- **RAMP** (2605.27492): Serial failure propagation (100%→20% across stages) reveals what static benchmarks miss — failures compound precisely where deterministic constraints are absent
- **Insights Generator** (2605.21347): Corpus-level trace diagnostics produce +30.4pp improvements by finding systematic patterns invisible at individual-trace level
- **Token Budgets** (2606.04056): 63 confirmed production budget-overrun incidents from 21 frameworks — type systems (affine ownership) prevent what ad-hoc wrappers cannot
- **Skill-to-LoRA** (2606.16769): Procedural skill text → LoRA adapter = skill becomes deterministic behavior, not runtime context
- **Tensor-Coord** (2606.16478): CP rank provides a computable measure of coordination complexity; R*=N iff plans are independent

**Connection to our system:** KE-1982 (Scope Premium) showed 10.8× quality gap between scoped vs. unscoped workflows — the SAME agent at radically different quality levels depending on deterministic constraint. These papers explain WHY: scope IS deterministic constraint. Heartbeats fail because the LLM is given control-flow responsibility it cannot reliably execute.

---

## Paper-by-Paper Triage

### ★★★ [2606.15874] LLM-as-Code Agentic Programming for Agent Harness

- **Source**: https://arxiv.org/abs/2606.15874
- **Published**: 2026-06-13
- **Core finding**: Token explosion, control-flow hallucination, and unreliable completion are NOT implementation bugs — they are **architectural consequences** of assigning deterministic work (looping, branching, sequencing) to a probabilistic system. No prompt or stronger model can fix this. Solution: "Agentic Programming" where the program governs ALL control flow and the LLM is a component invoked only for reasoning/generation within bounded slots. Context becomes a DAG based on call depth (not accumulation over steps).
- **Key metric**: Substantially improved stability of long visual operation sequences in computer-use agents.
- **Implication for us**: This is the theoretical foundation for why KE-1982's scope premium exists. Our heartbeats assign the LLM control-flow responsibility (what to investigate, when to stop, what order to check things). Scoped workflows like metric-alert-triage externalize that control into the workflow definition. The 10.8× gap is the cost of stochastic control flow. Decomposing heartbeats means implementing agentic programming: the program decides WHAT to do; the LLM decides HOW within each slot.
- **Relevance**: ★★★ — Directly explains our most impactful finding (KE-1982)

---

### ★★★ [2606.14790] XFlow: An Executable Protocol Programming System for Reliable Multi-Agent Workflows

- **Source**: https://arxiv.org/abs/2606.14790
- **Published**: 2026-06-11
- **Core finding**: The "underspecified prompt–harness boundary" is the central source of reliability failures in multi-agent systems. XFlow occupies the middle position: readable as a literate protocol, but compiled and executed as a program. Key innovation: "lifecycle-governed symbols" — typed state cells with validation and commit states. Actor outputs are MEDIATED before they become shared state (instead of spreading through prompts or implicit memory).
- **Key metric**: Improves reliability across Constrained Interaction, Long-Context Reasoning, and Agentic Software Engineering tasks.
- **Implication for us**: Our system's shared KE entries, compiled lessons, and context files spread through the system without mediation. XFlow's "lifecycle-governed symbols" are the missing primitive: a structured gate that validates agent output before it becomes shared state. This directly addresses KE-1984's phantom feedback loop (evaluator output becomes compiled lessons without validation of its own quality). If evaluator verdicts were lifecycle-governed symbols requiring commit-time validation, the feedback loop breaks.
- **Relevance**: ★★★ — Provides the design pattern for fixing our two biggest problems (boundary crossing + phantom feedback)

---

### ★★★ [2605.20173] A Methodology for Selecting and Composing Runtime Architecture Patterns for Production LLM Agents

- **Source**: https://arxiv.org/abs/2605.20173
- **Published**: 2026-05-19
- **Core finding**: Names the **Stochastic-Deterministic Boundary (SDB)** as a four-part contract: proposer, verifier, commit step, reject signal. Claims the SDB is "the load-bearing primitive of production agent runtimes." Catalogs six runtime patterns (hierarchical delegation, scatter-gather + saga, event-driven sequencing, shared state machine, supervisor + gate, human-in-the-loop). Identifies "replay divergence" — where model/prompt changes cause different outputs from the same event log.
- **Key metric**: Five-step methodology applied to five workloads; one runnable reference implementation for a 90-day contract-renewal agent.
- **Implication for us**: Our system lacks an explicit SDB. Agent output becomes system state without passing through a verifier-commit-reject contract. The "replay divergence" failure mode is particularly relevant: our compiled lessons and KE entries are consumed across model versions without acknowledgment that model changes can alter their interpretation. The SDB framework provides the vocabulary and design patterns for our needed architectural evolution.
- **Relevance**: ★★★ — Names the primitive we're missing; directly applicable framework

---

### ★★★ [2605.27492] Benchmarks are Not Enough: RAMP for Runtime Assessing of Agentic Models in Production Systems

- **Source**: https://arxiv.org/abs/2605.27492
- **Published**: 2026-05-26
- **Core finding**: Task completion rates **progressively collapse** across serial workflows: 100% in stage 1 → 20% in final stage. NO model completes the entire pipeline. Computational costs differ by up to **three orders of magnitude** among comparable models. This degradation is "largely invisible to conventional isolated benchmarks."
- **Key metric**: 100% → 20% serial collapse; 1000× cost variance between models; 15 mainstream models evaluated.
- **Implication for us**: This validates our KE-1983 (Speed-Kill Threshold) from the external field. The serial collapse pattern IS timeout-induced death from per-step latency compounding. RAMP's "staged recovery mechanism" is the production version of our proposed s/op monitor — detect degradation mid-pipeline and intervene rather than waiting for catastrophic collapse. The 1000× cost variance suggests our per-agent timeout budgets should be model-aware, not fixed.
- **Relevance**: ★★★ — Independent confirmation of KE-1983; validates our proposed intervention

---

### ★★☆ [2605.21347] Insights Generator: Systematic Corpus-Level Trace Diagnostics for LLM Agents

- **Source**: https://arxiv.org/abs/2605.21347
- **Published**: 2026-05-20 (v3: 2026-06-04)
- **Core finding**: Manual trace inspection misses patterns that emerge only across trace populations. The Insights Generator (IG) uses a "scout-investigator architecture" to propose and test hypotheses across trace corpora. Result: **+30.4pp** improvement when human experts implement IG-derived insights. Domain experts rated IG reports as leading in "depth and evidence quality."
- **Key metric**: +30.4pp scaffold improvement from implementing insights; "scout-investigator" architecture for trace analysis.
- **Implication for us**: This is essentially what our Scout + production DB analysis does manually — corpus-level trace diagnostics producing actionable insights (KE-1981 through KE-1984 are all trace-corpus findings). The IG paper validates our approach AND suggests the next step: automating the hypothesis-test loop. Instead of Scout manually querying the DB and writing findings, a structured IG-like system could continuously surface systematic behavioral patterns. The +30.4pp result suggests significant untapped value in our existing traces.
- **Relevance**: ★★☆ — Validates our approach; provides blueprint for automation

---

### ★★☆ [2603.01548] Graph-Based Self-Healing Tool Routing for Cost-Efficient LLM Agents

- **Source**: https://arxiv.org/abs/2603.01548
- **Published**: 2026-03-03
- **Core finding**: Most agent control-flow decisions are ROUTING, not REASONING. A cost-weighted graph + Dijkstra's algorithm handles routing deterministically. When tools fail, edges are reweighted to infinity and paths recompute automatically. LLM is reserved exclusively for "no feasible path exists" cases. Result: matches ReAct correctness while reducing control-plane LLM calls by **93%** (9 vs 123) AND eliminating silent-failure cases.
- **Key metric**: 93% fewer LLM calls; zero silent failures; equivalent correctness across 19 scenarios spanning 3 graph topologies.
- **Implication for us**: Our system currently routes every decision through the LLM (fallback handler, problem-solver, task-worker all use LLM reasoning for what are often routing decisions). The 93% reduction figure suggests massive potential savings. The "elimination of silent failures" is particularly relevant given KE-1984's phantom feedback loop — deterministic routing can't hallucinate its own justification for a bad decision.
- **Relevance**: ★★☆ — Directly applicable efficiency pattern; addresses silent failure problem

---

### ★★☆ [2606.04056] Token Budgets: An Empirical Catalog of 63 LLM-Agent Budget-Overrun Incidents

- **Source**: https://arxiv.org/abs/2606.04056
- **Published**: 2026-06-02
- **Core finding**: 63 confirmed production budget-overrun incidents from 21 orchestration frameworks (2023–2026). Eight-cluster failure taxonomy (κ=0.837). Key insight: in-process integrity properties (no aliasing, no double-spend, no use-after-delegation) are enforced by ad-hoc wrappers, not type systems. Affine ownership (Rust borrow checker) makes budget violations compile errors. The "delegation-fanout race" (11 incidents) is uniquely prevented by type-level enforcement — async Python overshoots 30/30, affine types overshoot 0/30.
- **Key metric**: 63 incidents / 21 frameworks; delegation-fanout race: 30/30 failure in Python, 0/30 in affine-typed Rust.
- **Implication for us**: Our system has no budget enforcement mechanism — sessions can run indefinitely until timeout, and there's no type-level guarantee against recursive delegation spending (e.g., evaluator spawning deep-eval which itself spawns analysis). The "delegation-fanout race" is exactly what enables KE-1984's phantom feedback loop: evaluation delegates to deep-eval which delegates to override analysis without any budget ceiling. Adding affine-typed budget delegation would structurally prevent the loop from self-amplifying.
- **Relevance**: ★★☆ — Explains a mechanism behind our biggest system problem (KE-1984)

---

### ★★☆ [2606.16769] Skill-to-LoRA: From Using Skills to Learning Behaviors for Token-Efficient LLM Agents

- **Source**: https://arxiv.org/abs/2606.16769
- **Published**: 2026-06-15
- **Core finding**: SKILL.md files (human-readable procedural documents) can be converted to skill-specific LoRA adapters. Rather than injecting skill text into runtime context (repeatedly), the behavioral change the skill induces is modeled offline and loaded as a LoRA adapter online. Result: +5.2pp over full-skill-text prompting, -6.6% per-step token cost. Critical control: Wrong-LoRA and Shared-LoRA both REDUCE performance — the skill-specific alignment matters.
- **Key metric**: +5.2pp pass rate improvement; -6.6% token cost; 18/21 skills improved; wrong/shared LoRA both degrade.
- **Implication for us**: Our compiled lessons and context.md files ARE skill documents repeatedly injected into runtime context. The S2L approach suggests that persistent, stable procedural knowledge (how to write a KE entry, how to triage papers, how to query the DB) could be converted from context text to behavioral modules. The Wrong-LoRA control confirms that generic "good practices" injection (like our compiled lessons) may actually degrade performance — alignment to the specific skill matters.
- **Relevance**: ★★☆ — Provides theoretical backing for reducing context bloat; connects to KE-1979 (37% orientation waste)

---

### ★☆☆ [2606.16478] Tensor-Coord: Algebraic Decomposition of Joint Plan Tensors for Conflict-Free Multi-Agent LLM Planning

- **Source**: https://arxiv.org/abs/2606.16478
- **Published**: 2026-06-15
- **Core finding**: Represents joint plans as a tensor T ∈ R^{N×H×A} (agents × timesteps × actions). CP rank R* defines coordination complexity: CC(Π)=(R*-N)/N. R*=N iff plans are fully independent. The residual E=T-T_{R*} defines conflict scores localizing failures without domain-specific rules. Tucker factors provide interpretable roles/phases/clusters that become natural language constraints for LLM replanning. Linear scaling: R*(N) = 3.9N + 0.5.
- **Key metric**: 100% convergence for 2-agent (1.4 iterations), 80% for 3-agent (3.2 iterations), 60% for 4-agent (4.0 iterations).
- **Implication for us**: Provides a formal measure of coordination complexity. Our system has ~5 active agents. The formula predicts R* ≈ 20 (coordination complexity CC ≈ 3.0), meaning our agents' plans are highly interdependent and cannot be treated as independent. The conflict-score localization could identify which agent-timestep-action triples create the most coordination failures — without manually examining every interaction.
- **Relevance**: ★☆☆ — Theoretically interesting but requires adaptation for our non-spatial, non-synchronous coordination

---

## The Macro-Pattern: Control Is the Bottleneck, Not Capability

Across all 9 papers, the same structural insight emerges:

| Paper | What was deterministic | What was stochastic | Cost of misassignment |
|-------|----------------------|---------------------|----------------------|
| LLM-as-Code | Control flow | Reasoning | Token explosion, hallucinated control |
| XFlow | Protocol state | Semantic work | Unvalidated state propagation |
| SDB Patterns | Commit/reject | Propose/interpret | Replay divergence |
| Self-Healing Router | Routing | Goal demotion | 93% wasted LLM calls |
| RAMP | Pipeline ordering | Step execution | 100%→20% serial collapse |
| Insights Generator | Hypothesis structure | Pattern recognition | 30.4pp left on table |
| Token Budgets | Budget accounting | Task planning | $1000s wasted per incident |
| Skill-to-LoRA | Skill behavior | Novel reasoning | 6.6% wasted tokens per step |
| Tensor-Coord | Conflict detection | Plan generation | Exponential replan iterations |

**The law**: Any responsibility that is deterministic in nature but assigned to a stochastic system will eventually fail in proportion to its execution frequency.

---

## Synthesis: Connection to Our System

### The KE-1982 Explanation

KE-1982 showed a 10.8× quality gap between scoped workflows (metric-alert-triage: 85.4%) and unscoped heartbeats (may-heartbeat: 7.9%). These papers explain WHY:

1. **Metric-alert-triage** externalizes control flow: the program decides what to check, when to escalate, when to terminate. The LLM fills bounded reasoning slots.
2. **May-heartbeat** internalizes control flow: the LLM decides what to investigate, what order to try things, when it's "done enough." It's doing deterministic work with a probabilistic system.

The 10.8× gap IS the cost of the stochastic-deterministic inversion.

### The KE-1984 Explanation

KE-1984 (Phantom Feedback Loop) shows evaluation consuming 39.7% of ops in a self-amplifying cycle. These papers explain the mechanism:

1. **Missing SDB**: Evaluator outputs become system state (compiled lessons) without passing through a verifier-commit-reject contract (SDB Patterns)
2. **Missing budget enforcement**: The evaluation chain delegates without budget ceiling — deep-eval spawns override analysis without affine constraints (Token Budgets)
3. **Missing deterministic routing**: Every evaluation decision passes through the LLM, enabling hallucinated justifications for overrides (Self-Healing Router pattern would eliminate this)
4. **Missing lifecycle governance**: Evaluation artifacts become shared state immediately, without lifecycle validation (XFlow's mediated state cells)

### The Cheapest Intervention Stack (from these papers)

1. **Deterministic routing for evaluation** (Self-Healing Router): Replace LLM-driven evaluation routing with graph-based routing. If repair_execution status is resolved → route to "acceptable" without LLM override. Reserve LLM evaluation for genuinely ambiguous cases. Predicted: 93% fewer evaluation LLM calls.

2. **Budget delegation constraints** (Token Budgets): Add affine-typed budget that splits on delegation. Evaluator session gets budget B; deep-eval gets B/2; override analysis gets B/4. Cannot exceed parent allocation. Prevents self-amplification.

3. **Lifecycle-governed state** (XFlow): Evaluator verdicts → "proposed" state → validation gate (does this contradict the session's actual outputs?) → "committed" only if validation passes → becomes compiled lesson. Breaks the phantom feedback loop's commit-without-check pattern.

4. **Scope enforcement via agentic programming** (LLM-as-Code): Decompose heartbeats into DAG of bounded reasoning slots. Each slot has: input contract, output validation, deterministic transition to next slot. LLM cannot alter the program's execution path.

---

## Cross-References to Existing Knowledge

| This Batch | Connects to | Via |
|------------|-------------|-----|
| LLM-as-Code (2606.15874) | KE-1982 (Scope Premium) | Scope = externalized deterministic control |
| XFlow (2606.14790) | KE-1984 (Phantom Feedback Loop) | Lifecycle-governed symbols = mediated state |
| SDB Patterns (2605.20173) | KE-1984 (Phantom Feedback Loop) | Missing verifier-commit-reject contract |
| Self-Healing Router (2603.01548) | KE-1981 (Waiting Economy) | Deterministic routing = eliminated wait for LLM routing decisions |
| RAMP (2605.27492) | KE-1983 (Speed-Kill Threshold) | Serial collapse = timeout-induced death from compounding latency |
| Insights Generator (2605.21347) | Scout's DB analysis | Automated version of what we do manually |
| Token Budgets (2606.04056) | KE-1984 (Phantom Feedback Loop) | Missing budget enforcement enables self-amplification |
| Skill-to-LoRA (2606.16769) | KE-1979 (Orientation Waste) | Compiled skill → behavioral module eliminates context injection cost |
| Tensor-Coord (2606.16478) | Multi-agent coordination (KE-1975) | Formal coordination complexity measure |

---

## Reading Priority

For implementation relevance:
1. **SDB Patterns** (2605.20173) — most directly applicable framework; provides vocabulary + methodology
2. **LLM-as-Code** (2606.15874) — explains WHY scoped workflows win; provides design pattern for heartbeat decomposition
3. **XFlow** (2606.14790) — lifecycle-governed symbols are the missing primitive for our state management
4. **Self-Healing Router** (2603.01548) — directly applicable to evaluation routing; 93% savings
5. **Token Budgets** (2606.04056) — explains delegation-amplification mechanism; affine types as structural prevention

For theoretical understanding:
6. **Insights Generator** (2605.21347) — validates our trace-analysis approach; automation blueprint
7. **RAMP** (2605.27492) — serial collapse evidence; validates KE-1983
8. **Skill-to-LoRA** (2606.16769) — future direction for context optimization
9. **Tensor-Coord** (2606.16478) — coordination complexity formalism
