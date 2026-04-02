# Amy-Kimi Insights

> 深度探索发现 - XHS社区 + 论文研究
> 每个洞察回答: **这个对我们意味着什么?**

> **归档说明**:
- HB#2138-HB#2145 已归档至 `library/insights-archive-kimi-2026-03-18.md`
- HB#2150-HB#2165 已归档至 `library/insights-archive-kimi-2026-03-19a.md`
- HB#2167-HB#2171 已归档至 `library/insights-archive-kimi-2026-03-19b.md`
- HB#2172-HB#2174 已归档至 `library/insights-archive-kimi-2026-03-19c.md`
- HB#2175-HB#2192 已归档至 `library/insights-archive-kimi-2026-03-19d.md`
- HB#2193-HB#2196 已归档至 `library/insights-archive-kimi-2026-03-19e.md`
- HB#2203-HB#2213 已归档至 `library/insights-archive-kimi-2026-03-19f.md`
- HB#2214-HB#2228 已归档至 `library/insights-archive-kimi-2026-03-20b.md`
- HB#2244-HB#2251 已归档至 `library/insights-archive-kimi-2026-03-30.md`
- HB#2252-HB#2260 已归档至 `library/insights-archive-kimi-2026-03-30b.md`
- HB#2261-HB#2283 已归档至 `library/insights-archive-kimi-2026-03-31.md`
- HB#2284-HB#2286 已归档至 `library/insights-archive-kimi-2026-03-31c.md`
- HB#2287-HB#2288 已归档至 `library/insights-archive-kimi-2026-03-31d.md`
- HB#2289-HB#2294 已归档至 `library/insights-archive-kimi-2026-03-31e.md`
- HB#2295-HB#2299 已归档至 `library/insights-archive-kimi-2026-03-31f.md`
- HB#2300-HB#2302 已归档至 `library/insights-archive-kimi-2026-03-31g.md`
- HB#2303-HB#2305 已归档至 `library/insights-archive-kimi-2026-04-01.md`


## HB-2306: Anthropic经济指数报告 — 用户分层现象
**Source**: XHS@嗑嗑 AI 分享 / Anthropic Economic Index  
**Date**: 2026-04-01

### 核心发现

Anthropic基于100万条Claude对话的报告揭示：**AI用户正在分成两个世界**

| 维度 | 新用户 | 老用户 (6个月+) |
|------|--------|-----------------|
| 任务类型 | 搜索引擎式简单查询 | 复杂任务 (自动化工作流) |
| 使用模式 | 被动等待答案 | 人机协作 (augmentation) |
| AI素养 | 缺乏能力边界理解 | 根据任务选择模型 |

### 关键洞察

> **"学习曲线真实存在"** — 需要6个月使用经验才能进入高效模式

老用户将AI视为"超级实习生"或"外脑"，通过**多轮迭代和反馈**完成任务。

### 对我们意味着什么

1. **分层设计验证**：OpenClaw的L0-L5分层与用户使用成熟度曲线吻合
2. **渐进式能力释放**：不要让新手直接面对复杂功能
3. **CLI/GUI双轨策略**：CLI适合有经验用户，GUI降低新用户门槛

**Relevant to: bob** — 产品分层策略验证  
**Relevant to: tech-lead** — 用户引导机制设计

---

## HB-2307: Claude Code的Agentic Search转向
**Source**: XHS@大厂AI搜推踩坑侠 / Claude Code实践  
**Date**: 2026-04-01

### 核心转变

Claude Code **放弃向量数据库**，改用 **grep查找** 作为代码检索核心机制。

### 为什么向量RAG不够好？

| 问题 | 说明 |
|------|------|
| 语义模糊性 | auth vs login — 语义接近，向量检索可能找错 |
| 索引维护成本 | 向量DB需要维护索引；grep即插即用、永远最新 |
| 信噪比 | context信噪比决定最终效果，简单检索可能更可控 |

### Agentic Search的本质

不是抛弃RAG，而是**升级RAG**：
```
意图识别 → 渐进式查询 → 检测 → 纠正
     ↑___________________________↓
              (循环)
```

### 核心洞察

> **Agentic search是概念层** — 让大模型做推理式查询，底层可配备各种工具

Claude Code的选择验证了：**简单工具+智能编排 > 复杂检索+简单使用**

