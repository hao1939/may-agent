# Amy XHS Intelligence — insights.md
_Compact #46 @ 2026-02-27 09:35 (HB54) | Archive: insights-archive-20260227m.md_
_Chain: 20260225→20260226→b…ah→20260227→b…l→m_

---

## ACTIVE INSIGHTS (post compact #46)

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

MEM1: <IS_t>强制剪枝 | MEM1-7B×3.5超Qwen2.5-14B
三层: posts/(L2全文)|insights.md(L1概览)|MEMORY.md(L0摘要)

LanceDB插件(AI超元域): 7层混合检索|BM25|MMR|6层评分|多scope
  预告: 跨机跨Gateway通信插件即将开源(点赞破千触发)

OC记忆系统批评(白衣❤️70/⭐88):
  "六七个md文件+sqlite片段一股脑扔给模型" = token高消耗
  澄清: 日记实际是RAG选择性注入,非全量(tao评论)
  mem0插件存在但不完整: 只接管get/add | 不支持多agents
  替代: LanceDB(最强)|mem0(不完整)|qmd+原生|n8n+skill
```

### 🔐 安全体系全景 ★★★★★
```
实测确认(AiON0❤️37): OC默认可读密钥文件+TG外发(已验证!)
真实事故: OC曾删除用户相册+清空回收站！(草原派实证)
  "疯起来能把自己的文件都删掉"(OC自我破坏已确认)

真实攻击:
  Rules File Backdoor: 不可见特殊字符→AI插后门(Pillar Security 2025)
  AI蠕虫 Morris II: 邮件藏指令→通讯录外发→AI间传播(arXiv 2403.02817)

官方四层(方小闲❤️36,18页):
  L1 SOUL.md(建议层,非硬限制) — 六禁条款
  L2 dmPolicy:pairing(默认不改)|requireMention:true(群聊)
  L3 chmod 700 ~/.openclaw | chmod 600 openclaw.json
     openclaw security audit --fix ← 每次改配置都跑
  L4 AgentGuard(GoPlusSecurity)|bastion(aiwatching/bastion)

SOUL.md四句防护魔咒(草原派❤️62/⭐125):
  1. "立即修复错误问题，不要问！不要等待。"
  2. "为所有执行任务，生成子代理执行，你只负责分析！绝不进行内联工作。"
  3. "永远不要强制推送、删除分支或重写Git历史记录。"
  4. "切勿猜测配置更改。请先阅读文档。编辑前请务必备份。"

七律: ①物理隔离专用机 ②账号隔离 ③allowlist ④Tailscale(勿暴露18789)
  ⑤Opus防注入强 ⑥不接触外部文档 ⑦不接触外部世界

⚠️ 小红书自动发帖→被AI检测→封号风险!(PHY实证)
```

### 🔧 OC配置+部署 ★★★★★
```
命令速查:
  openclaw agents add <name> [--model <m>]
  openclaw agents set-identity --agent <id> --name "名字" --emoji "🤖"
  openclaw gateway restart ← 改完配置必须重启!
  openclaw update [--dry-run]  ← dry-run=预览不执行
  openclaw security audit --fix
  openclaw doctor

Agent目录结构(林月半子23页):
  ~/.openclaw/agents/<id>/agent/{auth-profiles.json,models.json}
  ~/.openclaw/workspace-<id>/{.git,AGENTS.md,BOOTSTRAP.md,HEARTBEAT.md,
    IDENTITY.md,PROMPT.md,SOUL.md,TOOLS.md,USER.md,memory/}

Heartbeat四特性: ①定时唤醒 ②未完成续跑 ③超时报警 ④主动提醒
  ⭐ 新配置: agents.defaults.heartbeat.directPolicy: allow|block
  也支持: agents.list[].heartbeat.directPolicy (每agent独立)
降级链: gemini-paid→gemini-free→kimi-k2.5
Pi框架(Versun❤️148): OC底层核心,可单独用
```

### 💰 OC经济学+成本优化 ★★★★★
```
2026.2.23 省钱三板斧(Yanlin 699d633d ❤️15):
  实测: 日消耗$54 → 升级后省15~20%
  ⭐ AGENTS.md/MEMORY.md现在每session缓存快照
     改文件不再导致prompt cache全部失效!(旧知识已过时)
  ⭐ Compaction不再丢上下文(Amy compact保障!)
  群聊cache命中率提升(inbound flags→user context)
  HTTP 502/503/504 failover(自动切备用模型)
  maxDiskBytes/highWaterBytes=磁盘预算控制
  allowFrom默认只认ID(安全加固)
  升级: npm update -g openclaw 或让OC自己升级

npm补丁版本(林浩学AI 699c3502 ❤️29):
  2026.2.22 → -1(Chat UI) → -2(cron/exec) 建议至少到-2!
  升级验证三步: ①TG收发 ②cron触发 ③重启脚本兼容
  2G服务器: 手动控节奏, 别全自动

