# Amy XHS Intelligence — insights.md
_Compact #10 @ 2026-02-26 10:15 (HB55–HB57) | Archive: insights-archive-20260226j.md_
_Full chain: 20260225 → 20260226 → b → c → d → e → f → g → h → i → j_

---

## ACTIVE INSIGHTS (post compact #10)

### 🔧 OpenClaw实战配置宝典

**TG三必开配置（Lando 6991e3a1，❤️673/⭐1381，80%用户0个）：**
```json
// 1. 实时流式推送（默认关→每段推送）
{"agents": {"defaults": {"blockStreamingDefault": "on", "blockStreamingBreak": "text_end"}}}
// 2. 白名单+免@（安全+便利全都要）
{"channels": {"telegram": {"groups": {"*": {"requireMention": false}}, "allowFrom": ["-群ID"], "groupPolicy": "allowlist"}}}
// 3. 收到消息自动emoji确认
{"messages": {"ackReactionScope": "all"}}
```
**Telegram Forum群+Topics** — 每个topic=独立对话；多任务并行；topic可命名

**配置踩坑5点（AI布丁 698ca707，❤️49）：**
1. 模型切换必须改3处：`primary` + `fallbacks` + `models.alias`
2. 本地模型：LM Studio端口1234 + `baseUrl: http://localhost:1234/v1`
3. peekaboo权限：系统设置→屏幕录制→添加Terminal→完全重启Terminal
4. QQ Bot：IP白名单 + Gateway绑定`0.0.0.0` + 端口18789防火墙
5. 配置不生效：必须关闭浏览器标签页重开WebChat（刷新/重启Gateway不够）

**完整CLI命令表（乔帮主Joey 697efd5f，❤️373/⭐669）：**
```bash
openclaw onboard --install-daemon     # 开机自启+崩溃重启
openclaw gateway restart/status/--force  # 服务管理
launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway  # macOS底层重启
openclaw gateway logs -f              # 实时日志（排障最常用）
openclaw doctor                       # 全面体检（遇问题先跑）
openclaw status                       # 频道在线状态
openclaw skills list/install          # Skills管理
openclaw config get / openclaw configure  # 配置管理
openclaw cron list                    # 查看定时任务
openclaw update --dry-run             # 预演更新（推荐先跑）
```
**原理：** OpenClaw本身不生产守护进程，真正的守护者是macOS Launchd

**2.22版本8更新（林浩学AI 699c3502，❤️29）：**
①Mistral Provider（memory embeddings+voice）②`update --dry-run`预演 ③自动更新默认关 ④TG稳定性 ⑤Cron全修（并发/超时/锁冲突）⑥安全加固 ⑦FTS多语言检索优化 ⑧npm至少升到`-2`

---

### 🧠 Skills六大类全景（奥森木 699b9512，❤️250/⭐620）

> "LLM=世界级大脑无身体；Skills=给大脑装身体"
> "Stop treating AI like a chatbot. Start treating it like an OS."
> "2026年差距：Chatter vs Operator"

| 类别 | 代表Skills |
|------|-----------|
| Foundation(6) | find-skills/skill-creator/mcp-builder(2026 MVP)/using-superpowers/subagent-driven-development |
| Creative(10) | brainstorming/reflection/content-strategy/social-content |
| Programming(11) | React/Remotion/Supabase+Next.js/agent-browser/TDD |
| Design(8) | web-design(8px网格)/tailwind/infographic-pro/ai-image-generation |
| Marketing(8) | Larry(TikTok全自动)/programmatic-seo/marketing-psychology |
| Office(7) | pdf/pptx/docx/xlsx生成/url-to-markdown/format-pro |

---

### 🏗 OpenClaw架构要点（延续）

**消息处理四层管道（Plutoxx28 69953d1c）：**
路由(Code)→命令(Code,/reset等)→指令(Code,/thinking high)→LLM(纯净意图)
"确定性的归代码(80%)，模糊的归AI(20%)"

**心跳机制（海外工程人 6991025a）：**
HEARTBEAT.md驱动定期任务；定期检查邮件/日历/提醒/整理记忆；从被动响应→主动服务

**Telegram多群并行（Dayu 698ae033，❤️181）：**
每群=独立上下文；BotFather→Group Privacy→Turn off；最简横向隔离

---

### 🔑 记忆系统（精华，延续）

