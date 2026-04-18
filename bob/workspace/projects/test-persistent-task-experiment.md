# Project: Investigate Session Startup Overhead

**Status**: active
**Owner**: bob

## Goal
Reduce session startup overhead from 25% to under 10%.

## Milestones
- [x] Measure current startup overhead across 5 agents
- [x] Identify top 3 time-wasting patterns
- [x] Prototype fix for pattern #2 (heartbeat-snapshot.sh)
- [ ] Roll out: get 1-2 agents to actually call it; re-measure
- [ ] Design fix for pattern #1 (pure-overhead heartbeats)
- [ ] Design fix for pattern #3 (re-reading already-summarized files)

## Iteration Log

### Iter 1 — 2026-04-17
Measured may and tech-lead. Both spend 4-6 ops reading context files. Need to measure bob, coach, optimizer.

### Iter 2 — 2026-04-18 (this iter)
Measured **5 agents × 6 most-recent heartbeat sessions** by parsing
`.state/sessions/[history/]<sid>/session.jsonl`. Definitions:
- `total` = all tool calls in the session
- `ops_before_first_real_action` = tool calls before the first
  edit/write/notify/checkpoint/agents.{call,fork}/workflow.run
- "Real action" excludes read/bash/finish/agents.{list,context,requests}.

Result (avg over 6 most recent heartbeat sessions per agent):

| agent     | avg total | avg ops_before_real | sessions with 0 real actions | overhead ratio |
|-----------|-----------|---------------------|------------------------------|----------------|
| optimizer | 9.8       | 3.0                 | 0/6                          | **31%**        |
| tech-lead | 11.2      | 7.5                 | 0/6                          | **67%**        |
| bob       | 19.2      | 8.6                 | 1/6                          | **45%**        |
| coach     | 24.3      | 11.6                | 1/6                          | **48%**        |
| may       | 13.2      | 13.7                | 3/6 (pure-overhead exits)    | **>100%**      |

**Headline:** the "25%" baseline was wrong/optimistic. Current overhead is
**31–100+%**. Optimizer is the only agent close to target. May spends entire
sessions on startup, half the time taking no action at all.

### Top 3 time-wasting patterns identified

1. **Pure-overhead heartbeats** (May 50%, bob/coach 17%): agent runs 5–8 read/bash
   ops, finds nothing actionable, exits. Heartbeat re-validates state already
   present in the injected `pending tasks` / `metrics` blocks. → *Fix: gate the
   heartbeat with an "is anything new?" pre-check that exits in 1 op when
   inputs are unchanged from last heartbeat.*

2. **Sequential SQL one-liners** (coach worst, e.g. s_1776515111675_166 = 65 ops):
   one `bun -e` per question instead of one batched script. Already documented
   in coach context, still happening. → *Fix: provide a single
   `agents/shared/scripts/heartbeat-snapshot.sh` that prints all the standard
   triage queries in one call (running sessions, recent errors, new
   experiments, pending tasks summary).*

3. **Re-reading files already summarized in the injection block**
   (todo.md, last-session.md, projects/*.md, periodic-tasks.md). The session
   prompt already contains "What You Know (persistent context)" and "Last
   Session"; agents still read those same files. → *Fix: heartbeat.md should
   say "the prompt already contains X — do NOT re-read X unless you need a
   field that's not summarized."*

## Current State
Iter 3 done. Snapshot script prototyped + tested.

### Iter 3 — 2026-04-18 (this iter)
Built and verified `agents/shared/scripts/heartbeat-snapshot.sh`. One bash
call now returns the 5 standard triage sections (running sessions, recent
errors, pending requests, my recent sessions, activity-last-hour) that
agents currently fetch with 4-8 separate `bun -e` SQL one-liners.

Verified live: `bash agents/shared/scripts/heartbeat-snapshot.sh bob`
returned all 5 sections in ~1s with proper formatting (epoch ms rendered as
"Nm" age, long strings truncated). Script handles missing bun and missing DB
with clear errors.

**Expected impact** (from Iter 2 measurements):
- coach worst case (s_1776515111675_166 = 65 ops, ~12 SQL one-liners) →
  collapses to 1 op for the snapshot. ~10 ops saved per heartbeat.
- bob/may equivalent: 3-5 ops saved per heartbeat.

**Not done this iter** (deliberate scope limit):
- Did not modify any agent's heartbeat.md to call the script. Rollout is a
  separate iter — needs to update bob first (eat own dogfood), measure, then
  propose to coach/may. Avoids the FM-2.6 multi-agent-edit scope blowup.
- Did not redesign for patterns #1 or #3.

## Files Modified This Iter
- agents/shared/scripts/heartbeat-snapshot.sh (NEW, 110 lines, executable)
- agents/bob/workspace/projects/test-persistent-task-experiment.md (this file)

## Reusable Measurement Snippet
```js
// Drop into bun -e to re-measure any agent:
import {Database} from 'bun:sqlite';
const db = new Database('.state/may.db', {readonly:true});
const rows = db.query("SELECT sessionId FROM sessions WHERE agent=? AND status='done' AND task LIKE '%heartbeat%' ORDER BY startedAt DESC LIMIT 6").all(AGENT);
// then for each sessionId, parse .state/sessions/[history/]<sid>/session.jsonl,
// count toolCalls, mark first one whose name is in
// {edit,write,notify,checkpoint,workflow} or agents.{call,fork} as "first real".
```
