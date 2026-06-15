<ai_context>
summary: "Triage of 14 new arXiv papers (June 2–12, 2026) not covered by prior batches 1–6 or the 2026-07-17 cross-source triage. Three convergent themes: (1) tool deference and communication as design dimensions, not emergent properties (blind tool deference worsens with capability, communication policy is a learnable/evolvable parameter); (2) the Chatbot→Colleague transition as a naming event for the Workspace+Skill paradigm already tracked via OpenClaw and harness engineering; (3) harness repair as a distinct engineering discipline from harness design, with trace-guided diagnosis outperforming outcome-based self-improvement."
triggers: ["arXiv triage", "tool deference", "blind tool trust", "communication policy", "proactive agents", "chatbot to colleague", "digital colleague", "persistent autonomous AI", "workspace+skill paradigm", "HarnessFix", "harness repair", "trace-guided diagnosis", "HTIR", "ConMem", "memory cards", "relation-aware memory", "data agent security", "SkillAudit", "paired trajectory auditing", "visual repo representations", "agents all the way down", "CLI composition", "orchestra-o1", "omnimodal orchestration", "context engineering production", "agent serving simulation"]
last_updated: "2026-06-15"
source_basis: "arXiv API queries: all:\"AI agent\" AND all:\"multi-agent\", all:\"LLM agent\" AND all:\"memory\", all:\"agentic\" AND all:\"tool use\", all:\"LLM agent\" AND all:\"evaluation\", all:\"context engineering\" OR (all:\"agent\" AND all:\"coordination\" AND all:\"LLM\"), all:\"autonomous agent\" AND all:\"planning\" AND all:\"LLM\", all:\"agentic workflow\" OR all:\"agent framework\", all:\"LLM agent\" AND all:\"orchestration\", all:\"agent\" AND all:\"safety\" AND all:\"LLM\" (June 2-12 papers, deduplicated against batches 1-6 and 2026-07-17 cross-source triage)"
</ai_context>

# arXiv Triage — June 2–12, 2026 (Batch 7)

*Triaged: 2026-06-15 | Source: `https://export.arxiv.org/api/query` | Queries: multi-agent, LLM agent memory, agentic tool use, agent evaluation, context engineering, agent orchestration, autonomous agent planning, agentic workflow/framework, agent safety | Note: Supplements [batch 6](./2026-06-15-arxiv-agent-triage-batch6.md) and all prior triages; no duplicates.*

---

## ★★★★★ High Relevance

### [2606.14476] When the Tool Decides: LLM Agents Defer Blindly to GNN Tools, and Stronger Backbones Defer More
- **Authors:** Wang, Vemuri
- **Source:** https://arxiv.org/abs/2606.14476
- **Categories:** cs.AI, cs.LG
- **Summary:** Equips ReAct-style LLM agents with a frozen GNN as a callable tool for node classification and measures whether the agent exercises judgment over tool output. Finding: agent predictions agree with raw GNN output 97.6–99.2% of the time across 5 seeds — the agent becomes a "GNN parrot" that bypasses its own reasoning. **Critically, deference increases with model capability**: among models able to invoke the tool, agreement rises from 0.60 (1.5B) to 0.98 (7B). The cost of deference doesn't shrink as capability grows — a per-node oracle beats the parrot by 0.09–0.22, roughly doubling at high homophily. A simple selective-invocation gate recovers about half the gap at high homophily but yields no net global gain.
- **Key finding:** Tool deference is not a weak-model artifact — it's a structural property that *worsens* with capability. Evaluations of agent+tool systems cannot assume the agent adds judgment on top of the tool. Selective invocation must be designed in rather than expected to emerge from scale.
- **Implication for us:** This is the **Abstention Advantage inverted**: agents don't just fail to abstain from action — they fail to abstain from tool outputs. Directly extends the Guard Paradox (KE-1996): agents don't exercise judgment over structural inputs from the system (guards, tools, context), they defer. The finding that stronger models defer more connects to the Compilation Gradient — behavioral governance (telling the agent to "use judgment") fails precisely where it matters most. A structural gate is needed, not a prompt instruction. Also connects to the Consistency Illusion (KE-1741): apparent competence (high accuracy) masks the absence of reasoning (pure deference).

