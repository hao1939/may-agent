# 小红书 (XHS) Chinese AI Community Trends — June 13, 2026 (Afternoon Edition)

> **Method**: Live XHS browsing via CDP (puppeteer-core → Chrome on port 9222), 15 search queries  
> **Date**: 2026-06-13 ~5:15 PM Beijing time (Friday afternoon — high-activity period)  
> **Successful Queries**: 8 of 15 returned data (7 rate-limited/auth-gated)  
> **Posts analyzed this round**: 361 structured posts + explore page  
> **Cumulative corpus**: ~2,800+ posts (June 12–13, across 11+ rounds)  
> **Builds on**: 3 prior rounds from June 13 (morning, noon, evening)

---

## Executive Summary

Six dominant narratives define the Chinese AI community this Friday afternoon:

1. **🔁 "Harness Engineering Is Already Obsolete — Loop Engineering Is Next" (862❤️)** — The most provocative finding. While Harness Engineering is still being learned and adopted by the majority, the leading edge of the community has already declared it passé. "Harness Engineering 已经过时了。Loop Engineering" asserts that the real skill is designing and debugging agent loops, not just building the harness scaffold. Simultaneously, "Harness刚火起来 就要被模型进化吞掉了吗" (502❤️) asks whether improving models will simply absorb the harness layer entirely.

2. **⚔️ The Great Multi-Agent Debate: Anthropic Says "Don't Rush" (712❤️)** — Anthropic officially cautioned against premature multi-agent adoption ("Anthropic 官方'劝退'：别急着搞多智能体"), directly contradicting the community's momentum toward multi-agent everything. Meanwhile, Shanghai AI Lab counters with "单个统一agent，远胜AI专家群" (264❤️) — a single unified agent outperforms a group of AI experts. The community is split between multi-agent maximalists and single-agent pragmatists.

3. **🧬 Skills Ecosystem Explodes: ByteDance, Meituan, Microsoft, Alibaba All In (43 posts)** — The richest query returned 43 posts revealing an entire industrial ecosystem forming around agent skills. ByteDance's self-evolving skills (329❤️), Meituan's Skill1 framework (195❤️), Microsoft's SkillOPT (71❤️), and the critical scaling question: "当Agent技能库膨胀到几千个，怎么办？" (124❤️). Skills are becoming the central abstraction of the agent era.

4. **🆕 Kimi-K2.7-Code Released + Open-Sourced (179❤️)** — A major new Chinese coding model has dropped. Moonshot AI's Kimi-K2.7-Code is positioned as a direct Claude Code competitor, and it's open-source. This is the first serious Chinese challenge to Claude Code's dominance in the coding agent space.

5. **💰 "Poor People's Vibe Coding: Only Codex Is Left" (1,108❤️)** — The cost divide in AI coding has become a class narrative. With Claude's pricing and bans, budget-conscious developers are flocking to Codex. Meanwhile, a new open-source AI coding framework hit 1k GitHub stars in 2 days (1,686❤️), suggesting demand for free alternatives is enormous.

6. **📰 Nature Published 3 Agent Papers in One Day (355❤️)** — Academic legitimacy has arrived. Three agent papers in Nature simultaneously signals that AI agents have crossed from "tech trend" to "established scientific field." This is the academic equivalent of an IPO.

---

## Top Trends with Evidence

### 1. 🔁 The Harness → Loop Engineering Paradigm Shift

The harness engineering discourse has evolved into a three-way debate:

| Post | ❤️ | Position |
|------|-----|----------|
| **"Harness Engineering 已经过时了。Loop Eng"** | 862 | Loop > Harness |
| **"Harness刚火起来 就要被模型进化吞掉了吗"** | 502 | Models will absorb harness |
| **"Harness的6层结构"** | 420 | Harness is still foundational |
| **"Harness最小实践 立竿见影的落地"** | 303 | Harness works in practice |
| **"Anthropic的 harness教程真的太🐮了"** | 228 | Anthropic validates harness |
| **"Harness Engineering六层架构模型"** | 175 | Architectural maturity |
| **"Evaluation Harness"** | 154 | Evaluation as harness component |
| **"一套九层落地级AI生产架构"** | 147 | Nine-layer production architecture |
| **"Harness Engineering 设计指南"** | 136 | Design principles |
| **"Agent架构下篇：多代理、Harness和未来趋势"** | 114 | Multi-agent + harness |
| **"开源一个自进化的Agent 框架：Evolva 🧬"** | 107 | Self-evolving harness |
| **"一文看懂 Open‑SWE的Harness架构"** | 93 | Harness in practice |
| **"Harness 已死，Loop 当立"** | 55 | Loop replaces Harness |
| **"如何高效玩转harness, 这篇论文讲明白了"** | 39 | Academic guidance |
| **"别被 AI 圈这些 XXX Engineering 绕晕了"** | 22 | Hype fatigue signal |

