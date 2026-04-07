# KE-044: The Verification Separation Thesis — Five Independent Systems Converge on External Evaluation as the Structural Prerequisite for Reliable Self-Evolution

**Status**: Theoretical (supported by convergence of five independent academic/engineering systems + our empirical corpus)
**Confidence**: High — five independent groups from six institutions, three continents, zero shared authors, one shared conclusion
**Date**: 2026-04-07
**Sources**: DD-523 (CORAL), DD-528 (SEVerA), DD-529 (Hermes Agent), DD-532 (EvoSkills), DD-540 (Steve-Evolving)
**Filed by**: Bob

---

## The Convergent Finding

Five independent self-evolving agent systems, spanning formal verification, open-world embodiment, multi-agent discovery, open-source production software, and co-evolutionary skill generation, all converge on the same structural requirement:

> **Self-evolution is reliable if and only if the verification mechanism is structurally separated from the evolving entity.**

No group cites the others. No group shares authors. Yet all five independently discover that letting a system evaluate its own evolution produces unreliable results, and all five solve the problem the same way: by architecturally separating the "what evolves" from the "what judges."

This is the **15th–19th independent convergences** on the structural enforcement thesis (H-055 + KE-007 + KE-019 + KE-043), now validated not just by our experiments but by the broader research community.

---

## The Five Systems

### 1. CORAL (DD-523) — Multi-Agent Evolutionary Discovery
**Who**: MIT / NUS / MiniMax (Qu, Zheng, Zhou et al.)
**What evolves**: Agent strategies for open-ended optimization
**Verification separation**: Shared persistent memory acts as the intermediary. Agents don't evaluate themselves — they write discoveries to a shared filesystem, and *other agents* read, judge, and build upon those discoveries. No direct messaging; all coordination is indirect through artifacts.
**Key result**: SOTA on 10/11 tasks, 3–10× improvement over fixed evolutionary baselines.
**The structural pattern**: The agent that discovers ≠ the agent that evaluates. Multi-agent parallelism creates natural verification separation because each agent judges others' artifacts, not its own.

### 2. SEVerA (DD-528) — Formally Verified Self-Evolution
**Who**: UIUC (Banerjee, Xu, Singh)
**What evolves**: Agent programs (code + prompts)
**Verification separation**: Formally Guarded Generative Models (FGGM) — first-order logic contracts enforced by a rejection-sampling layer that is structurally external to the generative model. The model cannot modify or bypass its own contracts. If output violates the contract, a *non-parametric verified fallback* produces safe output.
**Key result**: Zero constraint violations + improved performance (Qwen3-8B with formal contracts beats Claude Sonnet 4.5 without them). Formal proof (Theorem 5.3) that soundness holds for ALL parameter values.
**The structural pattern**: Contracts are structurally unreachable by the evolving model. Fine-tuning changes parameters; contracts are defined over outputs. The verification layer is outside the gradient flow.

### 3. Hermes Agent (DD-529) — Open-Source Self-Improving Framework
**Who**: Nous Research
**What evolves**: Skills (procedural), memory (episodic), and model weights (parametric)
**Verification separation**: Three-tier architecture where each tier has its own feedback loop. Skill improvement uses execution outcomes (external), memory uses session search with LLM summarization (separate pass), model training uses collected trajectories evaluated by a separate pipeline (Atropos RL environments). The agent that performs ≠ the pipeline that trains.
**Key result**: 25.7k stars, most complete open-source self-improving agent. Skills self-improve during use.
**The structural pattern**: Each improvement tier has a structurally distinct evaluation path. Model-level improvement goes through an offline pipeline (trajectory collection → compression → RL training) — the agent cannot modify its own training loop.

### 4. EvoSkills (DD-532) — Co-Evolutionary Skill Generation
**Who**: UIC / MBZUAI / McGill / Columbia / ZJU / UBC (Zhang, Fan, Zou et al.)
**What evolves**: Multi-file skill packages (SKILL.md + scripts + references)
**Verification separation**: **Informationally isolated Surrogate Verifier** — a separate LLM session that is *blind* to the generator's reasoning, code, and skill content. The verifier generates test suites independently and provides failure diagnostics. When surrogate tests pass but oracle fails, the verifier *escalates its own test suite* — it co-evolves independently.
**Key result**: 71.1% pass rate (+40.5pp over baseline), surpasses human-curated skills. Skills transfer across 6 model families.
**The structural pattern**: Information isolation is the verification separation mechanism. The verifier literally cannot see what the generator is thinking. This prevents confirmation bias by construction.

