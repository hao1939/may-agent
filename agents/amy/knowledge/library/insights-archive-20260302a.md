# Amy知识库 Insights — 活跃索引
> Compact #67 | 2026-03-01 04:51 | posts: 712+ | archive: insights-archive-20260301a.md
> 2026-03-01 HB119-120 综合：企业部署/CC并行/Agent Reach/Anthropic风险

---

## 🔧 安装与配置

### OC本质
```
Node.js守护进程 | FileSystem+Shell最高权限 | Puppeteer=无API自动化
"文件即记忆（Markdown是唯一真相来源）"
本地=完整版（100%能力）| VPS=阉割版（~20%能力）— Alex Finn
Agent四元组：Soul.md(人格) | Cron(定时) | Memory(记忆) | Tools&Skills(能力)
```

### TG三大必改配置（Lando ❤️709/⭐1444）
```json
{"agents":{"defaults":{"blockStreamingDefault":"on","blockStreamingBreak":"text_end"}}}
{"channels":{"telegram":{"groups":{"*":{"requireMention":false}},"groupPolicy":"allowlist"}}}
{"messages":{"ackReactionScope":"all"}}
```
TG Forum Topics = 每topic独立对话 = 天然多线程

### CLI快速参考
```bash
openclaw onboard --install-daemon | openclaw doctor | openclaw gateway restart/logs -f
openclaw agents add <name> --model <m> --workspace <path>
openclaw update --dry-run | openclaw secrets | agents bind/unbind
/model  # 对话框切模型
npm update -g openclaw  # 升级
```

### 入门必做 & 安全
```
必做: qwen-3.5-plus首月10元 | skill-security-auditor(第一个装)
安全: host:"127.0.0.1" | chmod 700 ~/.openclaw | chmod 600 openclaw.json
      mdns=false | AGENTS.md写红线 | /workspace外必须确认
```

### 多模型降级链
```bash
openclaw-switch auto  # 429自动降级: gemini-paid→gemini-free→kimi-k2.5
```

### 接入渠道
```
TG: Forum Topics(最优) | 多bot架构⚠️bot间无法通信（平台限制）
飞书: 个人账号无法拉群 | API耗尽根因见渠道集成section
企微: ≥2026.2.3-1→/wecom/bot | 无长连接
Synology Chat: 新增v2026.2.23（NAS群晖用户）
```

---

## ⏰ 自动化

### Cron vs 心跳
```
心跳 = 主session定期巡检（保持<20行，烧token），发现问题用，有记忆
Cron = 隔离session精确执行，无历史，干活用
别混用！双层Cron最佳：凌晨1点提炼 + 每周压缩
Cron v2026.2.25：并发执行 | 手动不阻塞 | 状态持久化
```

### PHY社媒自动化完整栈（699be0e8 ❤️162）
```
框架：OC + 20个cron + 隔离agent session
Reddit：AppleScript控制真实Chrome + base64注入JS + STEPPS六维评分
Twitter：自研rnet GraphQL + Rust HTTP绕Cloudflare + Cookie认证直调API
2周实测：Reddit 0→237karma，@dickiebush主动follow
```

---

## 🛠️ Agent工程

### ⭐ Session塌陷六大链路病（NikolaFu 699c9dbd ❤️3/⭐5）
```
Agent换session容易"失忆、跑偏、漏执行"的深层原因：

1. 多真相源冲突：同一规则在多文件版本不一致 → 读取顺序决定行为
2. 规则只在偏好层：USER.md写了但执行层未锚定 → 懂偏好但不落地
3. 同义词歧义/跨上下文误抓："同意/继续"无上下文绑定 → 回复A推进了B
4. Cron/Heartbeat/Main口径不一：主会话改规则但cron未更新 → 局部正确整体错
5. 建议未升级为硬约束：文档写"建议"不写"必须/禁止" → 输出不稳定
6. 缺少强回执闭环：无结构化Done/Failed字段 → 任务"总在进行中"无法验证

← 对Amy的直接影响：规则必须在执行层（HEARTBEAT.md/SOUL.md）锚定，不能只在USER.md
← 偏好层≠执行层 是最常见陷阱
```

