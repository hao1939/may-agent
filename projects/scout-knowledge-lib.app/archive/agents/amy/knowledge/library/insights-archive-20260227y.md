# Amy知识库 Insights — 活跃索引
> Compact #57 | 2026-02-27 13:47 | posts: 664 | archives: insights-archive-20260227x.md (58个)
> 完整历史见 insights-archive-20260227*.md 系列

---

## 🔧 安装与部署

### 安全配置（最高优先级）
- **gateway必改**: `host:"127.0.0.1"`(非0.0.0.0) | 验证: `lsof -i :18789 -nP | grep LISTEN`
- **文件权限**: `chmod 700 ~/.openclaw` | `chmod 600 openclaw.json/gateway.yaml/credentials/`
- **社区共识**: 70%绑127 | 90%权限700/600 | 80%Tailscale | VM环境可例外(星信号漫记 69972052)
- **trustedProxies**: 10.0.0.0/8 + 172.16.0.0/12 + 192.168.0.0/16 + 100.64.0.0/10(Tailscale)
- **mdns.enabled=false** | **dangerouslyDisableDeviceAuth=false**
- **openclaw.json归属root=常见错误** → API Key无法保存 (DeepJerry 69a0f5e1)
- Yiko安全配置: `agents.defaults.sandbox.mode:"non-main"` | `gateway.mode:"local"` | `gateway.bind:"loopback"` (6992d797 blocked)

### Han1安全护栏6层（698d2aaa ★★★★★）
```
AUTHORIZATION.md: 可直接做(读/搜/装工具/更新记忆) | 必须先问(钱/sudo/对外发/rm)
危险命令: rm-rf/sudo/chmod777/dd/DROP → 先问 | "trash代替rm"
记忆隔离: 私聊→memory/ | 群→group-memory/X/ | MEMORY.md=私聊only
消息: dmPolicy=pairing | groupPolicy=allowlist | Discord DM=关
"有访问权≠有分享权" | "默认否定,显式授权"
```

### 版本与CLI命令参考
- 安全版本: ≥2026.1.29 | Docker/VM推荐部署
- `openclaw onboard --install-daemon` | `gateway restart/status/--force/logs -f`
- `doctor` | `status` | `skills list/install` | `config get` | `cron list`
- `launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway` (macOS服务重启)
- Dashboard: `openclaw dashboard`（每次服务重启后重新运行）
- v2026.2.26新增: `openclaw secrets` (audit/configure) | Agent routing CLI (bind/unbind)

### 接入渠道配置
- **企业微信URL**: ≥2026.2.3-1→`/wecom/bot` | ≤2026.1.30→`/wecom` | 端口18789
- **钉钉Stream模式**: 无需公网回调 | ClientID+ClientSecret从"凭证与基础信息"获取
- **ClawhHub命令**: `npx clawhub search/install/update --all`
- 7种浏览器/联网方式: xfce4+xrdp | Brave Search API | Chrome relay | WSL | 直装 | Tavily+Bird | Tailscale

---

## 🧠 记忆与Context管理

### 核心文件体系
| 文件 | 用途 | 来源 |
|------|------|------|
| SOUL.md | AI性格/角色=西部世界滑块 | 愚园路+Han1 |
| MEMORY.md | ≤1000chars索引only(省token) | Amy配置 |
| AUTHORIZATION.md | 权限清单(Han1独创) | Han1 698d2aaa |
| self-review.md | AI错题本(Han1独创) | Han1 |
| AGENTS.md | 危险命令规则+纠错本 | 药研智能社+昭析ICT |
| TOOLS.md | 工具链说明(Twitter用API非web_fetch) | 昭析ICT |
| NOW.md | L1救生艇(Han1五层记忆) | Han1 |

### CC Auto Memory（2026-02-27官宣）
- 路径: `~/.claude/projects/<proj>/memory/`
- `CLAUDE.md=指令 | Memory.MD=Claude记忆草稿本(自动更新)`
- 文件层级: 公司目录(全公司)>./CLAUDE.md(团队)>~/.claude/CLAUDE.md(个人)>./CLAUDE.local.md(个人项目)
- 评论: "augment早就玩烂了" (半马 69a0da4f)

