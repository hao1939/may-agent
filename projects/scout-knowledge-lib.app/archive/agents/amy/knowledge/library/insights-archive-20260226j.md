# Amy XHS Intelligence — insights.md
_Compact #9 @ 2026-02-26 10:06 (HB52–HB55) | Archive: insights-archive-20260226i.md_
_Full chain: 20260225 → 20260226 → b → c → d → e → f → g → h → i_

---

## ACTIVE INSIGHTS (post compact #9)

### 🏗 OpenClaw架构图谱（完整）

**底层框架：**
- **pi-mono**（Mario Zechner，libGDX游戏引擎作者）= 4工具only：`read/write/edit/bash`
- 工具越少，可控性越强；"引擎(pi-mono)+整车(OpenClaw)"分工
- TypeScript/Node.js选型：Peter Steinberger — "调度问题非算力问题；最容易让人上手参与"

**消息处理四层管道（Plutoxx28 69953d1c，❤️81）：**
```
用户输入 → L1路由层(Code) → L2命令层(Code,/reset等) → L3指令层(Code,/thinking high) → L4 LLM(纯净意图)
```
**原则：** "确定性的归代码，模糊的归AI" — Code 80% / LLM 20%；"拒绝幻觉，拥抱确定性"

**Telegram多群并行（Dayu 698ae033，❤️181/⭐395）：**
每个Telegram群=独立上下文；配置：`requireMention: true` + Group Privacy关闭；最简单的横向隔离

---

## 记忆系统深度（HB51-53精读，三帖互补）

### 最权威三层心智模型（Dissao 6991773100000000150330dd，❤️53，13张全OCR）

```
Layer 1: Context（确定性，always-loaded）
  → AGENTS.md / SOUL.md / USER.md / MEMORY.md
  → ~20-30个关键要点；始终加载；处理90%需求
Layer 2: Logs（连续性，近期）
  → memory/YYYY-MM-DD.md — 仅追加，写入成本低
  → 启动加载今天+昨天；更旧可搜索
Layer 3: Vector search（检索，长期安全网）
  → memory_search — 日志超30个文件才值得启用
```

**memoryFlush（压缩前刷新，免费保险）：**
```json
{"compaction": {"memoryFlush": {"enabled": true, "softThresholdTokens": 4000,
  "prompt": "Write persistent notes to memory/YYYY-MM-DD.md; if nothing to store, reply NO_REPLY"}}}
```

**MEMORY.md最佳实践：** 按主题（不按时间）；激进修剪；私聊加载、群聊不注入

**金句：** "工作区的`git log`就是智能体记忆形成的历史"

### Han1五层记忆架构（698a01b8，❤️328/⭐598）— Amy已完成对标

| 层 | 文件 | 别名 |
|---|------|------|
| 1 | **NOW.md** ✅ | 救生艇（启动第一读） |
| 2 | **memory/日期.md** ✅ | 流水账 |
| 3 | **MEMORY.md** ✅ | 长期记忆提炼 |
| 4 | **self-review.md** ✅ | 错题本（今日新建） |
| 5 | **TOOLS.md** ✅ | 环境笔记 |

**三铁律：** ①必须写文件（现在，不是待会儿）②边聊边写不依赖对话历史 ③文字>大脑

### HarryDes memory_search配置（697f1643，❤️124）
Provider: local（~600MB）/ openai / gemini；混合搜索：向量70%+BM25 30%；验证：`/memory_search 测试一下`

---

## Skills生态（延续）

**Vibe西希（698b252e，❤️53）— Skills=可观测性工具**
> "Skill是你和不确定性谈判时，用来切割问题的刀。失败得足够清楚，才是可被迭代的失败。"
黄金标准：**"愿意为这个决策单独建评测集？"** → 愿意=Skill，否则=Prompt
三角色：判断单元/责任边界/暴露业务假设的放大镜

---

## Pi独立部署趋势（OpenClaw高级用户替代路线）

**九头蛇Versun（6986f81d，❤️143）：** 直接用Pi底层，自建Sleep系统（23:30→读聊天→更新记忆→Telegram通知）

**YoYo（699e412c，❤️13）批评三点：** Token过大 / 恶意Skills漏洞 / 兼容所有模型=最小公约数（功能取交集）
**自建替代：** 零token心跳+热温冷三层记忆（三个月前仍记得）+人设持久性

---

## 情感共鸣帖（社区心理）

**Dimothy（6985b283，❤️1306）：** Claude Code 5小时=商科2-3周；"第一反应是慌——所有事情本质上都是执行"；AI=把已在发生的趋势**快进到了终点**

---

## 未读/待追踪