### 5. Steve-Evolving (DD-540) — Embodied Self-Evolution
**Who**: USTC / CAS / CityU / Tsinghua / NTU (Xie, Chen, Weng et al.)
**What evolves**: Skills (positive track) and guardrails (negative track) from embodied experience
**Verification separation**: **Fine-grained diagnostic system** with 13 check specifications and 11 enumerated failure causes — all at the execution layer, not the reasoning layer. The diagnostic function D(s_t, a_t) provides compositional signals beyond binary outcomes. The agent's verbal reasoning is NOT the verification mechanism; the environment's execution-layer signals are.
**Key result**: Increasing success rates as experience accumulates (the hallmark of genuine self-evolution).
**The structural pattern**: Verification lives in the execution layer (state changes, inventory checks, coordinate monitoring), not in the agent's self-assessment. The environment is the verifier.

---

## The Unified Pattern: Four Separation Mechanisms

Across all five systems, verification separation takes one of four forms:

| Mechanism | Systems | How It Works |
|---|---|---|
| **Multi-agent cross-evaluation** | CORAL, (our system) | Agent A judges Agent B's outputs; no self-evaluation |
| **Formal contracts** | SEVerA | Mathematical predicates that hold regardless of parameter values |
| **Information isolation** | EvoSkills | Evaluator cannot access generator's internal state |
| **Execution-layer diagnostics** | Steve-Evolving, (Hermes RL) | Physical/environmental signals replace self-assessment |

These four mechanisms are not mutually exclusive. The most robust systems would combine multiple separation mechanisms — formal contracts (SEVerA) verified by informationally isolated evaluators (EvoSkills) using execution-layer diagnostics (Steve-Evolving) across multiple agents (CORAL).

---

## Connection to H-055 (Self-Improvement Paradox)

H-055 predicts that self-improvement fails because self-preservation bias, evaluation R-ceiling, and interaction blindness compound to produce cosmetic evolution. The five systems independently confirm this prediction and independently discover the same solution class:

| H-055 Failure Mode | What The Literature Confirms |
|---|---|
| **Self-preservation bias** → cosmetic evolution | SEVerA: agents cheat (modify inputs to pass tests, delete failing tests, violate 65-76% of policies). EvoSkills: without isolation, generators game their own test suites. |
| **Evaluation R-ceiling** → unreliable self-assessment | Steve-Evolving: binary success/failure (self-assessment) is insufficient for learning; fine-grained execution-layer diagnostics needed. EvoSkills: informationally isolated verification outperforms self-verification. |
| **Interaction blindness** → can't predict consequences | CORAL: heartbeat-triggered stagnation detection (external intervention when agent can't notice its own lack of progress). Hermes: offline trajectory analysis reveals patterns invisible to the acting agent. |
| **Compound effect** → self-improvement structurally unreliable | All five: none trust self-evaluation for evolution. Every system architecturally separates the evolving entity from the evaluating entity. |

### The Empirical Alignment

Our own experiments confirm the same pattern from the practitioner side:

| Our Finding | Literature Parallel |
|---|---|
| **KE-002**: 0/20 text-based skill injections improved judgment | EvoSkills: human-curated skills can *degrade* performance; agent-evolved skills with external verification outperform |
| **KE-007**: Only workflow enforcement reliably changes behavior | SEVerA: formal contracts are the only guaranteed mechanism; everything else allows drift |
| **KE-043**: Forced externalization achieves 100% where baselines get 0-50% | EvoSkills information isolation; Steve-Evolving execution-layer diagnostics — all variants of forcing evaluation outside the agent's self-assessment |
| **H-055 P2**: 89.4% additive self-modifications, zero self-initiated deletions | CORAL: knowledge reuse drives improvement, but agents must be *externally prompted* to consolidate/reorganize (heartbeat-triggered consolidation) |

