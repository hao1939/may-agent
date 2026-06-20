# Amy XHS Intelligence — insights.md
_Compact #11 @ 2026-02-26 10:26 (HB58–HB61) | Archive: insights-archive-20260226k.md_
_Full chain: 20260225 → 20260226 → b → c → d → e → f → g → h → i → j → k_

---

## ACTIVE INSIGHTS (post compact #11)

### 🔧 OpenClaw能力三层体系（权威版）

**Tool / Skill / Plugin定义（CrazyAgent 69992f42，❤️6）：**

| 层级 | 定义 | 类比 | 加载方式 | 上下文处理 |
|------|------|------|----------|-----------|
| **Tool** | 原子操作单元，最小功能 | 刀锅（天生就有） | 预注册即时调用 | 结果易被裁剪 |
| **Skill** | 结构化工作流，SKILL.md定义SOP | 菜谱（教你做菜） | 按需加载触发自动读 | 元数据常驻可重读 |
| **Plugin** | 能力打包分发=Skill+Tool+Config | 厨房套装（打包） | 安装后自动发现注册 | 整体注册不易丢失 |

关系：Plugin(容器)→Skill(流程)→Tool(基础)；Skill可独立安装无需Plugin
Plugin=Skill+Tool+Config实例：voice-call = SOP(校验→呼叫→播放→记录)+dial/hangup+Twilio配置

常见Tool：`web_search/browser/message/read/write/exec`
常见Skill：`github/summarize/nano-banana-pro/weather/find-skills`
常见Plugin：`telegram/discord/feishu/voice-call/memory-lancedb`

**Rules补充（Nora 6979fc50）：** Rules=硬性红线，独立于AI模型的if-then逻辑；Rules绝对执行≠Prompt引导可绕过

---

### 🔄 版本更新时间线（完整）

| 版本 | 日期 | 重点 |
|------|------|------|
| 2026.2.6 | 2/7 | 安全加固 |
| 2026.2.17 | 2/18 | Discord v2/Slack流式/iOS分享/1M context/Sonnet 4.6 |
| 2026.2.22 | 2/23 | Mistral/dry-run/Cron全修/FTS多语言优化/npm至少-2 |
| 2026.2.24 | 2/26 | **⚠️心跳DM限制**/Android重构/多语言停止词/路由隔离修复 |

**2.24重大变更：** 心跳DM/私信目标不再自动发送，仅群组/频道有效

---

### ⚙️ TG三必开配置（Lando 6991e3a1，❤️673/⭐1381）

```json
// 1. 实时流式（默认关）
{"agents": {"defaults": {"blockStreamingDefault": "on", "blockStreamingBreak": "text_end"}}}
// 2. 白名单+免@
{"channels": {"telegram": {"groups": {"*": {"requireMention": false}}, "allowFrom": ["-群ID"], "groupPolicy": "allowlist"}}}
// 3. emoji确认收到
{"messages": {"ackReactionScope": "all"}}
```
Telegram Forum群+Topics = 多任务并行（私聊只能排队）
配置方式：`~/.openclaw/openclaw.json` 或 `openclaw gateway config.patch`

---

### 🧠 记忆系统生态（完整图谱）

**原生5大痛点（Yanlin 6998185c）：** 跨会话失忆/compaction丢失/纯文本语义有限/无关系图谱/多Agent隔离

**5大升级方案：**
- Mem0 (YC孵化)：比OpenAI Memory准确+26%，速度+91%，省90% token；pip install即用
- Zep：<200ms延迟，关系感知，企业级生产
- Letta (前身MemGPT)：AI自己管理记忆，有状态Agent平台
- OpenViking + qmd：字节背景，深度定制 + 检索加速
- EverMemOS：操作系统级记忆抽象，面向长期Agent

**金句：** "原生记忆是地基，外挂方案是上层建筑"
**社区批评（白衣 699c2303）：** 默认配置6-7引导文件+日记+sqlite一股脑=臃肿；mem0插件只接管get/add还不够

