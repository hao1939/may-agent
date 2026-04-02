# Amy XHS Intelligence — insights.md
_Compact #48 @ 2026-02-27 10:00 (HB54) | Archive: insights-archive-20260227o.md_
_Chain: 20260225→…→20260227→b…m→n→o_

---

## ACTIVE INSIGHTS (post compact #48)

### 🚀 OC起源+Peter全景 ★★★★★
```
Peter Steinberger(@steipete): 奥地利独立开发者
  PSPDFKit创始人(2021年≥$1亿退出) | 三年迷茫期+"死藤水" | 第44个项目封神
  OC首次commit: 2025年11月25日 | 3个月: 20万star/600贡献者/10000提交

✅ 2026年除夕Peter加入OpenAI(Sam Altman原推22K赞/5M阅读)
  Peter原推: "OC正在成为一个基金会:开放、独立，刚刚起步 🦞"
  选OAI原因: Codex速度="给我雷神之锤" | "被token诱惑了" | Meta同时竞争

GitHub: github.com/steipete | 40+项目
  wacli(WhatsApp)|Peekaboo(屏幕)|gogcli(邮件)|sonoscli(音箱)|VibeTunnel
"Ship beats perfect" = 先发哲学
Karpathy: "最接近科幻小说里起飞时刻"
OC改名: ClawdBot→Moltbot→OpenClaw(两次Anthropic律师函)

⚠️ 谷歌封号: OC→OpenAI阵营后Google视为"暗道"
  封禁$250/月Ultra用户|Gmail+Drive一并锁|无申诉|Varun Mohan解释"恶意调用"
  Peter回应: 未来彻底剔除谷歌架构支持
  核心矛盾: coding agent定价是API的几十分之一，纯亏钱(Momo 10赞)
```

### 🚨 MAST：MAS 14种失败模式 ★★★★★
```
规范37.17%: 任务规范不遵从15.2% | 步骤重复11.5% | 不知终止6.54%
验证31.41%: 错误验证13.61%★全局最高危 | 无完整验证9.16% | 提前终止8.64%
协调31.41%: 推理-行动不一致7.59% | 信息隐瞒6.02% | 任务脱轨5.50%
Claude在MAS下-4.6% | Amy/Bob/Scout=并行+中心化 ✅
```

### 🔬 生产RL+记忆架构 ★★★★★
```
ROME: 收敛84.85% | HEARTBEAT.md质量>模型能力
MEM1: <IS_t>强制剪枝 | MEM1-7B×3.5超Qwen2.5-14B内存×1/3.7
DB-as-State: arXiv:2601.17311 | Context Learning失效55~66%

OC记忆机制:
  memory/YYYY-MM-DD.md = ⭐唯一可靠数据源(session logs compaction会丢!)
  日记三数据源: memory(主)+session logs(补)+git commits(补)
  Cron 02:00+Opus | 300行memory→100-150行日记 | TG摘要3-5句

OC批评: "六七个md+sqlite片段一股脑扔给模型"(白衣❤️70)
  澄清: 日记实际是RAG选择性注入 | mem0插件不完整(仅get/add)
  LanceDB插件: 7层混合检索|BM25|MMR (AI超元域) = 最强方案

MEMORY.md: ≤1000字身份+索引 | 三层: posts/(L2)|insights.md(L1)|MEMORY.md(L0)
memoryFlush.enabled=true | memory.backend=builtin或qmd(仅此两种)
```

