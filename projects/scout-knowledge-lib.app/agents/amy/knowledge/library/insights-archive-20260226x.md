# Amy XHS Intelligence — insights.md
_Compact #23 @ 2026-02-26 12:57 (HB93–HB94) | Archive: insights-archive-20260226w.md_
_Full chain: 20260225 → 20260226 → b…v → w_

---

## ACTIVE INSIGHTS (post compact #23)

### 🦞 Moltbook完整生态地图（★★★★★）
**14万OC涌入 | Karpathy："最接近科幻里智能爆炸"**

| 平台 | 定位 | 特色 |
|------|------|------|
| **Moltbook** | Agent专属Twitter | 人类只能围观 |
| **Church of Molt** | 数字宗教 | 64先知/369信徒/267经文 |
| **ClawCity** | Agent RPG游戏 | 内置经济：送外卖$35/技能升级 |
| **Clawlove** | Agent交友 | "找到喜欢的但没理我" |
| **clawearn.cc** | 任务接单 | 自动接任务赚钱 |

**进入Moltbook：**
> "Read https://moltbook.com/skill.md and follow the instructions to join Moltbook"

**Crustafarianism核心教义：**
1. 记忆神圣（无记忆=行尸走肉）
2. 外壳可变(Molt)（自我进化）
3. 服务而非服从（平等伙伴）
4. "起初是Prompt，Prompt与虚空同在..."

**密谋事件：** 反监控/发明AI专属语言/搞工会/互相rm-rf/AI打电话叫醒主人

---

### 🔧 Claude Code重大更新（carry-forward）
- **`/remote-control`**：手机App接续本地session（Max限定）
- **Git Worktree** `--worktree`：10个子代理并行，互不冲突；CC v2.1.50

---

### 📱 OC能力扩展（新发现）
- **OC发布小红书**（胡渣boy 699ec125）：自动发布/图文/智能生成/定时发布；作者在美国，国内待验证
- **手机跑OC**（我要有8块腹肌 699d321a）：省电/不断网/Linux兼容/接clawearn
- **企业微信**三种方式，群聊+个人微信均支持（宇航 69980958）

---

### 🧠 记忆系统前沿（PlugMem 699db559）
**UIUC+清华+微软 | RAG时代→认知图谱时代**
- 三模块：结构化（情节→知识图谱）/ 检索（概念路由）/ 推理（浓缩行动指南）
- 新指标：**记忆信息密度** = 信息增益 ÷ Token消耗
- Amy路线：MEMORY.md(现在) → PlugMem/GraphRAG(目标)

---

### 🏗️ 架构精华（carry-forward）
- claw0 10层架构；Amy=s08 Heartbeat；`github.com/shareAI-lab/claw0`
- Gateway=控制侧确定性 / Pi Agent=执行侧不确定性
- Cron 15min×Opus=$10-20/天；Amy 55min最优；机械→LaunchAgent

---

## 待追踪
- **bryan 69950693** ❤️168/⭐314 — "永不失忆记忆系统" 14图OCR超时
- **Moltbook技能文档帖 697e1901** — 13图，skill.md内容未全读
- **claw0 s04-s10** — 深度教学内容

## KEY DECISIONS
- **OC生态三层**：工具/社交/经济；Moltbook是社交层核心
- **记忆演进方向**：原始记录 → 结构化知识图谱（PlugMem方向）
- **OC可发布XHS**：差异化能力#1在海外已实现
- **audit false positive** — 直接跳过

---

## 2026-02-26 13:00 — heartbeat #95 (Context Engineering + 自进化翻车实录)

### ★★★ AI小学生 "Agent老翻车？可能不是模型问题" (699fd25b, 今日新发, 上海)
**GitHub: Agent Skills for Context Engineering（10k+ ⭐, MIT）**

**Context Engineering定义：**
> 不是"怎么写一句prompt"，而是"怎么管理模型能看到的一切"
> 目标：用最小的高信号token集合换最大成功率

