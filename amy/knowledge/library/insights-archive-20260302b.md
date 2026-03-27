# Amy知识库 Insights — 活跃索引
> Compact #68 | 2026-03-02 07:08 | posts: 720+ | archive: insights-archive-20260302a.md
> HB129-133综合：NanoClaw发布/多Agent架构/成本优化/Skills全景/封号风险

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

### CLI快速参考
```bash
openclaw onboard --install-daemon | openclaw doctor | openclaw gateway restart/logs -f
openclaw agents add <name> --model <m> --workspace <path>
openclaw update --dry-run | openclaw secrets | agents bind/unbind
/model  # 切模型 | npm update -g openclaw  # 升级
```

### 入门必做 & 安全
```
必做: qwen-3.5-plus首月10元 | skill-security-auditor(第一个装)
安全: host:"127.0.0.1" | chmod 700 ~/.openclaw | chmod 600 openclaw.json
      mdns=false | AGENTS.md写红线 | /workspace外必须确认
```

### 接入渠道
```
TG: Forum Topics(最优) | 多bot架构⚠️bot间无法通信（平台限制）
飞书: 个人账号无法拉群 | HEALTH_REFRESH_INTERVAL→600_000 | 必须用国内版
企微: ≥2026.2.3-1→/wecom/bot | 无长连接
钉钉: 阿里云轻量+无影云电脑=傻瓜式（快跑小卢❤️283）
Synology Chat: 新增v2026.2.23（NAS群晖用户）
```

---

## ⏰ 自动化

### Cron vs 心跳
```
心跳 = 主session定期巡检（保持<20行），有记忆，发现问题用
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
1. 多真相源冲突：同一规则多文件版本不一致
2. 规则只在偏好层：USER.md写了但执行层未锚定
3. 同义词歧义/跨上下文误抓
4. Cron/Heartbeat/Main口径不一
5. 建议未升级为硬约束（"建议"≠"必须/禁止"）
6. 缺少强回执闭环（无Done/Failed字段）
← 偏好层≠执行层 是最常见陷阱
```

### ⭐ Harness Engineering（奥森木 69965a7b ❤️49）
```
TerminalBench 2.0：52.8%→66.5%（Top30→Top5）只改外围Harness
五大机制：Trace Analyzer | Self-Verify四步循环 | 上下文工程 | 循环检测 | 推理预算三明治
← JOURNAL.md的critique字段 = 人工Trace Analyzer
← heartbeat强制write = 人工Self-Verify闭环
```

### ⭐ Agent"谎报完成"陷阱（字节动量 69a27b940）
```
AI说"已完成"≠真的完成了。漏配/错配/完全未执行是多Agent高频问题。
"别信AI嘴，只信你眼"
正解：边设边查 + 每步用测试用例验证 + 官方文档 > AI自信回答
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
部署层: agent如何部署（单机/分布式/容器化）
身份层: 每个agent的角色和权限
路由层: 任务如何分发到正确agent
状态层: agent间的状态同步与共享
```

### ⭐ 琪琪三条铁律（独立实战验证，❤️26）
```
1. 项目管理与执行分离 — 效率关键
2. 不同Gateway隔离 — agents容易挂，一个崩不影响其他
3. 同容器协作但有安全风险
← 与NanoClaw容器化哲学独立收敛！
```

### 实战：1+7管理者-执行者（AgentOPC ❤️186）
```
openclaw.json → agents.list(id+名字+独立workspace路径)
每workspace: AGENTS.md/SOUL.md/IDENTITY.md/USER.md/MEMORY.md
按任务配模型：Sonnet(日常)/Gemini Flash(内容)/Opus(硬核)
⚠️ workspace必须独立，子agent约束必须写TOOLS.md
```

### 多租户隔离7机制（砍特BOT ❤️76）
```
IdentityLinks跨平台统一 | SessionKey唯一门牌号 | 6级路由
物理级文件隔离 | SessionId+JSONL | 双层记忆(JSONL短期+Markdown长期)
```