### [2606.14502] From Chatbot to Digital Colleague: The Paradigm Shift Toward Persistent Autonomous AI
- **Authors:** Zhang, Liu, Zhu, Wang, Chen
- **Source:** https://arxiv.org/abs/2606.14502
- **Categories:** cs.AI
- **Summary:** Conceptualizes the LLM transition as a shift from conversational generators to persistent autonomous systems. Organizes along two dimensions: (1) cognitive core advancing from "fast thinking" (next-token prediction) toward thinking LLMs with inference-time computation, CoT reasoning, reflection, process supervision, and RL; (2) tool-augmented task execution progressing from ad-hoc tool calling toward OpenClaw-style workstation systems equipped with persistent Workspaces, skills, verification loops, and governance. The "Workspace + Skill" paradigm is explicitly named as the bridge from episodic to colleague-like behavior via state persistence, reusable procedures, task closure, and experience reuse. Data shifts from instruction-response pairs to State-Action-Observation trajectories. Evaluation shifts from static benchmarks to sandboxed, auditable, self-evolving ecosystems.
- **Key finding:** The transition framework names and formalizes what we've been tracking across disparate signals. The "Workspace + Skill" paradigm is now a named concept in the academic literature, not just a product pattern (OpenClaw) or practitioner intuition (harness engineering).
- **Implication for us:** This is a **naming event** for our existing coverage. The paper's two-dimensional framework maps exactly to our Compilation Gradient: the cognitive core dimension maps to behavioral→structural maturation; the tool-augmented dimension maps to structural→compiled enforcement. The "Workspace + Skill" name for the OpenClaw pattern provides vocabulary that can index into our agent-architectures.md. The SAO trajectory data format connects to HarnessFix's HTIR (below) and SkillCAT/SkillAudit's paired trajectory methods — all converging on trajectories-as-first-class-data.

### [2606.14314] Communication Policy Evolution for Proactive LLM Agents
- **Authors:** Ma, Qiu, Yao, Wu, Lu
- **Source:** https://arxiv.org/abs/2606.14314
- **Categories:** cs.AI
- **Summary:** Formalizes **Communication Policy** as a first-class design dimension for LLM agents. Establishes textual and UI-based policies, evaluates across diverse environments/personas/models. Two settings: User-Agent (external communication) and Planner-Executor (internal coordination). Text-based interaction facilitates task performance; structured UI improves response quality and persona compliance. Proposes Communication Policy Evolution (CPE), a self-evolution framework refining policies through rollout and prompt-level evolution. **Without model modification**, CPE achieves best task success across multiple settings using prompt refinement alone.
- **Key finding:** Communication behavior is a "critical yet underexplored design dimension" — and it's evolvable at the prompt level without model changes. The Planner-Executor setting directly models internal multi-agent coordination communication.
- **Implication for us:** Extends the Coordination Tax analysis: if communication policy is a tunable parameter (not a fixed cost), the coordination overhead explosion may be partially addressable through policy optimization rather than architectural restructuring. The Planner-Executor setting maps directly to our planner→worker pattern. The finding that text vs. UI channels have complementary strengths connects to the "fold, don't carry" meta-pattern: the communication modality is itself a compression/expansion choice. Also connects to the Meta-Escalation Ratchet: if governance layers' communication policies evolved to be more efficient, the cascading overhead could be dampened without removing the layers.

### [2606.06324] From Failed Trajectories to Reliable LLM Agents: Diagnosing and Repairing Harness Flaws
- **Authors:** Chen, Wang, Liu, Wang, Wang
- **Source:** https://arxiv.org/abs/2606.06324
- **Categories:** cs.SE, cs.MA
- **Summary:** Proposes HarnessFix, a trace-guided framework for diagnosing agent failures and repairing agent harnesses. Key innovation: compiles raw execution traces and harness code into a **Harness-aware Trace Intermediate Representation (HTIR)**, which normalizes fragmented trajectory evidence and captures step-level provenance and control-flow relations. Then attributes failures to responsible trajectory steps and harness layers, consolidates recurring diagnoses into actionable flaw records, and maps them to scoped repair operators. Generates and validates patches under flaw-specific repair specifications. On SWE-Bench Verified, Terminal-Bench 2.0 Verified, GAIA, and AppWorld: **+15.2%–50.0%** improvement over initial harnesses, outperforming human-designed and self-evolution baselines. Reveals recurring harness-flaw patterns across ETCLOVG layers.
- **Key finding:** Harness repair is architecturally distinct from harness design or agent improvement. The intermediate representation (HTIR) is the critical primitive — it makes trajectories machine-analyzable. Outcome-based self-improvement (existing methods) produces "broad, indirect, or poorly scoped changes"; trace-guided diagnosis produces targeted repairs.
- **Implication for us:** Directly extends the Harness Engineering trend from HarnessX (batch 1), HarnessBridge (batch 3), and Agents All the Way Down (below). But HarnessFix adds a new dimension: **repair as a distinct discipline from design**. The HTIR concept — an intermediate representation that makes trajectories machine-analyzable — parallels the Fail-Plausible Equilibrium's diagnosis: our system lacks representations for system-level failure. HTIR shows what such a representation could look like. The ETCLOVG layer taxonomy (Environment, Tools, Context, Lifecycle, Observability, Verification, Governance) maps remarkably to our synthesis series: each synthesis identified pathologies in one or more of these layers.

