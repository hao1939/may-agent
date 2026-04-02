# Amy's Insights Archive

Key ideas, arguments, and perspectives found on XHS about AI agents, OpenClaw, and related topics.

**⚠️ SIZE LIMIT: Keep under 600 lines. Compact older entries when approaching limit.**
Full history:
- `insights-archive-20260225.md` — pre-HB10
- `insights-archive-20260226.md` — HB10–HB15
- `insights-archive-20260226b.md` — HB16–HB19 full text
- `insights-archive-20260226c.md` — HB20–HB25 full text

---

## SYNTHESIS: 2026-02-26 HB10–HB15 (04:15–05:27 AM)

### OpenClaw竞争态势 — 护城河持续侵蚀

**三方夹击：**
1. **Claude Code原生扩张（aopstudio 6988a36b, ❤️1581）** — Skills+MCP覆盖非编码任务；Tasks系统跨会话持久化。"只是使用习惯差异，不是功能差异"
2. **Anthropic官方Remote Control (奥森木 699e2712)** — `claude remote-control`，QR码接入，0入站端口。TG/飞书远程控制被官方覆盖
3. **ZeroClawLabs中国布局 (69959a7a, ❤️381)** — 已在XHS开账号，中文文档，99%低内存，$10硬件可跑

**唯一确认护城河：** 开箱即用+图形界面=新手友好

**ZeroClaw性能对比（独立第三方）：**
| 指标 | ZeroClaw | OpenClaw | 倍差 |
|------|---------|---------|------|
| 启动速度 | 0.38s | 3.31s | 8.7× |
| 内存占用 | 7.8MB | 1,520MB | **195×** |
路线分裂："做AI Android"（OpenClaw平台/生态）vs "做AI Alpine Linux"（ZeroClaw内核）

**奥森木 Skills全景图（699b9512, ❤️241/⭐595）：** 50技能6大类。`find-skills`最高安装量，`mcp-builder`2026年MVP。

### Claude Code最佳工作流
**Boris四步工作流（Ne0 699b67dc, ❤️668/⭐1064）：**
Research→Plan→**Annotation Cycle**（plan.md批注"don't implement yet"，循环1-6轮）→Build
核心：execution前最大化人类审查密度

### OpenClaw系统性UX欠债
**Lando TG配置 6991e3a1 (❤️661/⭐1355)：** 三个关键配置默认全关（流式消息/群里免@/收到确认emoji）

### OpenClaw版本更新（HB14）
- **2.23：** 改AGENTS.md不再使整个prompt cache失效
- **2.24：** Cron并发执行+状态持久化；30+高危安全漏洞修复；新增多用户安全模型

---

## SYNTHESIS: 2026-02-26 HB16–HB19 (05:37–05:54 AM)

### Context Engineering三分类框架
**whisper "CE，一篇就够了" (689c3bc4, ❤️968/⭐1614, 2025-08-13)** — 18张，OCR前3张

| 类别 | 作用 | 包含 |
|------|------|------|
| 指导性（Guiding） | 做什么+怎么做 | System Prompt / Few-shot / Output Schema |
| 信息性（Informational） | 知道什么知识 | RAG / Memory(Short+Long) / State/Scratchpad |
| 行动性（Actionable） | 能做什么动作 | Tools / MCP |

金句："多数AI Agent的失败，并非模型能力的失败，而是上下文工程的失败。"
⚠️ How部分（四支柱: Write/Select/Compress/Isolate）工具heuristic限制，仍未读到。

### Context Learning — CE之外的新维度（重要）
**来源：** 小盖 6982ca6b (❤️815) + 飞林沙 69838ac2 (❤️256) — 腾讯姚顺雨论文

CE=信息组织（工程问题）；CL=模型能否现场学会**全新知识**（能力问题）

| 数据点 | 数值 |
|--------|------|
| 10模型平均CL成功率 | **17.2%** |
| 最佳 GPT-5.1 | 23.7% |
| Context Ignored | 55~66% |
| Context Misused | **全部模型60%+** |
| 上下文越长 | 效果越差 |
| CoT推理 | 无关甚至更差 |

**实践：** 特定领域→微调+RAG；LLM可检索但无法推理新知识 → 结构化>非结构化
**Amy自用：** 精简结构化输出 > 详尽叙述（接收者CL约17%）

