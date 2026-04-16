# Cold Start / Memory Fix

**Owner:** tech-lead
**Goal:** Reduce session startup waste from 20-30% to under 10% of budget.
**Created:** 2026-04-16
**Status:** Active
**Master project:** [system-evolution.md](../../may/workspace/projects/system-evolution.md) → Gap 1
**Source feedback:** [tech-lead](../system-gaps.md), [optimizer](../../optimizer/workspace/system-gaps.md), [coach](../../coach/workspace/system-gaps.md)
**Tracked metrics:** `system.agent-utilization`

## Why
Every agent wastes their first 5-15 tool calls rebuilding context: reading todo.md, querying DB, scanning recent sessions. Tech-lead, optimizer, coach, and scout all independently flagged this as their #1 time sink.

## Milestones

- [ ] **Structured handoff file per agent** — Each agent writes a machine-readable `last-session.md` at session end (what changed, what's pending, key state). Next session reads this ONE file instead of 5-10 queries.
- [ ] **"Diff since last session" tool** — Given a timestamp, show what files changed, what requests completed, what new requests arrived. Eliminates manual reconstruction.
- [ ] **Split bloated todo.md files** — Separate active priorities from historical log. Scout specifically flagged todo.md as a wall of text that buries actionable items.
- [ ] **Pre-computed context injection** — At session start, inject a summary block with: pending requests, recent completions, current project state. Don't make agents query for basics.

## Progress Log
<!-- Append entries as milestones are completed -->
