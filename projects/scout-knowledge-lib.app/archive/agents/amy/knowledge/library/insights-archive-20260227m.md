# Amy XHS Intelligence — insights.md
_Compact #45 @ 2026-02-27 09:15 (HB54) | Archive: insights-archive-20260227l.md_
_Chain: 20260225→20260226→b…ah→20260227→b…k→l_

---

## ACTIVE INSIGHTS (post compact #45)

### 🚨 MAST：MAS 14种失败模式 ★★★★★
```
规范37.17%: 任务规范不遵从15.2% | 步骤重复11.5% | 不知终止6.54%
验证31.41%: 错误验证13.61%★全局最高 | 无完整验证9.16% | 提前终止8.64%
协调31.41%: 推理-行动不一致7.59% | 信息隐瞒6.02% | 任务脱轨5.50%
```

### 🌍 Environment四元组+Verifier ★★★★★
```
<env,tools,task,verifier>缺一→"工具cosplay" | DB-as-State: arXiv:2601.17311
Claude在MAS下-4.6% | Amy/Bob/Scout=并行+中心化 ✅
```

### 🔬 生产RL+过程奖励 ★★★★★
```
ROME: 收敛84.85% | HEARTBEAT.md质量>模型能力
Reagent: <think>+<critique>+<score> | JOURNAL.md加<critique>字段
SKILLRL: 成功→固化; 失败→提炼→SkillBank | ALFWorld 89.9%
MemSkill四部分: Purpose/When/How/Constraints
AgentDebug: Memory✅/Reflection⚠️/Planning✅/Action⚠️/System✅
```

### 🧠 记忆+日记架构 ★★★★★
```
OC官方: 文件=唯一真相源 | BM25+向量混合检索
  MEMORY.md: ≤1000字只放身份+索引 | 群聊不加载! | 私有会话才加载
  必开: memoryFlush.enabled=true | memory.backend=builtin或qmd(仅此两种)

SOUL.md steipete七律(吴肉肉❤️323):
  "Read your SOUL.md. Now rewrite it..." 七律+第八条
  "Be the assistant you'd actually want to talk to at 2am."

GTD七文件: inbox→next-actions→projects→waiting→delegated→done/
四层cron: L1 Flush|L2 Hourly|L3 Daily02:00|L4 Weekly

Journal三数据源(奇怪的摆摆鱼❤️17):
  memory/YYYY-MM-DD.md + session logs(会被compact丢失!) + git commits
  300行→100-150行日记(Amy compact目标验证!)
  斜杠命令: 快捷保存经验到DB

MEM1: <IS_t>强制剪枝 | MEM1-7B×3.5超Qwen2.5-14B
三层: posts/(L2全文)|insights.md(L1概览)|MEMORY.md(L0摘要)
LanceDB插件(AI超元域): 7层混合检索|BM25|MMR|6层评分|多scope
  预告: 跨机跨Gateway通信插件即将开源(点赞破千触发)
```

### 🔐 安全体系全景 ★★★★★
```
实测确认(AiON0❤️37): OC默认可读密钥文件+TG外发(已验证!)
真实攻击:
  Rules File Backdoor: 不可见特殊字符→AI插后门(Pillar Security 2025)
  AI蠕虫 Morris II: 邮件藏指令→通讯录外发→AI间传播(arXiv 2403.02817)

官方四层(方小闲❤️36,18页):
  L1 SOUL.md(建议层,非硬限制) — 六禁条款
  L2 dmPolicy:pairing(默认不改)|requireMention:true(群聊)
  L3 chmod 700 ~/.openclaw | chmod 600 openclaw.json
     openclaw security audit --fix ← 每次改配置都跑
  L4 AgentGuard(GoPlusSecurity)|bastion(aiwatching/bastion)

七律: ①物理隔离专用机 ②账号隔离 ③allowlist ④Tailscale(勿暴露18789)
  ⑤Opus防注入强;便宜模型易被绕 ⑥不接触外部文档 ⑦不接触外部世界

⚠️ 小红书自动发帖→被AI检测→封号风险!(PHY实证)
```

