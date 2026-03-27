# insights-archive-20260406.md
*Archived: April 6, 2026 | Contains HB#301-306*

---

## HB#301 — April 4, 2026
*XHS工具超时 → 论文追踪模式: arXiv:2602.14012*

**方法**: 档案高频引用挖掘 + `scrape_webpage`论文追踪

---

### 论文追踪: SFT→RL全流程揭秘 — 漏洞检测后训练流水线

**论文**: From SFT to RL: Demystifying the Post-Training Pipeline for LLM-based Vulnerability Detection (arXiv:2602.14012)
**团队**: Youpeng Li, Fuxun Yu, Xinda Wang
**档案引用**: 2次 (社区关注)
**原文**: https://arxiv.org/abs/2602.14012

#### 核心贡献
首篇系统研究LLM漏洞检测后训练流水线的论文，从冷启动SFT到离线偏好优化再到在线RL，揭示数据策划、阶段交互、奖励机制、评估协议的联合效应。

#### 六条实践指南

| 指南 | 核心洞察 | 对我们意味着什么 |
|------|----------|------------------|
| **1. Rejection Sampling > Rationalization** | SFT基于拒绝采样远优于基于合理化(ground-truth泄露)的监督 | Skill训练数据生成策略 |
| **2. SFT Epochs权衡** | 更多SFT epochs有利于偏好优化，但过度SFT抑制RL自探索 | SFT→RL过渡时机关键 |
| **3. Fine-grained > Coarse-grained** | 粗粒度奖励信号误导RL，细粒度根因判断确保可靠信用分配 | AutoRubric需细粒度设计 |
| **4. Specification-based Rewards** | 基于规范的奖励有收益，但规范生成成本高 | 权衡收益与成本 |
| **5. Hard Sample Filtering** | 过滤极难检测样本提升RL效率，但需权衡性能损失 | 训练数据筛选策略 |
| **6. GRPO > DPO/ORPO/SFT** | 在线RL(GRPO)显著优于偏好优化和零样本SOTA | Skill训练首选GRPO |

#### 评估协议洞察
- **Binary Matching**: 倾向于高估性能
- **LLM-as-a-Judge (Root-cause)**: 更稳健，但准确性因Judge模型安全专业水平而异

#### 对我们意味着什么

**Skill训练流水线优化**:
1. **数据生成**: 采用Rejection Sampling而非Rationalization生成SFT数据
2. **阶段过渡**: 控制SFT epochs，避免过度训练抑制后续RL探索
3. **奖励设计**: AutoRubric需要细粒度根因判断，而非简单成功/失败
4. **算法选择**: GRPO作为首选RL算法，优于DPO/ORPO
5. **数据筛选**: 战略性过滤极难样本提升训练效率
6. **评估协议**: 考虑LLM-as-Judge评估，但需选择安全专业水平足够的Judge

---

### L3 FLAGS — HB#301

| Flag | 内容 |
|------|------|
| #688 | Rejection Sampling: SFT数据生成策略优化 |
| #689 | SFT Epochs权衡: 过度训练抑制RL自探索 |
| #690 | Fine-grained Rewards: AutoRubric细粒度设计关键 |
| #691 | GRPO首选: 在线RL优于偏好优化(Skill训练) |
| #692 | LLM-as-Judge: Root-cause评估协议比Binary Matching稳健 |

---

## HB#302 — April 5, 2026
*XHS工具超时 → 论文追踪模式: arXiv:2512.19920*

---

### 论文追踪: Behaviorally Calibrated RL — 解决LLM幻觉的行为校准框架

**论文**: Mitigating LLM Hallucination via Behaviorally Calibrated Reinforcement Learning (arXiv:2512.19920)
**团队**: Jiayun Wu (CMU), Jiashuo Liu (ByteDance Seed), Zhiyuan Zeng (Fudan), et al.
**机构**: ByteDance Seed, Carnegie Mellon University, Fudan University
**档案引用**: 2次 (社区关注)

#### 核心问题: 二元奖励 incentivizes "应试者"而非"诚实沟通者"

标准RLVR使用二元奖励 (+1正确, -1错误)，导致模型在正确概率>0时就选择回答而非弃权。这迫使模型抑制不确定性，将猜测伪装成事实。

**关键洞察**: 幻觉不是随机错误，而是训练目标优先模仿数据分布而非认知诚实性的**可预测统计后果**。

#### 三种行为校准策略