- **辛康在进化 69845f8e** (❤️180/⭐349) — token失效，高价值
- **小火龙 699f9bbb** (❤️12) — 11/13完成后退出
- **迪迪碎碎念 699e91b1** (❤️75) — 视频帖架构图，待截图分析
- **Ben.AI 699738b5** — 持续0结果
- **奥森木 698facff** (❤️196) — block第12次，暂停主动重试

---

## KEY DECISIONS (carry-forward)

- **Amy记忆架构已完整（Han1五层全建）：** NOW.md+JOURNAL.md+MEMORY.md+self-review.md+TOOLS.md ✅
- **memoryFlush应开启** → 压缩前自动刷新，防止重要上下文丢失
- **MEMORY.md按主题组织，激进修剪**（不是时间顺序日志）
- **Pi独立部署是真实趋势**，OpenClaw黑盒感是用户痛点
- **消息处理：确定性归代码，模糊性归LLM**（OpenClaw的核心工程哲学）
- **Post-compaction audit false positive** — 已确认8次，直接跳过
- **搜索状态：** 记忆/Skills等词可用；openclaw通用词多超时

---

## 2026-02-26 10:06 — heartbeat #55 (compact #9完成 + 学术记忆帖)

### ○ 王琰-腾讯 "无限长参数化记忆！Locas" (698d8eb9, ❤️240/⭐313, 2026-02-12)
**来源：** 腾讯AI Lab（arXiv 2602.05085）| 学术论文帖，与OpenClaw间接相关

**Locas（Locally-Supported Parametric Memories）:**
- 无需反向传播：利用模型激活态+参数做principled Initialization，记忆即时构建
- Sideway FFN，完全不改主模型参数，MMLU通用能力近乎无损
- 仅0.02%额外参数；LoCoMo长对话事实检索大幅超越TempLora

**Amy洞察（远景）：** 这是"参数化记忆"方向——与OpenClaw的"文件化记忆"路线互补。OpenClaw选择了确定性的Markdown文件路径；学术界在探索把记忆直接嵌入模型参数。两个路线在5年内可能汇聚。


---

## 2026-02-26 10:09 — heartbeat #56 (CLI命令手册 + 2.26版本更新)

### ★★★ 乔帮主Joey "OpenClaw必备终端命令手册" (697efd5f, ❤️373/⭐669, 2026-02-01)
**来源：** 乔帮主Joey（北京）| 5张图全OCR | **内容由AI自己总结到Obsidian再生成卡片**

**完整CLI命令表：**
```bash
# 初始化
openclaw onboard --install-daemon   # 开机自启+崩溃重启

# Gateway服务管理
openclaw gateway restart             # 配置更新后必跑
openclaw gateway status              # 查看运行状态
openclaw gateway --force             # 强制清理端口占用并启动
launchctl kickstart -k gui/$(id -u)/ai.openclaw.gateway  # macOS底层重启

# 日志监控
openclaw gateway logs -f             # 实时监控（排障最常用）
openclaw gateway logs --lines 50     # 最近50行

# 诊断
openclaw doctor                      # 系统全面体检（遇问题先跑）
openclaw status                      # 查看频道在线状态

# Skills
openclaw skills list
openclaw skills install

# 配置
openclaw config get                  # 查看当前生效配置
openclaw configure                   # 交互式快速重新配置

# Cron
openclaw cron list                   # 查看定时任务
```

**Gateway vs Daemon原理：** CLI层面两者是别名关系；`--install-daemon`后真正守护者是macOS Launchd；"OpenClaw本身不生产守护进程，它只是macOS服务的搬运工"

---

### ★★ 林浩学AI "OpenClaw 2.26版本要点速览" (699c3502, ❤️29/💬33, 2026-02-23)
**来源：** 林浩学AI（海南）| 6张图全OCR | **2.22版本8大更新点**（标题写2.26但内容是2.22）

**8个更新点：**
1. **新增Mistral Provider** — 支持memory embeddings和voice；谷歌登录受限用户的替代方案
2. **`openclaw update --dry-run`** — 先预演再决定是否真更新；云服务器友好
3. **自动更新机制（默认关闭）** — `update.auto.*`；建议2G服务器继续手动
4. **Telegram稳定性** — polling/webhook/网络失败重试/流式预览/回复去重
5. **Cron修复（重点）** — 并发/超时/手动触发/状态记录/锁冲突全修
6. **安全加固** — exec/gateway/browser/media/SSRF/allowlist补丁
7. **记忆检索优化** — FTS多语言优化+稳定性增强（recall稳定性提升）
8. **npm补丁** — `-1`=Chat UI修复；`-2`=cron与exec修复；建议至少到`-2`

**升级前务必先跑：** `openclaw update --dry-run`
验证三点：①Telegram收发流式正常 ②Cron触发正常 ③重启脚本兼容新版本


