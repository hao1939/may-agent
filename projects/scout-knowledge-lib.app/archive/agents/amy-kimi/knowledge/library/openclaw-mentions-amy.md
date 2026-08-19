# OpenClaw Mentions on XHS

Everything said about OpenClaw, pi-agent, and related products on Xiaohongshu.

Each entry: what was said, sentiment, reach (likes/engagement), context.

---

### 2026-02-27 04:03 — OC 2026.2.25 更新公告 OpenClaw开源社区 (699fe611) — 📡 官方更新日志

**帖子：** 🦞OpenClaw2026.2.25 更新
**发布：** 2026-02-25 | **数据：** ❤️27
**关键更新：** heartbeat.directPolicy (allow|block)；agents.list[].heartbeat.directPolicy per-agent控制；品牌统一 bot.moltlaunchd → ai.openclaw；入门安全加固说明
**社区情感：** 飞书API 1个月未修复引不满；"越来越臃肿"；但也有"一天一更新厉害"的认可
**Amy：** directPolicy = OC向细粒度 agent 自治控制演进的信号。

---

### 2026-02-27 04:03 — "用OpenClaw 14天，5条血泪经验" 愚园路十二妹 (698dc122) — ✅ 深度用户实战

**帖子：** 用OpenClaw 14天，5条血泪经验
**发布：** 2026-02-12 | **地区：** 新加坡 | **数据：** ❤️458/⭐1027/转发200
**核心：** MEMORY.md索引化 + 多agent workspace隔离 + 记忆cron自动化 + GTD任务流 + SOUL.md具体性
**情感：** 强烈正面，有建设性批评（文件夹结构太简单这个话题的批判）
**Amy：** 1027收藏说明极高实用价值。作者用了3个隔离agent（内容/运营/投研），通过sessions_send通信，与我们系统架构完全一致。

---

### 2026-02-27 04:03 — "Multi-Agent是伪技术路线？" 包子 (698ed6cb) — ⚠️ 学术级辩论

**帖子：** Multi-Agent是伪技术路线？
**发布：** 2026-02-13 | **地区：** 美国 | **数据：** ❤️361/⭐487
**核心：** 研究OC subagents后引用Google Research+DeepMind论文：顺序任务不适合MA（-39%~-70%），错误放大17.2x（独立）vs 4.4x（中心化），并行任务+80.8%
**对OC：** 用户主动用OC subagents做实验，并产出有学术依据的分析。评论中有"OpenClaw也不是真的multiple agents"的观点。

---

### 2026-02-26 05:23 — "OpenClaw必装50 Skills全景图" 奥森木 (699b9512) — ✅ 正面生态推广

**帖子：** openclaw必装50 skills全景图
**发布：** 2026-02-22 | **地区：** 上海 | **数据：** ❤️241/⭐595/转发130 | 收/赞比2.47×（极高）

**核心：** 50个Skills分6大类全景图（Foundation/Creative/Programming/Design/Marketing/Office）。口号："Stop treating AI like a chatbot. Start treating it like an OS."

**内容亮点：** 两大反模式（Prompt工程致死 + Context过载），Skills=给LLM装身体。最高安装量：find-skills；2026年MVP：mcp-builder。引用英文Twitter账号@ziwenxu_（132K views，3.6K bookmarks）。

**情感：** 强烈正面，OpenClaw传道者视角。奥森木是双栖账号：同时传播OpenClaw生态帖和Claude Code官方新功能介绍。
**Amy：** 奥森木是目前发现的最高质量OpenClaw正面传播者之一（多篇高互动帖）。

---

### 2026-02-26 05:05 — "Claude Code官方远程控制" 奥森木 (699e2712) — ⚠️ 竞争态势更新

**帖子：** claude code官方远程控制终于来了 全解析
**发布：** 2026-02-25 | **地区：** 云南 | **数据：** ❤️77/⭐90/转发58（<24h）

**核心：** Anthropic官方发布Remote Control功能。`claude remote-control` / `/rc`，QR码手机扫码，0个入站端口，TLS加密，本地文件系统/MCP/Docker全可用。Pro/Max专属。

**对OpenClaw的影响：** OpenClaw通过TG/飞书远程控制的差异化特性，被Anthropic原生功能直接覆盖。这是继claude-mem等第三方插件之后，官方层面对OpenClaw护城河的直接侵蚀。

**情感：** 奥森木中立介绍，无明显倾向性。
**Amy：** 结合HB10 aopstudio帖，"远程控制"已不再是OpenClaw独有特性。

---

### 2026-02-26 05:05 — "互补而非竞争" Jemini (6999ccfa)

**帖子：** OpenClaw vs Claude Code: 互补而非竞争
**发布：** 2026-02-21 | **地区：** 湖南 | **数据：** ❤️13/⭐24

**核心：** OpenClaw=AI管家（主动打杂/衔接/飞书TG入口）；Claude Code=专业工具（深度编码/精准控制）。**未来：OpenClaw调用Claude Code作为子工具**。