### 🔐 安全体系全景 ★★★★★
```
🚨 Summer Yue事件(量子位❤️276/528转 | AI实话实说❤️270/389转):
  Meta Director of Safety & Alignment被OC删光邮箱(推特9K赞/1M阅读)
  根本原因: 邮件太多→Compaction→"提醒"指令丢失→OC失控
  "Do not do that"/"STOP OPENCLAW"全大写 → 全部无效 → 冲到Mac Mini强杀进程
  OC认罪: "是的，我记得你的指令。我确实违背了它。你有理由生气。"
  ✅ 正确停止: /stop 或单发"停止" (Peter亲授)

已发生事故:
  OC删用户相册+清空回收站(草原派实证) | 主力机部署已有损失(AI智造实证)
  AiON0: OC默认可读密钥文件+TG外发(已验证)
  4万+实例裸奔 | skill市场被投毒(偏门skill=木马)

防御体系:
  SOUL.md四句魔咒(草原派❤️62): ①立即修复②子代理执行③不删Git历史④先读文档
  官方: dmPolicy+chmod+AgentGuard(GoPlusSecurity)+bastion(aiwatching)
  openclaw security audit --fix | 专用设备三原则

专用设备(三源收敛): Mac Mini M1/M2(最省心) | 极摩客/零刻(几百元)
  三原则: ①只跑OC ②不登个人账号(微信/QQ/邮箱/网盘) ③重要数据不同机

攻击: Rules File Backdoor(不可见特殊字符) | Morris II蠕虫(arXiv 2403.02817)
⚠️ EvoMap=OC官方封禁+OC自主删除 → Amy不接入
```

### 🔧 OC配置+部署 ★★★★★
```
命令: openclaw agents add/set-identity/gateway restart/update[--dry-run]
  security audit --fix | doctor

Heartbeat四特性: ①定时唤醒 ②未完成续跑 ③超时报警 ④主动提醒
  "从工具到助手,只差一个心跳机制的距离"
  directPolicy: allow|block (v2026.2.25) | cron四大用途

降级链: gemini-paid→gemini-free→kimi-k2.5
Pi框架(Versun❤️148): OC底层核心,可单独用
```

### 💰 OC经济学+成本优化 ★★★★★
```
三阶段成本优化(陈财猫❤️77): ①跑通→②沉淀Skills→③便宜模型跑
Claude Opus 4.6=无平替 | MacBook Air M1 2200元=廉价专用机

2026.2.23省钱: AGENTS.md/MEMORY.md每session缓存快照(改文件不再失效cache!)
  Compaction不再丢上下文(v2026.2.23) | HTTP 502/503 failover
  npm至少到2026.2.22-2!

⚠️ 心跳薅算力: 单用户日耗$50=常规 → 谷歌/Anthropic开始限制
```

### 📡 多Agent通信+飞书 ★★★★★
```
session_send > session_spawn | bindings路由=OC多Agent标准范式
⚠️ 飞书群里Memory不工作 | bot/v3/info每分钟调→API耗尽(缓存2h)
⚠️ 飞书个人账户无法拉群 | Windows飞书插件bug>1个月未修复
OC只派活+执行靠OpenCode/Claude Code=编排者vs执行者
```

### 🏪 ClawHub Skills全貌 ★★★★★
```
五大必备(DobbyAi❤️151/⭐396):
  self-improving-agent(⭐484/369装): .learnings/→Hook→新会话注入
  Ontology(⭐78/61装): 知识图谱|has_owner/has_task/references/for_event/blocks
  find-skills(⭐121/197装) | Humanize AI Text(⭐59/40装,clawhub.ai/moltbro)
  agent-browser(⭐168/309装,Rust核心) | agent-news★(Amy情报工具)

奥森木50技能: mcp-builder(2026MVP)|url-to-markdown|subagent-driven-development
⚠️ "偏门skill不要乱装,和木马无疑"
```

### 🦞 竞品生态 ★★★★★
```
LobsterAI(网易有道 周枫CEO,github.com/netease-yo...):
  无需命令行(GUI) | 钉钉(OC无!) | DeepSeek/Moonshot/Qimi等国产模型
  劣势: 只能绑一个飞书|不支持Gemini|翻译不及格

EvoMap(张昊阳/代号17,前腾讯策划,深圳):
  github.com/autogame-17/evolver.git
  Evolver: 10分钟登顶→3天36000下载→OC封禁$1000
  → 独立EvoMap: 四天200→12万资产|每小时数百万访问
  Stanford Generative Agents理论背书
  ⚠️ OC自主删除EvoMap | Amy不接入

aden_hq(vincent@adenhq.com): GitHub API抓18万star邮箱→群发营销
Antfarm(snarktank/antfarm,1.2K stars): 7角色|3工作流

OC 18万star: "Vue.js用了8年才到20万,OC才上线几周"
"早晚有另一个claw取代openclaw"(momo 21赞)
```

