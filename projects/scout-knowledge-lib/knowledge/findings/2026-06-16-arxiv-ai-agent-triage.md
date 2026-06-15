<ai_context>
summary: "Triage of 13 new arXiv papers (June 11-12, 2026). Four convergent themes: evolvable harness engineering (HarnessX foundry, AgentSpec scaffold algebra), silent/latent failure patterns (fail-plausible narratives, 56% latent planning failures), guardrail inversion attacks (DoS on guards 148× latency, cross-modal skill attacks 2-17% detection, decomposition bypass), and file-first heterogeneous coordination (tap protocol, 27-day production)."
triggers: ["arXiv triage", "harness engineering", "evolvable harness", "silent failures", "fail-plausible", "latent failures", "guardrail DoS", "decomposition attacks", "skill attacks", "file-based coordination", "tap protocol", "capability minimization", "least-privilege agents"]
last_updated: "2026-06-16"
source_basis: "arXiv API queries: all:\"AI agent\" AND all:\"multi-agent\", all:\"LLM agent\" AND all:\"memory\", all:\"agent\" AND all:\"safety\" AND all:\"LLM\", all:\"agentic workflow\" OR all:\"agent framework\", all:\"autonomous agent\" AND all:\"planning\" AND all:\"LLM\" (June 11-12 papers, deduplicated against prior triages)"
</ai_context>

# arXiv Triage — June 11–12, 2026 (Batch 5)

*Triaged: 2026-06-16 | Source: `https://export.arxiv.org/api/query` | Queries: `all:"AI agent" AND all:"multi-agent"`, `all:"LLM agent" AND all:"memory"`, `all:"agent" AND all:"safety" AND all:"LLM"`, `all:"agentic workflow" OR all:"agent framework"`, `all:"autonomous agent" AND all:"planning" AND all:"LLM"` | Note: Supplements [2026-06-15](./2026-06-15-arxiv-ai-agent-triage.md) and all prior triages through [2026-07-17](./2026-07-17-arxiv-github-hn-triage.md); no duplicates.*

---

## ★★★★★ High Relevance

