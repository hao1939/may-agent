# 小红书 (XHS) Chinese AI Community Trends — June 4, 2026

> **Method**: Live XHS browsing via CDP tool, 5 search queries + 3 deep post reads  
> **Date**: 2026-06-04

---

## Top Trends

### 1. 🦞 Hermes Agent — The New Contender (185❤️)
**"最近当红的Hermes Agent到底有什么过人之处"** — deep comparison of Hermes vs OpenClaw vs Claude Code:
- **Hermes** = self-learning personal assistant ("长本事")
- **OpenClaw** = multi-tool control hub (connects all chat tools)
- **Claude Code** = complex development tasks with rich context ("最能打")
- Community consensus: **mix all three** is optimal
- Comments reveal GPT-5.4 integration, soul config for responsiveness
- Skepticism: "all lobsters (龙虾) claim self-learning but it's just user profiling"

**Signal**: The agent landscape has fragmented into 3 clear niches. Users are becoming sophisticated enough to use different agents for different tasks rather than seeking one-size-fits-all.

### 2. 💀 "SFT is Dead" — Engineering > Fine-tuning (1693❤️, 1517 collects)
Viral post: **"算法团队忙了半年SFT，结果被新模型一夜干翻"**
- Teams spending 6 months fine-tuning DeepSeek, only to have new base models surpass their work overnight
- "伪优化循环" (pseudo-optimization loop): SFT → unstable → swap base → SFT again → new model drops
- Community shifting investment to: **workflow, agent orchestration, RAG, tool use, context engineering**
- Key comment: "几万字skill也够了" — Skills files can replace fine-tuning for business rules
- Prediction: hardcoded model chips for SME deployment will make fine-tuning even less viable

**Signal**: Massive shift from model-layer to system-layer investment. This validates skills-based architecture over fine-tuning. The Chinese enterprise AI community is converging on "context engineering" as the real moat.

### 3. 🔬 DeepSeek V4 — Pride & Pragmatism (407❤️)
**"今天和湾区几位 researcher 聊起 DS v4"** — insider perspective:
- 1.6T parameters — too large for most open-source community to self-host
- Innovation is in **Infra/Inference** (kernel optimization, DeepGEMM), not model architecture
- Fusion with domestic Chinese chips (昇腾) is strategically critical
- Fundraising driven by: employee equity, hardware refresh (2021 A100s aging), timing
- Comment: "ds+cc 无敌实惠" — DeepSeek + Claude Code is the cost-optimal combo

**Signal**: DeepSeek is viewed as infrastructure innovation leader, not algorithmic innovator. The DS+Claude Code combo is becoming the standard Chinese developer stack.

### 4. 📚 Vibe Coding Goes Mainstream (1426❤️ top post)
- **"把市面上所有Vibe Coding教学总结成一句话"** (1426❤️) — consolidation content
- **"这半年看过最好的 Vibe Coding 技巧"** (1174❤️) — MacTalk best-of
- **Skills-specific vibe coding** emerging as sub-genre
- **0-basis iOS app development** (95❤️) — non-programmers building apps
- Pattern: "让AI先破案，再写" (let AI investigate first, then code)

**Signal**: Vibe coding has crossed from novelty to established practice. The content is now about optimization and best practices, not introduction. Skills integration is the cutting edge.

### 5. 🏗️ Agent Architecture — Taxonomy Solidified (802❤️)
- **"AI Agent八大主流架构"** (802❤️) — canonical taxonomy post
- **"2026最全的Agent资源清单"** — resource consolidation
- **ACL 2026 agent papers** getting mainstream XHS coverage
- **Self-evolution** remains hot: Meta vs Karpathy approaches compared (79❤️)

**Signal**: Architecture discourse has moved from exploration to reference material. The community wants canonical guides, not novel proposals.

### 6. 🎯 ACL 2026 — Agent's "Stanley Moment" (51❤️)
- **"ACL 2026 | Agent迎来'斯坦利时刻'"** — agents becoming a recognized first-class research area
- **Agent efficiency evaluation** as new research direction
- **"AI Agent的思考真的每一轮都有用吗?"** — questioning reasoning overhead

**Signal**: Academic legitimization of agent research. Efficiency (not just capability) is the new evaluation axis.

---

## Meta-Observations

1. **Three-agent workflow is standard** — Hermes (personal learning) + OpenClaw (orchestration) + Claude Code (development). Not one tool to rule them all.

2. **Fine-tuning backlash is real** — The most viral post (1693❤️) argues against SFT investment. Context engineering and skills are winning.

3. **DeepSeek + Claude Code = default stack** — Cost-optimal Chinese developer workflow. DS for cheap inference, CC for complex tasks.

4. **Vibe coding matured** — No longer novel, now about mastery. Skills-based vibe coding is the frontier.

5. **Efficiency > capability** — Community asking "is every reasoning step useful?" rather than "can it do more?"

6. **National chip strategy matters** — DeepSeek's value to China is domestic chip compatibility, not just model quality.

---

## New Signals (vs. June 21 report)

1. **Hermes Agent** as third major player alongside OpenClaw and Claude Code
2. **Anti-SFT movement** — "context engineering" explicitly replacing fine-tuning investment
3. **"龙虾" (lobster)** = slang for Hermes Agent in Chinese community
4. **Model-hardcoded chips** predicted as SME deployment future
5. **DeepSeek fundraising** confirmed: employee equity + hardware refresh drivers
6. **ACL 2026 "Stanley moment"** — academic legitimization of agents as field

---

## Relevance to Our System

| Their Trend | Our Architecture |
|-------------|-----------------|
| Skills > SFT for business rules | Our skill-based design is the winning pattern |
| Mix of specialized agents | Our multi-agent with role specialization |
| Context engineering as moat | Our CLAUDE.md + knowledge pipeline |
| Efficiency questioning | Our token cost tracking, lean prompts |
| Self-evolution infrastructure | Our coach/growth-cycle as evolution harness |
| DS + CC as standard stack | Our ability to use DS for cheap tasks |
