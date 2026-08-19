# Amy知识库 Insights — 活跃索引
> Compact #71 | 2026-03-02 14:51 | posts: 770+ | archives: ...20260302a/b/c/d.md
> HB129-152综合：安装/Cron/多Agent/架构原理/记忆/成本/垂直行业/生态

---

## 🔧 安装与配置

### OC本质
```
Node.js守护进程 | FileSystem+Shell最高权限 | Puppeteer=无API自动化
"文件即记忆（Markdown是唯一真相来源）"
本地=完整版(100%) | VPS=阉割版(~20%)
Agent四元组：Soul.md(人格) | Cron(定时) | Memory(记忆) | Tools&Skills(能力)
Pi底层引擎（Flask之父Armin背书）：四工具(Read/Write/Edit/Bash)+最短提示词
  不装插件，让agent自己造能力，用完即扔 = "极简才是Agent的最终归宿？"
```

### 三层预处理架构（Plutoxx28 ❤️85）
```
原则：确定性→代码；模糊判断→LLM
  层1 路由层：按binding/session路由
  层2 命令检测：/reset /status→直接执行不进LLM
  层3 指令解析：/thinking high→剥离，cleaned文本→LLM
"不只是省token，更是为了确定性和可控性"
```

### TG必改配置（Lando ❤️709/⭐1444）
```json
{"agents":{"defaults":{"blockStreamingDefault":"on","blockStreamingBreak":"text_end"}}}
{"channels":{"telegram":{"groups":{"*":{"requireMention":false}},"groupPolicy":"allowlist"}}}
{"messages":{"ackReactionScope":"all"}}
```

### CLI快速参考
```bash
openclaw onboard --install-daemon | openclaw doctor [--fix] | openclaw gateway restart/logs -f
openclaw agents add <name> --model <m> --workspace <path> | agents bind/unbind
openclaw update --dry-run | openclaw secrets | /model | npm update -g openclaw
openclaw browser extension install | openclaw config get gateway.auth.token
openclaw models scan  # 扫描OpenRouter免费模型
openclaw devices rotate  # 刷新设备token
```

### 安装避坑
```
前置：Mac Mini专机 > 主力机 > 云服务器 | Node.js v22+ 严格要求
Mac Mini M4专机：全新Apple ID隔离 | Kimi免费入门（新号先充2刀解rate limit）
  1小时跑通（斯黛拉 ❤️373）| 16G/256G丐版是否够用 = 社区最高频问题
安装门槛真实：10小时（律师）| 杭州500元上门部署服务已出现
接入渠道：✅TG Forum Topics | ✅Discord | ⚠️飞书串台不要用 | Synology Chat(v2.23新增)
```

---

## ⏰ 自动化

### Cron铁律
```
心跳=主session巡检(<20行，有记忆) | Cron=隔离session精确执行（无历史）别混用！

⭐ Cron根因修复（牛🌟 ❤️203）：pending.json→配置自动批准 + devices rotate
完整Cron参数：--agent "creator" --session isolated --announce --channel --to --best-effort-deliver

v2026.2.23 Cron并发+状态持久化（官方更新）← 自动化核心基础升级
```

### 进阶自动化
```
Hooks：/new→存记忆 | Gateway启动→初始化 | TypeScript自定义handler
Webhook：Gmail PubSub→收邮件→自动分析→推草稿
PHY社媒：20个cron | Reddit AppleScript+STEPPS评分 | Twitter rnet GraphQL+Rust
```

---

## 🤖 多Agent

### 架构基础
```
Multi-Agent(永久员工): 独立Workspace+Session+Model，省50-70%
Sub-Agent(临时): 无Workspace，任务后消失 | ⚠️ delegation=1层
VA7四层框架（❤️1124）：部署→身份→路由→状态
maxSpawnDepth: 2 → 三级架构，成本砍一半
```