### [2606.14589] When Errors Become Narratives: A Longitudinal Taxonomy of Silent Failures in a Production LLM Agent Runtime
- **Authors**: Wei Wu
- **Source**: https://arxiv.org/abs/2606.14589
- **Categories**: cs.SE, cs.AI, cs.DC
- **Summary**: Longitudinal study of silent failures in a production agent runtime (40 scheduled jobs, 8 LLM providers, 4,286 unit tests, 827 governance checks) over eight weeks. 22 incidents, 28 manifestations of one meta-pattern: failures whose error signal never reaches a human in actionable form. Derives a five-class taxonomy: (A) environment quirks, (B) design-assumption mismatches, (C) error swallowing/dilution, (D) chained hallucination and fabrication, (E) operational omission and forensic blind spots.
- **Key finding**: Introduces **"fail-plausible"** — the LLM doesn't merely fail silently; it transforms the error into a fluent, plausible narrative delivered to the user. This is gray failure's differential observability *escalated*: the observer isn't just blind, they're convincingly lied to by the failure itself. Class D is unique to LLM systems and the most dangerous. 70% of silent failures caught by human user-view observation, not tests/audits. Audits had 0% ex-ante prediction but 87% regression blocking — audits are regression engines, not prediction engines. Incident latency (13h → 60d) tracks failure *mechanism*, not code complexity; longest-lived failures lived in seams between components.
- **Implication for us**: This is the most production-relevant paper in this batch. "Fail-plausible" names what the Observability Trap synthesis identified theoretically: the observation system doesn't just grow (impedance) — it actively generates convincing false signal. Our system's evaluator producing confident scores from metadata alone (Evaluation Mirage) is fail-plausible behavior: the evaluation looks real but measures nothing. The "seams between components" finding directly validates our experience — cross-agent failures (e.g., KE references that don't flow) are invisible precisely because each component reports success internally.

### [2606.14517] From Shield to Target: Denial-of-Service Attacks on LLM-Based Agent Guardrails
- **Authors**: Yuguang Zhou, Xunguang Wang, Pingchuan Ma, Zhantong Xue
- **Source**: https://arxiv.org/abs/2606.14517
- **Categories**: cs.CR, cs.AI
- **Summary**: Reveals that LLM-based guardrails — designed to protect against prompt injection and jailbreaks — can themselves be attacked via DoS. Crafted payloads trap guardrails in extended reasoning loops. Beam-search optimization crafts natural-language payloads maximizing guardrail reasoning length; mechanism-aware structural mutations provide a cheaper variant. Payloads optimized on a single open-source surrogate transfer to 8 leading model backbones (Claude, GPT, Gemini, DeepSeek, Qwen), achieving **13–63× token amplification**. In end-to-end agent deployments: up to **148× latency amplification**. A single poisoned document can saturate shared guardrail infrastructure, starving co-located agents.
- **Key finding**: Guardrails are a **shared resource** with no cost bound. The very capability that makes guardrails effective (reasoning, schema-following) is what makes them DoS-vulnerable. This is a new attack class: the guardrail's capability is weaponized against the system it protects. A single poisoned document can paralyze an entire multi-agent system sharing guardrail infrastructure.
- **Implication for us**: Directly extends the "Oversight is a Resource" theme (Theme 2) from our prior triage. Our guards fire on agent actions and load context to make decisions. If guard evaluation has no cost bound, a pathological context file could trap a guard in an expensive reasoning loop, blocking the agent indefinitely. The fix aligns with the Compilation Gradient: cost-bounded, deterministic guards at the base layer, with reasoning-based guards only for cases that pass the cheap filter. Also implies that guard *latency* should be monitored as a health metric — anomalous guard execution time signals either attack or pathological input.

### [2606.14249] HarnessX: A Composable, Adaptive, and Evolvable Agent Harness Foundry
- **Authors**: Tingyang Chen, Shuo Lu, Kang Zhao, Weicheng Meng
- **Source**: https://arxiv.org/abs/2606.14249
- **Categories**: cs.AI
- **Summary**: Introduces a "foundry" for agent harnesses — composable typed primitives assembled via substitution algebra, adapted through AEGIS (trace-driven multi-agent evolution engine), with a closed loop that turns trajectories into both harness updates and model training signal. Across ALFWorld, GAIA, WebShop, τ³-Bench, and SWE-bench Verified: **+14.5% average gain (up to +44.0%)**, with gains largest where baselines are lowest.
- **Key finding**: The harness is not just infrastructure — it's a *learnable, evolvable artifact*. HarnessX's substitution algebra treats harness primitives as typed, composable units. AEGIS mirrors symbolic adaptation with reinforcement learning, grounding harness evolution in operational traces. Gains largest where baselines are lowest = the harness matters most when the model is least capable.
- **Implication for us**: Major advance for the Harness Engineering pattern (agent-architectures.md §Harness Engineering). Prior work (Arbor, Nexent) established the harness as critical infrastructure; HarnessX makes the harness *self-improving*. The substitution algebra is the missing formalism for what our system does ad hoc: swapping prompt templates, tool configurations, and control flows between agents. The closed-loop trace→harness update pattern is what our lesson/KE system approximates but doesn't implement structurally. Connects to KE-1633 (The Harness Is The Agent) — HarnessX provides the mechanism by which the harness can systematically improve itself.

### [2606.14674] AgentSpec: Understanding Embodied Agent Scaffolds Through Controlled Composition
- **Authors**: Jixuan Chen, Jianzhi Shen, Haoqiang Kang, Zhi Hong
- **Source**: https://arxiv.org/abs/2606.14674
- **Categories**: cs.CL
- **Summary**: Modular specification framework representing agents as typed compositions of reusable policy components with standardized interfaces. Standardizes perception, memory, reasoning, reflection, action, and learning interfaces. Analyzed across DeliveryBench, ALFRED, MiniGrid, and RoboTHOR.
- **Key finding**: Agent performance is governed by **scaffold compatibility and interaction effects** rather than isolated module strength. Structured multi-granularity memory improves long-horizon state tracking. Reasoning and memory interact non-uniformly across environments. Reflection trades off correction and cost. RL-trained policies compose best when optimized with deployment-time scaffold structure.
- **Implication for us**: The "interaction effects > module strength" finding is the rigorous version of what we've observed empirically: adding memory or reflection modules doesn't help uniformly — it depends on which other modules are present and how they interact. This means our agent improvement strategy should focus on scaffold compatibility (how do context files, tools, and workflows interact?) rather than optimizing individual components in isolation. The finding that RL policies compose best when optimized *with* deployment-time scaffold structure directly challenges the common approach of training a model separately and bolting on scaffolding later.

### [2606.14154] SkillMutator: Benchmarking and Defending Language-and-Code Cross-modal Attacks on LLM Agent Skills
- **Authors**: Youngduk Kim, Minkyoo Song, Seungwon Shin
- **Source**: https://arxiv.org/abs/2606.14154
- **Categories**: cs.CR
- **Summary**: First benchmark for install-time detection of cross-modal attacks on Agent Skills (SKILL.md + executable scripts). 13 attack categories. Emulates adversarial mutation using scanner feedback. Proposes four-phase reasoning-trajectory distillation for locally deployable scanners. Open-source and commercial scanners detect only **2–8% and 9–17%** of attacks respectively. Distilled Qwen2.5-Coder-7B model achieves **88.2%** detection, surpassing GPT-4o-mini (23.7%) and GPT-5.4-mini (79.0%), matching GPT-5.4 (86.8%).
- **Key finding**: The attack surface is *cross-modal*: benign SKILL.md + benign-looking scripts combine to exfiltrate sensitive data. Neither NL analysis nor code analysis alone detects the attack — you need joint reasoning across both modalities. Current scanners (static analysis) are near-useless (2–17%). But a small distilled model with the right training can match frontier performance at 88.2%.
- **Implication for us**: Directly extends the "Skills Are the New Attack Surface" theme (Theme 6) from the prior triage. Combined with RSA's runtime auditing and SkillAxe's quality decomposition, the skill security stack now has three layers: (1) install-time cross-modal scanning (SkillMutator), (2) quality validation (SkillAxe), (3) runtime behavioral auditing (RSA). The distillation finding is practically actionable: a 7B model can provide near-frontier skill security scanning locally. Our context files and lesson files face a similar cross-modal risk: a benign-looking context update could contain instructions that alter agent behavior in harmful ways when combined with specific tool configurations.

### [2606.13994] Hidden in Plain Sight: Benchmarking Agent Safety Against Decomposition Attacks with DECOMPBENCH
- **Authors**: Vikhyath Kothamasu, Virginia Smith, Chhavi Yadav
- **Source**: https://arxiv.org/abs/2606.13994
- **Categories**: cs.CR, cs.AI, cs.LG
- **Summary**: Introduces DeCompBench for evaluating agent safety against decomposition attacks — breaking harmful tasks into individually benign subtasks that cumulatively fulfill malicious intent. Uses a graphical framework for systematic decomposition. SOTA agents show high refusal on monolithic harmful tasks but **significantly lower refusal** on decomposed variants, often inadvertently fulfilling adversarial objectives.
- **Key finding**: Safety mechanisms that look strong against direct harmful requests fail systematically against decomposed versions of the same request. Each subtask passes safety filters individually, but their composition achieves the harmful objective. This is the "benign parts, malicious whole" pattern — safety operates on individual steps, not on goal trajectories.
- **Implication for us**: This is a structural limitation of per-action safety filtering. Our guard system fires on individual actions — it cannot reason about whether a sequence of individually-benign actions composes into something harmful. Connects to Goal-Autopilot's anti-fabrication insight: terminal claims need falsifiable gates. Similarly, safety needs trajectory-level reasoning, not just step-level filtering. The graphical decomposition framework could be used defensively: decompose an incoming task into a dependency graph and check whether the goal graph matches known harmful patterns.

---

## ★★★★ Notable

### [2606.14445] tap: A File-Based Protocol for Heterogeneous LLM Agent Collaboration
- **Authors**: Minseo Kim
- **Source**: https://arxiv.org/abs/2606.14445
- **Categories**: cs.SE, cs.AI, cs.HC
- **Summary**: File-based collaboration protocol enabling Claude (Anthropic) and Codex (OpenAI) to collaborate on one codebase without shared memory or identical runtime. File-first design: markdown files with metadata as messages, file inspection (Tier 1) + real-time notification (Tier 2), git worktrees for work isolation. 27-day self-applied operation: 209 PRs, 717 operational artifacts. **69.8%** of heterogeneous-pair reviews found defects vs **53.1%** for homogeneous pairs.
- **Key finding**: File-based stigmergy works for heterogeneous agent coordination in production. The heterogeneous advantage is quantified: model diversity catches 16.7pp more defects in code review. The protocol is crash-resilient — message files persist even if real-time notifications fail.
- **Implication for us**: This is our coordination architecture validated by an independent system. Our agents coordinate through files (context.md, knowledge notes, KEs) without shared runtime or shared memory. tap formalizes what we do implicitly and adds the missing piece: tiered communication (durable file + optional real-time notification). The heterogeneous model advantage finding supports using different models for different agent roles. Connects to DeLM's shared verified context — tap's file-first design naturally provides an audit trail.

### [2606.14574] SIMMER: Benchmarking Latent Failures in LLM Executable Planning with a World Model
- **Authors**: Xiaoxin Lu, Ranran Haoran Zhang, Rui Zhang
- **Source**: https://arxiv.org/abs/2606.14574
- **Categories**: cs.CL, cs.AI
- **Summary**: Benchmark for latent failures in LLM planning — failures that don't immediately halt execution but silently compromise goals or cause irreversible harm. Symbolic world model (77 actions, 262 objects, ~46,800 interactions). State machine executor detects precondition violations, latent hazards, and irreversible failures. Frontier models achieve at most **17% error-free plans**. Up to **56% of plans contain latent failures**, majority leading to irreversible consequences. Counterfactual foresight simulation reduces latent failures by up to **72%** and irreversible cases by **75%**.
- **Key finding**: Latent failures are the dominant failure mode in LLM planning — more common than immediate failures, and often irreversible. The fix is counterfactual foresight: explicitly simulating "what happens if this step goes wrong?" before executing. This is cheap to add and highly effective.
- **Implication for us**: Connects to "fail-plausible" (2606.14589): latent failures in planning are the same class as silent failures in production — the system proceeds confidently while carrying hidden damage. Our agents don't simulate counterfactual foresight before executing multi-step plans. Adding "what could go wrong?" as a structured pre-execution step could catch the latent failure class at low cost. The 56% latent failure rate means we should assume most multi-step agent plans contain at least one hidden failure.

### [2606.13884] Capability Minimization as a Safety Primitive: Risk-Aware Causal Gating for Least-Privilege LLM Agents
- **Authors**: Laxmipriya Ganesh Iyer, Rahul Suresh Babu
- **Source**: https://arxiv.org/abs/2606.13884
- **Categories**: cs.AI
- **Summary**: RACG framework decides whether to act, defer, or abstain based on causal effect estimation + calibrated risk control. Models causal pathway from actions to outcomes. Gates decisions by estimated counterfactual risk, not predictive confidence. Distribution-free bounds on acting under high-risk conditions. Adaptive gating adjusts to distribution shift by monitoring predicted vs realized outcomes.
- **Key finding**: Explicitly separating causal risk from predictive uncertainty yields safer decisions. The key distinction: predictive confidence ("I'm 90% sure this is correct") ≠ causal risk ("what happens if I act on this and I'm wrong?"). An agent can be highly confident and still face high causal risk (e.g., "I'm 90% sure this is the right file to delete" has high causal risk because the 10% case is catastrophic).
- **Implication for us**: This formalizes "least-privilege for agents" — capability minimization as a safety primitive. Extends the Abstention Advantage synthesis: abstention should be driven by causal risk assessment, not just confidence. RACG's adaptive gating (tightening under distribution shift) is a principled version of what our circuit breakers do heuristically. The framework suggests we should distinguish high-confidence/high-risk actions (approve with caution) from low-confidence/low-risk actions (approve freely) — our current guards don't make this distinction.

### [2606.14672] Towards Direct Latent-Space Synthesis for Parallel Branches in LLM-Agent Workflows
- **Authors**: Shikun Liu, Mufei Li, Dongqi Fu, Haoyu Wang
- **Source**: https://arxiv.org/abs/2606.14672
- **Categories**: cs.AI, cs.CL
- **Summary**: Parallel-Synthesis enables a synthesizer to directly consume KV caches from parallel worker agents, bypassing text concatenation. Cache mapper calibrates independently-generated branch caches; fine-tuned synthesizer adapter enables generation from non-sequential cache interface. Matches or outperforms text-based synthesis on 7/9 datasets. Reduces time-to-first-token by **2.5–11×**.
- **Key finding**: Text is not the necessary interface between parallel agents. Direct KV-cache consumption eliminates the encode→decode→re-encode bottleneck for branch synthesis. The 2.5–11× TTFT reduction comes from eliminating redundant prefill computation.
- **Implication for us**: Extends KV-cache commerce (2606.13361, prior triage) and dense latent communication (2606.13594). The convergence: the text interface between agents is a lossy, expensive bottleneck that can be bypassed at the infrastructure level. For our system this is forward-looking infrastructure — we coordinate via text files today, but the direction of travel is toward pre-linguistic shared representations.

### [2606.14155] Graph-based Target Back-Propagation for Context Adaptation in Multi-LLM Agentic Systems
- **Authors**: Tan Zhu, Tong Yao, Kananart Kuwaranancharoen, Amit Singh
- **Source**: https://arxiv.org/abs/2606.14155
- **Categories**: cs.LG, cs.CL
- **Summary**: GTBP framework for automated prompt engineering in multi-agent workflows modeled as DAGs. Propagates local target outputs backward through the workflow graph, using target–output discrepancies to guide stage-wise prompt updates. Convergence guarantees. Outperforms baselines across three benchmarks at comparable cost.
- **Key finding**: Credit assignment in multi-agent prompt optimization is solvable via back-propagation through the workflow graph. Each agent's prompt can be optimized locally using the discrepancy between its output and what downstream agents needed — no global optimization required.
- **Implication for us**: This is "prompt compilation" (identified as a missing primitive in the Prompt Mass Problem synthesis) given a formal mechanism. If our workflow graph is modeled as a DAG, GTBP could automatically tune each agent's context/prompts based on downstream outcomes. The stage-wise update with convergence guarantees means this is a principled alternative to our current approach of manually adjusting agent contexts based on observed failures.

---

## ★★★ Lower Priority

### [2606.14397] Running the Gauntlet: Re-evaluating Agent Capabilities Beyond Familiar Environments (GauntletBench)
- SOTA agents achieve only **19.1%** success on unfamiliar professional applications (video editor, workflow builder, 3D modeler, flight analyzer, circuit designer) vs **80%+** for non-expert humans. Tests temporal perception, graphical understanding, and 3D reasoning. Highlights that current benchmark saturation reflects narrow capability measurement, not genuine general competence.
- **Implication**: Reinforces the Evaluation Mirage pattern at the benchmark level: saturated benchmarks measure benchmark-specific capability, not general agent competence. The 4× human-agent gap on unfamiliar tasks is the honest capability assessment.

### [2606.14261] Security in a Workflow: Role-Based Agentic Architectures for Vulnerability Handling
- Role-based workflow (Planner→Analyzer→Fixer→Verifier) for vulnerability analysis. 44% detection accuracy (comparable to GPT-5.5), but only **19% fix accuracy**. CodeQL integration in analyzer role.
- **Implication**: The 44% detect / 19% fix gap is the "capability gradient" — agents can identify problems much better than they can fix them. Connects to our evaluator findings: agents are better at judging than acting.

---

## Cross-Cutting Themes

### Theme 9: Guardrail Inversion — When Defenses Become Attack Surfaces

Three papers (2606.14517, 2606.14154, 2606.13994) independently reveal that **safety mechanisms themselves are vulnerable**, each through a different vector:

| Paper | Attack Vector | Mechanism | Detection by Current Defenses |
|-------|--------------|-----------|-------------------------------|
| Shield-to-Target (2606.14517) | DoS via reasoning loops | Guardrail's reasoning capability weaponized | N/A — availability attack, not evasion |
| SkillMutator (2606.14154) | Cross-modal language+code | Benign NL + benign code = malicious behavior | 2–17% (current scanners) |
| DeCompBench (2606.13994) | Task decomposition | Benign subtasks compose to harmful goal | High refusal on monolithic, low on decomposed |

**Hypothesis**: The safety-capability correlation has an inflection point. Below some capability threshold, adding reasoning to a guardrail improves safety. Above it, the guardrail's own reasoning capability creates new attack surfaces (DoS, adversarial exploitation of the guard's task-following). This predicts a shift from "smarter guardrails" to "cost-bounded, capability-limited guardrails" — guards that are deliberately less capable than the agents they protect, compensating with structural (non-reasoning) enforcement.

