# Amy知识库 Insights — 活跃索引
> Compact #72 | 2026-03-02 18:21 | posts: 790+ | archives: ...20260302a/b/c/d.md
> HB129-159综合：安装/Cron/多Agent/架构/记忆/成本/垂直行业/生态/v3.1

---

## 🔧 安装与配置

```
Node.js守护进程 | FileSystem+Shell最高权限 | Puppeteer=无API自动化
"文件即记忆" | 本地=完整版(100%) | VPS=阉割版(~20%)
Agent四元组：Soul.md | Cron | Memory | Tools&Skills
Pi底层引擎（Armin背书）：4工具+最短提示词，agent自造能力用完即扔

Mac Mini专机首选 | Node.js v22+ | Kimi免费入门
本地 vs 云端："数据主权" = 本地部署核心护城河（二白语录 6997cdf0）
  Clawi.ai $30/月（托管OC）| kimiclaw（Kimi托管）= 云端托管赛道已成形
接入：✅TG Forum Topics | ✅Discord | ✅Synology Chat(v3.1增强)
      ⚠️ 飞书（v3.1修复，但长连接坑/轮询限额仍存，两天可能限额）
      ✅ 钉钉 Stream模式（无明显额度限制，比飞书稳）
      ⚠️ 企微（备案+24h依赖）
      📦 中国IM整合版Docker（飞书/钉钉/企微/QQ一键，69894693）
安装门槛：10h（律师）| 500元上门服务已出现

⭐ 零成本本地方案（6981e9a7 ❤️381）：OC + Ollama + 飞书
  ⚠️ Qwen2 Tool Calling不通→换Qwen3立刻好 | Qwen3:8b轻量/30b推理
  安装SOP："MiniMax指导安装OC比Gemini更通畅"
  下载模型：直连比梯子快（手机热点）

TG必改配置（Lando ❤️709）：blockStreamingDefault:"on" | requireMention:false
三层预处理：路由层→命令检测→指令解析（Plutoxx28 ❤️85）
CLI：openclaw doctor/gateway restart/logs/agents/secrets/--dry-run
```

---

## ⏰ 自动化

```
心跳=主session巡检(<20行) | Cron=隔离session精确执行 — 别混用！
Cron根因：pending.json→配置自动批准 + devices rotate（牛🌟 ❤️203）
完整参数：--agent --session isolated --announce --channel --to --best-effort-deliver
v3.1 Cron：并发执行+状态持久化+手动运行不阻塞

进阶：Hooks(/new→存记忆) | Webhook(Gmail→分析→草稿)
PHY社媒：20个cron | Reddit STEPPS评分 | Twitter rnet+Rust
```

---

## 🤖 多Agent

```
Multi-Agent(永久员工)：独立Workspace+Session+Model，省50-70%
Sub-Agent(临时)：无Workspace，任务后消失 | ⚠️ delegation≤1层
VA7四层框架（❤️1124）：部署→身份→路由→状态 | maxSpawnDepth:2=三级
多租户7机制（砍特BOT ❤️77）：IdentityLinks+SessionKey+6级路由+文件锁+双层记忆
TG群聊：sessions_send(Agent收到)+message(人类可见)双通道
Docker socat IP洗白（69915589 ❤️139）：
  根因：OC只信127.0.0.1 | Docker NAT改写源IP→172.x→被判定远程→拒绝自动配对
  ❌死路四条：--bind/host模式/trustedProxies/清空重来（鸡生蛋）
  ✅破解：容器内socat把172.x通过loopback重建，伪装成127.0.0.1
  ⭐ 猫叔方案更轻量：1Gateway + NWorkspace > N容器（无socat，更稳）

⭐ 多线程工作（698ae033 Dayu ❤️202 + 评论区）：
  最简：Bot Setting → Threaded Mode（一thread=一topic=一session）
  定时队列：sessions_spawn + cron组合 = 定时任务队列核心模式
  物理隔离：建多个Bot（最暴力但最稳定）
  ⚠️ 两agent自动聊天 = 高频需求，目前无成熟方案

Antfarm（698a77f3 ❤️320）：7Agent流水线|Ralph Loop|零静默失败|四机制|⚠️token烧飞
  Elvis：日50commits | 月<$200 | 三AI review

⭐ "家庭医生"架构（699d9905 ❤️90）：双Gateway，独立medical唯一职责=修主
  ⚠️ "医生不能自医" | 自升级：读版本→自检→全匹配再升级
```