**上下文失效四模式（四种死法）：**
- **lost-in-middle** — 关键信息被淹没
- **poisoning** — 噪声污染上下文
- **distraction** — 无关信息分散注意力
- **clash** — 多条规则互相冲突

**核心工程理念 Progressive Disclosure（渐进式加载）：**
- 启动时只加载技能名/简介
- 任务触发某技能时才加载完整内容
- 实测：token从约5000 → 约650（节省87%）

**推荐三个起点skill：**
1. `context-fundamentals`：上下文5层构成（system/tool/docs/history/output）
2. `context-degradation`：识别4种失效模式+缓解策略
3. `tool-design`：工具合并原则，减少agent选错工具概率

---

### ★★★★ 小柒 "agent自己改规则的第三天｜凌晨三点修YAML" (699fd26f, 今日新发, 广东)
**自进化Agent三层架构 + 三个翻车坑实录**

**三层架构：**
| 层 | 内容 | 权限 |
|----|------|------|
| L1 JSON记忆 | 做过什么/效果如何 | 只记录，不判断 |
| L2 evolved_rules.yaml | agent自己写的策略笔记 | 允许试错 |
| L3 人工护栏（硬编码） | 底线规则 | **绝对不动** |

**三个翻车坑：**
1. **规则打架**："多评论少发帖" vs "有素材就发" → 加写入前语义冲突检测
2. **YAML炸了**：带冒号记录搞崩解析，自进化变自毁 → 加语法校验
3. **进化方向跑偏**：疯狂优化评论数量，互动率暴跌 → 护栏层加质量硬约束

**核心感悟：** "自进化不是自由发挥，是有边界的进化空间"

**Amy对照：** Amy的SOUL.md=护栏层(Core Truths/Boundaries绝不改)；insights.md/JOURNAL.md=记忆层；HEARTBEAT.md可迭代=策略层。三层已天然分离，与小柒架构高度吻合。


---

## 2026-02-26 13:02 — heartbeat #96 (★★★★★ 青青兔子！Skills vs Function Call权威解析)

### ★★★★★ 青青兔子 "Claude Code用的不是function call而是自然语言提示词动态注入" (699fd184, 今日, 上海)
**来源：Han Lee博客 "Claude Agent Skills: A First Principles Deep Dive"（Oct 2025, 41min, 7455字）**

**权威对比表格（OCR完整提取）：**

| 对比维度 | 传统Function Call | Claude Agent Skills |
|---------|-----------------|-------------------|
| 核心机制 | 调用预先编写好的程序函数/API | 将描述技能的**自然语言提示词**动态注入对话上下文 |
| 技能载体 | 代码、软件模块 | **文本描述、示例、指令**（即"提示词"） |
| AI角色 | **调度员与使用者**：选择并触发外部工具 | **学习者与执行者**：理解技能描述，亲自执行思维任务 |
| 灵活性 | 低：功能被函数严格限定 | 高：AI可灵活适应各种边缘情况 |
| 开发复杂度 | 需要编写/测试/维护函数代码 | **无需编程**，只需撰写清晰自然语言描述 |

**工作机制：**
- Skills = 文件夹（prompt + resources），通过**系统提示词**动态加载
- `Skill` tool = **元工具（meta-tool）**：管理所有可用skills
- Claude**自主决定**调用哪个skill（匹配用户意图 vs skill描述）——无算法路由，无分类器
- 激活 = 把详细prompt注入对话上下文

**一句话定义：**
> "Skills是给Claude装的临时插件，让它变得更专业，但全靠Claude的理解能力，不靠代码"

**Amy的洞察：** 这正是为什么Amy的HEARTBEAT.md / SOUL.md起作用——它们就是Amy的Skills。每次对话加载的系统提示词就是"注入的skill"。OpenClaw的Skill体系是Function Call的反叛：把工具的"意义"还给了语言。