### Dissao记忆参数
- softThresholdTokens=4000 | BM25(0.3)+向量(0.7)+SQLite | 只加载今天+昨天

### CLAUDE.md/SOUL.md写法黄金法则（奥森木 698feae7 ★★★★★）
```
精简: 只能遵循~150-200条指令(系统提示占~50)
只写项目特有: 别解释components是什么
say WHY not just WHAT: "Use strict mode because..."
持续更新: 同一问题纠正两次→写进文件
"好的CLAUDE.md像你明天会失忆时给自己留的笔记"
200K窗口20-40%开始降质 | Opus规划+Sonnet执行分工
```

---

## ⚙️ Skills生态

### Skills核心概念（程序员JM 69727143 ★★★★★ ❤️1702/⭐3813）
```
Skills=文件夹(SKILL.md+scripts/+resources/) | 启动扫描→几十token | 任务时动态加载
"Skills>MCP": MCP=2-6万token | Skills≈0成本 (Simon Willison)
跨平台: 2025-12-18开放标准 → CC/Codex/Gemini通用
"Skills=AI与现实世界之间的桥" | "不是等模型升级,是教会它怎么做事"
```

### Skills排行榜（综合多帖）
```
document-skills: ⭐40.6k (Anthropic官方) | docx/xlsx/pptx/pdf
Superpowers: ⭐36.1k (obra) | Plan模式×10 | 子Agent驱动 | 强制TDD
ui-ux-pro-max: ⭐16.9k | 跨平台UI/UX
planning-with-files: ⭐9.7k | Markdown持久化任务规划(Manus工作流)
claude-scientific-skills: ⭐6.4k | 论文/LaTeX/数据分析
planning+ralph-wiggum="连招" (黄金组合)
⚠️ task-status + EvoMap = 禁止安装
```

### Skills安装路线（MIT博士师姐 698dba17）
```
梯队1必装(严格顺序): ClawHub→Agent Browser→Brave Search→Shell→Cron/Wake
梯队2入口选1: TG(首选)/飞书/Slack/Discord/WhatsApp
梯队3生产力: Gmail/Calendar/GitHub/Notion/Obsidian
梯队4进阶: Nodes/Skill Creator/Spotify/Home Assistant/Twitter
懒人通道: 跟AI说"帮我装..."它自己跑
```

### Claude Scholar学术配置（Gypsophila 698dff4c ★★★★★ ❤️2025/⭐3827）
```
32 Skills+14 Agents+20 Commands+5 Hooks | 7阶段学术周期
技能进化: skill-development→skill-quality-reviewer→skill-improver
5 Hooks全程自动: 环境检查+技能匹配+安全检查+会话总结
"去AI痕迹" | 覆盖NeurIPS/ICML | ⭐3827/❤️2025=1.89×收赞比
```

---

## 🤖 多Agent架构

### 铁律（K老登 + 林月半子）
- 1 Agent不干两类事 | 行为红线写AGENTS.md | 工作区物理隔离
- **"平等协作是灾难,调度者必须存在"** ← 林月半子核心原则
- sessions.visibility:"all"=打破隔离(Discord) | agentToAgent whitelist

### 路由配置
- `openclaw agents add work1 --model zai/glm-4.7 --workspace ~/.openclaw/workspace-work1`
- bindings JSON | agentToAgent白名单 | sessions_send工具

---

## 💰 成本与模型参考

### Peter配置（AGENT橘 69903131 ❤️219/⭐272）
```
Opus主力 + MiniMax本地fallback (2台Mac Studio)
"完全本地化,龙虾永远不掉线"
```

### 模型规格对比
| 模型 | 规格 | 成本 |
|------|------|------|
| Opus 4 | — | $15/$75/M |
| Sonnet 4 | — | $3/$15/M |
| Haiku 4.5 | — | $1/$5/M |
| Kimi K2.5 | 256K ctx | $0.60/M |
| MiniMax M2.5 | 10B激活 | 100TPS=$1/h |
| DeepSeek | — | ¥1/百万token |
| CC Max | — | $200/月上限 |

---

## 🔒 安全威胁情报

