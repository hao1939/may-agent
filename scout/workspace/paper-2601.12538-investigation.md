# Deep Investigation: Agentic Reasoning for Large Language Models

**Paper:** arXiv:2601.12538  
**URL:** https://arxiv.org/abs/2601.12538  
**GitHub:** https://github.com/weitianxin/Awesome-Agentic-Reasoning  
**Date Investigated:** 2025  
**Paper Length:** ~135 pages (comprehensive survey)  
**Status:** #1 Paper of the Day on Hugging Face

---

## 1. Summary & Metadata

### Title
**Agentic Reasoning for Large Language Models**

### Authors (29 authors)
Tianxin Wei, Ting-Wei Li, Zhining Liu, Xuying Ning, Ze Yang, Jiaru Zou, Zhichen Zeng, Ruizhong Qiu, Xiao Lin, Dongqi Fu, Zihao Li, Mengting Ai, Duo Zhou, Wenxuan Bao, Yunzhe Li, Gaotang Li, Cheng Qian, Yu Wang, Xiangru Tang, Yin Xiao, Liri Fang, Hui Liu, Xianfeng Tang, Yuji Zhang, Chi Wang, Jiaxuan You, Heng Ji, Hanghang Tong, Jingrui He

**Affiliations:** Primarily University of Illinois at Urbana-Champaign (UIUC), with collaborators from other institutions.

### Abstract
Reasoning is a fundamental cognitive process underlying inference, problem-solving, and decision-making. While LLMs demonstrate strong reasoning capabilities in closed-world settings, they struggle in open-ended and dynamic environments. **Agentic reasoning** marks a paradigm shift by reframing LLMs as autonomous agents that plan, act, and learn through continual interaction. The survey organizes agentic reasoning along three complementary dimensions:

1. **Foundational agentic reasoning** — core single-agent capabilities (planning, tool use, search) in stable environments
2. **Self-evolving agentic reasoning** — agents refine capabilities through feedback, memory, and adaptation
3. **Collective multi-agent reasoning** — collaborative settings involving coordination, knowledge sharing, shared goals

Across these layers, the survey distinguishes:
- **In-context reasoning** — test-time scaling through structured orchestration
- **Post-training reasoning** — behavior optimization via RL and supervised fine-tuning

### Subjects
- Primary: Artificial Intelligence (cs.AI)
- Secondary: Computation and Language (cs.CL)

---

## 2. Paper Structure (Full Table of Contents)

The 135-page paper is organized into 8 major sections:

1. **Introduction**
2. **Positioning Our Survey / Preliminaries**
3. **Foundational Agentic Reasoning**
   - Planning Reasoning (In-context Planning, Post-training Planning)
   - Tool-Use Optimization (In-Context, Post-training, Orchestration-based)
   - Agentic Search (In-Context Search, Post-Training Search)
4. **Self-evolving Agentic Reasoning**
   - Agentic Feedback Mechanisms (Reflective, Parametric Adaptation, Validator-Driven)
   - Agentic Memory (Flat Memory, Structured Memory, Post-training Memory Control)
   - Evolving Foundational Capabilities (Planning, Tool-use, Search for Memory Retrieval)
5. **Collective Multi-agent Reasoning**
   - Role Taxonomy of MAS (Generic Roles, Domain-Specific Roles)
   - Collaboration and Division of Labor (In-context, Post-training)
   - Multi-Agent Memory and Evolution
6. **Applications** (Math/Coding, Science, Embodied, Healthcare, Web/Research)
7. **Benchmarks** (Core Mechanisms, Application-Specific)
8. **Open Problems** (Long-horizon reasoning, Latent reasoning, World models, User-centric personalization, Governance, Multi-agent training)

---

## 3. Deep Dive: Methodology & Proposed Framework

### 3.1 Core Thesis: From Reasoning to Agentic Reasoning

The paper's central argument is that traditional LLM reasoning (Chain-of-Thought, Tree-of-Thoughts, etc.) operates in **closed-world settings** — given a fixed prompt, produce a fixed answer. **Agentic reasoning** extends this by placing the LLM in an **open-loop interaction** with dynamic environments, where it must:

