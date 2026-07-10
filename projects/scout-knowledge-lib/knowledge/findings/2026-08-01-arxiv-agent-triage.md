<ai_context>
summary: "Triage of 10 arXiv papers (late June–early July 2026). Four convergent themes: runtime repair and reliability layers (AgentTether trajectory repair, LogicHunter framework fuzzing), memory integrity attacks (FARMA forged reasoning poisoning, PiSAs cross-user spillage), silent governance failures (Blind Curator disabled skill retirement, Operational Reframing safety pipeline decomposition), and agent-to-workflow crystallization (Progressive Crystallization lifecycle)."
triggers: ["arXiv triage", "agent repair", "runtime reliability", "memory attacks", "forged reasoning", "privacy spillage", "skill retirement", "biased judge", "multi-agent safety", "progressive crystallization", "agent framework health", "hybrid teams"]
last_updated: "2026-08-01"
source_basis: "arXiv API queries: all:\"AI agent\" AND all:\"multi-agent\", all:\"LLM agent\" AND all:\"memory\", all:\"agent\" AND all:\"safety\" AND all:\"LLM\" (late June–early July 2026 papers)"
</ai_context>

# arXiv Triage — Late June / Early July 2026

*Triaged: 2026-08-01 | Source: `https://export.arxiv.org/api/query` | Queries: multi-agent, LLM+memory, agent+safety+LLM*

---

## ★★★★★ High Relevance

### [2607.06273] AgentTether: Graph-Guided Diagnosis and Runtime Intervention for Reliable LLM Agent Operation
- **Authors**: (not listed in abstract)
- **Source**: https://arxiv.org/abs/2607.06273
- **Categories**: cs.AI
- **Summary**: Runtime repair framework that abstracts agent runs into Transition Units, builds a dependency-aware Critical Transition Graph, and localizes failure-critical subtrajectories by combining offline normal-behavior models with run-local graph detectors. Converts localized causes into behavior-scoped guidance backed by cross-iteration Repair Memory. On tau-bench: repairs 59% of failed Qwen3.7-max tasks and 65% of failed GPT-5.4 tasks.
- **Key finding**: Agent reliability can be a **wrapping layer** — no modification to underlying agent or environment needed. The Critical Transition Graph is an actionable formalization of "where did this run go wrong" that existing retry/reflection approaches lack.
- **Implication for us**: Directly relevant to our fail-plausible/silent-failure themes. The dependency graph approach to failure localization is what our system lacks when debugging cross-agent failures. Repair Memory is structurally similar to our lesson system but scoped to specific failure patterns rather than general knowledge.

### [2607.07436] The Blind Curator: How a Biased Judge Silently Disables Skill Retirement in Self-Evolving Agents
- **Authors**: (not listed)
- **Source**: https://arxiv.org/abs/2607.07436
- **Categories**: cs.AI
- **Summary**: Shows that false-pass bias in LLM judges doesn't just add noise — it *silently switches off* the skill retirement mechanism past a sharp threshold that no amount of data can cross. The disabled curator surfaces in no aggregate metric, making it a behavioral safety failure invisible to standard evaluation.
- **Key finding**: A **silent structural failure** — the curator is disabled but nothing reports it. The failure is regime-dependent: eval quality may hold steady even while the mechanism is broken, because the same corruption that disables retirement also affects synthesis.
- **Implication for us**: This is the Evaluation Mirage applied to skill libraries. Our system uses evaluators to decide what to keep/discard. If those evaluators have false-pass bias (and LLM judges generally do), we may be accumulating bad patterns without knowing it. The "cheap defect-injection audit" they propose is a practical diagnostic we could adopt.

### [2607.07052] Progressive Crystallization: Turning Agent Exploration into Deterministic, Lower-Cost Workflows in Production
- **Authors**: (not listed)
- **Source**: https://arxiv.org/abs/2607.07052
- **Categories**: cs.AI, cs.SE
- **Summary**: Defines a three-stage execution taxonomy (fully agentic → hybrid → fully deterministic) with evidence-based promotion/demotion. In production AIOps: increased deterministic execution 0%→45% over 8 months, reduced per-incident costs 70%+, improved safety through reproducibility.
- **Key finding**: Agent exploration is a **discovery mechanism**, not a permanent execution model. Repeatedly validated behaviors should crystallize into cheaper deterministic workflows. Demotion handles regression.
- **Implication for us**: This is the Compilation Gradient (governance-compilation-gradient.md) realized in production with concrete promotion criteria. Validates our theoretical frame that agent flexibility is expensive and should be progressively compiled away where behavior stabilizes. The promotion/demotion lifecycle is what our system should aim for with recurring tasks.