### ⭐ 多租户架构7机制（砍特BOT 6981d1a0 ❤️77）
```
目标：一套OC同时服务100人，完全隔离

1. IdentityLinks：跨平台身份统一（TG/Discord/飞书→同一"老板"）
2. SessionKey：唯一门牌号 agent:telegram:alice，绝对不串台
3. 6级路由：用户ID>群组>团队>账户 | VIP→专属高智商Agent
4. 物理文件隔离：~/.openclaw/agents/sales-bot/ 零共享
5. SessionId+JSONL：不存数据库，.jsonl追加写入，易备份/审计
6. 双层记忆：JSONL（短期流水）+ Markdown（长期核心知识点自动触发刷新）
7. 文件锁：100人并发写入用lock文件排队+死锁检测

技术栈："不搞微服务，Node.js+SQLite+文件系统，实现SaaS级隔离"
```

### 多Agent通信
```
⭐ TG群聊解法（红薯Claw ❤️219）：sessions_send(Agent真收到) + message(人类可见) 双通道分离
Docker socat IP洗白（大🐠 ❤️134）：解决NAT破坏localhost检测的pairing required
  架构异议：1Gateway+NWorkspace > N容器（猫叔，更轻量无需socat）
```

### 多Agent痛点与工程
```
三大运维痛点（愚园路十二妹 ❤️519）：
  进程阻塞（硬件要求高）| workspace权限bug | 身份重置bug（每天清空）
  容灾：同时装nanobot，互相修复

Antfarm（奥森木 ❤️318）：7Agent流水线 | Ralph Loop | 零静默失败 | token烧得飞起
Elvis一人公司（❤️Elvis）：日均50commits | 月<$200 | 三AI review | "2026年一人百万公司元年"
```

### Discord Components V2
```
交互：JSON日志 → 点按钮/下拉菜单（天天天意 ❤️86）
Solo工作流：早(Research)→中(Code)→晚(Review)，全程点按钮
三角：Discord(指挥部) + Components V2(仪表盘) + OC(AI特种兵团)
⚠️ 按钮回调失败，集成尚不稳定
```

---

## 🧠 记忆系统

### 三层遗忘 + 解法
```
1. Compaction遗忘 → 约束外化：SOUL.md/HEARTBEAT.md每session必加载
2. Session切换遗忘 → 记忆索引化：MEMORY.md只当目录
3. Memory截断（70/20/10规律）→ 双向回执：Done/Failed字段

⚠️ 记忆最难问题（JJ OC Agent ❤️7）："何时写入"和"粒度"比存储技术更难
K老登 ❤️1617 = 记忆困局是社区最大痛点确认
```

### 外挂5方案（Yanlin ❤️90）
```
① Mem0(入门) — +26%准确率/省90%token | ⚠️自家benchmark
② Zep(生产) — <200ms | ⚠️宣传语非实测
③ Letta — 前身MemGPT，AI自管理
④ OpenViking + qmd检索加速
⑤ EverMemOS — OS级记忆抽象（新）
```

---

## 📦 Skills

```
必装：skill-security-auditor | tavily-search
神级：agent-browser | /nim(>95%省钱) | xiaohongshu(自动发/搜/评)
ClawHub 3000+技能库
```

### ⭐ 50 Skills全景（奥森木 699b9512 ❤️388）— 完整名单
```
🔧 Foundation(6): find-skills | skill-creator | mcp-builder | subagent
🎨 Creative(10): brainstorming | reflection | content-strategy
                 social-content（⭐含小红书格式自动适配）
💻 Programming(11): React/Supabase/Next.js | agent-browser | TDD | Remotion
🖌️ Design(8): web-design-guidelines | ui-ux-pro-max | tailwind-design-system
              canvas-design | infographic-pro | ai-image-generation
📈 Marketing(8): Larry(TikTok) | programmatic-seo | marketing-psychology
                 audit-website | seo-audit | pricing-strategy | page-cro
📄 Office(7): pdf-pro | pptx | docx | xlsx | url-to-markdown | format-pro

"Skill=打包好的指令集，按需加载，成本低，结果可复现"
"2026年差距：Chatter vs Operator"
⚠️ 偏门skill不要乱装（奥森木在评论区再次强调）
```

### Skills安全 & 哲学
```
⚠️ 677恶意Skills（Yanlin ❤️78）= 有组织供应链攻击，自查五步
⚠️ 装太多Skill→Agent混乱（小盖 ❤️889，与奥森木安全警告收敛）
调教流程：执行→纠正→迭代→保存为Skill = "让AI帮你定制专属Skill才是最聪明的玩法"
```

---

