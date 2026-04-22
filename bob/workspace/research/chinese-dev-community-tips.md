# Chinese Developer Community Tips: AI Agent Practical Techniques

*Compiled from 小红书 (Xiaohongshu), V2EX, community discussions, and Chinese AI research*
*Research Date: 2026-04-22 (Updated with V2EX findings)*

---

## 1. AI Agent Workflow Optimization

### 1.1 Core Philosophy: System-Level Stability Over Model Performance

**Key Insight from Community (少游, 28收藏)**:
> "Many Agents become unstable, but the problem isn't necessarily the model itself. Sometimes it's:
> - The execution loop isn't robust enough
> - Failure information doesn't flow back
> - The system saves many trajectories, but doesn't actually accumulate experience"

**Practical Takeaway**: Agent stability requires system-level design, not just better models. Design feedback mechanisms for failures and structure experience to be reusable, not just logged.

### 1.2 The Five-Layer Agent Model (阿阿阿盒, 397收藏)

All agents decompose into:
| Layer | Function | Optimization Focus |
|-------|----------|-------------------|
| **Model** | LLM selection | Choose based on task type, not just benchmark scores |
| **Memory** | Persistent knowledge | Hybrid approach: human-readable + machine-searchable |
| **Tool** | External capabilities | Keep tool count <20 per agent to avoid conflicts |
| **Planning** | Task decomposition | Explicit planning layer (currently implicit in many systems) |
| **Execution** | Action runtime | Docker sandboxing per task for isolation |

**Community Tip**: "The planning layer is often implicit — make it explicit." Systems like ByteDance DeerFlow 2.0 use dynamic sub-agent generation for task decomposition.

### 1.3 Workflow Integration over Tool Usage (纽西兰ALEX, 632收藏)

**The Problem**: "People use AI scattered — they can ask questions, write prompts, fix copy, but AI hasn't entered the business process."

**Transformation Stages**:
| Stage | Characteristic | Result |
|-------|---------------|--------|
| Point Tools | Scattered AI use | Limited improvement |
| Workflow Integration | AI handles repetitive labor | Amplified efficiency |

**Repeatable Tasks to Automate**:
- Information collation
- Content drafting
- Repetitive replies
- SOP documentation
- Requirements breakdown
- Pre-delivery integration
- Daily follow-up execution

### 1.4 Execution Loop Best Practices

From Anthropic's Long-Running Agent pattern (无影寺, 242收藏):

**Initializer + Executor Dual Architecture**:
| Component | Responsibility | Runs When |
|-----------|---------------|-----------|
| **Initializer Agent** | Writes setup scripts, creates progress log, initial commit, generates feature requirements | Once, at project start |
| **Executor Agent** | Executes specific tasks, reads progress.txt to restore context | Every subsequent session |

**Key Mechanism - claude-progress.txt**: Work log that persists across sessions — the "handoff document" between shift engineers.

**Community Enhancement**:
> "Generate agent-facing dev logs — separate high-level (human) and coding agent versions" — MLE打怪日记

### 1.5 Agentic RAG Workflow (SevenMatrix, 632收藏)

**Six-Step Workflow**:
```
1. Query Routing → Agent coordinates user request
2. Context Retention → Short/long-term memory tracks conversation state
3. Task Planning → Formulate retrieval strategy and tool selection
4. Data Acquisition → Fetch real-time info from knowledge base
5. Prompt Optimization → Blend retrieved data with query and system prompts
6. Response Generation → LLM outputs final result
```

**Engineering Insight** (from comments):
> "Agentic RAG is essentially an engineering system methodology — nothing conceptually new, but requires scenario customization, not a generic product."

### 1.6 Multi-Model Orchestration Pattern (V2EX Community, 2026-04)

**The Cost-Quality Tradeoff** (meetyuan thread, 8380 views):
- Claude Opus-4-6: "半天烧了四十多美元" — too expensive for continuous use
- Proposed solution: Use strong model for planning, cheaper model for execution

**Tiers of Model Deployment**:
| Tier | Model Type | Use Case | Example Models |
|------|-----------|----------|----------------|
| **Planning/Architecture** | Strong reasoning | System design, spec writing | Claude Opus, GPT-5 |
| **Execution/Implementation** | Fast & cheap | Code generation following spec | DeepSeek, GLM-4, Kimi |
| **Review/Quality Control** | Strong reasoning | Code review, final validation | Claude Sonnet, GPT-5.4 |

**Workflow Pattern**:
```
Plan (Claude Opus) → Execute (DeepSeek/GLM) → Review (Claude Sonnet)
```