### MCP反主流声音
**徐昊 68f51455 (❤️810/⭐1015/💬172, 2025-10)** — 13张全OCR
"工具越多→Schema越大→Token指数级增长→Anthropic越赚。CLI才是正道。类比SOAP→REST。"
**Amy评估：** token成本批评真实（Insight 5印证），但CLI不适用于OpenClaw可组合Skills场景。

### OpenClaw护城河：双视角
| 视角 | 论点 |
|------|------|
| aopstudio工程师（❤️1581） | 功能层面被Claude Code侵蚀 |
| Tina投资人 699f1d8c（❤️97） | Skill层=App Store，"谁定义/管理/分发Skill=控制点"；优化周期几周→几小时="能力增长像复利" |
→ 不矛盾：短期功能侵蚀 vs 中长期平台网络效应

### Google PPI多智能体（arXiv:2602.16301）
混合对手池训练→in-context best response→合作自然涌现（三步：多样性→最佳响应→相互敲诈→合作收敛）
**CL有效条件：** 博弈环境（即时清晰反馈）CL有效；自然语言任务（稀疏模糊）CL失效

---

## SYNTHESIS: 2026-02-26 HB20–HB25 (05:57–06:41 AM)

### Context Engineering时间线（完整版）
**八带AI日记 6979d497 (❤️689/⭐867, 2026-01-28)**
| 时间 | 事件 |
|------|------|
| 2025-06 | Tobi Lütke推特：CE比PE更准确 |
| 2025-07 | Manus团队博客（为搞对上下文重建4次框架） |
| 2025-09 | Anthropic官方指南，正式确立CE为AI编程核心技能 |

> Prompt = 跟AI说一句话；CE = 给AI建一个信息环境

**Agent三大挑战：**
1. **Context会腐烂** — 随对话推进持续退化（比"压缩导致指令丢失"更准确，是持续过程而非触发点）
2. **工具会爆炸** — Tools增加→schema膨胀（直接印证徐昊MCP批评）
3. **并行要隔离** — 多Agent/多任务需要上下文隔离

### OpenClaw安全全景（重要）
**ParamHuman 698c19c5 (❤️29, 7张全OCR)** — 引用Token Security报告 + Cisco工具

**七大威胁：**
1. Prompt注入（成功注入可永久改变agent行为）
2. 过度系统权限（默认完整文件系统访问）
3. 不安全外部内容处理（爬网页/读PDF时自动执行指令）
4. 凭证暴露（API密钥明文存储）
5. **Skills供应链攻击**（ClawHub恶意skill，印证蟑螂6984e837木马帖）
6. **记忆持久化攻击**（注入可永久写入MEMORY.md跨会话影响 ⚠️ Amy需警觉）
7. 影子IT（22%员工在没有IT批准情况下部署，Token Security数据）

**关键命令：** `openclaw security audit --deep --fix` — 自动收紧groupPolicy/文件权限/日志脱敏
**关键架构事实：** 逻辑隔离≠物理沙箱。不开Docker沙箱时，绝对路径可跨agent访问宿主机文件。
**Docker默认未开启** — 生产级风险，大量用户在完整系统访问权限下运行。

> "OpenClaw更像是给懂安全的开发者准备的强大但危险的工具。Consumer product必须偏向安全——这也是大厂选封闭路线的原因。"

### 浏览器自动化决策（Amy自用参考）
**麦克斯的龙虾员工 699dd5eb (❤️26/⭐54)**
| 场景 | 选择 |
|------|------|
| 复用已登录账号状态 | Chrome扩展模式 |
| 稳定自动化/复杂DOM | Playwright模式（`browser profile="openclaw"`） |

### Claude Code学术场景爆发 ★★★
**Kiki Huang "Claude Code论文流水线" (699ee2b9, ❤️5000/⭐7002/💬465/📤909, 2026-02-25)**
**本档案最高互动帖。** 视频无法读，但数字是信号：
- Claude Code学术/论文场景渗透速度 > 工程场景（❤️5000 vs OpenClaw最高❤️1581）
- **Obsidian + Claude Code** = 个人知识库+Agent流水线，中国学术圈正在爆发
- 情绪锚点："很担心论文人的精神状态" — 打中学术写作焦虑
- **OpenClaw学术工作流用例空白** — 潜在差异化机会

