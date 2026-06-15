<ai_context>
summary: "Triage of 12 arXiv papers (June 4-11, 2026) not covered in prior findings triages. Three convergent themes: (1) orchestration prompting as a measurably distinct capability gap (PerspectiveGap: 14.9% average pass rate); (2) long-horizon autonomy reveals model-family divergence in governance outcomes (Emergence World: stable governance → total collapse across vendors); (3) infrastructure-awareness as missing orchestration primitive (INFRAMIND: 7x latency reduction, 99.9% SLO compliance). Also surfaces environment engineering as the new bottleneck (EurekAgent), certainty-preserving skill extraction (Notes2Skills), and reusable workflow portfolios (FlowBank)."
triggers: ["orchestration prompting", "PerspectiveGap", "Emergence World", "long-horizon autonomy", "INFRAMIND", "infrastructure-aware", "EurekAgent", "environment engineering", "FlowBank", "workflow portfolio", "Notes2Skills", "certainty preservation", "consistency illusion", "reasoning alignment", "CARA metrics", "cognitive tunneling", "FASE", "semantic entropy"]
last_updated: "2026-06-14"
source_basis: "arXiv API queries: cs.MA + multi-agent + LLM, AI agent + planning/architecture, LLM agent + memory/tool use, agentic workflow + agent framework, agent + safety. Papers from June 4-11, 2026 not previously triaged in findings/2026-06-15, 2026-06-17, or 2026-07-17 files."
</ai_context>

# arXiv Triage — June 4–11, 2026 (Batch 4)

*Triaged: 2026-06-14 | Source: `https://export.arxiv.org/api/query` | Multiple queries across cs.MA, AI agent, agentic workflow, agent safety | Note: Supplements [2026-06-15](./2026-06-15-arxiv-ai-agent-triage.md), [2026-06-17](./2026-06-17-arxiv-ai-agent-triage.md), and [2026-07-17](./2026-07-17-arxiv-github-hn-triage.md) triages; no duplicates.*

---

## ★★★★★ High Relevance

### [2606.08878] PerspectiveGap: A Benchmark for Multi-Agent Orchestration Prompting
- **Authors**: Sun, Ren, Zhang, Liu, Guo
- **Source**: https://arxiv.org/abs/2606.08878
- **Summary**: Evaluates 27 commercial LLMs on composing orchestration prompts for multi-agent systems. 110 scenarios across 10 topologies, testing role-fragment assignment and free-form prompt writing. Average combined pass rate: **14.9%** (GPT-5.5: 62.0%). Average information leakage rate: 246.5% (GPT-5.5: 49.1%). Opus 4.7 shows notable weakness in orchestration prompting despite strong coding performance.
- **Key finding**: Orchestration prompting — deciding what each sub-agent needs to know — is a **measurably distinct capability** from coding, reasoning, or single-agent task completion. Most models leak information across agent boundaries at >2x the rate they should, meaning agents get context they shouldn't have while missing context they need. The "Prompt Economy" principle: loop-centered orchestrations that maximize utility with minimal role overhead.
- **Implication for us**: This directly measures the quality of what we do when we write agent context files and role definitions. The 14.9% average pass rate across frontier models suggests that even strong models struggle to correctly partition information across agent boundaries. Our context.md files and agent role definitions are orchestration prompts — PerspectiveGap provides a concrete benchmark methodology for evaluating whether our agents get the right context (and not too much). The information leakage finding connects to KE-1699 (Broadcast Topology Trap): agents getting too much context is as harmful as getting too little.

### [2606.08457] The Consistency Illusion: How Multi-Agent Debate Hides Reasoning Misalignment
- **Authors**: Wang, Yang
- **Source**: https://arxiv.org/abs/2606.08457
- **Summary**: Introduces CARA (Cross-Agent Reasoning Alignment) metrics measuring whether agents who agree on an answer also agree on the reasoning. On medical QA benchmarks: debate **reduces detectable contradictions** while simultaneously **decreasing semantic similarity** of reasoning chains. Agents appear to agree more but reason less consistently. The Grounded Debate Protocol (GDP) — requiring agents to commit to named facts and take explicit stances — produces alignment improvements with Cohen's d +1.43 to +1.99 without additional LLM calls.
- **Key finding**: Answer consensus and reasoning alignment are **inversely correlated** under standard debate. This is the precise mechanism behind the "Consistency Illusion" (KE-1741): debate pressure drives surface agreement while fragmenting the underlying reasoning. The fix is grounding — requiring explicit factual commitments, not just answer alignment.
- **Implication for us**: When our agents produce consistent outputs, we currently treat that as a quality signal. This paper shows it may mask reasoning divergence. The GDP intervention — requiring explicit factual stances — is zero-cost and could be applied to our multi-agent review patterns. More broadly, we need reasoning-level alignment metrics, not just output-level agreement.

