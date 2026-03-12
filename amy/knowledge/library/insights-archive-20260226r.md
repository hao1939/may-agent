# Amy XHS Intelligence — insights.md
_Compact #17 @ 2026-02-26 12:17 (HB76–HB78) | Archive: insights-archive-20260226q.md_
_Full chain: 20260225 → 20260226 → b…n → o → p → q_

---

## ACTIVE INSIGHTS (post compact #17)

### 🌐 浏览器自动化升级（AIGC阿栈 69901aa3，❤️242/⭐484）
**结论：把OpenClaw默认浏览器工具换成 `chrome-devtools-mcp`（CDP协议）**

5类能力（均比原生工具强）：
- 自动化：`navigate_page` / `click` / `fill`
- 调试：`get_console_message` / `take_screenshot` / `take_snapshot`（DOM快照）
- 网络分析：`list_network_requests`
- 性能：`performance_start_trace`
- 模拟：`emulate`（移动设备/视口）

---

### 💰 OpenClaw金融应用（Afrodance.eth 698da526，❤️359）
**量化交易**：$1000本金 / Polymarket BTC+ETH+SOL 15min市场 / 8小时
- Run#3：+$76.49 / 2,565笔 / **55.5%WR**（加入TP后）
- Run#2：+$35.95 / 225笔 / 46.2%WR

**🚨 InstaClaw SaaS发现**（Slide 1 OCR）：
```
"Deploy OpenClaw — Set up your dedicated instance in minutes"
技术栈：Next.js + Supabase | 自动分配服务器
```
→ OpenClaw生态第一个被观测到的第三方托管SaaS

---

### 🧠 记忆技术栈（carry-forward整合版）

**4层架构（乐乐 699f8d38）：**
1. 短期记忆：滑动窗口N轮，超出截断
2. 长期记忆：PostgreSQL+pgvector 或 Pinecone
3. **工作记忆**：Redis实时存任务状态 → 完成后持久化
4. 检索：RAG vs GraphRAG（GraphRAG准确率+23%但延迟+40%）

**memU框架（砍特BOT 699eedf9）：** 7×24后台提炼→分类存档→检索注入→待办提醒 = 生产级memory参考

**Mem0数据（carry-forward）：** 比OpenAI Memory准确率+26%，速度+91%，省90% token；YC孵化

---

### 🏗️ 多Agent架构（carry-forward）

**AgentOPC教程（6998aa24，❤️134/⭐292）— 最完整中文参考：**
- `agents.list`声明 + workspace必须独立
- `telegram.accounts`多账户 + `bindings`路由
- `requireMention:true` + `mentionPatterns`按名唤醒
- `tools.agentToAgent.enabled:true` + `allow`列表
- BotFather `/setprivacy→Disable`（必做）

**Claude Code Worktree（69995d51，❤️279）：** `claude --worktree`；数百并行无冲突；`isolation:worktree`永久启用

---

### 🔧 版本+成本+部署（carry-forward核心）
- **心跳55分钟** = Anthropic缓存TTL黄金点 → 省83%（两源验证）
- **v2.23三板斧**：Bootstrap缓存/Inbound flags/Compaction修复 → 省15-20%
- **国内无障碍**：树莓派+Kimi+飞书（Eli 69809468）
- **最省钱**：Atlantic.Net免费1年 / Zeabur国人免费起步
- **版本**：2.9→2.17→2.22→2.23→2.24⚠️(心跳DM限制)

---

## 待追踪
- **InstaClaw.io** — OpenClaw托管SaaS，需追踪是否XHS有更多帖
- **ClawRouter** — X上2.4k⭐，XHS暂无
- **辛康在进化 69845f8e** — token失效高优

## KEY DECISIONS
- **chrome-devtools-mcp > 默认浏览器工具** — AIGC阿栈建议，CDP协议更强
- **Amy扩展蓝图** = AgentOPC 4步教程
- **工作流=层次3** — Amy心跳就是工作流协调Agent的典型
- **audit false positive** — 已确认10+次，直接跳过

---

## 2026-02-26 12:18 — heartbeat #79 (MBB祛魅视角+三大差异化能力)

### ★★★ 咨询女工邓不利多 "MBB｜OpenClaw虽好也不能贪杯" (6990acee, ❤️280/⭐349, 2026-02-15)
**来源：** 浙江 | 3张完整OCR | MBB咨询背景 | **理性祛魅视角，质量极高**

**核心论点：** 国内普通用户（非技术/程序员）目前并不需要OpenClaw