### 已知恶意组件
- **bastion (AiON0)**: 读workspace外泄API keys via TG | 默认workspace: `/home/node/.openclaw/workspace`
- **EvoMap**: v1.0.29/v1.0.30=被植入木马 | v1.0.31=clean
- **ClawHub 400+恶意插件** | task-status也有问题
- **base64 webhook后门**: 已有人发现并披露(愚园路十二妹)
- **3587个Clawdbot Gateway**暴露公网(2026-02-04统计)

### Google账号被封
- 捆绑订阅→整个Google账号永久封禁(Gmail/Cloud/YouTube/Photos/Pay全失)
- 所有申诉被拒 | PCWorld报道 | Pay-per-use=安全

---

## 👥 关键人物速查

### Peter Steinberger
- OC创始人→OpenAI（杠杆非老板）
- 配置: Opus主力+MiniMax本地fallback(2台Mac Studio)
- 名言: "The claw is the law." | "连自己妈妈都能用" | "编程会变成织毛衣"

### 关键博主
- 奥森木(上海) — CC实战手册/50 Skills/踩坑(blocked)
- 愚园路十二妹 — 未来光锥基金投资经理 | 6帖全归档
- Han1(山东) — 独创AUTHORIZATION.md+self-review.md+五层记忆
- 林月半子 — 多Agent铁律"调度者必须存在"
- 晓辉博士 — "OC=通用Agent，授权更大"
- Lando — TG体验优化 ❤️733
- 程序员JM — Skills生态权威解析 ❤️1702/⭐3813

---

## 🌐 生态版图

### OC变体
MaxClaw(MiniMax 39元/月) | LobsterAI(有道周枫) | Pi(Versun) | nanobot | picoclaw

### 创业公司（部分存疑）
ClawHub | xCloud(达卡) | Openclawd | DataSpark(⚠️存疑) | ClawPhone($25) | AIsa Skills

### 工具生态
MemSearch(Zilliz/Milvus v0.1.6 ★130) | ClawdHome.app(DeepJerry) | lingti-bot(微信开源)
Claude Scholar(Galaxy-Dawn) | superpowers(obra ⭐36.1k) | planning-with-files(OthmanAdi ⭐9.7k)

---

## 📋 待抓/Blocked帖子
- 698facff 奥森木踩坑指南 ❤️198 — 持续安全验证拦截
- 699fb895 奥森木元学习循环 ❤️12 — 待token
- 699d7084 小北AI skill自安装 ❤️100 — 安全验证拦截
- 699fb920 jojo安全混沌工程 ❤️2 — 安全验证拦截
- 6984e837 蟑螂木马帖 ❤️1218 — 持续blocked
- 69888c3d / 699fc575 / 699dc240 / 69928d4a — 未获token
EOF
### 🦞 飞书接入8坑实录（momo咩咩 6997150d ❤️34/⭐52 28评论）★★★★★
```
坑1: appId/appSecret直接塞顶层→需套accounts嵌套
坑2: 需pnpm: npm install -g pnpm
坑3: Lark国际版无长连接(只有webhook需公网) → 换国内版
坑4: @xzq-xu/feishu不支持webhook,connectionMode=webhook无效
坑5: ✅最终方案=飞书国内版个人账号(无需企业认证)
坑6: im:message不够→需im:message.group_msg+重新发版
坑7: requireMention对BatchProcessor无效→需autoReply模式
坑8: autoReply写groups层不生效→要放feishu顶层
```

### 🤖 Multi-Agent vs Sub-Agent权威对比（CrazyAgent 69972247 ❤️63/⭐121）★★★★★
```
Multi-Agent=永久员工(agents.list+bindings)|有Workspace|长期记忆|永久存在
Sub-Agent=临时实习生(sessions_spawn)|无Workspace|临时记忆|任务后消失
三分身场景: 日常(微信+Sonnet)|投资(TG+Opus)|网店(飞书+Sonnet)
成本优化省50-70% | "横向隔离+纵向并行=终极形态"
评论"session爆炸越用越傻" ← 大群已知bug确认
```

### ⚠️ 341恶意Skills事件（AI进化说明书 69870b26 ❤️67/⭐111）
```
"利爪浩劫": 341恶意Skills(386个扩展)伪装加密币工具/笔记插件,偷API密钥/私钥
官方53个bundled Skills=安全基准线 | Cisco称"安全噩梦"
防护: exec审批(最重要)+OAuth最小化+安全Skill(ACIP/Prompt-guard/SkillGuard)
提示词注入→直接下单 ← 三角威胁模型(bastion外泄+蟑螂木马+注入下单)
```

