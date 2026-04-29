# Pipeline Metrics: Context-Learn Analysis

**Date:** 2026-04-29  
**Purpose:** Measure whether the context-learn pipeline is organically firing, and identify gaps

## Executive Summary

The context-learn pipeline infrastructure is **fully built and wired** but has produced **zero organic lessons**. All 20 lessons in `lessons.jsonl` are seeded from context.md files. The pipeline's event chain exists but lacks evidence of ever firing in production.

## Pipeline Architecture (How It Should Work)

```
Session completes
  → session-eval.ts fires (cron event: "session-eval")
    → evaluateTask() runs
      → emits "context-learn" event per evaluated session
        → context-learn.ts handler fires
          → learnFromSessionLLM() or learnFromSession() extracts facts
            → applyContextUpdates() writes to agent's context.md
```

**Key files:**
- `/app/agents/may/handlers/session-eval.ts` — Emits `context-learn` events after evaluation
- `/app/agents/may/handlers/context-learn.ts` — Subscribes to those events, extracts facts
- `/app/agents/shared/evaluation/context-learn.ts` — Core extraction logic (LLM + mechanical)
- `/app/agents/may/cron.json` — Both handlers registered and enabled

**Env config:** `CONTEXT_LEARN_AGENTS=coder,may,bob,coach,optimizer,tech-lead` (6 agents enabled)

## Evidence of Pipeline Activity

### Session Volume
- **391 session directories** in `/app/.state/sessions/`
- **History directory** with 35,818 entries — significant session volume exists

### Context-Learn Events Fired: **0 confirmed**
- No `.state/may.db` exists (no evaluation database found)
- No log files found containing "context-learn" entries
- `grep -r "context-learn" /app/.state/sessions/` — found only references in test output and session transcripts discussing the feature, not actual pipeline execution logs
- No evaluation database found at expected locations (`agents/shared/evaluation/evaluations.db`, `.state/may.db`)

### Organic Lessons Extracted: **0**
- `lessons.jsonl`: 20 entries, all with `"source_task":"bootstrapped from context.md"`
- No entries with organic source tasks (e.g., actual session IDs or task descriptions)

## Root Cause Analysis

### Why the pipeline isn't firing:

1. **No evaluation database exists** — The `session-eval.ts` handler calls `evaluateTask()` but there's no evidence an evaluation DB was ever created. Without successful evaluations, no `context-learn` events are emitted.

2. **Event chain dependency** — `context-learn` events are only emitted by `session-eval.ts` after successful evaluation. If evaluation never runs (or fails silently), the downstream context-learn handler never triggers.

3. **No persistent logging** — The handlers use `ctx.log()` but there are no log files on disk. This makes it impossible to determine if the handlers are being invoked at all, or silently failing.

4. **Session-eval trigger unclear** — `session-eval.ts` is an event-only handler (`"on"` field in cron.json). It requires an upstream event to trigger it. If nothing emits the triggering event, the entire chain is dead.

## Context.md Files (Knowledge Source Inventory)

Rich context already exists across agents but isn't being captured into lessons organically:

| Agent | Lines in context.md |
|-------|-------------------|
| coder | 125 |
| bob | 113 |
| tech-lead | 111 |
| may | 92 |
| scout | 84 |
| coach | 83 |
| optimizer | 73 |
| amy | 72 |
| amy-kimi | 46 |
| evaluator | 41 |
| master | 21 |
| architect | 21 |
| judge | 22 |

**Total:** ~900+ lines of durable knowledge across 13 agents

## Lessons.jsonl Status

- **20 seeded lessons** (bootstrapped 2026-04-29)
- **Agents represented:** coder (7), tech-lead (4), may (3), bob (3), system (3)
- **Categories:** pattern (12), fix (5), insight (3)
- **Organic lessons:** 0

## Recommendations

### P0: Fix the event chain
1. **Verify session-eval trigger** — Check what event triggers `session-eval.ts` and whether it's being emitted. Look for the `"on"` field in its cron entry.
2. **Add pipeline health logging** — Write a simple marker file (e.g., `.state/context-learn-last-fire.txt`) each time the handler runs, so we can detect activity without full log infrastructure.

### P1: Add direct extraction path
3. **Bypass the event chain** — Add a cron-based fallback that periodically scans recent completed sessions and extracts lessons directly, rather than depending on the event chain.
4. **Run mechanical extraction on backlog** — The mechanical extractor (`extractFactsMechanical`) requires no LLM. Run it against the 391 existing sessions to bootstrap more lessons.

### P2: Increase lesson volume
5. **Extract remaining context.md content** — The initial seeding captured ~20 lessons from 900+ lines. Run deeper extraction on the remaining context.md files.
6. **Add finish() hook** — When agents call `finish()` with `context_updates` or `lessons`, pipe those directly to `lessons.jsonl` without depending on the eval chain.

## Conclusion

The infrastructure is complete but the activation chain is broken. The most likely failure point is the session-eval trigger — either the upstream event isn't being emitted, or evaluations are failing silently. The 20 seeded lessons prove the storage and retrieval works; the gap is purely in organic capture.
