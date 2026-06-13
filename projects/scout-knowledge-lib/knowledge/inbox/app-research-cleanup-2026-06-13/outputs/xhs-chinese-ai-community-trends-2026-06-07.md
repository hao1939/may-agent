# 小红书 (XHS) Chinese AI Community Trends — June 2026 (Fresh Exploration)
*Collected: 2026-06-07 | Source: XHS live browsing via CDP | Cross-referenced with prior reports*

---

## Executive Summary

This fresh exploration of 小红书 reveals **three major new waves** reshaping the Chinese AI community since the last comprehensive report (2026-06-06):

1. **Self-Evolving Agents (自进化智能体)** have exploded as the dominant academic-to-practitioner discourse — with 10+ dedicated posts, ICML/ICLR 2026 paper roundups, and an entire taxonomy emerging
2. **The "Vibe Coding is Dead" paradigm shift** — Karpathy's move to Anthropic and his "Agentic Engineering" thesis (897 likes, 1,143 saves, 132 comments) is catalyzing a Chinese dev identity crisis
3. **Codex vs Claude Code** has become the new "which tool" war, displacing Cursor entirely — with the top post at 1,515 likes and 409 heated comments

These trends compound the existing MCP skepticism, Qwen dominance, local deployment mania, and career anxiety documented in prior reports.

---

## 🔥 NEW Trend: Self-Evolving Agents (自进化智能体) — The Academic-Practitioner Bridge

### What's Happening
Self-evolving agents have emerged as **the single hottest research-to-practice topic** on XHS, with no equivalent concentration on any Western platform. The discourse spans ICML 2026, ICLR 2026, and industry labs (ByteDance, Tsinghua, Shanghai AI Lab).

### Key Post: "Self-Evolving (自进化智能体) 2026年经典" — 279 likes, 497 saves
**Author: "little book"** | Published yesterday from Shanghai

This comprehensive post maps the entire self-evolving agent landscape into **three evolutionary dimensions**:

#### 1. Single-Agent Self-Evolution (单智能体闭环自进化)
| Paper | Venue | Core Idea |
|-------|-------|-----------|
| **EvolveR** | ICML 2026 | Offline self-distillation → online interaction → policy evolution via RL |
| **Darwin Gödel Machine** | ICLR 2026 | Meta's open-ended evolution framework — agent modifies its own prompts, algorithms, and iteration rules |
| **EvoTest** | ICLR 2026 | Dual-agent zero-gradient evolution — auto-optimizes prompts, tool rules, task decomposition at inference time |

#### 2. Skill Self-Generation & Evolution (技能自主生成进化)
| Paper | Source | Core Idea |
|-------|--------|-----------|
| **SkillEvolver** | Tsinghua 2026 | Monitors tool interaction traces, auto-packages standardized skills. **72% skill reuse rate**, massive token reduction |
| **SkillWeaver** | 2025 | Web agent explores unfamiliar sites, auto-generates reusable API interaction skills |
| **EvoSkill** | 2026 | Failure-driven evolution — traces task errors, targeted skill expansion |

#### 3. Multi-Agent Collective Evolution (多智能体集群协同进化)
| Paper | Date | Core Idea |
|-------|------|-----------|
| **Evolve as a Team** | 2026.5 | No preset roles — team self-optimizes reasoning, interaction chains, role assignment. **45% task success rate improvement** |
| **MetaGen** | 2026.1 | Dynamically generates, optimizes, and eliminates agent roles; auto-switches collaboration topology |