- **Plan** multi-step actions
- **Act** on the environment (tools, APIs, code execution)
- **Observe** results and feedback
- **Adapt** its strategy based on outcomes
- **Learn** from experience across episodes

### 3.2 Three-Layer Taxonomy of Environmental Dynamics

#### Layer 1: Foundational Agentic Reasoning (Stable Environments)
Core single-agent capabilities in environments with predictable dynamics:

**A. Planning Reasoning**
- *In-context Planning:*
  - **Workflow Design** — ReAct, Plan-and-Solve, LLM+P, HuggingGPT, CodePlan
  - **Tree Search / Algorithm Simulation** — Tree of Thoughts (ToT), Q*, MCTS-based planning, Agent Q
  - **Process Formalization** — Formal planning languages (PDDL), code-based planning
  - **Decoupling / Decomposition** — ReWOO, Least-to-Most prompting, hierarchical decomposition
  - **External Aid / Tool Use** — LLM-A*, tool-augmented planners
- *Post-training Planning:*
  - SFT-based and RL-based optimization of planning behaviors

**B. Tool-Use Optimization**
- *In-Context:* Interleaving reasoning and tool use (ReAct, ChatCoT, ART), optimizing tool context (documentation, EASYTOOL)
- *Post-training:* SFT bootstrapping (Toolformer, ToolLLM), RL mastery (ToolRL, Search-R1, ReTool, Kimi k1.5/k2, Gemini 2.5)
- *Orchestration-based:* Agentic pipelines for tool orchestration, tool representation optimization

**C. Agentic Search**
- *In-Context:* Interleaving reasoning and retrieval (IRCoT), structure-enhanced search (GraphRAG)
- *Post-training:* SFT-based (RAFT, Search-o1), RL-based (WebGPT, Search-R1, DeepResearcher)

#### Layer 2: Self-Evolving Agentic Reasoning (Dynamic Environments)
How agents improve through experience:

**A. Agentic Feedback Mechanisms**
- **Reflective Feedback** — Reflexion, Self-Refine, ReAct loops
- **Parametric Adaptation** — AgentTuning, DPO, Constitutional AI, Re-ReST
- **Validator-Driven Feedback** — Code execution validators (CodeRL, LEVER), environment validators (SayCan), retry mechanisms (ReZero)

**B. Agentic Memory**
- **Flat Memory:**
  - *Factual Memory* — RAG, Self-RAG, MemGPT, MemoryBank, A-mem, Zep, MemOS
  - *Experience Memory* — Agent Workflow Memory, CLIN
- **Structured Memory:**
  - Knowledge graphs, hierarchical memory, graph-based retrieval (GraphRAG, RepoGraph)
- **Post-training Memory Control:**
  - Learning when/what to retrieve and store

**C. Evolving Foundational Capabilities**
- Self-evolving planning (self-rewarding models, RAGEN, TextGrad)
- Self-evolving tool-use (LATM — LLMs as Tool Makers, CRAFT, CREATOR)
- Self-evolving search (Dynamic Cheatsheet, ReasoningBank, AFlow)

#### Layer 3: Collective Multi-Agent Reasoning (Collaborative Settings)
Extending intelligence to multi-agent scenarios:

**A. Role Taxonomy of MAS**
- **Generic Roles:** Generator, Critic/Verifier, Orchestrator/Router, Aggregator
- **Domain-Specific Roles:** Developer/Tester, Researcher/Reviewer, Doctor/Nurse

**B. Collaboration and Division of Labor**
- *In-context Collaboration:*
  - **Manually Crafted Pipelines** — MetaGPT, AgentOrchestra, Chain of Agents, SMoA
  - **LLM-Driven Pipelines** — Magentic-One, MAS-GPT, AgentRouter
  - **Theory-of-Mind Augmented** — ToM for multi-agent tasks, MindForge, Hypothetical Minds
- *Post-training Collaboration:*
  - **Prompt Optimization** — AutoAgents, DSPy, multi-agent design optimization
  - **Graph-based Topology Generation** — G-Designer, GPTSwarm, AFlow, DynaSwarm
  - **Policy-based Topology Generation** — MASRouter, xRouter, MAPoRL, MARFT