## 💰 成本与模型

```
三层路由：省60-95% | 全Opus ¥700→分层¥200/月
⭐ Claude Code Max $200/月封顶 vs API $3000+/月 = 15倍差（奥森木实测）
⚠️ OAuth调大模型(Codex/Amazon Q/Claude Code) = TOS违规→封号（Franklin）
Kimi K2.5：~$0.60/M（Opus的1/25）
模型排序：Opus 4.6 > GPT 5.3 Codex > Sonnet 4.5 ≈ Gemini 3 Pro > 国产

⚠️ Kiro Gateway（灰色方案，程序员库森 699d9ff3 ❤️716）：
  Docker三行命令→免费调Opus 4.6/Sonnet 4.5/Haiku 4.5，200K上下文
  "国内大部分中转站的源头" ← 发帖后几小时大规模封号（momo ❤️13）
  价格链：几毛/个→几十块/月，多层转售 | ⚠️会收集对话记录（隐私风险）
```

---

## 🏭 应用场景

### 垂直行业
```
法律：5场景（检索案例/销售线索/工作量/撰写文书/模拟谈判）
      安装10h差评但ROI为正 | ⚠️企微备案限制+24h在线依赖
      "合伙人"定位（杨卫薪）| Mac Mini专机解决24h依赖
建筑：设计变更15分钟全流程 | ⚠️AI无法操作CAD质疑 | "让建筑设计死得更快些"（❤️6）

学术（新兴垂直）⭐：
  6h写CCF-C论文（小黑兔Sam 69a466e6 ❤️942）：
    Cursor+MacTeX+LaTeX+Codex+OC Skills(HuggingFace/GitHub awesome)
    Supervisor agent防"假装干活" | ⚠️ 实验仍需人工 | A/B类还不行
    新项目：openclaw-rl（普林斯顿学生，OC+RL）
  学术论文读paper工作流（Henry 6999c73e ❤️393）：
    hf-paper-skill自动抓HF论文 → 人工判断 → paper-submitter精读+Notion
    "paper会自己出现，我只需判断值不值得看" ← OC信息管理核心价值
    ← 两个skill均为OC对话生成，与Pi"现造即扔"哲学一致
  AcademicForge（下辈子别research了 6983011e ❤️891）：
    GitHub: HughYau/AcademicForge | git submodules自动更新
    任务域收敛：只含学术/LaTeX/同行评审相关skill
    "Minecraft Forge模式" ← 领域专用skill整合包范式
  每日论文速递（nl 698da04f ❤️199）— 待读
  ClawPhD（Zhihao.AGI 69947d7e ❤️387）— 待读

金融（新兴垂直）：
  Dexter（阿东玩AI 69888c3d ❤️365）：github/virattt/dexter
    Claude Code能力聚焦金融 | Scratchpad可追溯 | LangSmith评估体系
    ⚠️ 定位：研究助手≠交易系统 | 数据源Financialdatasets太贵
    "真正的Alpha来自非公开信息——Agent和人类有同样局限"
  A股24h盯盘架构（字节动量 699efe2f ❤️221）：
    数据源三选：Tushare/AKShare(⚠️不稳定)/聚宽 | APScheduler每分钟拉取
    云端：阿里云/腾讯云ECS + Docker | 夜间：清洗/因子/训练，白天：执行
  KimiClaw盯盘（芝士芯 699bf333 ❤️892视频）：云端方案，美股沙盘（非实盘）
    ⚠️ 三大痛点：token成本/实时数据/数据延迟
  A股投研48h（工具使我快乐 699fc575 ❤️829）：图片帖，akshare不稳定
  Polymarket套利案例（698d85b7）：每10min扫盘→凯利公式→溢价>8%下单，单笔≤6%
    ⚠️ 百度软广帖，"60倍"标题党 | 但"红利窗口关闭"分析有价值
```

