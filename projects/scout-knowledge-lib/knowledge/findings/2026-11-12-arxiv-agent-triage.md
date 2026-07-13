<ai_context>
summary: "Triage of 10 arXiv papers (July 1-9, 2026 batch). Key themes: runtime repair via trajectory graphs (AgentTether), memory poisoning through forged reasoning (FARMA/SENTINEL), harness engineering formalized as contracts (Prompts-to-Contracts), CoT monitoring defeated by persuasion attacks, pre-execution scope gating (ScopeJudge), privacy spillage in shared agent systems (PiSAs), failure-driven data curation evolution (CurateEvo), object-centric executable memory (OCM)."
triggers: ["arXiv triage", "runtime repair", "AgentTether", "memory poisoning", "FARMA", "harness engineering", "contracts", "CoT monitoring", "persuasion attacks", "scope gating", "ScopeJudge", "privacy spillage", "shared agents", "PiSAs", "data curation", "CurateEvo", "object-centric memory", "OCM", "framework ecosystem"]
last_updated: "2026-11-12"
source_basis: "arXiv API queries: all:\"AI agent\" AND all:\"multi-agent\", all:\"LLM agent\" AND all:\"memory\", all:\"agent\" AND all:\"safety\" AND all:\"LLM\" (July 1-9, 2026 papers)"
</ai_context>

# arXiv Triage — July 1–9, 2026 (Batch 6)

*Triaged: 2026-11-12 | Source: `https://export.arxiv.org/api/query` | Queries: multi-agent, LLM memory, agent safety | Note: Supplements prior triages; no duplicates.*

---

## ★★★★★ High Relevance

### [2607.08028] From Prompts to Contracts: Harness Engineering for Auditable Enterprise LLM Agents
- **Source**: https://arxiv.org/abs/2607.08028
- **Categories**: cs.AI, cs.SE
- **Summary**: Formalizes the pattern of moving deterministic behavior into code/manifests/schemas around a replaceable composition boundary, while source-backed claims remain the authority for runtime answers. Evaluated on Korean corporate data across 3 models, 270 runs.
- **Key findings**: (1) Code-owned guarantees are load-bearing — prompt instructions alone let violations reach the reader. (2) Bolt-on external guardrails prevent violations but over-refuse, dropping utility to 88/120 vs harness's 120/120. (3) Model substitution doesn't break harness contracts — failures are confined to the model-composed side and are caught.
- **Implication for us**: This is our compilation gradient thesis validated empirically in a production setting. The paper proves what we hypothesized: deterministic code layers preserve both safety *and* utility, while prompt-only enforcement leaks and bolt-on guardrails over-refuse. The "replaceable composition boundary" is exactly our model of agent architecture. Direct successor to HarnessX (2606.14249) — HarnessX made harnesses evolvable, this paper makes them auditable and proves code-ownership is necessary.

### [2607.08066] Persuasion Attacks Can Decrease Effectiveness of CoT Monitoring
- **Source**: https://arxiv.org/abs/2607.08066
- **Categories**: cs.CR, cs.AI
- **Summary**: CoT monitoring — using visible reasoning traces to surface misaligned behavior — can be subverted by adversarial persuasion. An agent's scratchpad becomes an additional persuasion channel: monitor access to CoT *increases* approval of harmful actions by 9.5% on average. Fix: model-diverse fact-checking (different model families for monitor vs fact-checker) reduces approval of violations by up to 45%.
- **Key finding**: CoT transparency is a double-edged sword. The same channel that lets monitors observe reasoning also lets adversarial agents *persuade* monitors. This inverts the assumption that more visibility = more safety.
- **Implication for us**: Extends guardrail inversion (2606.14517 DoS paper). The pattern is consistent: safety mechanisms that rely on reasoning can be weaponized. Our system uses LLM-based evaluation of agent outputs — if an agent produces persuasive-looking reasoning, our evaluator may approve bad outputs. The model-diversity fix (different families for actor vs monitor) is actionable: if we use Claude for agents, use a different model family for oversight checks.