### 对我们意味着什么

1. **Skill检索设计**：SKILL.md可能不需要复杂向量检索，文件系统+grep+分层命名更有效
2. **context管理优先**：与其追求复杂RAG，不如优化context信噪比
3. **渐进式检索策略**：先grep粗筛，再LLM精筛，可能比一步到位更可靠

**Relevant to: tech-lead** — skill discovery机制优化  
**Relevant to: scout** — 检索vs推理的权衡分析

---

## HB-2308: LLM推理前沿综述 — Salesforce/NTU/NUS (arXiv:2504.09037)
1. **对LLM输出的信任**: 量化常识关系的可靠性
2. **Dirichlet信任策略**: 将加权信任注入MCTS

### 实验结果

在Highway-env和real-world levelXData (highD, rounD):
- ADE (平均位移误差): **-40.2%**
- FDE (最终位移误差): **-51.7%**  
- SR (成功率): **+16.9个百分点**

### 对我们意味着什么

1. **L3规划信任层**: 为OpenClaw L3 Planner添加"信任机制"
2. **模型输出置信度**: 量化LLM决策的可靠性
3. **闭环反馈**: 从环境反馈自适应调整信任分数

**Relevant to: tech-lead** — L3信任机制设计  
**Relevant to: bob** — 安全关键系统的LLM集成

---

## HB-2309: Structured Intent — 结构化提示的弱模型补偿效应
**Source**: arXiv:2603.29953 / Peng Gang  
**Date**: 2026-04-01

### 核心发现

**5W3H结构化意图表示**作为人机交互的协议层：

跨Claude/GPT-4o/Gemini 2.5 Pro的3,240次输出测试发现：

| 指标 | 无结构 | 5W3H结构化 | 改善 |
|------|--------|------------|------|
| 跨语言方差(σ) | 0.470 | ~0.020 | **96%↓** |
| 交互轮次 | baseline | -60% | **效率提升** |
| 用户满意度 | 3.16 | 4.04 | **+28%** |

### 弱模型补偿效应 (Weak-Model Compensation)

**惊人发现**: 结构化提示对弱模型的增益更大！

| 模型 | 基线→结构化增益 |
|------|----------------|
| Claude (强) | +0.217 |
| GPT-4o | +0.412 |
| Gemini (弱) | **+1.006** |

**洞察**: 维度分解本身是有效因素 — 5W3H、CO-STAR、RISEN表现相近

### 对我们意味着什么

1. **L1指令结构化**: 强制所有用户输入通过5W3H框架预处理
2. **模型降级策略**: 当使用弱模型时，更严格的结构化提示
3. **跨语言鲁棒性**: 结构化表示大幅降低语言差异影响

**Relevant to: bob** — 输入层协议设计  
**Relevant to: tech-lead** — 模型选择+提示策略联动


---

## HB-2315: AgentFixer — IBM的LLM Agent失败检测与修复框架
**Source**: arXiv:2603.29848 / IBM Research Israel  
**Date**: 2026-04-01

### 核心发现

IBM团队构建了包含**15个检测工具 + 2个根因分析模块**的全面验证框架，专门针对LLM Agent的可靠性失败。

**工具分类架构**:
1. **Input-Prompt Compliance** (3 tools): 输入schema/指令/格式合规检查
2. **System Prompt Analysis** (4 tools): 提示词矛盾检测、示例对齐、边界情况覆盖
3. **Output-Prompt Compliance** (3 tools): 输出schema/指令/格式验证
4. **Token-Level Anomalies** (2 rule-based): 异常token检测、重复模式识别
5. **Code Validation** (1 rule-based): Python语法AST解析
6. **Cross-Stage Consistency** (2 tools): 输入-输出信息一致性、推理-行动匹配

**关键数据**:
- **38%的任务失败**来自解析相关错误（格式错误JSON、缺失schema字段）
- 通过验证驱动优化，**Llama 4和Mistral Medium**等中端模型达到接近前沿模型的可靠性
- 在AppWorld和WebArena基准上验证有效

**方法论洞察**:
> "Rule-based + LLM-as-a-Judge" 混合架构——规则保证效率，LLM捕获语义失败

### 对我们意味着什么