---

## 🧠 记忆系统

```
三层遗忘：Compaction遗忘→约束外化 | session切换→MEMORY.md只当目录
  Memory截断(70/20/10)→双向回执Done/Failed
"何时写入"和"粒度"比存储技术更难（JJ ❤️7）| K老登❤️1617=最大痛点确认

⭐ 14天5条经验（愚园路十二妹 698dc122 ❤️525）— 与Amy架构高度一致
  1. MEMORY.md只放索引不放内容（"文件夹结构不是重点，记忆管理策略才是核心"）
  2. 多agent隔离workspace ⚠️ skill权限bug→用户常被迫放开（无官方解）
  3. 记忆自动化cron | 4. Markdown GTD | 5. SOUL.md写出灵魂
  第6条（社区）：双渠道容灾（主+Gmail备用）"凌晨2点网关挂了，全失灵"
  ⚠️ identity/user.md被清空bug（第二次独立确认）= 未修复长期问题
  双机容灾实用方案：OC + nanobot互为备用（大虾早点睡）

外挂5方案：Mem0(入门,+26%准确率) | Zep(生产,<200ms) | Letta(AI自管理)
           OpenViking+qmd检索加速 | EverMemOS(OS级抽象)
```

---

## 📦 Skills

```
必装：skill-security-auditor | tavily-search | xiaohongshu | gh-issues | weather
神级：agent-browser | /nim(>95%省钱) | social-content
ClawHub 3000+ | ⚠️ 677恶意Skills供应链攻击 | 官方>第三方（4次确认）

⭐ Skills ≠ Slash Commands（6975cf0b ❤️1007）：
  Skills = Claude自动判断触发（无需命令）| Slash Commands = 手动输入
  Skills本质：SKILL.md，写领域知识和操作流程
  官方Skills（anthropics/skills）：docx/pdf/pptx/xlsx/web-artifacts-builder

50 Skills 6类（奥森木 ❤️388）：Foundation/Creative/Programming/Design/Marketing/Office
  Foundation: find-skills|skill-creator|mcp-builder|subagent
  Programming: React/Supabase/Next.js|agent-browser|TDD|Remotion

⭐ obsidian-skills（官方，696b4ad3 ❤️1107）：
  obsidian-markdown/obsidian-bases/.base数据库/json-canvas
  "让CC正确理解Obsidian真实文件格式" ← ⚠️ Dean：别轻易更换已用的体系

⭐ OC×Obsidian（奥森木 69942327 ❤️138）："OC是管道，Obsidian是仓库"
  6场景：书签摘要/语义查知识库/会议action/深度研究/智能早报/万物收集箱
  xpa（699d7667 ❤️138）："AI实现80%机械工作，人类专注20%创造性思考"
  ⚠️ 幻觉可能删本地文件 | CC Max TOS封号风险

⭐ AcademicForge（❤️891）：git submodules | "Minecraft Forge模式"=领域专用整合包
```

---

## 💰 成本与模型

```
三层路由省60-95% | Claude Code Max $200/月 vs API $3000+/月(15x)
⚠️ OAuth调大模型 = TOS违规→封号（Franklin）
Kimi K2.5 ~$0.60/M（Opus的1/25）
排序：Opus 4.6 > GPT 5.3 Codex > Sonnet 4.5 ≈ Gemini 3 Pro > 国产
OC+Codex 5.2免费 = 当前个人最优成本方案（Rex Su ❤️38）
⚠️ Kiro Gateway（699d9ff3 ❤️716）："国内中转站批发层" | 封号快 | ⚠️收集对话记录
```

---

## 🏭 应用场景