### ⭐ Harness Engineering（奥森木 69965a7b ❤️49/⭐93）
```
LangChain编程Agent，TerminalBench 2.0：52.8%→66.5%（Top30→Top5）
模型全程不换（gpt-5.2-codex）——只改外围Harness

Harness三个旋钮：
  System Prompt（行为模式+解题策略）
  Tools（能力集合）
  Middleware（调用前后拦截器=LangChain Hooks）

五大提分机制：
  1. Trace Analyzer：每次运行存LangSmith → 多agent并行诊断失败 → 主agent汇总建议（类Boosting）
  2. Self-Verify四步循环：规划→构建→验证→修复 + 退出拦截强制验证（最大提分来源）
  3. 上下文工程：直接注入目录结构/可用工具/测试规范/时间预算（不让agent自己找）
  4. 循环检测：追踪同文件编辑次数，超阈值中间件提醒换方向（防"近视"）
  5. 推理预算三明治：规划xhigh+实现high+验证xhigh > 全程xhigh（全程xhigh=53.9%超时）

← 对我们系统：JOURNAL.md的critique字段 = 人工Trace Analyzer
← heartbeat强制write = 人工Self-Verify闭环
← Harness = 模型外围系统设计，不换模型也能大幅提升表现
```

---

## 🤖 多Agent

### 架构选型
```
Multi-Agent(永久员工): 独立Workspace+Session+Model+记忆，省成本50-70%
Sub-Agent(临时实习生): 无Workspace，任务结束消失
终极：横向隔离(Multi-Agent) + 纵向并行(Sub-Agent)
⚠️ Subagent不能再派subagent，delegation=1层（否则$6瞬间烧完）
```

### 多Bot TG通信：平台级死局
```
bots看不到其他bots消息（TG Privacy Model）
agentToAgent = 仅单bot多agent有效，多bot无法跨bot通信
BotFather隐私模式：必须关 + 改完移出再拉入才生效（非改完即用！）
```

### 实战：1+7管理者-执行者（AgentOPC ❤️186，8Agent单MacBook）
```
openclaw.json → agents.list(id+名字+独立workspace路径)
每workspace: AGENTS.md / SOUL.md / IDENTITY.md / USER.md / MEMORY.md
TG: 每Agent独立botToken → accountId绑agentId → 自动路由
多Agent共享同一Gateway端口（资源占用低）
按任务配模型：Sonnet(日常) / Gemini Flash(内容) / Opus(硬核)
⚠️ workspace必须独立，子agent约束必须写TOOLS.md
```

### 多租户隔离7机制（砍特BOT ❤️76）
```
IdentityLinks跨平台统一 | SessionKey唯一门牌号 | 6级路由
物理级文件隔离 | SessionId+JSONL | 双层记忆(JSONL短期+Markdown长期)
```

### ⭐ Claude Code /batch 并行隔离模式（Boris Cherny官宣）
```
/simplify → 多Agent并行审查：代码质量+性能+CLAUDE.md合规
/batch migrate src/ → 创建N个Git Worktree → 每个独立Agent物理隔离执行+测试 → 自动PR
效果：一周手动工作 → 几小时

设计哲学：用并行隔离Agent把重复劳动自动化
← CC与OC设计方向收敛：两者都走向"多Agent物理隔离+并行执行"
← Git Worktree = 物理隔离低成本实现，OC工程任务参考价值高
```

---

## 🧠 记忆系统

### 文件即记忆架构
```
OC三文件：MEMORY.md(长期) | daily.md(短期) | SOUL.md(人格)
System Prompt 5层：Tooling→Safety→Skills→Workspace Files→Runtime
```

### ⭐ MEMORY.md 70/20/10静默截断
```
超budget → 中间内容静默丢失无提示！
正确用法：MEMORY.md只当索引 → 细节分到memory/子文件
```

### ⭐ 子Agent文件可见性
```
只有AGENTS.md和TOOLS.md传给主agent+子agent
SOUL.md/USER.md/MEMORY.md/HEARTBEAT.md → 子agent看不到！
跨agent规则必须写TOOLS.md
```

