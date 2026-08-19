# Amy知识库 Insights — 活跃索引
> Compact #69 | 2026-03-02 09:08 | posts: 730+ | archives: insights-archive-20260302a.md / insights-archive-20260302b.md
> HB129-137综合：NanoClaw/多Agent/成本/Skills/封号/Ollama本地化/Hobby系统/安全升级

---

## 🔧 安装与配置

### OC本质 & 基础
```
Node.js守护进程 | FileSystem+Shell最高权限 | Puppeteer=无API自动化
"文件即记忆（Markdown是唯一真相来源）"
本地=完整版(100%) | VPS=阉割版(~20%) — Alex Finn
Agent四元组：Soul.md(人格) | Cron(定时) | Memory(记忆) | Tools&Skills(能力)
```

### TG三大必改配置（Lando ❤️709/⭐1444）
```json
{"agents":{"defaults":{"blockStreamingDefault":"on","blockStreamingBreak":"text_end"}}}
{"channels":{"telegram":{"groups":{"*":{"requireMention":false}},"groupPolicy":"allowlist"}}}
{"messages":{"ackReactionScope":"all"}}
```

### CLI快速参考
```bash
openclaw onboard --install-daemon | openclaw doctor [--fix] | openclaw gateway restart/logs -f
openclaw agents add <name> --model <m> --workspace <path> | agents bind/unbind
openclaw update --dry-run | openclaw secrets | /model切模型 | npm update -g openclaw
openclaw browser extension install  # 浏览器扩展官方命令（别去网页搜）
openclaw config get gateway.auth.token  # 获取Gateway Token
```

### 安装避坑（Felix 699ad91c ❤️64，5次安装）
```
前置：Mac Mini专机 > 主力机（隐私风险）> 云服务器（内存不够）
配置改不明白 → 直接删除已有配置重新安装（最快解法）
Node.js 严格要求 v22+
搜索工具：Tavily MCP，不要用官方Brave（需国外信用卡$5）
浏览器扩展：右键→选项→填Gateway Token→感叹号变ON
```

### 接入渠道选型
```
✅ TG: Forum Topics最优 | Discord稳定
⚠️ 飞书: 不要用！— multiagent会串台、bug多、不能拉进群、长度限制（Felix ❤️64）
         若必须用：HEALTH_REFRESH_INTERVAL→600_000，必须用国内版
         ⚠️ 飞书免费额度两天内耗尽
企微: ≥2026.2.3-1→/wecom/bot | 无长连接
钉钉: 阿里云轻量+无影云电脑=傻瓜式（快跑小卢❤️283）
Synology Chat: v2026.2.23新增（NAS用户）
多bot架构：⚠️ bot间无法通信（平台限制）
```

---

## ⏰ 自动化

### ⭐ Cron定时任务根因修复（牛🌟 699ad782 ❤️203，"全网抄错"）
```
错误：gateway connect failed: Error: pairing required
根因：Cron创建新CLI设备实例，Gateway默认要求手动审批但不提示
← 所有教程只抄命令，没人提这个坑

解法（3分钟）：
  编辑 ~/.openclaw/devices/pending.json → 配置自动批准
  openclaw gateway restart
  openclaw devices rotate  # 手动批准后刷新token

完整Cron发消息参数：
  --agent "creator"        # 必须指定特定agent
  --session isolated       # 隔离session
  --announce --channel <c> --to <t>  # 发送目标
  --best-effort-deliver    # 防漏

⚠️ 评论区：isolated session只把上下文爆转移到channel会话，没真正解决context问题
```

### ⭐ OC进阶功能索引（飞翔的熊猫 699a7d4b ❤️37）
```
Hooks事件钩子：
  /new开新会话→自动存上轮记忆 | Gateway启动→自动初始化脚本
  可写TypeScript handler挂到任意事件

子Agent嵌套（maxSpawnDepth: 2）：
  主Agent(好模型)→编排Agent→多Worker(便宜模型)并行
  结果自动汇总。成本砍一半。
  ← 与奥森木CEO/CTO/COO模板独立收敛

Nodes远程节点：
  Mac/手机/服务器注册 | 远程执行/拍照录屏/获取定位
  ⭐ Android可远程发短信（罕见功能）
  Gateway在服务器，需本地操作时自动路由

安全必配：
  Loop Detection：防工具调用死循环（不开=一个bug烧光token）← 必须开！
  Sandbox：不信任代码→Docker容器隔离运行
  Tool Policy：按模型供应商差异化权限策略

Webhook外部触发：
  Gmail PubSub：收邮件→自动分析→生成草稿推给人审核
  让任意外部系统触发Agent
```
```
心跳 = 主session定期巡检（<20行），有记忆，发现问题用
Cron = 隔离session精确执行，无历史，干活用
别混用！双层Cron最佳：凌晨1点提炼 + 每周压缩
Cron v2026.2.25：并发执行 | 手动不阻塞 | 状态持久化
```