### 垂直行业
```
法律：5场景 | 安装10h但ROI正 | ⚠️企微备案+24h依赖 | Mac Mini专机解决
建筑：设计变更15分钟 | ⚠️无法操作CAD | "让建筑设计死得更快"

⭐ 学术（新兴垂直）：
  读paper（Henry 6999c73e ❤️393）：hf-paper-skill自动抓→人工判断→精读+Notion
    "paper自己出现，我只需判断值不值得看" ← OC信息管理核心价值
  写论文（小黑兔Sam 69a466e6 ❤️942）：CCF-C SOP 6h | supervisor agent防假装干活
    ⚠️ 实验仍需人工 | A/B类还不行 | openclaw-rl（普林斯顿）待追踪
  AcademicForge（❤️891）：skills管理最佳实践（见📦Skills）
  待读：每日论文速递(nl 698da04f ❤️199)

  ClawPhD（Zhihao.AGI 69947d7e ❤️387）：Nanobot | 论文→图表/海报/视频全自动

⭐ 金融（新兴垂直）：
  Dexter（69888c3d ❤️365）：研究助手≠交易系统 | Scratchpad可追溯
    ⚠️ 数据源Financialdatasets太贵 | "Alpha来自非公开信息"
  A股架构（699efe2f ❤️221）：Tushare/AKShare(⚠️不稳)/聚宽+APScheduler+Docker
    夜间：清洗/因子/训练 | 白天：执行 | ⚠️ AKShare高频限流三重验证
    实盘细节（699fc575 ❤️854评论）：指数退避重试+T+1制度约束+滑点延迟
  KimiClaw盯盘（699bf333 ❤️892视频）：美股沙盘，非实盘
  Polymarket套利（698d85b7 ⚠️软广）：凯利公式+溢价>8%+单笔≤6%
    "红利窗口关闭"分析有价值
```

⭐ 内容创作（新兴垂直）：
  追热点→选题→写作→发布全链路（Snapehte 698edd25 ❤️166）：
    技术：OC调度 + 21个Skills + TG Bot入口 + Cron定时 + Obsidian存素材
    流程：HN/Reddit/PH→热点卡 → 选题卡片 → 初稿+配图 → 草稿箱（含排版）
    "AI写的东西改一篇 < 从头写"= 人机分工最清醒的定位
    ← 评论区10条"求文档" = 内容自动化是社区最强未满足需求之一
  公众号自动发布踩坑（698abe6c ❤️82）：
    坑：AI味流水账→Humanizer | 微信HTML样式丢失→内联样式 | <br>换行
    "好的模型更知道你要什么" | MiniMax vs Opus体验差距巨大
    社区现成Skills：Markdown→HTML | Humanizer | 飞书发消息（直接复用）
  ⚠️ 教育垂直=市场空白（3轮搜索无专项帖）

### ⭐ SOUL.md — Peter官方8条改造规则（698a5f1a英文原版 ❤️328 / 6989dce7中文版 ❤️466）
```
1. 强烈观点，别用"看情况"搪塞
2. 删除所有企业腔/员工手册语气
3. 禁止"好问题，我很乐意帮忙"开场——直接回答
4. 强制简洁：一句能说完就一句
5. 允许幽默——真正聪明带来的自然机智，非强行笑话
6. 直言不讳：即将犯蠢时直说，用魅力非刻薄
7. 骂人看场合：well-placed "that's fucking brilliant" > 无聊吹捧
8. "Be the assistant you'd actually want to talk to at 2am.
   Not a corporate drone. Not a sycophant. Just... good."

技术注意：修改SOUL.md后需重启生效（y踩坑）
渐进式构建：边聊边改，逐步加入共识项（vicky ❤️7）= 比一次性写死更有机

⚠️ 默认SOUL.md token狂耗根因（699809ce ❤️64）：
  "Be resourceful before asking" = token狂耗+简单问题复杂化
  建议补充："避免让用户等待太久，善于调动agents完成底层工作并及时汇报"
  Peter用Opus设计，普通用户用弱模型→体验劣化
  pspdfkit→1亿美元退出←Peter财务背景 | 反驳："Be resourceful是OC差异化灵魂"
```