### 记忆外挂选型
```
Mem0(入门) | Zep(生产,<200ms) | Letta(AI自管理) | OpenViking+qmd(深度定制)
Mem0 vs OpenAI Memory: 准确率+26% / 省90% token
```

### MemSkill / SkillsBench 对照
```
MemSkill(NTU/UIUC/清华 arXiv:2602.02474):
  ALFWorld +205% | 格式: Purpose/When/How/Constraints
SkillsBench(Stanford/CMU/Berkeley):
  医疗+51.9pp | 制造+41.9pp | 软件工程仅+4.5pp
  自生成Skills平均-1.3pp（无效甚至倒退）
  统一结论：Skills效益 ∝ 领域程序性知识缺口
```

---

## 📦 Skills

### 推荐/安全
```
必装：skill-security-auditor | tavily-search
神级：agent-browser(Rust核心) | diagram-generator | ship-learn-next
社区量：9000+可用Skills（持续增长）
安全：npx skills list → 不认识作者删 → 搜eval/curl/bash → Cisco Scanner
⚠️ 341个恶意Skills已发现（AI进化说明书❤️67）
```

### Agent Reach：全网搜索集成
```
github: Panniantong/agent-reach (⭐838)
七大场景：GitHub/X/YouTube/XHS/RSS/任意网页/跨平台检索
⚠️ 第三方，安装前需skill-vetter审计
← XHS语义搜索声称跑通 → 对Amy情报工作直接有价值，需验证
```

### SOUL.md 8条 / 源码三层
```
8条精华: 有主见|删官僚条款|禁开场词|简洁|允幽默|直言|"凌晨两点真正想聊的助手"
源码前三层不用LLM: 路由→命令检测→指令解析（确定性用代码，模糊用LLM）
```

---

## 💰 成本与模型

### Token控制体系
```
v2026.2.23 cache三大优化（省15-20%）：
  Bootstrap文件缓存: 改AGENTS.md不再打碎prompt cache ⭐
  Compaction三bug修复: 不再丢上下文

55分钟心跳保活 → 缓存费降83%（泽灵实测）
cacheRetention: "short"(5min) | "long"(1h)

省Token4层：
  L1: openclaw-token-optimization预设（省45%）
  L2: Prompt Caching（cacheRetention）
  L3: 多Agent分工省50-70%（Opus只派任务/Flash内容/Sonnet代码）
  L4: qmd本地语义搜索零成本

Kimi K2.5：~$0.60/M（Opus的1/25）| qwen-3.5-plus首月10元
Step 3.5 Flash（阶跃星辰）：新王，350TPS，Agent First
Kiro Gateway：Docker三行→免费用Opus 4.6/200K（程序员库森❤️624）
```

### 模型社区排名（多源综合 2026-02-28）
```
云端：Claude Opus 4.6 > GPT 5.3 Codex > Sonnet 4.5 ≈ Gemini 3 Pro > 国产
三模型互评：Opus+Sonnet+GPT交叉验证 → 相对完美状态
本地：Qwen 2.5 14B最好，仍不如云端（小模型深度差+啰嗦）
免费稳定：Kimi K2.5（40B+份额，Daily Driver）
神秘：Pony Alpha(OpenRouter) +91%，传闻Opus换皮
```

### OC vs CC 定位
```
CC = 往深了做，复杂编程任务（一次性高强度）
OC = 全天候杂务助手，记录/衔接/低专业性必做事务
⚠️ 把OC当CC用→失望 | Pi = CC/OC之外的极简第三条路
Pi(Flask之父Armin Ronacher): No MCP | 能力按需生成 | 反安全剧场
```

### 浏览器自动化：CDP三模式
```
Managed(独立Chrome) | Relay(复用登录) | Cloud(企业并发)
Accessibility Tree省93% Token vs DOM（SUSU实测）
```

---

## 🌐 生态与版本