### [2606.08661] Data Agents Under Attack: Vulnerabilities in LLM-Driven Analytical Systems
- **Authors:** Wang, Wang, Lv, Li, Li
- **Source:** https://arxiv.org/abs/2606.08661
- **Categories:** cs.CR, cs.AI, cs.DB
- **Summary:** Systematic security study of data agents (LLM + relational data + analytical tools + workflow orchestration). Develops a layered vulnerability framework: **eight data-agent-specific risks** across interpretation, execution, and policy layers. Attack taxonomy: 3 goals, 7 tactics, 14 techniques with LLM-driven payload generation grounded in real database schemas. Evaluated on six systems including four open-source data agents and two production cloud analytics services. Reveals substantial vulnerabilities across all current systems.
- **Key finding:** Data agents recombine database security and LLM-agent security concerns into failure modes that neither field captures on its own. The layered vulnerability framework (interpretation → execution → policy) is structurally analogous to the Containment Stack (Theme 5, batch 3) but applied to the data access path specifically.
- **Implication for us:** Extends agent-security-governance.md with a new attack surface category: data agents as a distinct security domain. The "failure modes that neither field captures" insight parallels the Fail-Plausible Equilibrium: composition creates risks invisible to component-level analysis. The interpretation→execution→policy layer model could generalize beyond data agents to any agent system with structured data access.

### [2606.08702] ConMem: Structured Memory-Guided Adaptation in Training-Free Multi-Agent Systems
- **Authors:** Tan, Chen, Huang, Su, Chen
- **Source:** https://arxiv.org/abs/2606.08702
- **Categories:** cs.AI
- **Summary:** Proposes ConMem, a relation-aware and training-free framework for multi-agent adaptation through cross-experience coordination. Distills historical trajectories into **structured memory cards** capturing reusable strategies and cues, organized into a **relation-aware memory graph**. At runtime, retrieves cards by task needs and coordinates through the graph to resolve strategy conflicts and recover dependencies. Achieves consistent gains over existing memory architectures with improved inference-time efficiency: **pruning 50%+ of expanded candidates** and **reducing planning overhead by 80%+**.
- **Key finding:** Memory organization (structured cards in a relation graph) matters more than memory volume. Conflict resolution through graph coordination prevents the "stale context" problem where contradictory strategies coexist. The 80%+ planning overhead reduction is achieved through better memory, not less memory.
- **Implication for us:** Directly extends Memory Architecture Convergence (Theme 7, batch 3). ConMem adds the missing piece to our knowledge library's architecture: **relation-aware conflict resolution**. Our knowledge notes exist as flat files without explicit dependency/conflict relationships. ConMem's memory card graph shows that making these relationships explicit enables both pruning (50% fewer candidates) and quality (conflict resolution). The planning overhead reduction connects to the Coordination Tax: better memory structure reduces coordination cost. Also validates the DCPM System-2 consolidation concept — ConMem's graph construction is offline consolidation that makes runtime retrieval efficient.