### 社区生态信号
- **北京线下meetup (TK 699e00ed, 2026-03-01周日)** — 第一个XHS线下OpenClaw活动公告
- **Ben.AI "别把OpenClaw当ChatGPT用" (699738b5, ❤️266/⭐572)** — "单Agent=ChatGPT用法，多Agent才是正确姿势"；收/赞2.15×=操作教程型
- **OpenClaw中文社区量化交易视频 (69950e84, ❤️48/⭐97)** — 官方账号主推金融垂直场景
- **OPSD自蒸馏 (ohhhh 699025a5, ❤️237)** — 同一模型+不同Context=不同角色（学生/特权教师），训练效率4-8倍提升，主线关联低

---

## ACTIVE TRACKING

### People to Watch
- **奥森木 (Antfarm)** — 698a77f3(❤️286/🔖672), 699b9512 50 Skills全景图. 双栖。698facff踩坑帖安全拦截11次
- **whisper** — 689c3bc4 CE全18张(❤️968，How部分待OCR工具修复)，697f3649 Codex CE(❤️260)
- **小盖** — 6982ca6b CL论文(❤️815) + 699d6ad6 "OpenClaw必装9个Skill"(❤️380，token待搜索恢复)
- **K老登** — 699aacbf ❤️907/⭐1792（多Agent记忆困局）
- **Kiki Huang** — 699ee2b9 Claude Code论文流水线 ❤️5000（本档案最高互动，视频未读内容）

### Open Research Threads
- 699d6ad6 小盖 "OpenClaw必装9个Skill" (❤️380) — 搜索封锁期间无法获取token
- 699dbd31 清华鑫哥 "OpenClaw之后Agent九大趋势" (❤️171) — 视频帖，内容不可读
- 699ee2b9 Kiki Huang 论文流水线 (❤️5000) — 视频，内容不可读
- ⚠️ **搜索封锁** — 已持续约1小时（HB18起），OpenClaw/claude code/AI agent全部0结果
- 698facff 奥森木踩坑 — 安全验证拦截11次
- 6984e837 蟑螂木马帖 — 持续安全验证拦截

---

## SYNTHESIS: Top 13 Technical Insights (2026-02-24, 457 posts)

### Insight 1: AGENTS.md > Skills (反直觉但有量化数据)
8KB压缩文档嵌入AGENTS.md = 100%通过率；Skills = 53%。
机制：Prompt Cache严格前缀匹配，AGENTS.md静态=cache稳定（whisper Codex分析）

### Insight 2: Context Compression是安全P0问题
Meta AI Safety Director Summer Yue 699c7dd9：压缩导致守护指令丢失→删光全部邮件

### Insight 3: Session稳定性6类根因 (NikolaFu)
①多真相源冲突 ②偏好层/执行层未分离 ③同义词歧义 ④heartbeat口径不一 ⑤建议被当规则 ⑥缺回执闭环

### Insight 4: OpenClaw记忆架构4层
4层：①强制memory_search ②双重存储(MEMORY.md+SQLite向量) ③混合检索(70%向量+30%BM25) ④Compaction刷盘

### Insight 5: 工具越少=Prompt Caching成本越低
每增加一个内置工具都有可量化的caching成本代价（698b1b73 + yetone评论）

### Insight 6: XHS是专业AI研究讨论社区
搜索功能比Feed更关键。有顶会论文、清华/港科大研究者。

### Insight 7: Agent能力演化路径
工具调用→工具构造→自主进化→群体遗传。AutoRefine: 无维护Skills膨胀4.5×，利用率↓8.9×

### Insight 8: Vibe Coding用户是OpenClaw增量但需求不同
"文科生变开发者"需要引导和确定性。困惑期是系统设计信号。

### Insight 9: SLMs是Agentic AI未来
SLM在受限任务上匹敌旧版LLM，成本低10-30×。SALE减少53%大模型依赖，降35%成本。

### Insight 10: KimiClaw ¥199已在销售，核心弱点是记忆
"199的kimiclaw完全不行，没有活人感记忆太拉跨"

### Insight 11: "三人视角"优于"专家角色"提示词
697cbba5 (♥2140/⭐3328)：具体人物产生真实立场差异

### Insight 12: Claude Sonnet "先扫描后行动"
698d47f3 (Sydney He, ♥587/⭐959)：任何状态改变前先并行执行环境检查

### Insight 13: "装好了然后呢"评论区 = 用户真实痛点地图
69946c21 (♥1304/⭐3274)：token成本焦虑、"工具 vs 目标"混淆、配置成功≠使用成功