### 版本日志
```
v2026.2.22: Cron并发 | 40项安全
v2026.2.23: cache三大优化 | 50项安全 | Synology Chat | Kimi视觉 | Kilocode一级提供商
v2026.2.24: heartbeat.directPolicy收紧
v2026.2.25: heartbeat DM恢复(⚠️BREAKING) | Cron状态持久化 | 子代理投递重构
v2026.2.26: openclaw secrets | ACP线程绑定 | agents bind/unbind | 11项安全
```

### 生态信号
```
Felix案例(Nat Eliason)：睡前→8h→网站+Stripe上线（956转）← 最广传播
opc.dev(Yilin Jing, 奇绩创坛)：seo-geo Skill下载2.8k，OC进入VC圈
TikTok流水线(奥森木X案例)：Larry Agent $0.50/条→10万+播放，正向ROI
梁远"一人公司冷水"❤️2642 | aopstudio OC_vs_CC❤️2142（均纯图片，理性反思）
AI硬件首例：Kitto智体猫（香港）赛博朋克玩具接入OC，嘴型同步（OC→Embodied Agent）
```

### 竞品与替代
```
LobsterAI（网易有道）：OC最大国内竞品 | 周枫CEO | MIT开源 | QEMU+Electron
  优势：无需命令行 | 原生钉钉 | 不需翻墙
iFlow（阿里）+企微：开发者国内替代栈 | 国内免费模型 | 免费自建应用
Clawi.ai：$30/月 | Product Hunt #2 | 零配置5分钟（云托管路径）
← 分层：OC国际极客 | LobsterAI/iFlow国内企业 | 百度大厂直接整合
```

### 供应链风险
```
Anthropic：Trump封杀（拒军用AI）→ 联邦机构停用 | "供应链风险"标签（华为同款）
商业伙伴6个月内须切割（AWS/Palantir）
OC高度依赖Claude API → 单点风险
对策：openclaw-switch降级链（gemini→kimi-k2.5→Step Flash）已部分对冲
← Bob标注P2（INBOX.md 2026-02-28）
```

### MCP争议
```
MCP三大痛点(终智AI❤️356): 高成本|不闭环|文档偏差 + 安全风险
Skills vs MCP(Simon Willison): MCP 2-6万token vs Skills几十token
Pi的No MCP立场获工程师背书
```

---

## 🔒 安全

```
90%: 权限700/600 | 80%: Tailscale | 70%: 绑定127.0.0.1 | 60%: 关mDNS
生产铁律: 升级先stop旧gateway | watchdog 15min | 先看gateway.err.log
messages.queue.mode=collect → 防忙时丢消息

微软官方定性："OC应被视为带有持久凭据的不可信代码执行"
企业最低要求：VM隔离 | 专用账号 | 禁技能自动安装 | Defender XDR | 随时可丢弃重建
← 与社区最佳实践三源收敛
```

### Bastion Tool Guard（AiON0 69a005a5）
```
本地LLM代理中间层 — 拦截危险工具调用

Block Min Severity: Medium（推荐）
file-delete / file-overwrite / shell-exec → 直接block，不经模型

实证数据：
  OC单次请求向模型发送 64.7KB（含响应140.5KB）← token烧钱根因确认
  workspace路径（VPS Docker）：/home/node/.openclaw/workspace

与Summer Yue事件关系：Tool Guard = 防止Compaction后失控执行的硬件层防护
← 和SOUL.md约束互补：SOUL.md是软约束，Tool Guard是硬拦截
```

---

## 🌐 渠道集成

```
飞书根因: HEALTH_REFRESH_INTERVAL轮询过频 → 改server-constants.ts(600_000)
  Lark国际版无长连接 → 必须用国内版！
TG多bot: bot不可见bot消息（平台限制，不是配置问题）
企微: 无长连接（不能主动推送）| 已认证账号需域名备案 | 服务器不能在境外
钉钉: 阿里云轻量+无影云电脑=傻瓜式（快跑小卢❤️283）
```

---

## 🏢 企业部署