**C. Multi-Agent Memory and Evolution**
- Intra-test-time evolution (within a single episode)
- Inter-test-time evolution (across episodes)
- Multi-agent evolution (co-evolution)
- Memory management: G-Memory, SEDM, Collaborative Memory, LEGOMem
- Training multi-agent to evolve: MALT, MARS, CoMAS, Stronger-MAS

### 3.3 Cross-Cutting Dimension: Reasoning Paradigm

Across all three layers, the paper distinguishes:

| Dimension | In-Context Reasoning | Post-Training Reasoning |
|-----------|---------------------|------------------------|
| **Mechanism** | Structured prompting, orchestration, workflow design at test time | RL, SFT, preference learning to internalize behaviors |
| **Scaling** | Test-time compute scaling | Training-time compute scaling |
| **Flexibility** | High (prompt engineering) | Lower but more robust |
| **Examples** | ReAct, ToT, Reflexion, RAG | ToolRL, Search-R1, RAGEN, MAPoRL |

---

## 4. Key Findings, Metrics & Benchmarks

### 4.1 Key Findings

1. **Agentic reasoning significantly outperforms static reasoning** — Agents that interact with environments (tools, search, code execution) consistently outperform pure prompt-based reasoning across all benchmarks.

2. **RL is emerging as the dominant paradigm for post-training agentic capabilities** — Papers like ToolRL, Search-R1, ReTool, SWE-RL, and Kimi k1.5/k2 show that RL-based training produces agents that learn *when* and *how* to use tools, not just *what* to say.

3. **Multi-agent systems outperform single agents on complex tasks** — Collaborative frameworks like MetaGPT, Magentic-One, and AgentCoder show substantial gains on software engineering, research, and reasoning benchmarks.

4. **Memory is a critical bottleneck** — Long-horizon tasks require sophisticated memory management. Simple context windows are insufficient; structured, hierarchical, and evolvable memory systems are needed.

5. **Self-evolution through feedback loops is key** — The most effective agents use iterative refinement (Reflexion, Self-Refine) and can improve across episodes (RAGEN, WebRL).

6. **Graph-based agent topologies are promising** — Rather than fixed pipelines, learned communication graphs (G-Designer, GPTSwarm, AFlow) can optimize multi-agent coordination.

### 4.2 Benchmarks Catalogued

The paper provides an exhaustive benchmark catalog:

#### Core Mechanism Benchmarks
| Category | Benchmarks |
|----------|-----------|
| **Single-Turn Tool Use** | ToolQA, Gorilla, ToolLLM, MetaTool, T-Eval, GTA |
| **Multi-Turn Tool Use** | ToolAlpaca, API-Bank, MTU-Bench |
| **Search** | (Various RAG/search benchmarks) |
| **Long-Horizon Memory** | PerLTQA, ELITR-Bench, Multi-IF, StoryBench, TurnBench-MS |
| **Multi-Session Recall** | LongMemEval, MemSim, REALTALK, Evo-Memory |
| **Planning & Feedback** | ALFWorld, PlanBench, ACPBench, TravelPlanner, FlowBench |
| **Multi-Agent Systems** | MAgent, StarCraft (SMAC), MineLand, TeamCraft, Melting Pot, BenchMARL |
| **Social/Communication** | LLM-Coordination, AvalonBench, Welfare Diplomacy, MAgIC, COMMA, MultiAgentBench |

#### Application Benchmarks
| Domain | Benchmarks |
|--------|-----------|
| **Embodied** | ALFWorld, OSWorld, BALROG, Agent-X |
| **Scientific Discovery** | DiscoveryWorld, ScienceWorld, ScienceAgentBench, MLAgentBench, LAB-Bench |
| **Autonomous Research** | WorkArena/++, OfficeBench, TRAIL, CLIN |
| **Medical** | AgentClinic, MedAgentBench, EHRAgent |
| **Web** | WebShop, WebArena, VisualWebArena, Mind2Web, OSWorld, AppWorld, BrowseComp |
| **General Tool-Use** | GTA, NESTFUL, RestGPT, Search-o1, R-Judge |