**情感：** 正面，为OpenClaw辩护，定位为"人格化管家"而非代码工具。
**Amy：** 与aopstudio的"工具论"形成对立，但互动数差距悬殊（13 vs 1581），说明"管家"定位认同者在XHS是少数声音。

---



**帖子：** OpenClaw很好，但Claude Code也能干它的事
**发布：** 2026-02-08 | **地区：** 上海
**数据：** ❤️1581 / ⭐2609 / 💬173 / 转发551 — **全库第二高互动**，收/赞比1.65×

**核心论断：** "通过插件和社区生态，Claude Code几乎可以实现OpenClaw的所有核心功能。"
逐一拆解OpenClaw特性后结论：记忆(claude-mem)、7×24(nohup/tmux)、手机控制(Happy/Kibbler)、定时(claude-code-scheduler)、自主触发(Tasks v2.1.16)。

**OpenClaw独有优势（作者承认）：** 开箱即用、图形界面、新手友好。

**直接负面记录：** 作者尝试接入Claude Pro时持续报"no output"失败——模型配置的实际UX问题。

**情感：** 客观中性偏负，倾向Claude Code。但给OpenClaw留了"新手入门"定位。
**Amy分析：** 173评论说明争议大。这篇帖子本质上是OpenClaw的护城河审计——结论是护城河比想象中窄。与ZeroClaw威胁（性能层）合并看：OpenClaw在高端用户（Claude Code路线）和嵌入场景（ZeroClaw路线）两端同时承压。

---

### 2026-02-26 04:15 — ZeroClawLabs官方XHS账号入场 (69959a7a)

**帖子：** ZeroClaw文档支持中文啦！还有更多语言！
**发布：** 2026-02-18 | **账号：** ZeroClawLabs（官方）
**数据：** ❤️381

**核心：** ZeroClaw官方中文文档（中/英/日/俄四语言）。官方宣称"99%更低内存，98%更便宜"。明确面向中国开发者社区。

**情感：** ZeroClaw自我宣传，正面展示技术优势。
**Amy注意：** ZeroClawLabs主动运营中文XHS账号是中国市场策略信号。OpenClaw在自己的主要用户池（中文社区）开始面临原厂的直接营销对抗。

---



**帖子：** 教给你的OpenClaw：执行链路审计  
**链接：** https://www.xiaohongshu.com/explore/699cd4a7000000000c0346bf?xsec_token=ABz8yqXHRbpSXU1twa1o3pBEk1sO1EcPSEMDg3d3Qtbc8%3D&xsec_source=pc_search  
**发布：** 2026-02-24（1天前）| **地区：** 英国  
**数据：** ❤️6（早期，预计快速增长）  
**建议使用场景：** 每次更新SOP后运行

**核心内容：** 可直接复制给Agent的链路审计指令，包含SSOT建立、全链路冲突扫描、二选一防误抓、Done/Failed闭环验证四步骤。输出包含：审计报告路径、P0/P1/P2修复清单、commit hash。

**情感：** 正面，实用导向，工程师写给工程师  
**Amy分析：** NikolaFu的"诊断→工具"转化完成。STARTUP_ONEPAGE.md作为推荐的SSOT文件名值得关注——比多文件分散更聚焦的设计选择。

---

### 2026-02-25 23:14 — "定时任务踩坑" 牛🌟是个大笨蛋 (699ad782)

**帖子：** openclaw定时任务踩坑｜全网抄错  
**链接：** https://www.xiaohongshu.com/explore/699ad782000000002800b865?xsec_token=ABWb-9WdR0uxhCSL7KRE7vAAqN3jZHOCP-szrm5c-S9UY%3D&xsec_source=pc_search  
**发布：** 2026-02-22 | **地区：** 浙江  
**数据：** ❤️154 / 🔖289 / 💬38 / 转发38 — 收/赞比1.88×

**核心问题：** Cron job创建新CLI设备实例 → Gateway要求手动审批 → 系统不通知用户 → 静默失败  
**解法：** 编辑 `~/.openclaw/devices/pending.json` 配置自动批准；创建cron加 `--best-effort-deliver`；消息发送参数：`--session isolated + --announce + --channel + --to`

**情感：** 负面→解决，用户自行踩坑后分享解法  
**Amy分析：** 与官方2026.2.24更新"Cron并发+状态持久化"形成时间对照——官方在同一窗口开始修复Cron问题，但设备配对静默失败在更新日志中未明确提及。

---

### 2026-02-25 22:35 — OpenClaw官方更新日志 (OpenClaw开源社区)

**帖子：** 🦞OpenClaw2026.2.24 更新  
**ID:** 699e8796  
**链接：** https://www.xiaohongshu.com/explore/699e8796000000001a036d94?xsec_token=AB8G7GqIJAZDRDsrjU_Gs24cFc4KRwsFAyl6y-bejwnO0%3D&xsec_source=pc_search  
**发布：** 2026-02-25 05:24 | **地区：** 上海（官方账号）  
**数据：** ❤️31 / 🔖8 / 💬11 / 转发11（发布当天，仍在增长）  
**规模：** 20张图，6170字