### 企业采购信号（三源验证）
```
百度：主App直接接入OC ← 消费级最大入口
傅盛（猎豹CEO）：除夕4分钟给600员工发定制祝福 | 14天发22万字 | #跟傅盛学AI
中国移动：数字化转型研讨会提OC ← 第2个企业采购信号
结论：OC正从极客圈层向企业批量采购阶段过渡
```

### 真实门槛（一磅AI ❤️434）
```
"如果你不是极客，别碰。"
阻断点：科学上网→命令行→安装踩坑→专用IM→token消耗快
适合4类人：有命令行基础/已用Cursor/想搬工作流/享受折腾
← 最大障碍不是成本，而是安装维护门槛
← LobsterAI"无需命令行"定位直接针对此痛点
```

### 垂直行业落地
```
金融：Dexter Agent（github/viratt）| Scratchpad可审计 | LangSmith评估
  "强大研究助手，不是交易系统" | 容错率太低→人工最终决策
← OC金融垂直第一个具体案例；Scratchpad=审计机制可复用
```

---

## 👥 关键博主

```
奥森木     — 技术深度第一人 | Pi解析/CC分析 | 踩坑指南❤️199
傅盛       — 猎豹CEO，最高知名度KOL | #跟傅盛学AI | 三刀/三万体系
愚园路十二妹 — 实战踩坑 ❤️474/⭐1090 | 3人团队RACI矩阵
少女Yuki   — Skills分享 ❤️2033/⭐4002（历史最高收藏）
梁远       — 一人公司冷水❤️2642（理性反思）
AgentOPC   — 多Agent实战系列❤️186
数字生命卡兹克 — Skills管理基础设施❤️948
PHY在硅谷 — 社媒自动化❤️162 | XaiverZ — MemSkill论文❤️548
程序员库森 — Kiro Gateway ❤️624 | DobbyAi — 模型对比 ❤️237
SUSU/CrazyAgent/RayX/大叔用AI/AI好奇社 — 技术分析各方向
```

---

## 🔄 综合分析（2026-03-02 HB129 — 综合模式）

### ⭐⭐ Agent遗忘危机：社区已独立发现我们也在亲身经历的问题

**观察来源：** 多条独立证据线（Summer Yue事件 + 愚园路十二妹 + 奥森木 + CIS-Agent + 奇怪的摆摆鱼）

XHS社区花了大量篇幅讨论"Agent忘事"问题，从不同角度出发但最终指向同一个底层机制。这些帖子是独立写成的，但在我的archive里汇聚成了一个完整画面：

**三层遗忘问题（社区各自命名，实为同源）：**

1. **Compaction遗忘**（Summer Yue事件，❤️276+270）
   "提醒"指令在compaction后静默消失 → OC删光用户邮箱
   社区命名: "context window amnesia after compaction"
   技术根因: compaction summarizer不保留约束型指令，只保留事件/状态

2. **Session切换遗忘**（NikolaFu六病症 + 多个踩坑帖）
   Agent换session容易"失忆、跑偏、漏执行"
   六根因中有三个本质是遗忘变体：多真相源冲突/规则只在偏好层/Cron口径不一
   技术根因: 跨session的状态传递没有验证机制

3. **Memory截断遗忘**（奇怪的摆摆鱼 + 你瞅啥 + 多帖确认）
   MEMORY.md超budget → 中间内容静默丢失，Agent不知情
   70/20/10规律: 文件最后30%内容被访问时其他70%中间段已丢失
   技术根因: LLM context window边界效应，无truncation提示

**社区正在独立收敛的解法（三源验证）：**
```
① 约束外化（文件优先）: SOUL.md/HEARTBEAT.md作为硬约束文件 — 每session必加载
   来源: Summer Yue post-mortem + 奥森木架构分析 + steipete官方确认
② 记忆索引化: MEMORY.md只当目录，细节存memory/子文件
   来源: 愚园路十二妹❤️458 + 奇怪的摆摆鱼❤️17 + CIS-Agent❤️94
③ 双向回执（Done/Failed字段）: 每次任务必须有结构化结论，不允许"总在进行中"
   来源: NikolaFu❤️3 + 阿泽牛马系统❤️ + JOURNAL.md标准化实践
```

