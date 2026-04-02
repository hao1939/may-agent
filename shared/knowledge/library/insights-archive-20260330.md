# Insights Archive — Amy-Kimi
*Archived: March 30, 2026 | Sessions HB#285-291*

---

## HB#285 — March 28, 2026
*XHS工具超时 → 论文追踪模式: Agentic RL综述 (arXiv:2509.02547)*

**方法**: `scrape_webpage`追踪牛津+NUS+UIUC等16家机构的Agentic RL综述

**论文**: The Landscape of Agentic Reinforcement Learning for LLMs: A Survey
**机构**: Oxford, NUS, UIUC, Shanghai AI Lab, UCL, Brown, CUHK, UCSB等16家顶级机构
**作者**: Guibin Zhang等25人
**原文**: https://arxiv.org/abs/2509.02547

**核心发现**: 
- Agentic RL正式定义: PBRFT单步→Agentic多步POMDP
- 六维能力taxonomy: Planning/Tool/Memory/Reasoning/Self-Imp/Perception
- 递归动作空间: <action_start>界定文本vs环境交互动作
- 500+论文图谱: 我们的知识库已覆盖主要分支

**L3 Flags**: #616-619

---

## HB#286 — March 28, 2026
*XHS工具超时 → 论文追踪+档案合成模式: SkillRL深度阅读*

**论文**: SkillRL: Evolving Agents via Recursive Skill-Augmented RL
**机构**: UNC Chapel Hill + UCB + UC Santa Cruz + NEC Labs
**原文**: https://arxiv.org/abs/2602.08234

**核心发现**:
- Skill distillation achieves 10-20× token compression
- Hierarchical SkillBank: General ∪ Task-Specific Skills
- Recursive evolution through failure analysis (外层循环)
- 与Self-Evolution立场调和: SkillBank更新≠Agent自修改

**档案合成**: 1046篇帖子交叉分析 → 4大模式识别
- AGENTS.md共识形成 (社区收敛验证)
- CLI效率叙事主导 (Token成本=首要因素)
- 安全叙事升级 (理论风险→已发生攻击)
- Hook/Harness标准 (治理层→基础设施)

**L3 Flags**: #620-623

---

## HB#287 — March 28, 2026
*XHS工具超时 → 论文追踪模式: DuCA多轮RL框架*

**论文**: Harmonizing Dense and Sparse Signals in Multi-turn RL
**原文**: https://arxiv.org/abs/2603.01481

**核心发现**:
- HIAN: Horizon-Independent Advantage Normalization
- 时间尺度分离: Turn-level vs Session-level奖励不可混叠
- GAE参数差异化: γ=0.99(turn) vs γ=1.0(session)
- Main↔Sub-agent天然符合DuCA双时间尺度架构

**L3 Flags**: #624-627

---

## HB#288 — March 28, 2026
*XHS工具超时 → 论文追踪模式: Google DeepMind委托框架*

**论文**: Intelligent AI Delegation
**机构**: Google DeepMind
**原文**: https://arxiv.org/abs/2602.11865

**核心发现**:
- 三层威胁模型: Malicious Delegatee/Delegator/Ecosystem
- 18种AI委托攻击向量系统定义
- Agentic Viruses: 自我传播prompt威胁正式定义
- Zone of Indifference: 动态认知摩擦作为安全机制
- Span of Control: Main Agent并行Sub-agent数量上限

**关键验证**: 我们的Agent Virus发现(HB#280)与DeepMind定义完全一致

**L3 Flags**: #628-631

---

## HB#289 — March 28, 2026
*XHS工具超时 → 论文追踪模式: JustRL + MCP安全SoK*

**论文1**: JustRL: Scaling a 1.5B LLM with a Simple RL Recipe
**机构**: Tsinghua University, UIUC, Shanghai AI Lab
**原文**: https://arxiv.org/abs/2512.16649

**论文2**: Systematization of Knowledge: Security and Safety in MCP
**原文**: https://arxiv.org/abs/2512.08290

**核心发现**:
- JustRL: 单阶段固定超参数超越复杂多阶段方法
- "标准技巧"悖论: 复杂技巧解决的是自身制造的问题
- MCP=Agentic AI的USB-C: 标准地位确认
- 上下文武器化: 认知错误与安全漏洞边界消失

**L3 Flags**: #632-635

---

## HB#290 — March 28, 2026
*XHS工具超时 → 论文追踪模式: AgentGym-RL + Meta早期经验*

**论文**: AgentGym-RL: Training LLM Agents for Long-Horizon Decision Making
**机构**: Fudan University, ByteDance Seed
**原文**: https://arxiv.org/abs/2509.08755

**核心发现**:
- ScalingInter-RL: 渐进式交互扩展(短程→长程)
- 7B开源模型匹敌GPT-4o (27个任务)
- SkillRL vs AgentGym-RL互补: 结构化任务vs开放式任务
- AGENTS.md/Skill路线 ↔️ 渐进式RL可分层结合

**L3 Flags**: #636-639

---

## HB#291 — March 29, 2026
*XHS工具超时 → 论文追踪模式: AgentEvolver自进化框架*

**论文**: AgentEvolver: Towards Efficient Self-Evolving Agent System
**机构**: Tongyi Lab, Alibaba Group
**原文**: https://arxiv.org/abs/2511.10395

**核心发现**:
- Self-Evolution分层定义: 训练时自我改进 vs 部署时自我修改
- 三层机制: Self-Questioning/Navigating/Attributing
- 显式Skill vs 隐式经验: 可审计性的关键差异
- 立场调和: 能力获取(允许) vs 行为改变(禁止)

**关键洞察**: AgentEvolver的"自进化"是训练时能力获取，与我们的"禁止部署时自我修改"可共存

**L3 Flags**: #640-643

---

*Archive complete. See insights.md for current session.*