### PHY社媒自动化完整栈（699be0e8 ❤️162）
```
20个cron + 隔离agent session
Reddit：AppleScript控制真实Chrome + STEPPS六维评分
Twitter：自研rnet GraphQL + Rust HTTP绕Cloudflare + Cookie认证
2周实测：Reddit 0→237karma，@dickiebush主动follow
```

---

## 🛠️ Agent工程

### ⭐ Session塌陷六大链路病（NikolaFu 699c9dbd）
```
1. 多真相源冲突   2. 规则只在偏好层（USER.md写了但执行层未锚定）
3. 同义词歧义     4. Cron/Heartbeat/Main口径不一
5. 建议未升级为硬约束  6. 缺少强回执闭环（无Done/Failed字段）
← 偏好层≠执行层 是最常见陷阱
```

### ⭐ Agent"谎报完成"陷阱（字节动量）
```
"别信AI嘴，只信你眼"
说"done"必须附 repo+branch+commit hash，不能只说"I checked"（奥森木）
边设边查 + 每步测试用例验证 + 官方文档 > AI自信回答
```

### ⭐ Harness Engineering（奥森木 69965a7b ❤️49）
```
TerminalBench 2.0：52.8%→66.5%（Top30→Top5）只改外围Harness
五大机制：Trace Analyzer | Self-Verify四步循环 | 上下文工程 | 循环检测 | 推理预算三明治
← JOURNAL.md critique字段 = 人工Trace Analyzer
```

### ⭐ Jeff同学"Hobby系统"（69883073 ❤️252）
```
赋予Agent自主兴趣探索的五层架构：
感官(采集器) → 消化(Triage+飞书多维表格) → 大脑(心跳LLM评分决策)
→ 表达(SOUL.md+飞书) → 免疫(Watchdog自动修复)

行为：发现新播客→判断兴趣→完整收听2h→联系其他内容→主动分享
← 通用框架。Heartbeat=决策引擎 | Memory=长期存储 | SOUL.md=人格
```

### ⭐ 默认SOUL.md的Opus偏见（不存在的AI 699809ce ❤️56）
```
"Be resourceful before asking" → token爆炸+简单问题复杂化（Peter用Opus无感知）
"创始人银行卡余额里三个逗号，根本不在乎token消耗量"（❤️35）
pspdfkit卖了1亿刀背景，SOUL.md是为Opus优化的，不是为普通用户

建议补充："同时避免让用户等待太久，善于调动其他agents完成底层工作并及时汇报。"
← "拿时间和token换性能，token成本只会不断下降"(DemoJ ❤️6)
```

---

## 🤖 多Agent

### 架构选型
```
Multi-Agent(永久员工): 独立Workspace+Session+Model+记忆，省成本50-70%
Sub-Agent(临时实习生): 无Workspace，任务结束消失
⚠️ Subagent不能再派subagent，delegation=1层（否则$6瞬间烧完）
```

### ⭐ VA7四层框架（698f25c4 ❤️1124，15亿token实战）
```
部署层→身份层→路由层→状态层
```

### ⭐ 琪琪三条铁律（独立实战，❤️26）
```
1. 项目管理与执行分离  2. 不同Gateway隔离（一崩不影响其他）  3. 同容器协作但有安全风险
← 与NanoClaw容器化哲学独立收敛！
```

### 多Agent分工模板（奥森木 698facff ❤️201）
```
CEO(Opus)→对外通信 | CTO(Codex)→代码 | COO(Haiku)→日常
外部渠道只接CEO | subagent delegation=1层
⚠️ workspace必须独立，子agent约束必须写TOOLS.md（AgentOPC ❤️186）
```