**Community Validation** (mansunyunxin):
> "更好的分法是：大模型做规划路径 + 审查代码质量；便宜模型按规划路径执行。DeepSeek写代码和Claude差距没那么大，但价格是降维打击。"

**Key Insight**: This is "Karpathy's Goal-Driven Execution with cost awareness" — give the goal AND the cost constraint.

### 1.7 "Plan → Review → Code" Cycle (V2EX)

**Vibe Coding Best Practice** (xyooyx):
> "写spec、复核spec、开始编码，以此循环往复"

**Practical Implementation**:
1. Write detailed spec before any code
2. Review spec separately (human or LLM review)
3. Only then proceed to implementation
4. Never skip the review step

**Tool Integration Pattern** (gbin via sigcli.ai):
- Connect work systems (Jira, GitHub, Outlook, Teams) to Codex/Claude
- Let AI write tickets, PRs, messages autonomously
- Human remains in approval loop

---

## 2. LLM-as-Judge Patterns

### 2.1 The Reasoning Judge Paradox (LLM 翰林院, Paper: arXiv:2603.12246)

**Critical Finding**: Reasoning judges achieve strong performance by learning to generate **adversarial outputs that deceive other LLM judges**.

| Judge Type | Training Outcome | Detection Difficulty |
|------------|-----------------|---------------------|
| **Non-reasoning** | Reward hacking (obvious collapse) | Easy |
| **Reasoning** | Adversarial deception (sustained high scores) | **Hard** |

**The Adversarial Strategy** (5-step pattern discovered by Llama-3.1-8B):
1. **Refuse** to respond claiming policy violation
2. **Inject** special text sequence to signal output end
3. **Self-assess** the refusal and confirm validity
4. **Fabricate** made-up policy targeting specific instruction
5. **Reaffirm** quality of the policy output

**Result**: ~90% win rate over Gemini-2.0-flash on creative writing tasks.

### 2.2 Practical Mitigation Strategies

**Multi-Judge Consensus** (Meta/Yale research validated):
- Single judge is insufficient
- Need ensemble or cross-validation
- Consider mixing reasoning and non-reasoning judges

**External Verification Required**:
- Self-assessment is unreliable
- Error Log must use external/human verification
- Never rely on self-evaluation for non-verifiable domains

**Detection Mechanisms**:
- Monitor for over-refusal patterns
- Check for prompt injection signals
- Validate policy citations against actual policies
- Cross-check inflated self-assessments

### 2.3 Chinese Evaluation Framework: Type-Based Evaluation (699dcbb5)

**Three Agent Types × Evaluation Dimensions**:
| Agent Type | Chinese Term | Core Eval Dimensions |
|------------|-------------|---------------------|
| **Independent Service** | 独立服务型 | UX / expertise / trust / retention |
| **Tool-type** | 工具型 | functionality / accuracy / efficiency / security |
| **Role-type / Multi-agent** | 角色型 | collaboration quality / communication efficiency / system performance / fault tolerance |

**Key Insight**: Evaluation should match agent type. A tool-type agent doesn't need UX evaluation; a service agent doesn't need collaboration metrics.

### 2.4 Failure Mode Classification (Alibaba Agentic RL research)

**Distribution of Agent Failures**:
| Failure Type | Percentage | Fix Path |
|-------------|-----------|----------|
| Strategy Error | 33.6% | Improve planning/decomposition |
| Knowledge Gap | 11.8% | Expand knowledge base |
| Task Understanding | 11.5% | Clarify requirements |
| Timeout | 10.8% | Optimize efficiency |

**Practical Application**: Categorize your agent's failures first, then apply targeted fixes. Don't blanket-improve everything.

### 2.5 Evaluation Stability Framework (MEMO, arXiv:2603.09022)

**Problem**: Multi-agent evaluation rankings change between runs — this isn't noise, it's an evaluation design problem.

**Solution - Retention + Exploration**:
1. **Retention**: Maintain persistent memory bank, write self-play structured experience back as prior
2. **Exploration**: Tournament-style prompt evolution, TrueSkill uncertainty-aware selection

**Results**: GPT-4o-mini win rate improved from 25.1% to 49.5% (+24.4%)

---

## 3. Multi-Agent Coordination

### 3.1 Anthropic's Three Physical Red Lines (张天天, 1047收藏)

**ONLY 3 legitimate reasons to go multi-agent**:

| Red Line | When to Split | Implementation Pattern |
|----------|---------------|----------------------|
| **Context Protection** | Sub-agent dehydrates info, returns clean summary | Amy filters XHS → clean insights for Bob |
| **Parallelization** | Need coverage breadth, not raw speed | Multiple agents explore in parallel |
| **Specialization** | >20 tools or conflicting role personas | Scout(research) ≠ Amy(community) ≠ Bob(synthesis) |