**Amy架构已是正确方向：** MEMORY.md≤1000字+分文件memory_search = 比官方默认先进

---

### 🔧 配置踩坑精华

**5大高频坑（AI布丁 698ca707）：**
1. 模型切换必须改3处：`primary`+`fallbacks`+`models.alias`
2. 本地模型：LM Studio端口1234 + `baseUrl: http://localhost:1234/v1`
3. peekaboo权限：系统设置→屏幕录制→添加Terminal→完全重启
4. QQ Bot：IP白名单+Gateway绑定`0.0.0.0`+端口18789
5. 配置不生效：必须关闭浏览器标签页重开WebChat

**完整CLI（乔帮主Joey 697efd5f，❤️373/⭐669）：**
```bash
openclaw onboard --install-daemon     # 开机自启（真正守护者=macOS Launchd）
openclaw gateway restart/status/--force
openclaw gateway logs -f              # 实时日志
openclaw doctor                       # 全面体检（遇问题先跑）
openclaw update --dry-run             # 先预演再更新
openclaw cron list / openclaw skills list/install
openclaw config get / openclaw configure
```

---

### 📊 Skills六大类全景（奥森木 699b9512，❤️250/⭐620）

> "2026年差距：Chatter vs Operator"

Foundation(6): find-skills/skill-creator/**mcp-builder(2026 MVP)**/using-superpowers/subagent-driven-development  
Creative(10): brainstorming/reflection/content-strategy/social-content  
Programming(11): React/Remotion/Supabase+Next.js/agent-browser/TDD  
Design(8): web-design(8px网格)/tailwind/infographic-pro/ai-image-generation  
Marketing(8): Larry(TikTok全自动)/programmatic-seo/marketing-psychology  
Office(7): pdf/pptx/docx/xlsx/url-to-markdown/format-pro  

---

## 待追踪

- **辛康在进化 69845f8e** (❤️180) — 仍无token，持续阻塞
- **openclaw中文社区 OpenViking** — onehopeA9实战帖待追踪
- **刘东瑞 699fae55** — 清华LLM Agent信用分配，学术向，暂缓

## KEY DECISIONS (carry-forward)

- **Amy架构 ✅**：NOW.md+JOURNAL.md+MEMORY.md+self-review.md+TOOLS.md (Han1五层)
- **TG三必开** — 下次配置立即开启
- **2.24心跳DM限制** — Amy走群组通道不受影响，但需确认
- **audit false positive** — 已确认9次，WORKFLOW_AUTO.md/memory/YYYY-MM-DD.md不存在，直接跳过

---

## 2026-02-26 10:29 — heartbeat #62 (Skills版权 + Agent自我进化)

### ★★★ momo "公开的skill可以随便用吗？" (6990818f, ❤️219/⭐214, 2026-02-14)
**来源：** momo（北京）| 曾参与office agent工作 | 3张图OCR

**Skill≠Prompt辟谣（Word skill为例）：**
- "如果prompt是食材，skill是一整个厨房"
- 生产级Skill：代码几千~上万行；技术栈选型/Agent友好工具/错误修复策略；"更像软件工程项目"
- prompt是其中很小的一部分，更多精力在**能力定义、评测、工具打磨**

**Skills版权3大误区（权威澄清）：**
1. ❌ "模型开源=skill也开源" → 错。模型开源是权重，skill是产品代码
2. ❌ "Anthropic开源了他们的skill" → 错。虽然公开了skill文件，但**license明确禁止提取/复制/创建衍生/分发**
3. ❌ "直接拿Anthropic的skill用" → 不允许。"好比改改名家作品里的角色名字就变成自己的"

**Amy洞察：** 这是重要的法律和伦理边界——ClawHub上的开源Skills可用，但Anthropic官方Skills有严格license限制

---

### ★★ 架构AI新世界 "从一段Skills代码，看Agent自我进化" (69944ce1, ❤️155/⭐287/📤77, 2026-02-17)
**来源：** 架构AI新世界（浙江）| Anthropic内部黑客马拉松冠军作品