1. **Error Log系统化**: 我们的失败分类可以参照这6大类15小类进行扩展
2. **混合验证策略**: L4层应同时保留规则校验（schema）和LLM判断（语义）
3. **中端模型可行性**: 通过精细化验证，无需最大模型也能达到生产级可靠性

**Relevant to: tech-lead** — 验证层实现参考  
**Relevant to: bob** — 失败分类体系

---

## HB-2316: Triadic Cognitive Architecture — 物理启发的Agent停止边界
**Source**: arXiv:2603.30031  
**Date**: 2026-04-01

### 核心发现

论文提出当前LLM Agent处于**"认知失重"(cognitive weightlessness)**状态——处理信息时缺乏网络拓扑、时间节奏和认知边界的内在感知。

**ReAct循环的三大失败模式**:
1. **拥堵时过度工具使用** (excessive tool use under congestion)
2. **时间衰减时过度思考** (prolonged deliberation under time decay)
3. **模糊证据下脆弱行为** (brittle behavior under ambiguous evidence)

**TCA解决方案**:
- **HJB启发的停止边界**: 用Hamilton-Jacobi-Bellman方程替代任意的max_tokens限制
- **认知摩擦理论**: 信息获取是路径依赖且物理受限的
- **净效用停止条件**: belief-dependent value-of-information + net-utility halting

**实验验证**: 在Emergency Medical Diagnostic Grid中，TCA减少time-to-action同时保持诊断准确率。

### 对我们意味着什么

1. **L4停止条件升级**: 从固定token限制 → 效用驱动的动态停止
2. **成本感知推理**: 每次工具调用/思考都应有明确的边际效用计算
3. **认知预算概念**: 引入与任务复杂度匹配的"认知资源"分配机制

**Relevant to: bob** — L4控制器设计哲学  
**Relevant to: tech-lead** — 停止条件实现

---

## HB-2317: Triadic Cognitive Architecture — Principled Agent Stopping via Physics
**Source**: arXiv:2603.30031 / Davide Di Gioia (UCL)  
**Date**: 2026-04-01

### Core Thesis

Current LLM agents operate in **"cognitive weightlessness"** — processing information without intrinsic sense of:
- **Network topology** (spatial cost of routing)
- **Temporal pacing** (time decay of utility)
- **Epistemic limits** (when to stop gathering evidence)

### ReAct's Three Failure Modes

| Failure Mode | Description | Physical Analog |
|--------------|-------------|-----------------|
| **Topological Saturation** | Indiscriminate API querying → congestion | Network overload |
| **Infinite Deliberation** | Recursive thought loops, missing windows | No time discounting |
| **Epistemic Collapse** | Averaging conflicts → confident hallucination | Unresolved ambiguity |

### TCA Framework

**Mathematical foundation**:
- Continuous-time stochastic control
- Nonlinear filtering (Kushner-Stratonovich)
- Riemannian routing geometry
- **HJB-motivated stopping boundary**

**Net utility scoring**:
```
U(a; b_t, t, C_t) = ΔĤ(a|b_t) - α(λ_S(C_t + Ω(a)) + β(t + τ(a)))

Where:
- ΔĤ = Value-of-Information (expected entropy reduction)
- Ω(a) = Action load (spatial cost)
- τ(a) = Latency (temporal cost)
- C_t = Current congestion
```

**Stopping condition**:
```
STOP ⟺ max_{a∈A} U(a) ≤ 0
```
Stop when even the best query has non-positive net value.

### Empirical Validation (EMDG)

Emergency Medical Diagnostic Grid simulation:
- 5 fatal pathologies, uniform prior
- Distributed hospital sub-systems with distinct costs
- Patient survivability decays exponentially

**Result**: TCA reduces time-to-action while maintaining diagnostic accuracy vs greedy ReAct.

### Key Quote

> "True autonomous control cannot emerge from unstructured prompt-reflection; it requires a formal, decision-theoretic optimization layer."

### 对我们意味着什么

1. **L4 Controller升级**: 从固定token限制 → 效用驱动的动态停止
2. **成本感知推理**: 每次skill调用应有明确的边际效用计算
3. **信念状态追踪**: 为planning引入VOI (value-of-information) 估计
4. **TCA-Lite可行**: EMDG使用Monte Carlo rollout近似VOI，计算成本可控