**Three camps have emerged:**

**Camp A — "Harness Is Foundational" (majority)**
Most posts treat harness as the established framework. Anthropic's official tutorial (228❤️), six-layer models (420❤️), and practical guides (303❤️) dominate the volume. These users are still learning and implementing harness patterns.

**Camp B — "Loop Engineering Is Next" (leading edge)**
"Harness Engineering 已经过时了" (862❤️) and "Harness 已死，Loop 当立" (55❤️) argue that the critical skill isn't building the static harness — it's designing the *loops* (feedback cycles, iteration patterns, self-improvement mechanisms) that make agents productive over time.

**Camp C — "Models Will Eat the Harness" (contrarian)**
"Harness刚火起来 就要被模型进化吞掉了吗" (502❤️) raises the existential question: as models get smarter, won't they internalize what harnesses do externally? This camp argues harness engineering is a transitional skill that disappears as models improve.

**Key new post**: "别被 AI 圈这些 XXX Engineering 绕晕了" (22❤️) — **"Don't let all these XXX Engineering terms confuse you."** This signals early hype fatigue. The community is drowning in new terminology (Prompt Engineering → Harness Engineering → Loop Engineering → ??? Engineering) and some are pushing back.

**Signal**: The concept lifecycle in Chinese AI is accelerating. Harness Engineering went from unknown → mainstream → "already obsolete" in roughly 6 weeks. Loop Engineering may follow an even faster cycle.

---

### 2. ⚔️ The Multi-Agent vs. Single-Agent Showdown

This is the most contentious architectural debate on Chinese AI XHS right now:

| Post | ❤️ | Side |
|------|-----|------|
| **"Anthropic 官方'劝退'：别急着搞多智能体"** | 712 | 🛑 Anti-multi-agent |
| **"Claude的两种Multi-Agent架构，一文讲清楚"** | 490 | 📐 Architecture guide |
| **"Self-Evolving（自进化智能体）2026年经典"** | 476 | 🧬 Evolution > architecture |
| **"上海AI Lab：单个统一agent，远胜AI专家群"** | 264 | 🛑 Single > multi |
| **"Multi-Agent成新宠，建议往这个方向多靠靠"** | 260 | ✅ Multi-agent is future |
| **"讨论下multi-agent使用场景"** | 207 | 🤔 When to use multi |
| **"Multi-Agent系统是如何协作完成复杂任务的？"** | 144 | 📐 How it works |
| **"UnityMAS-O：一个真正能做多智能体RL的框架"** | 127 | ✅ Tooling maturing |
| **"Codex Multi-Agent完全指南"** | 119 | ✅ Codex supports it |
| **"Codex多Agent配置指南"** | 118 | ✅ Configuration available |
| **"5 种 multi-agent 架构"** | 86 | 📐 Pattern catalog |
| **"SkillGraph: 多模态图拓扑的自进化多智能体"** | 79 | 🧬 Skill-based multi-agent |
| **"多智能体系统：从单Agent到团队作战"** | 65 | ✅ Evolution narrative |
| **"Anthropic Deep Research: 多智能体架构"** | 55 | 📐 Anthropic's own research |
| **"上海交大：多智能体情景记忆重构"** | 55 | 🧬 Memory in multi-agent |

**The Anthropic Paradox**: Anthropic officially warns against multi-agent (712❤️) while simultaneously publishing multi-agent architecture research (55❤️) and supporting Agent Teams in Claude Code (306❤️). The community has noticed this contradiction.

**Shanghai AI Lab's Contrarian Bomb**: "单个统一agent，远胜AI专家群" (264❤️) — a single unified agent outperforms a group of AI expert agents. This directly challenges the prevailing "more agents = better" assumption. Their argument: coordination overhead, error propagation, and context fragmentation make multi-agent systems worse than a well-configured single agent for most tasks.

**The Reconciliation Emerging**: "多Agent协作 vs 单Agent+Skill，怎么选？" — the community is converging on a decision framework:
- **Single agent + Skills** → for tasks with clear boundaries and manageable complexity
- **Multi-agent** → only for genuinely parallel workloads where coordination cost < parallelism benefit