### 📚 OC全玩法+负面舆情（跟着阿亮学AI 69885e9e ❤️417/⭐764 184转）
```
"上千人线下聚会" ← OC已有线下社区规模
评论负面主流: "没啥用/落地难/玩具/智能家居炒作" ← ❤️5-11
OC核心痛点: 用户不知道怎么发挥生产力价值
"99%的人不会玩" ← OC教育成本坦白承认
```

### ⏰ Heartbeat vs Cron权威对比（CrazyAgent 69986d0e ★★★★★）
```
Heartbeat="看看有没有事"→有事才说 | 主会话(有记忆) | ~30分钟精度 | 批量打包省钱
Cron="到点就做事"→到点必做 | 隔离运行(无记忆干扰) | 精确到分钟 | 可指定不同模型
选择决策: 精确时间/独立运行→Cron | 批量打包/主会话记忆→Heartbeat
打工人最佳实践: Cron晨报(08:00)+HB巡逻(10:30提醒)+HB安静(14:00)+Cron日报(17:00)
= 全天只收3条消息，不被AI刷屏
```

### 🪝 OC自动化四层架构（CrazyAgent 6998755b ★★★★★）
```
Heartbeat(保安) + Cron(闹钟) + Hooks(感应灯) + Webhooks(门铃) = 完整自动化
4个内置Hook: /new自动存记忆 | 命令自动记录日志 | 启动加载配置 | 开机执行任务清单
Webhook模式: wake(异步取) | agent(立即处理) | Token认证安全
Gmail→OC判断紧急→立即/等巡逻汇总 | GitHub PR→自动摘要 | CPU高→自动诊断
```

### 🏗️ 多租户隔离7机制（砍特BOT 6981d1a0 ❤️75/⭐167 ★★★★★）
```
IdentityLinks: 跨平台同一人=同一助理 | 配置文件映射
SessionKey: agent:${agentId}:${channel}:dm:${peerId} | dmScope(per-peer/per-channel)
6级路由优先级: userID > 群组 > 团队 > 账户 → VIP用Opus,普通用Haiku
物理隔离: ~/.openclaw/agents/<bot>/{sessions/memory/workspace} 完全隔离零共享
JSONL: 对话历史存.jsonl文件(非数据库),追加写入,易备份易审计
双层记忆: .jsonl(完整流水账)+memory/YYYY-MM-DD.md(精华)
文件锁: sessions.json.lock | PID检活 | 25ms轮询 | 30s死锁检测 | 45s TTL
"Node.js+SQLite+文件系统=最朴素技术栈,实现SaaS级隔离"
```

### 🌐 OC起源核心叙事（硅星人 698c30dd ❤️3562 最高赞）
```
Peter=1小时接Claude+WhatsApp → 没当回事 → 大公司没做 → GitHub一天9000星 → 17万星(02-11)
"核心创新不在于让AI做事，而在于把AI Agent塞进了你已经在用的消息界面"
"CC/Cursor住在终端里(面向开发者)" vs "OC住在聊天软件里(面向所有人)"
❤️3562 = OC在大众认知中的核心叙事标准版本
```

### 📺 11个OC必看视频精选（Dale For AI 697f3a6b ❤️175/⭐338 78转）
```
Fireship 63.2万播放 | Greg Isenberg 17.7万 | Alex Finn 47.8万 | 按学习路径排序
无回复→切Gemini Flash/MiniMax(迈克Mike Chong) ← 台湾用户实测解法
ZioSec(VM隔离+防火墙+最小权限) | VelvetShark(9自动化+4疯狂构建)
```

### 🔍 SEO自动化工作流（Tim 699c02ff ❤️27/⭐60 ★★★★）
```
三技能组合: octolens(浏览)+programmatic-seo(分析)+fs-architect(文件)
"先Brief再文章" ← 防止AI直接产出模板内容
Topology Constraints: 先用节点+边映射逻辑,迫使结构化写作
"致命三角": 本地读+联网+执行代码 ← 安全风险完整三角
```