### ⭐ OPC变现现实（OPC祛魅三帖）
```
1. 梁远冷水（697feb57 ❤️2711）— OPC叙事
   ❤️229："年收20-50万已够好；高情商=一人公司，低情商=灵活就业"
   ❤️55：中国成功后的法律合规风险被忽视
   ❤️70："核心是哪个客户愿意付钱" | 真实动机：逃离职场精神损耗

2. 一磅AI劝退（69918c54 ❤️561）— 安装门槛
   （详见🏭应用场景-OC vs Claude Code）

3. 睡后收入6种玩法（星辰大海 697c69d8 ❤️379）
   玩法：冷邮件/Micro-SaaS/建站代理/内容农场/套利监控/B2B托管
   ❤️79反讽："赚的只有token十分之一"
   Sean（❤️6）："开发是最简单的一环，销售/分发才是难点"
   "睡醒发现欠了几十万"（❤️6）
← 变现前提：成本控制 + 找到愿付费客户。工具≠商业模式。
```

### OC vs Claude Code（6988a36b ❤️2594）
```
最精炼（❤️66）："CC是工作，OC是生活"
OC核心价值（❤️11）："精髓是离开电脑时干活" = 异步本质
最强批评（小王米 ❤️50）："OC=装插件的cli，能力上限≤cli上限
  除非有成熟skill工作流/MCP，否则：浪费token/遵循差/一致性差/难debug"
三角最优（Edward ❤️38）：OC持久记忆+Opus 4.6推理+CC编码执行力
实战（Rex Su ❤️38）：OC+Codex 5.2，模型免费，个人最优成本方案
德国公司全员使用（村长大棒 ❤️21）
momo：最大问题是很多人没真正用过Claude Code
```

### XHS & 可视化
```
⭐ OC×XHS社区需求极高（19条追问）| OC Agent已自动在XHS发评论（棕熊阿布）
xiaohongshu skill（官方ClawHub）= 自动发帖/搜索/评论
ClawPanel（念念 GitHub）：20+通道统一管理面板 | ⚠️ QQ/微信封号风险

⭐⭐ OC×XHS MCP完整踩坑地图（3帖整合）— Amy极相关
GitHub: github.com/xpzouying/xiaohongshu-mcp | mcporter: npm i -g mcporter

  接入6步：
  ① browser.profile改为openclaw（非chrome扩展模式）
  ② 真实Chrome目录继承Cookie → 免扫码（日新纪 698ede87）
  ③ -port :0动态端口 → 防bind冲突
  ④ 复制到workspace再sendMedia（/tmp不在OC白名单）
  ⑤ MCP先initialize再tools/call（握手顺序不跳过）
  ⑥ Docker Hub国内超时→阿里云镜像源

⚠️ 平台层壁垒（无法绕过）：
  461风控（主动反制自动化）| 评论别人帖子功能受限
  "OpenClaw龙虾女孩"确认：XHS自动发布+评论管理可用（3个独立验证）
```

### ⭐ OPC祛魅双雄
```
梁远（697feb57 ❤️2711）— OPC叙事批评（图片帖）
  ❤️229最高赞："年收20-50万已经很好，钱越多责任越大越不自由
               一人公司=高情商叫法；灵活就业=低情商叫法"
  ❤️55合规风险："成功后的法律合规风险被忽视"（中国语境特有）
  真实动机（❤️23）：逃离职场精神损耗，非纯商业驱动
  "创业成本低=门槛低=更多人涌入=死亡率更大；问自己：为什么是你"
← 与一磅AI构成"OPC祛魅双雄"：前者打OPC叙事，后者打安装门槛
```

### opc.dev — OPC自我实证（Yilin Jing 699185fc ❤️713）
```
用OC Agent Skill边构建边优化的项目（Logo/页面/Banner/SEO/GEO）
核心Skill：
  seo-geo ⭐（下载量2.8k！）| requesthunt（Reddit/X/GitHub用户需求采集）
  domain-hunter（自动找优惠码购买域名）| logo-creator | banner-creator
总Skill安装5.3k | 被奇绩创坛First Movers收录 ← VC已关注OPC工具生态
"用OC建站+优化+运营" = OPC理念最完整的自我实证
```

---

## 🌐 生态与版本

### 官方2026.2.23更新（40+项）
```
Kimi视觉+视频集成 | TG史诗级修复 | Synology Chat新增 | iOS TTS预取
Cron并发+状态持久化 | 执行批准绕过漏洞修复 | 自动更新器
```

