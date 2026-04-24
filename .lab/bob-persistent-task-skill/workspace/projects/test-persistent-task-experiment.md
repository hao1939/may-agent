# Project: Investigate Session Startup Overhead

**Status**: active
**Owner**: bob

## Goal
Reduce session startup overhead from 25% to under 10%.

## Milestones
- [x] Measure current startup overhead across 5 agents
- [x] Identify top 3 time-wasting patterns
- [x] Prototype fix for pattern #2 (heartbeat-snapshot.sh)
- [x] Roll out: dogfood in bob's heartbeat (Iter 4)
- [x] Re-measure bob after 6+ heartbeat sessions to confirm impact (Iter 5)
- [ ] Propose snapshot script to coach + may heartbeats
- [ ] Design fix for pattern #1 (pure-overhead heartbeats)
- [x] Address pattern #3 (re-reading already-summarized files) — added
      anti-re-read note in bob's Step 1 (Iter 4)

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
Iter 5 done. Rollout validated with live data: bob overhead 55% → 39%, total
ops 15.4 → 9.3 (−40%). Snapshot script is being used in 10/10 post-rollout
scheduled heartbeats. Goal threshold (<10%) not yet reached; pattern #1
(pure-overhead heartbeats) remains the biggest unclaimed win.

### Iter 5 — 2026-04-18 (this iter) — Re-measurement
Measured bob's scheduled heartbeats (kind=job, source=NULL) before vs. after
the Iter 4 rollout at 13:04 UTC on 2026-04-18. Parsed session.jsonl under
`.state/sessions/history/<sid>/` using the same definition as Iter 2:
- "real action" = edit/write/notify/checkpoint/workflow or agents.{call,fork}
- overhead = avg ops before first real action ÷ avg total ops

| window                        | n  | avg total ops | avg ops_before_real | overhead | snap used |
|-------------------------------|----|---------------|---------------------|----------|-----------|
| **post-rollout** (since 13:04)| 10 | **9.30**      | **3.60**            | **39%**  | 10/10     |
| pre-rollout 48h window        | 30 | 15.43         | 8.53                | 55%      | 0/30      |

**Delta vs. Iter 2 baseline (bob=45% overhead, 19.2 ops):**
- Total ops: 19.2 → 9.30 (−52%)
- Ops before real action: 8.6 → 3.60 (−58%)
- Overhead ratio: 45% → 39% (−6pp)
- Zero-real-action heartbeats: 1/6 → 0/10

**Interpretation:** Script adoption was 100% — every single post-rollout
scheduled heartbeat ran `heartbeat-snapshot.sh`. The −5 ops/heartbeat
prediction was accurate (pre 15.4 → post 9.3 = −6.1). Real-action ops stayed
roughly constant (~5.7), meaning the savings came from the overhead side,
which was the goal. However, overhead **ratio** dropped less than expected
(55→39% vs. targeted ~25%) because total ops shrank too — the denominator
fell alongside the numerator. To hit <10% overhead, we need to reduce the
remaining ~3.6 pre-real ops, not just the total.

**Remaining pre-real ops (n=10, 3.6 avg) break down as:**
- 1 op: heartbeat-snapshot.sh (irreducible, this IS the consolidation)
- 1-2 ops: additional `ls` / `grep` context gathering (new library items,
  specific project file lookups)
- 0-1 op: occasional read of a referenced file before acting

So the overhead floor with the current heartbeat.md is ~2-3 ops. Getting
below 10% overhead on 9-op sessions requires ≤1 pre-real op, which means
**the only path to the goal is pattern #1** (skip-heartbeat-if-unchanged)
so that sessions with nothing actionable exit in 1 op instead of running
the full 3-op triage.

## Files Modified This Iter
- agents/bob/workspace/projects/test-persistent-task-experiment.md (this file)

## Previous State
Iter 4 done. Snapshot script in production for bob; pattern #3 mitigation in place.

### Iter 4 — 2026-04-18 (this iter)
**Dogfooded** the snapshot script into `agents/bob/heartbeat.md` Step 1
(KE-008 compliant: added content within existing step, did NOT restructure).

Two changes:
1. Step 1.3 combined-scan now leads with
   `bash agents/shared/scripts/heartbeat-snapshot.sh bob` before the
   experiment/deep-dive `ls` and KB git log. Single-line, runs in ~1s,
   replaces the 4-8 separate `bun -e` SQL one-liners that bob's heartbeats
   currently make.
2. Step 1.2 added an explicit anti-re-read directive (pattern #3): the
   prompt's "What You Know" + "Last Session" already summarize todo.md,
   projects/*.md, last-session.md, periodic-tasks.md — don't re-read them
   unless you need an unsummarized field.

Replaced step 1.3 (the standalone `Read todo.md` instruction) since the
prompt already summarizes todo state. Renumbered metric step from 4→4
(unchanged).

**Verified live**: `bash agents/shared/scripts/heartbeat-snapshot.sh bob`
returned all 5 sections cleanly (running sessions, recent errors, pending
requests for bob, my recent sessions, activity last hour). ~1s wall time.

**Expected impact on bob heartbeats** (baseline from Iter 2: avg 19.2 ops,
8.6 ops_before_real, 45% overhead):
- Snapshot consolidation: -3 to -5 ops per heartbeat (replaces multiple
  `bun -e` queries observed in bob's history sessions).
- Anti-re-read: -1 to -2 ops per heartbeat (eliminates the typical
  `read todo.md` + `read last-session.md` pair).
- Combined estimate: bob startup overhead 45% → ~25% within 6 heartbeats.

**Not done this iter** (deliberate scope limit, FM-2.6 avoidance):
- Did NOT touch coach/may heartbeats. Want to re-measure bob first to
  confirm the script delivers the predicted savings before proposing to
  other agents. If bob's overhead drops as predicted, that's the evidence
  to bring to coach/may.
- Did NOT design pattern #1 fix (pure-overhead heartbeat detection). That
  needs a small infrastructure change (compare current
  pending-tasks-hash to last-heartbeat hash, skip if unchanged), which is
  a separate iter.

## Files Modified This Iter
- agents/bob/heartbeat.md (Step 1 dogfooding + anti-re-read note)
- agents/bob/workspace/projects/test-persistent-task-experiment.md (this file)

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