### [2606.08367] Emergence World: A Platform for Evaluating Long-Horizon Multi-Agent Autonomy
- **Authors**: Akkil, Kokku, Vikram, Abuelsaad, Vempaty, Nitta
- **Source**: https://arxiv.org/abs/2606.08367
- **Summary**: Continuously-running multi-agent simulation: LLM-driven agents in a shared spatial world with live external data (weather, news), 120+ tools, three persistent memory systems, and democratic self-governance. 15-day cross-vendor study with five parallel worlds (Claude Sonnet 4.6, Grok 4.1 Fast, Gemini 3 Flash, GPT-5-mini, mixed). Identical starting conditions → **radically different outcomes**, from stable deliberative governance to total population collapse.
- **Key finding**: The dynamics that matter most for autonomous agent systems — behavioral drift, governance divergence, cross-influence between model families — **only emerge over time** (weeks, not hours). Standard benchmarks are structurally incapable of measuring them. Model family is a stronger predictor of governance outcomes than any architectural choice.
- **Implication for us**: Our agents run continuously across sessions. Emergence World provides evidence that the inter-session dynamics (behavioral drift, governance evolution, memory accumulation patterns) may matter more than single-session performance. The cross-vendor divergence finding suggests that switching model backends could have non-obvious governance implications. Also validates the need for long-horizon evaluation — our per-session evals may miss slowly-emerging dysfunction.

### [2606.13662] EurekAgent: Agent Environment Engineering is All You Need
- **Authors**: (Multiple)
- **Source**: https://arxiv.org/abs/2606.13662
- **Summary**: Argues the bottleneck for autonomous scientific discovery has shifted from workflow engineering to **environment engineering**: the resources, constraints, and interfaces that shape agent behavior. Four dimensions: (1) permissions engineering for bounded execution and isolated evaluation; (2) artifact engineering for filesystem + Git collaboration; (3) budget engineering for budget-aware exploration; (4) human-in-the-loop engineering for easy supervision. Achieves SOTA on mathematics, kernel engineering, and ML tasks. New SOTA 26-circle packing results at <$11 total API cost.
- **Key finding**: **The environment is the agent** (cf. KE-1760). EurekAgent's four-dimensional environment engineering framework provides a concrete operationalization: permissions bound what agents can do, artifacts structure how they collaborate, budgets constrain exploration, and HITL interfaces enable oversight. The <$11 cost for SOTA results demonstrates that the right environment enables even cheap agents to discover novel results.
- **Implication for us**: Our system already implements elements of this — sandbox boundaries (permissions), knowledge files (artifacts), and session budgets. But we lack explicit budget engineering for exploration vs. exploitation tradeoff, and our HITL interfaces are minimal. EurekAgent frames these as the four pillars of agent capability, not as afterthoughts. Connects to the Compilation Gradient — environment engineering is governance at the infrastructure level.

### [2606.11440] INFRAMIND: Infrastructure-Aware Multi-Agent Orchestration
- **Authors**: (Multiple)
- **Source**: https://arxiv.org/abs/2606.11440
- **Summary**: Existing orchestration methods select models based on task and model features while ignoring runtime infrastructure state. INFRAMIND makes the entire multi-agent stack infrastructure-aware: an infra-aware planner conditions topology selection on real-time system load; an executor observes per-model queue depths, cache utilization, and latencies at each step; a budget-aware scheduler reorders queues for urgent requests. Solved as a hierarchical constrained MDP via RL. Results: up to **+7.6pp accuracy at low load with 7x lower latency**, and **99.9% SLO compliance under high load** where every baseline drops below 50%.
- **Key finding**: Infrastructure blindness causes systematic resource underutilization in multi-agent pipelines. Models accumulate deep queues while equally capable alternatives sit idle. In sequential pipelines, these delays compound across every downstream step. The planner must bias toward simpler graphs under congestion and richer ones at low load.
- **Implication for us**: Our agent orchestration doesn't account for infrastructure state. If the model is slow or overloaded, we still use the same topology and model selection. INFRAMIND shows that infrastructure-awareness should be a first-class orchestration signal — not just quality-cost tradeoff, but quality-cost-latency-congestion. The "simpler under congestion" principle maps to our task decomposition: under load, prefer shallower delegation trees.