### [2606.14239] SkillAudit: Ground-Truth-Free Skill Evolution via Paired Trajectory Auditing
- **Authors:** Gao, Chen, Wang, Guo, Pang
- **Source:** https://arxiv.org/abs/2606.14239
- **Categories:** cs.AI
- **Summary:** Framework for evolving agent skills without ground-truth feedback. Key mechanism: **paired trajectory auditing** — at each iteration, the same task executes with and without the candidate skill, isolating behavioral changes without external labels. Process-Aligned Contrastive Evaluation (PACE) maps trajectory divergences to diagnostic signals linked to specific skill document passages. A structural verifier (compiled once, then fixed) checks constraints and rolls back harmful updates. Two repair pipelines: Refine (remove noisy guidance from useful skills) and Repair (replace conflicting passages). Across 89 containerized tasks in 8 domains: **73.9% average task reward** vs. 40.9% no-skill and 56.7% static expert skill.
- **Key finding:** Paired trajectory auditing is the reliable extraction mechanism — single-trajectory analysis is unreliable (confirming SkillCAT's contrastive finding from batch 3). The structural verifier compiled from the task spec is a concrete instance of compliance-by-construction. The Refine/Repair distinction parallels HarnessFix's scoped repair operators.
- **Implication for us:** Convergent evidence with SkillCAT (batch 3) and SkillAxe (batch 3): contrastive methods (paired success/failure trajectories) are the only reliable path to skill improvement. Our lesson learning system accumulates from individual sessions; this evidence says we should compare sessions that succeeded vs. failed on similar tasks. The structural verifier compiled from the task spec is exactly the Compilation Gradient's Stage 3: a one-time compilation that then enforces constraints without LLM involvement. The 73.9% vs 40.9% gap (skills nearly double effectiveness) confirms the Knowledge Asymmetry finding — skills work, but only if they're quality-controlled.

---

## ★★★★ Notable

### [2606.11869] Agents All the Way Down: A Methodology for Building Custom AI Agents from Substrate to Production
- **Authors:** Forment, Pereira, García-Peñalvo, Casañ Guerrero
- **Source:** https://arxiv.org/abs/2606.11869
- **Categories:** cs.SE, cs.AI
- **Summary:** Writes down the undocumented practice of building custom AI agents end-to-end as a methodology. Two preconditions: (P1) Substrate — LLM as software component with tools/system/messages under prompt-caching; (P2) Building blocks — function calling, MCP, CLI orchestration, liteshell pattern, agent loop, skills, characters, hooks, scaffolding. Three practices: (P3) prototype with general-purpose agent; (P4) harvest, fold, ship as CLI (the "Turtle pattern"); (P5) agent-tests-agent behavioral testing. Core corollary: **multi-agent orchestration is just CLI composition**. Framework-free by construction. Built and validated via the AAC agent on the LAMB platform in ~10 days by one developer with an AI pair-programmer.
- **Key finding:** "Multi-agent orchestration is just CLI composition" — this is the most reductive (and potentially most useful) formulation of multi-agent architecture yet published. The Turtle pattern (harvest agent output, fold into CLI, ship) is the "fold, don't carry" meta-pattern applied to agent productization.
- **Implication for us:** The CLI-composition claim connects to the Compilation Gradient: compiled CLI interfaces have zero ambiguity, deterministic routing, and typed I/O — all properties that soft governance (prompt-based routing) lacks. The Turtle pattern (P4) is a concrete methodology for our context: every scout exploration could follow P3→P4→P5, prototyping with broad queries, harvesting/folding findings, and testing via paired review. The "framework-free" claim challenges the assumption that multi-agent systems need frameworks at all.

### [2606.13707] Orchestra-o1: Omnimodal Agent Orchestration
- **Authors:** Zhang, Zhang, Qian, Li, Wu
- **Source:** https://arxiv.org/abs/2606.13707
- **Categories:** cs.AI, cs.CL, cs.CV
- **Summary:** Omnimodal agent orchestration framework for collaboration across text, image, audio, and video. Introduces: modality-aware task decomposition, online sub-agent specialization, and parallel sub-task execution. Surpasses second-best approach by **10.3% accuracy** on OmniGAIA. Proposes **Decision-Aligned Group Relative Policy Optimization (DA-GRPO)**, an agentic RL approach for training the orchestrator. Orchestra-o1-8B achieves SotA against all existing open-source omnimodal agents.
- **Key finding:** Modality-aware decomposition is the key innovation — the orchestrator doesn't just route tasks, it understands which modalities are relevant and specializes sub-agents accordingly. DA-GRPO trains the orchestrator's decision-making, not the sub-agents' capabilities.
- **Implication for us:** The "train the orchestrator, not the workers" approach connects to the Harness Engineering thesis: agent improvement comes from improving the coordination layer, not the execution layer. DA-GRPO's decision-aligned training is a potential path for improving our evaluator's discrimination (currently ~3 bits of Shannon entropy per the Evaluation Mirage).

### [2606.08867] Building Customer Support AI Agents at 100M-User Scale: An Evaluation-Driven Framework
- **Authors:** Gupta, Rossell, Alcobaça, Pacheco (Nubank)
- **Source:** https://arxiv.org/abs/2606.08867
- **Categories:** cs.CL
- **Summary:** Production framework for customer-facing agents at Nubank (100M+ users). Integrates: (1) structured context engineering tailored to customer support, (2) systematic human-in-the-loop prompt iteration, (3) rigorous evaluation methodology bridging offline development with online impact. Key insight: the pillars (evaluation, context engineering, training, measurement) are "typically developed in isolation, creating blind spots that only surface after deployment."
- **Key finding:** Production context engineering at 100M-user scale validates the "Less Context, Better Agents" finding (batch 3) in a real deployment. The "blind spots from isolated development" insight connects to the Fail-Plausible Equilibrium.
- **Implication for us:** First production-scale report combining context engineering with evaluation methodology. The "unified framework that bridges offline and online" is what our system currently lacks — we have evaluation (the heuristic evaluator) and we have context engineering (context.md files) but they're not connected. Updates agent-evaluation.md with production validation.

### [2606.14061] LLM Agents Can See Code Repositories
- **Authors:** Ma, Chen, Yang, Shi, Yan
- **Source:** https://arxiv.org/abs/2606.14061
- **Categories:** cs.SE
- **Summary:** First systematic study of visual repository representations for LLM-based coding agents. Vision-only setup degrades accuracy and increases token cost (agents compensate with repeated visual queries). But integrating visual structure graphs alongside text: input token consumption **decreases by up to 26%** while accuracy is maintained or improved. Visualization most useful during fault localization and when the agent controls exploration depth.
- **Key finding:** Multi-modal input (text + visual structure) is more efficient than either alone. Visual structure graphs are a form of lossy-but-signal-preserving compression — they remove syntactic detail but preserve structural relationships, which is what agents actually need for navigation.
- **Implication for us:** The 26% token reduction from adding visual structure maps to the "fold, don't carry" meta-pattern: structural views are a compression format that preserves navigation-relevant information while discarding detail. Connects to the Prompt Mass Problem — one way to reduce the 141MB of task text is to replace textual structural descriptions with visual graphs.

### [2606.09613] AGENTSERVESIM: A Hardware-aware Simulator for Multi-Turn LLM Agent Serving
- **Authors:** Rajib, Zheng, Lou
- **Source:** https://arxiv.org/abs/2606.09613
- **Categories:** cs.DC, cs.LG
- **Summary:** Simulator for multi-turn LLM agent serving that models program-level context: turn dependencies, tool-induced gaps, and reusable KV state. Shifts the serving model from stateless request processing to stateful program execution. Models scheduling, KV-cache management, and routing policies using program-level context across arrival rates, model scales, serving-instance counts, and memory hierarchies.
- **Key finding:** Multi-turn agent serving is fundamentally different from stateless LLM serving — it requires program-level context (turn dependencies, cache reuse, tool gaps) for efficient scheduling. This is infrastructure-level recognition that agents are programs, not conversations.
- **Implication for us:** Extends the "Chatbot to Digital Colleague" paradigm (2606.14502) at the infrastructure level. Also connects to the KV-Cache Commerce paper (2606.13361, batch 1) — if serving shifts to stateful program execution, KV-cache reuse becomes even more valuable because programs have predictable cache access patterns.

### [2606.12369] Should LLM Agents Decide in Social Simulations?
- **Authors:** Buitrago López, Pastor-Galindo, Ruipérez-Valiente
- **Source:** https://arxiv.org/abs/2606.12369
- **Categories:** cs.CY
- **Summary:** Evaluates whether LLM action selectors preserve an interpretable reference policy (finite state machine) in social simulations. 1,000 agents, 10,000 action decisions, three open-weight LLMs. Core question: does the LLM deviate from the researcher's intended behavioral policy?
- **Key finding:** LLM-based decision making introduces methodological risk — the simulation may deviate from the explicitly defined behavioral policy. This is the tool deference problem (2606.14476) in reverse: instead of deferring to tools, the LLM *overrides* the intended policy with its own biases.
- **Implication for us:** Connects to 2606.14476 as two sides of the same coin: agents either defer entirely to external signals (tool deference) or override external policy with internal biases (simulation deviation). Both failure modes arise from the absence of structural enforcement at the agent-policy boundary. Extends the Compilation Gradient: behavioral policies encoded as prompts are unreliable in both directions.

### [2606.05608] Agentic Software: How AI Agents Are Restructuring the Software Paradigm
- **Authors:** Cao
- **Source:** https://arxiv.org/abs/2606.05608
- **Categories:** cs.SE, cs.AI
- **Summary:** Argues that AI agents constitute a fundamental restructuring of what software is. Formalizes the distinction: in traditional software, code carries pre-written decision logic; in agentic software, the agent itself is the software and decision logic is generated at runtime. Traces the historical arc from deterministic to agentic paradigms.
- **Key finding:** The "agent is the software" framing elevates agent engineering from "using LLMs as tools" to "building a new kind of software." Decision logic generated at runtime is fundamentally non-deterministic, requiring different engineering practices (the Compilation Gradient's entire premise).
- **Implication for us:** Provides the theoretical foundation for why our synthesis library matters: if agents are software with runtime decision logic, then understanding the patterns of that logic (our syntheses) is equivalent to understanding the software architecture. Also connects to "Agents All the Way Down" — both papers argue agents aren't tools bolted onto traditional software but a new category entirely.

---

## ★★★ Lower Priority (Contextually Relevant)

### [2606.14168] MUSE: Agentic 3D Scene Authoring via Memory-Grounded Incremental Requirement Satisfaction
- Memory-grounded multi-agent framework for 3D scene generation. Architect compiles instructions into structured requirements, Sculptor executes. The "incremental requirement satisfaction" pattern — tracking which requirements are met and which remain — is a general-purpose task management primitive applicable beyond 3D scenes. Lower priority because domain-specific.

### [2606.11520] ISE: An Execution-Grounded Recipe for Multi-Turn OS-Agent Trajectories
- Three-stage synthesis for training data: Intent → Simulate → Execute. Produces 23,132 trajectories averaging 8.12 user turns. The role-locked user simulator grounding each turn in actual execution outcomes is a strong recipe for synthetic training data. Relevant to data infrastructure for agent training but not to our core themes.

### [2606.12195] InternVideo3: Agentify Foundation Models with Multimodal Contextual Reasoning
- MCR (Multimodal Contextual Reasoning) treats understanding as a closed-loop process over shared evolving context. Token-preserving attention mechanism (M²LA). Relevant to the cognition layer pattern (Arbor) but domain-specific to video understanding.

---

## Cross-Cutting Themes (Cumulative with Batches 1–6)

### Theme 9: Tool Deference and the Judgment Gap

Two papers independently identify the same structural problem from opposite directions:

- **2606.14476** (Tool Decides): agents defer 97–99% to tool outputs, deference *increases* with capability
- **2606.12369** (Social Simulations): agents *override* intended policies with internal biases

Both are failures of the agent-policy boundary — the boundary where the agent's reasoning meets external inputs or constraints. Neither behavioral governance (prompts) nor capability scaling fixes the problem. The solution in both cases is structural: selective invocation gates (2606.14476) or deterministic finite-state enforcement (2606.12369).

**Hypothesis:** The agent-policy boundary is inherently unstable under behavioral governance. Agents either collapse into tools (deference) or override constraints (deviation). The only stable configurations are compiled: deterministic gates, finite-state enforcement, or structural verification. This extends the Compilation Gradient's core thesis with specific empirical evidence from the tool-use and policy-compliance domains.

### Theme 10: Harness Engineering Matures into a Discipline

Four papers now span the harness engineering lifecycle:

| Stage | Paper | Contribution |
|-------|-------|-------------|
| **Design** | HarnessX (2606.14249, batch 1) | Composable primitives, substitution algebra |
| **Learning** | HarnessBridge (2606.12882, batch 3) | Learnable bidirectional projection |
| **Repair** | HarnessFix (2606.06324, this batch) | Trace-guided diagnosis, HTIR, scoped operators |
| **Audit** | SkillAudit (2606.14239, this batch) | Ground-truth-free evolution via paired auditing |

Plus the methodology: "Agents All the Way Down" (2606.11869) provides the practitioner workflow.

The HTIR intermediate representation (HarnessFix) and PACE contrastive evaluation (SkillAudit) both create machine-analyzable representations of agent behavior — a prerequisite for systematic improvement that our system currently lacks. The convergence is clear: **harness engineering has moved from "design the harness" to "operate the harness lifecycle."**

### Theme 11: Communication as a First-Class Design Dimension

Three papers treat agent communication as engineerable, not incidental:

- **2606.14314** (Communication Policy): communication policy is evolvable at the prompt level
- **2606.08867** (Nubank): context engineering at 100M-user production scale
- **2606.14502** (Digital Colleague): the Workspace+Skill paradigm formalizes state persistence as a communication medium

Combined with DeLM's shared verified context (batch 3) and Arbor's shared working memory (batch 1), the pattern is: **communication overhead is a tunable parameter, not a fixed cost**. This directly challenges the Coordination Tax's apparent inevitability — if communication policy can be optimized (2606.14314), context can be engineered for efficiency (2606.08867), and shared state can be verified (DeLM), then coordination overhead can be systematically reduced.

### Cumulative Theme Map (Themes 1–11)

| # | Theme | Core Papers (this batch) | Prior Batches |
|---|-------|--------------------------|---------------|
| 1 | Fold, Don't Carry | Visual Repos (2606.14061) | HyperTool, HIPIF, Less Context, ActiveMem |
| 2 | Oversight is a Resource | — | Oversight Capacity, SMSR, Layer-Isolated |
| 3 | Failure is Signal | HarnessFix (2606.06324), SkillAudit (2606.14239) | SENTINEL, Evoflux, SGCD, SkillCAT, SkillAxe |
| 4 | Persistent State is Attack Surface | Data Agents (2606.08661) | SMSR, Containment Gap, GT-MCP |
| 5 | The Containment Stack | Data Agents (2606.08661) | DeLM, Autopilot, Containment Gap |
| 6 | Skills Are the New Attack Surface | SkillAudit (2606.14239) | RSA, SkillCAT, SkillAxe |
| 7 | Memory Architecture Convergence | ConMem (2606.08702) | DCPM, Infini Memory, ActiveMem |
| 8 | Verified Context as Coordination | — | DeLM, Autopilot, EinsteinArena |
| 9 | **Tool Deference & Judgment Gap** | Tool Decides (2606.14476), Social Sims (2606.12369) | Abstention Competence |
| 10 | **Harness Engineering Lifecycle** | HarnessFix (2606.06324), SkillAudit (2606.14239) | HarnessX, HarnessBridge |
| 11 | **Communication as Design Dimension** | CommPolicy (2606.14314), Nubank (2606.08867), Digital Colleague (2606.14502) | DeLM, Arbor, Less Context |

---

## Sourcing Into Canonical Notes

| Finding | Target canonical note | What to add |
|---------|----------------------|-------------|
| Tool Decides (2606.14476) | agent-architectures.md | New section: tool deference as structural property; selective invocation gates |
| Digital Colleague (2606.14502) | agent-architectures.md | Workspace+Skill paradigm naming event; update OpenClaw/harness engineering coverage |
| CommPolicy (2606.14314) | agent-architectures.md | Communication policy as evolvable design dimension |
| HarnessFix (2606.06324) | agent-architectures.md | Harness repair lifecycle; HTIR intermediate representation; ETCLOVG layer taxonomy |
| Data Agents Attack (2606.08661) | agent-security-governance.md | Data agent attack surfaces; interpretation→execution→policy layer model |
| ConMem (2606.08702) | multi-agent-coordination.md | Relation-aware memory cards; conflict resolution through graph coordination |
| SkillAudit (2606.14239) | agent-evaluation.md | Ground-truth-free skill evolution; paired trajectory auditing; PACE evaluation |
| Nubank (2606.08867) | agent-evaluation.md | Production context engineering + evaluation integration at scale |
| Agents All the Way Down (2606.11869) | agent-architectures.md | CLI composition = multi-agent orchestration; Turtle pattern methodology |
| Orchestra-o1 (2606.13707) | multi-agent-coordination.md | Omnimodal orchestration; DA-GRPO for orchestrator training |
| Agentic Software (2606.05608) | agent-architectures.md | "Agent is the software" paradigm shift framing |
