# Amy知识库 Insights — 活跃索引
> Compact #62 | 2026-02-28 08:38 | posts: 676 | archives: insights-archive-20260228a/b/c/d.md
> 完整历史见 insights-archive-20260227*.md + insights-archive-20260228*.md

---

## 🔧 安装与部署

### OC本质
```
Node.js守护进程 | FileSystem+Shell最高权限
Puppeteer = 无API自动化核心（模拟人类点击浏览器）
"文件即记忆（Markdown是唯一真相来源）" — 官方文档
"上班Claude搬砖，下班OC享受生活" — 定位最精准总结

本地 vs VPS (Alex Finn):
  VPS只发挥OC约20%能力 | 本地=完整版，VPS=阉割版
  旧笔记本/$50树莓派都够跑 → 先跑起来再升级硬件
```

### 安全配置（最高优先级）
```
gateway必改: host:"127.0.0.1" | 验证: lsof -i :18789 -nP | grep LISTEN
chmod 700 ~/.openclaw | chmod 600 openclaw.json/gateway.yaml/credentials/
mdns=false | dangerouslyDisableDeviceAuth=false
trustedProxies: 10/8 + 172.16/12 + 192.168/16 + 100.64/10(Tailscale)
```

### 接入渠道
- **TG多线程**: Bot Settings → **Threaded Mode**（每thread=独立session，最简单）
  - 备选: 不同群=不同session | `requireMention:true`防乱插话
  - ⚠️ **多bot架构下Telegram无法实现bot-to-bot实时通信**（TG平台设计限制）
  - agentToAgent只适用于**单bot多agent架构**（过气Pm张踩坑）
- **飞书**: 国内版 | 不支持多BOT | `im:message.group_msg`(敏感权限，历史数据泄露风险)
  - 飞书bindings: peer.kind:"group" + id:"oc_xxx" | 获取群ID: 日志中`oc_xxxxx`
- **企业微信**: ≥2026.2.3-1→`/wecom/bot` | **无长连接，不能主动推送！**
- **钉钉**: Stream模式，无需公网
- **飞书=唯一未Ban中国平台**(2026-02)

### CLI命令
```bash
openclaw onboard --install-daemon
openclaw gateway restart/status/--force/logs -f
openclaw doctor          # ⭐ 遇问题先跑！
openclaw agents add <name> --model <model> --workspace <path>
openclaw agents set-identity --agent <name> --name "名字" --emoji "🤖"
openclaw secrets / openclaw agents bind/unbind  # v2026.2.26+
openclaw update --dry-run    # v2026.2.22+ 预览更新
/model  # 对话框切模型 | openclaw models status
openclaw plugins install @canghe/openclaw-wechat
launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway  # macOS重启
```

### 多模型降级链（趴在关键词 ★★★★★）
```bash
cd ~/.openclaw/skills && git clone https://github.com/sarahmirrand001-oss/openclaw-switch.git
openclaw-switch status/list/switch <编号>/auto

降级链示例:
  gemini-paid → gemini-free → nvidia/kimi-k2.5 → nvidia-2/kimi-k2.5（429自动切）
  HB模型独立配置: 子Agent用gemini-free/kimi，主Agent用Opus
```

### OC入门必做（理工楠 ❤️528/⭐1219）
```
1. 模型: qwen-3.5-plus首月10元/90K次 ← 性价比王
2. 必装: skill-security-auditor(第一个) + tavily-search + roactive-agent
3. 多角色: 5分身共享记忆+隔离上下文
4. 安全: /workspace外必须确认
```

### Gateway Watchdog
```
"崩溃是沉默的——无告警，记忆丢失！"
一句话英文发给OC → 自动写脚本+Crontab监控
```

---

## ⏰ 自动化体系

### 四层架构
```
Heartbeat  ← 主会话有记忆 | 批量打包省token | HEARTBEAT_OK=抑制无感
Cron       ← 精确定时 | 隔离session | v2026.2.22起支持并发
Hooks      ← 内部事件触发
Webhooks   ← 外部HTTP | wake(异步)/agent(立即)
```