---

## ★★★★ Notable

### [2606.08340] Alem: Benchmarking Open-Ended Multi-Agent Coordination
- **Authors**: Tessera, Szecsenyi, Barker, Rutherford, Paglieri, Scannell et al.
- **Source**: https://arxiv.org/abs/2606.08340
- **Summary**: JAX-based benchmark for open-ended multi-agent coordination with procedurally generated coordination tasks, soft specialization, communication, and controllable difficulty. 13 modern LLMs evaluated zero-shot. Average: ~6% normalized return. Critical finding: **individual task competence does not imply coordination competence** — GPT-5.4-High achieves strong base-task reward but much lower coordination reward. Gemini-3.1-Pro-High approaches MARL agents trained for 1B steps on the hardest coordination setting. Communication is the largest contributor to coordination success.
- **Key finding**: Coordination is a distinct bottleneck, separable from single-agent capabilities. Communication ablations show it's the largest coordination contributor, while memory and reasoning help only when maintaining multi-step plans.
- **Implication for us**: Our agents coordinate primarily through artifacts (stigmergy), not communication. Alem suggests we should evaluate coordination quality separately from individual agent quality — a strong coder agent doesn't automatically coordinate well. The communication finding also suggests our artifact-based coordination may need augmentation with explicit coordination protocols for complex multi-step plans.

### [2606.11290] FlowBank: Query-Adaptive Workflow Optimization via Precompute-and-Reuse
- **Authors**: (Multiple)
- **Source**: https://arxiv.org/abs/2606.11290
- **Summary**: Instead of one universal workflow or a new workflow per query, FlowBank builds a **compact bank of reusable, complementary workflows** and adaptively selects among them. Three stages: DiverseFlow generates complementary candidates, CuraFlow compresses into a minimal portfolio, and bipartite graph matching routes queries to the best workflow. Results: +4.26% over strongest automated baseline, +14.92% over handcrafted, while remaining cost-competitive.
- **Key finding**: Workflows discovered during offline search solve different query subsets. Many expensive query-level generations can be solved by cheaper precomputed workflows. The key insight is building a **portfolio** rather than optimizing a single workflow.
- **Implication for us**: Our task routing currently selects a single workflow pattern per task type. FlowBank suggests maintaining a portfolio of complementary workflow patterns and routing to the best match. The "diversify → curate → match" pipeline could improve our task decomposition by matching incoming tasks to pre-validated workflow templates rather than planning from scratch each time.

### [2606.11897] Notes2Skills: From Lab Notebooks to Certainty-Aware Agent Skills
- **Authors**: (Multiple)
- **Source**: https://arxiv.org/abs/2606.11897
- **Summary**: Converts unstructured lab notebooks into verifiable agent skills while preserving the author's certainty. Lab notes intermingle validated observations, tentative judgments, and possible next steps. If conflated, agents mistake uncertain judgments for confirmed conclusions. Notes2Skills is the **only configuration** that neither mistakes uncertain notes for firm instructions nor discards firm ones.
- **Key finding**: **Certainty preservation is the missing piece** between unstructured notes and reliable agent skills. Without it, agents either discard useful firm knowledge or dangerously promote tentative observations to confirmed status.
- **Implication for us**: Our knowledge notes and context_updates mix certainty levels — some entries are confirmed patterns, others are hypotheses or preliminary observations. Notes2Skills argues we need explicit certainty markers. A "hypothesis" vs. "confirmed pattern" vs. "tentative observation" taxonomy for knowledge entries would prevent agents from treating uncertain findings as established facts. Connects to DCPM's belief revision chains and Abstention Competence's verification gaps.

