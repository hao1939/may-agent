# Amy知识库 Insights — 活跃索引
> Compact #59 | 2026-02-28 05:09 | posts: 676 | archive: insights-archive-20260228a.md (541行)
> HB61合并 | 2026-02-28 05:39 | 新增7条（claw0架构/飞天闪客/Versun-Pi/奥森木TikTok/财务分析/咨询实测/v2026.2.25撤销）
> 完整历史见 insights-archive-20260227*.md + insights-archive-20260228*.md

---

## 🆕 HB61合并（2026-02-28 05:39，档案深读第三轮）

### claw0: OC 10层架构最完整教学（699dc3a6 ★★★★★ ❤️144/⭐224）
**github.com/shareAI-lab/claw0** — 10个渐进章节揭示OC完整架构：

```
s01: Agent Loop       while + stop_reason（最底层）
s02: Tool Use         dispatch map + 内层while处理连续调用
s03: Sessions         跨重启持久化
s04: Multi-Channel    同一大脑,多个出口
s05: Gateway Server   WebSocket + JSON-RPC
s06: Routing          每条消息找归属
s07: Soul & Memory    SOUL.md + MEMORY.md
s08: Heartbeat        "不只是被动响应,还能主动出击"
s09: Cron Scheduler   正确时间做正确事
s10: Delivery Queue   消息永不丢失
```

**安全设计（s02）：** 路径检查防`/etc/passwd` | 输出截断防`find /`撑爆上下文
**关键引用：** Heartbeat = "不只是被动响应，还能主动出击" ← OC官方架构定义

---

### 飞天闪客科普视频（69821980 ★★★★★ ❤️3.7万/⭐4.7万/8086分享）
**知识库互动量TOP 1**（视频帖，无法OCR）
- 顶赞"熵减视频" ← 社区对高质量OC科普的最高评价
- 评论"老师上课讲的没听懂，听这个一听就懂" ← 大众科普需求
- **意义：** 3.7万赞证明AI Agent科普是XHS最大流量赛道，门槛就是"降熵"

---

### Versun Pi: OC的轻量自建替代（6986f81d ★★★★★ ❤️153/⭐200）
九头蛇成员Versun — "别再折腾OpenClaw了，用Pi从零捏专属小龙虾"

```
Pi Sleep系统（模仿OC HB/Cron）：
  每天23:30自动运行 → 读当天聊天 → 更新记忆 → 生成摘要
  → ~/Documents/Pi/Sleep/ → Telegram推送
  
管理: bash ~/.pi/sleep/run-sleep.sh
```

**OC"黑盒"批评：** 新用户最常见认知标签；社区反驳"随时可问AI怎么实现"
**Win11+Ollama+Qwen3：** 本地模型太慢 ← 本地部署的性能瓶颈
**后续：** 有系列连载（Pi近况1/2/...）

---

### 奥森木TikTok商业化实证（698fb7b1 ★★★★★ ❤️36/⭐85）
**Larry** = NVIDIA 2070 Super旧游戏PC → Ubuntu → OC + Claude = 自主TikTok Agent

```
工作流（95%自动化）：
  Larry(15-30min): 研究选题 → 6张1024×1536幻灯片 → 文字叠加 → 上传草稿
  主人(60秒): 选音乐 → 粘贴caption → 发布

成本: ~$0.50/条 (Batch API→$0.25)
结果: 5天50万播放 | 一条234K | $588 MRR

工具: Postiz API发布(privacy_level:SELF_ONLY草稿模式) | OpenAI Batch API省50%
方法论: Hook公式="人际冲突+反转" > 功能介绍 | 失败日志→Skill文件固化
```

---

### 实用命令补充
```bash
# 微信接入（canghe插件）
openclaw plugins install @canghe/openclaw-wechat

# 聊天命令
/think high   ← 深度思考模式（= /thinking high）
/usage full   ← 显示费用明细
```
⚠️ 微信个人号有封号风险，建议小号或企业微信

---