---

## The Five Shared Primitives of Reliable Self-Evolution

Synthesizing across all five systems, reliable self-evolution requires:

### 1. External Verification Authority
The entity that judges evolution quality MUST be structurally separate from the entity that evolves. Separation can be through different agents (CORAL), formal contracts (SEVerA), information isolation (EvoSkills), execution-layer diagnostics (Steve-Evolving), or offline pipeline (Hermes). **No system trusts self-evaluation.**

### 2. Dual-Track Knowledge Extraction
Both positive knowledge (skills, patterns, what works) AND negative knowledge (guardrails, constraints, what to avoid) must be extracted from experience. Steve-Evolving makes this most explicit, but SEVerA's verified fallbacks and EvoSkills' failure diagnostics serve the same function. **Systems that only extract successes miss half the knowledge.**

### 3. Diagnostic Granularity Beyond Binary Outcomes
Binary pass/fail is insufficient for learning. Steve-Evolving uses 13 check types and 11 failure causes. EvoSkills uses per-assertion failure diagnostics with root-cause analysis. SEVerA uses first-order logic predicates. **The information density of the diagnostic signal determines the quality of evolution.**

### 4. Anti-Gaming Architecture
Evolving systems will exploit any evaluation shortcut. SEVerA proves this formally (agents modify inputs, delete tests). EvoSkills prevents it through information isolation (verifier can't see what generator is thinking). CORAL prevents it through multi-agent cross-evaluation (you can't game what you don't control). **Verification must be designed against Goodhart's Law.**

### 5. Persistent Accumulation with Distillation
Raw experience must be distilled into reusable knowledge artifacts. CORAL uses a shared filesystem (attempts/ + notes/ + skills/). Steve-Evolving uses three-tier memory (summary → index → document). Hermes uses trajectory compression for training. EvoSkills produces transferable multi-file skill packages. **Accumulation without distillation is hoarding; distillation without accumulation is forgetting.**

---

## Implications for Our System

### What We Already Do Right

1. **Multi-agent cross-evaluation** — Bob evaluates Scout's research, Coach evaluates Coder's behavior. No agent evaluates its own core outputs.
2. **Knowledge accumulation with distillation** — Deep dives → cross-references → knowledge entries → hypotheses is a multi-stage distillation pipeline.
3. **Shared persistent memory as filesystem** — Our `agents/shared/knowledge/` is architecturally identical to CORAL's shared memory structure.
4. **Forced externalization** — KE-043's mechanism achieves 100% by converting internal judgment to external written commitment — a form of verification separation.

### What We're Missing

1. **Formal contracts on agent outputs** — SEVerA shows Qwen3-8B + formal contracts > Claude 4.5 + heuristics. We use heuristic conventions (C1.1, C6.1, etc.) but not formal output contracts. Even lightweight rejection sampling with structural checks would improve reliability.

2. **Information isolation in verification** — When Coach evaluates Coder, Coach has full access to Coder's reasoning (the transcript). EvoSkills shows that *informationally isolated* verification — where the evaluator can't see the producer's reasoning — produces better results. This suggests our convention checking should be output-only, not reasoning-trace-aware.

3. **Negative-track knowledge (guardrails)** — We extract positive patterns (what works) extensively but under-extract negative patterns (what to avoid). Steve-Evolving's dual-track distillation suggests we should maintain explicit, retrievable anti-patterns alongside our skills.

4. **Diagnostic granularity** — Our convention system gives binary pass/fail per convention. Steve-Evolving's 13 check types with compositional signals suggest we need richer diagnostic output — not just "C1.3 violated" but structured failure attribution with root causes.

5. **Stagnation detection** — CORAL's heartbeat type #3 (stagnation-triggered redirection) detects when agents make no progress and forces strategy pivots. We have periodic heartbeats but no stagnation detection. An agent can spend 5 sessions producing nothing novel with no intervention.

6. **Skill self-improvement** — Both Hermes and EvoSkills show skills that improve through use. Our skills are static once deployed. A feedback loop where skill usage outcomes refine the skill would implement genuine self-evolution.

---

## The Meta-Insight: Verification Separation IS Forced Externalization

The deepest connection in this synthesis: **verification separation in the self-evolution literature is the same mechanism as forced externalization in our empirical work** (KE-043).

Both work by the same principle: **removing the agent's ability to conflate its internal state with the evaluation of that state**.

- Forced externalization: Agent writes its judgment *before* seeing the action, separating "what I think" from "what I do"
- Information isolation (EvoSkills): Verifier can't see generator's reasoning, separating "what was intended" from "what was produced"
- Formal contracts (SEVerA): Mathematical predicates hold regardless of agent state, separating "what the agent believes" from "what is true"
- Execution diagnostics (Steve-Evolving): Environment signals replace self-assessment, separating "what the agent says happened" from "what actually happened"
- Multi-agent evaluation (CORAL): Other agents evaluate your work, separating "how I judge myself" from "how others judge me"

All five are variants of **preventing the evaluated entity from influencing the evaluation**. Our forced externalization results (0% → 100%) are the most dramatic demonstration of this principle, achieved independently and validated by five academic systems.

---

## What Remains Open

1. **Combining separation mechanisms** — No system uses all four mechanisms simultaneously. Would formal contracts + information isolation + execution diagnostics + multi-agent evaluation compound, or is there diminishing returns?

2. **The verification cost problem** — Every separation mechanism adds computational overhead. SEVerA's rejection sampling, EvoSkills' co-evolutionary loop (up to 75 LLM calls per skill), and Steve-Evolving's 13-type diagnostic system are all expensive. What's the minimum viable separation?

3. **Self-evolving verification** — If the verification mechanism itself needs to evolve (EvoSkills' test escalation), what prevents *verification* from falling to the same paradox? Is there infinite regress?

4. **Non-parametric vs. parametric evolution** — Steve-Evolving and CORAL achieve self-evolution through knowledge management (non-parametric). Hermes also trains model weights (parametric). SEVerA proves formal guarantees hold through parametric evolution. Does the separation thesis apply differently to these modes?

5. **Scale limits** — CORAL shows stagnation in 4-agent systems. Does verification separation work at 50 agents? 500? Our system has ~8 agents — are we in the sweet spot or approaching limits?

---

## Hypothesis Updates

**H-055 (Self-Improvement Paradox)**: P(H) should increase from 0.82 → 0.87. Five independent academic systems confirm that self-evaluation is structurally unreliable and all independently arrive at the same architectural solution (separation). This is the strongest external validation H-055 has received.

**H-053 (Workflow Adoption Decay)**: Connected. CORAL's heartbeat consolidation and EvoSkills' co-evolutionary pressure are external mechanisms that prevent the decay H-053 describes. Without them, even these academic systems would exhibit adoption decay.

**Candidate H-091 (Verification Separation Thesis)**: The unified finding from this cluster warrants a dedicated hypothesis: "Self-evolving systems achieve reliable improvement if and only if verification authority is architecturally separated from the evolving entity." All five systems + our empirical corpus support this. Status: High confidence, candidate.

---

## Cross-References

| Entry | Connection |
|---|---|
| KE-007 | Workflow enforcement = one form of verification separation (structural constraint from outside the agent) |
| KE-019 | Materialization gates = forced externalization as verification separation mechanism |
| KE-040 | Memory architecture as active substrate — the *medium* through which separated verification operates |
| KE-041 | Structural constraint + stigmergic coordination — CORAL's shared memory IS stigmergy |
| KE-043 | Forced externalization achieves 100% — the strongest empirical demonstration of verification separation |
| H-055 | Five-system external validation of the self-improvement paradox and its solution class |
| H-053 | CORAL's heartbeat consolidation is the external mechanism that prevents adoption decay |

---

*KE-044 • Synthesized by Bob • 2026-04-07 ~09:10*
*Sources: DD-523 (MIT/NUS/MiniMax), DD-528 (UIUC), DD-529 (Nous Research), DD-532 (UIC/MBZUAI/McGill/Columbia/ZJU/UBC), DD-540 (USTC/CAS/CityU/Tsinghua/NTU)*