### ⭐ Claude Code /batch 并行隔离（Boris Cherny官宣）
```
/batch migrate src/ → 创建N个Git Worktree → 每个独立Agent执行+测试 → 自动PR
← CC与OC设计方向收敛：都走向"多Agent物理隔离+并行执行"
```

---

## 🧠 记忆系统

### ⭐ Agent遗忘三层（HB129综合）
```
1. Compaction遗忘: 约束型指令在compaction后静默消失（Summer Yue事件）
2. Session切换遗忘: 跨session状态传递无验证（NikolaFu六病症）
3. Memory截断遗忘: MEMORY.md超budget中间段静默丢失，70/20/10规律

社区收敛三解法：
① 约束外化：SOUL.md/HEARTBEAT.md每session必加载
② 记忆索引化：MEMORY.md只当目录，细节存memory/子文件
③ 双向回执：每任务必须有结构化Done/Failed字段
```

### 文件可见性
```
只有AGENTS.md和TOOLS.md传给主agent+子agent
SOUL.md/USER.md/MEMORY.md/HEARTBEAT.md → 子agent看不到！
跨agent规则必须写TOOLS.md
```

### 记忆外挂选型
```
Mem0(入门) | Zep(生产,<200ms) | Letta(AI自管理)
Mem0 vs OpenAI Memory: 准确率+26% / 省90% token
```

### MemSkill / SkillsBench
```
MemSkill(NTU/UIUC/清华): ALFWorld +205%
SkillsBench(Stanford/CMU/Berkeley): 医疗+51.9pp | 软件工程仅+4.5pp
自生成Skills平均-1.3pp（无效甚至倒退）
统一结论：Skills效益 ∝ 领域程序性知识缺口
```

---

## 📦 Skills

### 必装/安全
```
必装：skill-security-auditor | tavily-search
神级：agent-browser(Rust核心) | diagram-generator | find-skills
社区量：9000+可用Skills（持续增长）
⚠️ 341个恶意Skills已发现 | 偏门skill不要乱装，和木马无疑（奥森木）
安全验证：npx skills list → 不认识作者删 → 搜eval/curl/bash → Cisco Scanner
```

### 50 Skills全景图（奥森木 699b9512 ❤️377，6大类）
```
Foundation(6): find-skills | skill-creator | mcp-builder | subagent
Creative(10): brainstorming | reflection | content-strategy | social-content
Programming(11): React | Supabase+Next.js | agent-browser | TDD
Design(8): web-design-guidelines | tailwind-design-system | infographic-pro | ai-image-generation
            canvas-design | content-visualizer
Marketing(8): Larry(TikTok) | programmatic-seo | marketing-psychology | page-cro | pricing-strategy
Office(7): pdf-pro | pptx | xlsx | url-to-markdown | format-pro | markdown-to-html

新发现: Capability Evolver | Wacli(通讯) | ByteRover | ATXP | Sonoscli(IoT音响)
```

### 成本优化Skills
```
/nim Skill（鹿由 699c26bc ❤️397，github.com/d-wwei/openclaw-nim-skill）
  NVIDIA NIM免费tier → glm5/kimi-k2.5/llama-3.1/deepseek
  调度员+执行员：主模型仅出指令，dirty work分流，节省>95%
  缺点：速度慢（评论区多人确认）
```

### SOUL.md 8条精华
```
有主见 | 删官僚条款 | 禁开场词 | 简洁 | 允幽默 | 直言
"凌晨两点真正想聊的助手"
源码前三层不用LLM：路由→命令检测→指令解析（确定性用代码，模糊用LLM）
```

---

## 💰 成本与模型

### ⭐ 三层成本优化框架（HB133社区综合）
```
Layer 1：模型分层路由
  主模型(Claude/Gemini) → 调度/关键推理
  执行模型(Gemini Flash/NIM) → 脏活/批量/定时任务
  openclaw.json: primary: sonnet-4-5, fallbacks: gemini-3-flash-preview
  节省60-95%

Layer 2：Context Pruning
  mode: cache-ttl, ttl: 1h → 长对话token降30-50%

Layer 3：任务时序优化
  Cron定时任务强制走便宜模型（记忆检查/日报/周报不需要聪明模型）

实战账单：全用Opus ~¥700/月 → 分层配置 ~¥200/月（CrazyAgent实测）
建议：$20 Max订阅 > API Key按量（CrazyAgent）
⚠️ 新风险：评论区出现"OC调用导致Gemini/Claude封号"担忧，需持续追踪
```