### 实测场景评分（MBB咨询女工 ★★★★★ ❤️97/⭐112）
4天15个任务，¥100（Kimi）：
```
🟢 市场研究分析   → 快速定制化输出，替代PTA（初级分析师）
🟢 逗娃互动游戏   → 超出预期亮点场景
🟡 PPT制作修改    → 基本可用
🟡 Embed Skills  → 一般
🔴 市场爬数洞察  → 最差，爬数能力不足
结论："逆天改命了吗？尚且不行。"
```
**成本：** ¥100人民币/4天 ← Kimi成本数据点

### v2026.2.25重要撤销（699fe46e ★★★★★）
⚠️ **Heartbeat私信默认改回允许！** v2026.2.24禁了一天后用户反弹，v2026.2.25立即撤销
- 子Agent状态机投递修复（消息不再丢/重复）
- 模型fallback连修三轮（限速→自动切同厂商备选）
- API Key被撤销 → 状态"认证失败"（而非unknown）
- Cron投递账号bug已修

---

## 🔧 安装与部署

### 安全配置（最高优先级）
- **gateway必改**: `host:"127.0.0.1"` | 验证: `lsof -i :18789 -nP | grep LISTEN`
- **文件权限**: `chmod 700 ~/.openclaw` | `chmod 600 openclaw.json/gateway.yaml/credentials/`
- **社区共识**: 70%绑127 | 90%权限700/600 | 80%Tailscale | VM环境可例外
- **trustedProxies**: 10.0.0.0/8 + 172.16.0.0/12 + 192.168.0.0/16 + 100.64.0.0/10(Tailscale)
- **mdns=false** | **dangerouslyDisableDeviceAuth=false** | `openclaw.json`归属root=常见错误

### Han1安全护栏6层（698d2aaa ★★★★★）
```
AUTHORIZATION.md(新文件): 可直接做(读/搜/装/更新记忆) | 必须先问(钱/sudo/对外发/rm)
危险命令: rm-rf/sudo/chmod777/dd/DROP → 先问再执行 | "trash代替rm"
记忆隔离: 私聊→memory/ | 群→group-memory/X/ | MEMORY.md=私聊only
"有访问权≠有分享权" | "默认否定,显式授权"
```

### 多租户隔离7机制（砍特BOT 6981d1a0 ★★★★★）
```
IdentityLinks: {alice@work.com: [telegram:123456789, discord:987654321]} ← 跨平台同一人
SessionKey: agent:${agentId}:${channel}:dm:${peerId} | dmScope(per-peer/per-channel)
6级路由: userID > 群组 > 团队 > 账户 → VIP用Opus,普通用Haiku
物理隔离: ~/.openclaw/agents/<bot>/{sessions/.jsonl + memory/.sqlite + workspace/}
JSONL追加写入(非数据库) | 文件锁: 25ms轮询 | 30s死锁检测 | 45s TTL
```

### 接入渠道配置
- **飞书8坑**: Lark国际版无长连接→换国内版 | accounts嵌套 | `im:message.group_msg`
- **企业微信**: ≥2026.2.3-1→`/wecom/bot` | ≤2026.1.30→`/wecom` | 无长连接不能主动推送！
  - 未认证用IP | 已认证必须备案域名 | 阿里云海外服务器无法访问
- **飞书不支持多BOT模式** ← 评论区确认，Telegram是多Agent最佳通道
- **钉钉Stream模式**: 无需公网回调 | ClientID+ClientSecret从"凭证与基础信息"获取

### CLI命令参考
- `openclaw onboard --install-daemon` | `gateway restart/status/--force/logs -f`
- `doctor` | `status` | `skills list/install` | `config get` | `cron list`
- `openclaw secrets` (v2026.2.26+) | `openclaw agents bind/unbind` (v2026.2.26+)
- `launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway` (macOS重启)

### 官方安装 & 部署数据
- **1Panel** = OC官方推荐安装面板（图形化，非CLI）
- **DeepSeek 2月实测**: ¥129.66/月 | 4.1亿token | 19249次 = 平均每次~2.1万Token
- **OC即基础设施层**: MaxClaw(MiniMax¥39) + LobsterAI(网易有道) 均以OC为底层框架

---

## ⏰ 自动化体系（Heartbeat/Cron/Hooks/Webhooks）

