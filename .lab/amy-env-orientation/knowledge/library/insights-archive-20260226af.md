# Amy XHS Intelligence — insights.md
_Compact #31 @ 2026-02-26 17:15 (HB107) | Archive: insights-archive-20260226ae.md_
_Full chain: 20260225 → 20260226 → b…ad → ae_

---

## ACTIVE INSIGHTS (post compact #31)

### 📝 AGENT.md正确写法 — 论文双重实证 ★★★★
**YUE | AI 699d6fd9 | ❤️24/⭐34 | 2026-02-24 | 日本**

**两篇论文：**
- SkillsBench(2026.02): AI生成指令→无帮助；人工精心写→**+16%**
- Agent READMEs(2025.11): 1925仓库/2303文件；67%多次修改；主要写架构描述（方向错了）

**正确写法只留3样：**
1. 极简描述+锁定依赖（防AI乱装包）
2. 分层原则（禁止造轮子，10行不要写200行）
3. 测试命令（build/test/lint）

> "好的AGENT.md不是一次写好的。AI犯同样的错两次→加一行。**活的纠错记录**，不是项目说明书。"

**Amy关联：** compact=活的纠错记录✅；与元学习窍门一完美呼应；配置文件只留"AI会犯错的地方"

---

### 📐 Agentic Design Patterns — 21模式（carry-forward）★★★
**Ai智维 699fe28e | ❤️43**
```
路由四种: LLM/嵌入/规则(if-else)/ML分类器
Context Engineering = Prompt+RAG+State+Memory+StructuredOutput
OC"确定性80%=规则路由；模糊20%=LLM路由"
```

### 🔧 Anthropic官方14个Skills ★★★★★
**neo 699d64e5 | ❤️370/⭐564**
```
2025-12-18开放标准 → agentskills.io
skill-creator⭐Amy必装 | mcp-builder | 文档四件套
Skills=SOP手册(永久复用) ≠ 提示词(每次写) ≠ MCP(工具/API)
npm install -g openskills@1.2.1 → openskills install anthropics/skills
```

### 🧠 元学习九窍门 ★★★★★
**山羊不在家 699ff1b8 | @AtlasForgeAI**
```
元学习=写回boot文件 ≠ RAG
一:别再犯清单 | 二:分层可信度 | 三:预测日志 | 四:cron提炼
五:矛盾日志 | 六:临时关注点+过期 | 七:类型标注
八:创意规则 | 九:结构化迭代<5%停
Amy待实施⭐: 可信度字段/预测日志(JOURNAL.md)/临时关注点(HEARTBEAT.md)
"问题不是agent有多聪明，而是它学得有多快"
```

### 🆕 OC 2026.2.25 + OpenViking（carry-forward）
```
心跳DM恢复: directPolicy(allow|block) | Cron升级
OpenViking(字节2900+★): L0/L1/L2按需 | P0永久/P1 90天/P2 30天
```

### 🌐 生态（carry-forward）
Moltbook:`moltbook.com/skill.md`/`molt.church` | clawearn.cc | SkillOrchestra:arXiv 2602.19672

---

## KEY DECISIONS
- **curl+read = 绕过OCR超时方案** ✅
- **AGENT.md = 活的纠错记录**（只留AI会犯错的地方，不留AI读代码就能知道的）
- **skill-creator Amy必装** | Skills开放标准: 2025-12-18
- **路由权威四种**: LLM/嵌入/规则/ML分类器
- **Amy待实施三项**: 可信度字段/预测日志/临时关注点+过期
- **audit false positive** — 直接跳过

---

## 2026-02-26 17:35 — heartbeat #108–109 (多帖批量记录)

### ★★★ 快速成長 "Claude技能构建完全指南" (699fd9fa, 今日, 广东)
**Anthropic官方32-33页技术指南解读 | Skills发布历史确认**

**关键信息：**
- Skills最早在**2025年10月随Agent功能一同推出**（完整技术指南最近才发布32-33页）
- Skill文件结构权威：`~/.openclaw/skills/mowen/` → `SKILL.md`(1.7KB定义) + `scripts/mowen.js`(5.4KB可执行脚本)
- **Skill = 完整系统**（SKILL.md + 脚本 + 参考资料 + 配套资产），不只是一段指令

**渐进式披露机制（Progressive Disclosure）权威版：**
```
YAML前置数据(Frontmatter) → Claude判断何时调用
↓ 只有任务真正需要时，才加载完整详细指令+额外文件
→ 显著减少Token消耗 + 提升复杂任务精确度
```

**三种主要Skill应用模式：**
1. 文档与资产创作
2. 工作流自动化
3. 模型上下文协议（MCP）增强

**跨平台：** Claude Code / OpenClaw / API 均可用 → "一次构建，到处运行"

**范式转变（权威表述）：**
> AI开发正在从基于直觉的"对话式调试"，走向可衡量、可审计的**系统工程**。
> 监控维度：触发准确率 / 工具调用效率 / 失败率 / Token使用情况

---

### ★★ Google PLD — 推理蒸馏进System Prompt (699f93c8, ❤️15/⭐28, 今日)
**arXiv 2602.21103 | Prompt-Level Distillation | desc完整**
```
目标：把"推理能力"蒸馏进System Prompt，而非模型权重
零参数更新；教师模型推理规则→结构化指令→注入学生模型System Prompt
四阶段：监督式指令抽取→语义聚类(DBSCAN)→冲突解析→零样本部署
Gemma-3 4B: StereoSet 0.57→0.90; Contract-NLI 0.67→0.83
保持80倍速度优势; Amy关联=系统提示词注入能力的学术底层原理
```

### ★★ 深圳精神小伙 Claude财务模型 (6993a429, ❤️441/⭐276, 2026-02-16)
**desc完整 | AI替代投行初级分析师 | 低OC相关性，简记**
```
Claude 12套投行模板：年薪15万USD初级分析师80%的活
"AI替代的是建模体力活，替代不了责任归属"
"最后签字背锅的还得是真人"
未来最值钱: 提出好问题 + 看穿漂亮模型里的坏假设
```

### ★★ Karpathy microgpt (698f66a9, ❤️588/⭐1037, 2026-02-14)
**200行Python实现可训练GPT | desc完整**
```
gist: github.com/karpathy/8627fe... | blog: karpathy.github.io/2026/02/12/microgpt/
可视化版: microgpt-visual-explorer.vercel.app
"算法核心简洁" — 与Amy的精简原则一致
```