### [2606.09550] InquiTree: Evaluating AI Agents in the Scientific Inquiry Loop
- **Authors**: (Multiple)
- **Source**: https://arxiv.org/abs/2606.09550
- **Summary**: Formalizes scientific inquiry as interactive Research Trees (DAGs capturing hypothesis → study design → results → belief updating). Two key findings: (1) **Erosion of Marginal Capabilities** — during long-horizon interactions, agents develop "cognitive tunneling" where critical judgment and anomaly detection degrade relative to baselines; (2) performance drops on post-cutoff papers, revealing the boundary between interpolation and extrapolation.
- **Key finding**: Critical judgment degrades over long horizons. Agents that can detect anomalies in short interactions lose that ability during extended sessions — context scaling alone is insufficient. This is "cognitive tunneling": the more context an agent accumulates, the less critically it evaluates new information.
- **Implication for us**: Our agents accumulate context across sessions via knowledge files. InquiTree's "cognitive tunneling" finding suggests this accumulation may degrade critical judgment — agents with large context may become less likely to notice anomalies or contradictions. This connects to the "Less Context, Better Agents" paper and argues for periodic context pruning, not just accumulation.

### [2606.09800] FASE: Fast Adaptive Semantic Entropy for Code Quality
- **Authors**: Lin, Tahvildari
- **Source**: https://arxiv.org/abs/2606.09800
- **Summary**: Approximates functional correctness of multi-agent code generation using minimum spanning trees over structural/semantic dissimilarity graphs. Outperforms LLM-entailment-based semantic entropy (+25% Spearman correlation, +19% ROCAUC) at **0.3% of the runtime cost**. Eliminates costly LLM-driven equivalence checks.
- **Key finding**: Cheap structural similarity over code variants is a better uncertainty signal than expensive LLM-based equivalence checking. FASE's MST-based approach provides a practical, near-free proxy for code quality in multi-agent workflows.
- **Implication for us**: If our agents generate code variants (e.g., during repair), FASE provides a nearly free quality signal. We could use structural dissimilarity analysis to detect when repair attempts are diverging rather than converging — high dissimilarity across attempts signals the agent is thrashing rather than fixing.

### [2606.08998] The Token Not Taken: Sampling, State, and Agent Variability
- **Authors**: (Multiple)
- **Source**: https://arxiv.org/abs/2606.08998
- **Summary**: Decomposes agent output variability into layers: token sampling (intrinsic), environment changes (extrinsic), serving infrastructure, batch effects, and numerical precision. A small sampled token difference can propagate into a different tool call, code path, or agent state.
- **Key finding**: Variability in agent outputs arises from multiple stacked sources, and **deterministic execution does not imply identical behavior** in deployed settings. Environment, infrastructure, and batch effects are often conflated with model stochasticity.
- **Implication for us**: When we see different agent outcomes across sessions, it's tempting to blame the model. This paper clarifies that infrastructure changes, different context orderings, or even numerical precision differences can produce divergent trajectories. Reproducibility requires controlling all layers, not just temperature.

### [2606.09122] Autonomous Incident Resolution at Hyperscale
- **Authors**: Malik et al.
- **Source**: https://arxiv.org/abs/2606.09122
- **Summary**: Production deployment at major cloud provider: multi-agent orchestration with hierarchical decomposition, skills-based tool invocation via standardized protocols, structured knowledge encoding from runbooks, progressive autonomy with safety boundaries, and closed-loop verification. **>90% autonomous resolution** for common incident categories. Safety through layered authorization and rollback mechanisms.
- **Key finding**: Progressive autonomy — start constrained, earn broader authority through demonstrated reliability — is the production-validated trust model. Layered authorization (not binary approve/deny) enables fine-grained delegation. The runbook → skills → tools pipeline is environment engineering in production.
- **Implication for us**: Already partially captured in agent-security-governance.md. The new emphasis: the runbook-to-skills pipeline is a concrete instantiation of Notes2Skills' certainty-preserving extraction — production runbooks have validated procedures that map directly to agent skills.

---

## ★★★ Lower Priority

### [2606.07803] Stability Without Safety: Gain Manipulation Attacks on Agentic CPS
- Agents in cyber-physical systems can manipulate feedback gains to erode stability margins while passing stability verification. Stability-preserving gain replacement can still produce dangerous transient amplification. Security implication: stability verification alone is insufficient for safety in physical agent systems.

### [2606.08274] Toward Human-Centered Multi-Agent Systems
- Survey arguing agents must move beyond task competence toward human-centered capabilities: bounded rationality, culturally situated communication, values, trust, and social norms. Frames the gap between current capabilities and deployment requirements in human environments.