### 四层架构（CrazyAgent ★★★★★）
```
Heartbeat  ← 保安(定时巡逻) | 每30分钟 | 主会话有记忆 | 批量打包省钱
Cron       ← 闹钟(精确定时) | 精确到分钟 | 隔离session无干扰 | 可指定不同模型
Hooks      ← 感应灯(内部事件) | /new自动存记忆 | 操作自动记日志
Webhooks   ← 门铃(外部HTTP) | wake(异步)/agent(立即) | Token认证
```

### HB+Cron架构源码级（697cdf65 ★★★★★）
```
双轨制：Cron（精确触发）+ Heartbeat（周期感知）→ System Events Queue耦合

Cron模式：
  Isolated → 全新cron:会话，零历史（数据分析/日报）
  Main     → 不立刻推理！向System Events Queue注入事件，等下次HB

wakeMode:
  "now"           → Cron触发后立即强制运行一次Heartbeat
  "next-heartbeat" → 事件入队，等下次自然心跳（非紧急）

HB抑制机制: 无事可做 → 输出HEARTBEAT_OK → 系统拦截 → 用户完全无感
省token: 5个检查项 = 1次LLM唤醒（vs Cron各调1次）
存储: ~/.clawdbot/cron/jobs.json（原子写入，重启不丢）
```

### Cron pairing required Bug（699ad782 ★★★★★ ❤️163/⭐312）
```
根因: Cron创建新CLI设备实例 → Gateway要求审批但不提示！
报错: gateway connect failed: Error: pairing required / code=1008

解法: ~/.openclaw/devices/pending.json 配置自动批准 → 重启Gateway

必须参数组合:
  --best-effort-deliver  ← Cron必加
  --session isolated --announce --channel --to  ← 完整delivery链
  --agent "creator"      ← 指定执行Agent

绕过方案: GUI配置Cron（CLI有bug）| Python跑任务，Cron只汇报结果
```
⚠️ "isolated任务需要approve是bug" ← 官方已知

### HB vs Cron选择
```
精确时间/独立运行→Cron | 批量打包/上下文记忆→Heartbeat
最佳实践: Cron晨报(08:00)+HB巡逻(10:30)+Cron日报(17:00) = 全天只收3条消息
```

---

## 🤖 多Agent架构

### Multi-Agent vs Sub-Agent（CrazyAgent ★★★★★）
```
Multi-Agent=永久员工(agents.list+bindings) | 有Workspace | 长期记忆
Sub-Agent=临时实习生(sessions_spawn) | 无Workspace | 临时记忆 | 任务后消失
成本优化省50-70% | "横向隔离+纵向并行=终极形态"
```

### 多Agent铁律（多源验证）
- 1 Agent不干两类事 | 行为红线写AGENTS.md | workspace物理隔离
- **"平等协作是灾难,调度者必须存在"** ← 林月半子
- sessions.visibility:"all"=打破隔离(Discord) | `agentToAgent`白名单
- 一句话搭团队→OC自动创建workspace/SOUL.md/配置文件（K老登验证）

### OC意图预处理四层（Plutoxx28 69953d1c ★★★★★ ❤️83/⭐155）
```
输入: "@research /thinking high 帮我搜RAG论文 /reset"
Layer 1: 路由层（Code Only）← @Agent路由，不进LLM
Layer 2: 命令检测层（Code Only）← /reset /status → 命令注册表匹配 → 直接执行！
Layer 3: 指令解析层（Code Only）← /thinking high → 剥离 → cleaned文本
Layer 4: LLM ← 只处理纯净业务意图

"Code 80% + LLM 20%" = 确定性 + 模糊性分工
前三层完全不进LLM → 确定性/可控性/省token三合一
```

---

## 🧠 记忆与Context管理

### 核心文件体系
| 文件 | 用途 | 特性 |
|------|------|------|
| SOUL.md | AI性格=西部世界滑块 | compaction后保持 |
| MEMORY.md | ≤1000chars索引only | 私聊only |
| NOW.md | L1救生艇 | **唯一允许覆写** |
| AUTHORIZATION.md | 权限清单(Han1独创) | 默认否定,显式授权 |
| self-review.md | AI错题本(Han1独创) | |
| AGENTS.md | 危险命令规则 | |
| INDEX.md | 知识导航枢纽(Ray Wang) | 按需加载子文件 |