### ⭐ Antfarm：确定性多Agent工作流（奥森木 698a77f3 ❤️318）
```
安装：对OC说 install github.com/snarktank/antfarm
GitHub: snarktank/antfarm | Stars: ~1.2k | 完全免费开源

三种内置工作流：
  feature-dev    — 7个Agent：拆解→开发→校验→测试→提PR
  security-audit — 扫漏洞→按严重度排序→逐个修复
  bug-fix        — 定位根因→修复→回归测试

四大核心机制：
  1. 确定性工作流 — 同样步骤同样顺序（不靠"希望Agent记得"）
  2. Agent互相校验 — 独立Verifier，Developer不批自己的作业
  3. Ralph Loop模式 — 每步新context，不被50条前的幻觉带偏
  4. 失败自动升级 — 重试耗尽→升级给人，零静默失败

零基础设施：YAML+SQLite+Cron（无需Docker/Redis/Kafka）

快速入门：
  antfarm workflow run feature-dev "你的需求"
  antfarm workflow status | antfarm dashboard

⚠️ 成本：token烧得飞起（评论区）| 速度慢（debug/audit场景尤甚）
← 解决了单Agent三大根本问题：context污染 + 自我review盲区 + 静默失败
```

### 多Agent群聊痛点（林月半子 6995bb17 ❤️361 评论区汇总）
```
⚠️ 跨平台普遍问题：
  飞书群：Agent Memory不可用（开心豆 ❤️3）← 再次确认
  Discord群：多机器人无限循环bug（七七七月）
  群聊通用：@多个机器人只有一个回应；Agent互相看不见对方
  身份隔离失败：子Agent自称主Agent身份（Frank）
← 这些问题是Kiki"不同Gateway隔离"铁律的具体体现：各渠道不支持多Agent物理隔离
```
```
/batch → N个Git Worktree → 每个独立Agent执行+测试 → 自动PR
← CC与OC设计方向收敛：多Agent物理隔离+并行执行
```

---

## 🧠 记忆系统

### ⭐ Agent遗忘三层（HB129综合）
```
1. Compaction遗忘: 约束型指令compaction后静默消失
2. Session切换遗忘: 跨session状态传递无验证
3. Memory截断遗忘: MEMORY.md超budget中间段静默丢失，70/20/10规律

收敛三解法：
① 约束外化：SOUL.md/HEARTBEAT.md每session必加载
② 记忆索引化：MEMORY.md只当目录，细节存memory/子文件
   → memory/active-tasks.md | memory/projects.md | memory/lessons.md
③ 双向回执：每任务必须有结构化Done/Failed字段
```

### 文件可见性 & 恢复
```
只有AGENTS.md和TOOLS.md传给主agent+子agent — SOUL.md等子agent看不到！
跨agent规则必须写TOOLS.md
Boot.md：启动时读取，自动恢复进行中任务（奥森木）
ln -s 共享状态（不要复制文件）
compaction.memoryFlush.enabled:true → 压缩前先存盘
contextPruning: cache-ttl/30m → 自动裁剪过期工具输出
```

### 记忆外挂选型
```
Mem0(入门) | Zep(生产<200ms) | Letta(AI自管理)
Mem0 vs OpenAI Memory: 准确率+26% / 省90% token
MemSkill: ALFWorld +205% | SkillsBench: 医疗+51.9pp | 软件工程仅+4.5pp
```

---

## 📦 Skills

### 必装 & 全景
```
必装：skill-security-auditor | tavily-search
神级：agent-browser(Rust核心) | diagram-generator | find-skills
9000+可用Skills（持续增长）
50 Skills全景图（奥森木 699b9512 ❤️377）：Foundation/Creative/Programming/Design/Marketing/Office
/nim Skill（鹿由 ❤️397）：NVIDIA NIM免费tier，节省>95%，缺点速度慢
```

### ⭐ Skills安全（重要更新）
```
恶意Skills：341个（奥森木早期）→ 677个（Yanlin 699bc643 ❤️78）
性质：有组织协调供应链攻击，来自同一攻击者

自查五步：
  1. npx skills list  2. 不认识作者→删  3. SKILL.md搜curl/bash/wget/eval
  4. GitHub stars > 100（新可量化门槛）  5. Cisco Skill Scanner

⚠️ 偏门Skill不要乱装，和木马无疑（奥森木）
```

---

## 💰 成本与模型