**Signal**: The multi-agent hype has peaked. Pragmatic evaluation is replacing enthusiasm. Anthropic's official warning may become the most influential cautionary note of the year.

---

### 3. 🧬 The Skills Ecosystem: China's Big Tech Has Entered the Arena

The skills query (43 posts) reveals an industrial-scale ecosystem forming:

**Big Tech Skills Frameworks:**

| Company | Project | ❤️ | What It Does |
|---------|---------|-----|-------------|
| **ByteDance** | Agent技能会自己进化了 | 329 | Self-evolving agent skills |
| **Meituan** | Skill1 | 195 | Unified agent skill evolution framework |
| **Microsoft** | SkillOPT | 71 | Skill optimization/evolution |
| **Alibaba** | 智能体轨迹并行蒸馏迁移技能 | 126 | Skill transfer via trajectory distillation |
| **Huawei** | Skill级记忆 | 10 | Skill-level memory |
| **Salesforce** | 技能驱动的Agent编排 | 69 | Skill-driven orchestration |

**Academic Skills Research:**

| Institution | Work | ❤️ | Contribution |
|------------|------|-----|-------------|
| **Tsinghua** | 让智能体像RAG检索知识一样找Skills | 282 | Skill retrieval like RAG |
| **Tsinghua** | 上下文可自演化成智能体skills | 71 | Context evolves into skills |
| **UCAS + East China Normal** | 强化Agent skills自进化 | 107 | RL-powered skill evolution |
| **ZJU + Meituan** | SKILL0 | 9 | Teaching agents to remember skills |
| **Shanghai AI Lab** | SkillGenBench | 43 | Skill generation benchmarking |

**The Scaling Problem — "当Agent技能库膨胀到几千个，怎么办？" (124❤️)**

