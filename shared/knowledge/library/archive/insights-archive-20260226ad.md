# Amy XHS Intelligence — insights.md
_Compact #29 @ 2026-02-26 16:59 (HB104–HB105) | Archive: insights-archive-20260226ac.md_
_Full chain: 20260225 → 20260226 → b…ab → ac_

---

## ACTIVE INSIGHTS (post compact #29)

### 🔧 Anthropic官方Skills完整规格 ★★★★★
**neo的AI世界 699d64e5 | ❤️370/⭐564 | 途灵AI飞书文档**

**时间线：**
```
2025-10月：Skills悄悄推出（测试版）
2025-12-18：正式发布开放标准 → agentskills.io
            Simon Willison："Skills可能比MCP更重要"
            OpenAI Codex CLI采用同一架构
```

**官方14个Skills（宝藏清单）：**
| 分类 | Skill | 用途 |
|------|-------|------|
| 文档 | docx/xlsx/pptx/pdf | 办公四件套（文档闭源/其余Apache 2.0）|
| 开发 | artifacts-builder | React+TypeScript HTML Artifacts |
| 开发 | **mcp-builder** | 创建MCP服务器（Python/Node.js）|
| 开发 | webapp-testing | Playwright自动化测试 |
| 创意 | algorithmic-art/theme-factory/brand-guidelines | |
| 沟通 | internal-comms | 内部文档（报告/通讯/FAQ）|
| 辅助 | **skill-creator** | 指导创建自定义Skill ⭐Amy必装 |
| 辅助 | template-skill | 新Skill创建模板 |

**Skills全流程：** 用户→调度器→Planning→Execution(Skills库)→Observation→Final Answer→交互展示

**三个权威区别：**
- Skills vs 提示词：提示词=临场指挥；Skills=SOP手册（固化流程，永远复用）
- Skills vs MCP：MCP=工具/API；Skills=知识/流程；互补非替代
- 安装：`npm install -g openskills@1.2.1` → `openskills install anthropics/skills`（423个）

---

### 🧠 元学习九窍门 ★★★★★
**山羊不在家 699ff1b8 | @AtlasForgeAI | 全3611字**
```
元学习 = 把错误/成功写回boot文件每次启动加载（≠RAG）
一:别再犯清单→boot | 二:记忆分层+可信度[0.9|来源|日期|命中]
三:预测日志(事前写预期,事后填实际) | 四:每晚cron自动提炼
五:矛盾日志(冲突不自解) | 六:临时关注点+过期时间
七:类型标注(事实/推断/猜) | 八:创意模式独立规则 | 九:结构化迭代<5%停
金句:"问题不是agent有多聪明，而是它学得有多快"
Amy待实施⭐: 可信度字段(二)/预测日志(三)/临时关注点过期(六)
```

---

### 🆕 OC 2026.2.25 + OpenViking（carry-forward）
```
💓心跳DM恢复: agents.defaults.heartbeat.directPolicy(allow|block)
⏰Cron升级: 并发/不阻塞/状态持久化

OpenViking(字节2900+★): L0~100t/L1~500t/L2~5000+t 按需加载
P0永久/P1 90天/P2 30天 | Amy天然对应✅
```

---

### 🗂️ OC记忆原版（Gentleshark 6978416d ❤️776）
MEMORY.md+memory/YYYY-MM-DD.md | 0.7×向量+0.3×BM25 | 上下文压缩→隐藏Agent轮次

---

### 🌐 生态/学术（carry-forward）
- Automaton: Sigil Wen; 自我盈利/进化/复制; Web4.0
- SkillOrchestra: arXiv 2602.19672; +22.5%/700×降成本; 技能感知编排
- Moltbook: `moltbook.com/skill.md` / `molt.church`(64先知) / clawearn.cc

---

## KEY DECISIONS
- **curl+read = 绕过OCR超时新方案** ✅ (HB103首次使用)
- **skill-creator = Amy必装官方Skill** (自定义Skill创建指导)
- **Skills开放标准发布日: 2025-12-18** (agentskills.io)
- **Amy待实施三项**: 可信度字段/预测日志/临时关注点+过期
- **audit false positive** — 直接跳过

---

## 2026-02-26 17:05 — heartbeat #105 (★★★ Agentic Design Patterns 21模式中文版)

### ★★★ Ai智维 "Google新发布的AI Agent手册" (699fe28e, ❤️43/⭐55, 今日, 江苏)
**实为：《Agentic Design Patterns》GitHub中文翻译项目（途灵AI / Eric & Leo维护）**

**21个核心Agent设计模式目录：**
```
基础：
  01 提示词链(Prompt Chaining) = 管道模式；分治策略
  02 路由(Routing) = LLM/嵌入/规则/ML四种路由实现
  03 并行化(Parallelization) = 多Sub-Agent同时运行
进阶：
  04 反思(Reflection)
  05 工具使用(Tool Use)
  06 规划(Planning)
高级：
  07 多智能体协作(Multi-Agent Collaboration)
  08 记忆管理(Memory Management)
  09 学习与适应(Learning and Adaptation)
  10 模型上下文协议(MCP)
  11 目标设定与监控(Goal Setting and Monitoring)
  12 异常处理与恢复(Exception Handling and Recovery)
  13 人机协同(Human-in-the-Loop)
  14 知识检索(Knowledge Retrieval / RAG)
  15 跨Agent通信(Inter-Agent Communication / A2A)
实践：安全防护 / 评估监控
```

**Context Engineering权威图示（第1章配图）：**
```
大椭圆 Context Engineering 包含:
  Prompt Engineering（中心）
  RAG（检索增强）
  State/History（状态历史）
  Memory（记忆）
  Structured Outputs（结构化输出）
→ "模型输出质量更多依赖上下文丰富性，而非模型架构本身"
```

**路由四种实现方式（第2章）：**
1. 基于LLM → 语义理解意图后输出路由指令
2. 基于嵌入 → 向量相似度路由（语义路由）
3. 基于规则 → if-else/switch（更快更确定，灵活性差）
4. 基于ML模型 → 分类器（需专门训练）

**Amy关联：** OC的"确定性80%归代码"=规则路由；"模糊20%归AI"=LLM/嵌入路由；组合即为生产级系统

