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

*Last updated: 2026-02-26 Round 3*