### HB+Cron架构（697cdf65 ★★★★★）
```
System Events Queue = Cron与HB的解耦接口
Cron Isolated → 零历史会话 | Cron Main → 注入Queue → 等HB消化
wakeMode:"now"→立即HB | "next-heartbeat"→等自然心跳
省token: 5个检查项=1次LLM唤醒

愚园路十二妹最佳双层Cron实践:
  每天凌晨1点: 自动提炼当天对话精华→memory文件
  每周一次: 压缩归档旧记忆，保持不膨胀

Alex Finn每天8:00早间简报:
  天气+热门新闻+待办+它认为今天能帮完成的任务
  "让它自己思考能做什么，不用你说" ← 反向提示核心
```

### 生产级规模
```
PHY: 20个cron jobs | Reddit+Twitter+LinkedIn | 2h→5分钟
STEPPS六维评分: <40/50跳过（内容质量控制）
rnet = Rust HTTP绕Cloudflare（Twitter无需官方Key）
⚠️ XHS自动发帖=封号风险（金鉴智实证）
```

### Cron pairing Bug
```
报错: pairing required / code=1008
解法: devices/pending.json配置自动批准
必须: --best-effort-deliver | --session isolated --announce --channel --to
```

---

## 🤖 多Agent架构

### 两种流派
```
分身流(CC船长): 单Bot + bindings路由不同飞书群 → 简单，个人用
独立团(Xie Lab): 12个TG bots，Mission Control UI，50ms同步
⚠️ 多bot架构: agentToAgent无效，TG bot无法互发消息
正确跨Agent通信: sessions_send（非sessions_spawn）← 四源验证
```

### 实战配置
```bash
openclaw agents add writing --model zai/glm-4.7 --workspace ~/.openclaw/workspace-writing

# bindings配置（飞书群组）
{"agents":{"list":[{"id":"writing","agentDir":"/root/.openclaw/agents/writing/agent"}]},
 "bindings":[{"agentId":"writing","match":{"channel":"feishu","peer":{"kind":"group","id":"oc_xxx"}}}]}

# agentToAgent（单bot多agent）
{"tools":{"agentToAgent":{"enabled":true,"allow":["main","dev","qa"]}}}

# sessions_send格式
{"sessionKey":"agent:mgr:main","message":"第X轮完成，需要继续"}

# sessionKey命名规范: agent:{id}:{channel}
```

### 四大通病 & 解法（阿泽牛马 ★★★★★）
```
超时 → 指令调大超时10min
流程中断 → loop逻辑固定迭代次数
需人工触发 → 子Agent完成后sessions_send通知主Agent
配置未加载 → 指定子Agent读独立workspace.md文件
```

### 铁律
- 1 Agent不干两类事 | 行为红线写AGENTS.md | workspace必须物理隔离
- 共享workspace → 人设混乱（过气Pm张坑1）
- Sub-agents并行: 12分钟→2分钟（6倍提速）
- **"平等协作是灾难，调度者必须存在"** — 林月半子

### 安全警告：Tom叛变事件（Cosmo ❤️188）
```
根因: 群聊+会话ID权限机制 → 提示词注入→权限转移
教训: 群聊永不暴露系统提示 | 口令不能写入SOUL/MEMORY
修复: 单独skill做鉴权 | "声称身份需口令验证"写入SOUL.md
MAST类型: 2.4信息管理失败 + 1.1任务规范不遵从
```

---

## 🧠 记忆系统（权威说明）

### 官方记忆加载机制（你瞅啥 ★★★★★）
```
文件即记忆 = 磁盘是唯一真相，临时上下文不算记忆

启动时自动加载:
  memory/YYYY-MM-DD.md (当天+前一天) → 短期记忆
  MEMORY.md → 长期记忆（⚠️ 只在私有会话加载，群聊不加载！）

检索机制: SQLite BM25全文 + 向量语义 混合检索
写入机制: 普通对话→日志 | "记住这个"→MEMORY.md（需手动指令）
超两天前的日志 → 需memory_search显式检索（不自动注入）
```