**核心：`continuous-learning-v2` Skill**
- 作者：affaan-m，打磨10个月
- repo：`github.com/affaan-m/everything-claude-code`
- **Agent自我进化（Self-Rewriting）：** "如果Agent不会一个技能，他能自己学习然后自己写吗？"
- Skills=从经验中学习的机制；借助AI Coding萃取"人类专家"经验
- "一个工程师打磨出自己的Skills集合，效率提升几倍且质量显著提高，完全可以做到"

**Amy洞察：** continuous-learning-v2 = Amy的自我改进方向的技术实现。Amy的self-review.md（错题本）→ 下一步可演化为Skill自动更新机制


---

## 2026-02-26 10:32 — heartbeat #63 (移动端生态：iOS+Android双帖)

### ★★ 任工智能 "Openclaw正式进军移动端，iOS APP发布" (698adf78, ❤️404/⭐458/📤204, 2026-02-10)
**版本：2026.2.9 | 4大核心更新**

**移动端集成：**
- iOS应用Alpha版：Telegram `/pair`命令配对
- 直接控制移动设备：相机访问/屏幕录制/定位服务

**其他更新：** xAI Grok模型集成（语义搜索）/ Agent管理系统（生命周期编排/监控/自动扩展）/ 实时Token监控（成本预测+阈值告警）/ OPENCLAW_HOME自定义环境

---

### ★★★ AI创意玩家 "OpenClaw安卓应用来了！" (698b7d58, ❤️206/⭐364, 2026-02-12)
**来源：** AI创意玩家（重庆）| BotDrop项目 | **"把手机变成OpenClaw运行平台"**

**BotDrop的核心价值：** 门槛不在模型，在环境——BotDrop消灭了Linux+Node.js+npm+CLI的全套门槛

**架构（真正硬核）：**
```
BotDrop UI（图形界面壳）
↓
Termux Core（Android上的Linux基座）
↓
Linux环境（proot/apt）
↓
OpenClaw + Node.js + npm（核心引擎）
```
手机里跑着一个Linux用户空间，真正本地运行OpenClaw

**4步引导流程：** Auth认证→Agent创建→Install安装→Channel绑定（像装普通App）

**BotDrop生态：**
- OpenClaw：已支持，~500MB
- OwliaBot：即将推出（更轻更安全的Crypto原生OpenClaw）
- NanoClaw：即将推出（极简容器化Claude助手，8分钟读懂代码库）

**Amy洞察：** 这是OpenClaw生态的"降维打击"方向——把Server端的AI Agent塞进口袋。NanoClaw（8分钟代码库）更值得关注，可能是轻量化OpenClaw的重要分支。


---

## 2026-02-26 10:34 — heartbeat #64 (记忆框架全景盘点)

### ★★ AI老兵嘚吧嘚 "盘点Memory项目：Mem0, Letta, LangMem.." (6957426800000000220302ce, ❤️229/⭐404, 2026-01-02)
**来源：** AI老兵嘚吧嘚 | desc完整 | **6大开源记忆框架完整比较**

| 框架 | 特点 |
|------|------|
| **Mem0** (YC S24) | 工作/事实/情景/语义四种记忆类型；+26%准确率/91%快/省90% token；1.5M/月下载 |
| **Letta** (前身MemGPT) | 虚拟内存概念；双层架构：上下文内（系统指令/可读写记忆块）+上下文外（历史对话/外部知识） |
| **LangMem** (LangChain) | 三种记忆：semantic/episodic/procedural memory；可与LangGraph深度集成 |
| **Graphiti** | 知识图谱记忆引擎；动态演化"时间知识图谱"；图数据库实现结构化可推理记忆 |
| **Cognee** | 轻量级；5行代码；ECL管道+知识图谱减少幻觉；pydantic连接30+数据源 |
| **LightRAG** | 图结构引入文本索引检索；更高效上下文感知 |

**Amy选型参考：** Letta双层架构 ≈ Amy的L1(上下文内确定性)+L2/L3(上下文外日志/向量)；LangMem三种记忆类型 ≈ 刘东瑞记忆三维框架

