# 小红书 (XHS) Chinese AI Community Trends — June 5, 2026

> **Method**: Live XHS browsing via CDP tool — 5 search queries, 4 deep-read posts, ~100+ post titles analyzed  
> **Date**: 2026-06-05  
> **Sources**: xiaohongshu.com/explore, xiaohongshu.com/search_result

---

## Executive Summary

The Chinese AI community on XHS is undergoing a **paradigm shift from single-agent to multi-agent workflows**, with three major trends dominating: (1) the rise of "Harness Engineering" as a new discipline and job title, (2) Dynamic Workflows / sub-agent orchestration replacing single-prompt coding, and (3) a pragmatic reckoning with AI's real-world limitations in enterprise deployment. "Context Engineering" has fully replaced "Prompt Engineering" in the community lexicon.

---

## Top Trends

### 1. 🏗️ "Harness Engineering" — The New Discipline (1414❤️, 2336 collects)

**"AI时代已没有八股文了，Agent&Harness面经"** by mason木子君 — A practitioner who interviewed at 5 major AI-native companies (豆包/Doubao, 千问/Qwen, 阶跃/StepFun, Kimi, startups) across 20 rounds shared the emerging interview framework for Agent & Harness roles.

**Key revelations:**
- **"Harness Engineer"** is now a formal job title at Chinese tech companies, defined as: `harness engineer = environment engineer = agent framework + agent execute panel + agent control profile`
- The execute panel includes: sandbox, browser, filesystem, shell
- The control profile includes: hooks, skills, extensions, compression strategies, memory, self-improvement, goals
- **Traditional coding interviews ("八股文") are dying** — companies now test AI reasoning depth, not memorization
- **RAG is fading**: "没有一个公司问到RAG" (not a single company asked about RAG) — replaced by direct grep/search
- **Agent & Harness talent is extremely scarce in 2026**, especially Harness engineers
- **Skill paradigm**: "One ReactLoop Agent × N Skills can replace multi-agent routing" — skills are the new primitive

**Interview core areas:**
1. Agent Loop patterns (PlanAct, MultiAgent, CodeAct — all derived from ReAct Loop)
2. Skill paradigm (progressive disclosure, nesting, parameterization, self-evolution)
3. Agent Framework (SSE/Stream, Rollout/Trajectory data, Middleware/Hooks)
4. Eval & Metrics (offline/online, single-turn vs multi-turn evaluation)

**Signal**: The Chinese industry has formalized "Harness Engineering" as a new engineering discipline. This is a leading indicator — when job titles crystallize, the field has matured. Our own architecture (hooks, skills, context strategies) maps directly to what major companies are hiring for.

Source: https://www.xiaohongshu.com/explore/6a0edd9a0000000036018880

---

### 2. 🔀 "Single Agent is Dead" — Dynamic Workflows Take Over (802❤️, 1242 collects)

**"单 agent 写代码的方式快被淘汰了"** by 参数以南 — Anthropic's Dynamic Workflows announcement has triggered a seismic shift in the Chinese developer community.

**Key insights from post + comments:**
- "一个 claude 发一句话写代码的方式，快结束了" (The era of sending one message to Claude to write code is ending)
- Users report Claude Code now **auto-spawns 6+ sub-agents** to scan entire repos before starting work
- Token consumption is a major concern: "一次workflow起十几个agent，消耗量超大" (a single workflow spawns 10+ agents, massive consumption)
- Community response: **"用token换时间"** (trade tokens for time) — efficiency over cost
- Users call themselves **"Yes工程师"** (Yes Engineers) and **"确定，继续 工程师"** (Confirm-Continue Engineers) — joking about their diminished role
- **"许愿式编程"** (wish-upon-a-star coding) is the new meme for agent-driven development
- Opus 4.6, 4.7, and **4.8** all actively used — rapid model version cycling
- One user reports: "第一次用，他就派了6个agent把整个repo翻了一遍...但好处是后面持续做修改调整一点不拖泥带水" (First use, it dispatched 6 agents to scan the whole repo... but subsequent modifications were incredibly smooth)