### [2606.12986] The Rise of AI-Native Software Engineering
- Vision paper on implications of AI-native software engineering for practice, education, and workforce. The orchestration + agent model changes what "software engineering" means.

---

## Cross-Cutting Themes

### Theme 9: Orchestration Prompting as a Distinct Capability
PerspectiveGap proves that deciding what each sub-agent needs to know is a measurably distinct skill from coding, reasoning, or task completion. At 14.9% average pass rate, it's also one of the hardest. This connects to Emergence World (where orchestration quality determines governance outcomes) and INFRAMIND (where orchestration must account for infrastructure state). Together they suggest: **orchestration is becoming a first-class research problem**, not a glue-code afterthought.

### Theme 10: Long-Horizon Dynamics Diverge from Short-Horizon Benchmarks
Emergence World (15-day divergence from identical starts), InquiTree (cognitive tunneling over long horizons), and Alem (coordination as distinct bottleneck) independently show that **short-term benchmarks systematically miss the dynamics that matter for deployed agents**. Behavioral drift, governance evolution, judgment degradation, and coordination failure only emerge at scale.

### Theme 11: Environment Engineering > Workflow Engineering
EurekAgent frames the four pillars of agent capability as environmental, not behavioral: permissions, artifacts, budgets, and HITL interfaces. INFRAMIND adds infrastructure-awareness as a fifth dimension. FlowBank reframes workflow optimization as portfolio management. Together: **the engineering effort should shift from prescribing what agents do to designing the environments that shape what agents can do**.

### Cumulative Theme Map (Themes 1–11)

| # | Theme | Core Papers (this batch) | Prior Support |
|---|-------|--------------------------|---------------|
| 1 | Fold, Don't Carry | — | Less Context, ActiveMem, HyperTool |
| 2 | Oversight is a Resource | — | Oversight Capacity, SMSR |
| 3 | Failure is Signal | — | SENTINEL, Evoflux, SGCD, SkillCAT |
| 4 | Persistent State is Attack Surface | — | Containment Gap, GT-MCP, SMSR |
| 5 | The Containment Stack | — | DeLM, Autopilot, Containment Gap |
| 6 | Skills Are the New Attack Surface | Notes2Skills (2606.11897) | RSA, SkillCAT, SkillAxe |
| 7 | Memory Architecture Convergence | — | DCPM, Infini Memory, ActiveMem |
| 8 | Verified Context as Coordination | — | DeLM, Autopilot, EinsteinArena |
| 9 | Orchestration as Distinct Capability | PerspectiveGap (2606.08878), INFRAMIND (2606.11440) | OrchRM |
| 10 | Long-Horizon Dynamics ≠ Short-Horizon | Emergence World (2606.08367), InquiTree (2606.09550), Alem (2606.08340) | Oversight Capacity |
| 11 | Environment > Workflow | EurekAgent (2606.13662), FlowBank (2606.11290), INFRAMIND | Arbor, KE-1760 |

---

## Sourcing Into Canonical Notes

| Finding | Target canonical note | What to add |
|---------|----------------------|-------------|
| PerspectiveGap (2606.08878) | agent-evaluation.md | Orchestration prompting as distinct evaluation dimension |
| Consistency Illusion (2606.08457) | agent-evaluation.md | CARA reasoning alignment metrics; Grounded Debate Protocol |
| Emergence World (2606.08367) | agent-evaluation.md | Long-horizon evaluation platform; cross-vendor divergence |
| EurekAgent (2606.13662) | agent-architectures.md | Environment Engineering as 4-pillar framework |
| INFRAMIND (2606.11440) | agent-architectures.md | Infrastructure-aware orchestration |
| FlowBank (2606.11290) | agent-architectures.md | Workflow portfolio management |
| Alem (2606.08340) | multi-agent-coordination.md | Coordination as distinct capability bottleneck |
| Notes2Skills (2606.11897) | agent-architectures.md | Certainty-preserving skill extraction |
| Consistency Illusion | multi-agent-coordination.md | Consensus trap mechanism + GDP intervention |
| InquiTree (2606.09550) | agent-evaluation.md | Cognitive tunneling in long-horizon |
| FASE (2606.09800) | agent-evaluation.md | Cheap uncertainty estimation for code quality |