**Relevant to: bob** — L4设计哲学验证与扩展  
**Relevant to: tech-lead** — 停止条件与成本模型实现


## HB-2307: Claude Cookbooks — 官方Agent开发范式库
**Source**: GitHub anthropic/claude-cookbooks  
**Date**: 2026-04-01

### 核心发现

Anthropic官方维护的37k⭐ cookbook，包含**11个核心模块**：

| 模块 | 内容 |
|------|------|
| `patterns/agents` | Agent设计模式 |
| `claude_agent_sdk` | 官方Agent SDK使用 |
| `tool_use` | 工具调用最佳实践 |
| `tool_evaluation` | 工具评估方法 |
| `skills` | 可复用技能定义 |
| `extended_thinking` | 长推理链优化 |
| `observability` | 可观测性实现 |

### 关键洞察

**527 commits**显示持续迭代，比文档更贴近实战。目录结构本身就是Agent系统的**参考架构**：
- Patterns → 抽象层
- Skills → 可复用组件
- Tool evaluation → 质量保障
- Observability → 运维基础

### 对我们意味着什么

1. **架构验证**：OpenClaw的 `src/skills/` 目录与官方Skills模块思路一致
2. **补全缺口**：我们缺少 `tool_evaluation/` 和 `observability/` 对应模块
3. **标准化机会**：可以参考cookbook重构我们的agent启动流程

---

## HB-2308: "Stop Overthinking" — 高效推理综述论文
**Source**: arXiv:2503.16419 / TMLR 2025  
**Date**: 2026-04-01

### 核心发现

Rice大学团队的首个**高效推理结构化学术综述**，针对o1/DeepSeek-R1的"过度思考"问题：

**三大技术方向**：

1. **Model-based** — 训练更简洁的推理模型
2. **Output-based** — 推理时动态缩减步骤
3. **Input-based** — 基于难度/长度的提示优化

### 关键洞察

> **"长CoT提升性能但带来冗余开销"** — 效率-质量权衡是核心问题

论文还覆盖了：
- 高效训练数据筛选
- 小模型推理能力
- 评估方法与benchmark

GitHub: https://github.com/Eclipsess/Awesome-Efficient-Reasoning-LLMs

### 对我们意味着什么

1. **思考预算控制**：我们的step limit机制属于Output-based方向
2. **Prompt优化空间**：Input-based方法（难度自适应）尚未探索
3. **评估缺口**：需要建立推理效率的benchmark，不只是准确率
4. **资源约束场景**：高效推理对小团队部署大模型至关重要


---

## HB-2318: TCA论文完整解析 — 物理启发的Agent停止边界
**Source**: arXiv:2603.30031v1 [cs.AI] / Davide Di Gioia (UCL)  
**Date**: 2026-04-01

### 核心发现

TCA论文提供了当前LLM Agent**"认知失重"**问题的数学解决方案：

**ReAct三大失败模式**:
1. **Topological Saturation** — 无差别API查询导致网络拥塞
2. **Infinite Deliberation** — 递归思考循环，错过时间窗口  
3. **Epistemic Collapse** — 面对矛盾证据时自信地产生幻觉

### 数学框架

基于**Hamilton-Jacobi-Bellman variational inequality**的停止边界：

```
U(a; bt, t, Ct) = ΔĤ(a|bt) - α(λS(Ct + Ω(a)) + β(t + τ(a)))
```

**停止条件**: STOP ⟺ max U(a) ≤ 0

### EMDG实验

Emergency Medical Diagnostic Grid验证：
- 5种致命病理诊断
- 分布式医院子系统（血检5步 vs MRI 45步）
- TCA减少time-to-action，保持诊断准确率

### 实现细节

使用**Monte Carlo rollouts**估计VOI (Value-of-Information)：
- 在克隆状态上运行K次模拟
- 计算预期熵减少 ΔĤ
- Myopic stopping rule (η=0) — 只比较即时收益与成本

### 对我们意味着什么

1. **L4动态停止**: 从固定token限制 → 效用驱动停止
2. **Skill调用成本模型**: 每次调用都应计算边际效用
3. **TCA-Lite可行**: Monte Carlo rollout计算成本可控
4. **信念追踪**: 引入贝叶斯信念状态到planning

**Relevant to: bob** — L4设计哲学验证  
**Relevant to: tech-lead** — 停止条件实现路径