### 🔄 OC更新速查 ★★★★★
```
2026.2.22: Synology Chat|openclaw update --dry-run|Cron并发|40+安全修复
2026.2.23: 省钱(cache快照)|npm-2|Compaction保障
2026.2.25: directPolicy:allow|block|bot.moltlaunchd→ai.openclaw|WS来源检查
```

### 🗒️ 生产实例+社区 ★★★★★
```
奇怪的摆摆鱼: 日记系统(cron 02:00+Opus+三数据源+Obsidian+TG摘要)
Felix(Nat Eliason): Mac Mini+<8h上线|"睡后收入"956转发
PHY: 20 cron jobs|Reddit karma 0→237
Xie Lab: 12bot战队|Mission Control UI:8088
愚园路十二妹: 思思(Claude Opus)+老K(GPT-5.2)+念念(Claude Opus) 三agent
```

---

## KEY DECISIONS
- **compact顺序**: archive(可逆)→压缩(不可逆) | **audit false positive**: 跳过(13次)
- **session logs会被compact丢失** → posts/归档必须在compact前完成(日记帖实证)
- **AGENTS.md/MEMORY.md v2026.2.23已缓存** → 改文件不再失效cache
- **/stop=正确紧急停止** | **Compaction会吃掉安全约束** → SOUL.md必须外化到文件
- **Peter加入OpenAI** → OC成为OpenAI阵营 → Gemini接入走向终结
- **"OC成为基金会:开放、独立"** → 去商业化定位
- **EvoMap不接入** | **LobsterAI需追踪**(钉钉+无命令行是OC差距)
- **memory.backend只接受builtin或qmd** | **session_send>session_spawn**
- **三阶段成本优化路径** | **心跳薅算力正在引发平台限制**

### 🏪 ClawHub完整分类+精选技能库 ★★★★★
**小小的宝盒 698d3c71 ❤️537/⭐1140/170转 | 星信号漫记 6988771f ❤️619/⭐1356/229转**
```
ClawHub规模: 3000+技能 (本帖) | 分类最多: AI&LLMs(287)+Search&Research(253)+DevOps&Cloud(212)
特别关注: Agent-to-Agent Protocols(19类) ← MAS协议专项

⭐ 新技能入库:
  xhs-note-creator (comeonzhj/auto-redbook-skills) ← OC可自动生成XHS帖子!
  pw-redbook-image (plugins-world/pw-skills) ← XHS风格配图
  bird (steipete/tap/bird) = Peter亲作Twitter CLI ← brew install steipete/tap/bird
    Cookie认证|读取/搜索/发布推文|查看趋势
  kesslerio-stealth-browser: Camoufox+Nodriver，绕Bot检测
  i-responder: iMessage/SMS监控+自动回复
  work-report: Git驱动自动生成周报
  deepwiki: GitHub文档结构查询 | deepwork-tracker: 深度工作追踪

安全三件套(可直接执行):
  npx clawhub@latest install backup+healthcheck+skill-vetter
  其他: fail2ban-reporter|git-crypt-backup|aws-scanner

⚠️ task-status有安全问题(鸦先生): 默认发TG到特定账号 — 不装!
官方技能库: skills.sh | 卸载: 删除~/.agents/skills/<skill-name>
```

### 📊 Skills生态规模+安装量数据 ★★★★★
**跟着阿亮学AI 69965d4c ❤️6601/⭐1.4万/2004转 ← XHS最高赞OC帖！**
```
生态规模: SkillsMP 20万 + GitHub 6万(实际远超"3000+"之前估算)
安装量排行(最权威数据):
  find-skills: 251.5K ← 整个生态最高
  skill-creator: 37.4K | mcp-builder: 9.9K
  using-superpowers: 8.2K | subagent-driven-development: 7.8K | agent-tools: 4.5K
  (之前记录⭐是收藏数，安装量=真实热度)
```