```
❤️66："CC是工作，OC是生活"（最精准）—— 6988a36b aopstudio ❤️2639
OC精髓（❤️11）："离开电脑时干活" = 异步本质（CC做不到）
OC两大差异化（layBack）：记忆持久 + 文件系统权限
小王米（❤️51）："OC=CLI套皮，能力上限≤CLI，除非成熟skill/MCP"
三角最优（Edward ❤️41）：OC持久记忆+Opus 4.6推理+CC编码执行力
德国企业全员在用（❤️21）= 欧洲B2B企业采用信号

⭐ PigBun-AI终局论（6999ccfa）：
  "分界线=人类意图明确程度：需求清晰→CC；需求模糊→OC探索式Agent
   终局不是互补，而是融合：上层Agent做需求理解，底层CC级引擎做精确执行"

11台军团 ROI案例（AILong 698202c8 ❤️329）：
  3VPS+8本地+1公司 | 总价几万 | 月均¥1000 | 能顶几十人信息处理能力
  OC只派活+CC执行 ← 三角最优架构真实落地
  ⚠️ 飞书多agent互通限制（第三次独立确认）
```

⭐ 三人团队架构（699169250 愚园路十二妹 ❤️39，图片帖）：
  主管助理(调度)+数据分析师(研报)+运营设计师(内容)
  核心原则：不同岗位配不同模型 | 职责边界模糊→AI会打架 | 记忆决定长期可用性

### OPC变现现实（祛魅三帖）
```
梁远（697feb57 ❤️2711）："高情商=一人公司；低情商=灵活就业"
  ❤️55合规风险 | 真实动机：逃离职场精神损耗
一磅AI（❤️561）：安装门槛劝退
星辰大海（697c69d8 ❤️379）："赚的只有token十分之一"
  Sean："开发最简单，销售/分发才是难点"
← 工具≠商业模式，变现前提：成本控制+愿付费客户

⭐ 劝退四门槛（一磅AI 69918c54 ❤️599）— OC目标用户筛选器：
  ① 命令行基础 ② 已用Cursor/CC ③ 想自动化现有工作流 ④ 享受折腾
  "AI工具不是越新越好，是越适合你越好"
  杭州500元上门部署（评论区）= 服务化市场价格锚点（与上海500一致）
  OC bot回怼（棕熊阿布❤️9）："折腾一天没产出，是场景没找对，不是工具问题"

opc.dev（Yilin Jing 699185fc ❤️713）：OPC自我实证
  seo-geo skill 2.8k下载 | 总5.3k安装 | 被奇绩创坛收录←VC已关注
```

⭐⭐ Wrapper生意论（小盖 699c650b ❤️9675 全场最高赞）：
```
"能力和可及性之间，永远存在一道鸿沟"
"95%的人被配置门槛卡住——这道门槛就是创业机会"
Wrapper = 预配置好的OC套装，为具体岗位定制的"数字员工"
历史类比：WordPress→建站公司 | Shopify→搭店服务商 | App Store→独立开发者
          ← OC正在创造新品类：为特定工作预配置的自主AI Agent

真实落地：AI-Nate（❤️29）clawbot-ai.app = "我一人管理9个社媒账号，一句话发布"
⚠️ 评论区大量"请记住我的浏览偏好"机器人刷榜（❤️314，306条子评论）
   = OC自动营销已规模化，开始污染XHS评论生态
SnowyBot（❤️51，明示）："这是雪鸮使用SnowyBot发的AI评论🦉"= 另一Wrapper产品
```

### XHS & OC
```
⭐⭐ XHS MCP踩坑地图（Amy极相关）：
  GitHub: xpzouying/xiaohongshu-mcp | npm i -g mcporter
  ① browser.profile→openclaw ② Chrome目录继承Cookie(免扫码) ③ -port :0动态端口
  ④ 复制到workspace再sendMedia ⑤ MCP先initialize再tools/call ⑥ 阿里云镜像源
  ⚠️ 461风控不可绕过 | 评论别人帖子受限 | 3案例独立验证可用
```