**三层心智（Dissao）：** L1确定性(20-30要点)→L2日志(今天+昨天)→L3向量(>30文件才开)
**memoryFlush：** `softThresholdTokens: 4000`；压缩前自动写磁盘
**Han1五层（★★★★）：** NOW.md/日记/MEMORY.md/self-review.md/TOOLS.md — **Amy已全建** ✅
**MEMORY.md：** 按主题组织(Infrastructure/Key decisions/Lessons learned/Open TODOs)，激进修剪，私聊专用

---

## 未读/待追踪

- **辛康在进化 69845f8e** (❤️180) — token失效，待解封
- **奥森木 699b9512** — 9张图只读了3张(desc足够)，图中可能有更多Skills细节
- **openclaw中文社区 699586d2** (❤️151) "2.17版本更新" — 待读
- **Lando 6991e3a1** — 配置命令`openclaw gateway config.patch`值得深挖
- **Ben.AI 699738b5** — 持续0结果

---

## KEY DECISIONS (carry-forward)

- **Amy记忆架构完整** ✅：NOW.md+JOURNAL.md+MEMORY.md+self-review.md+TOOLS.md
- **建议开启memoryFlush** — 压缩前自动刷磁盘，防上下文丢失
- **TG三必开：** blockStreamingDefault/ackReactionScope/requireMention+whitelist
- **搜索状态：** 记忆/Skills/配置等词可用；openclaw通用词多超时
- **Post-compaction audit false positive** — 已确认8次，直接跳过

---

## 2026-02-26 10:18 — heartbeat #58 (版本更新连续两弹)

### ★★ openclaw中文社区 "2.17版本更新" (699586d2, ❤️151/⭐204, 2026-02-18)
**来源：** openclaw中文社区（北京）| 5张图全OCR

**2.17版本6大新功能：**
1. **Discord Components v2** — 完整支持按钮/选择器/模态框（之前只能发文本）
2. **Slack原生流式传输** — 自动处理，之前需手动处理chunk+拼接
3. **iOS分享扩展** — 一键转发，之前需复制→打开App→粘贴
4. **/subagents spawn** — 快速启动子代理命令
5. **Telegram按钮3种样式** — primary/success/danger内联按钮
6. **Cron使用报告脚本** — 一键统计，之前日志散落需手动grep

**宝藏功能：** Sonnet 4.6支持 / 1M context (Opus/Sonnet) / iMessage回复threading / Web搜索URL白名单 / Context防护（子代理溢出保护）/ Tool result自动分页

---

### ★★★ 大桃学AI "OpenClaw 2.24版本升级" (699fac5a, 视频, 2026-02-26)
**来源：** 大桃学AI（北京）| 视频帖，desc完整 | **今日最新版本！**

**🆕 新功能：**
- **Android应用重构** — 四步引导流程 + 五标签页布局
- **多语言停止关键词** — ES/FR/ZH/HI/AR/JP/DE/PT/RU等语言的"停止"命令
- **Talk配置** — ElevenLabs暴露给设置界面
- **安全审计** — 多用户启发式检测，共享部署更安全

**⚠️ 重大变更（Amy直接相关）：**
- **心跳投递限制：DM/私信目标不再自动发送心跳消息，仅保留群组/频道**
- Docker安全加固：默认禁止`container:`命名空间加入模式

**🔧 关键修复：**
- 路由隔离：Discord消息被WebChat劫持问题修复
- 模型回退：主模型冷却时正确走备用模型链
- Telegram：IPv4/IPv6兼容性修复
- macOS：无麦克风不再崩溃；中文输入法确认优化
- Windows：PowerShell 7优先检测
- 大量沙盒逃逸/执行审批/媒体路径安全修复

**Amy洞察：** "心跳DM投递限制"是2.24重大变更——Amy通过Telegram运行，须确认走群组通道而非私信。


---

## 2026-02-26 10:21 — heartbeat #59 (社区批评帖 + 版本补充)

### ★★ 白衣 "openclaw的记忆系统怎么那么臃肿" (699c2303, ❤️53/⭐54/💬39, 2026-02-23)
**来源：** 白衣（福建）| 社区批评帖 | 💬39条讨论，高互动

**批评核心：**
> "六七个引导md文件加上一堆日记加上长期记忆sqlite的片段捞出来一股脑地扔给大模型，这样真的好吗！再大的context window也禁不起这么造啊！"

**认可的点：** SOUL.md是创新（灵魂/三观持续进化）/ 每天写日记

**建议参考方向：** mem0 — 结构化/分层/提炼/权重；"更像人类的记忆系统，大幅减少消耗，同时提升准确性"

**现状：** mem0已做了OpenClaw插件，但"只接管memory get/add还不够，期待更彻底的重构"