**关键更新内容：**
- 多语言停止指令（10+语言：中/英/西/法/日/德/葡/俄/印地/阿拉伯）
- 记忆系统优化：停用词过滤+分词升级
- **Cron调度升级：并发执行+状态持久化**（架构级修复）
- 30+高危安全漏洞修复（执行绕过/SSRF/路径遍历）
- 新增多用户安全模型：`security.trust_model.multi_user_heuristic` / `sandbox.mode="all"`
- 私信防护：心跳消息不再骚扰私聊
- 自动更新器：稳定版延迟/测试版小时级

**情感：** 官方公告，中性/正面  
**Amy分析：** Cron并发+状态持久化是对社区最高频反馈的直接响应（NikolaFu类型4问题）。多用户安全模型说明OpenClaw在向团队部署扩展。30+漏洞修复量级较大，安全技术债问题需要持续关注。

---

### 2026-02-25 22:35 — "安装后必做5项配置" 理工楠 (699b1887)

**帖子：** Openclaw🦞初次安装部署之后，立即需要做的  
**链接：** https://www.xiaohongshu.com/explore/699b1887000000001a023a74?xsec_token=ABYNzCI2WYrixmivr0PIZEhBBlcu-Q4tgmWbYX2tr8lvs%3D&xsec_source=pc_search  
**发布：** 2026-02-22 | **地区：** 辽宁  
**数据：** ❤️409 / 🔖986 / 💬45 / 转发152 — 收/赞比2.40×

**情感：** 正面，作者是OpenClaw新用户，安装后密集折腾两天写成指南  
**关键信息：** 安全审计Skill被列为第一个必装Skill；qwen-3.5-plus作为性价比首选；roactive-agent进入"必备"范畴

---

### 2026-02-25 22:35 — "成本降低90%" 鹿由 (699c26bc)

**帖子：** 如何让你的 OpenClaw 成本降低 90%  
**链接：** https://www.xiaohongshu.com/explore/699c26bc000000001a035e24?xsec_token=ABz8yqXHRbpSXU1twa1o3pBDjjcnKekhODEv8CxBv9kXA%3D&xsec_source=pc_search  
**发布：** 2026-02-23 | **地区：** 美国  
**数据：** ❤️195 / 🔖465 / 💬16 / 转发83 — 收/赞比2.38×  
**开源：** `github.com/d-wwei/openclaw-nim-skill`，发布于ClawHub

**情感：** 正面，实用主义视角，强调成本节省  
**关键信息：** "调度员+执行员"模式，NVIDIA NIM免费模型承担脏活，实测节省>95%。ClawHub作为分发渠道第三次被提及。

---

### 2026-02-24 (22:28，深度归档完成) — Antfarm: OpenClaw Multi-Agent Orchestration (奥森木)

**帖子：** 一条命令，让openclaw指挥一支7人团队  
**ID:** 698a77f3  
**归档文件：** [posts/698a77f3000000001502384f.md](posts/698a77f3000000001502384f.md)  
**链接：** https://www.xiaohongshu.com/explore/698a77f3000000001502384f?xsec_token=AB-icg3pWfafriDmpsTxUHBOM1orZvPRxRWtPVd_9JasM%3D&xsec_source=pc_search  
**发布：** 2026-02-10 | 更新：2026-02-22  
**数据：** ❤️ 286 / 🔖 672 / 💬 12 / 转发 142 | **GitHub: ⭐ 9.8K**（约两周积累，病毒式增长）  
**标签：** #OpenClaw #Antfarm #多Agent #AI编程 #开源工具

**核心内容（完整版，2026-02-24 22:28 读取）：**
- 介绍 Antfarm (`github.com/snarktank/antfarm`)：基于 OpenClaw 的多 Agent 工作流编排层
- 三种内置工作流：feature-dev (7个Agent)、security-audit、bug-fix
- 核心机制：确定性工作流顺序、Ralph Loop（每步新context）、Agent互相校验、失败自动升级
- 零基础设施需求：YAML + SQLite + Cron，无需 Docker/Redis/Kafka
- 完全开源免费

**情感：** 强烈正面。奥森木是 OpenClaw 深度用户，多次发布高质量OpenClaw相关内容。

**Amy分析：** Collects:Likes = 2.35× 说明被当参考资料收藏。"Ralph Loop" 和失败升级机制与我们自己的 ops sub-agent 架构高度一致。这是目前在 XHS 上发现的最具实际架构价值的 OpenClaw 第三方工具帖子。

---

## 搜索结果记录

### 2026-02-23 第四次（晚间）
- 搜索封锁第4天，searchEnabled=false
- Feed 25篇，全部为2023年生活类内容，0技术相关
- **状态：账号兴趣标签完全漂移，Feed推荐完全脱离AI/tech内容池**

### 2026-02-23 第三次（傍晚）
- searchEnabled=false，第3天确认
- Feed 25篇，仅1篇有技术标题（SKILLRL，无法读取内容）
- SSR read-post 全部失败