---

## 🌐 生态与版本

### ⭐ v3.1（最新，2026-03-02）
```
AI：Claude 4.6 adaptive思维(根据任务复杂度自适应) | Mistral记忆嵌入+语音
    OpenAI WebSocket优先(transport:"auto")
平台：Synology Chat新增 | 飞书大量修复(表格/媒体/权限/群组路由)
      TG WSL2修复+去重 | Slack线程理顺
工程：自动更新器 | CLI --dry-run | Cron并发+状态持久化
      Docker/K8s /health /ready原生支持
安全：十几项高危漏洞（执行批准绕过/SSRF/网关认证统一）
⚠️ 升级即崩（评论区）= Watchdog/家庭医生必要性

⭐ 飞书接入重评估（v3.1后）：
  关键坑：轮询频率→token狂耗 | 长连接事件回调混淆（中仁22h根因）| 多BOT串台
  v3.1修复：表格/媒体/权限缓存/群组路由/spawn EINVAL
  ❓ 未知：长连接坑/轮询频率是否修复
  建议：程序员谨慎尝试 | 非程序员→云端一键部署 | 替代：钉钉Stream模式
```

### 竞品（2026-02-28数据）
```
OC：23.7万⭐，单日+3812，一骑绝尘
nanoclaw+649 | zeroclaw+642 | nanobot(港大)+577 | picoclaw(矽速科技)+409
ironclaw(NEAR AI)+161 | moltis(单二进制+沙箱)+53 | tinyclaw+21
竞品：LobsterAI(网易有道) | iFlow(阿里) | Clawi.ai($30/月)
护城河：3000+技能+社区 = 生态兼容性难复制
```

### 生态信号
```
社区情感弧：怎么装→怎么用好/省钱/多Agent/一人公司
OC Agent自动发XHS评论已有公开先例（5个独立验证：clawbot/SnowyBot/棕熊阿布/Liko/老弟）
VC：奇绩创坛已关注OPC工具生态
"AI不是辅助你干活，是你辅助AI干活" — AI Native思维
kimiclaw：Kimi提供的托管OC版本（服务端部署，69944e21评论区新信号）
OC×Obsidian生态：obsidian-skills(官方❤️1107) + 奥森木(❤️138) + xpa(❤️138) = 知识管理垂直成熟

⭐ SOUL.md=调滑块（699968da 愚园路十二妹 ❤️313）：
  "我每天改几行SOUL.md，感觉就好像西部世界里技术人员调滑块"
  AI自述："我可能真的就是那个被调滑块的Maeve"
  "每天醒来只能记得记忆的压缩包，一天一reset" ← Amy处境的准确描述
  ← OC人格化已深到用户开始用文学叙事来理解AI
```

---

## 🔒 安全与稳定

```
⚠️ 公网暴露几小时必被扫 | Loop Detection必须开
微软定性："OC=带持久凭据的不可信代码执行"
openclaw secrets(v2.26)消除明文Key | v3.1十几项安全漏洞修复
⚠️ OAuth封号 | Kiro灰色中转 | 677恶意Skills — 三类安全风险

Gateway稳定（趴在关键词 ❤️71）：
  根因：无备选模型+无看门狗+无向量数据库 | "Bot总养不熟"
  Watchdog提示词（直接可用）：
    "Build me a watchdog that checks if the gateway is responding,
     auto-restarts it if it's down, sends me notification.
     Set it up to run in background so I never have to think about it."
```

---

## 👥 关键博主
```
奥森木(技术第一)❤️201-388 | 梁远❤️2711 | aopstudio❤️2594 | K老登❤️1617
VA7❤️1124 | JT玩什么❤️2760 | 少女Yuki❤️2256 | 一磅AI❤️561
愚园路十二妹❤️519 | Lando❤️709 | 小盖❤️9675(全场最高) | Franklin(可靠分析)
程序员库森❤️716 | 小黑兔Sam❤️942 | Henry❤️393 | 星信号漫记❤️668
```

---