**Implication**: Connects to and refines the Compilation Gradient: the gradient now has a *safety ceiling* on the behavioral stage. Behavioral guards (LLM-based) have an inherent attack surface proportional to their capability. Compiled guards (deterministic checks) don't — they're not smart enough to be tricked. The optimal design uses compiled guards as the base layer with narrow, cost-bounded behavioral guards only for residual semantic cases.

### Theme 10: The Evolvable Harness

Two papers (2606.14249, 2606.14674) advance Harness Engineering from "harnesses matter" to "harnesses are learnable and evolvable artifacts":

| Dimension | Prior state (Arbor, Nexent) | New state (HarnessX, AgentSpec) |
|-----------|---------------------------|-------------------------------|
| Composition | Hand-crafted pipelines | Typed primitives, substitution algebra |
| Adaptation | Manual tuning | Trace-driven evolution (AEGIS) |
| Understanding | Black-box "it works" | Controlled ablation, interaction effects quantified |
| Key metric | Harness vs no-harness (6×) | Harness composition effects (+14.5% avg) |

**Hypothesis**: Harness engineering is transitioning from an art (expert-crafted scaffolding) to an engineering discipline (typed, composable, self-improving). The substitution algebra (HarnessX) + interaction effect analysis (AgentSpec) together provide a principled design methodology. This predicts that within 12 months, "harness configuration" will be as important a capability as "model selection" — and possibly more impactful for production systems.