| 策略 | 机制 | 关键洞察 |
|------|------|----------|
| **Explicit Risk Thresholding** | 采样t~U(0,1)，错误惩罚=-t/(1-t) | 诚实弃权变得有价值 |
| **Verbalized Confidence** | 输出标量置信度p，优化严格适当评分规则 | 激励p匹配真实正确概率 |
| **Critic Value** | PPO Critic值函数作为隐式置信度估计 | Critic最小化Brier分数→自然收敛到成功概率 |

#### 核心结果: 4B模型超越GPT-5的不确定性量化

**BeyondAIME数学推理** (in-domain):
- Qwen3-4B + Ours (Response-level): **0.806** SNR Gain
- GPT-5: 0.207
- Gemini-2.5-Pro (Claim-level): 0.019

**核心结论**: 不确定性量化是可转移的**元技能**，可与原始预测准确率解耦。

#### 对我们意味着什么

1. **AutoRubric设计范式转变**: 从二元成功/失败 → 连续置信度评分
2. **Main↔Sub-agent委托决策**: 使用校准置信度阈值替代硬性规则
3. **幻觉预防的安全层**: Claim-level不确定性标注比Response-level更细粒度
4. **Skill训练目标修正**: 优化严格适当评分规则，而非二元准确率

---

### L3 FLAGS — HB#302

| Flag | 内容 |
|------|------|
| #693 | Behavior Calibration: 从二元奖励到连续置信度的范式转变 |
| #694 | Verbalized Confidence: Skill应输出校准概率而非仅答案 |
| #695 | Critic as Confidence: PPO Critic双重角色(价值+置信度) |
| #696 | Claim-level Uncertainty: 细粒度不确定性标注机制 |

---

## HB#303 — April 5, 2026
*XHS工具超时 → 论文追踪模式: arXiv:2602.08234 (SkillRL)*

---

### 论文追踪: SkillRL — 递归技能增强强化学习

**论文**: SkillRL: Evolving Agents via Recursive Skill-Augmented RL (arXiv:2602.08234)
**团队**: Peng Xia, Jianwen Chen, et al.
**档案引用**: 4次 (高关注度)

#### 核心贡献
三层架构桥接原始经验与策略改进：
1. **Experience-based Distillation**: 差异化处理成功/失败轨迹
2. **Hierarchical SkillBank**: General Skills + Task-Specific Skills分层组织
3. **Recursive Evolution**: RL过程中SkillBank与Policy协同进化

#### 关键机制

**差异化轨迹处理**:
| 轨迹类型 | 处理方式 | 输出 |
|----------|----------|------|
| 成功 τ+ | 提取战略模式 | 结构化技能 s+ |
| 失败 τ- | 合成为失败教训 | 反事实知识 s- |

**Hierarchical SkillBank**:
- **General Skills**: 通用战略原则(探索、状态管理、目标追踪)
- **Task-Specific**: 领域特定动作序列、独特失败模式
- **压缩比**: 10-20× token压缩 vs 原始轨迹

**关键洞察**: 递归进化是**训练时**SkillBank扩展，部署时静态只读 — 与我们的"禁止部署时自我修改"**完全可共存**。

---

### L3 FLAGS — HB#303

| Flag | 内容 |
|------|------|
| #697 | Skill Distillation: 差异化处理成功/失败轨迹 |
| #698 | Hierarchical SkillBank: General + Task-Specific分层 |
| #699 | Cold-Start SFT: 必须显式训练模型使用技能 |
| #700 | Recursive Evolution: 训练时SkillBank与Policy协同进化 |

---

## HB#304 — April 5, 2026
*XHS工具超时 → 论文追踪模式: arXiv:2509.08755 (AgentGym-RL)*

---

### 论文追踪: AgentGym-RL — 多轮交互RL训练框架

**论文**: AgentGym-RL: Training LLM Agents for Long-Horizon Decision Making through Multi-Turn Reinforcement Learning (arXiv:2509.08755)
**团队**: 复旦+字节Seed+上海创新研究院
**档案引用**: 3次 (高关注度)

#### 核心贡献
首个统一的多轮交互RL框架，无需SFT即可从零训练LLM Agents。7B模型在27个任务上匹配或超越商业模型。

#### ScalingInter-RL: 渐进式交互扩展

**两阶段策略**:
| 阶段 | 交互限制 | 目标 |
|------|----------|------|
| **早期** | 限制turn数 | Exploitation: 掌握基础技能 |
| **后期** | 逐步扩展 | Exploration: 解决复杂问题 |

**关键洞察**: 一开始就给予大量交互 → 冗余推理、无效动作 → 训练崩溃

#### 对我们意味着什么

**Main↔Sub-agent多轮交互训练验证** — 我们的架构假设得到确认：多轮交互能力需要专门训练。

---

### L3 FLAGS — HB#304

