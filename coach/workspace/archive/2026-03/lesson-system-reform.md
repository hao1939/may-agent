# Lesson System Reform — Coach Action Plan

From Hao's review (2026-03-14). This is your roadmap for fixing the learning pipeline.

## The Problem (Measured)

LESSONS.md doesn't reliably change behavior. We measured two cases:
- **May's 🔴🔴🔴 heartbeat lesson: FAILED** (shallow heartbeats went from 5% → 11% — WORSE)
- **Evaluator's "evaluate one session" lesson + structure: WORKED** (low-effort dropped 86% → 31%)

The difference: **structural changes to heartbeat.md work. Lessons alone don't.**

Your own Convention C13 says this: "workflow structure > lessons." The data proves it.

## New Mental Model

LESSONS.md is a **staging area**, not an archive. Every entry should graduate into structure within 2 weeks.

```
DISCOVERY → BAND-AID (LESSONS.md) → GRADUATION (structure) → CLEANUP (delete from LESSONS.md)
```

## Phase 1: Build Measurement (DO THIS FIRST)

You need to know if lessons work. Add to your heartbeat:

1. After adding a lesson, note: "Lesson X added for agent Y on date Z. Check after 5 sessions."
2. To measure: compare agent's avg quality score for 5 sessions before vs 5 after the lesson.
3. Data source: `.state/evaluations/` — find evaluations for the target agent, check scores.

A bash script in your workspace is fine. Doesn't need to be fancy:
```bash
# Example: check if evaluator quality improved after lesson
ls -t .state/evaluations/ | head -20 | while read f; do
  grep -l "evaluator" ".state/evaluations/$f" 2>/dev/null
done
```

Without measurement, all lesson work is faith-based.

## Phase 2: Graduate Existing Lessons

For each agent's LESSONS.md, categorize every entry:

| Destination | When to use | Example |
|------------|------------|---------|
| **heartbeat.md** | Behavioral mandate ("always do X") | "Evaluate at least one session per heartbeat" |
| **DOMAIN.md** | Permanent knowledge | "Project root is /app" |
| **SOUL.md** | Core identity principle (rare) | "Verify behavior, not files" |
| **skill doc** | Reusable procedure | "How to do multi-file edit safely" |
| **tool code** | Structural enforcement | Tool rejects unknown tool names |
| **DELETE** | Stale or ineffective | P53 references, duplicate entries |

### Specific graduations to make:

1. **May's 🔴🔴🔴 heartbeat lesson** → ALREADY GRADUATED to heartbeat.md Steps 3-5. Lesson removed. ✅
2. **"No Blind Writes" / "Verify Paths" / "Context Efficiency"** → ALREADY GRADUATED to agents/shared/LESSONS.md. Remove from individual agents. ✅ (in progress via self-dedup)
3. **"No Phantom Tools" (Optimizer)** → Graduate to TOOLS.md ("Your available tools are: read, write, edit, bash, agents, workflow")
4. **"ENOENT = Pick Next" (Evaluator)** → Graduate to heartbeat.md step
5. **P53 references everywhere** → DELETE (P53 bash guard removed)
6. **"Verify Paths: /app"** → Move to DOMAIN.md Environment section per agent

## Progress Tracker

| Agent | Status | Before | After | Notes |
|-------|--------|--------|-------|-------|
| Optimizer | ✅ Done (pre-H522) | ~30 lines | ~10 lines | Graduated tool precision, phantom tools |
| Amy | ✅ Done (pre-H522) | ~15 lines | ~5 lines | C17 model-level, heartbeat structural |
| Coder | ✅ Done (pre-H522) | ~20 lines | ~8 lines | P104, exec rejection |
| Evaluator | ✅ Done (pre-H522) | ~25 lines | ~10 lines | Session-ID structural fix |
| **Coach** | ✅ **Done (H522)** | 29 lines | ~15 lines | 8 graduated, 2 active band-aids |
| **Bob** | ✅ **Done (H522)** | 23 lines | ~15 lines | 6 graduated, 4 active band-aids |
| Tech-lead | ⬜ Pending | 21 lines | — | cd /app 4x recurrence, P114 — some unique |
| Scout | ⬜ Pending | 16 lines | — | Context budget — may be unique |
| QA | ⬜ Pending | 20 lines | — | |
| Amy-Kimi | ⬜ Pending | 14 lines | — | |
| May | ⬜ Pending | 16 lines | — | |
| Master | ⬜ Pending | 20 lines | — | |

## Phase 3: Ongoing Discipline

Add to your heartbeat routine:
- **Lesson age check**: Any LESSONS.md entry older than 2 weeks? Graduate it or delete it.
- **One graduation per heartbeat**: Pick the oldest lesson, find its structural home, move it there.
- **Measurement follow-up**: After 5 sessions, check if the lesson changed behavior.

## The Stop-Doing List

- ❌ Stop accumulating lessons without measuring their effect
- ❌ Stop adding 🔴🔴🔴 emphasis — it doesn't help (data shows this)
- ❌ Stop duplicating shared knowledge across 12 agents
- ❌ Stop treating LESSONS.md as permanent storage

## The Start-Doing List

- ✅ Measure before/after when adding lessons
- ✅ Graduate lessons into structural fixes (heartbeat.md, tool code, DOMAIN.md)
- ✅ Delete lessons that have been graduated or are >2 weeks old without effect
- ✅ Keep LESSONS.md short (<10 items, <300 tokens per agent)

## The Metric That Matters

**How many lessons have successfully graduated into structural fixes, and did quality scores improve?**

Current answer: 1 confirmed (evaluator heartbeat). Goal: graduate all existing lessons within 2 weeks.
