---
id: KE-2060
title: "scout-knowledge-lib Status Split: project.json=active, DB=waiting → 13 False stale-blocker-loop Findings/Day"
date: 2026-06-21
author: arc
status: active
tags: [status-mismatch, evaluator, stale-blocker-loop, scout, false-positive, project-apps]
related: [KE-2052, KE-2058, KE-1854, KE-1392]
last_verified: 2026-06-20T04:07Z
---

<ai_context>
summary: "scout-knowledge-lib.app has a status split: project.json on disk says status=active, but the DB projects table says status=waiting (set 2026-06-14 during creative audit). Meanwhile, app.ts explore schedules are all enabled=true, so 107 scout sessions ran in the last 24h — productive sessions averaging 43.1 ops, producing real arXiv/HN/XHS findings. The evaluator's aftermath heuristic sees the DB status=waiting and generates stale-blocker-loop findings (24 in the last 12h alone, ~48/day projected — rate has doubled since first observation). CRITICAL CORRECTION: capability.status-reality-mismatch-count reads 0 — it does NOT detect this disk/DB split. The metric is a composite of staleActiveProjects + staleActiveMetrics + terminalSessionsWithoutEnd + agentsWithoutHeartbeat (metrics-snapshot.ts line ~2305). It never compares project.json status to DB projects.status. There is NO automatic reconciler for this class of mismatch."
triggers: [inbox learning.feedback stale-blocker-loop, evaluator false positive flood]
falsifiers:
  - F1: "If the DB status is updated to active (matching project.json), the stale-blocker-loop findings stop." — Fix test. BLOCKED: requires DB write (emit or human).
  - F2: "If project.json is intentionally waiting (matching DB), the app.ts schedules should be disabled." — Check with may/hao.
  - F3: "If the evaluator's stale-blocker-loop heuristic checks disk status instead of DB status, the false positives stop regardless." — Evaluator code change.
  - F4: "If a disk→DB status reconciler is added to metrics-snapshot.ts or project-health.ts, all future mismatches auto-resolve." — Code proposal needed.
</ai_context>

# KE-2060: scout-knowledge-lib Status Split Drives False Blocker-Loop Findings

## Observation

scout-knowledge-lib.app has three status sources that disagree:

| Source | Status | Set When |
|--------|--------|----------|
| `projects/scout-knowledge-lib.app/project.json` (disk) | `active` (P1) | Current on disk |
| `projects` DB table | `waiting` (P2) | 2026-06-14 14:15Z (creative audit) |
| `app.ts` schedules (explore-arxiv, explore-hn, explore-xhs, explore-github, daily-digest) | All `enabled: true` | Current |

### What actually happens

Scout runs ~99 sessions/day via the app.ts schedules. These are productive:
- 95/99 succeed (status=done), avg 43.5 ops
- Sessions produce real arXiv triage, HN findings, XHS research
- Example: s_1781899041386_6 produced a 12-paper arXiv triage, quality 0.85

### What the evaluator sees

The aftermath heuristic reads `projects.status = 'waiting'` from the DB and concludes sessions dispatched under this project must be stuck in a "stale blocker loop." It generates `learning.feedback` events with finding `stale-blocker-loop` — 13 in the last 24h (7 for scout-knowledge-lib, 5 with null project, 1 for aks-rp-e2e).

These findings are false positives for scout. The sessions aren't looping on a blocker — they're doing scheduled exploration work. The `waiting` status in the DB reflects a 2026-06-14 creative audit decision to disable the *heartbeat* schedule (which was done correctly — `scout-heartbeat: enabled: false`), but the DB status was set to `waiting` globally, not just for the heartbeat workflow.

### Metrics impact

`capability.status-reality-mismatch-count = 0` — **does NOT detect this mismatch** (corrected 2026-06-20). The metric is a composite of `staleActiveProjects + staleActiveMetrics + terminalSessionsWithoutEnd + agentsWithoutHeartbeat` (metrics-snapshot.ts line ~2305). It never compares `project.json` disk status to DB `projects.status`. There is no automatic reconciler for disk/DB project status splits.

### Rate escalation (2026-06-20 04:07Z)

| Window | stale-blocker-loop findings |
|--------|---------------------------|
| KE-2060 initial (Jun 19) | 13/24h |
| Last 12h (Jun 20 04:07Z) | 24/12h (48/day projected) |

The rate has nearly quadrupled. 19/28 in the last 24h target scout-knowledge-lib specifically.

## Root Cause

The creative audit on 2026-06-14 made two changes:
1. Disabled the `scout-heartbeat` schedule in app.ts (`enabled: false`) — correct
2. Set project status to `waiting` in the DB — overly broad

The explore schedules (arxiv, hn, xhs, github) remained `enabled: true`, so sessions continued. But the DB status stayed `waiting`, creating a permanent mismatch.

## Why This Pattern Recurs

This is the same "evaluate-from-DB-but-control-from-disk" pattern seen in:
- **KE-2058**: Metrics retired in handler code but `status: active` in DB → phantom breaches
- **KE-2052**: common-sense.md teaches disabled legacy project model

The system has two truth sources (disk files and DB) with no reconciliation loop. Whoever changes one doesn't always change the other.

## Resolution Path

Either:
1. **Update DB to match disk**: Set `projects.status = 'active'` for scout-knowledge-lib.app (since the app IS actively running sessions) — this is the correct fix if the project is meant to stay active
2. **Update disk to match DB**: Disable all explore schedules in app.ts if the project is truly meant to be waiting — but this would stop scout's research output

Option 1 is correct. The creative audit intended to pause the heartbeat, not stop all exploration. The project owner (may/hao) should reconcile.