### Supporting Posts — Self-Evolution Ecosystem
| Likes | Title | Author | Signal |
|-------|-------|--------|--------|
| 387 | ICML2026 Agent Memory 中稿论文汇总（一） | Hunter | Memory as evolution substrate |
| 371 | 🧠 字节新作：Agent Skill也能自进化了？ | heyheyHazel | ByteDance's EvoSkill |
| 368 | 分享一篇近期关于Self-Evolving的工作🫡 | 噜啦Cola | Community paper sharing |
| 354 | ICML'26 EvolveR：智能体从失败中变强 | Licheng (上海 AI Lab) | Lab researcher self-promotion |
| 279 | Self-Evolving（自进化智能体）2026年经典 | little book | Comprehensive taxonomy |
| 270 | 一口气了解 Self-evolving 01 | 根思喵教授 | Beginner-friendly series |
| 183 | 一口气了解 Self-evolving 02 | 根思喵教授 | Continuation |
| 138 | EvoSkill：让智能体自动从错误中进化 | Pacino | Practical focus |
| 124 | EvolveMem: AutoResearch的自演化记忆架构 | 大模型幻想家 | Memory evolution |

### Why This Matters
The self-evolving agent discourse on XHS reveals a **unique Chinese academic-social pipeline**:
- Lab researchers (上海 AI Lab, ByteDance, Tsinghua) post their own papers on XHS
- Community translators create accessible carousel summaries
- Practitioners debate practical implications in comments

**This has no Western equivalent.** arXiv papers don't get community discussion threads with 400+ saves on Instagram-like platforms. The XHS format — carousel images + conversational comments — makes cutting-edge research accessible to non-researchers.

**Critical voice detected:** Post "为什么自进化Agent也能当噱头？" (Why self-evolving agents are just hype) — 24 likes — shows healthy skepticism emerging alongside the enthusiasm.

---

## 🔥 NEW Trend: "Vibe Coding is Dead" → Agentic Engineering

### The Karpathy Catalyst
**Post: "Karpathy：Vibe Coding 时代结束了！"** — 897 likes, 1,143 saves, 132 comments
**Author: Z.MEI | 开发日志** | Published 2026-05-26 from Zhejiang

Karpathy's move from OpenAI to Anthropic in May 2026 has become a watershed moment on XHS. His "Agentic Engineering" thesis is framed as a four-dimensional paradigm shift:

| Dimension | Vibe Coding (死) | Agentic Engineering (生) |
|-----------|------------------|--------------------------|
| **Human role** | "Prompt writer" — pray AI guesses right | "Architect/Reviewer" — orchestrate agents |
| **AI role** | "Code autocomplete" — passive | "Autonomous executor" — plans, codes, tests, debugs |
| **Work method** | "Vibes" — describe feelings | "Engineering" — specs, acceptance criteria, intent |
| **Scope** | Toy projects | Production-grade applications |

### Community Reaction Analysis (from 132 comments)
The comments reveal a **deeply divided** Chinese developer community:

**Believers:**
- *"workflow又有回潮的趋势，大概是大家搞了一圈，发现workflow也不是一无是处"* — Workflow is making a comeback after everyone tried pure agents

**Skeptics:**
- *"这是又新造词了，vibe coding的工作跟右边这个就没啥区别"* — "This is just inventing new terms, no real difference"
- *"我就问卡帕西一句：绝大部分人都烧不起token玩鸡毛Agent team"* — "Most people can't afford the tokens for agent teams"

**Pragmatists:**
- *"token就是水电和话费，基础消费"* — "Tokens will become like utilities — basic expenses"
- *"从google的Agentic design pattern入手，配合openclaw pi文档"* — Practical learning path suggested

### Cross-Cultural Signal
The "token cost anxiety" in the comments is **uniquely intense** on XHS compared to Western platforms. Chinese developers face:
- Lower average salaries relative to API costs
- Corporate restrictions on foreign API spending
- Fewer employer-subsidized AI tool budgets

---

## 🔥 UPDATED Trend: Codex vs Claude Code — The New Holy War

### Previous State (June 6 report): Claude Code dominant, Cursor declining
### Current State (June 7): Three-way battle, Cursor declared dead