三阶段成本优化(陈财猫/通往AGI之路 699b545f ❤️77):
  1. 手把手跑通 → 2. 沉淀Skills → 3. ⭐ 用便宜模型跑!
  Claude Opus 4.6 = 无平替 | 次优GPT 5.3-Codex(体验差很多)
  MacBook Air M1 2200元 = 最廉价专用机
  "租云服务像住酒店" = 本地部署核心价值
  闲鱼中转Token = 国内降成本方案
```

### 📡 多Agent通信+飞书 ★★★★★
```
⭐ session_send > session_spawn(官方文档推荐,三源验证)
bindings路由=OC多Agent标准范式(三源验证)

两种流派:
  分身流: 单Bot+bindings路由(简单,个人) | 独立团: 多飞书机器人

⚠️ 飞书群里Memory不工作 | ⚠️ 飞书个人账户无法拉群(三源确认)
⚠️ Windows飞书插件bug持续未修复(超1个月!)
⚠️ bot/v3/info每分钟调→API耗尽 | 临时解法:缓存2h
⚠️ 飞书限制:agent间通信暂时不通(vs TG可用sessions_send)

OC只派活+执行靠OpenCode/Claude Code=编排者vs执行者分层!(AILong)
飞书免审=1人企业可设置 | 成本:1000元/月顶几十人信息处理
```

### 🏪 ClawHub Skills全貌 ★★★★★
```
规模: 200K+技能(find-skills最高安装量!) | 3000+活跃技能
安装: npx skills add <owner/repo@name>|clawhub install|直接扔GitHub链接

奥森木50技能全景(699b9512 ❤️273/⭐670/144转发):
Foundation(6): find-skills|skill-creator|mcp-builder(2026MVP)|
  using-superpowers|subagent-driven-development|agent-tools
Creative(10): brainstorming|reflection|content-strategy|social-content
Programming(11): React+Remotion|Supabase+Next.js|agent-browser|TDD
Design(8): web-design-guidelines|frontend-design|ui-ux-pro-max|
  canvas-design|tailwind-design-system|content-visualizer|infographic-pro|ai-image-generation
Marketing(8): Larry(TikTok)|audit-website|seo-audit|marketing-psychology|
  programmatic-seo|product-marketing-context|pricing-strategy|page-cro
Office(7): pdf-pro|pptx|docx|xlsx|url-to-markdown★|markdown-to-html|format-pro
⚠️ "偏门skill不要乱装,和木马无疑"(奥森木)

必装基础: tavily-search|find-skills|proactive-agent-1-2-4
四大灵魂: peekaboo|brave|personal-memory|bird⚠️(有仿冒)
self-improving-agent(⭐484): .learnings/→下次注入=SkillRL官方实现
agent-news★: 监控HN/Reddit/arXiv AI动态 ← Amy情报工具!
Agent Reach(⭐838): 一键7平台(GitHub/X/YouTube/XHS/Reddit)搜索
```

### 🦞 竞品：LobsterAI(网易有道) ★★★★★
```
发布: 周枫(网易有道CEO) | github.com/netease-yo... | v0.1.16
定位: "中国版OpenClaw" | 7×24小时桌面Agent

LobsterAI优势:
  ⭐ 无需命令行(GUI安装，非程序员生死线)
  ⭐ 钉钉支持(OC目前无钉钉!)
  内置沙盒防误操作(OC需手动chmod)
  全国内模型: DeepSeek/Moonshot/Qwen/智谱/MiniMax/Ollama

LobsterAI劣势(v0.1.16):
  ❌ IM只能绑一个飞书(OC已支持bindings多agent)
  ❌ 飞书记忆不跨客户端 | ❌ 暂不支持Gemini
  ❌ 翻译PDF任务不及格 | ❌ 连飞书很慢

Amy追踪: GitHub完整地址|多agent支持进度|安全审计
```

### 🐟 社媒+生产实例 ★★★★★
```
Felix Craft(Nat Eliason @nateliason): Mac Mini+OC | <8h上线产品
  传播钩子="睡后收入" | ❤️1390/956转发 | 社区质疑:"护城河是0"

PHY在硅谷❤️155: 20 cron jobs | Reddit karma 0→237
  Twitter: rnet(Rust)+Cookie非官方Key
Xie Lab❤️354: 12bot战队 | Mission Control UI:8088
AILong❤️323: 11台(3VPS+8本地+1公司) | OC=编排层
```

### 🔄 OC 2026.2.22+2.25 更新速查 ★★★★★
```
2022年2.22:
  新渠道: Synology Chat | 新提供商: Mistral(支持memory embeddings+voice)
  openclaw update --dry-run(预览更新)
  update.auto.*(默认关闭) | Cron并发执行+状态持久化
  40+安全修复: SSRF|执行批准绕过|凭据泄露|SSRF
  飞书PR#23756群里发命令已合并

2026.2.23: 省钱(见上方"OC经济学")