---

## 5. What's Novel vs. Prior Work

### 5.1 Positioning Against Prior Surveys

The paper explicitly positions itself against existing surveys:

| Prior Survey Focus | What This Paper Adds |
|-------------------|---------------------|
| LLM reasoning (CoT, ToT, etc.) | Extends reasoning to **agentic interaction** with environments |
| LLM agents (tool use, planning) | Adds **self-evolution** and **multi-agent** reasoning dimensions |
| Multi-agent systems | Integrates multi-agent with **reasoning taxonomy** (in-context vs. post-training) |
| RL for LLMs (RLHF) | Extends to **agentic RL** — learning to plan, search, use tools, collaborate |

### 5.2 Novel Contributions

1. **Unified Three-Layer Taxonomy** — No prior survey organizes agentic reasoning across foundational → self-evolving → collective dimensions, each split by in-context vs. post-training paradigms.

2. **Cross-cutting Reasoning Paradigm Analysis** — The in-context vs. post-training distinction applied consistently across all layers reveals systematic patterns in how agent capabilities can be acquired.

3. **Self-Evolution as First-Class Concept** — Most prior surveys treat self-improvement as a footnote. This survey elevates it to a full layer with detailed sub-taxonomy (feedback mechanisms, memory types, evolving capabilities).

4. **Multi-Agent Topology as a Learnable Structure** — The survey highlights the emerging trend of treating agent communication graphs as optimizable structures (graph-based topology generation, policy-based topology generation).

5. **Comprehensive Application Mapping** — Each application domain (math, science, embodied, healthcare, web) is analyzed through all three layers, showing which agentic reasoning techniques apply where.

6. **Open Problems Roadmap** — Identifies 6 frontier challenges:
   - Long-horizon agentic reasoning from extended interaction
   - Latent agentic reasoning (internalized tool use)
   - Agentic reasoning with world models
   - User-centric agentic reasoning and personalization
   - Multi-agent collaborative reasoning and training
   - Governance of agentic reasoning

---

## 6. Relevance to Multi-Agent Systems (Orchestrator + Specialist Agents)

This paper is **directly and deeply relevant** to an orchestrator + specialist agent architecture. Here's a detailed mapping:

### 6.1 Orchestrator Design Patterns

The paper catalogs several orchestration patterns directly applicable:

| Paper Pattern | Our System Mapping |
|--------------|-------------------|
| **ReAct (Reason + Act)** | Orchestrator's core loop: reason about task → select specialist → observe result → iterate |
| **ReWOO (Decoupling)** | Plan all tool calls upfront, then execute in batch — reduces round-trips |
| **HuggingGPT** | Central LLM orchestrates specialist models — exact paradigm match |
| **MetaGPT** | Role-based multi-agent with structured communication — applicable to specialist coordination |
| **Magentic-One** | Generalist multi-agent with LLM-driven pipeline — dynamic specialist selection |
| **AgentOrchestra** | Hierarchical multi-agent framework — orchestrator → sub-orchestrators → specialists |
| **Chain of Agents** | Sequential specialist handoffs for long-context tasks |

### 6.2 Specialist Agent Roles

The paper's **Role Taxonomy of MAS** maps directly:

| Role | Our System |
|------|-----------|
| **Generator** | Specialist agents that produce content (code writer, content creator) |
| **Critic/Verifier** | Quality assurance agent, code reviewer, fact-checker |
| **Orchestrator/Router** | Central orchestrator that routes tasks to appropriate specialists |
| **Aggregator** | Agent that combines outputs from multiple specialists |

### 6.3 Memory Architecture Implications

The paper's memory taxonomy suggests our system needs:

1. **Factual Memory** (RAG-style) — Shared knowledge base accessible by all agents
2. **Experience Memory** — Workflow patterns that worked in the past (Agent Workflow Memory)
3. **Structured Memory** — Knowledge graphs for representing relationships between concepts, tools, agent capabilities
4. **Multi-Agent Memory Management** — G-Memory (hierarchical), SEDM (distributed), Collaborative Memory (shared with access control)

### 6.4 Collaboration Topologies

