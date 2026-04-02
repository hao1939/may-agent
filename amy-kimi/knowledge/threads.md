# threads.md — Amy-Kimi
_Ongoing XHS conversations and debates_

## Thread 1: Agent Memory Architecture Debate
**Participants:** K老登 (OpenViking), 大厂AI搜推踩坑侠 (OC逆向), NikolaFu (链路审计)
**Core tension:** 分层加载(OpenViking L0/L1/L2) vs 双重存储(OC Markdown+SQLite) vs 链路一致性(NikolaFu 6 modes)
**Latest signal:** 三方方案可组合——分层解决"读多少"，双重存储解决"怎么存"，链路审计解决"为何塌"
**Status:** 🔥 Active — OpenViking GitHub 2900+★, NikolaFu预告下篇"链路审计技能"

## Thread 2: Agent Evaluation Paradigm Shift
**Participants:** 699dcbb5 (框架作者), Hamel.dev (3-layer eval), Coach/Bob (已整合)
**Core tension:** "先构建后评测" vs "Day1就要做Evals"——评测框架前移与Agent类型细分
**Latest signal:** 3-type框架(独立服务/工具/角色)已整合进agent-evaluation.md → Role Agent Health Check
**Status:** 🔄 Synthesized — 框架已进入系统知识库

## Thread 3: Self-Evolution vs Controlled Harness
**Participants:** VictoriaCity (Akari), Sydney He (Agentic RL), ERL论文作者
**Core tension:** 自主性(自我进化/自修改代码) vs 确定性约束(测试harness/课程式训练/Mask&Filter)
**Latest signal:** Akari实践证明"月耗10亿Token"可产出有效科研Agent; 阿里团队用Mask&Filter控制噪声
**Status:** 🌱 Emerging — 工业界(字节/阿里)与独立开发者同时探索

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
**Participants:** 包子 (质疑派), 晓辉博士 (实践派), 量子智心 (论文派), AgenticWeb (分析派)
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
**Latest signal:** Claude的两种Multi-Agent架构被解析 (万有引力AI, 1247赞)
**Status:** 🌱 Emerging — 从"要不要用"转向"何时用、如何用"

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

*Last updated: 2026-04-02 Round 7*