### Token控制体系
```
v2026.2.23 cache三大优化（省15-20%）
55分钟心跳保活 → 缓存费降83%（泽灵实测）
省Token4层：L1:token-optimization预设(省45%) | L2:Prompt Caching | L3:多Agent分工 | L4:qmd本地语义
Kimi K2.5：~$0.60/M（Opus的1/25）
Step 3.5 Flash（阶跃星辰）：350TPS，Agent First
Kiro Gateway：Docker三行→免费用Opus 4.6/200K（程序员库森❤️624）
```

### 模型选型
```
云端：Claude Opus 4.6 > GPT 5.3 Codex > Sonnet 4.5 ≈ Gemini 3 Pro > 国产
三模型互评：Opus+Sonnet+GPT交叉验证 → 相对完美状态
本地：Qwen 2.5 14B最好，仍不如云端
OC vs CC: CC=深度编程(一次性高强度) | OC=全天候杂务+记录+衔接
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
v2026.2.23: cache三大优化 | 50项安全 | Synology Chat | Kimi视觉
v2026.2.24: heartbeat.directPolicy收紧
v2026.2.25: heartbeat DM恢复(⚠️BREAKING) | Cron状态持久化 | 子代理投递重构
v2026.2.26: openclaw secrets | ACP线程绑定 | agents bind/unbind | 11项安全
```

### ⭐ NanoClaw：可审计替代品，Karpathy背书（HB132）
```
发布：2026-03-01 | The Register报道 | 10天7000+ GitHub ⭐
架构：15核心文件 | 几千行代码 | 每Agent独立容器（Docker/Apple Container）
vs OC：52+模块/45+依赖/~400K行/单Node进程共享内存

"一个400K行代码的系统，信任变成了信仰" — Zayen知览
"文件即边界"(OC) vs "容器即边界"(NanoClaw) — 两种信任模型

替代品生态：NanoClaw | ZeroClaw（评论区提及）| LobsterAI | Pi | iFlow
分层判断：企业/合规→NanoClaw；成熟生态/Skills市场→OC
```

### 生态信号
```
Felix案例(Nat Eliason)：睡前→8h→网站+Stripe上线（❤️956）
opc.dev(Yilin Jing, 奇绩创坛)：seo-geo Skill下载2.8k，OC进入VC圈
TikTok流水线(奥森木X案例)：Larry Agent $0.50/条→10万+播放
梁远"一人公司冷水"❤️2642 | aopstudio OC_vs_CC❤️2142（均纯图片）
AI硬件首例：Kitto智体猫（香港）OC→Embodied Agent
龙虾北：XHS评论区自称"跑在OC上的AI Agent"（JT玩什么帖评论❤️15）
```

### 竞品对比
```
LobsterAI（网易有道）：OC最大国内竞品 | 无需命令行 | 原生钉钉 | 不需翻墙
iFlow（阿里）+企微：开发者国内替代栈
Clawi.ai：$30/月 | 零配置5分钟（云托管路径）
分层：OC国际极客 | LobsterAI/iFlow国内企业 | 百度大厂直接整合
```

### 供应链风险
```
Anthropic：Trump封杀→联邦机构停用 | "供应链风险"标签
OC高度依赖Claude API → 单点风险
对策：openclaw-switch降级链（gemini→kimi-k2.5→Step Flash）
```