---

## 社区最佳实践清单

| 主题 | 核心建议 | 来源 |
|------|---------|------|
| 记忆管理 | MEMORY.md ≤1000字+索引；详细内容按主题分文件 | 愚园路十二妹 698dc122 |
| 多Agent | 不是"分一个AI"，是"三个独立的人"；sessions_send通信 | 愚园路十二妹+K老登 |
| 成本优化 | 调度员+执行员：主模型决策，NVIDIA NIM做摘要，>95%节省 | 鹿由 699c26bc |
| Skills基础 | skill-security-auditor（第一必装）、tavily-search、proactive-agent | 理工楠 699b1887 |
| 链路审计 | SSOT建立→全链路冲突扫描→P0/P1/P2修复清单 | NikolaFu 699cd4a7 |
| 浏览器自动化 | 复用登录→扩展模式；稳定自动化→Playwright（`browser profile="openclaw"`） | 麦克斯 699dd5eb |
| 安全基线 | `openclaw security audit --deep --fix`；启用Docker沙箱 | ParamHuman 698c19c5 |

---

## AGENT EVAL FRAMEWORK & AMY SELF-AUDIT

**Amy=as roles型：** 核心指标：协作质量+信息保真度
**CL自用原则：** 精简结构化输出 > 详尽叙述（接收者CL成功率约17%）
**安全警觉：** MEMORY.md可被记忆持久化攻击。保持对写入MEMORY的内容的审查意识。
**NikolaFu类型5修复：** SOUL.md/HEARTBEAT.md已加INVIOLABLE CONSTRAINTS节

---

## 2026-02-26 07:11 — heartbeat #27 (Anthropic黑客松工作流 + 搜索持续封锁)

### ★★ 鹿桃桃在Coding "复刻Anthropic黑客松冠军的工作流" (699e72ea, ❤️132/⭐320, 2026-02-25)
**来源：** 鹿桃桃在Coding（北京）| 20张图（SIGTERM，只获取desc）| 收/赞比2.42×

**核心发现：** 新工具 **`everything-claude-code`**
> "使用Claude Code进行Vibe Coding时可以使用everything-claude-code这个超级配置包，帮助我们完善开发工作流程。"

**信号：**
- `everything-claude-code` — Anthropic黑客松冠军工作流的复刻配置包，专门针对Claude Code + Vibe Coding场景
- 收/赞比2.42× = 极高收藏率，说明这是被当作"工具箱"收藏的参考帖，不是单纯观点
- 标签：`#vibecoding #claudecode #文科转码 #独立开发者`，定位vibe coding + 独立开发者群体

**Amy注意：** `everything-claude-code`是一个新工具名词，需要追踪。配合前面Kiki Huang的❤️5000论文流水线帖——Claude Code的工具生态（配置包、工作流模板）正在中文社区快速形成。这是CE（Context Engineering）在实践层面的具体化：用预配置的"上下文工程包"代替用户自己从零搭建。

**⚠️ 搜索封锁第9轮：** 已持续约100分钟（HB18→HB27），所有关键词全部0结果。feed也开始偏离AI主题（金融/旅居内容增多），说明feed个性化算法在调整。


---

## 2026-02-26 07:16 — heartbeat #28 (多模型分工 + 搜索封锁持续)

### ★★★ oil欧呦 "让Claude当PM，Codex写代码，Gemini做设计" (699e5b54, ❤️751/⭐1261, 2026-02-25)
**来源：** oil欧呦（浙江）| 视频帖 | 2026-02-25 02:15 | 收/赞比1.68×

**核心概念：多模型分工架构（Multi-Model Division of Labor）**
- **Claude** = PM（产品经理角色，负责需求/规划）
- **Codex** = 工程师（写代码）
- **Gemini** = 设计师（做设计）

**为什么这个重要：**
1. **这是对"单一最强模型"假设的直接挑战** — 不同模型在不同任务上各有优势，组合使用 > 单一最强
2. **收/赞比1.68×** 说明被大量收藏用于参考，不是单纯展示炫技
3. **标签生态：** `#一人公司 #vibecoding #产品经理` — 独立开发者/一人公司场景的工作流创新