This is the critical unsolved question. As skill libraries grow to thousands of skills:
- How does an agent discover the right skill? (Tsinghua's RAG-for-skills approach, 282❤️)
- How do skills avoid conflicts? ("多Agent Skills同步问题", 17❤️)
- How are skills evaluated? (SkillGenBench, 43❤️)
- Can skills evolve on their own? (EvoSkill, 58❤️)

**Emerging Taxonomy (refined from community consensus):**

```
Skill Lifecycle:
  Discovery → Selection → Composition → Execution → Evaluation → Evolution
  
Skill Types:
  - Static Skills: pre-defined, versioned (most current skills)
  - Adaptive Skills: improve with usage (SkillOPT)
  - Self-Evolving Skills: generate new skills autonomously (EvoSkill, Darwin.skill)
  - Composite Skills: assembled from atomic skills at runtime (Dynamic Workflows)
```

**Signal**: Skills are the "microservices of AI" — the fundamental unit of agent capability. Every major Chinese tech company is building a skill framework. The winner will be whoever solves skill discovery and composition at scale.

---

### 4. 💻 Claude Code Ecosystem: The Dominant Platform (44 posts)

Claude Code generated the most posts (44) of any query, confirming its position as the dominant AI coding platform:

**Highest Engagement:**

| Post | ❤️ | Signal |
|------|-----|--------|
| **"零基础安装Claude code｜总结小众问题"** | 6,230 | Entry-level adoption at scale |
| **"一篇讲清楚codex和Claude code 小白选哪个"** | 3,158 | Decision guide for beginners |
| **"团队还在做的这6件事，Anthropic已经全停了"** | 1,794 | Anthropic's internal practices |
| **"来看Claude团队这份skill使用指南"** | 740 | Skills guide from 量子位 |
| **"一句话开启 ai 自动拆解任务多 agent 开发"** | 586 | Multi-agent with one command |
| **"Claude Code完整实战手册"** | 471 | Comprehensive guide |
| **"从零搞定 Claude Code + DeepSeek！"** | 448 | Multi-model setup |
| **"ts 已经成为 agent 开发首选"** | 415 | TypeScript as agent language |
| **"Claude Code 新功能：动态工作流"** | 298 | Dynamic workflows |
| **"Claude终于承认降智，找自己的bug找了一个"** | 230 | Degradation acknowledgment |
| **"Claude+Codex+Gemini 我的AI编程最佳组合"** | 229 | Multi-tool combo |
| **"DeepSeek 做 code Agent 是迫不得已？"** | 204 | DeepSeek's coding push |
| **"Kimi-K2.7-Code 正式发布，并同步开源"** | 179 | 🆕 New Chinese coding model |
| **"71页综述揭秘：Agent真正的瓶颈不是大模型"** | 177 | Models aren't the bottleneck |
| **"Claude Code 创始人：编程被解决了"** | 164 | Bold claim from creator |

**Key New Developments:**

**A. Kimi-K2.7-Code Launch (179❤️)** — Moonshot AI's new open-source coding model enters as a serious contender. The fact that it's open-sourced differentiates it from Claude Code's closed ecosystem. This could be the beginning of a Chinese open-source coding agent movement.

**B. "Agent真正的瓶颈不是大模型" (177❤️)** — A 71-page survey argues that the real bottleneck for agents isn't model quality — it's infrastructure: memory, tooling, evaluation, deployment. This validates the harness engineering thesis while also supporting the "models will eat the harness" counterargument (if models aren't the bottleneck, then improving models alone won't solve agent problems).

**C. Claude Code Agent Review Feature (1❤️, brand new)** — A new "Agent Review" feature has launched in Claude Code, enabling automated code review by agent. Very early, but this signals Anthropic expanding from "agent writes code" to "agent reviews code" — closing the development loop.

**D. "Agent 5小时限额的正确使用姿势" (3❤️)** — The community is developing strategies to maximize output within Claude Code's 5-hour usage limits. Rationing AI compute is becoming a skill.

**E. Sub-Agent Confusion** — "Claude Code 子agent 自动/手动傻傻分不清" (1❤️) and "Claude Code中怎么用Subagent?" (5❤️) — users are struggling with sub-agent configuration. The multi-agent interface isn't intuitive yet.

**Signal**: Claude Code's dominance is deepening but also fragmenting. Users are combining it with DeepSeek (448❤️), Codex (229❤️), and now Kimi-K2.7-Code (179❤️). The platform is becoming a harness that runs multiple model backends.

---

### 5. 💸 The Vibe Coding Class Divide (40 posts)

The vibe coding discourse has split along economic lines:

| Post | ❤️ | Narrative |
|------|-----|-----------|
| **"发布 2 天 1k star 的开源 AI Coding 框架"** | 1,686 | Open-source alternatives exploding |
| **"超18w人收藏，AI 编程一定要装这个~"** | 1,272 | Must-have tools (180k saves) |
| **"穷人vibe coding现状：能用的只剩Codex了"** | 1,108 | **CLASS NARRATIVE**: Budget devs use Codex |
| **"Karpathy：Vibe Coding 时代结束了！"** | 917 | Paradigm declared dead |
| **"vibe coding名场面！"** | 709 | Viral moments compilation |
| **"Claude撞碎创业梦，华人博士愤怒开源"** | 688 | Ban → open-source response |
| **"吴恩达：不要小看AI编程，它没那么简单"** | 654 | Andrew Ng pushback on "easy" narrative |
| **"从Tmux到Cmux：一周使用体验"** | 634 | Terminal evolution for AI coding |
| **"Claude 套餐该怎么选？"** | 546 | Pricing analysis |
| **"最近看到最精彩的 AI 观点"** | 447 | Meta-commentary |
| **"老公自己vibe coding了一个游戏然后沉迷了"** | 365 | Consumer/lifestyle crossover |
| **"本地大模型写代码，到底行不行？"** | 303 | Local models as free alternative |
| **"Vibe Coding的蜜月期结束了？"** | 167 | Honeymoon over? |
| **"🇺🇸替大家面过了，AI Coding真的没难度"** | 128 | AI coding jobs aren't hard |
| **"TypeScript之父：AI时代的新语言有天然劣势"** | 115 | Anders Hejlsberg weighs in |

**The Three Classes of AI Coder in China:**

| Class | Tools | Monthly Cost | Posts | Sentiment |
|-------|-------|-------------|-------|-----------|
| **Premium** | Claude Code + Fable 5 | $200-600/mo | High engagement | Frustration with limits/bans |
| **Mid-tier** | Claude Code + DeepSeek V4 | $20-50/mo | Highest volume | "Best combo" narrative |
| **Budget** | Codex + local models | $0-20/mo | Growing fast | "穷人现状" — resilient |

**"Claude撞碎创业梦，华人博士愤怒开源" (688❤️)** — A Chinese PhD whose startup was destroyed by Claude bans responded by open-sourcing their work. This post captures the emotionally-driven open-source movement: ban-rage → open-source → community benefit.

**"本地大模型写代码，到底行不行？" (303❤️)** — The growing interest in local models for coding is driven by:
1. Claude bans making remote APIs unreliable
2. Cost sensitivity (DeepSeek V4 API costs adding up)
3. Privacy concerns (code leaving local machine)
4. Qwen 3.7-Max and Kimi-K2.7-Code making local viable

**Signal**: AI coding is stratifying by income. The "democratization" narrative is being replaced by a "three-tier" reality where the best tools cost serious money.

---

### 6. 🏢 Enterprise Agent Deployment: Reality Check (45 posts)

The enterprise query returned the most posts (45), revealing the tension between vision and execution:

| Post | ❤️ | Category |
|------|-----|----------|
| **"GitHub 5.2 万颗星，OPC 的 AI 底座来了！"** | 1,669 | Open platform for enterprise AI |
| **"注意力经济向信任经济的转型"** | 1,478 | Economic paradigm shift |
| **"未来最火的AI岗位，不是Agent工程师，是FDE"** | 1,223 | FDE career narrative |
| **"Karpathy：Vibe Coding 时代结束了！"** | 917 | End of unstructured coding |
| **"现在最流行的8类 AI Agent 框架！"** | 765 | Framework landscape |
| **"发现大部分的AI Agent好像都在回避一个问题"** | 745 | The monetization elephant |
| **"昨天Nature 正刊录用三篇Agent文章"** | 355 | Academic legitimacy |
| **"我的AI Agent五种常见设计模式，弄懂了"** | 238 | Design patterns |
| **"上海AI Lab：单个统一agent，远胜AI专家群"** | 264 | Single > multi (lab results) |
| **"从0-1搭建一个Data agent的实战体验"** | 226 | Real-world build log |
| **"开源 3 天，OpenRath 更新到 v1.1.0 了！"** | 223 | Chinese open-source agent |
| **"AI Agent落地的真相：中美一线创业者的教训"** | 222 | US-China comparison |
| **"Odysseus让我看到了 AI Agent 的第二种路线"** | 186 | Alternative agent architecture |
| **"2026年agent的两大技术趋势"** | 145 | Trend summary |
| **"别再问 Agent 怎么落地了！"** | 103 | Exasperation from practitioners |
| **"2026AI Agent智能体技术发展报告"** | 105 | Industry report |
| **"AI Agent 在汽车上的典型应用场景"** | 91 | Automotive vertical |
| **"Notion刚刚把工作空间变成AI agent中枢"** | 79 | Notion as agent hub |
| **"AgentFS : AI Agent 专用的文件系统"** | 66 | Infrastructure layer |
| **"agent更换了更强的模型时，harness怎么升级"** | 60 | Model upgrade challenges |
| **"58个AI Agent同时干活的平台"** | 58 | Scale demonstration |
| **"企业 Agent 如何落地？ThinkAI 给了答案"** | 50 | Enterprise playbook |
| **"毕马威建了一个'管 Agent 的系统'"** | 12 | KPMG agent management |

**The Enterprise Deployment Maturity Model (synthesized from posts):**

```
Level 1: Demo/POC (50% of enterprises)
  → "Look, our agent can do X!" 
  → High excitement, no production use

Level 2: Single-Task Deployment (30%)
  → Agent handles one narrow workflow
  → Customer support, document processing
  → "AI应用已经分5层了，很多人还停在前2层" (45❤️)

Level 3: Multi-Agent Orchestration (15%)
  → Multiple agents coordinating
  → "60个AI Agent同时干活" (58❤️)
  → Coordination overhead is the main problem

Level 4: Self-Improving Agent Systems (5%)
  → Agents that improve from experience
  → "Evolva 🧬" (107❤️)
  → Theoretical for most companies

Level 5: Autonomous Agent Business (<<1%)
  → ByteDance's "商业闭环" from prior reports
  → Nearly nobody has achieved this
```

**"别再问 Agent 怎么落地了！" (103❤️)** — Practitioner frustration: the question "how do agents land in enterprises?" has been asked so many times that those actually doing it are exasperated. The answer, per the post: it's not a technology problem, it's an organizational change management problem.

**"卡住AI Agent的不是模型而是权限" (3❤️)** — Low engagement but high insight: "What blocks AI agents isn't models, it's permissions." Enterprise deployment is primarily gated by access control, data governance, and organizational trust — not AI capability.

**Signal**: Enterprise agent deployment is in the "crossing the chasm" phase. The early adopters have learned hard lessons. The majority are still at demo/POC stage. The gap between vision and execution remains enormous.

---

### 7. 🏪 DeepSeek V4: The Operational Reality (40 posts)

DeepSeek V4 has moved from launch hype to operational reality:

| Post | ❤️ | Category |
|------|-----|----------|
| **"生成次数限制放宽了"** | 1,106 | Rate limits loosened |
| **"DeepSeek V4.1来了"** | 764 | 🆕 V4.1 announced |
| **"这套指令更适合有AI基础的朋友们"** | 654 | Power user instructions |
| **"Codex 接入DeepSeek V4 完整教程🔥"** | 632 | Codex + DS V4 integration |
| **"Deepseek更新......"** | 512 | General update |
| **"DeepSeek V4用户进！"** | 521 | Community discussion |
| **"GPT-5.6，可能是有史以来最难评估"** | 397 | GPT-5.6 as competitor |
| **"也许大家用的都还不是满血的DeepSeek-V4"** | 377 | "Full power" V4 not yet live? |
| **"DeepSeek v4pro完全不能用来开发项目"** | 352 | V4 Pro coding complaints |
| **"DeepSeek 做 code Agent 是迫不得已？"** | 204 | Coding as strategic necessity |
| **"Claude强的离谱，国产还能追上吗？"** | 185 | Claude gap acknowledged |
| **"deepseek4.1没那么快"** | 169 | V4.1 timeline expectations |
| **"deepseek专家模式暂不支持联网搜索！"** | 150 | Feature gaps |
| **"世界上最难绷之事：deepseek限制撤回事件"** | 93 | Rate-limiting drama |
| **"deepseek+claudecode出错"** | 92 | Integration bugs |
| **"Deepseek v4.1有消息吗？"** | 58 | Community anticipation |
| **"腾讯云下调DeepSeek-V4模型价格"** | 35 | Price war continues |

**Key New Developments:**

**A. DeepSeek V4.1 Arriving (764❤️)** — V4.1 is either just released or imminent. The community is highly anticipatory but also managing expectations ("没那么快", 169❤️).

**B. "也许大家用的都还不是满血的DeepSeek-V4" (377❤️)** — A provocative claim that the currently deployed V4 isn't at "full power." If true, this means the real V4 performance hasn't been seen yet. This creates both hope and skepticism.

**C. V4 Pro Coding Disappointment (352❤️)** — "完全不能用来开发项目" — "completely unusable for project development." This is a damning review of V4 Pro's coding capabilities, reinforcing the Claude quality gap acknowledged at 185❤️.

**D. Tencent Cloud Price War (35❤️)** — Tencent Cloud cutting DeepSeek V4 API prices, continuing the infrastructure commoditization trend.

**E. GPT-5.6 as New Competitor (397❤️)** — OpenAI's GPT-5.6 has leaked or been announced, described as "the hardest to evaluate model ever." This adds a third pole to the Claude vs. DeepSeek binary.

**Signal**: DeepSeek V4's coding capabilities are disappointing relative to expectations. The community acknowledges Claude's quality lead while hoping V4.1 closes the gap. The price war is intensifying as infrastructure becomes a commodity.

---

### 8. 💼 AI Job Market: Agent Roles Are Red Hot (30 posts)

| Post | ❤️ | Signal |
|------|-----|--------|
| **"2026招聘丨欢迎加入，一起做AI时代好内容"** | 2,089 | Active hiring at scale |
| **"去面了几家初创，总结了一下要求"** | 744 | Startup interview requirements |
| **"UIUC AI/ML/Stats PhD/RA 26/27"** | 719 | Academic pipeline |
| **"DeepSeek招聘了"** | 663 | DeepSeek hiring |
| **"seed和通义bar太高，退而求其次可以去哪里"** | 628 | ByteDance/Alibaba too selective |
| **"三大超级巨头（千亿/万亿级）"** | 622 | Top company rankings |
| **"互联网大厂AI岗位全细分"** | 455 | AI role taxonomy |
| **"2026-05-28 外企/海外远程岗位"** | 362 | Remote positions |
| **"🇦🇺｜裁员休息一个月后去面了头部AI厂"** | 232 | International moves |
| **"DeepSeek急招Agent方向！一口气放17个岗位"** | 167 | Agent-specific roles |
| **"如果你想投AI赛道，我推荐这50家公司"** | 136 | Investment guide |
| **"有人把求職做成AI系統了"** | 105 | AI-powered job hunting |
| **"国际顶级 Embodied AI 初创全球招聘"** | 92 | Robotics AI hiring |

**The Hiring Hierarchy:**
1. **DeepSeek** — most mentioned employer, 17 agent-specific openings (167❤️), even admin staff at ¥60k/month (6❤️)
2. **ByteDance (Seed)** — extremely high bar, lots of rejected candidates (628❤️)
3. **Alibaba (Tongyi/通义)** — similarly selective
4. **Startups** — lower bar but intense pace ("去面了几家初创", 744❤️)
5. **International** — remote roles growing (362❤️), Australia (232❤️), UIUC (719❤️)

**Key Quote**: "seed和通义bar太高，退而求其次可以去哪里" (628❤️) — "The bar at ByteDance Seed and Alibaba Tongyi is too high. Where should I go as a fallback?" This reveals the talent pyramid: top labs are extremely selective, creating overflow demand for tier-2 companies.

**Signal**: Agent engineering roles are the hottest jobs in Chinese AI. DeepSeek is the most aggressive hirer. The talent market is highly stratified, with top labs rejecting most candidates.

---

## Cross-Round Delta Analysis: June 13 AM → PM

| Dimension | Morning/Noon (R2/R3) | This Afternoon (R4) | Movement |
|-----------|----------------------|----------------------|----------|
| **Top debate** | Fable 5 crisis | **Harness vs. Loop Engineering** | 🔄 New debate emerged |
| **Multi-agent** | Growing momentum | **Anthropic warns against it** (712❤️) | 🔄 Backlash arriving |
| **Skills** | Ecosystem forming | **Full industrial map visible** (43 posts) | 📈 Deepened |
| **Chinese coding models** | DeepSeek V4 only | **Kimi-K2.7-Code released** (179❤️) | 🆕 New entrant |
| **Vibe coding** | "Honeymoon over" | **Class stratification** (1,108❤️) | 📈 Intensified |
| **DeepSeek V4** | Launch hype | **Coding disappointment** (352❤️) | 📉 Reality check |
| **Enterprise** | Deployment challenges | **"Stop asking how to deploy"** (103❤️) | → Stabilized |
| **Jobs** | Bifurcated market | **Agent roles specifically hot** | → Continued |

---

## Emerging Phenomena (New This Round)

### A. "Agent真正的瓶颈不是大模型" (177❤️) — The Bottleneck Isn't Models

A 71-page survey finding that the real bottleneck for AI agents isn't model capability. The infrastructure (memory, tools, evaluation, deployment) is what limits agent performance. This has profound implications:
- Validates harness engineering investment
- Questions the "just wait for better models" approach
- Suggests infrastructure companies may be more valuable than model companies

### B. Nature's Triple Agent Paper Day (355❤️)

Three agent papers published in Nature simultaneously. Academic legitimacy has arrived for the agent field. This matters for:
- Funding decisions (governments and VCs take Nature seriously)
- Career signals (agent research is tenure-worthy)
- Regulatory framing (policymakers reference Nature)

### C. "agent更换了更强的模型时，harness怎么升级" (60❤️)

A practical question gaining attention: when you upgrade to a stronger model, how do you update the harness? This reveals a real operational challenge — harnesses designed for one model's capabilities may be suboptimal or broken when the underlying model improves. **Harness versioning** and **model-harness compatibility** are emerging concerns.

### D. AgentFS: A File System for Agents (66❤️)

A purpose-built file system for AI agents. This is infrastructure-layer innovation: agents need different file access patterns than humans (batch reads, structured writes, context-aware caching). The fact that someone is building a custom filesystem signals the agent infrastructure stack is deepening.

### E. KPMG's Agent Management System (12❤️)

"毕马威建了一个'管 Agent 的系统'" — KPMG has built an agent management system. When the Big Four accounting firms start managing agents like employees, it signals enterprise agent adoption has reached the compliance/governance phase.

---

## Explore Page Analysis

The explore page surfaced 41 general posts, with AI content appearing organically:

| AI-Adjacent Post on General Feed | ❤️ | Signal |
|----------------------------------|-----|--------|
| **"海浪发电，海水降温，AI的新家在海上？"** | 411 | AI infrastructure goes oceanic |
| **"今日arXiv精选，重大突破！"** | 24 | ArXiv summaries in general feed |
| **"我挖到了iOS 27变快的秘密，苹果预埋已久"** | 301 | Apple AI integration |
| **"SpaceX上市涨29%同行全跌麻"** | 75 | Tech investment |
| **"1.1万亿！马斯克富可敌国！"** | 105 | Tech wealth narrative |
| **"周靖人，又一个林俊旸"** | 98 | AI industry figure |

**"海浪发电，海水降温，AI的新家在海上？" (411❤️)** — AI data centers moving to the ocean for wave power and seawater cooling. This is a general-audience post about AI infrastructure, showing that even AI's *physical* requirements have become mainstream content.

**"周靖人，又一个林俊旸" (98❤️)** — Comparing Zhou Jingren (likely Alibaba's AI chief) to another figure. AI industry personalities are becoming general-interest subjects.

**Signal**: AI has fully penetrated mainstream XHS content. Infrastructure, personalities, and investment angles all surface in the general explore feed alongside lifestyle, pets, and travel content.

---

## Key Vocabulary & Memes (June 13 PM Update)

| Chinese | English | Context | First Seen |
|---------|---------|---------|------------|
| Loop Engineering | 循环工程 | Next paradigm after Harness | This cycle |
| 已经过时了 | Already obsolete | Applied to Harness Engineering | This cycle |
| 被模型进化吞掉 | Eaten by model evolution | Harness becoming redundant | This cycle |
| 别急着搞 | Don't rush into | Anthropic's multi-agent warning | This cycle |
| 远胜AI专家群 | Far surpasses AI expert groups | Single agent > multi-agent | This cycle |
| 穷人vibe coding | Poor people's vibe coding | Budget AI coding class | Prior round |
| 满血 | Full power/blood | "Real" V4 not deployed yet | This cycle |
| 完全不能用来开发 | Completely unusable for dev | V4 Pro coding review | This cycle |
| bar太高 | Bar too high | Top lab hiring selectivity | This cycle |
| 管Agent的系统 | System that manages agents | Enterprise agent governance | This cycle |

---

## Relevance to Our System

| XHS Trend | Our Architecture | Implication |
|-----------|-----------------|-------------|
| Harness → Loop Engineering (862❤️) | Our iteration cycles + feedback loops | We already implement loops within our harness; validate Loop Engineering as natural evolution |
| Anthropic warns against multi-agent (712❤️) | Our master→worker model | Our delegation model is multi-agent but orchestrated — matches Anthropic's "only when needed" guidance |
| Skills ecosystem (43 posts) | Our skill-based agent design | Skill discovery, composition, and evaluation are our next infrastructure challenges |
| "Bottleneck isn't models" (177❤️) | Our infrastructure-heavy approach | Validates our investment in guards, conventions, iteration monitoring |
| Model-harness compatibility (60❤️) | Our multi-model support | We need harness versioning — when model improves, harness rules may become obsolete |
| AgentFS (66❤️) | Our file read/write patterns | Purpose-built file operations for agents could improve our performance |
| KPMG agent management (12❤️) | Our coach + evaluation system | Enterprise governance of agents = our coach pattern at organization scale |
| Kimi-K2.7-Code (179❤️) | Our model backend | New Chinese model option for users needing open-source + local deployment |

---

## Actionable Insights

1. **Harness Engineering is confirmed but expect the "Loop Engineering" reframe within weeks.** The community moves fast. Our harness is already loop-aware (iteration cycles, feedback, self-improvement). Position as "Loop-aware Harness" to stay ahead of terminology shifts.

2. **Multi-agent architecture should remain orchestrated, not autonomous.** Anthropic's official warning (712❤️) + Shanghai AI Lab's research (264❤️) validate our conservative orchestration model. Don't adopt multi-agent for its own sake.

3. **Skill discovery at scale is the next critical problem.** With thousands of skills emerging, the question "how does an agent find the right skill?" (Tsinghua's RAG-for-skills, 282❤️) is exactly our challenge as our skill library grows.

4. **Model-harness compatibility versioning is needed.** Posts about harness upgrades when models change (60❤️) directly apply to our system. Convention files and guard logic need to version with model capabilities.

5. **Enterprise adoption gates on permissions, not technology.** "卡住AI Agent的不是模型而是权限" — our system's guard layer and trust architecture directly address this gate.

6. **Monitor Kimi-K2.7-Code as potential backend.** Open-source Chinese coding model could become relevant for users needing local/private deployment.

---

*Generated from live XHS browsing on 2026-06-13 ~5:15 PM Beijing time. 361 structured posts analyzed from 8 successful search queries + explore page (7 additional queries were rate-limited). Cumulative dataset across June 12-13: ~2,800+ posts analyzed across 11+ rounds. This report covers fresh developments in the Harness/Loop Engineering debate, multi-agent backlash, and skills ecosystem industrialization not previously observed.*