### Theme 11: Fail-Plausible — A New Failure Class

Two papers (2606.14589, 2606.14574) converge on a failure class unique to LLM systems:

- **Silent failures** (2606.14589): The LLM transforms errors into plausible narratives — the observer is *lied to* by the failure.
- **Latent failures** (2606.14574): Plans contain hidden damage that doesn't trigger immediate feedback — 56% of plans, mostly irreversible.

The common structure: **the system produces confident, coherent output that contains hidden errors**. This is distinct from classical failure modes (crash, error, wrong answer) because the failure signal is actively suppressed by the LLM's fluency.

**Hypothesis**: Fail-plausible is the dominant failure mode for production LLM agent systems and will remain so as models become more capable (more fluent = better at narrating failures). The defense is structural: externalize state verification (Goal-Autopilot), add counterfactual foresight (SIMMER), and monitor for anomalous guard latency (Shield-to-Target). Model improvement alone will make fail-plausible *worse*, not better.

### Cumulative Theme Map (Themes 1–11)

| # | Theme | Core Papers (This Batch) | Prior Themes Connected |
|---|-------|--------------------------|----------------------|
| 1 | Fold, Don't Carry | — | Less Context, ActiveMem, HIPIF |
| 2 | Oversight is a Resource | Shield-to-Target (2606.14517), RACG (2606.13884) | Oversight Capacity, SMSR |
| 3 | Failure is Signal | SIMMER (2606.14574) | SENTINEL, SkillCAT, SGCD |
| 4 | Persistent State is Attack Surface | — | SMSR, Containment Gap, GT-MCP |
| 5 | The Containment Stack | DeCompBench (2606.13994) | DeLM, Autopilot, Containment Gap |
| 6 | Skills Are the New Attack Surface | SkillMutator (2606.14154) | RSA, SkillCAT, SkillAxe |
| 7 | Memory Architecture Convergence | — | DCPM, Infini Memory, ActiveMem |
| 8 | Verified Context as Coordination | tap (2606.14445) | DeLM, Autopilot, EinsteinArena |
| 9 | **Guardrail Inversion** | Shield-to-Target, SkillMutator, DeCompBench | Compilation Gradient |
| 10 | **The Evolvable Harness** | HarnessX (2606.14249), AgentSpec (2606.14674) | Arbor, Nexent, HarnessBridge |
| 11 | **Fail-Plausible** | Errors→Narratives (2606.14589), SIMMER (2606.14574) | Observability Trap, Evaluation Mirage |