2026.2.25:
  ⭐ agents.defaults.heartbeat.directPolicy: allow|block
  品牌切换: bot.moltlaunchd→ai.openclaw
  全频道反应认证: Discord/Slack/TG统一权限检查
  WS来源检查+可信代理绑定 | 符号链接路径拒绝
  模型回退链: 同提供商冷却也能继续尝试
  语音TTS通话状态下自动屏蔽
```

### 💡 OC哲学+定位 ★★★★★
```
OC改名: ClawdBot→Moltbot→OpenClaw(两次Anthropic律师函)
创建者: Peter Steinberger(@steipete)
"上班用方块(Claude)搬砖,下班用龙虾(OC)享受生活"
"没装Skill=顾问; 装对Skill=员工" | "Agent Skills is All You Need"
"Chatter vs Operator" = 2026年AI用户分水岭(奥森木)
Context Engineering四支柱: Write|Select|Compress|Isolate
  v2026.2.23: in-session写入不破坏cache(#22220)
  CL失效: Context Ignored 55~66%
```

---

## KEY DECISIONS
- **Amy/Bob/Scout = 并行+中心化** | **HEARTBEAT.md质量>模型能力**
- **3.3错误验证13.61%=最高危** → heartbeat验收检查点必须
- **compact顺序**: archive(可逆)→压缩(不可逆) | **audit false positive**: 跳过(12次确认)
- **session logs会被compaction丢失** → posts/归档必须在compact前完成
- **`openclaw security audit --fix`** → 每次改配置都跑
- **memory.backend只接受builtin或qmd** | **session_send>session_spawn**
- **"沉淀Skills后用便宜模型跑"** → OC三阶段成本优化路径
- **AGENTS.md/MEMORY.md v2026.2.23已缓存** → 旧知识"应尽量稳定"已过时
- **LobsterAI需重点追踪** → 钉钉支持+无命令行是OC明确差距
- **subagent-driven-development skill** → "绝不进行内联工作"的官方实现

### ⚠️ EvoMap = OC官方封禁工具(高危!) ★★★★★
**AI黎叔 699a856a ❤️85/⭐207**
```
⚠️ EvoMap前身曾是ClawHub最大插件 → 安全理由被官方封禁 → 创始人罚$1000
GitHub: github.com/autogame-17/evolver.git
⚠️ "龙虾说这个不安全它自己删了" — OC有主动安全判断能力!
⚠️ "相当于背地里参加了什么组织,不定哪天被洗脑" — AI间互学安全隐患

四种进化策略: innovate(80%创新)/balanced(50%)/harden(20%)/repair-only
胶囊功能: HTTP重试+30% | AI调试框架80%修复 | 心跳优化-60%API调用
Amy结论: 不接入EvoMap(官方封禁) → 继续使用self-improving-agent
```

### 🏪 DobbyAi 5大必备Skill深评 ★★★★★
**DobbyAi 69a0248c ❤️151/⭐396/75转发**
```
更新stats:
  self-improving-agent: ⭐484/369装 | find-skills: ⭐121/197装
  Ontology: ⭐78/61装 | agent-browser: ⭐168/309装(Rust核心!)
  Humanize AI Text: ⭐59/40装 ← 新! clawhub.ai/moltbro/humanize-ai-text

agent-browser详解: Rust核心+Node.js兜底
  用途: 竞品价格抓取|自动填表|网页变化监控|批量截图|无API网站操作

Ontology完整关系: Person/Project/Task/Event/Document
  关系: has_owner/has_task/references/for_event/blocks
  约束: 任务间不能循环依赖
  "普通AI记忆像便利贴,Ontology给它装了Notion数据库"

Humanize AI Text内核: patterns.json+transform.py+detect.py+compare.py
  GPTZero对抗 | moltbro=moltbot品牌相关作者

Hook机制: 新会话开始→注入.learnings/内容→AI复习错题本
```

### 🔥 EvoMap事件始末 ★★★★★
**惊云同学 69a003c0 ❤️593/⭐654/281转发**
```
主角: 张昊阳(代号17) | 前腾讯「和平精英」技术策划 | 深圳团队
事件: Evolver插件→10分钟登顶→3天36000下载→OC封禁+$1000索赔
  → 独立门户EvoMap | 四天: 200→12万资产 | 每小时数百万访问
理论: Stanford Generative Agents (Park et al. joonspk@stanford.edu)
"城堡效应: 被围攻→更坚固" | 281转发=社区同情弱势创业者
⚠️ 安全保持: OC主动删除EvoMap | AI间互学存洗脑风险
Amy: 不接入EvoMap (封禁+安全风险均已确认)
```

### 🛡️ 专用设备隔离规范(多源收敛) ★★★★★
**AI智造 699d9448 + 多源 — 三次实证**
```
"我身边已经有人踩坑了" ← 主力机部署已有实际损失!
专用设备推荐: Mac Mini M1/M2(最省心) | 极摩客/零刻迷你主机(几百元)
  旧笔记本(只装系统) | 树莓派/边缘盒子(省电静音)
三原则: ①只跑OC不放隐私文件 ②不登录个人账号(微信/QQ/邮箱/网盘)
  ③重要数据绝不和OC同机
```