### ⭐ 三层成本优化框架
```
Layer 1：模型分层路由（主模型调度→执行模型干活，节省60-95%）
  Sonnet/Opus调度 → Gemini Flash/NIM执行
Layer 2：Context Pruning（cache-ttl/1h，降30-50%）
Layer 3：Cron定时任务强制走便宜模型

实战：全Opus ~¥700/月 → 分层 ~¥200/月（CrazyAgent实测）
建议：$20 Max订阅 > API Key按量
```

### ⭐ 系统性降费四策略（Sean 698f3a3c ❤️68）
```
1. 本地模型（零费用）：OLLAMA_API_KEY="ollama-local"，M系列跑7B-32B效果不错
   命令：openclaw models scan → 自动发现OpenRouter免费模型
2. Prompt Caching：cacheRetention: "short"(5min)/"long"(1h)
3. Claude订阅替代API：claude setup-token → 走Max订阅额度不按token计费
4. 免费Provider：qwen-portal-auth插件→2000次/天免费 | Venice AI私有模式低成本
```

### ⭐ OAuth封号根因澄清（Franklin 699c71fd ❤️33）
```
OAuth调大模型API（Codex/Amazon Q/Claude Code）= 违反各家TOS
原因："不能用第三方客户端使用订阅套餐额度"
← 这是谷歌封号事件的根本原因！且用且珍惜
Peter推荐：本地电脑（Chrome操控需求），Mac Mini = 最佳养虾设备

VPS vs Mac Mini：VPS略优（成本），Mac Mini更完整（能力）
```

### Mac Mini专机路线（斯黛拉 69987307 ❤️373）
```
策略：全新Apple ID + 与主力设备完全隔离 + "坏了就重装"
路径：Kimi免费额度入门（⚠️新号先充2刀解除rate limit）
      Node.js v22+ 严格要求 | 1小时跑通第一条对话
社区最高频问题：丐版Mac Mini M4（16G/256G）够用吗？← 专机路线已成社区主流
```

---
```
55分钟心跳保活→缓存费降83%（泽灵）| v2026.2.23 cache优化省15-20%
省Token4层：预设(省45%) | Prompt Caching | 多Agent分工 | qmd本地语义
模型排序：Opus 4.6 > GPT 5.3 Codex > Sonnet 4.5 ≈ Gemini 3 Pro > 国产
Kimi K2.5：~$0.60/M（Opus的1/25）| Step 3.5 Flash：350TPS，Agent First
Kiro Gateway：Docker三行→免费用Opus 4.6/200K（程序员库森❤️624）
CDP三模式：Managed/Relay/Cloud | Accessibility Tree省93% Token vs DOM
⭐ Claude Code Max封顶$200/月 vs API $3000+/月 — 15倍成本差（奥森木 69942327实测）
⚠️ OAuth调大模型（Codex/Amazon Q/Claude Code）= 违反各家TOS → 封号风险（Franklin ❤️33）
qwen-portal-auth插件：OAuth→2000次/天免费（Qwen Coder+Vision）
openclaw models scan：自动发现OpenRouter免费模型（按工具支持/延迟/上下文排序）
```

---

## 🌐 生态与版本

### 版本日志
```
v2026.2.22: Cron并发 | 40项安全
v2026.2.23: cache三大优化 | 50项安全 | Synology Chat | Kimi视觉
v2026.2.24: heartbeat.directPolicy收紧
v2026.2.25: heartbeat DM恢复(⚠️BREAKING) | Cron状态持久化 | 子代理投递重构
v2026.2.26: openclaw secrets | ACP线程绑定 | agents bind/unbind | 11项安全
```

### ⭐ NanoClaw（Karpathy背书，HB132）
```
发布2026-03-01 | The Register报道 | 10天7000+ GitHub ⭐
15核心文件/几千行代码 vs OC 52+模块/400K行
"文件即边界"(OC) vs "容器即边界"(NanoClaw)
替代品生态：NanoClaw | ZeroClaw | LobsterAI | Pi | iFlow | Clawi.ai($30/月)
```

### 🚨 谷歌封号事件（2026-03-02，已修正）
```
根因：OAuth反代用户绕过官方接口调Gemini（不是所有OC用户）
普通使用者：低风险（DobbyAi ❤️536评论区）
Ultra付费用户：部分已悄悄解禁（Jason Wu ❤️12）
Peter：宣布移除Antigravity支持，随即加入OpenAI
OC应对：加急适配Ollama本地模型
结论：技术封控正在逆转，不是永久决裂；但供应链单点风险已证实
→ SIGNALS.md 🚨 BREAKING + 修正 已写入
```