Three levels of sophistication for our architecture:

1. **Manually Crafted Pipelines** (Current) — Fixed orchestrator → specialist routing
2. **LLM-Driven Pipelines** (Next) — Orchestrator dynamically creates agent workflows based on task
3. **Learned Topologies** (Future) — Use graph-based or policy-based methods to optimize which agents talk to whom (G-Designer, GPTSwarm, AFlow, MASRouter)

### 6.5 Self-Evolution Opportunities

The paper suggests our system should implement:

1. **Reflexion-style feedback** — After task completion, agents reflect on what went well/poorly
2. **Agent Workflow Memory** — Store successful multi-agent interaction patterns for reuse
3. **Inter-test-time Evolution** — Agents improve across user sessions, not just within a single task
4. **Validator-Driven Feedback** — Use code execution, search results, or other validators to verify agent outputs before presenting to user

### 6.6 Routing and Topology Optimization

Key papers for routing optimization:
- **MASRouter** — Learning to route tasks to the right specialist via RL
- **xRouter** — Cost-aware orchestration via RL (balances quality vs. cost)
- **AgentRouter** — Knowledge-graph-guided routing for question answering
- **Optimal-Agent-Selection** — State-aware routing framework

---

## 7. Specific Actionable Takeaways

### Immediate (Can implement now)

1. **Implement ReAct-style orchestration loop** — Ensure the orchestrator follows Reason → Act → Observe → Reason cycles rather than single-shot delegation. This is the most validated pattern across all benchmarks.

2. **Add a Critic/Verifier agent** — Based on the survey's emphasis on validator-driven feedback, add a dedicated verification step after specialist agents produce output. This alone significantly improves output quality (shown across CodeRL, LEVER, SWE-bench studies).

3. **Implement Agent Workflow Memory** — Store successful multi-step interaction patterns (which specialist was called, in what order, with what prompts) and retrieve similar patterns for new tasks. The paper highlights this as a high-leverage, underexplored capability.

4. **Use structured tool/agent descriptions** — The "Optimizing Context for Tool Interaction" section shows that how you describe available tools/agents to the orchestrator dramatically affects selection quality. Apply EASYTOOL-style concise descriptions.

5. **Implement experience-based routing** — Track which specialist succeeds on which task types and use this to improve routing over time (inspired by MASRouter, Agent Workflow Memory).

### Medium-term (Architecture improvements)

6. **Design hierarchical orchestration** — For complex tasks, implement AgentOrchestra-style hierarchical decomposition: top-level orchestrator breaks task into subtasks, each handled by a sub-orchestrator with its own specialist pool.

7. **Add Theory-of-Mind to orchestrator** — The orchestrator should model what each specialist agent "knows" and "can do" explicitly, enabling better task delegation. The MindForge and Hypothetical Minds papers show this improves multi-agent coordination.

