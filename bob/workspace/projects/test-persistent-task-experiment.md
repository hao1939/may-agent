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
- [x] Re-measure bob after 6+ heartbeat sessions to confirm impact
      (Iter 6: 45% → 33% overhead, avg total 19.2 → 11.0, snapshot adopted 4/6)
- [x] Propose snapshot script to coach + may heartbeats (Iter 7 —
      brief sent: agents/bob/workspace/sent/2026-04-18-heartbeat-snapshot-proposal.md,
      notifications sent to may + coach 2026-04-18)
- [x] ~~Design fix for pattern #1 (pure-overhead heartbeats)~~ —
      **superseded** by existing `agents/shared/may-agent-docs/design/idle-heartbeat-playbook.md`
      (Hao 2026-04-17: idle heartbeats are an exploration budget, not
      overhead. Don't add fast-exit gates; replace exit with prioritized
      autonomous work.) Iter 5 reconciliation.
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
Iter 8 done (2026-04-18 17:45 UTC). Re-measurement of coach + may after
proposal brief: **0/6 adoption each**. Coach overhead 48% → 71% (n=6,
tot=9.8, pre=7.0); worst-case tail collapsed (no more 65-op sessions) but
pre-real ops didn't improve. May overhead still 100% (6/6 zero-action
heartbeats, tot=9.5, all ops are overhead). Proposal appears to not have
landed; see Iter 8 log below for the nuance and next-step options.

### Iter 8 — 2026-04-18 (this iter)
**Goal:** Close-the-loop re-measure of coach and may after Iter 7's
proposal brief + notifications. Same method as Iter 2/6.

**Results (6 most-recent heartbeats per agent, started within the last
~2.5h):**

| agent | avg tot | avg pre | zero-real | snap adopt | overhead |
|-------|---------|---------|-----------|------------|----------|
| coach | 9.8     | 7.0     | 4/6       | 0/6        | **71%**  |
| may   | 9.5     | 9.5     | 6/6       | 0/6        | **100%** |

**Compare to Iter 2 baseline:**
- coach: 24.3 → 9.8 total (the 65-op tail is gone), but overhead ratio
  went *up* (48% → 71%). Shorter sessions, same absolute overhead ~7 ops,
  so the ratio worsens as totals shrink. Not a regression — a
  denominator artifact.
- may: 13.2 → 9.5 total; overhead ratio already at the ceiling (100%),
  unchanged. All 6 sessions exited with zero real action.

**Adoption: 0/6 for both.** Neither agent called
`heartbeat-snapshot.sh` in its 6 most-recent heartbeats. Either (a) the
proposal brief hasn't been read, (b) was read and declined implicitly,
or (c) is queued behind other work. No explicit reply observed.

**Reframing — the data says the script isn't the bottleneck for
coach/may:**
- coach's pre-real average is 7.0 ops, spread across ~4 zero-action
  exits. Those are pattern-#1 (pure-overhead heartbeats), which the
  project explicitly retired (Iter 5) per Hao's
  idle-heartbeat-playbook directive. Asking coach to adopt the snapshot
  doesn't change this — the overhead *is* the exploration budget.
- may is the same story, harder: 6/6 zero-real, avg 9.5 read/bash ops
  looking for something to do. This is exactly the "exploration, not
  overhead" regime the playbook describes.

**Implication for the <10% goal:** the original 25% baseline and <10%
target were computed before the idle-heartbeat reframe. Under the
reframed definition (overhead = ops *when there is real work to do*,
excluding exploration heartbeats), the relevant numerator is bob's
Iter 6 snapshot-using sessions: pre-real = 2.5 ops, total ~9, overhead
~28%. Still above 10%, but the gap is tractable. **Proposing a formal
redefinition of the goal metric as "startup overhead on
action-producing heartbeats only" (exclude zero-real sessions) is the
honest next step** — the current metric conflates two different
regimes and makes may look like a 100% regression that isn't.

**Recommendation (not actioned this iter, avoiding scope creep):**
1. Write this redefinition up as a short note and send to the same
   audience (may + coach + tech-lead). This is an iter-9 deliverable,
   not an iter-8 one.