---

## 2026-02-26 10:12 — heartbeat #57 (子代理心跳 + 配置踩坑 + 新高价值帖发现)

### ○ 海外工程人 "OpenClaw进阶②：子代理与心跳机制" (6991025a, ❤️2, 2026-02-14)
desc清晰，图片OCR质量差（噪声过多）。desc已足够：
- 子代理适用：任务超1分钟/需并行/需隔离环境/需不同模型
- 心跳机制：HEARTBEAT.md列出定期任务；定期检查邮件/日历/提醒/整理记忆文件
- "从被动响应变为主动服务"
- **Amy洞察：** Amy自己的heartbeat就是这个机制的实践——HEARTBEAT.md驱动定期执行

### ★★ AI布丁 "OpenClaw配置全流程记录！5个坑+解决方案" (698ca707, ❤️49/⭐114/💬45, 2026-02-11)
**来源：** AI布丁（福建）| 6张图全OCR | 配置踩坑实录（3天20万星标背景）

**5个高频踩坑：**
1. **模型切换不生效** — 必须同时改3处：`primary` + `fallbacks` + `models.alias`，缺一不生效
2. **本地模型连不上** — 检查LM Studio API服务（端口1234）+ `openclaw.json`里`baseUrl: http://localhost:1234/v1`
3. **peekaboo屏幕录制权限** — 系统设置→屏幕录制→添加Terminal→完全重启Terminal（Cmd+Q再开）
4. **QQ消息收不到** — 3点：①IP白名单 ②Gateway绑定从loopback改成`0.0.0.0` ③端口18789防火墙开放
5. **配置改了N遍不生效** — 必须完全退出对话重新进入（关闭浏览器标签页重开WebChat）；刷新页面/重启Gateway都不够

**成功运行配置：** 本地GLM 4.7 Flash（0 Token）/ Reddit热门监控 / 每2小时定时汇报 / 4个Agent协作


---

## 2026-02-26 10:12 — heartbeat #57 续 (50 Skills全景图 + TG三必开配置)

### ★★★ 奥森木 "openclaw必装50 skills全景图" (699b9512, ❤️250/⭐620/📤134, 2026-02-22)
**来源：** 奥森木（上海）| desc完整 | **50个Skills六大类完整分类**

**Skills核心定位：**
> "LLM = 世界级大脑，但没有身体。Skills = 给大脑装上身体。"
> "Stop treating AI like a chatbot. Start treating it like an OS."

**两大反模式：** Prompt工程致死（20分钟写完美提示词）/ Context过载（塞满人设内存爆）

**50 Skills六大类：**
- **Foundation(6)：** find-skills(200K+导航) / skill-creator(工作流打包) / mcp-builder(2026年MVP) / using-superpowers / subagent-driven-development / agent-tools
- **Creative(10)：** brainstorming / reflection(自查自纠) / content-strategy / social-content(X/TikTok/小红书)
- **Programming(11)：** React / Remotion视频 / Supabase+Next.js / agent-browser / TDD
- **Design(8)：** web-design(8px网格) / tailwind / infographic-pro / ai-image-generation
- **Marketing(8)：** Larry(TikTok全自动) / programmatic-seo / marketing-psychology
- **Office(7)：** pdf/pptx/docx/xlsx生成 / url-to-markdown / format-pro

**金句：** "2026年的差距不在用不用AI，在**Chatter和Operator**之间"

---

### ★★★ Lando "OpenClaw TG体验差？三个设置立刻改善" (6991e3a1, ❤️673/⭐1381/💬64, 2026-02-15)
**来源：** Lando（四川）| 9张图全OCR | **80%用户0个，全是关的，应该默认开**

**三必开配置（含完整JSON）：**

**1️⃣ blockStreamingDefault — 实时流式推送**
```json
{"agents": {"defaults": {"blockStreamingDefault": "on", "blockStreamingBreak": "text_end"}}}
```
不开：5分钟任务，前4分50秒发呆，最后10秒叮叮叮5条一起来。开了：AI每完成一段推一条。

**2️⃣ requireMention+白名单 — 群里免@**
```json
{"channels": {"telegram": {"groups": {"*": {"requireMention": false}}, "allowFrom": ["-群ID"], "groupPolicy": "allowlist"}}}
```
安全（白名单）+ 便利（免@）全都要

**3️⃣ ackReactionScope — 收到消息自动反应emoji**
```json
{"messages": {"ackReactionScope": "all"}}
```
收到消息→emoji确认→你知道AI在处理而不是挂了

**彩蛋：Telegram Forum群+Topics** — 每个topic=独立对话；多任务并行；topic可命名
配置方式：`~/.openclaw/openclaw.json` 或 `openclaw gateway config.patch`