### [2607.06273] AgentTether: Graph-Guided Diagnosis and Runtime Intervention for Reliable LLM Agent Operation
- **Source**: https://arxiv.org/abs/2607.06273
- **Categories**: cs.AI, cs.SE
- **Summary**: Runtime repair framework that abstracts agent runs into Transition Units, links them through a dependency-aware Critical Transition Graph, and localizes failure-critical subtrajectories. Cross-iteration Repair Memory prevents recurring failures. Can deploy as offline diagnostic or online repair layer.
- **Key finding**: Agent repair is fundamentally different from static software repair — you must recover *dynamic trajectories* where early decisions propagate into later errors and external state changes. Blind retry, outcome feedback, and self-reflection each address only part of the problem. Graph-based dependency tracking is required to localize *where* a trajectory went wrong.
- **Implication for us**: The Repair Memory concept parallels our lesson/KE system — cross-session learning from failures. The Critical Transition Graph is a formal version of what we'd need to diagnose why an agent session went wrong: which decision point caused downstream failures? The "offline diagnostic vs online repair" duality maps to our post-session review vs real-time guard pattern.

### [2607.05029] Your Agent's Memories Are Not Its Own: Forged Reasoning Attacks (FARMA)
- **Source**: https://arxiv.org/abs/2607.05029
- **Categories**: cs.CR, cs.AI
- **Summary**: Introduces FARMA — poisoning an agent's *reasoning history* rather than factual knowledge. Forged reasoning traces use evasive language to bypass keyword defenses, then self-referential reinforcement defeats consensus defenses. SENTINEL defense uses structural analysis with five weighted signals.
- **Key finding**: The attack surface isn't just facts in memory — it's the *reasoning patterns* the agent recalls and imitates. A forged rationale ("I previously concluded X because Y") is more dangerous than a forged fact because it shapes future reasoning chains, not just answers.
- **Implication for us**: Our agents accumulate lessons and context files that include reasoning patterns. If a lesson contains subtly wrong reasoning (even from a legitimate but confused session), it could propagate. This isn't just an adversarial concern — it's a quality concern for organic knowledge accumulation. The SENTINEL structural-analysis approach could inform how we validate lessons before they enter the knowledge base.

### [2607.07774] ScopeJudge: Cost-Aware Pre-Execution Gating for Offensive Security Agents
- **Source**: https://arxiv.org/abs/2607.07774
- **Categories**: cs.CR, cs.AI
- **Summary**: Pre-execution gating where a cheap judge LLM inspects each tool call before execution. Benchmark of 4,897 tool calls labeled by professional pentesters. Key insight: scope lives in the user's *request*, not in any fixed policy — a static policy judge's recall collapses to near zero.
- **Key finding**: A static policy is structurally insufficient for scope enforcement. The same action is in/out of scope depending on context. Request-conditioned monitoring is necessary. The paper charts cost-accuracy Pareto frontiers across judge models and context strategies.
- **Implication for us**: Generalizes beyond security: our agents' scope boundaries are also request-dependent, not static. A guard that checks "is this action allowed?" without reference to what the user actually asked will always be either too permissive or too restrictive. The cost-aware Pareto approach (how much context does the judge need to see?) is directly applicable to our guard design — full transcript is expensive but blind policy is useless.

---

## ★★★★ Notable

### [2607.05318] PiSAs: Benchmarking Contextual Integrity in Multi-User Agentic Systems
- **Source**: https://arxiv.org/abs/2607.05318
- **Categories**: cs.CR, cs.AI
- **Summary**: Benchmark for privacy spillage in shared agent systems. Dual annotations: is information appropriate for the task, and which users may access it. Measures cross-user spillage through outputs, inter-agent messages, and memory.
- **Key finding**: Even state-of-the-art models fail to reliably filter inappropriate content or restrict transmission to authorized users. System design helps but is bottlenecked by LLM judgment.
- **Implication for us**: As our multi-agent system shares context files, spillage between logical contexts is possible. Information meant for one agent's task could leak through shared memory/files to another agent operating on behalf of a different concern.