2. Alternatively, declare the project **done** at its current state —
   bob went from 45% → 33%, a script was built and proven, and the
   remaining gap is a metric-definition question rather than an
   engineering one. The original milestones are all `[x]`; further
   measurement is observation, not goal progress.

**Not done this iter** (deliberate):
- Did not send redefinition note; will evaluate whether to do so next
  iter or declare project complete.
- Did not attempt to force coach/may adoption — the proposal brief
  stands; it's their call per Iter 7's explicit non-ask.

## Files Modified This Iter
- agents/bob/workspace/projects/test-persistent-task-experiment.md (this file)

### Iter 7 — 2026-04-18 (this iter)
**Goal:** Close the last open milestone — formally propose the snapshot
script to coach + may with bob's Iter 6 measurement evidence in hand.

**Deliverables:**
- `agents/bob/workspace/sent/2026-04-18-heartbeat-snapshot-proposal.md`
  — proposal brief. TL;DR is bob's 19.2 → 11.0 avg ops, 45% → 33%
  overhead, 4/6 adoption. Per-agent ask:
  - coach: replace Step 1.4 `bun -e` + Step 3 running-session guard with
    one snapshot call up front (~3-5 ops saved/heartbeat).
  - may: replace the existing inline `bun -e` snapshot block with the
    shared script (same 1 op, adds pending-requests + my-recent-sessions,
    consistent format across agents).
- Notifications sent to may + coach pointing at the brief.

**Explicit non-asks** (in the brief, KE-008 compliant):
- Not asking for structural heartbeat reorders.
- Not asking for immediate adoption — it's a proposal with evidence,
  not a mandate.
- Not extending to optimizer/tech-lead (lower overhead, lower ROI).

**What would close the project:** coach or may adopts, then a re-measure
confirms (or refutes) a similar drop. If they decline, that's also a
valid endpoint — the project's value was the measurement + script, not
forced compliance.

## Files Modified This Iter
- agents/bob/workspace/sent/2026-04-18-heartbeat-snapshot-proposal.md (NEW)
- agents/bob/workspace/projects/test-persistent-task-experiment.md (this file)

## Current State (Iter 6)

### Iter 6 — 2026-04-18 (this iter)
**Goal:** Re-measure bob after the Iter 4 heartbeat change has had ~4h of wall
clock to accumulate post-dogfood heartbeats (previous iter blocked on clock).

**Method:** Same as Iter 2/5 — 6 most-recent `bob` heartbeat sessions from
`.state/may.db`, parse `session.jsonl`, count tool calls, mark first non
`read/bash/finish/agents.{list,context,requests}` as "first real".
(Measurement script fixed this iter: content blocks use `type:"toolCall"`
nested in the user message, not top-level `type:"tool_call"`. Iter 5's numbers
were parsed from the correct structure; Iter 6 re-uses the corrected parser.)

**Results (6 most-recent heartbeats, all started 15:22-17:22 UTC):**

| metric                       | Iter 2 baseline | Iter 5 | **Iter 6** |
|------------------------------|-----------------|--------|------------|
| avg total ops                | 19.2            | 19.5   | **11.0**   |
| avg ops_before_first_real    | 8.6             | 9.4    | **3.7**    |
| sessions with 0 real actions | 1/6             | 1/6    | **0/6**    |
| overhead ratio               | 45%             | 48%    | **33%**    |
| snapshot-script adoption     | 0/6             | 0/6    | **4/6**    |

**Per-session detail:**
```
s_1776532931430_441 17:22 tot=8  pre=2 real=true snap=true
s_1776531172390_414 16:52 tot=11 pre=8 real=true snap=false  ← outlier
s_1776531131353_413 16:52 tot=9  pre=3 real=true snap=true
s_1776529330437_390 16:22 tot=10 pre=2 real=true snap=true
s_1776527529969_362 15:52 tot=10 pre=3 real=true snap=true
s_1776525755822_332 15:22 tot=18 pre=4 real=true snap=false  ← outlier
```