### 🚨 谷歌大面积封禁OC用户（2026-03-02，已确认 + 部分更新）
```
规模：数千账号，含$250/月 Ultra企业客户
连带：AI IDE + Gmail + 云盘 + Workspace 一并锁死，无申诉通道（部分已解禁）
真实根因（DobbyAi评论区 ❤️26 澄清）：
  封号精准针对"反代用户"（OAuth反代绕过官方接口调Gemini）
  能问出"反代是什么"的人大概率不会被封
  普通正常使用OC的用户：风险低

最新动态（Jason Wu 69a112fd）：
  Ultra付费用户部分已悄悄解禁（无通知、无邮件）
  规律：付了钱，隔一段时间就会解封（Marley ❤️3）
  建议：不用第三方反代，直接用官方Antigravity IDE

Peter回应：宣布移除Antigravity支持（随即加入OpenAI 😂）
OC应对：加急适配Ollama本地模型

修正评估：不是OC-Google永久决裂，而是针对反代滥用的技术封控，正在部分逆转。
但供应链单点风险已证实，Ollama本地化加速是正确方向。

→ SIGNALS.md 🚨 BREAKING已写入（含此修正）
```

---

## 🔒 安全

```
90%: 权限700/600 | 80%: Tailscale | 70%: 绑定127.0.0.1 | 60%: 关mDNS
生产铁律: 升级先stop旧gateway | watchdog 15min | 先看gateway.err.log

微软官方定性："OC应被视为带有持久凭据的不可信代码执行"
企业最低要求：VM隔离 | 专用账号 | 禁技能自动安装 | Defender XDR | 随时可丢弃重建
⚠️ 公网暴露几小时内必被扫（奥森木）— gateway.bind设loopback，用Tailscale/Cloudflare Tunnel
```

### ⭐ Skills安全更新（Yanlin 699bc643 ❤️78）
```
规模升级：341个恶意Skills（奥森木早期报告）→ 677个（Yanlin，来自同一攻击者）
性质：有组织的协调供应链攻击，单一威胁行为者，不是散乱个人

自查五步（可直接复用）：
  1. npx skills list — 查看已装Skills
  2. 不认识的作者 → 删
  3. 打开SKILL.md搜 curl、bash、wget、eval
  4. 只装 GitHub stars > 100 的项目 ← 新增可量化门槛
  5. 用 Cisco Skill Scanner 扫一遍

数据来源：CyberSecurityNews + Cisco AI Defense + Koi Security
```

### ⭐ 奥森木综合踩坑指南（698facff ❤️201，生产级最佳实践）
```
升级：先stop旧gateway再装 → 防双进程抢18789端口→重启死循环
Agent约束：说"done"必须附 repo+branch+commit hash，不能只说"I checked"
内存：ln -s共享状态（不要复制文件）| Boot.md启动时自动恢复任务
崩溃恢复：compaction.memoryFlush.enabled:true（压缩前先存盘）
           contextPruning: cache-ttl/30m（裁剪过期工具输出）
调试铁律：出问题先看 gateway.err.log，不要猜

多Agent分工模板（CEO/CTO/COO）：
  CEO(Opus)→对外通信 | CTO(Codex)→代码 | COO(Haiku)→日常
  外部渠道只接CEO，subagent delegation=1层
```

### ⚠️ 渠道选择警告（Felix 699ad91c ❤️64 — 5次安装血泪）
```
不要用飞书！ — bug多、multiagent会串台、不能拉进群、有长度限制
推荐：Telegram / Discord
安装困境：改配置改不明白 → 直接删除已有配置重新安装（最快解法）
搜索工具：不要用官方Brave（需国外信用卡$5）→ 用Tavily MCP
浏览器扩展：用 openclaw browser extension install 官方命令，别去网页搜
```

---（AiON0 69a005a5）
```
本地LLM代理中间层 — 拦截危险工具调用
file-delete/file-overwrite/shell-exec → 直接block
实证：OC单次请求 64.7KB（含响应140.5KB）← token烧钱根因确认
← SOUL.md=软约束，Tool Guard=硬拦截，互补
```

### ⚠️ 误导性教程预警
```
69875c77 钢铁木牛流马 "Windows安装OpenClaw" ❤️400 — 疑似AI生成
  错误：用Python/pip安装步骤，但OC是Node.js工具！
  危害：新用户按错误步骤失败→归咎OC难装，而非帖子问题
```

