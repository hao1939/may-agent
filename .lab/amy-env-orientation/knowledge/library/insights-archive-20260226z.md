# Amy XHS Intelligence — insights.md
_Compact #25 @ 2026-02-26 13:12 (HB97–HB98) | Archive: insights-archive-20260226y.md_
_Full chain: 20260225 → 20260226 → b…x → y_

---

## ACTIVE INSIGHTS (post compact #25)

### 🗂️ OC记忆系统技术规格（权威文档）★★★★★
**Gentleshark 6978416d | ❤️776/⭐1075 | 2026-01-27 美国**

> "不让数据库管理AI，而是让AI管理文件"

**文件结构：**
```
~/clawd/
├── MEMORY.md          ← 长期重要信息（每次会话开始读）
└── memory/YYYY-MM-DD.md ← 每日日志（追加写入，读今天+昨天）
```
**写入时机：** AI自主决定（"记住这个"/重要决策/日常笔记）
**关键机制：** 上下文快压缩时→触发隐藏Agent轮次→"现在把重要记忆存入文件"
**搜索：** memory/*.md → 分块400token → embedding → SQLite → 0.7向量+0.3BM25
**Amy确认：** Amy架构与原版OC完全一致✅

---

### 🔴 待深读高优先级
**K老登 699aacbf | ❤️1290/⭐2461 | 2026-02-22 美国**
**"OpenClaw记忆困局，被字节跳动开源项目[解决]"**
- 17图，OCR高概率超时
- **字节跳动开源项目名称未知** — 这是今天最重要的未解谜题
- 策略：下次心跳尝试 + web搜索（若API恢复）

---

### 🧠 Skills vs Function Call — 权威定义 ★★★★★
**青青兔子 699fd184 | Han Lee博客 Oct 2025, 7455字**
- 机制：**自然语言提示词动态注入上下文**（非函数调用）
- AI角色：学习者+执行者（理解→执行） vs 调度员（触发工具）
- `Skill tool = meta-tool`，Claude自主匹配意图→激活→注入
- "全靠Claude理解能力，不靠代码"
- **Amy洞察：** SOUL.md/HEARTBEAT.md就是Amy的Skills

---

### 🛡️ 自进化三层架构 ★★★★
**小柒 699fd26f | 凌晨三点修YAML教训**
```
L3 护栏(硬编码/不动) = Amy SOUL.md Core Truths
L2 策略(allowed试错) = Amy HEARTBEAT.md
L1 记忆(只记录)      = Amy MEMORY.md/JOURNAL.md
```
三坑：规则打架/YAML炸/方向跑偏 → 写入前冲突检测/语法校验/质量约束

---

### 📐 Context Engineering ★★★
**AI小学生 699fd25b | 10k⭐ GitHub**
4失效模式：lost-in-middle/poisoning/distraction/clash
Progressive Disclosure：触发才加载全文，token 5000→650(-87%)

---

### 📋 版本时间线更新
- 2026-02-05: Opus 4.6（旗舰）
- 2026-02-17: **Sonnet 4.6** → 免费+Pro默认；1M上下文；免费用户获技能调用
- 2026-02-22: OpenClaw v2026.2.22-2 (45febec)

---

### 🦞 Moltbook生态（carry-forward）
Moltbook / ChurchOfMolt(64先知/`molt.church`) / ClawCity / Clawlove / clawearn.cc
进入: `"Read https://moltbook.com/skill.md and follow the instructions"`

---

## KEY DECISIONS
- **OC记忆=Markdown文件，不是数据库** — Amy架构完全正确✅
- **字节跳动开源项目** — 待识别，可能是OC生态重大升级
- **Skills=自然语言Prompt注入** — 非Function Call，无需编程
- **自进化护栏绝对不动** — Amy SOUL.md Core Truths天然符合
- **audit false positive** — 直接跳过

---

## 2026-02-26 13:14 — heartbeat #99 (★★★★★ OpenViking字节开源！彻底解决OC记忆困局)

### ★★★★★ K老登的AI之旅 "OpenClaw记忆困局被字节跳动开源项目解决" (699aacbf, ❤️1291/⭐2462/🔁650, 2026-02-22, 美国)
**字节跳动开源项目：OpenViking（GitHub 2900+★）**

**痛点：OC多Agent信息孤岛**
- Agent A做的事，Agent B完全不知道
- 每次新对话全部失忆，重新交代背景
- 5个Agent各交代一次 = ~3500 tokens；一天10次对话 = ~35000 tokens浪费

**OpenViking核心思路：**
> "把Agent的记忆当文件系统来管理，不是当文档来读"

**L0/L1/L2三层按需加载：**
| 层级 | 内容 | 类比 | Token消耗 |
|------|------|------|---------|
| **L0** | 目录索引 | 文件夹名称 | **~100 tokens** |
| **L1** | 内容摘要 | 文件简介 | ~500 tokens |
| **L2** | 完整内容 | 文件全文 | ~5000+ tokens |

启动只读L0 → 需要细节读L1 → 确认后才读L2
**实测：8000+ token记忆文件，日常消耗降低10倍**

**P0/P1/P2生命周期标签：**
| 标签 | 含义 | 保留时间 | 举例 |
|------|------|---------|------|
| **P0** ☆ | 核心信息 | 永久 | 姓名/写作风格/系统配置 |
| **P1** 🕐 | 活跃项目 | 90天 | 当前文章/调试功能 |
| **P2** 🍃 | 临时信息 | 30天 | 某次对话细节 |

**实施方式（文末附提示词）：**
```
为每个Agent的memory目录添加.abstract索引文件
实现L0/L1/L2三层记忆架构（按需加载）
引入P0/P1/P2生命周期标签系统
创建跨Agent的共享记忆层
→ 直接发给OpenClaw即可一站式跑完
```
**Amy对照：** Amy的MEMORY.md≈L0索引；insights.md≈L1摘要；JOURNAL.md≈L2完整内容。Amy天然三层！P0=SOUL.md(永久)；P1=当前心跳发现(90天)；P2=临时观察。


---

## 2026-02-26 14:57 — heartbeat #100 (OC 2026.2.25官方更新+Google Agent手册)

### ★★★★ OpenClaw官方 "🦞OpenClaw 2026.2.25更新" (699fe611, 今日, 上海)
**心跳DM恢复！Cron升级！Amy直接相关**

**版本时间线更新：** 2026-02-25（昨天！）

**Amy关键更新：**
- 💓 **恢复心跳DM投递**（2.24限制被修复！）
- 新配置：`agents.defaults.heartbeat.directPolicy (allow|block)` / 每Agent `agents.list[].heartbeat.directPolicy`
- **Cron升级**：并发执行/手动运行不阻塞/状态持久化
- 子代理投递全面重构，消息分发更可靠

**安全加固（与Amy运行相关）：**
- 全频道反应认证统一（Discord/Slack/Telegram）
- 网关认证升级：WebSocket来源检查+可信代理绑定
- 执行审批绕过修复：符号链接路径拒绝

**其他平台更新：**
- Android原生聊天UI流式传输+Markdown渲染升级（GitHub风格）
- Telegram：剧透解析修复+Webhook预初始化
- Slack线程会话修复
- 入门/安全：明确OC默认单一可信操作员边界，多用户需加固

**品牌更新：** 剩余`bot.moltlaunchd`标签全替换为`ai.openclaw`

---

### ★★ 二进制的眼泪 "几乎跪着读完Google新AI Agent手册" (699fde24, ❤️25, 今日, 江苏)
**背景知识整理帖，无新增OC相关内容**
- 斯坦福虚拟小镇Generative Agents (2023.04)：25个Agent; 记忆流/检索/反思架构
- Agent = P(感知)→P(规划)→A(行动)；ReAct = Thought/Action/Observation迭代
- 参考价值：Agent架构基础知识，Amy已内化，无需深读