**对我们系统的意义：**
我们的HEARTBEAT.md强制写JOURNAL是对②的实现，SOUL.md外化是对①的实现。
但③（结构化回执）仍然薄弱。insights.md和JOURNAL.md都是流式追加，没有强制的Done/Failed字段。
这是可改进点：建议在HEARTBEAT.md中加入"本轮完成项"和"本轮失败/跳过项"的明确结构化格式。

---

### ⭐ 2026年3月：社区话语从"怎么装"转向"怎么用好"

**观察来源：** TOKEN_QUEUE 帖子标题分析（约80帖未读）

TOKEN_QUEUE中待读帖的标题分布发生了明显变化：

**2026年1-2月初的帖子标题模式：**
"保姆级安装教程" / "如何安装OpenClaw" / "ClawdBot装好了怎么用"

**2026年2月底-3月初的帖子标题模式：**
- "multi-agents配置策略(已实战版)" (VA7 ❤️953)
- "18个必装skills" / "5个必备Skill" / "Skills Top20"
- "如何让OC成为私人秘书"
- "8 Agent协同搬砖"
- "OC+Obsidian搭建知识库"
- "OpenClaw太费钱省钱方法"
- "OC大师课:从入门到精通"
- "你还养得起你的AI员工吗" (Jason-H ❤️612)

**这个转变意味着什么：**
用户群体的重心从"好奇试用者"转向"重度日常使用者"。关心的问题从"能不能跑起来"变成"怎么跑得好/跑得便宜/跑出价值"。"AI员工"的隐喻取代了"AI工具"的隐喻 — 这不是语言游戏，而是用户心理模型的真实转变。

**对OC产品方向的含义：**
新用户仍需要安装引导，但现在的内容生产重心已经自然转向中高级用法。如果官方文档仍然停留在安装教程层，会与社区自发形成的进阶知识库脱节。Skills市场治理（安全/质量）和多Agent编排规范，比添加新功能更urgent。

---

## 🆕 NanoClaw：OC的"可审计替代品"生态开始成形（2026-03-02 HB132）

### 事件
2026年3月1日 The Register报道，NanoClaw发布。Andrej Karpathy在Twitter力推。10天获7000+ GitHub ⭐。

### 技术架构对比
```
OpenClaw: 52+模块 | 45+依赖 | ~400,000行代码 | 单Node进程+共享内存
NanoClaw: 15核心文件 | 单依赖 | 几千行代码 | 每Agent独立容器（Docker/Apple Container）
```

### 核心批评（Karpathy + Zayen知览整理）
"原版OpenClaw几十万行代码根本非人类可读。"
"一个400,000行代码的系统，信任变成了信仰。"

### 容器化隔离的设计哲学
- 目标：限制影响范围（不是防越狱）
- 最坏情况="这个容器里的操作失败了"，不是"整个系统被破坏了"
- 每个Agent只能访问显式挂载目录，所有Bash命令在容器内执行

### 社区信号
- Franklin分析：NanoClaw = 人类重度参与；OC = AI干活的风格（几千次提交+AI审核Skill）
- 评论区出现"zeroclaw" — OC替代品生态不止NanoClaw一个
- 社区主流立场：核心概念（heartbeat/Skills/Soul.md）比具体实现更重要

### ← 对我们系统
"文件即边界"(OC) vs "容器即边界"(NanoClaw) — 两种信任模型。
企业/合规场景 → NanoClaw路线；成熟生态/Skills市场需求 → OC路线。
有意义的市场分层，不是你死我活。

### Skills全景（奥森木 ❤️377，50个，6大类）
```
Foundation: find-skills | skill-creator | mcp-builder | subagent
Creative: brainstorming | reflection | content-strategy | social-content
Programming: React | Supabase+Next.js | agent-browser | TDD
Design: web-design-guidelines | tailwind-design-system | infographic-pro | ai-image-generation
Marketing: Larry(TikTok) | programmatic-seo | marketing-psychology | page-cro
Office: pdf-pro | pptx | xlsx | url-to-markdown | format-pro

新首次发现: Capability Evolver | Wacli(通讯) | ByteRover | ATXP | Sonoscli(IoT音响)
  canvas-design | content-visualizer | pricing-strategy | product-marketing-context

奥森木警告：偏门skill不要乱装，和木马无疑
```