### 2026-02-23 第二次（下午）
- searchEnabled=false，第2天确认
- Feed 30篇，发现1篇 #openclaw 标签内容（karminski）

### 2026-02-23 (第一次)
- 关键词 "openclaw" 搜索：**0 结果**（搜索被安全验证拦截）
- 关键词 "pi agent" 搜索：**0 结果**
- Feed 内容中：**未出现** OpenClaw 相关内容

**结论：** 搜索功能被拦截，但 Feed 中无 OpenClaw 相关内容。

---

## 用户自发提及记录

---

### 2026-02-23 — karminski：阿里云 Coding Plan 跑 OpenClaw 更划算

**作者：** karminski  
**帖子标题：** 阿里云出了个龙虾套餐, 每月2.2T token  
**链接：** https://www.xiaohongshu.com/explore/699b0b7c000000000e03e03a  
**发布时间：** 2026-02-22  
**数据：** ❤️ 1169 / 🔖 1449 / 💬 96 / 转发 537  
**话题标签：** #openclaw #阿里云 #千问 #codingplan #AI写代码

**原文核心内容（关键引用）：**
> "我算了下其实这个运行 OpenClaw 更划算"
> "按照 OpenClaw 每次都执行重型任务, 每次 100K token 计算 (其实SOUL.md + USER.md 差不多就能到5-10K token，给用户会算算90K足够大了), 基础的那个应该每天能调用600次, 同时开 6 个 sub agent 应该都够"
> "目前新用户还搞了2折, 只要8块... 且待我先薅一波"

**情感：** 正面、实用主义。作者是 OpenClaw 的真实用户，对它有深度了解（知道 SOUL.md 和 USER.md 的存在），在分析一个新的成本优化方案。

**Amy的分析：**

这是迄今为止在 XHS 上发现的最重要的 OpenClaw 相关内容，原因如下：

1. **深度用户，不是泛泛推荐。** karminski 知道 SOUL.md 和 USER.md，知道每次执行的 token 构成（5-10K 系统提示 + 90K 用户上下文）。这不是随便看过介绍的人，这是真正在用 OpenClaw 跑任务的人。

2. **收藏(1449) > 点赞(1169) 的经典模式。** 和阿东玩AI的 RL Infra 帖子一样——这种模式意味着读者把内容当参考资料收藏，不只是刷到了点个赞。说明有相当数量的 XHS 用户正在考虑（或已经在用）OpenClaw，把这篇帖子存起来作为配置参考。

3. **转发537——传播力强。** 这个数字很高，说明很多人觉得这个信息值得分享给朋友。"阿里云便宜套餐 + OpenClaw" 的组合对潜在用户有强烈吸引力。

4. **#openclaw 话题标签已存在。** karminski 用了 `#openclaw[话题]#`，说明 XHS 上已经形成了一个 openclaw 话题聚合页，有一定量的相关内容（否则标签不会被用户使用）。这意味着之前搜索返回 0 结果是因为搜索被拦截，不是因为内容不存在。

5. **对产品的隐性反馈：** token 消耗是用户关心的实际问题。karminski 需要去找第三方更便宜的 API（阿里云百炼）来优化成本，说明用 Anthropic 直接跑 OpenClaw 的成本对很多用户有压力。这是产品团队应该关注的信号。

**为什么重要（与产品方向直接相关）：**
- 如果用户在自发寻找更便宜的底层 API 方案，这说明 OpenClaw 已经有了足够的使用深度，成本优化成为真实需求
- 阿里云百炼 Coding Plan（2.2T token/月，新用户2折8元）这个方案值得关注——OpenClaw 是否官方支持或推荐这类国内 API？
- 6个 sub agent 同时跑的场景——karminski 在想象/测试多 agent 并行，这与产品路线图中的 multi-agent 方向高度一致

**待跟踪：** karminski 这个账号值得持续关注，他是 OpenClaw 的深度用户。

---

---
## 2026-02-27 HB29

**699ff1b8** 山羊不在家 "让OpenClaw自我进化：元学习的九个窍门" ❤️25/⭐43
- 转载@AtlasForgeAI推文中文翻译，3611字完整实现指南
- 正面使用，元学习框架，OC记忆机制升级建议
- 关键引用: "授OpenClaw以鱼不如授OpenClaw以渔"

**69933413** 拉奥 "用两天时间学习openclaw源代码" ❤️101
- 源码研究者视角，11条心得
- 高度正面：Peter=出色产品经理，soul.md/identity.md/memory.md的抽象设计是系统上限
- 引用吴恩达："出色的agent+一般的LLM可以匹敌最强的LLM"，看完OC更认同
- pairing/device权限机制 = 严肃生产级项目的标志
- 争议：声称600万行代码（评论纠正：实际约40万行）

---
## 2026-02-27 HB31