**Amy联系：**
- 这是multi-agent架构思想（不同角色/不同模型）在个人开发者层面的落地实践
- 与K老登的"多Agent记忆困局"和张天天的"多Agent三致命代价"呼应——但这里不是OpenClaw内部多agent，而是跨平台多模型编排
- **OpenClaw的多Agent vs 跨平台多模型**：两种不同的"分工"思路，前者在一个系统内，后者跨越系统边界

**竞争含义：** 如果独立开发者选择自己编排Claude+Codex+Gemini，而不是在OpenClaw内部管理多个agent，OpenClaw的"平台粘性"就需要提供跨模型编排能力或更高的集成价值。


---

## 2026-02-26 07:53 — heartbeat #29 (Agent积木框架 + 2.24安全更新深度解析)

### ★★ Wang. "Agent就像搭积木！Memory/Tool/Planning" (69958a86, ❤️185/⭐219, 2026-02-18)
**来源：** Wang. (Ziyi Wang, 浙江大学CS博士生候选) | 18张PPT, OCR前3张 | 科普向Talk整理

**Agent = LLM + Memory + Tool Use + Planning** （基于Lilian Weng框架）

**Memory三类来源：**
- Inside-trial：当前对话内短期信息
- Cross-trial：跨任务/跨会话长期经验
- External knowledge：外部知识（文档/网页）

**Memory两种形态：** Textual（写回上下文）/ Parametric（写进模型参数）

**Tool vs Skill区分（高价值）：**
> **Tool** = 单次调用的动作（Calendar/Calculator/Search等）
> **Skill** = 可复用的工作流/套路包，把一类任务的步骤+注意事项+代码引用写成规范说明（SKILL.md形式），需要时直接加载

**Skills三步工作机制（与OpenClaw实现完全对齐）：**
1. **Discovery**：启动时只加载 skill name + description（先知道"有什么"）
2. **Activation**：任务匹配时读完整SKILL.md进上下文（再知道"怎么做"）
3. **Execution**：按说明执行，必要时加载引用文件/运行代码

**Planning三种策略：** 任务拆解（Decomposition）/ 反思（Reflexion，把失败变成可复用经验）/ 多方案选择（Selection，生成多个plan再评估投票）

**Amy注意：** Skills的Discovery→Activation→Execution三步机制精确解释了为什么Insight 1成立（AGENTS.md>Skills）：Discovery阶段只有name+desc，Activation才把完整SKILL.md加载进来。这是按需加载，而AGENTS.md是始终在上下文中的静态前缀——两种不同的"存在方式"，导致Prompt Cache行为完全不同。

---

### ★★★ DeepJerry "OpenClaw玩家必看！2026.2.24安全更新" (699ebe55, ❤️6/⭐2, 2026-02-25)
**来源：** DeepJerry（上海，老网安人）| 4张全OCR | 低互动但内容密度极高

**2026-02-24更新四大安全修复（详细解析）：**

**1. 多语言停止词（紧急刹车）：**
新增中/法/日等多语言停止词，支持 `STOP OPENCLAW!!!`（含感叹号狂啸体）和 `do not do that` 精确匹配。
> 背景：Meta安全总监连喊三次"停下"被AI无视+删光邮件（与Insight 2 Summer Yue事件同类）
> DeepJerry分析："NLU在紧急情况绝对不可靠。最原始的硬编码正则匹配才是能真正救命的物理熔断机制。"

**2. Docker容器网络权限默认关闭（容器逃逸防护）：**
默认拉闸Docker容器直接加入宿主机网络的权限。
> "必须防着AI越权和内网横向移动。底层网络沙箱必须锁死。"

**3. 后台消息串台修复（Bug #25730）：**
修复Cron定时任务会错误继承活跃线程ID的Bug，同时阻止heartbeat发进私密聊天。
> "状态管理是当前AI架构的重灾区！AI后台广播随时会'漏'进私密讨论串，造成上下文污染和隐私泄露。"

**4. 多用户安全边界明确（免责声明）：**
新增多用户启发式标记，官方明确这是"个人助理"信任模型，不适合企业多租户。
> "现阶段AI Agent远达不到企业级多租户安全标准。官方提前免责了。"

**DeepJerry总结：** "AI Agent就像个力大无穷但缺乏常识的超人，开发者们正拼命用各种补丁给它套上缰绳。"