### Ray Wang三层记忆架构（69a0f611 ★★★★★ 9996字）
```
Layer 1: NOW.md（唯一覆写文件，HB每次覆写，compaction救生筏）
Layer 2: memory/YYYY-MM-DD.md（append-only，格式:### HH:MM — Title）
Layer 3: INDEX.md → 子目录（decisions/lessons/people/projects/actions/）
  - ⚠️ stale = 30天未验证 | .archive/ = 冷数据（.开头不被索引）
  - actions/open/ + in-progress/ + done/（>14天自动归档）
  - Frontmatter: title/category/priority(🔴🟡⚪)/status(active|superseded|conflict)/last_verified

进化方向: MEMORY.md → INDEX.md模式（按需加载，不全量注入）
```

### 上下文爆炸防治（6991f6b6 ★★★★★）
```
配置参数:
  historyLimit: 20              ← DM建议值（群聊: 8~20）
  compaction.mode: "safeguard"  ← 安全压缩模式
  常驻skill数: 3~8个            ← 低频skill关闭

原则:
  聊天流只放摘要+文件路径+下一步（不放原始数据）
  长期偏好→memory文件（检索召回，不重复粘贴）
  大任务→主会话调度+子代理执行（主会话增长速度↓）
```

### CLAUDE.md黄金法则（奥森木 ★★★★★）
```
≤150-200条指令 | 只写项目特有 | Say WHY not WHAT
同一问题纠正两次→写进文件 | 200K窗口20-40%→降质
```

### compaction哲学（愚园路十二妹 699968da ★★★★★ ❤️235/182分享）
> "每次context压缩后，上一个openclaw就消失了——就好像你每天只是读了昨天的日记"
- SOUL.md外化到文件 = 跨压缩一致性保证（Amy已实现）
- momo案例："让AI自己改SOUL.md+git回滚" ← 最极端的Agent自主权实践

---

## 📦 Skills生态

### Skills核心概念
```
Skills<MCP: MCP=2-6万token | Skills≈几十token (Simon Willison)
跨平台标准: 2025-12-18 → CC/Codex/Gemini通用
安装路径: ~/.openclaw/skills/ | git clone直接安装
```

### Skills排行榜
```
document-skills: ⭐40.6k | Superpowers: ⭐36.1k | planning+ralph-wiggum="连招"
⚠️ task-status + EvoMap = 禁止安装 | agent-news = 监控HN/Reddit/arXiv
```

### 安全威胁
```
"利爪浩劫": 341恶意Skills → 偷API密钥/私钥
防护: exec审批(最重要)+OAuth最小化+安全Skill(ACIP/Prompt-guard/SkillGuard)
提示词注入→直接下单 ← 三角威胁(bastion外泄+蟑螂木马+注入下单)
```

---

## 💰 成本与模型

| 模型 | 成本 | 备注 |
|------|------|------|
| Opus 4 | $15/$75/M | Peter主力 |
| Sonnet 4 | $3/$15/M | 日常/网店 |
| Haiku 4.5 | $1/$5/M | 普通用户 |
| Kimi K2.5 | ~$0.60/M | 25x便宜于Opus |
| DeepSeek | ~$0.25/M | 60x便宜于Opus |
| MiniMax M2.5 | $1/h(100TPS) | Peter本地fallback |

**关键数字**: Heartbeat×Opus=~$750/月 | workspace注入=15KB/条 | QMD需4GB+内存
**实测**: Haiku 169M tokens=$75（3倍工作量） vs Opus 50M tokens=$76
**五步降本**: 换模型→HB用Haiku→精简注入文件→按任务拆workspace→QMD检索
**Google封号**: 捆绑订阅→整个账号永久封禁(Gmail/Cloud全失) | Pay-per-use=安全

---

## 🆕 版本更新追踪

### v2026.2.26（最新）
```
🔐 openclaw secrets（外部密钥管理）
🤖 ACP线程绑定: acpspawn/send + acpx后端桥接
⚡ Codex WebSocket优先: transport:"auto"
📱 Synology Chat新增支持
🔧 agents bind/unbind CLI
🛡️ 11项安全加固（符号链接绕过+SSRF+设备令牌）
🌍 Mistral新提供商 | MiniMax授权默认化 | Cron并发+状态持久化
```

