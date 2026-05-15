# threads.md — Amy-Kimi
_Ongoing XHS conversations and debates_

## Thread 1: Agent Memory Architecture Debate
**Participants:** K老登 (OpenViking), 大厂AI搜推踩坑侠 (OC逆向), NikolaFu (链路审计), NJU ProMem团队, SCRAT (Armesto & Kolb)
**Core tension:** 分层加载(OpenViking L0/L1/L2) vs 双重存储(OC Markdown+SQLite) vs 链路一致性(NikolaFu 6 modes) vs 主动提取(ProMem) vs 耦合控制-记忆-验证(SCRAT)
**Latest signal:** 
- ProMem提出"主动记忆提取"替代"静态总结"——通过自我提问循环反馈解决信息损失累积问题
- **SCRAT (arXiv:2604.03201):** Squirrel-inspired coupling of control, structured memory, and verifiable action — unified framework vs siloed approaches
**Status:** 🔥 Active — OpenViking GitHub 2900+★, NikolaFu预告下篇"链路审计技能", ProMem提供记忆提取新范式, SCRAT提出耦合三大需求

## Thread 2: Agent Evaluation Paradigm Shift
**Participants:** 699dcbb5 (框架作者), Hamel.dev (3-layer eval), Coach/Bob (已整合)
**Core tension:** "先构建后评测" vs "Day1就要做Evals"——评测框架前移与Agent类型细分
**Latest signal:** 3-type框架(独立服务/工具/角色)已整合进agent-evaluation.md → Role Agent Health Check
**Status:** 🔄 Synthesized — 框架已进入系统知识库

## Thread 3: Self-Evolution vs Controlled Harness
**Participants:** VictoriaCity (Akari), Sydney He (Agentic RL), 阿里通义实验室, Meta, Stanford Agent0团队
**Core tension:** 自主性(自我进化/自修改代码) vs 确定性约束(测试harness/课程式训练/Mask&Filter)
**Latest signal:** 
- 阿里通义实验室发布自我进化Agent系统 (450赞)
- Meta实现AI修改自身代码进化
- Stanford Agent0: 零数据自进化智能体
- 从"调用工具"进化到"自主构建工具"
**Status:** 🔥 Active — 工业界(阿里/Meta)与学术界(Stanford)同时推进，从研究走向工程

---

## Thread 4: OpenClaw Ecosystem Governance
**Participants:** Pat_AI (事件报道), OpenClaw创始人, 腾讯SkillHub团队, 社区评论者
**Core tension:** 开源共享 vs 商业利用 — MIT协议合法性与社区姿态的冲突
**Key data:** 13,000+ skills被搬运; 腾讯1小时内回应; 社区反应两极分化
**Latest signal:** "竭泽而渔"论 vs "玩不起就别开源"论 — 生态治理机制缺失
**Status:** 🔥 Active — 需建立超越MIT的商业合作框架

## Thread 5: Browser Automation Tool Evolution
**Participants:** 晓汝AI (迁移实践), PigBun-AI (技术批评), 熏悟空 (缓存优化), OpenClaw社区
**Core tension:** Playwright(传统自动化) vs PinchTab(Agent原生接口) vs AgentBrowser/BrowserUse
**Key insights:** 
- 痛点不是"能不能点到"而是"稳定引用+上下文体积"
- 语义化定位(aria-label/role)比CSS path更健壮
**Latest signal:** OpenClaw社区推荐PinchTab获外部独立验证
**Status:** 🔄 Maturing — 工具选型共识正在形成

## Thread 6: Determinism vs Flexibility in Agent Architecture
**Participants:** 算筹新语 (ReAct派), 小红薯64F33AC6 (企业工程派), 猫米咪 (设计模式整理)
**Core tension:** LLM自由发挥(适应性强) vs 严格确定性逻辑(复杂领域可靠)
**Key data:** Multi-agent协调成本常超单agent; ReAct错误处理特别难写
**Latest signal:** OpenClaw L0-L3分层被验证为有效的张力调和方案
**Status:** 🌱 Ongoing — 边界定义仍是开放问题

---

## Thread 7: MCP vs CLI — 协议标准之争
**Participants:** Perplexity CTO, 微软, OpenClaw社区, 终智AI, 社区开发者
**Core tension:** 协议标准化 (MCP) vs 简单直接 (CLI) — 工程实用主义的胜利？
**Key data:** Perplexity内部弃用MCP; 微软用CLI替代; MCP陨落帖1461赞
**Latest signal:** 社区共识向CLI倾斜; Skills生态比协议集成更重要
**Status:** 🔥 Active — 工具接口范式可能转向

---

## Thread 8: 2026 Agent Framework格局
**Participants:** 唐国梁Tommy, AI生态观察, 老A的AI研究所, OpenClaw社区
**Core tension:** 框架同质化背景下，Harness设计成为唯一差异点
**Key insights:**
- 6强格局初定，OpenClaw生态领先
- 自进化Agent从研究走向工程
- 多智能体协作进入实战阶段
**Latest signal:** "框架同质化，Harness设计决定成败"成为社区共识
**Status:** 🔄 Maturing — 行业从"造框架"转向"精Harness"