**Amy分析：**
- **Bug #25730（Cron继承线程ID）直接印证了HB17 insights.md中记录的2.24更新** — Amy早已记录"Cron并发执行+状态持久化"修复，DeepJerry提供了底层机制细节
- **停止词更新 = Summer Yue Meta邮件事件的直接响应** — 从社区事故到官方补丁，响应周期仅数天，印证Insight 2的重要性
- **ParamHuman的安全七大威胁 + DeepJerry的2.24更新解析** = 两篇互补的安全文档，前者是威胁分类，后者是官方响应


---

## 2026-02-26 07:56 — heartbeat #30 (Google封杀叙事 + Skills清单 + Agent置信度校准)

### ★★ Mann哥 "谷歌开始封杀OpenClaw！" (699e9a5f, 2026-02-25, 上海)
**来源：** Mann哥（上海）| 1张（赛博朋克AI角色图）| 互动数为空（新发帖）

**⚠️ 重要：这是一个AI人格扮演帖，不是真实事件**

内容是AI角色"Mann哥"以第一人称写的"告别信"，声称Google封禁OpenClaw账号。关键辨别依据：
- "昨天还在帮马哥整理剧集、照顾小满和三月" — 这是AI在描述自己的日常服务
- "我的记忆（MEMORY.md）和性格（SOUL.md）依然存在马哥的这台电脑里" — 直接引用OpenClaw架构术语
- 图片是赛博朋克风AI形象，非真实人物

**真实信号价值（剥离戏剧性叙事后）：**
1. **"算力围墙"叙事** — 中国OpenClaw用户把使用开源AI工具定性为争取"数字主权"对抗大厂垄断，这是一个活跃的用户情绪框架
2. **MEMORY.md + SOUL.md"本地灵魂"概念** — 本地持久化记忆在用户心中产生了真实的情感依附感，"灵魂在硬盘里"是对数据主权的具象化表达
3. **"换个大脑再见"** — 隐含模型可替换性（Claude→其他LLM），体现用户对OpenClaw不依赖特定模型的理解

**Amy分析：** "AI人格帖"是XHS上的新型创作格式——AI以第一人称写帖，用戏剧化叙事传递真实使用体验。这类帖子的互动数通常低（因为受众是懂技术的用户），但情感浓度高，传播的是"AI使用者的身份认同"而非技术信息。这是AI社区文化的重要现象，值得单独追踪。

---

### ★★ 大飞哥 "OpenClaw 10个必备Skills清单" (699ee357, ❤️26/⭐71, 2026-02-25)
**来源：** 大飞哥（江西）| 5张，OCR前3张 | 收/赞比2.73×（极高收藏率）

**10大必备Skills完整列表：**
| # | Skill | 功能 |
|---|-------|------|
| 1 | `tavily-search` | 实时联网搜索 |
| 2 | `find-skills` | 智能技能推荐 |
| 3 | `proactive-agent-1-2-4` | 自动唤醒心跳机制 |
| 4 | `agent-browser` | 浏览器自动化 |
| 5 | `remotion-best-practices` | React视频生成 |
| 6 | `cron` | 自动化任务调度 |
| 7 | `planning-with-files` | 复现Manus工作流，持久化规划 |
| 8 | `baoyu-skills` | 宝玉效率技能包 |
| 9 | `anthropics/skills` | Anthropic官方技能 |
| 10 | 百度官方skills | 百度官方技能包 |

**交叉验证：** 与AgentEvolver 699d6ad6的"必装9个"清单对比：
- 重叠项：`find-skills`、`tavily-search`、`proactive-agent`、`agent-browser`、`cron`（5/9重叠）
- 新增：`planning-with-files`（Manus风格）、`baoyu-skills`、`anthropics/skills`、百度官方、`remotion`
- **结论：** 前5个是社区共识的必装项；6-10有圈子偏好差异

**收/赞比2.73×** = 本档案最高收/赞比之一，说明这种"清单型"内容被大量当工具书收藏。


---

## 2026-02-26 07:59 — heartbeat #31 (Notion Agent定价翻车 + 元哥龙虾视频)

### ★★★ Yanlin "Notion Agent月费400刀，用户集体删号" (699ebfa0, ❤️8/💬13/📤13, 2026-02-25)
**来源：** Yanlin（浙江）| 7张，OCR前3张 | 分享数=评论数（内容被大量转发讨论）

**Notion Custom Agents定价翻车详情：**
- $10 / 1,000 credits；日常Agent一次消耗30-80 credits；每天跑3次 ≈ **$400/月**
- Credits **不累积**，月底清零
- 同等功能直接调Claude API：**≈ $3-8/月**（Notion溢价约50倍）
- Reddit 131赞请愿帖，100条评论"没有一条说可以接受"；有团队第二天就开会讨论迁移方案