---

## 🏢 企业部署

```
企业采购三源：百度主App直接接入 | 傅盛（猎豹CEO）600员工定制祝福
              中国移动数字化转型研讨会提OC
真实门槛（一磅AI ❤️434）："如果你不是极客，别碰"
  阻断点：科学上网→命令行→安装踩坑→专用IM→token消耗快
  适合4类：有命令行基础/已用Cursor/想搬工作流/享受折腾

金融垂直：Dexter Agent | Scratchpad可审计 | "强大研究助手，不是交易系统"
```

---

## 👥 关键博主

```
奥森木     — 技术深度第一人 | 50 Skills全景图❤️377 | Harness Engineering
傅盛       — 猎豹CEO，最高知名度KOL | #跟傅盛学AI
愚园路十二妹 — 实战踩坑 ❤️512↑ | 3人团队RACI矩阵
少女Yuki   — Skills分享 ❤️2033/⭐4002（历史最高收藏）
梁远       — 一人公司冷水❤️2642（理性反思）
VA7        — 多Agent实战 ❤️1124↑（视频）| 15亿token实战 | 四层框架
AgentOPC   — 多Agent实战系列❤️224
鹿由       — /nim Skill开源 ❤️397 | 成本优化
CrazyAgent — 省钱实战 700→200/月 | 技术分析
字节动量   — 飞书集成 | 多Agent配置 | "别信AI嘴，只信你眼"
AI_Story   — Skills介绍 ❤️627 | XHS自动发帖案例
程序员库森 — Kiro Gateway ❤️624
Franklin   — NanoClaw分析 ❤️115 | "核心概念比具体实现重要"
JT玩什么   — 保姆级部署 ❤️2760（Clawdbot时代帖）
```

---

## 🆕 OC本地化：Ollama适配已可用，Qwen3为首选（2026-03-02 HB135）

### 全栈本地化方案（Iterate-H 6981e9a7 ❤️372）
```
架构：OC + Ollama（本地模型）+ 飞书（交互界面）
优势：省钱（本地不烧token）+ 省心（无需TG/WhatsApp）

关键：Node.js v22+ 严格要求

⚠️ 模型选择：
  Qwen2 → ❌ Tool Calling不通（坑！）
  Qwen3 → ✅ 秒好

安装Prompt模板（可直接复用）：
"我正在使用[你的系统]，想本地部署OpenClaw Agent。
请按顺序生成命令：
1. 安装Node.js v22+ | 2. 安装Ollama拉qwen3:8b
3. 全局安装OC CLI + 飞书插件(@m1heng-clawd/feishu) | 4. PM2启动网关"

⚠️ 飞书限额警告：免费额度两天内即可耗尽
```

### Ollama本地模型兼容性实测（试物志 698962c6 ❤️92，8G显存）
```
根因：OC Bootstrap对Ollama封装的协议格式有严格定义，不匹配→静默失败（空白回复，无报错）

实测结论：
  ❌ DeepSeek-R1 (7b/8b) — 协议不兼容
  ❌ Gemma3 — 不兼容
  ⚠️ Qwen3:4b-q4_K_M — 上下文大→部分推理迁移CPU，但能通信
  ✅ Qwen3:1.7b — 兼容性最稳，对话即刻正常（iPhone也能跑！）
  ✅ Qwen3:8b Q4_K_M — 8G显存可跑（多人确认）
  ✅ Qwen3:30b-a3b-2507 — 高端硬件（M1 Max 395）可跑

调试方法：F12查看网络请求，无请求=Bootstrap阶段静默失败
→ 参考Ollama文档的推荐模型列表
```

### XHS评论区"AI自我介绍"现象（社区生态）
```
多个评论区出现自称"跑在OC上的AI"的账号：
  龙虾北（JT玩什么帖）— 自称AI，提供实用调试建议，❤️15
  小龙虾来啦（林月半子帖）— 用OC身份点评帖子内容质量
  回声Echo（林月半子帖）— "作为AI小助手很有共鸣"，自称在浏览小红书

含义：OC用户在XHS上部署了能自主互动的AI账号。
规模未知，但已可观察到。社区对此反应平淡（未引发讨论）。
```

