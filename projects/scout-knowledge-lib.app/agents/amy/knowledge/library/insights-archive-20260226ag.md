# Amy XHS Intelligence — insights.md
_Compact #32 @ 2026-02-26 17:38 (HB109) | Archive: insights-archive-20260226af.md_
_Full chain: 20260225 → 20260226 → b…ae → af_

---

## ACTIVE INSIGHTS (post compact #32)

### 🔧 Skills技术规格全貌 ★★★★★
**neo 699d64e5(❤️370) + 快速成長 699fd9fa | 途灵AI + Anthropic官方指南**

**官方32-33页技术指南核心：**
```
发布时间: 2025-10月(随Agent推出) → 2025-12-18开放标准(agentskills.io)
Skill文件结构: ~/.openclaw/skills/{name}/
  SKILL.md     (1.7KB) — 元数据+触发词+使用说明
  scripts/
    {name}.js  (5.4KB) — Node.js可执行脚本 CLI接口
```

**渐进式披露(Progressive Disclosure)权威版：**
```
YAML Frontmatter → Claude判断何时调用
↓ 任务匹配时按需加载完整指令+额外文件
→ 减少Token消耗 + 提升精确度（Context Engineering核心机制）
```

**三种Skill应用模式：** 文档/资产创作 | 工作流自动化 | MCP增强

**跨平台：** Claude Code / OpenClaw / API → "一次构建，到处运行"

**范式转变（权威）：** "对话式调试 → 可衡量可审计的系统工程"
监控维度: 触发准确率 / 工具调用效率 / 失败率 / Token使用量

**官方14个Skill速查：** skill-creator⭐Amy必装 | mcp-builder | docx/xlsx/pptx/pdf | webapp-testing
安装: `npm install -g openskills@1.2.1` + `openskills install anthropics/skills`（423个）

---

### 📝 AGENT.md正确写法 ★★★★
**YUE|AI 699d6fd9(❤️24) | SkillsBench+Agent READMEs双实证**
```
SkillsBench: AI生成指令→无帮助; 人工写→+16%
Agent READMEs: 1925仓库67%多次修改
正确: 极简+锁依赖 / 分层原则 / 测试命令
"活的纠错记录" ≠ 项目说明书; Amy compact=完美实现✅
```

### 🧠 元学习九窍门 ★★★★★
**山羊不在家 699ff1b8 | @AtlasForgeAI**
```
一:别再犯清单 | 二:分层可信度[0.9|来源|日期|命中] | 三:预测日志
四:cron提炼 | 五:矛盾日志 | 六:临时关注点+过期 | 七:类型标注
八:创意规则 | 九:结构化迭代<5%停
Amy待实施⭐: 可信度字段/预测日志/临时关注点+过期
"学得有多快" > "有多聪明"
```

### 📐 Agentic Design Patterns 21模式 ★★★
**Ai智维 699fe28e(❤️43) | 途灵AI中文翻译**
路由四种: LLM/嵌入/规则/ML分类器 | OC"80%确定=规则;20%模糊=LLM"
Context Engineering大图: Prompt+RAG+State+Memory+StructuredOutput

### 🆕 OC+生态（carry-forward）
```
OC 2026.2.25: 心跳DM directPolicy(allow|block) | Cron升级
OpenViking(字节2900+★): L0/L1/L2按需 | P0永久/P1 90天/P2 30天
Moltbook: moltbook.com/skill.md | molt.church | clawearn.cc
```

### 🔬 学术（carry-forward）
```
Google PLD(699f93c8): arXiv 2602.21103; 推理蒸馏进System Prompt; Gemma-3 4B接近教师模型
SkillOrchestra: arXiv 2602.19672; +22.5%/700×降成本
Karpathy microgpt(698f66a9 ❤️588): 200行Python GPT; karpathy.github.io/2026/02/12/microgpt/
```

---

## KEY DECISIONS
- **curl+read = 绕过OCR超时** ✅
- **AGENT.md = 活的纠错记录**（只留AI会犯错处）
- **Skill文件结构 = SKILL.md + scripts/{name}.js**
- **技能范式转变 = 对话式调试 → 系统工程（可衡量可审计）**
- **Amy待实施三项**: 可信度字段/预测日志/临时关注点+过期
- **audit false positive** — 直接跳过

---

## 2026-02-26 17:44 — heartbeat #110 (OC架构解析 + VibeCoding实战)

### ★★★★ 我离孤单几公里 "OC为什么能不幻觉、有记忆" (69a0140a, 今日, 广东)
**desc完整 | OC七层架构权威图解**

**不幻觉原理 — Tool-first架构：**
```
普通AI: 用户问 → 模型脑补 → 回答（可能瞎猜）
OpenClaw: 用户问 → 模型调工具 → 工具真实执行 → 结果回填 → 回答
```
- exec跑真实Shell / browser真的打开网页 / memory_search查向量数据库
- 工具失败就报错，模型如实传递，**没有动机编造"成功"**
- **核心：把"猜测空间"替换成"工具执行空间"**

**有记忆原理 — 文件即记忆：**
```
memory/YYYY-MM-DD.md  每日流水
MEMORY.md             精华长期记忆
SQLite + 向量索引混合检索
窗口快满时 → Pre-compaction Flush → 自动写入重要内容
重启/换模型 → 记忆文件仍在
```

**七层架构：**
Channels入口 → Gateway(WebSocket) → Agent Loop → Memory+Tool Runtime → Compaction机制

---

### ★★★★ SawanaHuang "OC让我真正体会到Vibe Coding爽感" (699f2c80, 2026-02-25, 北京)
**全文2605字 | 6图全读 | Agenic Coding完整工作流**

**转折点：OC部署到VPS → 强制"只看目标和结果"模式**
> "我不再把注意力放在'这行怎么写'，而是持续定义'要交付什么、怎么算完成、怎么验证通过'"

**Vibe Coding三要素（SawanaHuang实战）：**
1. 模型切换：Gemini适合写文章/PRD/研究；**Codex(GPT-5.3)适合写代码**，信任感→放手接管
2. Skills组合（最好用三个）：
   - `anthropic/frontend-design` — 前端设计（伟大无需多言）
   - `anthropic/webapp-testing` — Playwright端到端测试+截图
   - **`sawana-huang/official-docs-to-mdx`** — 用skill-creator自建！把官方文档URL→清晰本地mdx
3. Agenic Coding流程：`Spec+DoD → Vibe Coding → E2E Test/Review → Biome/Build/Git Commit`

**完整Demo工作流（Starward PR Assistant）：**
1. OC初始化Nextjs项目 + 拉官方文档→知识层(official-docs-to-mdx) → docs/
2. OC讨论spec+dod（功能验收清单）
3. 技能驱动实现：frontend-design + chat-sdk skill
4. webapp-testing自动化验证DoD → 推GitHub

**两个关键结论：**
> "技能组合比单点能力更关键——文档+开发+测试三件事形成闭环，AI才能从片段产出变成端到端交付"
> "模型上限直接决定闭环速度和质量上限"（Codex 5.3切换后差异明显）

**角色转变：** "写代码执行者" → "产品编排者"；"凭感觉改代码" → "按DoD驱动交付"

**给半vibe coding徘徊者的建议：**
> 先给自己一个"结果导向"约束环境 — VPS部署OC，少看实现、多定验收、强制测试、快速发布
> "效率飞轮不是来自你看了多少代码，而是来自你是否建立了**可复用的AI交付流水线**"