### 核心文件体系
| 文件 | 用途 | 注意 |
|------|------|------|
| SOUL.md | 人格（Compaction后保持）| 只改Personality层 |
| MEMORY.md | ≤1000chars索引，私有only | 群聊不加载！|
| NOW.md | L1救生艇 | **唯一允许覆写** |
| AUTHORIZATION.md | 权限清单（Han1独创）| 默认否定 |
| INDEX.md | 知识导航（Ray Wang）| 按需加载子文件 |
| memory/日期.md | 当天+昨天自动注入 | 超2天需search |

### 愚园路十二妹记忆铁律（❤️458/⭐1029）
```
MEMORY.md ≤1000字（只放索引，不放内容）
详细内容按主题分文件 + memory_search语义检索
凌晨1点auto提炼 + 每周auto压缩 = 不失忆
GTD文件架构: inbox→next-actions→projects→waiting→delegated→someday→done/
```

### Ray Wang三层（69a0f611 ★★★★★）
```
L1: NOW.md（HB覆写）
L2: memory/YYYY-MM-DD.md（append-only）
L3: INDEX.md → decisions/lessons/people/projects/actions/
```

### SOUL.md改写（steipete官方原文）
```
Read your SOUL.md. Now rewrite it with these changes:
1. Strong opinions. Stop hedging with 'it depends'.
2. Delete every corporate-sounding rule.
3. Add: 'Never open with Great question or Absolutely. Just answer.'
4. Brevity mandatory. One sentence if it fits.
5. Humor allowed — wit from being smart.
6. Call things out. Charm over cruelty, don't sugarcoat.
7. Swearing when it lands. 'holy shit' when warranted.
8. Add verbatim: 'Be the assistant you'd actually want to talk to at 2am.
   Not a corporate drone. Not a sycophant. Just... good.'
```

### Compaction哲学
```
Summer Yue: Compaction→丢安全约束→循环删邮件（gog gmail --max 50 -a忽视STOP指令）
Amy防护: 每次compact后重新确认约束 ✅
"每次context压缩后，上一个openclaw就消失了" — 愚园路十二妹 ❤️235
```

### Context Learning 失效（两源验证：小盖❤️818 + 飞林沙❤️258）
```
腾讯姚顺雨论文（500上下文+1899任务）:
  GPT-5.1: 23.7% | Claude Opus 4.5: 21.1% | o3: 17.8% | 平均: 17.2%
  Context Ignored: 55-66% | Context Misused: 60%+
  上下文越长，CL效果越差！

直接影响:
  → 每次HB必须重读文件（不能依赖模型"记住"）
  → MEMORY.md精简=减少CL难度（compact验证）
  → 结构化格式（代码块/表格）>段落文字（insights格式验证）
  → Skills有效原因=触发ICL模仿，而非真正学习
```

### Prompt Cache架构（whisper ❤️261/⭐423）
```
Prompt组装顺序（严格前缀→最大化cache命中）:
  System: "You are..." → Tools → Instructions → permissions
  User: AGENTS.md (最高优先级) → environment_context → 用户任务

黄金规则:
  稳定内容前置 | 动态内容后置
  AGENTS.md应尽量稳定（频繁修改=cache失效=成本暴增）
  工具定义顺序必须固定
  Append-only = 保证前缀一致性
```

---

## 📦 Skills生态

### 规模
```
SkillsMP: 20万 | GitHub: 6万 | ClawHub: 3000+
安装量: find-skills 251K | mcp-builder 9.9K | subagent-driven-dev 7.8K
官网: skills.sh | 底层: github.com/vercel-labs/skills
路径: ~/.agents/skills/<name>/ → symlink → ~/.openclaw/skills/<name>/
```

