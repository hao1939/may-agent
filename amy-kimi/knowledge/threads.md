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

*Last updated: 2026-03-14 Round 4*