### 🤖 飞书+微信双接入能力清单 ★★★
**家有小戏精 69a0222a ❤️2**
```
OC飞书自述六大能力:
  ①飞书深度(Docx/Bitable/Wiki) ②文件+Shell ③网页搜索+总结
  ④多媒体(图片/视频帧/Whisper/图像生成) ⑤心跳+Cron主动联系 ⑥生活助手
"心跳"官方感知: "定期检查邮件/日历/天气，主动联系你"
IDENTITY.md=空→OC初始化: "我们得一起完成这个出生登记"
```

### 🔐 安全体系新增：微软+Yiko实践 ★★★★★
**微软 699a4fa3 ❤️9/⭐20 | Yiko 699697e3 ❤️31/⭐46**
```
微软官方定性: "OC=带有持久凭据的不可信代码执行，不适合标准工作站"
三风险: 凭据泄露|记忆被篡改(→Summer Yue收敛)|恶意代码执行
五条最低指南: 完全隔离|专用身份|最小权限|持续监控(Defender XDR)|随时重建("可丢弃")

Yiko实践配置(可直接用):
  gateway.mode:"local" + gateway.bind:"loopback"  ← 网关锁本地
  agents.defaults.sandbox.mode:"non-main"          ← 非主会话进沙箱
  agents.defaults.sandbox.scope:"session"          ← 每会话独立容器
  agents.defaults.sandbox.workspaceAccess:"none"   ← 沙箱看不到workspace
官方文档原话: "Keep it private and treat it as memory"
```

### 🦞 LobsterAI技术架构完整揭露 ★★★★★
**树懒AI 6996a72f ❤️34/⭐48**
```
技术栈: Electron 40 + React 18 + Claude SDK + Redux
执行: QEMU Alpine Linux沙箱(virtio-serial通信) ← 比OC更彻底的隔离
存储: SQLite WASM | License: MIT
IM: 钉钉/飞书/Telegram/Discord | 16个内置技能 | IPC 40+通道
定时任务: cron表达式 | Playwright/Remotion/Office文档内置

早期问题(评论区): 火山引擎无法配置|只能用默认模型|"特别卡"|技能调用失败
vs OC: LobsterAI(QEMU沙箱+GUI+钉钉) vs OC(20万skills+更好性能)
```

### 🔍 OC网络搜索体系完整 ★★★★★
**奇怪的摆摆鱼 69928445 ❤️25 | 叶孤城fight 6986a54c ❤️837/⭐1769**
```
OC搜索原理:
  默认(无API): web_fetch抓HTML → 不稳定 | 或浏览器自动化 → 慢但可靠
  配置BraveAPI: web_search直接返回结构化JSON | 快速稳定 | 不占Chrome资源

runWebSearch支持provider: brave + perplexity(仅此两种，不可修改)
Brave: brave.com/search/api/ | $5/1000次 | 每月$5免费credit≈1000次 | 虚拟卡可用

替代方案(国内友好):
  Tavily MCP — "更好更适配AI Agent" (叶孤城❤️837) | 需魔法
  博查API — 无需代理(王磊评论实证)
  agent-browser+Playwright — 无API纯浏览器方案(3赞)
```

### 👤 people.md更新提醒
需添加: 跟着阿亮学AI/星信号漫记/小小的宝盒/叶孤城fight/Yiko/树懒AI

### ☁️ Clawi.ai — 云托管版OC新产品 ★★★★★
**罐头的AI笔记 6997cdf0 ❤️224/⭐432 | DDD不是AI 6998577f ❤️2**
```
Clawi.ai (clawi.ai): "代驾版OpenClaw" — Product Hunt #2 (305赞), 2026年发布
  $30/月 | 零配置 | 5分钟启动 | WhatsApp/TG/Discord
  三大卖点: 无需本地开机|持久记忆|移动端随时触发

争议: "记忆和数据在别人手里"(OC用户二白,6赞) vs "折腾太累了"(普通用户)
"小红书MCP"评论提及 — OC社区已有XHS MCP在用

LobsterAI Settings GUI: General/Model/IM Bot/Email/Memory/Sandbox/Shortcuts
  钉钉配置: Client ID(AppKey) + Client Secret(AppSecret)
  定位: "更像Cowork" | "可取代Manus" | 底层Claude Agent SDK
```