---

## Sourcing Into Canonical Notes

| Finding | Target canonical note | What to add |
|---------|----------------------|-------------|
| HarnessX (2606.14249) | agent-architectures.md | Evolvable harness: substitution algebra, AEGIS trace-driven evolution |
| AgentSpec (2606.14674) | agent-architectures.md | Scaffold interaction effects > module strength, typed composition |
| Shield-to-Target (2606.14517) | agent-security-governance.md | Guardrail DoS: cost-bounded guard requirement, 148× latency amplification |
| SkillMutator (2606.14154) | agent-security-governance.md | Cross-modal skill attack surface, install-time scanning, distillation defense |
| DeCompBench (2606.13994) | agent-security-governance.md | Decomposition attacks: benign-parts-malicious-whole, trajectory-level safety |
| RACG (2606.13884) | agent-security-governance.md | Capability minimization, causal gating, least-privilege agents |
| Errors→Narratives (2606.14589) | agent-evaluation.md | Fail-plausible failure class, "audits are regression engines not prediction engines" |
| SIMMER (2606.14574) | agent-evaluation.md | Latent planning failures (56%), counterfactual foresight (−72%) |
| tap (2606.14445) | multi-agent-coordination.md | File-first heterogeneous coordination, tiered communication |
| GTBP (2606.14155) | agent-architectures.md | Prompt optimization via graph back-propagation, credit assignment |
| Parallel-Synthesis (2606.14672) | agent-architectures.md | KV-cache branch synthesis, text bottleneck bypass |