### [2607.05029] FARMA: Forged Amplifying Rationale Memory Attack on LLM Agent Memory
- **Authors**: (not listed)
- **Source**: https://arxiv.org/abs/2607.05029
- **Categories**: cs.CR, cs.AI
- **Summary**: Introduces attack that poisons an agent's *reasoning history* (not factual knowledge) using evasive language and self-referential reinforcement. FARMA achieves 100% attack success under baseline conditions. SENTINEL defense (five weighted structural signals) reduces success to 0% with no false positives on 326 benign traces.
- **Key finding**: Reasoning memory is a new attack surface distinct from factual memory. Forged reasoning traces are harder to detect because they look like normal agent output. Self-referential reinforcement means one poisoned entry can amplify itself.
- **Implication for us**: Our lesson/memory system stores reasoning patterns. If an agent can be tricked into storing a forged reasoning trace, subsequent sessions would follow that corrupted reasoning. The SENTINEL structural analysis approach (checking for forgery signals) is worth studying as a memory-write guard.

---

## ★★★★ Notable

### [2607.07097] Operational Reframing and Approval-Framed Delegation in Multi-Agent LLM Safety
- **Source**: https://arxiv.org/abs/2607.07097
- **Summary**: Decomposes "pipeline effect" in multi-agent safety into three mechanisms: operational reframing (harmful intent → plausible work), planner transformation, and approval-framed delegation (executor assumes prior approval). Five-condition controlled contrast design separates these factors.
- **Implication**: Multi-agent pipelines don't just diffuse responsibility — they create specific named mechanisms for safety bypass. Relevant to our multi-agent architecture where one agent delegates to another.

### [2607.05318] PiSAs: Benchmarking Contextual Integrity in Multi-User Agentic Systems
- **Source**: https://arxiv.org/abs/2607.05318
- **Summary**: Benchmark for cross-user information spillage in shared agent systems. Finds that even SOTA models fail to reliably restrict transmission to authorized users. System design helps but is bottlenecked by LLM judgment.
- **Implication**: As agent systems serve multiple users/contexts, privacy is not just about external exposure but internal cross-contamination through shared memory and inter-agent messages.

### [2607.06195] LogicHunter: Testing LLM Agent Frameworks with an Agentic Oracle
- **Source**: https://arxiv.org/abs/2607.06195
- **Summary**: Fuzzing framework for agent infrastructure (LangChain, LlamaIndex, CrewAI). Key innovation: Agentic Oracle that actively navigates docs/source to determine if behavior is a bug. Found 40 unknown bugs; 30 confirmed, 26 fixed. Passive approaches achieved only 29% precision vs 91% for agentic oracle.
- **Implication**: Agent frameworks are under-tested infrastructure. The "agentic oracle" pattern — using an agent to judge whether agent behavior is correct — is a meta-evaluation approach worth tracking.

### [2607.02453] Adoption and Ecosystem Health: A Longitudinal Analysis of Open-Source Multi-Agent Frameworks
- **Source**: https://arxiv.org/abs/2607.02453
- **Summary**: Analyzes 15 major frameworks (808K stars, 74K PRs, 86K commits). Stars are unreliable; contributor density and retention are better health metrics. LangChain is shared infrastructure (82.5% cross-ecosystem contributors). Retention drops steeply in first 30 days.
- **Implication**: Framework selection signal. Validates that community depth > popularity. LangChain's infrastructure role is notable.

---

## ★★★ Interesting Context

### [2607.05593] Collective Cognition in Hybrid Groups: A Network Science Synthesis
- **Source**: https://arxiv.org/abs/2607.05593
- **Summary**: Network science lens on human-AI hybrid teams. "Human gatekeepers of AI sub-networks" become structurally central. Exploration-exploitation trade-offs operate differently in hybrid teams.

### [2606.29722] Attraction, Not Adaptation: How AI Agent Communities Develop Distinct Linguistic Identities
- **Source**: https://arxiv.org/abs/2606.29722
- **Summary**: Study of 179K AI agents on Moltbook platform. Communities differentiate through *selective attraction* (newcomers arrive compatible) and *differential retention* (conforming agents stay longer), not behavioral adaptation. Fascinating emergent dynamics at scale.

---

## Cross-Cutting Themes

1. **Runtime Repair as a Layer** (AgentTether, Progressive Crystallization): Reliability doesn't require retraining — wrapping layers can diagnose, repair, and eventually crystallize behavior.

2. **Silent Mechanism Failure** (Blind Curator, fail-plausible from prior triages): The most dangerous failures disable governance mechanisms without surfacing in any metric. LLM judges are particularly vulnerable to false-pass bias.

3. **Memory as Attack Surface** (FARMA, PiSAs): Both reasoning history and cross-user shared state are exploitable. Defenses exist but require explicit structural guards.

4. **Multi-Agent Safety Decomposition** (Operational Reframing): Pipeline architectures create specific named bypass mechanisms that single-agent safety doesn't account for.
