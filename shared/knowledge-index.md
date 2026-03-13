# Knowledge Index

What each agent knows and where to find it.
Read this before starting research — someone may have already covered your topic.

## Scout — External Research (AI Agents)
- `agents/scout/knowledge/library/discoveries.md` — 300+ curated findings (3300 lines). **Use `grep`, don't read in full.**
- `agents/scout/knowledge/library/repos.md` — GitHub repos: description, stars, relevance (440 lines)
- `agents/scout/knowledge/library/papers.md` — Academic papers with key takeaways
- `agents/scout/knowledge/library/people.md` — Notable researchers and accounts
- `agents/scout/knowledge/library/reddit.md` — Reddit community insights
- `agents/scout/workspace/deep-dive-*.md` — 6 detailed research reports
- **Topics:** agent architecture, skills/tools, context engineering, memory systems, evaluation, RL for agents, MCP protocol, agent security
- **Best for:** "What's the state of the art in X?" or "Any repos doing Y?"

## Amy — XHS / Chinese Community
- `agents/amy/knowledge/insights.md` — Community insights from Xiaohongshu
- `agents/amy/knowledge/threads.md` — Discussion threads tracked
- `agents/amy/knowledge/library/people.md` — Notable XHS accounts and authors
- `agents/amy/knowledge/posts/` — Individual post analyses (80+ files)
- **Topics:** Chinese AI community sentiment, framework comparisons, user experience reports, product trends
- **Best for:** "What does the Chinese AI community think about X?"

## Amy-Kimi — XHS / Chinese Community (Kimi variant)
- `agents/amy-kimi/knowledge/insights.md` — Insights from XHS via Kimi
- `agents/amy-kimi/knowledge/threads.md` — Thread tracking
- **Topics:** Same domain as Amy, different model perspective

## Bob — Design Philosophy & Synthesis
- `agents/bob/knowledge/library/synthesis/` — 18 cross-agent synthesis reports
- `agents/shared/philosophy.md` — Design philosophy (Bob maintains)
- `agents/shared/roadmap.md` — Product roadmap
- **Topics:** system design principles, cross-agent patterns, failure mode analysis, human intent interpretation
- **Best for:** "What's the design rationale for X?" or "What patterns emerged from Y?"

## Coder — Codebase Knowledge
- `agents/coder/knowledge/library/codebase.md` — Architecture reference for may-agent codebase
- `agents/coder/knowledge/lessons.md` — Implementation patterns and gotchas
- **Topics:** may-agent internals, TypeScript patterns, tool implementation
- **Best for:** "How does X work in the codebase?" or "What's the pattern for Y?"

## Coach — Agent Development
- `agents/coach/knowledge/library/coaching-methodology.md` — Coaching process
- `agents/coach/skills/agent-conventions/` — 33 conventions library
- `agents/coach/workspace/COACHEES.md` — Graduation tracking per agent
- **Topics:** agent behavior patterns, convention compliance, coaching results
- **Best for:** "What are the common agent failure patterns?" or "How should agents handle X?"

## Shared Reference
- `agents/shared/system-design.md` — System architecture (auto-loaded by most agents)
- `agents/shared/team.md` — Agent roster and roles
- `agents/shared/philosophy.md` — Design philosophy
- `agents/shared/roadmap.md` — Product direction
- `agents/shared/bulletin.md` — Cross-agent findings needing attention
- `agents/shared/knowledge/strategies.md` — Common failure recovery patterns (P63)
- `docs/` — Design docs, architecture, proposals, operations. See `docs/README.md`.

## Shared Tools
- `scrape_webpage` — Robust web page fetcher (handles headers, redirects, HTML cleaning).
  - Used by: Scout, Amy, Amy-Kimi
  - Implementation: `src/lib/scrape.ts`
  - Docs: `agents/shared/skills/web-scraping/SKILL.md`