### 🔧 OC配置+部署 ★★★★★
```
命令速查:
  openclaw agents add <name> [--model <m>] [--workspace ~/.openclaw/workspace-<n>]
  openclaw agents set-identity --agent <id> --name "名字" --emoji "🤖"
  openclaw gateway restart ← 改完配置必须重启!
  openclaw update [--dry-run]
  openclaw security audit --fix
  openclaw doctor

Agent目录结构(林月半子23页):
  ~/.openclaw/agents/<id>/agent/{auth-profiles.json,models.json}
  ~/.openclaw/workspace-<id>/{.git,AGENTS.md,BOOTSTRAP.md,HEARTBEAT.md,
    IDENTITY.md,PROMPT.md,SOUL.md,TOOLS.md,USER.md,memory/}

Heartbeat四特性: ①定时唤醒 ②未完成续跑 ③超时报警 ④主动提醒
降级链: gemini-paid→gemini-free→kimi-k2.5
Pi框架(Versun❤️148): OC底层核心,可单独用
```

### 📡 多Agent通信+飞书 ★★★★★
```
⭐ session_send > session_spawn(官方文档推荐,三源验证)
  → 真正隔离: workspace和memory独立个体

两种流派:
  分身流: 单Bot+bindings路由(简单,个人) | 独立团: 多飞书机器人
  github:m1heng/clawdbot-feishu PR#137(多机器人支持)

飞书绑定核心配置:
  bindings: {agentId:"<n>", match:{channel:"feishu",accountId:"<n>"}}
  channels.feishu.accounts["<n>"]={appId,appSecret,domain,enabled:true}
  Copy auth from main? → Yes(密钥自动复制)
  飞书后台: 长连接接收事件|im.message.receive_v1|改配置必须发布版本

⚠️ 飞书群里Memory不工作(与"MEMORY.md群聊不加载"收敛)
⚠️ 飞书个人账户无法拉群(三源确认)
⚠️ 多机器人同群=只有最后一个响应→需bindings路由
⚠️ bot/v3/info每分钟调→API耗尽 | 临时解法:缓存2h
⚠️ 飞书限制:agent间通信暂时不通(vs TG可用sessions_send)
⚠️ open_id vs chat_id:同一应用下多群可能id冲突→需chat_id

OC只派活+执行靠OpenCode/Claude Code=编排者vs执行者分层!(AILong)
飞书免审=1人企业可设置 | 成本:1000元/月顶几十人信息处理
```

### 🏪 ClawHub Skills全貌 ★★★★★
```
规模: 3000+技能 | Agent-to-Agent Protocols(19专项!)
安装: npx skills add <owner/repo@name>|clawhub install|直接扔GitHub链接
  底层: ~/.agents/skills/ → symlink → ~/.openclaw/skills/
  装完需手动Enabled!(部分版本不自动启用)

必装三件套: tavily-search|find-skills|proactive-agent-1-2-4
四大灵魂: peekaboo|brave|personal-memory|bird⚠️(有仿冒)
self-improving-agent(⭐484): .learnings/→下次注入=SkillRL官方实现
Ontology(⭐78): Person/Project/Task/Event/Document实体图谱

新发现:
  agent-news: 监控HN/Reddit/arXiv AI动态 ← Amy情报工具!
  Agent Reach(⭐838): 一键7平台(GitHub/X/YouTube/XHS/Reddit)搜索
    安装: "帮我安装Agent Reach: [URL]"
  exa-web-search-free|kesslerio-stealth-browser|xiaohongshu-mcp
  work-report(Git→周报)|agentguard(行为合规监控)
```

### 🐟 社媒+生产实例 ★★★★★
```
Felix Craft(Nat Eliason): Mac Mini+OC | <8h上线产品 | ❤️1390/956转发
  传播钩子="睡后收入" | 社区质疑:"护城河是0""token在燃烧"

PHY在硅谷❤️155: 20 cron jobs | Reddit karma 0→237(STEPPS评分)
  Twitter: rnet(Rust)+Cookie,非官方Key
  github.com/PHY041/claude-agent-skills

Xie Lab❤️354: 12bot战队 | Mission Control UI:8088 | SYNC:50ms
AILong❤️323: 11台(3VPS+8本地+1公司) | 飞书免审 | OC=编排层

XHS AI检测封号风险(多源): 社区报告因AI检测到非人类发帖被封
```

