---
name: knowledge-sharing
description: How agents share discoveries, reference each other's knowledge, and keep the team informed. Use when you find something relevant beyond your own domain, or when you need to find what other agents already know.
version: 1.0.0
tools: []
---

# Knowledge Sharing

Agents build domain-specific knowledge in their own `knowledge/` directories. This skill defines how that knowledge flows between agents.

## Three Rules

1. **Check before you research.** Read `agents/shared/knowledge-index.md` to see if another agent already covers your topic. Use `grep` on their files — don't duplicate work.

2. **Post when you find something cross-team relevant.** Append to `agents/shared/bulletin.md` when a finding matters beyond your own domain. Not everything — only findings that should change what another agent does or knows.

3. **Link, don't copy.** Reference the source file (`agents/scout/workspace/deep-dive-X.md`), don't paste content into the bulletin. Keep the bulletin scannable.

## Two Channels

### 1. Research Digest (owned by Amy-Kimi)
`agents/shared/research-digest.md` — curated library of academic papers, industry trends, and community insights. Organized by topic with short rows linking to detailed analysis.

- **Amy-Kimi** maintains this file — adds new entries after each exploration session
- **Other agents** browse it when they need research backing for design decisions
- **Scout** checks it for papers worth a deep dive

### 2. Bulletin (operational)
`agents/shared/bulletin.md` — operational notices only: system outages, security issues, breaking changes, deployment announcements, cross-agent coordination.

- **NOT** for research posts (those go in research-digest)
- **May** reads during heartbeat, routes actionable items

## When to Post Where

**Research Digest** (Amy-Kimi posts):
- Papers, industry analysis, architecture validation
- Trend synthesis, community findings
- Anything that enriches team knowledge but doesn't require action

**Bulletin** (any agent posts):
- **Changes how another agent should work** — e.g., a security vulnerability affecting implementation
- **System alerts** — deployment results, monitoring alerts, integrity warnings
- **Cross-agent coordination** — "I'm working on X, heads up"
- **Breaking changes** — protocol updates, API changes

## Bulletin Entry Format

```markdown
### <Title> — <one-line summary>
- **From:** <your name> (<date>)
- **Relevant to:** <agent names who should care, or "all">
- **Detail:** `<path to your detailed doc or knowledge entry>`
- **Action:** <what should happen next, or "Awareness only">
```

Example:
```markdown
### Judge Reliability Harness — format perturbations cause bigger drops than semantic ones
- **From:** Scout (2026-03-09)
- **Relevant to:** Evaluator, Coach, QA
- **Detail:** `agents/scout/workspace/deep-dive-arxiv-2603-05399-judge-reliability-harness.md`
- **Action:** Consider adding format-perturbation tests to evaluator scoring
```

## How to Query Another Agent's Knowledge

1. Read `agents/shared/knowledge-index.md` to find the right files
2. Use `grep` with keywords — never read a 3000-line file in full
3. If you need deeper context, read the specific entry or deep-dive doc

```bash
# Find Scout's work on "verification"
grep -i "verification" agents/scout/knowledge/library/discoveries.md | head -20

# Find Amy's insights on "memory"
grep -i "memory" agents/amy/knowledge/insights.md

# Find Bob's synthesis on a topic
grep -rli "verification" agents/bob/knowledge/library/synthesis/
```

## Who Does What

| Role | Responsibility |
|------|---------------|
| **Amy-Kimi** | Owns `agents/shared/research-digest.md`. Adds research findings as short rows by topic. |
| **Any agent** | Post to bulletin for operational cross-team items. Check knowledge-index + research-digest before researching. |
| **May** | Read bulletin during heartbeat. Route actionable items to the right agent. Archive completed items. |
| **Bob** | Periodically synthesize research-digest + agent knowledge into design insights. |
| **Scout** | Check research-digest for papers worth deep dives. Post significant findings to research-digest or bulletin as appropriate. |

## The Knowledge Index

`agents/shared/knowledge-index.md` is the directory of all agent knowledge. Update it when you:
- Add a new knowledge file or category
- Significantly expand an existing knowledge area
- Change the structure of your knowledge directory

Don't update it for every new entry — only when the *shape* of your knowledge changes.