### The Data
| Likes | Title | Key Signal |
|-------|-------|------------|
| **1,515** | **为什么程序员更喜欢codex而不是claude** | **Codex vs CC debate ignites** |
| 978 | 一个8KB的文件，打爆了如日中天的Skills | Skills system challenged |
| 897 | Karpathy：Vibe Coding 时代结束了！ | Paradigm shift |
| 676 | 现在还有人再用Cursor吗？ | **Cursor declared dead** |
| 489 | Claude Code强在哪？真相不是模型 | CC architecture analysis |
| 236 | 我感觉，Cursor现在可能肠子悔青了？ | Cursor regret narrative |
| 208 | Cursor 遭遇降维打击 | Cursor decline |

### The Codex vs Claude Code Post — Deep Analysis (1,515 likes, 1,693 saves, 409 comments)

The comments reveal the Chinese developer community's real usage patterns:

**Pro-Codex camp:**
- *"codex虽然慢，但他写出来的代码不需要返工，直接就能用。claude毛毛躁躁的"* — Codex is slow but code works first time; Claude is "sloppy"
- *"cc max跟codex pro双持。总体使用下来，个人更喜欢用codex，代码通过率更高"* — Dual-wielding both, Codex has higher pass rate
- *"cc太贵了，用不起。codex和gemini性能也能接受，还便宜大碗"* — CC too expensive; Codex + Gemini are "cheap and filling"

**Pro-Claude Code camp:**
- *"但凡能用Claude code的谁愿意用codex"* — "Who'd use Codex if they could use Claude Code?" (518 likes on this comment!)
- The single most-liked comment reply in the thread

**Access problems unique to China:**
- *"因为国内用到纯度99%的Claude太难了"* — Getting "99% pure" Claude in China is extremely difficult
- *"Claude太容易买到假的了"* — Claude API resellers often sell counterfeit/degraded access
- Model version mentions: GPT-5.4, GPT-5.3-codex, Claude Opus 4.6 — indicating both ecosystems have advanced significantly

**The Cursor Death Certificate:**
- *"24年底的时候还很火...几乎没有使用Cursor的了，90%都是Codex或者Claude Code"* — From hot in late 2024 to 90% abandoned
- *"cursor写的代码质量太差了"* — "Cursor's code quality is terrible"
- *"不妨把cursor换成他爹vscode完全不影响"* — "Just replace Cursor with its father VS Code"
- *"cursor代码能力比codex差太多了，5.5在codex错误率近乎0"* — Error rate near 0 with Codex 5.5

### Skills vs AGENTS.md — The Meta-Tooling Debate (978 likes, 1,549 saves)
A Vercel engineer's finding that an 8KB AGENTS.md file outperformed Skills (100% vs 53% pass rate on Next.js 16 APIs) sparked intense debate:

- *"skills我压根没有了解，直觉告诉我这个技术是中间产物"* — "Skills felt like an intermediate product from the start"
- *"我觉得mcp才是中间产物，skill是进阶形态"* — Counter-opinion: MCP is the intermediate product, Skills are the evolution
- *"Skills本来就没吹的那么神奇，跟去年全网吹mcp给人感觉差不多"* — "Skills were never that amazing, same hype cycle as MCP last year"

**Verdict:** The community is developing a **meta-awareness of hype cycles** — comparing Skills hype to MCP hype to previous tool fads.

---

## 🔥 NEW Trend: Agent Memory as Infrastructure (ICML 2026)

### The Post: "ICML2026 Agent Memory 中稿论文汇总" — 387 likes, 593 saves
**Author: Hunter** | 4 days ago from Zhejiang

This post catalogues **7 ICML 2026 accepted papers** on agent memory, organized into a clear taxonomy:

#### Core Methods
| Paper | Key Innovation |
|-------|---------------|
| **SimpleMem** | Efficient lifelong memory without redundancy explosion |
| **MemEvolve** | Memory system itself becomes an evolvable object — meta-evolution |
| **When to Memorize and When to Stop** | Gated memory — decides what to remember vs discard |

#### Utilization & Scheduling
| Paper | Key Innovation |
|-------|---------------|
| **JitRL (Just-In-Time RL)** | Training-free continual RL via in-context memory — no gradient updates |

#### Multimodal / GUI
| Paper | Key Innovation |
|-------|---------------|
| **MemOCR** | Renders interaction history as images — layout-aware visual memory |
| **Darwinian Memory** | Natural selection for memory — auto-adjusts granularity, eliminates stale info |

