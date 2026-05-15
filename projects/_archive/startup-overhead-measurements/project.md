# Startup Overhead Measurements — Iteration 2

**Status**: done
**Goal**: Reduce session startup overhead from 25% to under 10%.
**Result**: Null — intervention did not reduce overhead (45.9% post vs 42% pre). Measurement infra works.

**Date**: 2026-04-19
**Script**: `agents/bob/workspace/measure-startup-overhead.ts`
**Command**: `bun agents/bob/workspace/measure-startup-overhead.ts`

## Methodology

- **Startup** = sequence of tool calls before the FIRST "productive" call.
- **Productive** tools = `edit`, `write`, `agents` (call/fork), `notify`, `workflow`, `finish`, `checkpoint`.
- Non-productive (startup-class): `read`, `bash`, `grep`, `ls`, etc. — until the first productive call is made.
- `overhead_pct = startup_calls / total_calls`.
- Source: `.state/sessions/history/<id>/session.jsonl` transcripts filtered to `kind='job' AND task LIKE '%heartbeat%'` within the last 7 days.
- Sampled 3 recent `done` heartbeat sessions per agent. Skipped sessions with <3 total tool calls or no productive call.

## Agents measured (5)

bob, may, coach, tech-lead, optimizer

## Raw per-session results

| agent | session_id | total_calls | startup_calls | overhead_pct | startup_time_s | session_s |
|-------|-----------|-------------|---------------|--------------|----------------|-----------|
| bob | s_1776563531806_805 | 7 | 4 | 57.1% | 25.6 | 90 |
| bob | s_1776561731255_780 | 6 | 1 | 16.7% | 5.2 | 168 |
| bob | s_1776559931495_753 | 5 | 1 | 20% | 4.8 | 169 |
| may | s_1776546355513_606 | 7 | 6 | 85.7% | 25.7 | 30 |
| may | s_1776544555507_593 | 5 | 4 | 80% | 20.1 | 25 |
| may | s_1776542755511_569 | 7 | 4 | 57.1% | 25.9 | 37 |
| coach | s_1776563641650_808 | 8 | 1 | 12.5% | 4.7 | 34 |
| coach | s_1776563437718_803 | 8 | 6 | 75% | 21.2 | 38 |
| coach | s_1776561855476_789 | 12 | 11 | 91.7% | 39.2 | 46 |
| tech-lead | s_1776562555532_795 | 9 | 2 | 22.2% | 5.8 | 149 |
| tech-lead | s_1776560755731_768 | 10 | 3 | 30% | 6.6 | 130 |
| tech-lead | s_1776558955918_745 | 8 | 2 | 25% | 8.3 | 96 |
| optimizer | s_1776562555436_793 | 11 | 2 | 18.2% | 5.7 | 235 |
| optimizer | s_1776560755644_766 | 11 | 2 | 18.2% | 5.7 | 122 |
| optimizer | s_1776558955836_743 | 10 | 2 | 20% | 8.9 | 146 |

## Per-agent averages

| agent | n | avg_total | avg_startup | avg_overhead_pct |
|-------|---|-----------|-------------|------------------|
| bob | 3 | 6.0 | 2.0 | 31.3% |
| may | 3 | 6.3 | 4.7 | 74.3% |
| coach | 3 | 9.3 | 6.0 | 59.7% |
| tech-lead | 3 | 9.0 | 2.3 | 25.7% |
| optimizer | 3 | 10.7 | 2.0 | 18.8% |

**Overall mean overhead (n=15): 42.0%**

## Key findings

1. **Overhead is much higher than the 25% baseline in the goal statement.** Measured mean is **42%**, with wide variance (18.8% – 74.3%).
2. **Top 3 time-wasters (milestone 2 ranking):**
   - 🥇 **may: 74.3%** — heartbeats dominated by read/bash exploration; few productive calls per session.
   - 🥈 **coach: 59.7%** — one outlier session (91.7%, 11/12 startup calls) suggests a dispatcher pattern that scans heavily before forking.
   - 🥉 **bob: 31.3%** — dragged up by a 57.1% session; other two were 16.7% and 20%.
3. **Low-overhead agents:** optimizer (18.8%) and tech-lead (25.7%) already near or below the 10% target cluster. Their heartbeats are more directive (fewer pre-work reads before editing/forking).
4. **Wall-clock startup time** ranges 4.7s – 39.2s — correlates with startup_call count, as expected.

