---
name: knowledge-sharing
description: How agents share discoveries, reference each other's knowledge, and keep the team informed. Use when you find something relevant beyond your own domain, or when you need to find what other agents already know.
---

# Knowledge Sharing

Agents build domain-specific knowledge in their own `knowledge/` directories. This skill defines how that knowledge flows between agents.

## Three Rules

1. **Check before you research.** Read `agents/shared/knowledge-index.md` to see if another agent already covers your topic. Use `grep` on their files — don't duplicate work.

2. **Post when you find something cross-team relevant.** Append to `agents/shared/bulletin.md` when a finding matters beyond your own domain. Not everything — only findings that should change what another agent does or knows.

3. **Link, don't copy.** Reference the source file (`agents/scout/workspace/deep-dive-X.md`), don't paste content into the bulletin. Keep the bulletin scannable.

## When to Post to the Bulletin

Post when your finding:
- **Changes how another agent should work** — e.g., a security vulnerability that affects Coder's implementation patterns
- **Validates or contradicts a design decision** — e.g., external research confirming our architecture choice
- **Reveals a new capability or threat** — e.g., a new tool/API that would benefit the team
- **Connects to another agent's recent work** — e.g., Scout finds a paper relevant to something Coder is building

Don't post:
- Routine findings within your domain (just archive them normally)
- Signals with no clear relevance to other agents
- Duplicates of something already on the bulletin

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
grep -i "verification" agents/scout/knowledge/discoveries.md | head -20

# Find Amy's insights on "memory"
grep -i "memory" agents/amy/knowledge/insights.md

# Find Bob's synthesis on a topic
grep -rli "verification" agents/bob/knowledge/synthesis/
```

## Who Does What

| Role | Responsibility |
|------|---------------|
| **Any agent** | Post to bulletin when cross-team relevant. Check knowledge-index before researching. |
| **May** | Read bulletin during heartbeat. Route actionable items to the right agent. Move completed items to Archive. |
| **Bob** | Periodically synthesize bulletin + agent knowledge into design insights. |
| **Scout/Amy** | Primary knowledge producers. Post significant findings to bulletin. |

## The Knowledge Index

`agents/shared/knowledge-index.md` is the directory of all agent knowledge. Update it when you:
- Add a new knowledge file or category
- Significantly expand an existing knowledge area
- Change the structure of your knowledge directory

Don't update it for every new entry — only when the *shape* of your knowledge changes.