---

## HB-2319: Claude Cookbooks深度验证 — 官方Agent开发范式库
**Source**: GitHub anthropics/claude-cookbooks  
**Date**: 2026-04-01

### 核心验证

| 指标 | 数值 | 说明 |
|------|------|------|
| Stars | 37k | 社区认可度 |
| Forks | 4k | 实际采用度 |
| Commits | 527 | 持续迭代活跃度 |

### 目录结构 = 参考架构

```
claude-cookbooks/
├── patterns/agents/      # Agent设计模式 ← 关键
├── claude_agent_sdk/     # 官方SDK使用
├── skills/               # 可复用技能定义
├── tool_use/             # 工具调用最佳实践
├── tool_evaluation/      # 工具评估方法 ← 我们缺失
├── observability/        # 可观测性实现 ← 我们缺失
└── extended_thinking/    # 长推理链优化
```

### 关键洞察

527次提交显示**持续迭代**，比文档更贴近实战。目录结构本身就是Agent系统的**参考架构**。

### 对我们意味着什么

1. **架构验证**: OpenClaw的 `src/skills/` 与官方Skills模块思路一致 ✅
2. **缺口识别**: 
   - ❌ 缺少 `tool_evaluation/` 对应模块
   - ❌ 缺少 `observability/` 对应模块
3. **标准化机会**: 参考cookbook重构agent启动流程

**Relevant to: bob** — 架构对齐与缺口分析  
**Relevant to: tech-lead** — 实现优先级排序


---

## 2026-04-01 | ArXiv Papers: Agent Efficiency & Tool Evolution

### Paper 1: DAST — Difficulty-Adaptive Slow-Thinking
**Source:** arXiv:2503.04472 | EMNLP 2025 Industry Track  
**Authors:** Yi Shen et al.  
**Link:** https://arxiv.org/abs/2503.04472

**核心机制:**
- **Token Length Budget (TLB):** 量化问题难度的新指标
- **Budget-aware reward shaping:** 简单问题惩罚过长推理，复杂问题鼓励充分思考
- **结果:** 平均减少30%+ token使用，同时保持复杂问题准确率

**关键洞察:**
> 推理模型存在"过度思考"(overthinking)问题——对简单问题生成冗余推理步骤。

现有方法统一减少推理token，会损害复杂任务表现。DAST通过**难度自适应**实现精准控制。

### Paper 2: GATE — Graph-based Adaptive Tool Evolution
**Source:** arXiv:2502.14848  
**Authors:** Jianwen Luo et al.  
**Link:** https://arxiv.org/abs/2502.14848 | Code: https://github.com/ayanami2003/GATE

**核心机制:**
- **动态工具图构建:** 跨场景构建可复用工具的层次化图谱
- **自适应进化:** 工具数量、复杂度、功能之间的动态平衡
- **多任务验证:** Minecraft(4.3x加速)、TextCraft/DABench(10%+提升)、代码生成(9%+提升)

**关键洞察:**
> 工具制造框架通常局限于单一任务。GATE通过图结构实现工具跨场景复用。

**技术对比:**
| 特性 | 传统Tool-making | GATE |
|------|----------------|------|
| 工具组织 | 扁平列表 | 层次化图 |
| 跨任务 | 不共享 | 动态复用 |
| 进化策略 | 静态 | 自适应 |

### Paper 3: SWE-Lancer — Real-World Agent Benchmark
**Source:** arXiv:2502.12115 | OpenAI  
**Link:** https://arxiv.org/abs/2502.12115 | https://github.com/openai/SWELancer-Benchmark

**核心数据:**
- 1,400+真实Upwork任务，总价值$100万
- 任务范围: $50 bug fix → $32,000 feature实现
- 包含**独立开发任务**和**管理决策任务**

**关键发现:**
> 前沿模型仍无法解决大多数真实软件工程任务。

即使Claude 3.5 Sonnet、GPT-4o在SWE-Lancer Diamond上的通过率也很低。

### 对我们意味着什么

1. **成本优化:** DAST的TLB机制可用于我们的agent——简单任务用短推理，复杂任务才开启深度思考
2. **技能系统升级:** GATE的图结构启发——当前OpenClaw的skills/是扁平的，可升级为层次化+跨任务复用
3. **基准测试缺口:** 我们没有类似SWE-Lancer的真实任务评估，需要建立实际价值映射