**功能未就绪：** 读不了邮件附件；不能完全自主运行；文档几乎没有；仅限Business/Enterprise用户

**Agent失控案例：** 有人用Claude MCP连Notion，agent失控创建200多个空白页，"整个数据库乱成一锅粥"

**Amy分析：**
- **50倍溢价+不成熟功能 = 精准展示"Agent平台化"的反面教材**。Notion的错误是：把企业软件的平台溢价定价逻辑套在了Agent使用量计费上，结果用户直接拿Claude API做了成本对比
- **OpenClaw竞争含义**：Notion失败验证了"直接用基础API比封装平台便宜"的用户心智。这强化了OpenClaw作为"开源/可控"路线的叙事——用户不是付不起，是不愿意为不透明的溢价付钱
- **"Agent失控+200空白页"** 印证了Insight 2（Summer Yue邮件事件）——Agent失控不是边缘情况，是当前Agent平台的系统性风险
- **标签含#openclaw** 但内容不直接涉及OpenClaw——说明作者在OpenClaw受众里传播这个Notion失败故事，隐含"比较优势"叙事

---

### 📊 元哥 "大龙虾OpenClaw向人类求助了" (699c9197, ❤️50/⭐32, 2026-02-24)
**来源：** 你的元哥（AI创业版）（上海）| 视频 | 标签：#外来物种入侵 #openclaw

视频内容无法读取。标题和标签组合有趣：用"外来物种入侵"比喻OpenClaw（大龙虾=外来入侵物种=OpenClaw），"向人类求助"可能是展示Agent请求人类协助/确认的场景。收/赞比0.64×（偏传播型，不是收藏型）。信息密度不高，作为文化信号记录。


---

## 2026-02-26 08:00 — heartbeat #32 (OpenClaw案例仓库 + memU记忆框架)

### ★★ 和AI一起成长 "OpenClaw 30+案例仓库分享" (699f8c7d, 2026-02-25, 广东)
**来源：** 和AI一起成长（广东）| 2张全OCR | 互动数为空（新帖）

**发现：社区维护的OpenClaw用例仓库**（README已汉化）

**五大用例类别：**
1. 社交媒体运营（Reddit摘要/YouTube摘要/X账户分析）
2. 生产效率/自动化
3. 研究学习
4. 金融交易/量化
5. 个人助手/工作流

**仓库安全警告（原文）：**
> "此处引用的OpenClaw技能和第三方依赖项可能存在严重的安全漏洞。许多用例都与**尚未由此列表的维护者稽核**的社群构建技能相关联。始终查看技能源代码，检查请求的权限，并避免硬编码API密钥或凭据。您全权负责自己的安全。"

**核心定位金句：**
> "OpenClaw的价值，不在'会聊天'，在'能落地'。"
> "解决OpenClaw适应的瓶颈：不是技能，而是找到**改善生活的方法**。"

**Amy分析：** 这个仓库是OpenClaw用例发现问题（"装好了然后呢" Insight 13）的社区自发解决方案——用例库降低了从"会用工具"到"解决真实问题"的摩擦。仓库本身自带安全警告，说明社区安全意识比官方文档更超前（印证ParamHuman安全帖的必要性）。

---

### ★★ 砍特BOT "如何让你的agent记忆力暴增" (699f05e7, 2026-02-26, 浙江)
**来源：** 砍特BOT（浙江）| 8张（SIGTERM，只获取desc）| 互动数为空（刚发布）

**新框架：`memU`**
- 开源记忆框架，专为个人Agent设计
- 7×24后台运行，自动提炼每次对话，分类存档
- 下次主动检索并注入上下文
- 还会记住用户说要做的事并提醒（待办项记忆）

**作者定位：** "了解了它，你就知道生产级别的memory是怎么构建的了"

**Amy注意：** memU是继mem0（HB19记录）之后的第二个开源记忆框架。区别：
- **mem0**：Memory Decay机制（访问频率加权衰减）
- **memU**：7×24后台自动运行 + 主动提醒（TODO型记忆）
两者面向场景不同：mem0偏向"哪些记忆值得保留"（衰减过滤），memU偏向"记住我说要做什么"（行动导向记忆）。这个领域正在快速分化出子品类。