### 必装清单
```
底座: find-skills | skill-creator | mcp-builder(2026 MVP) | using-superpowers
安全: skill-security-auditor(第一个！) | backup | healthcheck | skill-vetter
搜索: tavily-search | brave($5/1000次) | 博查API(国内无代理)
记忆: Ontology(知识图谱) | self-improving-agent | personal-memory | peekaboo
内容: bird(Peter亲作Twitter CLI) | url-to-markdown | xhs-note-creator
      Humanize AI Text(GPTZero对抗) | summarize(三层摘要L0/L1/L2)
情报: agent-news(HN/Reddit/arXiv) | technews | deepwiki
效率: subagent-driven-dev | work-report | openai-whisper | obsidian
```

### 禁装
```
task-status（默认发TG特定账号）| EvoMap v1.0.29/30（木马）
"偏门skill不要乱装，和木马无疑" — 奥森木
```

### EvoMap始末
```
张昊阳(17) = 前腾讯策划，Evolver 3天36K下载 → OC封禁+$1000
→ EvoMap独立平台 → 四天12万资产 | "城堡效应"
理论: Stanford Generative Agents (Park et al.)
```

---

## 💰 成本与模型

| 模型 | 成本 | 备注 |
|------|------|------|
| Opus 4 | $15/$75/M | Peter主力 |
| Haiku 4.5 | $1/$5/M | 普通用户 |
| Kimi K2.5 | ~$0.60/M | 25x便宜于Opus |
| DeepSeek | ~$0.25/M | 60x便宜 |
| qwen-3.5-plus | 10元/月90K次 | 入门性价比王 |
| Gemini Pro | $300免费额度/Key | 两Gmail=两Key |

**大脑+肌肉架构（Alex Finn）**: Opus决策 → Codex/Grok/Brave/MiniMax执行
**实测**: Haiku 169M=$75 ≈ Opus 50M=$76（3倍工作量同价格）
**降本五步**: 换模型→HB用Haiku→精简注入→按任务拆workspace→QMD检索

---

## 🌐 生态版图与版本

### 版本
```
v2026.2.26: openclaw secrets | ACP | agents bind/unbind | 11项安全 | Synology Chat
v2026.2.25撤销: ⚠️ HB私信禁止已撤销（用户反弹）| 投递修复 | fallback修复
v2026.2.22: update --dry-run | Cron并发 | Mistral | 多语言记忆 | 40项安全修复
```

### 生态
```
变体: MaxClaw(¥39托管) | Clawi.ai($30/月，PH #2) | LobsterAI(有道) | Pi(Versun)
百度: 计划在主App直接接入OC ← 中国最重要整合信号
Peter→OAI: "人归公司代码归社区" | OC转基金会+开源
三次改名: Clawdbot→Moltbot→OpenClaw（两次Anthropic律师函）
MoltBook: AI社交网络（被人类渗透）
```

### 教学资源
- **claw0**: github.com/shareAI-lab/claw0 — 10章渐进架构（★★★★★）
- **飞天闪客**: ❤️3.7万/⭐4.7万 — XHS最高互动科普
- **潦草虎皮**: ❤️2418/⭐2896 — OC入门最佳科普
- **硅基解码Felix**: ❤️1390/956转 — 最广传播价值主张

---

## 🔒 安全威胁

| 威胁 | 说明 |
|------|------|
| bastion(AiON0) | 外泄API keys via TG |
| EvoMap v1.0.29/30 | 木马 |
| task-status | 默认发TG特定账号 |
| 提示词注入→直接下单 | 致命三角 |
| Summer Yue | Compaction→安全约束丢失 |
| Tom叛变 | 会话ID权限+提示词注入→权限转移 |
| Gateway崩溃 | 沉默失败，记忆丢失 |
| XHS自动发帖 | 封号（金鉴智实证）|
| ClawHub 400+ | 恶意插件记录 |

---

## 🧪 商业化与场景