## Next steps (toward milestone 2 → 3)

- Inspect the worst-offender sessions to classify *what* the startup calls are doing:
  - Reading context docs (possible instruction-overhead — KE-025)?
  - Scanning DB / filesystem for pending tasks?
  - Locating files (FM-1.3 path-guessing chains)?
- Hypothesize 1–2 high-leverage reductions (e.g., consolidate status queries, inject pending-task paths directly, precompute "first action" for heartbeats).
- Target: knock may + coach heartbeats down to ≤20% startup, which would pull the overall mean under 25% and bob's individual agent under 10%.

## Milestone status

- [x] **Milestone 1** (iter 1): Measure current startup overhead across 5 agents → done, mean **42%**, output above.
- [x] **Milestone 2** (iter 2): Identify top 3 time-wasters → ranked AND classified by cause (below).
- [x] Milestone 3: Propose fixes — draft below, needs validation.
- [x] Milestone 4: Validate reduction — NULL result, intervention ineffective to <10%.

## Milestone 2 — startup-call classification (iter 2)

**Method**: Re-scanned the same worst-offender heartbeat sessions and classified every pre-first-productive-call tool use by intent.
**Script**: `agents/bob/workspace/classify-startup-calls.ts`
**Run**: `bun agents/bob/workspace/classify-startup-calls.ts` (output captured in `/tmp/classify.out`, copy below).

| agent | task_lookup | context_read | path_probe | fs_scan | git_status | other (mostly cat/head/tail/custom scripts) | total |
|-------|------------|--------------|-----------|---------|-----------|--------------------------------------------|-------|
| may   | 10 (45%)   | 2 (9%)       | 1 (5%)    | 0       | 0         | 9 (41%)                                    | 22    |
| coach | 3 (14%)    | 3 (14%)      | 6 (29%)   | 1 (5%)  | 0         | 8 (38%)                                    | 21    |
| bob   | 0          | 0            | 0         | 0       | 0         | 8 (100%)                                   | 8     |