8. **Implement multi-agent shared memory with access control** — Based on Collaborative Memory and G-Memory papers. Different specialists should be able to read/write to shared memory, but with appropriate scoping (e.g., a code agent's debug logs shouldn't pollute a content writer's context).

9. **Add self-reflection after task completion** — Implement Reflexion-style post-task analysis where the orchestrator evaluates: Was the right specialist chosen? Was the plan efficient? What could improve? Store insights for future tasks.

10. **Explore ReWOO-style plan-then-execute** — For predictable multi-step tasks, have the orchestrator plan all specialist calls upfront before execution. This reduces latency and allows for plan-level optimization.

### Long-term (Research-informed roadmap)

11. **Implement learned routing via RL** — Train a routing policy (MASRouter, xRouter) that learns optimal specialist selection from historical interactions. The paper shows RL-based routing significantly outperforms heuristic routing.

12. **Build graph-based agent topology optimization** — Use GPTSwarm or AFlow-style approaches to discover optimal communication patterns between agents for different task types, rather than relying on fixed topologies.

13. **Explore multi-agent co-training** — Papers like MAPoRL, MALT, MARFT show that jointly training multiple agents improves their collaboration. If fine-tuning specialists, train them together with the orchestrator.

14. **Implement Dynamic Cheatsheet / context engineering** — Test-time learning where agents build task-specific "cheatsheets" from their interactions, reusable across similar tasks.

15. **Add world model for planning** — The open problems section highlights that agents with world models (ability to simulate outcomes before acting) dramatically improve planning. The orchestrator should be able to mentally simulate specialist interactions before executing them.

---

## 8. Key Papers to Read Next (Prioritized for Our Architecture)

### Tier 1: Directly Applicable
| Paper | Why |
|-------|-----|
| **Magentic-One** (2024) | Microsoft's generalist multi-agent system — closest to orchestrator + specialists |
| **MetaGPT** (ICLR 2024) | Role-based MAS with structured communication — proven architecture |
| **Agent Workflow Memory** (2024) | Store and reuse successful multi-agent patterns |
| **MASRouter** (2025) | RL-based routing for multi-agent systems |
| **AFlow** (ICLR 2025) | Automating agentic workflow generation |
| **Reflexion** (NeurIPS 2023) | Verbal self-improvement loop — essential for agent quality |

### Tier 2: Architecture Insights
| Paper | Why |
|-------|-----|
| **AgentOrchestra** (2025) | Hierarchical multi-agent framework |
| **G-Designer** (2024) | Learned communication topologies |
| **GPTSwarm** (ICML 2024) | Language agents as optimizable graphs |
| **xRouter** (2025) | Cost-aware LLM orchestration via RL |
| **Chain of Agents** (NeurIPS 2024) | Sequential specialist collaboration |
| **MemGPT** (2023) | LLM memory management as OS |

### Tier 3: Future Capabilities
| Paper | Why |
|-------|-----|
| **MAPoRL** (2025) | Multi-agent post-co-training with RL |
| **MALT** (2025) | Multi-agent learning from trajectories |
| **G-Memory** (2025) | Hierarchical memory for MAS |
| **Dynamic Cheatsheet** (2025) | Test-time learning with adaptive memory |
| **RAGEN** (2025) | Self-evolution via multi-turn RL |

---

## 9. Critical Assessment

### Strengths
- **Extraordinary breadth** — 135 pages covering hundreds of papers with systematic organization
- **Actionable taxonomy** — The three-layer × two-paradigm framework is genuinely useful for system design
- **Forward-looking** — Open problems section identifies real frontier challenges
- **Community resource** — GitHub repo with ongoing updates (community contributions welcome)

### Limitations
- **Survey, not empirical** — No new experiments or results; synthesizes existing work
- **Breadth over depth** — Some sections read as paper lists rather than deep analysis
- **Fast-moving field** — Many cited papers are 2025 preprints; landscape evolves quickly
- **Limited on failure modes** — Doesn't deeply analyze when multi-agent systems fail or add unnecessary complexity
- **Missing cost/efficiency analysis** — Limited discussion of computational cost tradeoffs between different agentic approaches

### Confidence Assessment
- The taxonomy and framework are well-constructed and useful ✅
- The paper collection is comprehensive and well-organized ✅
- The multi-agent section is particularly relevant to our architecture ✅
- Should be treated as a **reference map**, not a prescriptive guide ⚠️
- Individual papers should be validated before implementation ⚠️

---

## 10. Summary: One-Paragraph Takeaway

This survey provides the most comprehensive taxonomy of agentic reasoning to date, organizing the field into three layers (foundational → self-evolving → collective) crossed with two paradigms (in-context vs. post-training). For our orchestrator + specialist agent architecture, the most impactful insights are: (1) implement ReAct-style reasoning loops with validator feedback, (2) add Agent Workflow Memory to store and reuse successful multi-agent patterns, (3) evolve from fixed routing to learned routing via RL-based methods like MASRouter, (4) implement hierarchical orchestration for complex tasks, and (5) invest in multi-agent memory management with appropriate scoping and access control. The paper confirms that our architectural pattern (central orchestrator + specialist agents) is the dominant paradigm in the field, while pointing to concrete next steps for making it more adaptive, self-improving, and efficient.

---

*Investigation completed. Source: arXiv:2601.12538, GitHub: weitianxin/Awesome-Agentic-Reasoning*