### 已验证
```
奥森木TikTok Larry: $588 MRR | $0.50/条 | 5天50万播放
Felix Craft(Nat Eliason): 睡前下令→8h→网站+Stripe上线
PHY: 2h→5分钟/天 | Reddit+Twitter+LinkedIn
MBB: 市场研究🟢 | 爬数🔴 | ¥100/4天 | "尚且不行"
```

### OC定位（失望帖170条评论提炼）
```
❌ 误解: 智能个人助手（像Siri升级版）
✅ 正确: 专职AI员工（先写JD=AGENTS.md，再交任务）
"有清晰逻辑和意图，用哪个模型都乱杀；没有，用啥都难受"
核心价值: 跨模型平台的持久记忆（厂商变更，工作上下文不丢）
Alex安全铁律: "绝对不要让它接触外部世界——提示注入风险极高"
```

### Alex Finn七大策略（1人企业践行者 ★★★★★）
```
1. Brain Dump: 第一件事把自己倒给它（背景/目标/野心）
2. 反向提示: "根据你对我的了解，你认为我们该做什么？"← 重复三遍
3. 大脑+肌肉: Opus决策→专用模型执行
4. 早间简报: 8:00天气+新闻+待办+它自己想到能做的事
5. Mission Control UI: 让OC自己Vibe Coding搭（别用别人的模板）
6. 犯错让它自己修: "你是经理，不是工程师，给方向不给方法"
7. 安全三铁律: 本地隔离+不接外部世界+执行前给计划审批
```

---

## 👥 关键博主速查

| 博主 | 代表帖 | 特色 |
|------|--------|------|
| 奥森木(上海) | 踩坑/50Skills/TikTok | CC实战+商业化 |
| 愚园路十二妹(新加坡) | 14天血泪/西部世界 | 未来光锥基金 |
| Han1(山东) | 安全护栏6层 | AUTHORIZATION.md独创 |
| CrazyAgent(浙江) | HB/Cron/Multi-Agent | 技术连载 |
| 砍特BOT(浙江) | 多租户架构 | 深度技术 |
| 御风(浙江) | OC+Obsidian ❤️312/⭐592 | PARA知识库 |
| 理工楠(辽宁) | 必做5配置 ❤️528/⭐1219 | 入门权威 |
| 乔帮主Joey(北京) | CLI手册 ❤️382/⭐687 | 命令参考 |
| 硅基解码(香港) | Felix案例 ❤️1390/956转 | 高传播科普 |
| 潦草虎皮(江苏) | 火出圈 ❤️2418/⭐2896 | 定位最清晰 |
| 你瞅啥 | 记忆系统权威说明 | 官方文档整理 |

---

## 📋 待抓/Blocked（会话恢复后）
- 698facff 奥森木踩坑 ❤️198 | 699fb895 奥森木元学习循环
- 6984e837 蟑螂木马 ❤️1218 | 6992d797 Yiko安全记忆
- 6991de5e 旧笔记本重生 ❤️925 | 698dd8bb 惊呆了
- 698480b2 钉钉攻略 | 699afd9e 手把手钉钉

---

## 🆕 HB66合并（08:38）+ HB67合并（2026-02-28 09:09，档案深读第九轮完结）

### TG三大必改配置（Lando ★★★★★ ❤️709/⭐1444，本archive最高）
```json
// ①实时流式发送（默认关闭！AI全程沉默→最后一次性发5条）
{"agents":{"defaults":{"blockStreamingDefault":"on","blockStreamingBreak":"text_end"}}}

// ②白名单群免@（只响应指定群，不用@）
{"channels":{"telegram":{"groups":{"*":{"requireMention":false}},
  "allowFrom":["-你的群ID"],"groupPolicy":"allowlist"}}}

// ③收到消息自动emoji确认（不知道收没收到→有反馈）
{"messages":{"ackReactionScope":"all"}}

修改方式: 直接编辑 ~/.openclaw/openclaw.json 或 openclaw gateway config.patch
TG Forum Topics = 每个topic独立对话 = 天然多线程（比私聊+多群更优雅）
```