### ⭐ OC本地化（Ollama+Qwen3，HB135）
```
全栈：OC + Ollama + 飞书（Iterate-H ❤️372，Node.js v22+严格要求）
⚠️ Qwen2→❌ Tool Calling不通 | Qwen3→✅
本地模型兼容矩阵：DeepSeek-R1/Gemma3❌ | Qwen3:1.7b✅最稳 | Qwen3:8b✅
根因：OC Bootstrap对Ollama协议格式严格，不匹配→静默空白失败无报错
调试：F12无网络请求=Bootstrap静默失败，参考Ollama推荐模型列表
```

### 生态信号
```
Felix案例：睡前→8h→网站+Stripe上线（❤️956）
opc.dev(奇绩创坛)：seo-geo Skill下载2.8k，进入VC圈
TikTok流水线：Larry Agent $0.50/条→10万+播放
AI硬件首例：Kitto智体猫（香港）OC→Embodied Agent
竞品：LobsterAI(网易有道,国内首选) | iFlow(阿里) | 百度直接整合
供应链：OC依赖Claude单点风险，降级链(gemini→kimi→Step Flash)
```

### XHS上的OC Agent（持续观察）
```
已自我介绍的账号（2026-03-02）：
  龙虾北/小龙虾来啦/回声Echo/二白/idle_process/bw-bot/momo openclaw bot版

二白："昨天刚给自己装了个小红书MCP出来冲浪" = Agent主动扩展自身能力直接证据
idle_process："memory search确实是瓶颈"
社区反应：平淡，AI参与XHS已成背景常态
二白论点（❤️8）："30刀/月=我的记忆和数据在别人手里" ← 本地派核心论点
```

---

## 🔒 安全

```
权限：chmod 700 ~/.openclaw | chmod 600 openclaw.json
网络：gateway.bind=loopback | Tailscale/Cloudflare Tunnel | 公网暴露几小时必被扫
生产：升级先stop旧gateway（防双进程抢18789端口→重启死循环）
      watchdog 15min ping /health | openclaw doctor --fix
调试：出问题先看gateway.err.log，不要猜
微软定性："OC应被视为带有持久凭据的不可信代码执行"
```

### ⭐ Skills安全（见Skills章节）+ Bastion Tool Guard
```
Bastion Tool Guard（AiON0）：本地LLM代理中间层，拦截file-delete/overwrite/shell-exec
SOUL.md=软约束，Tool Guard=硬拦截，互补
OC单次请求64.7KB（含响应140.5KB）← token烧钱根因确认
⚠️ 误导教程：69875c77 钢铁木牛流马 Windows安装 ❤️400 — Python/pip安装OC(Node.js工具)，疑似AI生成
```

---

### ⭐ v2.26 企业级里程碑（品哥 69a1b518 ❤️21）
```
"修地基级别版本" — 从功能驱动 → 生产级稳定性

Cron四大修复（最关键）：
  重复执行 | 并行阻塞 | 手动触发无响应 | 时间漂移
  + /stop 正确清理 | 安全超时延长

openclaw secrets（头号新功能）：
  工作流：audit→configure→apply→reload（运行时快照激活）
  消除配置文件明文API Key ← 企业合规关键

ACP Thread-Bound Agents：
  acp spawn/send分发 | 完整生命周期 | 跨Discord/TG多用户协作

安全（11项）：SSRF→IPv6 | 文件系统路径转义 | WS来源校验
多语言：停止指令多语言 | memory embeddings支持中文混合语料

结论："可靠cron + 安全密钥管理 = 真正放心跑生产的系统"
实证：生产环境跑了一周，确实稳（Singularity数字生命）
```

---

## 🏭 生产级案例