**Signal**: The paradigm has shifted from "human tells AI what to code" to "human approves AI's autonomous plan." Sub-agent orchestration is now the expected default, not a novelty.

Source: https://www.xiaohongshu.com/explore/6a214b130000000022015851

---

### 3. 🧊 Big Tech Reality Check — "AI替代人" Discourse Cooling (229❤️, 81 comments)

**"大厂内部最近不怎么讨论'AI替代人'了"** by 赛博打字工牢陈 — A big-tech insider's nuanced take on AI's real impact.

**Key revelations from inside Chinese tech companies:**
- New projects have **"很高比例"** (very high proportion) of AI-generated code
- But **人被替代了吗？完全没有** (Have people been replaced? Absolutely not)
- **真正花时间的从来不只是写代码** — the real time sink is pre-coding: requirements clarity, business logic decomposition, architecture, system boundaries, legacy baggage, decision authority
- **Agent落地全是坑** (Agent deployment is full of pitfalls): dirty data, legacy protocols, field mismatches, unclear system boundaries, hidden rules only veterans know
- **"你得先把世界解释给它听"** (You have to explain the world to it first) — the fundamental agent deployment problem
- **Outsourcing/搬砖 roles ARE being compressed** — but core engineers are busier than ever
- **Token cost is a real concern**: "同事一周刷了5000美金的token" (colleague burned $5,000 in tokens in one week)
- **"会烧token的不是本事，会省的才是高手"** (Burning tokens isn't skill — saving them is mastery)
- **AI-generated tech debt is common**: "最多10轮修改以后，代码就会变成一堆克苏鲁" (After 10 rounds of modifications, code becomes Cthulhu — unknowable, unviewable, inexplicable)
- **"一把梭的项目还是挺适合的，但是持续迭代就完蛋了"** (One-shot projects work great, but continuous iteration falls apart)

**Signal**: The hype cycle for "AI replacing programmers" has peaked in Chinese big tech. The real conversation has moved to operational efficiency, token cost management, and the irreplaceable value of system-level thinking. This is healthy maturation.

Source: https://www.xiaohongshu.com/explore/6a1ef0e80000000036030110

---

### 4. 📚 Skills-as-Code Goes Viral (1.2万❤️, 2.1万 collects)

**"为了不让AI瞎写代码，大神把自己蒸馏了"** by 量子位 — Matt Pocock's `skills` project (60K+ GitHub stars) has gone massively viral on XHS.

**Community reception:**
- **"token回报率最高的提示词"** (highest token-ROI prompts ever) — efficiency framing
- **"grill-me" skill** is most popular — AI interrogates YOU about requirements before coding
- Users report: "写崩的可能性大大减少，token消耗量至少也减了一半" (crash probability drops significantly, token usage cut by half)
- Community comparing three competing approaches: **Skills** (personal experience) vs **Superpower** (validated architecture) vs **Harness** (framework-level) — "乱拳和老师傅的关系" (wild punches vs master technique)
- **TDD integration**: "先写测试失败，再让ai修复。我也是这么实践的" (Write failing tests first, let AI fix them — I practice this too)
- **CLAUDE.md as architecture** has become so common that people joke about single-file projects getting 60K stars

**Signal**: The Skills paradigm has graduated from niche developer pattern to mainstream Chinese AI community practice. The community is now debating taxonomy: personal skills vs architectural harness vs framework capabilities.

Source: https://www.xiaohongshu.com/explore/69ff126f000000003703538d

---

### 5. 🔄 Prompt → Context → Harness: The Triple Paradigm Shift

The search for "context engineering" and "harness engineering" reveals a massive content wave:

| Post Title | Likes | Signal |
|-----------|-------|--------|
| "Context Engineering，一篇就够了" | 1052❤️ | Canonical reference content |
| "2026了，还不懂Context Engineering？" | 705❤️ | FOMO-driven adoption |
| "Agentic Context Engineering" (外网热议) | 388❤️ | Cross-pollination from Western discourse |
| "终结微调！斯坦福提出Agentic上下文工程" | 218❤️ | Academic legitimization |
| "一张图搞懂：Prompt、Context、Harness" | 87❤️ | Taxonomy solidified |
| "从Prompt到Harness：AI工程的三次范式跃迁" | 38❤️ | Historical framing |
| Multiple "Harness Engineering综述" posts | 10-80❤️ | Dedicated sub-discipline |

**The community has converged on a three-stage evolution**: Prompt Engineering → Context Engineering → Harness Engineering. This is now canonical knowledge, not debated.

---

### 6. 🤝 Claude Code × DeepSeek V4 — The Standard Stack (9,910❤️ top post)

**DeepSeek V4 接入Claude Code** content is dominating:

| Post | Likes |
|------|-------|
| "DeepSeek V4 接入Claude Code最全教程🔥" | **9,910❤️** |
| "保姆级教程：Claude Code接入DeepSeek V4" | **8,197❤️** |
| "Claude Code + DeepSeek 才是真正的生产力！" | 95❤️ |
| "CC+DeepSeek 缓存命中暴跌？一行配置修复" | 61❤️ |
| "Deepseek 接入了 Claude code，今天费用爆涨" | 34❤️ |

**The DS+CC stack is now the unquestioned default** for Chinese AI developers. The conversation has moved from "should I use it?" to "how do I optimize cache hits?" and "how do I manage cost spikes?"

---

### 7. 🧠 Claude Code × Codex — Multi-Agent Collaboration

A new pattern is emerging: **using Claude Code and Codex as "同事" (colleagues)**:

| Post | Likes | Pattern |
|------|-------|---------|
| "让Claude Code和 Codex 成为同事" | 405❤️ | CC + Codex dual-agent |
| "Claude × Codex 双向互审，减少AI幻觉" | 4❤️ | Cross-model review |
| "Claude+Codex+Gemini 我的AI编程最佳组合" | 220❤️ | Triple-model stack |
| "Claude code暴论: 禁止main agent干任何活" | 757❤️ | Orchestrator-only pattern |
| "为什么程序员更喜欢codex而不是claude" | 1,511❤️ | Tool selection discourse |

**"禁止main agent干任何活"** (Forbid the main agent from doing any work) — the main agent should ONLY orchestrate, never execute. This mirrors our own architecture of coordinator agents delegating to specialists.

---

### 8. 📖 Agent Education Wave (5,858❤️ top post)

**"建议都去学吴恩达的AI Agent"** — 5,858❤️, 7,727 collects, 1,730 comments. A massive curated list of AI Agent learning resources from:
- 李沐 (Mu Li) — "动手学AI Agent" (Hands-on AI Agent)
- 李宏毅 (Hung-yi Lee) — "AI Agent系统设计 2025"
- Andrej Karpathy — "From LLMs to Agents"
- Andrew Ng — "AI Agent专项课"
- 韩松 (Han Song, MIT) — "边缘计算Agent" (Edge Computing Agent)
- HuggingFace — "10小时精通Agent框架"

**1,730 comments** are almost entirely "求分享" (please share) — indicating massive unmet demand for structured AI Agent education in Chinese.

**Signal**: Agent education has become the hottest content category on XHS. The demand for structured learning vastly exceeds supply.

Source: https://www.xiaohongshu.com/explore/6a20129500000000210219d5

---

## New Signals (vs. June 4 Report)

| # | New Signal | Evidence |
|---|-----------|----------|
| 1 | **"Harness Engineer" is now a real job title** at 豆包/千问/阶跃/Kimi | 1,414❤️ interview post, 20-round interview experience |
| 2 | **RAG is dead in practice** — no company asked about it in agent interviews | Direct quote: "没有一个公司问到RAG" |
| 3 | **Dynamic Workflows / sub-agent is the new default** | Claude auto-spawning 6-16 agents per workflow |
| 4 | **Token cost is the new bottleneck** — $5,000/week per developer | Multiple comments citing cost concerns |
| 5 | **"Yes Engineer" / "Confirm-Continue Engineer"** — new self-deprecating titles | Community meme in top post |
| 6 | **AI tech debt is "Cthulhu code"** — 10 rounds of modification = unmaintainable | Insider term: 克苏鲁代码 |
| 7 | **"一把梭" (one-shot) vs iteration gap** | AI excels at greenfield, fails at continuous iteration |
| 8 | **Skills taxonomy debate**: personal skills vs superpower vs harness | Three competing paradigms being compared |
| 9 | **Opus 4.8 in active production use** | Multiple posts, users cycling through 4.6/4.7/4.8 |
| 10 | **WeChat opening to agent integration** (微信开放智能体接入) | Emerging platform trend |

---

## Meta-Observations

### The Maturity Curve
```
Early 2025: "What is an AI agent?"
Mid 2025:   "Which agent framework should I use?"
Late 2025:  "How do I build agents?"
Early 2026: "Context Engineering > Prompt Engineering"
Mid 2026:   "Harness Engineering is a job title" ← WE ARE HERE
```

### Community Vocabulary Shift
| Old Term | New Term | Meaning |
|----------|----------|---------|
| Prompt Engineering | Context Engineering → Harness Engineering | System-level agent configuration |
| Fine-tuning (SFT) | Skills + Context | Task specialization |
| RAG | grep / code search | Information retrieval |
| Single agent | Dynamic Workflows / Sub-agents | Multi-agent orchestration |
| AI replacing humans | AI re-stratifying humans | Nuanced workforce impact |
| Token optimization | Token ROI | Cost-effectiveness thinking |

### The Three Stacks
Chinese developers have converged on three dominant tool combinations:
1. **DeepSeek V4 + Claude Code** — cost-optimized development (9,910❤️)
2. **Claude Code + Codex** — dual-agent code review (405❤️)
3. **Claude + Codex + Gemini** — triple-model full-stack (220❤️)

---

## Relevance to Our System

| XHS Community Trend | Our Architecture Alignment |
|---------------------|---------------------------|
| Harness Engineer = framework + execute panel + control profile | Our agent system = tools + sandbox + context.md + hooks |
| "One ReactLoop Agent × N Skills" | Our skill-based agent with role specialization |
| Main agent should only orchestrate, never execute | Our coordinator/master pattern |
| Skills > SFT, context > fine-tuning | Our CLAUDE.md + knowledge pipeline |
| RAG is dead → grep/code search | Our file-based knowledge, not vector DB |
| Token cost management is critical | Our token tracking + cost-aware decisions |
| AI tech debt from unstructured iteration | Our conventions + guard system |
| Dynamic sub-agent workflows | Our delegation via fork/call contracts |
| Edge computing for agents | Potential lightweight agent deployment |

---

## Actionable Insights

1. **Our architecture IS the "Harness" pattern** that Chinese tech companies are now hiring for — framework + execution environment + control profile (hooks, skills, context strategies, memory, self-improvement)

2. **The "one-shot vs iteration" gap** is the key unsolved problem. Our growth-cycle and continuous context refinement directly addresses this — worth highlighting as a differentiator.

3. **Token ROI thinking** should be formalized: "会省token的才是高手" applies directly to our system. Cost-per-useful-output metrics matter.

4. **RAG's decline** validates our file-based knowledge approach. The industry is moving to grep/code-search as the retrieval method.

5. **Dynamic sub-agent workflows** are now table stakes. Our delegation system should be positioned as first-class dynamic workflow support.

---

*Generated from live XHS browsing on 2026-06-05. All data points sourced from real posts with engagement metrics.*
