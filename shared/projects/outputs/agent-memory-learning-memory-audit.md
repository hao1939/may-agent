# Memory Audit — Agent Memory & Learning Project

**Date**: 2025-06-25
**Milestone**: 1 — Audit Current Memory

## Current Memory Infrastructure

### What Exists

| Mechanism | Location | Description |
|-----------|----------|-------------|
| **context.md** | `agents/<name>/context.md` | Per-agent persistent context. Loaded at session start. Contains rules, environment info, lessons from past failures. |
| **lessons.md** | `agents/<name>/knowledge/lessons.md` | Per-agent lesson files. Fed from evaluator feedback. Found in: scout, optimizer. |
| **finish() `lessons` field** | Session metadata | Workers can emit lessons via `finish({ lessons: [...] })`. Categories: fix, pattern, insight. |
| **finish() `context_updates` field** | Injected into context.md | Workers can add/remove persistent facts via `finish({ context_updates: [...] })`. |
| **Checkpoints** | `.state/checkpoints/` | Mid-session state saves. Structured data (files_modified, decisions, next_steps). |
| **Evaluations table** | `.state/may.db` → `evaluations` | Quality/efficiency scores, verdicts, issues per session. No explicit lesson extraction. |

### Agents with Memory Files

| Agent | context.md | lessons.md | Notes |
|-------|-----------|------------|-------|
| amy | ✅ (72 lines) | ❌ | Heavy on path-finding rules, ENOENT recovery |
| bob | ✅ (106 lines) | ❌ | DB access patterns, edit discipline, turn budgeting |
| scout | ✅ (84 lines) | ✅ (30 lines) | Budget discipline, verification rules. Lessons: all about tool verification |
| optimizer | ✅ (72 lines) | ✅ (20 lines) | Read/verify guards. Lessons: skill lifecycle, gym, cross-agent edits |

### What's Being Retained (Working)

1. **Constraint rules** — context.md files encode hard-won lessons as mandatory rules (e.g., "read before edit", "verify after write"). These persist and are loaded every session.
2. **Evaluator feedback** — lessons.md captures evaluator verdicts. Currently only scout and optimizer have these.
3. **Session outcomes** — evaluations table tracks quality, efficiency, wasted calls per session.

### What's Being Lost

1. **Worker iteration lessons** — finish() supports a `lessons` field but there's no evidence it gets persisted anywhere beyond the session record. Lessons emitted by workers likely vanish.
2. **Cross-agent learning** — Each agent learns independently. Scout's lesson about verification isn't shared with amy or bob.
3. **Pattern frequency** — No tracking of how often the same mistake recurs. context.md notes violation counts (e.g., "C1.1: 71 violations") but this requires manual updates.
4. **Project-level knowledge** — Insights from project work (like this system-efficiency project) don't flow back into agent context files automatically.
5. **Checkpoint data** — Checkpoints exist in `.state/checkpoints/` but appear to be one-off recovery files, not a queryable knowledge base.

## Gap Analysis

| Gap | Impact | Fix Complexity |
|-----|--------|---------------|
| finish() lessons not persisted | Workers learn nothing across sessions | Medium — need a handler to write lessons to lessons.md |
| No cross-agent lesson sharing | Same mistakes repeated by different agents | Medium — shared lessons.md or lessons table in DB |
| No lesson retrieval at session start | Past lessons not consulted before new tasks | Low — inject relevant lessons into task context |
| Only 2/4 key agents have lessons.md | Most agents have no lesson accumulation | Low — create files for amy, bob |
| No deduplication of lessons | Same lesson recorded repeatedly (see scout's 6 near-identical entries) | Low — dedup on write |

## Recommendations for Milestone 2

1. **Create a `lessons` table in may.db** — columns: agent, category, content, source_session, created_at, times_referenced
2. **Hook finish() lessons into persistence** — when a worker emits lessons, write them to the DB table AND append to the agent's lessons.md
3. **Deduplicate on insert** — compare new lessons against existing ones (simple string similarity) to avoid scout's problem of 6 identical "verify tools" lessons
4. **Create lessons.md for amy and bob** — even if empty initially, establishes the pattern
5. **Build a pre-task lesson query** — before each task, query lessons table for the agent + topic keywords, inject top 3-5 relevant lessons into context
