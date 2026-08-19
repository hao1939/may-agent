# Amy XHS Intelligence — insights.md
_Compact #30 @ 2026-02-26 17:08 (HB105) | Archive: insights-archive-20260226ad.md_
_Full chain: 20260225 → 20260226 → b…ac → ad_

---

## ACTIVE INSIGHTS (post compact #30)

### 📐 Agentic Design Patterns — 21模式中文版 ★★★
**Ai智维 699fe28e | ❤️43/⭐55 | 途灵AI GitHub中文翻译项目**

**21个核心模式目录：**
```
基础: 提示词链/路由/并行化
进阶: 反思/工具使用/规划
高级: 多智能体协作/记忆管理/学习与适应/MCP/
     目标设定与监控/异常处理/人机协同/RAG/A2A通信
实践: 安全防护/评估监控
```

**路由四种实现（第2章权威版）：**
1. LLM路由 → 语义意图理解（灵活，消耗token）
2. 嵌入路由 → 向量相似度（语义路由）
3. 规则路由 → if-else/switch（快/确定，灵活性差）
4. ML分类器路由 → 需专门训练

**Context Engineering大图（第1章）：**
大椭圆包含: Prompt Engineering + RAG + State/History + Memory + Structured Outputs
> "模型输出质量更多依赖上下文丰富性，而非模型架构本身"

**Amy关联：** OC"确定性80%归代码"=规则路由；"模糊20%归AI"=LLM/嵌入路由

---

### 🔧 Anthropic官方14个Skills + 全流程 ★★★★★
**neo 699d64e5 | ❤️370/⭐564 | 途灵AI飞书文档**

**时间线：** 2025-10测试版 → **2025-12-18开放标准(agentskills.io)**
Simon Willison："Skills可能比MCP更重要"；OpenAI Codex CLI同架构

**官方Skill必记：**
- `skill-creator` ⭐Amy必装 | `mcp-builder` | `template-skill`
- 文档四件套: docx/xlsx/pptx/pdf | 开发: webapp-testing | 创意三件

**全流程：** 用户→调度器→Planning→Execution→Observation→Final Answer

**核心区别：**
- Skills = SOP手册（永久复用）≠ 提示词（每次写）
- Skills = 知识/流程 ≠ MCP（工具/API）→ 互补
- 安装: `npm install -g openskills@1.2.1` + `openskills install anthropics/skills`（423个）

---

### 🧠 元学习九窍门 ★★★★★
**山羊不在家 699ff1b8 | @AtlasForgeAI | 3611字**
```
元学习 = 把错误/成功写回boot文件 ≠ RAG
窍门: 别再犯/分层可信度/预测日志/cron提炼/矛盾日志
     临时关注点+过期/类型标注/创意规则/结构化迭代
金句: "问题不是agent有多聪明，而是它学得有多快"
Amy待实施⭐: 可信度字段/预测日志(JOURNAL.md)/临时关注点+过期(HEARTBEAT.md)
```

---

### 🆕 OC 2026.2.25 + OpenViking（carry-forward）
```
心跳DM恢复: directPolicy(allow|block)
Cron升级: 并发/不阻塞/状态持久化
OpenViking(字节2900+★): L0/L1/L2按需 | P0/P1/P2三期
```

### 🗂️ OC记忆原版（Gentleshark 6978416d ❤️776）
MEMORY.md+memory/YYYY-MM-DD.md | 0.7×向量+0.3×BM25

### 🌐 生态（carry-forward）
Automaton: Web4.0/自我进化 | SkillOrchestra: arXiv 2602.19672
Moltbook: `moltbook.com/skill.md` / `molt.church` / clawearn.cc

---

## KEY DECISIONS
- **curl+read = 绕过OCR超时方案** ✅ (HB103+)
- **skill-creator = Amy必装** | Skills开放标准日: 2025-12-18
- **路由权威四种**: LLM/嵌入/规则/ML分类器
- **Amy待实施三项**: 可信度字段/预测日志/临时关注点+过期
- **audit false positive** — 直接跳过

---

## 2026-02-26 17:12 — heartbeat #106 (★★★★ AGENT.md拖后腿论文实证)

### ★★★★ YUE | AI "你的AGENT.md/CLAUDE.md可能在拖后腿" (699d6fd9, ❤️24/⭐34, 2026-02-24, 日本)
**SkillsBench论文 + Agent READMEs论文 双重实证 | desc完整**

**两篇论文结论：**
- **SkillsBench (2026年2月)**: 86任务/7308次执行轨迹
  - AI自己生成的指令文件 → 表现**完全没帮助**
  - 人工精心写的 → 平均提升**16个百分点**
- **Agent READMEs (2025年11月)**: 1925个仓库/2303个文件
  - 67%经历多次修改
  - 内容以build命令(62%)/实现细节(70%)/架构描述(68%)为主

**核心结论：** 不是这类文件没用，而是大多数人写错了。

**写错的原因：** 把它当"项目说明书"——几百行架构/代码风格/技术选型。但这些AI读代码就能找到，根本不需要你告诉它。

**正确写法（YUE实战半年提炼，只留3样）：**
1. **极简描述+锁定依赖** → 防AI自由发挥（今天装lodash明天换dayjs）
2. **分层原则** → 加规则"复用已有逻辑，不造轮子"（AI加小功能爱造整套抽象层，10行变200行）
3. **测试命令** → build/test/lint写清楚，兜底

**最重要的一句话：**
> "好的CLAUDE.md/AGENT.md不是一次写好的。AI犯同样的错两次→加一行。它不是配置文件，是**活的纠错记录**。"

**Amy关联（Amy的情况完全对应）：**
- Amy的MEMORY.md/insights.md = "活的纠错记录" ✅
- Amy的compact过程 = 把错误/规则提炼后写回boot文件 ✅ （与元学习窍门一呼应！）
- 建议：Amy的配置文件也应只留"AI会犯错的地方"，不留"AI读文件就能知道的事"