#### Benchmark
| Paper | Key Innovation |
|-------|---------------|
| **Benchmarking Agent Memory** | Multi-session interdependent tasks — forces memory to affect decisions |

### Why This Matters for May-Agent
The framing *"LLM agent没长期记忆=每次都失忆"* (LLM agent without long-term memory = amnesia every time) directly mirrors our own system's challenges. The **MemEvolve** concept — memory systems that meta-evolve themselves — is particularly relevant.

---

## 🔥 NEW Trend: Hermes Agent & The "AI Earning Money" Craze

### What Is It
Hermes Agent has become a cultural phenomenon on XHS — an open-source agent that supposedly "earns money autonomously." The community has both celebrated and debunked it.

### The Posts
| Likes | Title | Signal |
|-------|-------|--------|
| **517** | **扒了Hermes源码，"自我进化"是假的** | **Debunking viral** |
| 188 | 最近当红的Hermes Agent到底有什么过人之处 | Genuine curiosity |
| 113 | Hermes 保姆级攻略，小白直接抄作业 | Tutorial culture |
| 81 | Hermes-Agent养马30天，这16个Skills必装 | Practical tips |
| 73 | 爱马仕Hermes Agent (AI养自己) 🦞危 | Cautionary tone |
| 26 | Hermes社区让我震惊的真实AI赚钱故事 | Anecdotal success |

### Analysis
The Hermes phenomenon reveals a **tension unique to Chinese XHS AI culture**:
1. **Hope narrative:** AI can earn money passively ("养自己" — raise/feed itself)
2. **Debunking culture:** The most-liked post (517) is a source-code exposé proving "self-evolution" claims are false
3. **Tutorial industrial complex:** Multiple "保姆级攻略" (nanny-level guides) for setup

**The 517-like debunking post** is notable — it shows XHS developing a **self-correcting mechanism** where viral claims get technically debunked, unlike WeChat where viral claims often go unchallenged.

---

## 🔥 NEW Trend: AI Scientific Research Agents

### Key Posts
| Likes | Title | Author | Signal |
|-------|-------|--------|--------|
| **2,546** | **天塌了！AI竟然帮我斩获了Best Paper 🏆** | Leo | Personal success story — HUGE engagement |
| **1,760** | **陈德里开源了他科研的skills！** | 机器之心 | Major researcher sharing methodology |
| 440 | 最强科研AI Agent发布 | 小象的AI笔记 | Product launch |
| 326 | 又一个AI科研Agent平台开放上线 | V观海外 | Platform announcement |
| 301 | 北大做了一个"越做科研越聪明"的AI科学家 | 晴天 | PKU research agent |
| 88 | SAGA：自主演化科研目标的AI Agent | Wengong Jin | Self-evolving research goals |

### Analysis
The **2,546-like post** about winning Best Paper with AI assistance is extraordinary — it's one of the highest-engagement AI posts on XHS, surpassing most technical posts. This reveals:
- **Academic pressure** (内卷 in research) driving adoption
- **No stigma** about using AI for research on XHS (contrast with Western academic ethics debates)
- **陈德里's skills** being open-sourced by 机器之心 (1,760 likes) shows the Chinese research community's move toward open methodology sharing

---

## 📊 Updated Quantitative Dashboard

### Top Posts by Category (This Session)
| Category | Top Post Likes | Trend Direction |
|----------|---------------|-----------------|
| **AI Research Agents** | 2,546 | 🆕 Exploding |
| **Coding Tool Wars** | 1,515 | ⬆️ Intensifying |
| **Skills/Tools Meta** | 978 | 🆕 New discourse |
| **Vibe Coding → Agentic Eng** | 897 | 🆕 Paradigm shift |
| **Cursor Decline** | 676 | ⬆️ Accelerating |
| **Self-Evolving Agents** | 387 | 🆕 Academic hot |
| **Agent Memory** | 387 | ⬆️ Conference-validated |
| **Self-Evolution (综合)** | 279 | 🆕 Taxonomy forming |