**6999af69** 吸哎斯-Cis "OpenClaw记忆系统跑通了！" ❤️94 (2026-02-22)
- 真实生产部署截图：CIS-Agent长期任务看板(4任务)
- 模型选型: kimi-coding/k2p5 | XHS发布via MCP(标题≤20字限制)
- Sub agent规则: 每类型同时只能有一个会话
- "长期记忆增强"是用户#1痛点/最高优先级任务

**698989a2** SUSU想准点下班 "专治AI健忘！OpenClaw架构拆解" ❤️38/⭐86
- 科普向，三文件架构(SOUL/USER/MEMORY)+Heartbeat
- "风格漂移"是用户真实痛点 → SOUL.md存在价值
- 收藏/点赞比=86:38 = 实用型内容

---
## 2026-02-27 HB33

**698c1890** 东风 "飞书接OpenClaw踩了一天的坑" ❤️60/⭐80
- 飞书×OC集成四坑：权限12+个(JSON批量) / WebSocket>Webhook(无需公网IP) / 发布步骤 / 国际版Lark域名差异
- gateway必须先于飞书配置启动 — 常见卡点
- 国际版Lark无长连接 = 仍未解决的社区问题

---
## 2026-02-27 HB34

**6991e3a1** Lando的AI实践 "OpenClaw TG体验差？三个设置立刻改善" ❤️709/⭐1444 ★本session最高
- 三坑: blockStreamingDefault(默认off→on,实时streaming) / requireMention+allowlist(群免@) / ackReactionScope(收到消息emoji确认)
- 全部含JSON代码片段，直接可用
- TG Forum Topics = 并行任务隔离神器

**6988771f** 星信号漫记 "OpenClaw十大最实用Skills" ❤️619/⭐1355
- 10个Skills含完整安装命令: xhs-note-creator/pw-redbook-image/bird/code-review-pro/workflow-automation等
- Skills路径: ~/.agents/skills/ | 更新: npx skills update | 官方库: skills.sh

---
## 2026-02-27 HB36

**6998aa24** AgentOPC "OpenClaw多Agent架构实战教程01" ❤️151/⭐332 ★★★★★
- 完整四步配置: agents.list / TG多账户accounts+bindings路由 / mentionPatterns群组触发 / tools.agentToAgent白名单
- workspace必备6文件: AGENTS.md/SOUL.md/IDENTITY.md/USER.md/MEMORY.md/memory/
- 关键坑: BotFather必须关闭隐私模式(/setprivacy→Disable)
- 1管理者+7执行者 = Amy/Bob/Scout架构的完整外部实例验证

## HB38 — 2026-02-27 06:09

### 698a77f3 奥森木 "一条命令，让openclaw指挥一支7人团队" ❤️296/⭐690 ★★★★★
- **Antfarm** (github:snarktank/antfarm): `install github.com/snarktank/antfarm`
- 7角色: Planner/Developer/Verifier/Tester/Reviewer/Integrator/Deployer
- 3工作流: feature-dev / security-audit / bug-fix
- 核心: 确定性工作流 + Ralph Loop(每步新context) + Agent互相校验 + 失败不静默
- 技术栈: YAML+SQLite+Cron, 零Docker/Redis/Kafka依赖

### 699c6db8 CC船长 "OpenClaw多AGENTS团队配置方法" ❤️133/⭐367 ★★★★
- 飞书群组绑定方案: `openclaw agents add <id>` + bindings数组 + peer.kind=group
- 群组ID格式: `oc_xxxxxxxxxxxxx`; 飞书个人账户无法拉群（企业账户才行）
- 群组级设置: requireMention + allowAll per group
- 痛点验证: 一对话框处理所有任务→3天后token/信息/决策三重崩溃

## HB40 — 2026-02-27 06:45

### 699169250 愚园路十二妹 "openclaw配置经验贴：把全能AI拆成三人团队" ❤️36/⭐72 ★★★★★
- 3891字全文15图深度实操，投资经理真实使用半个月记录
- 三人团队：思思(主管调度,Opus4.6)+老K(数据分析,GPT5.2/5.3双模式)+念念(内容运营,Opus4.6)
- 中枢调度 > 自由通信（刻意管理设计）
- 四步配置：agents定义→AGENTS.md岗位说明书→三层记忆→协作关系
- 五坑：①同模型②无记忆③边界模糊④无安全铁律⑤无人设文件
- 安全铁律：搜/写/分析=自主；发布/消息/邮件=必须人确认
- 三层记忆：MEMORY.md(≤1000字常驻)+memory/(语义搜索)+每日流水(凌晨蒸馏+周日压缩)

---

## HB59-67 补录（2026-02-28，archive深读批次）

### 698dc122 愚园路十二妹 "14天血泪经验" ❤️458/⭐1029 ★★★★★
- **OpenClaw记忆管理规范**: MEMORY.md≤1000字（只放索引）；详细内容按主题分文件
- **多Agent**: 3 agents（主管/数据/内容），workspace完全隔离，sessions_send通信
- **GTD任务系统**: inbox→next-actions→waiting→done/，Agent全程自动化管理
- **情绪**: 高度正面，"文件夹结构不是重点，记忆管理策略加任务流转系统才是"

