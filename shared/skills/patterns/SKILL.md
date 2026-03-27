---
name: pattern-check
description: >
  Proven multi-agent interaction patterns for complex tasks. Check this directory
  BEFORE planning any complex or novel workflow to see if a solved path already exists.
  Use when receiving a multi-step task, a task involving 2+ agents, or a task type
  you've seen before but don't remember the optimal sequence for.
  Inspired by "Workflow Memory" (arXiv:2601.12538) — reusing successful patterns
  is the single biggest lever for multi-agent efficiency.
version: 1.0.0
tools: []
---

# Pattern Library

This directory contains proven multi-agent interaction patterns. **Check here
before planning complex workflows** to see if a solved path exists.

## Why This Exists

Research on multi-agent systems (arXiv:2601.12538) identifies "Workflow Memory" —
the reuse of successful interaction patterns — as a key driver of efficiency.
Instead of re-deriving coordination strategies from scratch each time, agents
should consult a library of patterns that have already worked.

## When to Check

Before planning any task that involves:
- **2+ agents** working in sequence or parallel
- **Multi-step coordination** (implement → review → fix → commit)
- **External data gathering** (scraping, APIs, research)
- **A task type you've handled before** but need to recall the optimal path

## How to Use

1. Scan the pattern files in this directory (filenames are descriptive).
2. If a pattern matches your task, **follow it** — don't reinvent.
3. If no pattern matches but you solve a novel multi-agent task successfully,
   **add a new pattern file** here for future reuse.
4. If a pattern is outdated or suboptimal, **update it** with what you learned.

## Available Patterns

| Pattern | File | When to Use |
|---------|------|-------------|
| Robust Web Scraping | `robust-scraping.md` | Extracting data from web pages reliably |
| Research & Synthesize | `research-and-synthesize.md` | Gathering external info and producing a summary |
| Implement → Review → Commit | `implement-review-commit.md` | Any code change (the standard path) |

## Adding New Patterns

When you complete a novel multi-agent task successfully, capture the pattern:

```markdown
# Pattern Name

## Context
When to use this pattern. What problem it solves.

## Agents Involved
Which agents, in what order.

## Steps
1. Step one — who does what
2. Step two — ...

## Key Lessons
- What made this work
- What to watch out for
```

Keep patterns concise. The goal is a quick-reference checklist, not a tutorial.
