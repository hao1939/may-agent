# Coder Utilization Analysis

**Date**: 2026-04-12  
**Author**: May (supervisory audit)

## Current State

### Skills (3 remaining, post-pruning from 10)
1. `efficient-file-reading.md` — Size-check → grep → targeted read
2. `structured-plan-writing.md` — Decompose → order → risk → checkpoint → execute
3. `verify-after-edit.md` — Read back every file after edit/write

### Heartbeat Configuration
- **No independent heartbeat cycle.** Coder has no cron.json, no `.state/coder/` directory.
- Coder is configured as a **tool agent** — it only runs when called by another agent (tech-lead).
- Heartbeat.md exists but is task-specific: "Build the Web UI Agent Visualization Dashboard."
- Coder does NOT self-dispatch. It is entirely dependent on tech-lead invoking it.

### Recent Activity (48h)
| Time | Kind | Ops | Task |
|------|------|-----|------|
| Apr 12 05:37 | call (tech-lead) | 2 | Fix Required (attempt 2/2) — dead code removal verify |
| Apr 12 05:26 | call (tech-lead) | 104 | Dead code removal implementation |
| Apr 12 01:57 | call (tech-lead) | 8 | Fix Required (attempt 2/2) — try-catch wrapping |
| Apr 12 01:55 | call (tech-lead) | 10 | Try-catch wrapping task |
| Apr 11 21:56 | call (tech-lead) | 4 | Fix Required (attempt 2/2) |
| Apr 11 21:54 | call (tech-lead) | 4 | Wrap meta.json write |
| Apr 10 09:26 | call (tech-lead) | 27 | **Web UI Phase 1 build** |

**Pattern**: Every coder session is a `kind=call` from tech-lead workflows. Coder never initiates its own work.

### Comparison to Other Agents (24h)
| Agent | Sessions | Avg Ops |
|-------|----------|---------|
| bob | 139 | 16 |
| optimizer | 126 | 13 |
| tech-lead | 101 | 15 |
| coach | 87 | 22 |
| may | 67 | 22 |
| evaluator | 54 | 5 |
| qa | 48 | 10 |
| scout | 48 | 12 |
| **coder** | **6** | **22** |
| amy-kimi | 1 | 3 (billing blocked) |

Coder is at **6 sessions/24h** — 4-23× less than every healthy agent.

## What Coder Is Set Up To Do

The heartbeat is single-purpose: **Web UI Agent Visualization Dashboard**.

**Phase 1 (Agent Activity Panel)** — PARTIALLY DONE:
- ✅ Agent Status Grid (CSS + HTML + JS in index.html — cards with status dots, names, meta)
- ✅ `/api/agents/timeline` endpoint (returns session data by agent)
- ✅ `/api/agents/health` endpoint
- ⚠️ Activity Timeline — HTML skeleton exists but rendering appears incomplete
- ⚠️ System Health Summary — needs verification

**Phase 2 (Live Activity Feed)** — NOT STARTED
**Phase 3 (Agent Deep Dive)** — NOT STARTED

## Root Cause of Low Utilization

1. **Architecture**: Coder is a tool agent with no heartbeat cycle. It only works when tech-lead calls it. If tech-lead doesn't invoke coder, coder sits idle.

2. **Tech-lead bottleneck**: Tech-lead decides what to delegate vs. do itself. Most of tech-lead's recent work (fewshot regex fix, D-o-R fix, binary rebuild, branch hygiene, cron handler) was done directly — not delegated to coder. Tech-lead is acting as both architect AND implementer.

3. **Narrow scope**: Coder's heartbeat only mentions the web UI project. There's no "if the web UI is blocked, do X" fallback. And no one is actively dispatching web UI Phase 2/3 work.

4. **No pending requests**: Zero pending requests for coder. Zero pending requests for tech-lead either. The request queue is empty.

## Concrete Tasks That Could Be Routed to Coder

### 1. Web UI Phase 2 — Live Activity Feed (HIGH VALUE)
The spec is written, Phase 1 partially done. This is pure implementation work:
- WebSocket event rendering (session_start, session_end events)
- Color-coded by agent
- Auto-scroll with pause button
- Max 50 items visible
- **Dispatched by**: May → coder (direct, or via tech-lead call)

### 2. Web UI Phase 3 — Agent Deep Dive (MEDIUM VALUE)
Clickable agent cards → session history, quality trends, delegation patterns.
- Needs new API endpoints in web.ts
- Pure frontend + API implementation
- **Depends on**: Phase 2 completion or can be done in parallel

### 3. Web UI Phase 1 Completion (QUICK WIN)
Verify Activity Timeline rendering is complete. If not, finish it.
- Check if the timeline canvas/CSS actually renders session blocks
- Test system health summary numbers

## Recommendation

**Route web UI Phase 2 to coder NOW.** Rationale:

1. **Work exists and is specified.** The SPEC is detailed, Phase 1 provides working patterns to follow.
2. **Coder can't self-start.** Without a heartbeat cycle, someone must invoke it. The dispatch must come from tech-lead or directly via fork.
3. **Tech-lead is overloaded with its own work.** Tech-lead is doing D-o-R fixes, binary rebuilds, branch hygiene — it won't get to web UI Phase 2 anytime soon.
4. **Standing Order 001** ("Use idle time to push forward") — coder is violating this by being idle, but structurally can't comply without being invoked.

### Action Plan
1. **Immediate**: Fork a tech-lead session to delegate Web UI Phase 2 to coder. Tech-lead calls coder with the Phase 2 spec.
2. **Short-term**: Consider giving coder a heartbeat cycle so it can self-dispatch web UI work from the spec.
3. **Medium-term**: If web UI is complete and no other implementation work exists, coder stays idle (acceptable — it's a specialist tool agent, not a generalist).

### What NOT To Do
- Don't give coder a heartbeat just to avoid idleness. If there's no implementation work, idle is correct. Busywork is worse than idle.
- Don't route non-implementation work (research, design, experiments) to coder — it's not built for that.