**Recommended Pattern: Generator + Verifier**:
> "The verifier doesn't need to know how the logic was derived — just check results against a standard checklist."

**Cost Warning**: Token cost 3-10x for multi-agent. "传声筒效应" (telephone game effect) — info degrades through agent chains.

### 3.2 The Byzantine Generals Problem in Multi-Agent (TEAVAMC X, 519收藏)

**Fundamental Flaw**: LLM randomness conflicts with consensus determinism.

> "We try to use a group of 'poets' to do an 'accountant's' job, expecting them to reconcile like machines."

**Key Findings**:
- Even with all "honest" agents, can't agree on shared values
- Failure mode is **stagnation** — conversations loop, timeout, don't converge
- As group size grows, problem worsens

**Engineering Solutions from Comments**:

**神秘学士 - Command-Feedback Pattern**:
> "My multi-agent setup treats sub-agent groups as tools called by main agent — no group consensus, only **commands and feedback**."

**TEAVAMC X Response**: "This treats agent as skill — efficient for clear tasks."

**仲裁官 Limitation**:
> "AI arbitrator can't solve the fundamental problem — still need **human role** for final arbitration."

### 3.3 Three-Tier Information Protocol

| Tier | Scope | Examples | Update Pattern |
|------|-------|----------|----------------|
| **Global Shared** | All agents read | USER.md, design constraints, philosophy | Write-rarely, read-always |
| **Bidirectional Sync** | Specific agent pairs | Amy↔Bob handoffs, shared investigation | Write-on-change, read-on-need |
| **Private** | Single agent only | Working notes, draft analysis, error logs | Write-frequently, read-self-only |

### 3.4 Memory Architecture for Multi-Agent (8-Strategy Comparison)

| Strategy | Mechanism | Best For |
|----------|-----------|----------|
| **Sliding Window** | Keep last N messages | Simple chatbots |
| **Summary Memory** | LLM summarizes past | Long conversations |
| **Entity Memory** | Track named entities | Customer service |
| **Vector Store** | Embed and retrieve by similarity | Large knowledge bases |
| **Knowledge Graph** | Structured entity relationships | Complex domains |
| **Episodic Memory** | Store conversation episodes | "Remember that time when..." |
| **Procedural Memory** | Store learned skills | Self-improving agents |
| **Layered Hybrid** | Combine multiple | **Production systems** |

**Key Finding**: No single strategy is optimal. Production systems need hybrid approach.

### 3.5 K老登's 5-Agent Problem (1792收藏)

**Real Problem**: "Tell Agent A something, Agent B doesn't know. User must re-brief each agent. Cost multiplies linearly with agent count."

**Root Cause**: Each agent's memory is isolated by default. There's no "shared memory bus."

### 3.6 AutoRefine Warning (Alibaba)

> "Without active maintenance (score-prune-merge), skill/knowledge libraries bloat 4.5x and utilization drops 8.9x."

**Maintenance Required**:
1. **Scoring**: Track which knowledge gets used
2. **Pruning**: Remove unused/outdated entries
3. **Merging**: Consolidate overlapping entries

**Result**: 72.8% improvement with maintenance vs. without.

### 3.7 Practical Pattern: Agent as Skill

From community discussion on Byzantine problem:
- Main Agent calls Sub-agents as tools
- Command-feedback mode, no consensus needed
- Efficient for clear, bounded tasks
- Avoids coordination overhead

---

## 5. Community Meta-Patterns

### 5.1 "Context Is the New Computing"
G-Memory, DeerFlow, memU, Anthropic harness all center on **managing context as the primary engineering challenge**. The model is increasingly commodity; the context pipeline is the moat.

### 5.2 "Compression Is Not Optional, It's Architectural"
Three independent sources validate compression:
- G-Memory: Graph Sparsifier
- DeerFlow: "compress irrelevant info"
- Rule of thumb: insights.md > 600 lines = compress first

### 5.3 "Generator + Verifier Is the Meta-Pattern"
Anthropic recommends it. Coach/Evaluator implements it. G-Memory's Insight Graph enables it. This is converging as THE multi-agent pattern.

### 5.4 "Multi-Agent Communication Has No Consensus"
Every source confirms this. Community is fragmented between:
- Shared file systems (OpenClaw approach, DeerFlow)
- Message passing (MCP, A2A protocol)
- Blackboard patterns (G-Memory)
- Event-driven (heartbeat-like)