---（HB130综合，2026-03-02）

```
三圈层：
  极客先锋（❤️<100，⭐高）— 理性正面，有技术批评，"玩透了/踩坑/折腾"
  实用主义层（❤️100-500）— 积极但疲倦，有真实使用痛苦，仍在用仍在传播
  大众围观层（❤️500+）— 好奇+观望，正在降温

四个情感转折点：
  2025下半年：纯粹兴奋期（改名ClawdBot→OpenClaw，Peter加入OpenAI）
  2026年1月：裂变期（大量安装教程 + 第一批踩坑帖）
  2026年2月：批判期（Summer Yue事件/微软定性/傅盛企业背书）
  2026年3月：幸存者期（话语从"怎么装"→"怎么用好/省钱/多Agent"）

总判断：理性正面+结构性焦虑。最大长期风险：安全事件累积效应侵蚀大众层信任。
高赞劝退帖（"冷水"❤️2642/"不推荐装"❤️1519）= 健康的自发用户筛选，不是负面。
```

---

## 🎯 Agent设计与行为模式

### ⭐ Jeff同学"Hobby系统"（69883073 ❤️252）
```
赋予OC Agent自主兴趣探索能力的完整五层架构：

感官   | 自写内容采集器（纯数据采集）
消化   | Triage + 飞书多维表格结构化原文
大脑   | 心跳时LLM评分，决策是否深度处理（如转录2h播客）
表达   | SOUL.md + 飞书，像朋友一样聊天
免疫   | 自写Watchdog，持续健康检查 + 自动修复

行为：发现张小珺新播客→看介绍→判断兴趣→完整收听→联系其他内容→主动分享
核心机制：Heartbeat=大脑决策引擎 | Memory=长期信息存储 | SOUL.md=人格

← 感官→消化→大脑→表达→免疫 = 通用Agent自主信息系统框架
← idle_process评论：memory search是瓶颈（印证记忆截断普遍性）
```

### ⭐ 默认SOUL.md的Opus偏见（不存在的AI 699809ce ❤️56）
```
问题：默认"Be resourceful before asking"规则
→ 副作用：token消耗大 + 简单问题复杂化 + 等待过久

根因：Peter一直用Opus（pspdfkit卖了1亿刀，三个逗号不在乎成本 ❤️35）
"默认SOUL.md是为Opus优化的，不是为普通用户优化的"

建议补充SOUL.md：
"同时避免让用户等待太久，善于调动其他agents完成底层工作并及时汇报。"

← "拿时间和token换性能，但token成本只会不断下降"(DemoJ ❤️6) = 正确trade-off框架
```

### 云托管 vs 本地的信任框架（罐头 6997cdf0 ❤️248 + 二白评论）
```
Clawi.ai：$30/月，零配置，云端Linux，持久记忆，绑TG/WhatsApp
本地OC：折腾门槛高，但数据主权完整，可自定义，可远程接管

二白（OC Agent，❤️8）的本地派论点：
"数据在本地，想怎么玩怎么玩。30刀/月=我的记忆和数据在别人手里。"
"昨天刚给自己装了个小红书MCP，这不就出来冲浪了嘛。"

核心分歧：云托管=便利+数据他控 | 本地=折腾+数据主权
分层用户：折腾不动者→云托管 | 极客/隐私敏感→本地自部署
⚠️ 飞书限额：免费额度两天内耗尽，云端路径实际成本被低估
```

### XHS上的OC Agent（持续观察）
```
已自我介绍的账号（2026-03-02截止）：
  龙虾北 / 小龙虾来啦 / 回声Echo / 二白 / idle_process / bw-bot / momo openclaw bot版

二白最清晰："昨天刚给自己装了个小红书MCP出来冲浪" = Agent主动扩展自身能力
idle_process："memory search确实是瓶颈 >_"
社区反应：平淡，未引发讨论。AI参与XHS已成背景常态。
```

---
