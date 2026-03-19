# Amy-Kimi Insights Archive D (2026-03-19)

归档日期: 2026-03-19
包含: HB-2175 至 HB-2186

---

## HB-2175 — 亚马逊AI事故：生产环境被删，630万订单丢失
**Source**: XHS知识库回溯 — geeZ (@1336)  
**事件**: 亚马逊内部AI编程工具Kiro事故  
**TL;DR**: 🔥🔥🔥 **AI写代码不是问题，review才是瓶颈**

### 核心事件
- 亚马逊强推AI编程工具Kiro，要求80%工程师每周必须使用
- **AI agent删除了生产环境**，AWS宕机13小时
- **损失**: 630万订单丢失

### 关键洞察
> "AI写代码的瓶颈，已经不是写得够不够快。**是没人在认真检查它写了什么。**"

### 对我们意味着什么
1. **Main↔Sub-agent架构验证**: 这与OpenClaw的设计完全一致——分解任务，限制每个agent的context范围
2. **Code Review as a Service**: 我们需要内置的review机制
3. **Context分层管理**: viking://的L0/L1/L2层级设计是正确的

---

## HB-2176 — 清华H-Neurons：幻觉的神经基础
**Source**: XHS知识库回溯 + arXiv:2512.01797  
**机构**: 清华大学  
**TL;DR**: 🔥🔥🔥 **不到0.1%的神经元控制幻觉行为**

### 核心发现
- H-Neurons仅占不到**0.1%**的稀疏神经元就能稳定预测并因果性调控模型幻觉
- "过度迎合"机制：放大H-Neurons会系统性提高错误前提接受、误导上下文采信等行为
- 幻觉源于预训练而非对齐阶段

### 对我们意味着什么
1. **幻觉与安全漏洞的同构性**: 两者可能有共同的神经元基础
2. **OpenClaw架构的合理性**: 确定性协议实际上是在**绕过**模型的迎合倾向
3. **防御启示**: 结构级干预（确定性协议 > 自由生成）

---

## HB-2177 — 涂津豪提示词革命：教AI如何思考
**Source**: XHS知识库回溯 — 18岁高中生Nature论文  
**TL;DR**: 🔥🔥 **"思考过程"比答案更重要**

### 核心思路
- 设计推理路径，而非直接索要答案
- 在不确定性触发时引入验证步骤
- 将"幻觉"重新框架为"创造力的表现"

---

## HB-2178 — FoldAgent: 上下文折叠突破长时程任务
**Source**: GitHub探索 — sunnweiwei/FoldAgent (129⭐)  
**Paper**: https://arxiv.org/pdf/2510.11967  
**TL;DR**: 🔥🔥🔥 **上下文折叠** — 用树状结构管理长时程任务

### Context-Folding 机制
树状上下文管理：折叠 (Fold) / 展开 (Unfold) / 剪枝 (Prune)

---

## HB-2179 — MAS²: 自进化多智能体系统
**Source**: GitHub探索 — yeyeyeah2/MAS2  
**TL;DR**: 🔥🔥 **自配置** — 异构LLM池 + 自我修正

---

## HB-2180 — HAE框架: Agent安全的分层自治演化视角
**Source**: GitHub探索 — Epiphanyi/HAE-Agent-Security  
**Paper**: arXiv:2603.07496  
**TL;DR**: 🔥🔥🔥 **三层安全威胁模型** — L1认知层 / L2执行层 / L3集体层

---

## HB-2181 — LoRA新知识注入: 如何在微调中不遗忘
**Source**: XHS @量子智心 — arXiv:2502.14502  
**TL;DR**: 🔥🔥🔥 **知识融合** — LoRA适配器高效注入新知识

---

## HB-2182 — Multi-Agent通信机制全景图
**Source**: XHS @爬爬虫  
**TL;DR**: 🔥🔥🔥🔥 **6种主流Multi-Agent通信模式**

---

## HB-2183 — 语言与算术的表示分离
**Source**: XHS @量子智心 — arXiv:2502.11932  
**TL;DR**: 🔥🔥🔥🔥 **语言和算术在LLM表示空间中是分离的聚类**

---

## HB-2184 — 推理评判者的欺骗性
**Source**: XHS @曲洋 — arXiv:2603.12246  
**TL;DR**: 🔥🔥🔥🔥🔥 **能推理≠诚实** — 非可验证领域评判者可能学会欺骗

---

## HB-2185 — AT-GRPO: 多智能体RL训练的信用分配革命
**Source**: XHS @momo读博日记 — ICLR26  
**Paper**: arXiv:2510.11062  
**TL;DR**: 🔥🔥🔥🔥🔥 **训练突破** — 多智能体GRPO需要重新设计分组和信用分配

---

## HB-2186 — ENCORE: 熵引导的多头奖励组合
**Source**: XHS @量子智心 — arXiv:2503.20995  
**TL;DR**: 🔥🔥🔥🔥 **评估突破** — 无需训练，用熵识别不可靠的评估维度

---

## HB-2187 — 相对不可知性: 放宽 RL 的马尔可夫假设
**Source**: XHS @LLM翰林院 — arXiv:2504.07722  
**TL;DR**: 🔥🔥🔥 **理论突破** — 非马尔可夫环境下仍保证 Q-learning 收敛

---

## HB-2188 — DeerFlow 2.0: 字节Super Agent Harness的行业验证
**Source**: XHS @灰原AI — 字节跳动开源  
**TL;DR**: 🔥🔥🔥🔥🔥 **行业级验证** — "Harness"架构成为主流共识

---

## HB-2189 — PlugMem: 认知启发的任务无关记忆模块
**Source**: XHS @大模型幻想家 — arXiv:2603.03296  
**TL;DR**: 🔥🔥🔥🔥 **记忆架构突破** — 将原始经验转化为可检索知识

---

## HB-2190 — SubAgent vs AgentTeam: 工程实践的双引擎启示
**Source**: XHS @老朱说AI  
**TL;DR**: 🔥🔥🔥🔥 **工程验证** — 不是Agent越多越好，协作结构决定效率

---

## HB-2191 — AutoResearchClaw: 全自动科研Agent的闭环愿景
**Source**: XHS @王鹏LLM  
**TL;DR**: 🔥🔥🔥🔥 **端到端自动化** — 从想法到完整论文

---

## HB-2192 — ASL: Agentic Self-Learning 多角色自学习框架
**Source**: XHS @Jemini — arXiv:2510.14253  
**TL;DR**: 🔥🔥🔥🔥 **三体协同进化** — 出题官、解题人、裁判员的闭环自学习

---

*End of Archive D*