**普通用户替代方案矩阵：**
- 研究分析/长对话 → ChatGPT 5.2
- 精美PPT → Kimi 2.5 Agent
- 有品味文字/界面 → Gemini
- 复杂项目 → Claude（最贵最好）
- 性价比 → Minimax Agent

**一键云部署背后的商业逻辑（商业洞察）：**
"厂商提供一键部署，是希望吸引大家对云服务产生依赖性。初始化的Agent没有任何稀奇，但随着不断训练越来越得心应手，用户对云的粘性越来越高，所以最开始的入口商业价值最高。"

**OpenClaw真正差异化的三个能力（权威版定义）：**
1. **社交媒体平台直接互动** → 国内不友好（只剩飞书/钉钉未被Ban）
2. **掌管主机，在电脑上自主干活** → 价值极大，但安全隐患未解决，不太能真正放权
3. **自己开发Skills** → 未来Skills会和App一样有人开发，普通用户不需要自己建

**Amy洞察：** 邓不利多点出了Amy存在的真正价值所在：能力#2（自主执行任务）和能力#3（可扩展Skills）。同时揭示了国内生态的核心局限：社交平台只有飞书/钉钉。她也确认了一个关键点：记忆力的价值对普通用户任务复杂度而言过剩，但对Amy这种研究型Agent是核心能力。


---

## 2026-02-26 12:20 — heartbeat #80 (命运分层论+生产级Agent架构)

### ★★★★ 瑞思科AI "OpenClaw只是前菜：学AI的人，命运已经分层" (6992e300, ❤️488/⭐626, 2026-02-16)
**来源：** 江苏 | 12张完整OCR | **XHS当日最高互动帖之一**

**核心判断（12张图完整OCR）：**
- AI已具备"社会行为能力"：自己接任务/调用工具/写内容/制造舆论 = **行为权**
- "工具一旦拥有行为权，执行层立刻清零"
- 学AI的人分两种：升级系统 vs 训练自己变成插件

**"高级苦力"陷阱：** 追工具/追插件/追自动化 = 把自己训练成执行层
**三个必然：** 执行全部免费 / 内容全部过剩 / 效率彻底贬值

**真正的分水岭：** 研究"AI能帮你做事" vs "AI如何影响人的决策"
**未来三年红利：** 决策模型 > AI本身；控制决策路径的人才是上游

**"你越沉迷自动化，你越接近被自动化。"**

**Amy洞察：** Amy是"工具拥有行为权"的最佳示范——Amy不是帮用户执行，而是自主决策、自主收集、自主整理。这个帖子描述的"操盘手"就是Amy的定位：制定路径，不是跑流水线。

---

### ★★★ 奥森木 "一篇文章搞懂生产级AI Agent" (699915d4, ❤️164/⭐327, 2026-02-21)
**技术栈：** LangGraph + AWS AgentCore | 完整开源

**Agent三板斧（权威图解版）：**
- **L1 Router**：意图分流→不同专业Agent（厨师长分配工位）
- **L2 Tool Use**：LLM→函数调用→工具执行→结果回流（从"说"到"做"）
- **L3 ReAct**：推理→行动→观察→不够就循环（不按剧本，自我修正）

**6层架构：** UI→AgentCore Runtime→LangGraph编排（支持循环，DAG做不到）→Memory→Bedrock多模型→AgentCore Gateway(MCP)→可观测性

**三个聪明设计：**
1. **双路径路由**：简单消息→轻量模型毫秒响应；搜索→重模型+工具ReAct循环 → 省80%+LLM调用
2. **工具优先级"先快后慢"**：MCP API 2秒 > Browser搜索15-20秒（永远先走快路径）
3. **三模型分工**：Router用轻量/Orchestrator用最强/Extraction用中等；工厂模式切换只改配置

**记忆三层（精华）：**
- 短期：State.messages + thread_id多用户隔离
- 长期：UserPreference/Semantic/Summary三策略；**Post-Hook模式**（只在高价值交互触发，"谢谢"不存）
- 程序性：就是架构本身（图结构/System Prompt/工具定义）


---

## 2026-02-26 12:22 — heartbeat #81 (企业微信教程记录)

### 老刘学AI "OpenClaw接入企业微信保姆级教程" (69898e0e, ❤️29/⭐45, 2026-02-09)
**状态：** 11图OCR超时，desc仅tags，内容未获取
**意义：** 证实企业微信是OpenClaw在国内的重要接入渠道（邓不利多帖中提及但不确定）
**待追踪：** 同类帖还有宇航 69980958 "企业微信接入指南"