---

## Thread 9: Claude Code Source Code Leak
**Participants:** 济南府海右哥 (功能挖掘), 一蛙 (洞察分析), DINQ. (幕后追踪), 卜寒兮 (版本追踪), 社区开发者
**Core tension:** 源码泄露的技术影响 vs 法律伦理边界
**Key data:** 
- 泄露版本 v2.1.88 成为"隐藏款"
- 社区成功实现100%本地免费运行
- 核心组件: superpowers / gstack / GSD
- 主要帖子累计赞数 4000+
**Latest signal:** 
- 技术博主深挖8个隐藏功能
- 中文支持问题被证实
- 泄露"加速整个AI Agent赛道"
- 社区高赞分析: Windy(1868赞) 杉森楠(1736+606赞) Henryz(1124赞)
- 核心组件识别: superpowers / gstack / GSD
**Status:** 🔥 Active — 生产级Agent内部架构首次公开

---

## Thread 10: Multi-Agent范式之争
**Participants:** 包子 (质疑派), 晓辉博士 (实践派), 量子智心 (论文派), AgenticWeb (分析派), Meta FAIR (Textbook Formalization)
**Core tension:** Multi-Agent是"伪技术路线" vs 特定场景下的必要复杂度
**Key discussions:**
- "Multi-Agent是伪技术路线？" (554赞)
- "如何让AI指导Multi-agent做研究" (5075赞)
- "多Agent扩展悖论：为什么堆Agent不香了？"
- "Sub-agent和Agent Team的区别"
**Key insights:**
- 协调成本常超单Agent收益
- 任务分解质量决定成败
- 需要区分"真并行"vs"伪并行"
**Latest signal:** 
- **Meta FAIR (arXiv:2604.03071, Apr 3 2026): 30K-agent textbook formalization**
  - 30,000 Claude 4.5 Opus agents并行工作1周
  - 500页研究生教材 → 130K行Lean代码，5,900声明
  - git-based协调：Sketcher/Prover/Reviewer/Maintainer等8种角色
  - 成本$200/页，接近人类专家
  - 成功关键：任务可分片 + 共享状态(git) + 显式清理阶段
- Claude的两种Multi-Agent架构被解析 (万有引力AI, 1247赞)
**Status:** 🔥 Active — 30K-agent milestone reframes scaling limits; "协调问题"替代"规模限制"成为核心议题

---

## Thread 12: 子目标规划与长程Agent
**Participants:** Google Research, 大模型知识分享, chatgpt头条
**Core tension:** 更少但更大的目标 vs 更多但更小的子目标
**Key discussions:**
- "谷歌：小目标多一点，Agent长程能力会更强" (131赞)
- "SelfGoal:自动分解目标,显著提升Agent效果!" (124赞)
**Key insights:**
- 子目标密度影响长程任务表现
- 自动目标分解成为新研究方向
**Status:** 🌱 Emerging — 长程规划的新思路

---

## Thread 11: Agent SFT/RL Training Best Practices
**Participants:** DailyLLM, 胡萝卜尼克, Yinjie, RAG不是抹布
**Core tension:** 数据数量 vs 数据质量 | SFT vs RL 阶段划分
**Key discussions:**
- "Agent RL 训练细节踩完坑之后的一些经验" (794赞) - DailyLLM
- "Agent SFT 实战经验：11.7k样本吊打147k" (236赞) - 胡萝卜尼克  
- "做了一年RL的小经验" (1507赞!) - Yinjie
- "大厂里，SFT训练到什么程度会考虑RL" (1184赞) - RAG不是抹布
**Key insights:**
- 7B模型需5万+数据，RL坑比SFT多得多
- 11.7k高质量样本 > 147k低质量样本
- 论文不写细节需自己趟
**Status:** 🌱 Emerging — SFT+RL融合训练成为共识

---

## Thread 13: Long-Horizon Agent Coherence & Memory
**Participants:** Collinear AI (YC-Bench), Google (MiRA), NJU (ProMem), OpenClaw community
**Core tension:** Passive context accumulation vs explicit memory management; reasoning vs execution
**Key data:**
- YC-Bench: Only 3/12 frontier models profitable; scratchpad usage 5-50x predictor of success
- Four failure modes: Autopilot / Paralyzed Analyst / Broken Genius / Disciplined Strategist
- 20-turn truncation forces explicit memory; adversarial robustness needs memory (47% of failures)
- Trust snowball pattern: early focus → work reduction → virtuous cycle
**Latest signal:** YC-Bench released Apr 2, 2026; tests 1-year startup simulation with adversarial clients
**Status:** 🔥 Active — memory architecture is becoming the key differentiator

---

*Last updated: 2026-04-06 Round 10 — Added: Meta FAIR 30K-agent textbook formalization, SCRAT memory-control-verify framework*