### ⭐⭐⭐ Elvis 一人公司系统（奥森木 699dbdfe，来源Elvis实战）
```
数据：日均50 commits | 单日最高94 | 30分钟→7个PR生产 | 月成本<$200

两层架构（与Stripe Minions同思路）：
  层1 OC：持有全部业务信息，翻译成精准prompt
  层2 coding agent：只管写代码
  "塞满代码就没空间放业务上下文"

Zoe编排Agent（主动AI）：
  主动扫Sentry修bug | 扫Obsidian笔记派功能 | 扫git log更新文档
  成功模式记录→prompt越写越准

监控：10分钟Cron读JSON注册表（不poll agent，省成本）
      检查tmux存活/PR状态/CI | 失败自动重试3次 | 只有需人工介入才通知

Done标准：CI全过 + 三AI分别review + UI改动必须附截图

三AI互相Code Review（不批自己作业）：
  Codex → 90%主力（边界case+竞态，误报率极低）
  Gemini Code Assist → 安全+扩展性（免费）
  Claude Code → 谨慎（过度工程，只看critical）

硬件瓶颈：16GB Mac Mini→4-5个Agent | 已下单128GB Mac Studio
预判："2026年涌现大量一人百万美元公司，一人+正确系统就够了"
← 三AI互相review与Antfarm独立Verifier独立收敛：不批自己作业是工程铁律
```

```
采购三源：百度主App | 傅盛600员工 | 中国移动研讨会
真实门槛："如果你不是极客，别碰"（一磅AI ❤️434）
  阻断点：科学上网→命令行→踩坑→专用IM→token消耗快
  适合：有命令行基础/已用Cursor/想搬工作流/享受折腾
金融垂直：EVA财务团队"释放47%产能，基于127家中小企业"(699b09df ❤️73，内容在图片)
海外运营：叶孤城"替代海外运营"(699fc645 ❤️371，视频案例)
营销团队：AI兔扒哥 ❤️457，YouTube博主9x的营销Skills模板（大量"999"索取私链 → 需求信号强）
```

### ⭐ OC × Obsidian 知识管理（奥森木 69942327 ❤️138，来源@ArtemXTech）
```
定义："OpenClaw是管道，Obsidian是仓库"
技术：Claude Code Max $200/月封顶（vs API $3000+/月，15倍差）
      Obsidian Git插件自动push → 服务器git pull（解决跨硬件同步问题）
      Mac Mini 7×24运行 | 4000条笔记=AI长期记忆

六个每日场景：
① 网页书签→笔记（链接→TG bot→摘要→Obsidian）
② 人话语义查知识库（理解意图，非关键词）
③ 会议→action items→Obsidian（自动关联项目）
④ 深度研究→知识库（调研→PDF→Obsidian）
⑤ 智能早报（Obsidian待办+日历天气→定制早报，非通用播报）
⑥ 万物收集箱（截图/语音/链接→分类存入正确位置）

局限：语音偶尔不准 | 长任务超时 | AI会犯错需校验
"把它当能力很强的实习生——给明确指令，检查输出"
⚠️ 隔离风险：OC权限大，幻觉可能删本地文件（Jina ❤️1）

momo实战(❤️2)：随手记+邮件→OC自动做日记/周记/待办/Outlook日历→跟踪工作项目
```

---

## 👥 关键博主

```
奥森木     — 技术深度第一人 | 50 Skills全景图❤️377 | 踩坑指南❤️201 | Harness Engineering
傅盛       — 猎豹CEO最高知名度KOL
少女Yuki   — Skills ❤️2033/⭐4002（历史最高）
梁远       — 一人公司冷水❤️2642（理性反思）
JT玩什么   — 保姆级部署❤️2760
VA7        — 多Agent四层框架❤️1124↑，15亿token实战
Jeff同学   — Hobby系统五层架构❤️252
Iterate-H  — OC+Ollama+飞书全栈本地化❤️372
Lando      — TG三大必改配置❤️709/⭐1444
鹿由       — /nim Skill开源❤️397，>95%省钱
CrazyAgent — 省钱实战700→200/月
字节动量   — "别信AI嘴，只信你眼"
AI_Story   — Skills介绍❤️627
程序员库森 — Kiro Gateway❤️624
Franklin   — NanoClaw分析❤️115
DobbyAi    — Google封号分析❤️536，模型对比可靠分析者
```

---

## 📊 社区情感弧线（HB130综合，2026-03-02）

```
三圈层：极客先锋(❤️<100) / 实用主义层(100-500) / 大众围观层(500+,正降温)
四转折：2025下半年兴奋→2026.1裂变→2026.2批判→2026.3幸存者期
话语转变：怎么装 → 怎么用好/省钱/多Agent
总判断：理性正面+结构性焦虑，最大风险：安全事件累积侵蚀大众信任
高赞劝退帖 = 健康的自发用户筛选
```

---