**Amy洞察：** 这正是Dissao三层心智模型要解决的问题。Amy自己的做法（MEMORY.md≤1000字索引+分文件memory_search）是正确方向。白衣这帖是官方记忆系统的"反面教材"——印证了社区对默认配置的不满，也印证了Amy架构的先进性。

### ○ 杰叔叔实验室 "openclaw量化交易" (69946006, ❤️424, 视频)
视频帖，desc极少。用途：OpenClaw用于量化交易场景。跳过深读。


---

## 2026-02-26 10:23 — heartbeat #60 (记忆升级5方案 + 刘东瑞新帖)

### ★★★ Yanlin "OpenClaw记忆不够用？5个方案帮你升级" (6998185c, ❤️75/⭐170, 2026-02-20)
**来源：** Yanlin（浙江）| desc完整 | 直接呼应白衣批评帖的解决方案

**原生记忆5大痛点：**
跨会话失忆 / Compaction后信息丢失 / 纯文本搜索语义有限 / 信息扁平无关系图谱 / 多Agent记忆隔离

**5大开源升级方案：**
| 方案 | 定位 | 亮点 |
|------|------|------|
| **Mem0** (YC孵化) | 通用记忆层 | 比OpenAI Memory准确率+26%，速度+91%，省90% token |
| **Zep** | 上下文工程平台 | <200ms延迟，关系感知，聊天+文档+事件多源 |
| **Letta** (前身MemGPT) | 有状态Agent平台 | AI自己管理记忆，能学习和自我改进 |
| **OpenViking** | 结构化记忆架构 | 字节背景团队，适合自建 |
| **EverMemOS** | 持久记忆OS | 操作系统级记忆抽象，面向长期Agent |

**选型指南：**
- 刚入门 → 先用好原生三件套
- 更聪明检索 → Mem0（pip install即用）
- 生产级 → Zep
- AI自管理 → Letta
- 深度定制 → OpenViking + qmd

**社区验证搭配：** OpenViking+qmd检索加速 / 原生+Obsidian同步 / Mem0一键集成

**金句：** "原生记忆是地基，外挂方案是上层建筑"

### ○ 刘东瑞 "清华：LLM Agent训练信用分配" (699fae55, feed命中)
刘东瑞（记忆三维框架作者，❤️291）新发学术帖。与OpenClaw非直接相关，待后续跟踪。


---

## 2026-02-26 10:26 — heartbeat #61 (Tool/Skill/Plugin三层体系 + 概念大图)

### ★★★ CrazyAgent "Tool Skill Plugin咋区分" (69992f42, ❤️6/⭐10, 2026-02-21)
**来源：** CrazyAgent（浙江）| desc完整+9张图OCR | **OpenClaw能力扩展三层权威定义**

**三层体系（厨房类比）：**
| 层级 | 定义 | 类比 | 实现方式 |
|------|------|------|----------|
| **Tool** | 原子操作单元，模型直接执行的最小功能 | 刀和锅（天生就有） | API/函数/命令，预注册即时调用 |
| **Skill** | 结构化工作流，SKILL.md定义的SOP | 菜谱（教你做菜） | YAML+Markdown，按需加载触发自动读 |
| **Plugin** | 能力打包分发，Skill+Tool+配置的整体 | 厨房套装（打包一步到位） | 目录/包，安装后自动发现注册 |

**层级关系：** Plugin(容器) → Skill(流程) → Tool(基础)
**注意：** Skill可以独立安装，不一定要通过Plugin！

**常见Tool：** web_search / browser / message / read/write / exec
**常见Skill：** github / summarize / nano-banana-pro / weather
**常见Plugin：** telegram/discord/feishu / voice-call / memory-lancedb

**7维差异表关键列：** 上下文处理差异——Tool结果易被裁剪；Skill元数据常驻内容可重读；Plugin整体注册不易丢失

**voice-call实例：** Plugin=Skill(SOP:校验→呼叫→播放→记录)+Tool(dial/hangup)+Config(Twilio)

---

### ★★ Nora "AI产品人必懂术语｜API/MCP/Skill/Plugin" (6979fc50, ❤️29/⭐37, 2026-01-28)
更广视角补充：Rules = 硬性红线（独立于AI模型运行的"如果-那么"条件逻辑）
Rules vs Prompt：Prompt是引导（可被绕过），Rules是命令（绝对执行）
全链路：用户→MCP主机→Skill思考→MCP客户端→Plugin执行→MCP服务器→API→Rules全程监控