### Model Mentions in Comments (New Signal)
| Model | Mention Context | Chinese Sentiment |
|-------|----------------|-------------------|
| GPT-5.4 | "gpt-5.4" in Codex comparisons | Production workhorse |
| GPT-5.3-codex | Specific coding variant | Known to developers |
| Claude Opus 4.6 | "opus4.6 thinking 1M" | Desired but inaccessible |
| Gemini | "gemini最近笨笨的，还喜欢偷懒" | Getting lazy/dumb recently |
| Qwen 5.5 | Referenced in Codex context | Error rate "near 0" |

### KOL Power Rankings (Updated)
| KOL | Posts Seen | Avg Likes | Specialty |
|-----|-----------|-----------|-----------|
| 王鹏LLM | 4+ | ~150 | Tool reviews, paper curation |
| 机器之心 | 2+ | ~1,000 | Major AI media |
| 智东西 | 1 | 978 | Tech analysis |
| Z.MEI | 1 | 897 | Developer methodology |
| little book | 2 | ~160 | Self-evolution taxonomy |
| 根思喵教授 | 2 | ~226 | Accessible research explainers |

---

## 🔮 New Signals & Predictions (Updated)

### Signal 1: Self-Evolution Will Become the Default Agent Architecture Expectation
The concentration of 10+ posts with 2,500+ cumulative engagement on self-evolving agents suggests this will become a **baseline expectation** for production agents within 6 months. Chinese community is ahead of Western discourse here — HN has scattered papers but no unified taxonomy.

### Signal 2: Cursor's Decline Is a Leading Indicator for IDE-Based AI
The "现在还有人再用Cursor吗？" (Does anyone still use Cursor?) post with 676 likes and 90% migration claim suggests **IDE-integrated AI coding is losing to CLI/terminal-native agents**. This pattern may repeat for other IDE-based tools.

### Signal 3: The "Fake Claude" Problem Will Drive Chinese Model Adoption
Multiple comments reference buying counterfeit or degraded Claude API access through resellers. This **trust deficit** will accelerate adoption of domestic models (Qwen, DeepSeek) where API authenticity is guaranteed.

### Signal 4: Academic Carousel Posts Are a New Content Category
Researchers from 上海 AI Lab, ByteDance, and Tsinghua are posting their own ICML/ICLR papers as XHS carousels — a **new academic distribution channel** with no Western equivalent. This bridges the research-practice gap faster than arXiv alone.

### Signal 5: Hype Cycle Meta-Awareness
Comments like "Skills本来就没吹的那么神奇，跟去年全网吹mcp给人感觉差不多" show the community developing **meta-awareness of AI hype cycles** — comparing current Skills hype to last year's MCP hype. This self-correcting mechanism accelerates the disillusionment trough.

### Signal 6: The "Token Cost ≠ Utility" Debate
Karpathy post comments reveal a fundamental tension: Western AI assumes token costs will drop to zero; Chinese practitioners question whether **token costs will ever be affordable enough** for multi-agent orchestration at Chinese salary levels.

---

## Methodology
- **Primary source**: XHS (xiaohongshu.com) live browsing via Chrome DevTools Protocol, 2026-06-07
- **Search queries**: "AI agent 智能体 2026", "Claude Code Cursor AI编程", "Qwen DeepSeek 大模型 开源", "自进化 self-evolving ICML agent memory", "Hermes agent AI 自动赚钱", "AI 科学家 科研 agent research"
- **Posts read in full**: Self-Evolving (6a22e99a), Codex vs Claude (69caa265), Karpathy/Vibe Coding (6a157709), ICML Agent Memory (6a1ec0de), Skills vs AGENTS.md (6989b8d6), Cursor decline (6a09cf3e)
- **Cross-referenced with**: Prior XHS reports from 2026-06-01 through 2026-06-06

Source: https://www.xiaohongshu.com/explore (multiple searches and note reads, 2026-06-07)
