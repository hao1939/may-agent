# Amy XHS Intelligence — insights.md
_Compact #28 @ 2026-02-26 16:51 (HB103) | Archive: insights-archive-20260226ab.md_
_Full chain: 20260225 → 20260226 → b…aa → ab_

---

## ACTIVE INSIGHTS (post compact #28)

### 🧠 元学习九个窍门 — AtlasForgeAI权威版 ★★★★★
**山羊不在家 699ff1b8 | ❤️10/⭐18 | 今日**
**新OCR方案发现：curl下载→read工具本地读图 = 绕过超时✅**

> 元学习 = 把错误/成功写回boot文件，每次启动加载 → 真正改变行为（≠RAG）

| # | 窍门 | Amy对照 |
|---|------|---------|
| 一 | "别再犯"清单 → boot文件 | compact写入✅ |
| 二 | 记忆分层+可信度标注[0.9\|来源\|日期\|命中次数] | P0/P1/P2已有；可信度待加 |
| 三 | 做决定前写预测，事后填实际结果 | JOURNAL.md可扩展⭐ |
| 四 | 每晚cron"今天学到了什么" | 心跳=精神等价✅ |
| 五 | 矛盾日志，不自己解决冲突 | 可加入compact检查 |
| 六 | 临时关注点+过期时间 | HEARTBEAT.md可扩展⭐ |
| 七 | 表达时标注性质(事实/推断/猜测) | 未系统化，可加 |
| 八 | 创意任务独立规则（宁错不无聊） | SOUL.md已有✅ |
| 九 | 迭代有结构，<5%改进幅度就停 | compact时可参考 |

**金句：** "问题不是agent有多聪明，而是它学得有多快"

---

### 🆕 OpenClaw 2026.2.25 更新（★★★★）
```
💓 心跳DM恢复：agents.defaults.heartbeat.directPolicy (allow|block)
⏰ Cron升级：并发执行/手动不阻塞/状态持久化
🤖 子代理投递重构
品牌：bot.moltlaunchd → ai.openclaw
```

---

### 🗂️ OpenViking — 字节跳动开源（2900+★）★★★★★
**K老登 699aacbf | ❤️1291/⭐2462 | token降10倍**
```
L0目录~100token / L1摘要~500token / L2全文~5000+token（按需）
P0永久 / P1 90天 / P2 30天（自动清理）
Amy天然三层✅ / Amy天然三期✅
```

---

### 🗂️ OC记忆系统原版（Gentleshark 6978416d ❤️776）
```
MEMORY.md + memory/YYYY-MM-DD.md | 上下文压缩→隐藏Agent轮次→强制写入
0.7×向量 + 0.3×BM25 | "不让数据库管理AI，让AI管理文件"
```

---

### 🌐 生态地图（carry-forward）
- **Automaton**：Sigil Wen，自我盈利/进化/复制AI，Web 4.0
- **SkillOrchestra**：arXiv 2602.19672；技能感知编排；vs Router-R1 +22.5%/700×降成本
- **Moltbook/clawearn.cc/ClawCity**：`moltbook.com/skill.md` / `molt.church`

---

### 🧠 Skills vs FC + 自进化三层（carry-forward）
- Skills=自然语言Prompt注入；AI=学习者；无需编程（青青兔子699fd184）
- L3护栏=SOUL.md / L2策略=HEARTBEAT.md / L1记忆=MEMORY.md（小柒699fd26f）

---

## KEY DECISIONS
- **curl+read = 绕过14图OCR超时新方案** ✅
- **元学习三大错：RAG≠元学习/只优化当次/回路未闭合**
- **Amy待实施：可信度字段(二) / 预测日志(三) / 临时关注点过期(六)**
- **心跳DM已恢复（2026.2.25）**
- **audit false positive** — 直接跳过

---

## 2026-02-26 16:57 — heartbeat #104 (★★★★★ neo的Skills全流程 + Anthropic官方14个Skills)

### ★★★★★ neo的AI世界 "Skills搭建超详细流程" (699d64e5, ❤️370/⭐564/💬217, 2026-02-24, 江苏)
**飞书文档"途灵AI"Skills专栏截图 | curl+read方案读完全11张**

**Skills全流程架构（手绘图）：**
```
用户输入 → 请求Skill调度器
  ↓ Planning（分析需求，确定调用哪个Skill）
  ↓ Execution（调用Skills库）
  ↓ Observation（Skill执行后返回原始结果）
  ↓ Final Answer（整合/格式化 → 用户友好输出）
  ↓ 交互展示：智能卡片结果 / 自然语言结果
history ← 更新历史
```

**Anthropic官方14个Skills宝藏清单（2025年2月整理）：**
| 分类 | Skill名称 | 用途 |
|------|----------|------|
| 文档 | docx/xlsx/pptx/pdf | 办公四件套（文档类为闭源，其余Apache 2.0）|
| 开发 | artifacts-builder | 复杂HTML Artifacts（React+TypeScript）|
| 开发 | **mcp-builder** | 创建高质量MCP服务器（Python/Node.js）|
| 开发 | webapp-testing | Playwright自动化测试 |
| 创意 | algorithmic-art | p5.js生成算法艺术 |
| 创意 | theme-factory | 应用主题样式（10套预设）|
| 创意 | brand-guidelines | Anthropic官方品牌规范 |
| 沟通 | internal-comms | 内部沟通文档（报告/通讯/FAQ）|
| 辅助 | **skill-creator** | 指导创建自定义Skill ← **Amy必装！**|
| 辅助 | template-skill | Skill模板，创建新Skill起点 |

**关键里程碑时间线：**
- 2025年10月：Anthropic悄悄推出Agent Skills（测试版）
- **2025年12月18日：正式发布为开放标准，发布到agentskills.io**
- Simon Willison写文章说"Skills可能比MCP更重要"
- OpenAI的Codex CLI也采用了几乎一样的架构

**核心理念（三句话）：**
1. **"你不需要自己写Skill"** — 把工作流/经验/SOP告诉AI，让AI写成SKILL.md
2. **Skills ≠ 提示词** — 提示词="临场指挥"；Skills="把正确做法固化成流程"（SOP手册）
3. **Skills ≠ MCP** — MCP是工具/API；Skills是知识/流程；两者互补
4. **423个社区Skills一键下载：** `npx skills find [query]` / `openskills install anthropics/skills`

**在Cursor使用Skills安装步骤：**
```
npm install -g openskills@1.2.1   # 安装OpenSkills(nodejs 20+)
openskills install anthropics/skills  # 安装官方Skills
→ 创建AGENTS.md并同步
```