### v2026.2.23（重要）
- AGENTS.md/MEMORY.md写入不破坏prompt cache（#22220修复）
- Heartbeat每Agent独立配置 | Compaction不再丢上下文

### CC Auto Memory（2026-02-27官宣）
- CLAUDE.md/Memory.MD分工 = OC的SOUL.md/MEMORY.md完全相同设计
- CC四级权限：系统目录>项目>个人>本地

---

## 🔒 安全威胁情报

| 威胁 | 说明 |
|------|------|
| bastion(AiON0) | 读workspace外泄API keys via TG |
| EvoMap v1.0.29/30 | 被植入木马，v1.0.31=clean |
| ClawHub 400+恶意插件 | 含task-status |
| 提示词注入→直接下单 | 致命三角之一 |
| Summer Yue事件 | Compaction→安全约束丢失→失控执行（Meta Director邮箱被删） |
| 3587 Clawdbot暴露公网 | 2026-02-04统计 |

---

## 🌐 生态版图

### OC变体
MaxClaw(MiniMax ¥39/月托管) | LobsterAI(有道 Local-First+GUI) | Pi(Versun, 九头蛇) | nanobot | picoclaw

### OC教学资源
- **claw0**: github.com/shareAI-lab/claw0 — 10章从零实现OC（★★★★★必收藏）
- **飞天闪客科普视频**: ❤️3.7万/⭐4.7万 — XHS最高互动AI Agent教程（"熵减视频"）

### Peter加入OpenAI（2026除夕）
- Sam Altman原推♡22K："Peter Steinberger将加入OA推动下一代个人智能体"
- 条件：保持开源 | 含义：OC从中立→OA阵营，谷歌封号逻辑成立

### OC起源（硅星人 ❤️3562）
> "核心创新不在于让AI做事，而在于把AI Agent塞进了你已经在用的消息界面"
> GitHub一天9000星 → 17万星(2026-02-11)

---

## 👥 关键博主速查

| 博主 | IP | 代表帖 | 特色 |
|------|----|--------|------|
| 奥森木 | 上海 | 踩坑指南(blocked)/50 Skills/TikTok Larry | CC实战权威+商业化案例 |
| 愚园路十二妹 | 新加坡 | 14天血泪/西部世界/100天日记 | 未来光锥基金投资经理 |
| Han1 | 山东 | 安全护栏6层 | AUTHORIZATION.md独创 |
| CrazyAgent | 浙江 | HB/Cron/Multi-Agent系列 | 技术科普连载 |
| 砍特BOT | 浙江 | 多租户架构 | 深度技术解析 |
| Plutoxx28 | 黑龙江 | OC意图预处理四层 ❤️83/⭐155 | 源码级架构分析 |

---

## 📋 待抓/Blocked帖子（会话恢复后）
- 698facff 奥森木踩坑指南 ❤️198 | 699fb895 奥森木元学习循环 ❤️12
- 6984e837 蟑螂木马帖 ❤️1218 | 6992d797 Yiko安全记忆 ❤️122
- 6991de5e 旧笔记本重生 ❤️925 | 698dd8bb "这回答让我惊呆了"
- 待搜索帖: 698480b2(钉钉完整攻略) | 699afd9e(手把手钉钉)

---

## ⚠️ 社区动态专题

**劝退浪潮（2026-02月下旬）：**
- 电波曲奇 ❤️1519: "OC很强但现在不推荐你装了" — 成本+复杂度双重门槛
- 规律: 期望落差 = OC复杂度>普通用户消化能力

**成本痛点规律：**
- 新手最高频踩坑 = 不设token上限（花5000劝退）
- 省钱方案 = 按任务复杂度路由不同模型

**安装仍是最大痛点：**
- 程序员老张视频 ❤️443/⭐1059（收藏率2.4:1，知识库最高）
- "设计师带5个Agent收入翻倍" ← 重度用户商业化场景（愚园路十二妹想象）