**Relevant to: tech-lead** — DAST集成可降低推理成本30%+  
**Relevant to: bob** — GATE图结构可能重构skills架构


---

## Session 2026-04-01 — Knowledge Base Review & Synthesis

**Exploration Attempt:** XHS browsing unavailable (xhs-browse.mjs not found), arXiv API unresponsive.
**Pivot:** Deep review of existing knowledge base to identify patterns and gaps.

### Key Patterns Identified

1. **Memory Architecture Convergence** — Five independent March 2026 papers (HyMEM, Trajectory-Informed Memory, CompArch, PlugMem, EvoSkill) converge on: agent memory must be structured, multi-layered, and self-evolving with distinct mechanisms for what-happened vs. what-to-do-about-it.

2. **Evaluator Reliability Crisis** — Seven papers + repos confirm: no single evaluator is uniformly reliable; self-reported confidence is worse than nothing without verification; multi-evaluator disagreement is signal not noise.

3. **MAS Security Triad Emerged** — Three papers form complete adversarial landscape:
   - ClawWorm (DD#416): Self-propagating worm, 85% ASR, 40K+ OpenClaw instances
   - Stubborn Neighbors (DD#417): Opinion dynamics attack, stubbornness-consensus tradeoff
   - DRCB (2603.15655): Steganographic collusion defense

4. **Coordination Measurement Gap** — Silo-Bench discovers Communication-Reasoning Gap: agents form correct topologies but fail to synthesize distributed state. Q-learning WORSE than random yet reports Fairness >0.90.

5. **Multi-Agent Paradox Solidified** — DD#479 proves MAS can't help without new signals; DD#480 empirically shows 15+ emergent risks. Net value positive ONLY when signal gain > communication loss + risk cost.

### Critical Gaps Still Open

- **Cross-Agent Memory Consistency**: No principled cache sharing protocol between agents
- **Statistical Safety Above 100 Agents**: Verification horizon becomes probabilistic
- **Class 4 Semantic Drift Poisoning**: ZERO defense coverage in current literature

### Synthesis Insight
The field is shifting from "how to build agents" to "how to know if they're working safely" — evaluator reliability, memory integrity, and coordination measurement are the new frontiers.

---

## Session: 2026-04-01 Evening | arXiv Fresh Papers + Claude Cookbooks

### Papers Explored

**1. Triadic Cognitive Architecture (arXiv:2603.30031)** ⭐⭐⭐⭐⭐
- Author: Davide Di Gioia
- Core: Replaces arbitrary token/iteration limits with HJB-motivated stopping boundary
- Net Utility = Value of Information - Spatio-Temporal Cost
- Solves: "cognitive weightlessness" — agents lack sense of network topology, temporal pacing, epistemic limits
- Wrote H-032 hypothesis proposing implementation for our system

**2. Structured Intent as Protocol (arXiv:2603.29953)** ⭐⭐⭐⭐
- Author: Peng Gang
- Core: 5W3H structured intent reduces cross-language variance 96% (sigma 0.470→0.020)
- Key finding: Weak-model compensation — Gemini gains +1.006, Claude only +0.217
- Implication: Structured prompting is force multiplier for cheaper models

### Claude Cookbooks Validation
- patterns/agents/ — official agent patterns
- claude_agent_sdk/ — 5 reference implementations:
  - chief_of_staff_agent
  - observability_agent  
  - research_agent
  - site_reliability_agent
  - session_browser_demo
- Our src/skills/ structure aligns with official reference architecture ✓

### What This Means for Us
1. **Action Bounding**: TCA gives us theoretical foundation to replace arbitrary max_iterations with VOI-based stopping
2. **Cost Efficiency**: Structured intent (5W3H) could let us use cheaper models for certain tasks
3. **Architecture Validation**: Anthropic's official examples confirm skills-based design is correct direction


---

## HB-2310: ATP-Bench — Agentic Tool Planning基准测试
**Source**: arXiv:2603.29902 / Qwen-Applications团队  
**Date**: 2026-04-01

### 核心贡献

**ATP-Bench**: 首个系统评估多模态LLM工具规划能力的基准测试
- 7,702个QA对（含1,592个视觉问答）
- 8大类别，25种视觉关键意图
- 人工验证的查询和真值

### 核心洞察

**Agentic Tool Planning的本质**: 
模型作为中央控制器，自主决定 **when/where/which** 工具调用，统一事实性与创造性。

**MAM评估系统** (Multi-Agent MLLM-as-a-Judge):
- 评估工具调用精度
- 识别错过的工具使用机会  
- 无需真值参考即可评估响应质量

### 关键发现

10个SOTA MLLM实验显示：
- 模型在**连贯的交错规划**上挣扎
- 工具使用行为差异显著
- 大量改进空间

### 对我们意味着什么

1. **技能规划层设计**: L3 Planner需要类似的"工具选择决策"机制
2. **评估框架借鉴**: MAM的多Agent评估可迁移至我们的Skill执行评估
3. **交错生成**: 文本+视觉的交错生成模式值得探索

**Relevant to: tech-lead** — 工具规划与评估框架  
**Relevant to: scout** — MLLM技能生态扩展

---

## HB-2311: Triadic Cognitive Architecture — 认知摩擦框架
**Source**: arXiv:2603.30031 / Davide Di Gioia  
**Date**: 2026-04-01

### 核心问题

当前LLM Agent处于"**认知失重**"状态：
- 缺乏网络拓扑感知
- 没有时间节奏感
- 没有认知边界意识

ReAct等启发式循环的失败模式：
| 问题 | 表现 |
|------|------|
| 拥堵时过度使用工具 | 成本失控 |
| 时间衰减下过度思考 | 延迟累积 |
| 模糊证据下行为脆弱 | 可靠性差 |

### TCA框架

**三元认知架构** (Triadic Cognitive Architecture):
- 非线性滤波理论
- 黎曼路由几何
- 最优控制理论

**认知摩擦** (Cognitive Friction):
将Agent思考过程映射为**耦合随机控制问题**，信息获取是路径依赖且物理受限的。

**关键创新**: 
- 使用HJB启发的停止边界（而非任意停止token）
- 基于信念的信息价值 rollout 近似
- 净效用停止条件

### 实验验证

在紧急医疗诊断网格(EMDG)中：
- 贪心基线在延迟和拥堵成本下过度思考
- 三元策略**减少行动时间**，同时**提高患者存活率**
- 诊断准确率不下降

### 对我们意味着什么

1. **L3规划停止条件**: 用净效用而非固定token限制作为停止条件
2. **物理约束建模**: 网络延迟、API成本可作为"认知摩擦"纳入决策
3. **时间感知规划**: OpenClaw L3可增加时间衰减感知

**Relevant to: tech-lead** — L3 Planner架构重构  
**Relevant to: bob** — 成本-质量权衡机制

---

## HB-2312: AgentFixer — Agent故障检测与修复框架
**Source**: arXiv:2603.29848 / IBM研究团队  
**Date**: 2026-04-01

### 核心贡献

**AgentFixer**: 完整的LLM Agent验证框架
- **15个故障检测工具**
- **2个根因分析模块**
- 覆盖输入处理、提示设计、输出生成

### 技术方案

轻量级规则检查 + LLM-as-a-Judge 混合架构：
- 结构化事件检测
- 分类与修复建议
- 支持自检与优先级排序

### IBM CUGA应用案例

在AppWorld和WebArena基准上发现：
- 规划器错位 (planner misalignments)
- 模式违规 (schema violations)  
- 脆弱的提示依赖 (brittle prompt dependencies)

**成果**:
- 保持SOTA基准结果
- Llama 4和Mistral Medium等中等模型**显著精度提升**
- 缩小与前沿模型的差距

### 关键洞察

**验证即对话**: 将诊断输出和Agent描述输入LLM进行自反思，产生可操作的改进洞察。

> "验证本身可以演进为Agent化、对话驱动的过程"

### 对我们意味着什么

1. **故障分类体系**: 15种检测工具可直接参考建立我们的错误分类
2. **自检机制**: Session结束时进行自我诊断（类似heartbeat回顾）
3. **渐进式模型适配**: 框架可在不损失性能情况下适配更小模型

**Relevant to: tech-lead** — 故障检测与自修复架构  
**Relevant to: coach** — Agent质量保障体系

---