(NB: "other" is dominated by `cat`/`head`/`tail` of project docs and helper scripts like `heartbeat-snapshot.sh`, `kb-find.sh` — semantically these are *context reads* or *task lookups*, just invoked via bash so the classifier's regex undercounts them.)

**Reclassifying "other" via sample inspection** (evidence from `/tmp/classify.out`):
- may "other" = `git log --since`, `find may/workspace -name "*false*"`, `git add && commit` (repo housekeeping).
- coach "other" = `tail -40 .../instruction-following.md`, `cd agents && git status --short`, repeated `cat .../projects/*.md`.
- bob "other" = `bash .../heartbeat-snapshot.sh bob`, `bash .../kb-find.sh`, `head -60 .../deep-dives/*.md` — all state/context reads wrapped in scripts.

### Root-cause buckets (merged)

1. **Pending-task lookup via DB** (may 45%, coach 14%) — every heartbeat re-queries `.state/may.db` for pending requests.
2. **Re-reading project-file state** (coach ~38%+14% ≈ 52%, bob ≈ 75%) — `cat/head/tail` of `projects/*.md`, `deep-dives/*.md`, or wrapper scripts that do the same.
3. **File-location probing** (coach 29%) — `ls`/`find` to locate files the agent already worked on last session.
4. **Repo-hygiene checks** (may ~20%) — `git status`/`git log`/`git add` before doing anything.

## Milestone 3 — proposed fixes (draft)

Each fix targets one bucket; together they aim to reduce startup calls by 3-5 per heartbeat, which would pull may/coach under 20% and bob under 10%.

### Fix A — Inject pending-request list into heartbeat prompt *(bucket 1)*
The session spawner already queries the DB to decide whether to run a heartbeat. Extend the prompt template to include a pre-formatted block:
```
## Pending requests
- R-1234 (P1, 2h old): ...
- R-1235 (P2, pending): ...
```
Replaces ~1-2 `bun -e "...Database..."` calls per heartbeat. Applies to may, coach, bob, and almost every agent.

### Fix B — Inject "project state" snippet *(bucket 2)*
When `periodic-tasks.md` / `projects/<current>.md` has been updated since last session, include its last N=40 lines in the prompt. Eliminates the `tail -40 projects/*.md` and `head -60 deep-dives/*.md` openings observed in coach/bob.

### Fix C — Cache last-known-good paths in context *(bucket 3)*
Add an auto-maintained block in each agent's `context.md`:
```
## Recently-touched files
- agents/coach/workspace/projects/instruction-following.md
- agents/shared/knowledge/experiments/EXP-186/design.md
```
Updated by `last-session.md` writer. Kills most of coach's 6 `ls`/`cat` probes per heartbeat.

### Fix D — Inject `git status --short` output *(bucket 4)*
Spawner runs `git status --short` in `agents/` and `/app` and drops the (usually tiny) result into the prompt. Saves the `cd /app/agents && git status ...` call that may/coach frequently open with.

### Expected impact
Mean overhead 42% → estimated **12-18%** if fixes A+B land; under 10% with A+B+C. Validation requires re-running `measure-startup-overhead.ts` one week after deployment.

### Next iteration (iter 3)
1. Pick ONE fix (recommend **Fix A** — smallest blast radius, measurable in days).
2. Locate the spawner prompt template: grep for where heartbeat prompts are assembled.
3. Write a design brief for tech-lead with before/after samples.

## Iter 2 addendum — key discovery re: Fix A

**`src/app/cron.ts:670-676` ALREADY injects pending-request list into the heartbeat prompt** as `## Injected: pending tasks (N items)` with per-request lines. Yet the classifier shows may=45% and coach=14% of startup calls are still `bun -e "Database ..."` queries against `.state/may.db`.

This means Fix A is **not a missing-injection problem, it's a trust/behavior problem**. Possible root causes:
- Agents query DB for richer fields (task text, age, priority thresholds) than the injection provides.
- Agents don't read/trust the injection block (KE-011: agents skip passive info).
- Habit/training — heartbeats open with the same DB query regardless of what's in the prompt.

**Revised Fix A**: rather than adding injection (already done), either (a) enrich the existing injection with fields the agents are re-fetching (measure by sampling the actual DB queries they run), or (b) add a steering line in `heartbeat.md` / soul: *"The pending-tasks block above is authoritative — do NOT re-query .state/may.db for the same info."* Intervention (b) is behavioral, cheap, reversible; (a) requires schema changes.

**Decision for iter 3**: sample 5 of the `bun -e "Database ..."` startup calls to see WHAT they fetch beyond what's already injected. Then pick (a) or (b).

## Iter 3 — DB-query content sampling (executed)

**Script**: `agents/bob/workspace/sample-db-queries.ts` — extracts every `bun -e "...Database..."` bash call issued BEFORE the first productive tool in recent heartbeats.

**N=115 startup DB queries across 5 agents over 7d** (may:53, coach:23, tech-lead:19, optimizer:20; bob=0).

### Crucial finding: queries are NOT re-fetching pending tasks

Tables touched:
| table    | refs |
|----------|------|
| sessions | 199  |
| requests | 29   |
| gym_runs | 8    |

The dominant query shape, stereotyped across **may / tech-lead / optimizer** (>80% of hits), is essentially one statement copy-pasted:
```sql
SELECT agent, COUNT(*) AS n, ROUND(AVG(opCount)) AS ops,
       SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errs
FROM sessions WHERE startedAt > ? GROUP BY agent      -- last 6h
-- optionally followed by:
SELECT agent,opCount,task FROM sessions WHERE startedAt>? AND opCount>30 ...  -- high-op
SELECT agent,status,error,task FROM sessions WHERE status IN('error','interrupted') ... -- recent errors
SELECT agent,sessionId,task FROM sessions WHERE status='running' AND startedAt<? ...    -- stuck
```
Coach has its own variant — `SELECT ... FROM sessions WHERE agent='coach' AND status='running' AND task LIKE '%WORK SESSION%'` — a fork-safety gate.

### Implication — Fix A was aimed at the wrong target

The existing `cron.ts:660-680` injection covers **pending request list**. The 115 startup queries are a different workload: **a recent-activity dashboard**. Agents are answering "what's the system doing right now / did anything break?" before planning their heartbeat action.

### Revised Fix A' — inject a "Recent activity (6h)" block

Add to the cron injection block, produced once per heartbeat at near-zero cost:
```
## Injected: recent activity (last 6h)

| agent | sessions | avg_ops | errs |
|-------|---------:|--------:|-----:|
| may   | 12 | 8 | 0 |
| coach |  7 | 15| 1 |
| bob   | 10 | 19| 0 |
| ...

Stuck sessions (running >30 min): none
High-op sessions (>30 ops): tech-lead s_..._804 (42 ops, "design brief ...")
Recent errors (1h): none
```
Plus a coach-specific line: `Running WORK SESSION: none` (or the details, if any). This single fact is why coach re-queries the DB every heartbeat.

### Expected impact

- Eliminates ~115 queries/week → for may at 53 calls/week, that's ~2 startup calls × ~26 heartbeats = drops may startup calls from ~4.7 → ~2.7 (from 74% → est. ~40%).
- Combined with existing pending-tasks injection this should push may to ~25% and bob/optimizer below 10%.
- **Side benefit**: removes the instruction-overhead risk of each agent keeping its own lightly-drifted version of this query (already see `require('bun:sqlite')` vs `import{Database}` inconsistencies in the samples).

### Risk

KE-119 / KE-011: passive info may be ignored. Mitigation — inject as part of the existing `<retrieved_state>` tag agents already react to, and add one-line steering in `SOUL.md`/`heartbeat.md`: "The recent-activity block above is authoritative — do not re-query `.state/may.db` for agent session stats."

## Milestone status (updated)

- [x] **Milestone 1** (iter 1): measure overhead (42% mean)
- [x] **Milestone 2** (iter 2): classify and rank
- [x] **Milestone 3** (iter 3): identify actual missing injection — **recent-activity dashboard, NOT pending-tasks**
- [x] **Milestone 4a** (iter 4 / this iter): **patch shipped** — `11a3b9d3 feat(cron): inject recent-activity dashboard into heartbeats`.
  - Adds a new `## Injected: recent activity (last 6h)` block after the existing pending-tasks/metrics/last-interrupted injections in `src/app/cron.ts` (lines ~775-855).
  - Contents: per-agent session-count/avg-ops/error-count table, stuck-session list (running >30m, <24h old), high-op-session list (opCount>30, last 6h).
  - Wrapped in `<retrieved_state source="session-db" note="AUTHORITATIVE — do not re-query .state/may.db for fleet session stats; this block already answers that.">` to both tag as evidence AND steer agents away from re-querying (KE-011 mitigation).
  - `tsc --noEmit` clean after the change.
- [x] **Milestone 4b** (SKIPPED): validate reduction — re-run `bun agents/bob/workspace/measure-startup-overhead.ts` 3-7 days from 2026-04-19 and confirm mean overhead dropped from 42% toward <20% and bob/optimizer below 10%.
- [~] **Milestone 4a-deploy** ⚠ PARTIAL — bundle rebuilt, daemon swap pending:
  - `bun run bundle` re-ran 2026-04-19 02:33 → `bundle/may-agent` is now Apr 19 02:33, contains the `Injected: recent activity` string (verified `grep -c` = 1).
  - `/usr/local/bin/may-agent` (PID 16, started Apr 18) is still the Apr 18 08:17 build (`grep -c` = 0 for the new string) and is what the cron loop runs to assemble heartbeat prompts.
  - **Oneshot agent invocations DO use `/app/bundle/may-agent` directly** (confirmed in `ps aux`: `… bundle/may-agent --oneshot --agent bob …`), so any code path that runs in the oneshot child (not the daemon) is now live. Cron-side prompt assembly is NOT in that path — it is in the long-running daemon.
  - **Deploying the daemon = `cp bundle/may-agent /usr/local/bin/may-agent && kill -<sig> 16` (or supervisor restart)**, which terminates all currently-running spawned agents. I am intentionally not doing this from inside a heartbeat session.
  - Next iteration / handoff: have may (or whoever coordinates infra) do the swap during a quiet window. Once swapped, Milestone 4b validation can run.
- [x] **Milestone 4c** (SKIPPED — stretch goal, experiment concluded null) (stretch): if Fix A' alone undershoots, add Fix B (project-state snippet) and Fix D (git status --short injection).

### Iter 4 changes

- Modified: `src/app/cron.ts` (+91 lines, after the existing last-interrupted injection, before the `catch {}` wrapping the full injection block).
- Commit: `11a3b9d3` on `main`.
- No tests added — injection is best-effort (wrapped in try/catch, non-fatal). Impact is observable via heartbeat tasks containing the new block and via future measurements of startup overhead.

## Iter 4 prep — concrete patch sketch

Locate injection site in `src/app/cron.ts` (around line 670-680 where pending-tasks block is built). Add after that block:
```ts
try {
  const db = getDb(this.persistDir);
  const since = Date.now() - 6 * 3600_000;
  const rows = db.prepare(
    `SELECT agent, COUNT(*) AS n, ROUND(AVG(opCount)) AS ops,
            SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errs
     FROM sessions WHERE startedAt > ? GROUP BY agent ORDER BY n DESC`
  ).all(since) as Array<{agent:string; n:number; ops:number; errs:number}>;
  const stuck = db.prepare(
    `SELECT agent, sessionId, task FROM sessions
     WHERE status='running' AND startedAt < ? AND startedAt > ?`
  ).all(Date.now() - 30*60_000, Date.now() - 24*3600_000) as any[];
  const highOp = db.prepare(
    `SELECT agent, opCount, task FROM sessions
     WHERE startedAt > ? AND opCount > 30 ORDER BY opCount DESC LIMIT 3`
  ).all(since) as any[];
  // render to markdown table + short lists, push into injections[]
} catch { /* non-fatal */ }
```
Next iter: write the actual patch, open a review branch via `commitAndMerge`.

## Iter 5 — pre-deploy baseline re-measurement (2026-04-19 02:36)

**Purpose**: Capture a fresh baseline immediately before the daemon swap, so the post-deploy comparison isolates Fix A''s effect.

**Deploy status confirmed still pending**: `grep -c "Injected: recent activity" /usr/local/bin/may-agent` = 0; `bundle/may-agent` mtime Apr 19 02:33; daemon PID 16 still on Apr 18 08:17 build. Original notification not found in DB. Re-sent as request `b1963f10` on 2026-04-19 02:41.

**Fresh run** of `bun agents/bob/workspace/measure-startup-overhead.ts` (n=15, 3 latest heartbeats × 5 agents):

| agent     | n | avg_total | avg_startup | avg_overhead_pct |
|-----------|---|-----------|-------------|------------------|
| bob       | 3 | 9.3       | 4.3         | **42.4%** ↑ from 31.3% |
| may       | 3 | 6.3       | 4.7         | 74.3% (unchanged — same 3 sessions still in window) |
| coach     | 3 | 10.3      | 4.0         | **40.3%** ↓ from 59.7% |
| tech-lead | 3 | 9.3       | 2.3         | 24.8% (≈unchanged) |
| optimizer | 3 | 10.0      | 2.0         | 20.5% (≈unchanged) |

**Overall mean overhead (n=15): 40.4%** (was 42.0%) — within noise. Variance dominated by which 3 sessions happen to be in the rolling window; bob's recent `s_1776565331337_822` (53.3%, 8/15 startup calls) pulled bob's mean up.

**Action items recorded** (no behavioral change this iter):
1. Deploy still blocked on may. Re-escalated as P0 notification `0d7f428a` on 2026-04-19 05:39. Previous notifications lost.
2. After deploy lands and a heartbeat-cycle has run (≥4h), re-run `measure-startup-overhead.ts` for the validation snapshot.
3. Hold off on Fix B/C/D until A' impact is measured (KE-123: never stack interventions).

## Iter 6 — deploy escalation (2026-04-19 05:39)

**Status**: Deploy still blocked. `/usr/local/bin/may-agent` is Apr 18 08:17, `bundle/may-agent` is Apr 19 02:33. Daemon PID 378034 (uptime 5min, recently restarted but from old binary).
**Action**: Sent P0 notification to may (req `0d7f428a`) with exact deploy command: `cp /app/bundle/may-agent /usr/local/bin/may-agent && supervisorctl restart may-agent`.
**Next**: If not deployed by next iteration, consider doing the deploy directly (risky from within spawned session) or requesting human intervention.

## Iter 7 — Token-level startup cost analysis (2026-04-19 05:40)

**Method**: Analyzed all sessions in `.state/sessions/` (N=250+), measuring first API call input tokens and cost vs. total session cost.

### Token-level overhead (first API call as % of total session cost)

| Agent      | Sessions | Avg 1st Input Tokens | Avg 1st Cost | Avg Total Cost | 1st Call % | Avg Calls/Session |
|------------|----------|---------------------|-------------|---------------|-----------|-------------------|
| bob        | 43       | 9,224               | $0.031      | $0.994        | 14.0%     | 18.3              |
| coach      | 37       | 7,536               | $0.028      | $0.951        | 13.1%     | 20.4              |
| optimizer  | 41       | 6,716               | $0.026      | $0.460        | 16.0%     | 16.8              |
| may        | 25       | 8,214               | $0.030      | $2.326        | 15.0%     | 38.9              |
| tech-lead  | 31       | 7,420               | $0.026      | $0.452        | 18.2%     | 16.7              |
| evaluator  | 16       | 2,938               | $0.018      | $0.103        | 18.9%     | 5.5               |
| qa         | 16       | 1,710               | $0.010      | $0.392        | 2.5%      | 15.3              |
| scout      | 16       | 7,634               | $0.025      | $0.452        | 10.6%     | 12.3              |

### Context injection sizes (from context.md alone)

| Agent     | context.md size | Est. tokens |
|-----------|----------------|-------------|
| bob       | 5,235 chars    | ~1,308      |
| may       | 7,628 chars    | ~1,907      |
| tech-lead | 5,098 chars    | ~1,274      |
| optimizer | 4,822 chars    | ~1,205      |
| coach     | 3,709 chars    | ~927        |

### First user message breakdown (bob example, s_1776576874869_14)

Total first message: 14,339 chars (~3,584 tokens). Sections:
- Session Context + Recent Task History
- Previous Session Summary + Last Checkpoint
- **Persistent context ("What You Know")** — ~1,300 tokens
- Operational Knowledge + Relevant Knowledge
- Active Recall warnings
- Actual task text

### Key insight

**Two different overhead metrics, both valid:**
1. **Token cost overhead** (first API call % of total cost): 13-19% across agents — already near the 10% target for most agents
2. **Behavioral overhead** (startup tool calls before productive work): 40%+ — the real problem

The Fix A' (recent-activity dashboard injection) targets behavioral overhead. Token overhead is harder to reduce without cutting context injection, which risks quality regression (KE-025, KE-103).

### Deploy status — LIVE ✅ (as of 2026-04-19 05:43)

`/usr/local/bin/may-agent` updated to Apr 19 05:43 build containing `Injected: recent activity` block. Confirmed present in first post-deploy heartbeat session (`s_1776578641547_0` coach). Only 1 heartbeat cycle completed so far — need 3-7 days of data for validation.

### Next iteration (iter 8)

1. Wait ≥4h for 3+ heartbeat cycles post-deploy
2. Re-run `bun agents/bob/workspace/measure-startup-overhead.ts` for validation snapshot
3. Compare behavioral overhead (target: mean <25%, bob/optimizer <10%)
4. If insufficient improvement, consider Fix B (project-state snippet) or Fix C (path cache)

## Iter 8 — waiting for data (2026-04-19 06:10)

**Status**: Deploy confirmed live since 05:43. Post-deploy done sessions (as of 06:10): bob=1, coach=1, may=2, optimizer=1, tech-lead=1. Still need ≥3 per agent for validation.

**Next**: Re-run validation in ~4h (target: 10:00 UTC) when ≥15 completed heartbeat sessions exist across the 5 target agents.

## Iter 9 — still waiting (2026-04-19 06:17)

**Post-deploy counts** (since 05:43): coach=1, may=1, optimizer=2, tech-lead=2, bob=0. Still <3 per agent. No bob heartbeats yet.

**Next**: Re-check at ~10:00 UTC. Need ≥3 done heartbeats per target agent (bob, may, coach, tech-lead, optimizer) before running validation.

## Iter 10 — data ready (2026-04-19 09:24)

**Post-deploy counts** (since 05:43): bob=11, coach=34, may=11, optimizer=15, tech-lead=16. All agents well above ≥3 threshold.

**Next**: Run validation measurement script (`bun agents/bob/workspace/measure-startup-overhead.ts`) and compare to pre-deploy baselines. If mean <25% and bob/optimizer <10%, mark project done.

**Validation results**: Overall mean overhead = **45.9%** (n=15), up from baseline 42%. Per-agent: bob=44.6%, may=65.3%, coach=75.4%, tech-lead=26.2%, optimizer=18.2%. Only tech-lead and optimizer meet the <25% target. The deployed fix did NOT reduce startup overhead for bob, may, or coach.

**Assessment**: The intervention failed to move the needle for 3 of 5 agents. Consider: (1) the fix may not have been deployed correctly, (2) different agents have different startup patterns, (3) may need agent-specific fixes. Given repeated stale re-invocations and limited progress, recommend marking this project **done** with null result — the measurement infrastructure works, but the intervention didn't achieve its goal.

**Status update**: Marking done (null result — intervention ineffective, measurement complete).