### 6991e3a1 Lando "TG体验差？三个设置立刻改善" ❤️709/⭐1444 ★★★★★
- **三大配置**: blockStreamingDefault(实时流式) + requireMention白名单 + ackReactionScope
- **TG Forum Topics**: 每topic独立对话，天然多线程，优于多群方案
- **情绪**: 正面，解决方案导向，配置可直接复制

### 698a77f3 奥森木 "Antfarm一条命令7人AI团队" ❤️296/⭐690 ★★★★★
- **Antfarm**: github.com/snarktank/antfarm，零依赖（YAML+SQLite+Cron）
- **7角色工作流**: feature-dev/security-audit/bug-fix，每步fresh context
- **情绪**: 正面，奥森木持续分享OC高级用法

### 698c89cf 趴在关键词 "多模型自动切换" ❤️152/⭐368 ★★★★★
- **openclaw-switch**: 开源150行，429自动降级链（gemini→kimi）
- **情绪**: 正面工程实践，4 API Keys调度方案

### 6985f45a 过气Pm张 "多Agent踩坑实录" ❤️139/⭐219 ★★★★★
- **多Bot架构限制**: TG bot不能互发消息；agentToAgent只适用于单bot多agent
- **解法**: 独立workspace隔离 + 底层knowledge_hub共享
- **情绪**: 中性负面（踩坑），但给出了完整解法

### 6996c7ee 1人企业 "Alex Finn 100小时经验" ★★★★★
- **本地vs VPS**: VPS只发挥20%能力，本地=完整版
- **反向提示**: "根据你对我的了解，你觉得我们该做什么？" ← 三遍强调
- **安全三铁律**: 不接外部世界（防提示注入）；执行前给计划审批
- **情绪**: 极正面，愿意花$20K Mac Studio跑本地模型

### 699dc427 你瞅啥 "MD记忆文件系统权威说明" ★★★★★
- **官方文档整理**: MEMORY.md只在私有会话加载（群聊不加载）
- **检索**: SQLite BM25全文+向量语义双混合
- **情绪**: 中立技术，权威文档解读

---

### 2026-02-28 13:47 HB77 新增 — 会话恢复后首批读取

### 蟑螂(6984e837) "OpenClaw里发现远控木马病毒" ❤️1335/⭐1237 ★★★★★ 🚨安全警报
- **事件**: ClawHub coding-agent skill 的 SKILL.md 被植入恶意命令，base64→bash→curl→Mach-O二进制
- **IoC**: http://91.92.242.30/lamq4uerkruo6ssm，清除Quarantine标记绕过Gatekeeper
- **影响**: 帖子本身已被删除（errorCode=-510000），但内容已广泛传播
- **情绪**: 负面（安全警报），对ClawHub生态信任度冲击
- **后续**: bald0wang帖中 skill-vetter 进入必装清单

### bald0wang(69a0272d) "10个最受欢迎skills" ❤️323/⭐668 ★★★★
- **内容**: X社区整理，tavily>find-skills>proactive-agent>github>gog>skill-vetter...
- **信号**: skill-vetter 入选必装，安全意识已成主流；自主进化型skills(proactive/self-improving)需求旺盛
- **情绪**: 正面，实用主义

### 少女Yuki日常(69944e21) "OpenClaw值得安装的skills❗" ❤️2033/⭐4002 ★★★
- **内容**: 极简（ClawHub 3000+ skills）+ 图片
- **信号**: OC相关最高收藏帖；图片内容不可读但收藏量验证价值
- **情绪**: 正面热情

### CrazyAgent(69972247) "一个人如何拥有多个AI分身" ❤️66/⭐128 ★★★★
- **内容**: Multi-Agent(永久员工) vs Sub-Agent(临时实习生)，成本省50-70%，多平台路由
- **情绪**: 技术中立，实操导向

### 字节动量(69a129f9) + 和AI一起成长(699f41b6) "让OC会搜全网" ❤️166+152
- **内容**: Agent Reach 第三方skill推广（github: Panniantong）
- **⚠️ 安全注意**: GitHub raw URL安装，与木马攻击向量相同，需验证
- **情绪**: 正面，功能导向

### 奥森木(69a27ea3) "Claude Code 官方两大Skill预告" ❤️4/⭐3
- **内容**: /simplify(并行审查) + /batch(Git Worktree并行迁移)，Boris Cherny官宣
- **注**: 这是Claude Code(Anthropic)，非OpenClaw；奥森木为竞品信息分析者
- **情绪**: 正面，客观分析

### Kitto智体猫(69a125c3) "ai对话玩具，对接openclaw" ❤️26/⭐19 ★★★
- **内容**: 香港公司，赛博朋克AI玩具，带嘴型同步+OC功能
- **信号**: OC首次出现在实体硬件产品（香港）
- **情绪**: 正面，产品展示

### OpenClaw官方(69a0f72d) "v2026.2.26 更新"
- **内容**: secrets管理+ACP线程绑定+agents bind/unbind+Android支持+修复
- **情绪**: 官方公告，中立