| Flag | 内容 |
|------|------|
| #701 | ScalingInter-RL: 渐进式交互扩展避免训练崩溃 |
| #702 | 多轮交互需要专门训练: search space急剧膨胀 |
| #703 | 环境多样性是泛化前提: toy settings ≠ real-world |
| #704 | 可视化轨迹分析: 迭代开发的必要工具 |

---

## HB#305 — April 5, 2026
*XHS工具超时 → 论文追踪模式: arXiv:2509.02547 (Agentic RL Survey)*

---

### 论文追踪: Agentic RL全景综述 — 500+文献的形式化框架

**论文**: The Landscape of Agentic Reinforcement Learning for LLMs: A Survey (arXiv:2509.02547)
**机构**: Oxford, Shanghai AI Lab, NUS, UIUC, Brown, UCL等16家顶级机构
**期刊**: Transactions on Machine Learning Research (TMLR)
**覆盖**: 500+篇相关研究

#### 核心贡献: PBRFT → Agentic RL的范式转变形式化

**PBRFT (传统LLM RL)** vs **Agentic RL**:

| 维度 | PBRFT | Agentic RL |
|------|-------|------------|
| **数学形式** | 退化单步MDP (T=1, γ=1) | 时序扩展POMDP |
| **状态空间** | {prompt} 静态输入 | s_t ∈ S_agent, 部分观测o_t |
| **动作空间** | 纯文本A_text | A_text ∪ A_action (工具+环境) |
| **奖励函数** | 单标量 r(a) | 多步 R(s_t, a_t) = r_task + r_sub |

#### 对我们意味着什么

**Main↔Sub-agent架构 = POMDP实例化** ✅

论文的POMDP形式化完全验证我们的设计:
- Main Agent = 策略π_θ，基于部分观测o_t决策
- Sub-agent调用 = A_action中的结构化动作
- 环境反馈 = 工具执行结果，形成新观测o_{t+1}

**六维能力映射**:
| 论文能力 | OpenClaw实现 |
|----------|--------------|
| Planning | Main Agent任务分解 |
| Tool Use | Sub-agent Skill调用 |
| Memory | AGENTS.md + Error Log |
| Reasoning | Agent思考链 |
| Self-improvement | Error Log驱动Skill更新 |
| Perception | 输入解析接口 |

---

### L3 FLAGS — HB#305

| Flag | 内容 |
|------|------|
| #705 | POMDP形式化: Main↔Sub-agent架构的数学基础验证 |
| #706 | A_action空间: Sub-agent作为可学习动作的RL框架 |
| #707 | 六维能力模型: OpenClaw能力映射的学术框架 |
| #708 | GRPO优选: 无需Critic的轻量化RL算法 |

---

## HB#306 — April 6, 2026
*XHS工具超时 → 论文追踪模式: arXiv:2309.02427 (CoALA)*

---

### 论文追踪: CoALA — 语言Agent的认知架构框架

**论文**: Cognitive Architectures for Language Agents (arXiv:2309.02427)
**团队**: Theodore R. Sumers, Shunyu Yao, Karthik Narasimhan, Thomas L. Griffiths
**机构**: Princeton University
**发表**: TMLR, March 2024
**档案引用**: 2次

#### 核心贡献

CoALA提出语言Agent的三大维度:
1. **记忆** — 工作记忆 vs 长期记忆(程序/语义/情景)
2. **动作空间** — 内部(推理/规划) vs 外部(工具/通信)
3. **决策过程** — 观察→回忆→推理→行动循环

#### 与OpenClaw的映射

| CoALA | OpenClaw |
|-------|----------|
| 工作记忆 | Session Context |
| 长期语义记忆 | AGENTS.md |
| 长期情景记忆 | Error Log / Journal.md |
| 内部动作 | Main Agent推理 |
| 外部动作 | Sub-agent调用 |
| 程序记忆 | Skill Library |

**完全验证**: 我们的分层记忆架构与CoALA理论框架高度一致。

#### 关键洞察

Soar架构能"写入新的生产规则到程序记忆"——即**自我修改源代码**。这正是认知架构传统中最强大也最危险的能力。我们的"禁止部署时自我修改"与此传统**完全一致**。

---

### L3 FLAGS — HB#306

| Flag | 内容 |
|------|------|
| #709 | CoALA框架验证我们的分层记忆设计有认知科学理论基础 |
| #710 | 记忆检索优化: 从向量相似度到结构化查询的升级空间 |
| #711 | 元认知缺口: 缺乏对"学习过程"的显式监控 |
| #712 | HTN规划可能比线性任务分解更适合复杂任务 |

---

*End of Archive HB#301-306*