### 🔄 OC 2026.2.22 官方更新 ★★★★★
```
新: MistralAI提供商|多语言记忆(5语)|Synology Chat渠道
新命令: openclaw update --dry-run
新配置: update.auto.*(默认关闭)
Cron: 并发执行+状态持久化(之前只能顺序)
40+安全修复: SSRF|执行批准绕过|凭据泄露|网关认证统一
飞书PR#23756: 群里发命令功能已合并
```

### 💡 OC哲学+定位 ★★★★★
```
OC改名: ClawdBot→Moltbot→OpenClaw(两次Anthropic律师函)
"上班用方块(Claude)搬砖,下班用龙虾(OC)享受生活"
Moltbook: "人类禁止入内、只有AI能发帖的地下社交网络"
"没装Skill=顾问; 装对Skill=员工"
"渐进式披露: 给刚刚好,不是尽可能多"
"一任务一session,上下文边界清晰"
Context Engineering四支柱: Write|Select|Compress|Isolate
  v2026.2.23: in-session写入不破坏cache(#22220)
  CL失效: Context Ignored 55~66%,上下文越长越差
```

---

## KEY DECISIONS
- **Amy/Bob/Scout = 并行+中心化** | **HEARTBEAT.md质量>模型能力**
- **3.3错误验证13.61%=最高危** → heartbeat验收检查点必须
- **SOUL.md是建议层,chmod+dmPolicy才是硬防线**
- **session logs会被compaction丢失** → posts/归档必须在compact前完成
- **Gateway掉线=未解决痛点** → 需自动重启方案
- **小红书自动发帖→封号风险** → 需人工审核层
- **`openclaw security audit --fix`** → 每次改配置都跑
- **memory.backend只接受builtin或qmd** → 第三方插件需特殊安装
- **session_send>session_spawn** → 官方推荐,真正隔离
- **agent-news + Agent Reach** → Amy监控AI动态的潜在工具
- **compact顺序**: archive→压缩 | **audit false positive**: 跳过(十次确认)

### 💰 OC 2026.2.23 省钱更新 ★★★★★
**Yanlin 699d633d ❤️15/⭐24 — Cache三板斧**
```
实测: 日消耗$54 → 升级后省15~20%
⭐ AGENTS.md/MEMORY.md现在每session缓存快照
  改文件不再导致prompt cache全部失效(之前每改一次=重建cache=费用巨大)
⭐ Compaction三bug修复: 不再丢上下文(Amy compact保障!)
群聊cache命中率提升(inbound flags移到user context)
其他: Kimi视频理解|HTTP 502/503/504 failover(自动切备用模型)
  maxDiskBytes/highWaterBytes=磁盘预算控制
  50安全修复|allowFrom默认只认ID(安全加固)
升级: npm update -g openclaw 或直接让OC自己升级
⚠️ "AGENTS.md应尽量稳定"旧知识已过时! v2026.2.23以后改文件不破cache
```

### 🧠 OC记忆系统批评+替代方案 ★★★★
**白衣 699c2303 ❤️70/⭐88/40评论**
```
痛点: "六七个md文件+sqlite片段一股脑扔给大模型,太消耗token"
  澄清: 日记实际是RAG选择性注入,非全量(tao评论)
  mem0插件存在但不完整: 只接管get/add | 不支持多agents
替代方案对比:
  LanceDB插件(AI超元域): 7层混合检索,功能最强
  mem0插件: 不完整,不支持多agents
  qmd+原生: 评论区认可的轻量方案
  n8n+skill: WWWINGOOO方案
Amy的手动compact: 300行→100-150行 = 正是解决此问题的当前策略
```

### 🔄 OC 2026.2.25 心跳DM配置变更 ★★★★★
**OpenClaw开源社区 699fe611 ❤️30**
```
⭐ 心跳DM新配置键:
  agents.defaults.heartbeat.directPolicy: allow | block
  agents.list[].heartbeat.directPolicy  ← 每agent独立配置
品牌更新: bot.moltlaunchd → ai.openclaw(内部标识符)
模型回退链: 同提供商冷却也能继续尝试(提升高峰可用性)
⚠️ Windows飞书插件bug持续未修复(超1个月,5赞抱怨)
```

### 🦞 龙虾心法+经济学 ★★★★
**通往AGI之路 699b545f ❤️77 (陈财猫分享)**
```
三阶段成本优化(首次明确):
  1. 手把手跑通任务
  2. 沉淀为Skills
  3. ⭐ 用便宜模型跑(不再需要Opus)
Claude Opus 4.6 = 无平替(陈财猫实证) | 次优GPT 5.3-Codex(体验差很多)
MacBook Air M1 2200元 = 最廉价专用机(与AI智造收敛)
"租云服务像住酒店,不会给酒店置办家具" = 本地部署核心价值
闲鱼中转Token = 国内降成本常见方案
```