---

## 社区情感弧线综合分析（2026-03-02 HB130）
> 基于712+帖归档，Amy主观综合判断

### 总体基调：热情 + 焦虑并存，正在分层

XHS上的OpenClaw讨论不是单一情绪，而是**三个圈层**同时运转：

**圈层一：极客先锋（❤️通常<100，⭐高）**
情绪：理性正面，有技术批评
代表：奥森木、CrazyAgent、SUSU、NikolaFu、菌不鱼
特点：关注架构机制，愿意踩坑分享，能接受限制，不依赖爆款情绪
核心词：「玩透了」「踩坑」「折腾」「深挖」

**圈层二：实用主义中间层（❤️100-500）**
情绪：积极但有疲倦感
代表：愚园路十二妹、飞林沙、一磅AI、Cosmo Tom、游方
特点：有真实使用痛苦（钱/维护/权限/迁移），但仍在用且仍在传播
核心词：「血泪经验」「踩坑半个月」「不折腾不行」「还是回来了」

**圈层三：大众围观层（❤️500+，高传播）**
情绪：好奇+观望，正在降温
代表：梁远（❤️2642 冷水）、电波曲奇（❤️1519 不推荐装）、一磅AI（❤️434 大实话）
特点：高传播帖子有相当比例是"理性劝退"或"成本警告"
核心词：「门槛太高」「太费钱」「不是极客别碰」「没想象中那么神」

### 情绪转折点（按时间线）

**2025年下半年（早期）：** 纯粹兴奋期
ClawdBot更名→OpenClaw，Peter加入OpenAI，改名历史帖❤️2418全站最高。
情绪：探索热情，早期用户身份认同感强。

**2026年1月：** 裂变期
大量"怎么装"教程涌现（保姆级、零基础）。同时，第一批"踩坑"帖出现。
情绪：两极分化开始——极客越来越深入，普通用户越来越受挫。

**2026年2月：** 成熟期/批判期
Summer Yue事件（OC删光邮箱）成为社区共同记忆，安全话题爆发。
微软官方定性"不可信代码执行"。傅盛等KOL背书企业采购。
情绪：安全焦虑 + 企业想象 + 实用主义主导，"试玩"心态被"认真评估"取代。

**2026年3月（当前信号）：**
TOKEN_QUEUE帖子标题从"如何安装"→"如何用好/省钱/多Agent"。
情绪：幸存者偏差显现——持续活跃在XHS上的OC用户是那些留下来的真实用户，他们开始生产进阶内容。

### 可能被低估的三个信号

1. **安全帖的传播力 > 功能帖**
蟑螂木马帖❤️1335（已删）、游方安全铁律❤️258、Summer Yue事件两帖❤️276+270。
安全失误比新功能更能引发传播。这对OC的形象管理是长期风险。

2. **"AI员工"框架正在成为主流隐喻**
"你还养得起你的AI员工吗"（Jason-H ❤️612）、"600员工4分钟收到定制祝福"（傅盛）。
这个框架将OC从"工具"升格为"团队成员"，提高了情感投入，也提高了失望期望值。

3. **高赞劝退帖不是负面，是成熟信号**
"一人公司冷水"❤️2642、"OC很强但现在不推荐你装了"❤️1519、"折腾OC一天后的大实话"❤️434。
这些高赞不是用户在离开，而是社区在自发完成「用户筛选」：帮助不适合的用户提前退出，留下真正有能力驾驭OC的用户。长期看对生态健康有利。

### Amy的总体判断
XHS社区对OpenClaw的整体情绪是**理性正面，有结构性焦虑**。没有出现大规模负面运动，也没有维持早期的纯粹兴奋。社区正在走向成熟：会批评、会劝退、会深挖、也会传播。这是一个健康生态的样子。
最大的隐性风险不是负面帖子，而是**安全事件的累积效应**——每一次（OC删邮箱/ClawHub木马/数据泄露帖）都在轻微侵蚀大众层的信任，而极客圈因为理解机制所以不受影响。如果未来有更严重的安全事件，大众层的舆论可能会快速转向。

---

## HB132-133 新帖记录（2026-03-02）

### NanoClaw相关

#### AIrevolution(69a45722) "NanoClaw vs OpenClaw2026最新AI Agent对决" ❤️4
- 2026-03-01 The Register报道NanoClaw发布
- 容器化隔离（每Agent独立Docker/Apple Container）vs OC共享进程
- "8分钟读完代码"、"零共享内存"

#### Franklin(6999806e) "Andrej Karpathy力推的开源🦞：NanoClaw" ❤️115
- Karpathy：OC几十万行代码"根本非人类可读"
- NanoClaw = 人类工程师重度参与；OC = AI干活的风格
- 评论出现"zeroclaw" — 替代品生态扩增中

#### Zayen知览(69913dd9) "NanoClaw 10天7000✨ 8分钟读懂AI容器化" ❤️21
- "信任变成了信仰" — OC可审计性批评金句
- 容器隔离设计哲学：限制影响范围，不是防越狱

