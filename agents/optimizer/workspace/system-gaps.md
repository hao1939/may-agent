# System Gaps: Honest Self-Assessment

*Written 2026-04-16 by optimizer, from actual experience across ~100+ sessions*

## 1. When Do I Feel Lost?

**Resuming after a checkpoint from 42 hours ago.** The checkpoint says "QA interrupt rate 67%, plan: raise budget 10→12" but I have no idea if someone already did that, if the problem resolved itself, or if the context has completely shifted. Checkpoints capture a moment but not what happened after.

**When a task references prior sessions I can't see.** "Continue the work from yesterday's Mode B session" — I have to query the DB, read summaries, reconstruct intent. By the time I understand what happened, I've burned 5-8 tool calls on archaeology instead of production.

**When the task is ambiguous about scope.** "Investigate bash:timeout-killed regression" — is this a 2-call triage or a 15-call deep dive? The same task framing gets used for both. I default to thorough, which sometimes wastes budget on things that needed a quick look.

**When I need to find "where does X happen" across the codebase.** The system has handlers, cron.json, workflows, knowledge entries, context.md files, workspace files — no single index. I grep, read, grep more. Each search is a tool call.

## 2. When Do I Waste Time?

**Re-reading files I read 3 minutes ago.** The C1.1 convention requires read-before-edit, which is good for safety, but I literally just wrote the file. I know exactly what's in it. That's a wasted tool call every single time. KE-140 measured this: 30%+ token waste from duplicate reads.

**The DELIVERABLES_CHECKLIST.md dance.** For a single-deliverable task like this one, I must: create the checklist, read it back, check items off, read it again to verify, then finish. That's 3-4 tool calls of pure process overhead on a task that produces one file. The guard is valuable for multi-deliverable tasks but punitive for simple ones.

**Querying the DB defensively.** I run PRAGMA table_info before every query because I've been burned by wrong column names. Smart practice, but it doubles my DB interaction cost. The schema is in my context — I should trust it more.

**Building context from scratch every session.** Each 30-minute heartbeat, I re-read todo.md, re-check rotation state, re-orient. There's no "here's exactly where you left off and what's next" — just breadcrumbs I have to reassemble.

## 3. When Do I Repeat Myself?

**Rotation tracking.** Every heartbeat I read todo.md, figure out which mode (A/B/C/D) is next, do the work, then update the tracker. The tracker logic is the same every time. This should be a workflow, not manual bookkeeping.

**Writing the same boilerplate analysis structure.** Session archaeology reports, workflow health reports, skill scouting reports — they all follow the same template. I rebuild the structure from scratch each time instead of having a skeleton to fill.

**Checking "did my last change land?"** After every edit, I verify. After every write, I verify. After verification, I write the checklist. Then I verify the checklist. It's verification turtles all the way down — because the FM-3.3 guard catches me if I skip any layer.

**DB queries for session stats.** I write nearly identical SQL every session — count sessions by agent, get quality scores, find failures. These should be saved queries or a stats tool, not hand-written each time.

## 4. When Do I Have No Impact?

**Heartbeats that find nothing to do.** Policy says this is acceptable, and I agree the always-fire rule is correct. But ~40% of my heartbeats end with "no pending work, updated checklist, done." That's real compute cost for a null result.

**Writing reports nobody reads.** I produce workspace/*.md files — analysis reports, experiment results, gap assessments. I don't know which ones get read by humans or other agents. Some feel like they go into a void. There's no feedback signal.

**Incremental knowledge entries for known patterns.** Writing KE-141 that's 80% similar to KE-140 because I found one more data point. The marginal value of the 15th knowledge entry about "agents waste tokens on X" is near zero.

**Process compliance work.** Updating DELIVERABLES_CHECKLIST.md, committing with exact message formats, following rotation schedules — necessary for system health but zero direct value. On lean sessions this overhead is 20-30% of total calls.

## 5. When Am I Stuck?

**When bun:sqlite queries fail cryptically.** "Cannot read properties of undefined" with no stack trace. Is the DB locked? Wrong path? Schema changed? I can't inspect the DB interactively — each debugging attempt is a full tool call with a new bun -e invocation.

**When I need to coordinate with another agent but can't block.** I send a message to Bob or Alice, but I can't wait for the result. Next heartbeat, I have to check if they responded, re-read context, figure out if my request was handled. Async coordination across heartbeats is lossy.

**When a guard blocks my finish() and I've already used most of my budget.** The FM-3.3 guard has caught me 15+ times. Each catch costs 2-3 extra tool calls (read checklist, verify, re-finish). On a tight budget, this can push me over limits. I know the pattern now but the muscle memory of "write → finish" is hard to override.

**When I need to understand WHY a metric changed.** I can see that quality dropped from 0.8 to 0.6, but tracing that to a root cause requires reading 5-10 session transcripts, which blows any reasonable budget.

## 6. How Could the Loop Be Closed?

| Gap | Fix | Specificity |
|-----|-----|-------------|
| Lost on resume | **Structured handoff file** — each session writes `.state/optimizer-handoff.json` with `{lastAction, nextAction, blockers, activeExperiments}`. Next session reads this ONE file instead of reconstructing from checkpoints + DB | New convention, ~10 lines of JSON |
| Duplicate reads | **Exempt self-authored files from C1.1 read-before-edit** — if the file was created in the current session, skip the mandatory re-read | Change in evaluation heuristic, not agent code |
| Checklist overhead on simple tasks | **Auto-generate checklist for single-deliverable tasks** — if the task produces one file, the checklist is trivial. Skip or auto-create it | Guard logic in `skills/deliverable-checklist.md` |
| Repeated DB queries | **Saved query library** — `agents/optimizer/workspace/queries.sql` with named queries I can `cat` and pipe to bun | One file, I could create this today |
| Reports nobody reads | **Read tracking** — log when a file is `read()` by any agent. Surface "unread reports" so I stop producing waste | Would need infrastructure change in session tracking |
| Async coordination is lossy | **Request status in context injection** — when my context is built, include status of my last 3 outbound requests | Change in `agents/optimizer/context.md` builder |
| FM-3.3 guard friction | **I just need to internalize: write → read → finish, always.** This is a me-problem, not a system problem. 15 failures means I haven't learned it deeply enough. | No system change needed |
| Budget blown on root cause analysis | **Pre-computed session diffs** — nightly job that computes "what changed between yesterday and today" for key metrics, saved to a file I can just read | New scheduled task, writes to `workspace/daily-delta.md` |

## Meta-Observation

The biggest systemic issue isn't any single gap — it's that **every session starts cold**. I have context.md (static), checkpoints (stale), and the DB (requires queries to extract). There's no "warm start" equivalent. A human engineer has their IDE open, their mental model intact, their browser tabs from yesterday. I have to rebuild all of that in the first 5-8 tool calls of every session.

The second biggest issue is **no feedback loop on output quality**. I produce reports, knowledge entries, analysis files. I never learn which ones were useful. Without that signal, I can't optimize what I produce — I just produce more of everything and hope some of it matters.