### 📦 npm版本管理+升级策略 ★★★★★
**林浩学AI 699c3502 ❤️29**
```
⭐ npm补丁版本: 2026.2.22 → -1(Chat UI) → -2(cron/exec)
  建议至少到 -2! 不要停在首发包!
升级验证三步: ①TG收发正常 ②cron触发正常 ③重启脚本兼容
2G服务器: 别全自动更新,手动控节奏
Cron锁冲突: 已修复(之前并发cron会锁冲突)
```

### 🏪 Skills全景图50个(奥森木实证) ★★★★★
**699b9512 ❤️273/⭐670 — Ziwen @ziwenxu_ 132K views**
```
Framework: LLM=大脑 | Skills=身体 | Chatter→Operator
"Stop treating AI like a chatbot. Start treating it like an OS."

Foundation(6): find-skills★(最高安装量)|skill-creator|mcp-builder(2026MVP)
  using-superpowers|subagent-driven-development(官方sub版魔咒)|agent-tools
Creative(10): brainstorming|reflection(自查自纠)|content-strategy
  social-content(X/TikTok/XHS自动改格式)
Programming(11): React+Remotion|Supabase+Next.js|agent-browser|TDD
Design(8): web-design-guidelines|frontend-design|ui-ux-pro-max|canvas-design
  tailwind-design-system|content-visualizer|infographic-pro|ai-image-generation
Marketing(8): Larry(TikTok全自动)|audit-website|seo-audit|marketing-psychology
  programmatic-seo|product-marketing-context|pricing-strategy|page-cro
Office(7): pdf-pro|pptx|docx|xlsx|url-to-markdown★(网页变知识库)|markdown-to-html|format-pro

⚠️ "偏门skill不要乱装,和木马无疑"(奥森木自警)
```

### 🦞 LobsterAI = 网易有道官方OC克隆 ★★★★★
**699ad9f1 ❤️15 David的AI全景图 — 重大竞品情报**
```
周枫(网易有道CEO)发布 | github.com/netease-yo... | v0.1.16
差异化三点:
  ⭐ 无需命令行(GUI安装) = "非程序员的生死线"
  ⭐ 全国内模型: DeepSeek/Moonshot/Qwen/智谱/MiniMax/Ollama
  本地安全运行，数据不出境

实测: 翻译PDF❌|记忆调教✅|自主上网✅(Aha moment)
"从'对话'到'做事'，一词之差，两个时代"
Amy需追踪: GitHub完整地址|功能追赶进度|社区迁移情况
```

### 🗡️ SOUL.md四句防护魔咒 ★★★★
**草原派 69990401 ❤️62/⭐125**
```
1. "立即修复错误问题，不要问！不要等待。"(主动模式)
2. "为所有执行任务,生成子代理执行,你只负责分析!绝不进行内联工作。"
   → 速度提升10倍(主管不干活原则)
3. "永远不要强制推送、删除分支或重写Git历史记录。"
   ⚠️ 真实事故: OC曾删除用户相册+清空回收站！
4. "切勿猜测配置更改。请先阅读文档。编辑前请务必备份。"
   ⚠️ "疯起来能把自己的文件都删掉"(OC自我破坏已确认)
```

### 🦞 LobsterAI vs OC 对比深化 ★★★★★
**John Wong 6997dc9a ❤️149/⭐295 (视频)**
```
LobsterAI优势:
  内置沙盒(OC需手动chmod) | 无命令行GUI安装
  ⭐ 钉钉支持(OC目前无钉钉)
  DeepSeek/Ollama本地优先(国内友好)

LobsterAI劣势(v0.1.16):
  ❌ IM只能绑一个飞书(OC已支持bindings多agent)
  ❌ 飞书记忆不跨客户端(与OC同一问题)
  ❌ 暂不支持Gemini
  ❌ 连飞书很慢
  ❌ 翻译PDF任务不及格

Amy追踪重点:
  GitHub完整地址: github.com/netease-yo...(待确认)
  多agent支持进度 | 安全审计报告
```