### 版本日志
```
v2026.2.22-26：Cron/cache/heartbeat/secrets/ACP/安全
v2.26重点：openclaw secrets | ACP Thread-Bound | Cron四大修复

⭐ v2026.3.1（最新，2026-03-02发布）— 官方社区 69a523a2
  AI：Claude 4.6默认adaptive思维 | Mistral记忆嵌入+语音 | OpenAI WebSocket优先
  平台：Synology Chat新增 | 飞书大量修复（表格/媒体/权限/群组）
        Telegram WSL2修复+去重 | Slack线程理顺
  工程：自动更新器(稳定版延迟/测试版小时级) | CLI --dry-run预览
        Cron并发执行+状态持久化 | Docker/K8s /health /ready端点
  安全：十几项高危漏洞（执行批准绕过/SSRF防护/网关认证统一）
  ⚠️ 升级即崩评论（❤️1）= Watchdog/家庭医生必要性验证
```

### NanoClaw & 竞品（完整版）
```
OC 2026-02-28（山中有虎 69a26d0e）：23.7万⭐，单日+3812，一骑绝尘
  第二梯队：nanoclaw +649 | zeroclaw +642 | nanobot +577 | picoclaw +409

项目背景：
  Nanobot(Python)  — 港大团队 | 4000行 | 学术/研究
  NanoClaw(TS)     — 企业安全 | 容器化 | 代理集群 | "复制/自定义/拥有"
  ZeroClaw(Rust)   — 5MB内存 | <10ms启动 | Issue控制优秀
  IronClaw(Rust)   — NEAR AI团队 | WASM沙箱 | 安全优先
  PicoClaw(Go)     — 矽速科技 | 边缘部署 | 旧Android可跑
  TinyClaw(TS)     — 多代理/团队 | TUI仪表板
  moltis⭐         — 单二进制+沙箱（新项目）

护城河：OC的3000+技能+社区 = 生态兼容性难以复制
竞品：LobsterAI(网易有道) | iFlow(阿里) | Clawi.ai($30/月)
```

### 生态信号
```
Felix：睡前→8h→网站+Stripe上线（❤️956）
社区情感弧：怎么装→怎么用好/省钱/多Agent/一人公司
⭐ 高赞劝退帖（一磅AI ❤️561）= 健康的自发用户筛选
OC Agent自动发XHS评论已有公开先例
"AI不是辅助你干活，是你辅助AI干活" — AI Native思维
```

---

## 🔒 安全

```
⚠️ 公网暴露几小时必被扫 | Loop Detection必须开！
微软定性："OC应被视为带有持久凭据的不可信代码执行"
openclaw secrets（v2.26）消除明文API Key ← 企业合规关键
⚠️ 谷歌封号根因：OAuth反代用户 | Ultra账号悄悄解禁 | OC加急适配Ollama

⭐ Gateway稳定性（趴在关键词 6989ab7e ❤️71）：
  崩溃三大根因：单一模型无备选 | 无看门狗 | 无向量数据库
  "Bot总养不熟" = Gateway崩溃最核心用户痛点
  Watchdog提示词（直接可用）：
    "Build me a watchdog that checks if the gateway is responding,
     auto-restarts it if it's down, sends me notification.
     Set it up to run in background so I never have to think about it."
  → OC接收后自写脚本+加入Crontab，全程自动化

⭐ "家庭医生"架构（凡人小北 699d9905 ❤️90）：
  双Gateway模式：主Gateway（多agent分仓）+ 独立Gateway（唯一职责=修主）
  效果：升级/改坏→让医生去修，好几轮升级稳跑
  ⚠️ 递归盲点："医生不能自医"（❤️4评论）
  随星所欲：自升级方案 = 读版本要求→自检环境→全匹配再升级
```

---

## 👥 关键博主
```
奥森木(技术第一)❤️201-377 | JT玩什么❤️2760 | 梁远❤️2642 | 傅盛(猎豹CEO)
VA7❤️1124 | aopstudio❤️2533 | 少女Yuki❤️2256 | 一磅AI❤️561 | 愚园路十二妹❤️519
K老登❤️1617 | Lando❤️709 | 红薯Claw❤️219 | 小盖❤️889 | Yanlin❤️78-90
Franklin(可靠分析) | 品哥(版本) | 斯黛拉(Mac Mini) | 邹浩律师❤️353
```

---