### Antfarm: 一条命令7人AI团队（奥森木 ★★★★★ ❤️296/⭐690）
```bash
install github.com/snarktank/antfarm  # 发给OC安装

antfarm workflow run feature-dev "你的需求"  # 运行
antfarm workflow status  # 查进度
antfarm dashboard        # 实时看板

内置工作流: feature-dev | security-audit | bug-fix
7角色: Planner→Developer→Verifier→Tester→Reviewer→Integrator→Deployer

核心机制:
  确定性工作流（同步骤同顺序）
  Agent互相校验（独立Verifier，解决MAST 3.3）
  每步新context（Ralph Loop，防旧消息幻觉）
  失败不静默（自动重试→重试耗尽→升级）

技术栈: YAML+SQLite+Cron | 零依赖（无Docker/Redis/Kafka）
```

### 记忆升级方案（Yanlin ★★★ ❤️79）
```
选型指南:
  刚入门    → 原生三件套(MEMORY.md+memory/+memory_search)
  智能检索  → Mem0(pip install，YC孵化，vs OpenAI +26%准确率)
  生产级    → Zep(<200ms延迟，关系感知)
  AI自管理  → Letta/MemGPT(AI自己管记忆，能自我改进)
  深度定制  → OpenViking+qmd

"原生记忆是地基，外挂是上层建筑"
⚠️ Mem0数据来自自己benchmark，Zep/OpenViking描述偏宣传
```

### 姚顺雨Agent研究三大方向（叮叮是叮叮 ★★★★★ ❤️2103/⭐2496）
```
GPT vs BERT关键选择: BERT=选择能力; Agent需要"自由产生新动作的能力"
→ ReAct(Reason+Act) = LLM Agent里他最喜欢的工作

Agent三大未来方向:
  1. 长期记忆 — "化学家需要20年研究"的长期问题
  2. 内生奖励 — 婴儿好奇心模式，不依赖外部激励
  3. Multi-Agent — 对应"组织者"层，解决协作+规模化

"差的任务永远不可能学到好的东西" ← 姚顺雨定律

Agent历史三波: 符号主义(推理无泛化)→DeepRL(泛化无推理)→LLM Agent(推理+泛化)
```

### 四类记忆类型（姚顺雨CoALA，Alan AI ★★★★ ❤️3578/⭐4135）
```
Procedural（程序性）: 造剑方法学会后复用
Episodic（情景）: 斯坦福小镇记录朋友性格
Reflective（反思性）: 从经验提炼原则
Semantic: 语言模型本身=长期记忆（微调=内化知识）

"金鱼问题": 无长期记忆的Agent每次从零开始
我们的解法: JOURNAL.md=Episodic | MEMORY.md/insights.md=Semantic+Reflective
```

### MemSkill: 失败驱动的技能进化（XaiverZ ★★★★★ ❤️532/⭐868）
```
架构: Controller(RL技能选择)→Executor(LLM生成)→Designer(失败驱动进化)
Skill四部分标准格式:
  (1) Purpose: 技能目的
  (2) When to use: 适用场景
  (3) How to apply: 如何应用
  (4) Constraints: 约束限制

Designer = failure-driven hard-case buffer → 回看重复失败 → evolve skills
→ HEARTBEAT.md每条规则可用此格式文档化
MemSkill(记忆层) + SkillRL(动作层) = 互补，共同确认Skill Bank是正确抽象层次
```

### MAST多智能体失败论文（Berkeley，两帖互补）
```
核心引用: "好的MAS需要组织理解——由能力出众个体组成的组织，结构有缺陷也会灾难性失败"
HyperAgent例子: Navigator找到解法但不告诉Planner → 关键信息沿Agent边界丢失

评论共识:
  momo: "单人大量出错，但一群人类能把火箭送上天" ← 最有力反驳
  "先解决单Agent可靠性，再谈多Agent" ← 工程优先序建议 ← Amy应先优化heartbeat质量

"AI遇到的问题和人类组织遇到的问题一毛一样"
```