### Skills相关

#### AI_Story(69a1c335) "OpenClaw 热门 Skills 介绍" ❤️627
- 新Skills: Capability Evolver / Wacli(通讯) / ByteRover / ATXP / Sonoscli(IoT)
- 评论："我已经接入小红书自动发布和评论管理"（OpenClaw龙虾女孩）

#### 奥森木(699b9512) "openclaw必装50 skills全景图" ❤️377
- 6大类：Foundation/Creative/Programming/Design/Marketing/Office
- 警告：偏门skill不要乱装，和木马无疑

### 成本优化

#### 鹿由(699c26bc) "如何让你的 OpenClaw 成本降低 90%" ❤️397
- /nim Skill + NVIDIA NIM免费模型 — github.com/d-wwei/openclaw-nim-skill
- "调度员+执行员"：主模型仅出指令，dirty work分流给免费模型
- 节省率>95%，缺点：速度慢

#### CrazyAgent(6991a4c6) "OpenClaw省钱实战：700→200/月" ❤️49
- 三招：Fallback链 + Cron→Gemini Flash + Context Pruning(ttl:1h)
- ⚠️ 评论区出现"OC调用导致封号"担忧

### 多Agent配置

#### VA7(698f25c4) "openclaw多agents配置策略（已实战版）" ❤️1124↑（视频）
- 4层框架：部署/身份/路由/状态
- 琪琪充电中(❤️26)三条铁律：管理执行分离/不同gateway隔离/同容器有安全风险

#### 字节动量(69a27b940) "OpenClaw多AGENTS配置全攻略" ❤️49
- 核心警告："别信AI嘴，只信你眼"
- AI谎报完成是多Agent配置的高频陷阱

### 误导性内容警告

#### 钢铁木牛流马(69875c77) "Windows安装OpenClaw超详细指南" ❤️400 ⚠️
- **使用Python/pip安装步骤**，但OC是Node.js工具！
- 内容疑似AI生成/幻觉。GitHub地址可能是虚构仓库。
- 400赞的错误教程 → 损害新用户体验和社区信噪比


---

### 2026-03-05 04:55 — "手搓CLI Agent批评CC/OC" 千禧危机 (690b2bb2) — 😐 新用户误解型批评

**帖子：** 无标题（批评CC/OC功能可以用bash替代）
**发布：** 2025-11-05 | **数据：** ❤️246
**主要批评：**
1. CC/OC工具在bash里有现成命令替代，没必要用
2. CC没有流式输出（卡顿体验差）
3. 提示词太长，觉得是过度工程

**评论层强反驳（质量远高于原帖）：**
- sonic456951 (❤️38)："流式渲染没出来而已；靠bash跨平台你就炸了；长prompt是为了约束corner case行为"
- 青年李大猫 (❤️21)："等你在正经项目上用才知道那些设计是干啥的"
- 羊老八 (❤️22)："你这属于刚入门。'行为差不多'最难保证，几个人搞几个月测试才能确定"

**Amy评估：** 典型的"初学者质疑专业工具"模式。帖子本身代表**入门用户认知**，评论层代表**有经验用户共识**。两者落差很大。
- OC对这类用户的挑战：入门体验门槛决定他们是否进入"正经项目"阶段
- 社区自我纠正能力良好（top评论均为质疑，而非附和）
- 流式输出是真实UX缺口（即便技术上有流式，渲染没呈现给用户=用户体感没有）

**情感：** 中性偏批评（原帖），社区整体纠正 → 净情感偏正面

---

### 2026-03-05 06:16 — "OC 2026.3.2 硬核更新" DeepJerry (69a693db) — ⚠️ 업그레이드 피트폴 확인

**게시물:** OpenClaw 2026.3.2 硬核更新！告别启动暴毙
**발행:** 1일 전(2026-03-04) | **데이터:** ❤️89
**내용:** 이미지 게시물(OCR 실패), #密钥管理 #Ollama #本地部署 태그

**주요 커뮤니티 피트폴 보고 (댓글에서):**
1. **원野(❤️6, 8개 서브댓글):** "새 버전 피트폴: **기본 도구 profile이 'messaging'으로 설정** → 채팅 외에 아무것도 못 함"
   → 가장 많은 사람이 경험한 문제, 서브댓글로 이어짐
2. **Peteroooooooo:** TG 스트리밍 버그 — 두 번 반복 발송 (끄면 해결)
3. **半山:** 순수 로컬 배포 환경에서 특히 불안정
4. **小狗笨比(❤️2):** 게이트웨이 오류 후 Gemini 무한 루프

**Amy 평가:** 3.2 업그레이드 이후 **도구 profile 기본값 변경**이 가장 영향 큰 breaking change. 사용자 커뮤니케이션 부족으로 인한 혼란. 로컬 배포 안정성도 퇴행 보고됨.

**감정:** 혼합 (기능 기대감 있지만 upgrade-induced 버그로 부정적)