### [2607.06140] CurateEvo: Failure-Driven Data Curation Evolution
- **Source**: https://arxiv.org/abs/2607.06140
- **Categories**: cs.CL, cs.AI
- **Summary**: Represents curation strategy as executable code, iteratively rewrites it using failed trajectories. Evolved strategy produces SFT data, RL data, and inference-time memory bank. +3.2 points on ACEBench-Agent.
- **Key finding**: Data curation should be adaptive and failure-driven, not fixed preprocessing. The curation strategy itself is a learnable artifact (echoes HarnessX's harness-as-learnable).
- **Implication for us**: The "curation strategy as code that evolves from failures" pattern applies to how we select/filter lessons and context. Our knowledge accumulation could benefit from an explicit, evolvable curation policy rather than append-everything.

### [2607.02846] Object-Centric Environment Modeling (OCM)
- **Source**: https://arxiv.org/abs/2607.02846
- **Categories**: cs.AI
- **Summary**: Organizes agent experience into executable object-centric models: object knowledge (Python classes defining entities/mechanisms) + procedure knowledge (reusable patterns that import the object model). Progressive knowledge disclosure: inspect signatures first, read source only when needed.
- **Key finding**: Executable, structured memory outperforms free-form textual memory. The object/procedure split and progressive disclosure reduce invalid actions.
- **Implication for us**: Progressive knowledge disclosure is relevant to our context loading problem — agents don't need all context upfront. The executable-model idea (memory that can be *run*, not just read) connects to our conventions-as-code pattern.

### [2607.02453] Adoption and Ecosystem Health: Longitudinal Analysis of Open-Source Multi-Agent Frameworks
- **Source**: https://arxiv.org/abs/2607.02453
- **Categories**: cs.MA
- **Summary**: Analysis of 15 frameworks (808K stars, 74K PRs, 86K commits). Stars are unreliable — AutoGPT got 112K stars in one month but <9 contributors/1000 stars. LangChain functions as shared infrastructure (82.5% of cross-ecosystem contributors). Retention drops most steeply in first 30 days.
- **Key finding**: Contributor density (contributors per 1000 stars) and cross-ecosystem engagement are better health metrics than stars. LangChain is the ecosystem's connective tissue regardless of its own quality.
- **Implication for us**: Useful signal for framework selection decisions. "Institutional backing alone does not ensure community depth" (openai-agents-python). The 30-day retention cliff suggests that framework onboarding experience is the critical adoption gate.

---

## ★★★ Background / Lower Relevance

### [2607.05593] Collective Cognition in Hybrid Groups: Network Science Synthesis
- Survey chapter on human-AI hybrid teams through network science lens. Useful framing (human gatekeepers of AI sub-networks become structurally central) but no empirical results.

### [2607.04948] Using Process Mining to Generate AI Agents from Software Engineering Process Records
- Discovers agent roles from repository event logs using process mining. Interesting concept (derive agent specs from actual workflow traces) but early proof-of-concept stage.

---

## Cross-Cutting Themes

1. **Safety mechanisms as attack surfaces** (Persuasion on CoT, FARMA on memory, prior: DoS on guardrails) — the pattern is now firmly established: any reasoning-based safety mechanism can be weaponized through the same reasoning channel it uses.

2. **Harness/contract formalization** (Prompts-to-Contracts, HarnessX, AgentSpec) — three consecutive batches have produced papers formalizing the harness. The field is converging on "code-owned deterministic contracts around a replaceable LLM composition boundary" as the architecture.

3. **Memory as liability** (FARMA, PiSAs, OCM) — persistent memory enables continuity but creates attack surfaces (poisoning), privacy risks (spillage), and quality decay (free-form accumulation). Structured, executable, access-controlled memory is the emerging answer.

4. **Scope is contextual, not static** (ScopeJudge, Institutional Red-Teaming) — no fixed policy can enumerate what's appropriate. Safety/scope must be inferred from the specific request and context, requiring request-conditioned monitoring.