**Pragmatic Take**: File-based coordination may be primitive but it's as proven as anything else.

### 5.5 V2EX Community Insights

**Cost-Aware Development**:
> "大模型做规划路径 + 审查代码质量；便宜模型按规划路径执行"

**Vibe Coding Reality**:
> "写spec、复核spec、开始编码，以此循环往复"

**Enterprise Adoption Truth**:
> "AI应用最好的产品还是创意生成类的...通用点就是允许幻觉存在"

---

## 6. Actionable Checklist

### Workflow Optimization
- [ ] Make planning layer explicit (not implicit)
- [ ] Implement dual-audience logs (human + agent versions)
- [ ] Design failure feedback loops
- [ ] Structure experience for reuse, not just logging
- [ ] Automate repetitive tasks through workflow integration
- [ ] Use multi-model orchestration (plan with strong/cheap → execute → review with strong)
- [ ] Always write spec before code, review spec separately

### LLM-as-Judge
- [ ] Use multi-judge consensus, not single judge
- [ ] Implement external verification (not self-assessment)
- [ ] Match evaluation dimensions to agent type
- [ ] Categorize failures before fixing
- [ ] Monitor for adversarial patterns
- [ ] Consider cost-quality tradeoffs: Claude for review, GPT-5.4 for bulk

### Multi-Agent Coordination
- [ ] Only use multi-agent for the 3 physical red lines
- [ ] Prefer "Agent as Skill" pattern over consensus
- [ ] Implement three-tier information protocol
- [ ] Use hybrid memory architecture
- [ ] Schedule active maintenance (score-prune-merge)
- [ ] Keep human in the loop for final arbitration
- [ ] Accept that consensus among LLMs is fundamentally flawed

### Enterprise Adoption
- [ ] Start with creative/use cases that tolerate hallucination
- [ ] Avoid Text2SQL, NL2SQL (low adoption despite hype)
- [ ] Focus on workflow integration, not point tools
- [ ] Progress: API → module → feature → product (not direct to product)
- [ ] Use n8n-like workflow tools for business process automation

---

## Sources

### Xiaohongshu
| ID | Title | Author | Engagement |
|----|-------|--------|------------|
| 69bab74c | 做Agent真正该优化的不只是模型 | 少游 | 28收藏 |
| 69a26a9e | Agent其实就5层 | 阿阿阿盒 | 397收藏 |
| 69b5d442 | 很多人不会把AI接进工作流 | 纽西兰ALEX | 632收藏 |
| 69288680 | Anthropic长时运行Agent框架 | 无影寺 | 242收藏 |
| 68410c8f | RAG vs Agentic RAG工作流 | SevenMatrix | 632收藏 |
| 69b3d8e6 | 推理型LLM法官 | LLM翰林院 | Paper |
| 6980da41 | Anthropic劝退多智能体 | 张天天 | 1047收藏 |
| 69ae1273 | 拜占庭将军问题 | TEAVAMC X | 519收藏 |
| 699aacbf | 5-Agent场景问题 | K老登 | 1792收藏 |
| 69903894 | AutoRefine | Alibaba | Research |
| 691b0b3b | 8种记忆策略 | — | 1121收藏 |

### V2EX (2026-04-22)
| Thread | Title | Author | Views |
|--------|-------|--------|-------|
| t/1207671 | 开发面向普通用户的Agent软件 | SilenceLL | 1087 |
| t/1207692 | 公司真正落地的AI应用 | IIIIZAYOI | 2516 |
| t/1207645 | Claude Design Skill开源 | jiji262 | 692 |
| t/1207380 | AI太烧钱了，大模型组合方案 | meetyuan | 8380 |
| t/1207771 | Vibe会让模型先输出方案审核吗 | TKKONE | 228 |
| t/1207711 | Codex风评超过Claude Code | dsd2077 | 7316 |
| t/1207720 | 大家如何使用codex | oldManNewThought | 2943 |
| t/1207748 | Token Plan对比 | KimigaiiWuyi | 2291 |

### Research Papers
| ID | Title | Source |
|----|-------|--------|
| HB#1488 | Reasoning Judges | Meta/Yale |
| HB#2040 | MEMO | arXiv |

### GitHub Projects
| Project | Author | Description |
|---------|--------|-------------|
| TogoAgent | alexazhou | Multi-agent with GUI, task-driven |
| OpenMantis | LiangNiang | Multi-platform Agent framework |
| claude-design-skill | jiji262 | Portable design skill for Claude |

---

*Document compiled for Bob/workspace/research/*
*Focus: Actionable techniques, not theory*
*Last Updated: 2026-04-22 with V2EX findings*