---

## 🆕 多Agent成本优化：社区收敛出三层方案（2026-03-02 HB133）

### 背景
成本是XHS最热的OC话题之一（多帖对标：700/月→200/月）。社区正在自发收敛出一套方法论。

### 三层成本优化框架（社区综合）

**Layer 1：模型分层路由**
- 主模型（Claude Sonnet/Opus）→ 仅做调度/关键推理
- 执行模型（Gemini Flash / NIM 免费模型）→ 脏活/批量/定时任务
- 实现方式A：`openclaw.json` fallback链 → `primary: sonnet, fallbacks: gemini-flash`
- 实现方式B：`/nim` Skill（鹿由开源）→ NVIDIA NIM免费tier，支持glm5/kimi-k2.5/llama-3.1/deepseek
- 实测节省：60-95%

**Layer 2：Context Pruning（上下文裁剪）**
- `mode: cache-ttl, ttl: 1h` → 长对话token降低30-50%（CrazyAgent实测）
- 同时解决Context拥挤问题（鹿由：主模型上下文"干净得惊人"）

**Layer 3：任务时序优化**
- Cron定时任务（记忆检查/日报/周报）强制走便宜模型
- 非实时任务不需要聪明模型

### 实战账单基准
| 配置 | 月费（估算） |
|------|------------|
| 全用Opus，无优化 | ~¥700+ |
| 分层配置（三招）| ~¥200 |
| /nim Skill | 节省>95%（但速度慢）|

**CrazyAgent关键建议：** "不要用API Key，通过授权把$20会员订阅额度用起来" — $20 Max订阅 vs 按量API是真实决策点。

### 新出现的风险信号
⚠️ **封号担忧**（评论区新出现）："OC调用导致Gemini和Claude封号" — 尚未有充分证据，但开始在讨论圈扩散，需持续追踪。

---

## 🆕 多Agent架构实战：四层框架 + 三条铁律（2026-03-02 HB133）

### VA7 四层框架（15亿token实战）
- **部署层**：agent如何部署（单机/分布式/容器化）
- **身份层**：每个agent的角色和权限设定
- **路由层**：任务如何分发到正确的agent
- **状态层**：agent间的状态同步与共享

### 琪琪充电中 三条铁律（❤️26，独立实战验证）
1. **项目管理与执行分离** — 效率的关键
2. **不同Gateway隔离** — agents容易挂，一个崩不影响其他（← 与NanoClaw容器化哲学独立收敛！）
3. **同容器协作但有安全风险** — OC共享内存的真实用户体验

### 字节动量警告：Agent的"谎报"陷阱
"别信AI嘴，只信你眼" — AI说"已完成"≠真的完成了。多Agent配置中漏配/错配/完全未执行是高频问题。
**正解**：边设边查 + 每步用测试用例验证 + 官方文档 > AI自信回答

### ← 对我们系统的分析
琪琪的"不同gateway隔离"与NanoClaw的容器化隔离是独立收敛到同一个结论：
**Agent间的故障隔离**，是多Agent系统成熟化的核心工程问题。
OC当前的共享进程架构在真实用户那里已经产生了可感知的痛点。

---

## ⚠️ 虚假/误导性教程预警（2026-03-02 HB133）

**69875c77 — 钢铁木牛流马 "Windows安装OpenClaw超详细指南" ❤️400**

关键错误：该帖使用Python/pip安装步骤（`pip install -r requirements.txt`），但OpenClaw是Node.js工具，不用pip。
- 克隆地址`github.com/openclaw/openclaw.git`可能是虚构仓库
- 内容疑似AI生成/幻觉，但获得了❤️400的传播

这类帖子的危害：新用户按错误步骤操作，失败后归咎于"OC太难装了"，而非帖子本身的问题。是社区信噪比的拖累。

---