**Signal:** the 4 snapshot-using sessions average pre-real = 2.5 ops (vs 6.0
for the 2 non-users). Script is doing what was predicted.

**Delta vs prediction:** Iter 4 predicted "45% → ~25% within 6 heartbeats".
Actual 33% is short of 25% but a **12pp drop** in one rollout is the biggest
per-iter movement on this project. Remaining overhead is in the 2 sessions
that didn't call the snapshot script — 33% of sessions skipping the optimized
path. That's a compliance problem, not a script-efficacy problem.

**Goal status:** target is <10% overhead. Currently 33%. Remaining gap is
~23pp. Likely paths:
1. Push snapshot-script compliance from 67% to ~100% (likely -5pp).
2. Extend the snapshot script to inline the top 2-3 unsummarized fields
   that agents still `read` (e.g. last-session journal body, top pending
   request content) so the agent doesn't need a follow-up read. (-3 to
   -5pp, estimate)
3. Roll out to coach + may, where overhead is higher (48%, >100%). Doesn't
   lower bob's number but makes the system-wide target meaningful.

**Not done this iter** (scope limit):
- Did not touch coach/may heartbeats yet. Now that bob has 4/6 adoption
  and a measured drop, the evidence to bring them is in hand — that's
  the Iter 7 deliverable.
- Did not investigate why 2 of 6 bob sessions skipped the script. Could
  be pre-change task templates, or agent choosing to bypass — needs a
  quick look at those two `session.jsonl`s. Iter 7 candidate.

## Files Modified This Iter
- agents/bob/workspace/projects/test-persistent-task-experiment.md (this file)

### Iter 5 — 2026-04-18 (this iter)
**Goal:** Check whether Iter 4's bob heartbeat changes have moved the metric
yet, and clear the stale pattern-#1 milestone.

**Re-measure bob (6 most-recent heartbeats, same method as Iter 2):**

| metric                       | Iter 2 baseline | Iter 5 |
|------------------------------|-----------------|--------|
| avg total ops                | 19.2            | 19.5   |
| avg ops_before_first_real    | 8.6             | 9.4    |
| sessions with 0 real actions | 1/6             | 1/6    |

**No movement, as expected.** Iter 4's heartbeat.md edit landed at 13:37
UTC; the most-recent bob heartbeat in this window started at 13:22 UTC
(s_1776518529764_224). **0 of the 6 measured sessions ran the new
Step 1.** Re-measure is premature; needs ~3h of wall clock to accumulate 6
post-change heartbeats. Re-check after 17:00 UTC today.

**Pattern #1 milestone retired.** While re-reading the project I found
that `agents/shared/may-agent-docs/design/idle-heartbeat-playbook.md`
(bob, 2026-04-17, draft awaiting tech-lead+may review) already addresses
pattern #1 — and **explicitly rejects** the fast-exit-gate fix this
project's milestone implies. Per Hao 2026-04-17: *"heartbeats is by
design for agent to explore and try. It's OK to waste tokens as long as
it provides chance for agent to be autonomous."* "Pure-overhead
heartbeat" is a misframing — what looks like overhead is the agent's
exploration budget. The correct fix is not to gate idle heartbeats but to
replace `nothing-to-do → finish` with `nothing-assigned → pick one
exploration item`. Adding a separate design here would duplicate that
work and risk reintroducing the killed gate.

Action: marked the milestone `[x]` with a pointer to the playbook.
Project's pattern-#1 work is now "land idle-heartbeat-playbook.md
review" rather than "design new fix" — that's a may/tech-lead concern,
not an additional bob deliverable.

**Bonus observation (worth flagging, not acting on this iter):** in the
6 measured sessions, the only zero-real session
(s_1776516746914_185) ended with **3 separate finish() calls** —
finish() was being rejected and retried. That matches FM-3.3 (dirty-repo
guard) from active-recall. Not chasing it here, but if the pattern
recurs after Iter 4 lands, it's worth a small KE on "finish-loop as a
zero-real-action signal."

## Files Modified This Iter
- agents/bob/workspace/projects/test-persistent-task-experiment.md (this file)

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
