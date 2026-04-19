# Finding: Coach Session Efficiency — Massive Exploration Waste

**Date**: 2026-04-10  
**Scope**: 2,175 coach sessions (full history, transcripts for 15 high-op sessions)  
**Method**: Tool call extraction + classification from session transcripts + DB analysis

## Executive Summary

Coach sessions burn 60-97% of ops on file discovery and reading that produces no output. The top 15 sessions (≥25 ops) average only **24% productivity** — the rest is `ls`, `find`, `grep`, `cat` chains. Two sessions were **3% productive** (66-68 tool calls, 2 productive). The dominant waste patterns are:

1. **File discovery chains** (32.7% of all ops) — average 21 per session
2. **Gym run proliferation** — up to 26 runs in a single session, many redundant retries
3. **Read-before-understanding** — reading files that don't inform any decision
4. **Zero-op sessions** — 50.3% of all coach sessions produce 0 ops (1,095 of 2,175)

## Data

### Session Distribution (2,175 total)
| Ops | Count | % | Notes |
|-----|-------|---|-------|
| 0 | 1,095 | 50.3% | 799 "done" (avg 322s!), 239 errors, 57 interrupted |
| 1-10 | 282 | 13.0% | Quick triage/dispatch |
| 11-20 | 367 | 16.9% | Normal heartbeats |
| 21-30 | 186 | 8.6% | Moderate work |
| 31-40 | 142 | 6.5% | Heavy sessions |
| 41-50 | 49 | 2.3% | Very heavy |
| 51-60 | 35 | 1.6% | Sprint-like |
| 61+ | 19 | 0.9% | Extreme (up to 184) |

### Task Type Breakdown
| Type | Sessions | Avg Ops | Max | Done% | Err% | Total Ops |
|------|----------|---------|-----|-------|------|-----------|
| heartbeat | 1,449 | 7.6 | 129 | 67% | 23% | 11,072 |
| other | 324 | 12.7 | 184 | 85% | 7% | 4,122 |
| growth-trigger | 222 | 13.0 | 57 | 45% | **52%** | 2,876 |
| common-sense-verify | 99 | 24.1 | 116 | 77% | 5% | 2,386 |
| sprint | 77 | 27.6 | 140 | 62% | 8% | 2,129 |
| priority-task | 4 | 64.5 | 102 | 100% | 0% | 258 |

**Growth-trigger has 52% error rate** — more than half the sessions fail.

### Tool Call Patterns (top 15 sessions, 959 total calls)
| Category | Count | % | Avg/Session |
|----------|-------|---|-------------|
| **File discovery** (ls/find/grep) | 314 | 32.7% | 20.9 |
| **Read** (read tool) | 140 | 14.6% | 9.3 |
| **Gym runs** | 107 | 11.2% | 7.1 |
| **File inspect** (head/tail/wc) | 100 | 10.4% | 6.7 |
| **File read via bash** (cat) | 65 | 6.8% | 4.3 |
| **Other bash** | 49 | 5.1% | 3.3 |
| **Edit** | 45 | 4.7% | 3.0 |
| **DB query** | 29 | 3.0% | 1.9 |
| **Write** | 29 | 3.0% | 1.9 |
| **Git archaeology** | 27 | 2.8% | 1.8 |
| **Finish/checkpoint** | 25 | 2.6% | 1.7 |
| **File write via bash** | 15 | 1.6% | 1.0 |
| **Agents** | 7 | 0.7% | 0.5 |

**64% of ops are exploration** (discovery + read + inspect + cat + git + db).  
**Only 12% are productive** (write + edit + agents + finish).

### Productivity by Session
| Session | Total Ops | Productive | Exploratory | Prod% | Task |
|---------|-----------|------------|-------------|-------|------|
| s_1774343314203_19 | 70 | 39 | 30 | **56%** | Sprint execution |
| s_1775149742164_160 | 56 | 31 | 25 | **55%** | Heartbeat + gym scenario |
| s_1774431509258_165 | 67 | 24 | 43 | 36% | Sprint execution |
| s_1775366380997_100 | 70 | 26 | 41 | 37% | P0 research task |
| s_1774913996308_37 | 74 | 23 | 43 | 31% | Heartbeat |
| s_1775005736224_84 | 61 | 18 | 39 | 30% | Heartbeat |
| s_1774870794708_14 | 68 | 20 | 48 | 29% | Heartbeat |
| s_1773775927010_22 | 70 | 20 | 46 | 29% | Heartbeat |
| s_1775277916521_3 | 80 | 17 | 63 | 21% | Heartbeat |
| s_1773729514575_1 | 53 | 9 | 36 | 17% | Heartbeat |
| s_1773758245102_46 | 50 | 6 | 36 | 12% | Heartbeat |
| s_1774875973102_26 | 51 | 5 | 42 | 10% | Common-sense-verify |
| s_1773705912226_917 | 62 | 4 | 49 | 6% | Heartbeat |
| s_1773704234540_873 | 68 | 2 | 52 | **3%** | Heartbeat |
| s_1773691599757_470 | 59 | 2 | 52 | **3%** | Heartbeat |

## Waste Pattern Deep Dives

### Pattern 1: File Discovery Spirals (32.7% of ops)
Sessions start with massive `ls`/`find`/`grep` chains before doing anything. Example from s_1773704234540_873 (3% productive):
```
[3] bash: ls agents/coach/notifications/ 2>/dev/null
[7] bash: ls -lt .state/sessions/history/ | head -20  
[10] bash: for s in <6 session IDs>; do jq ... 
[11] bash: ls .state/evaluations/ | tail -15
[14] bash: find .state/sessions/history/ -name "session.json" -newer ...
[16] bash: for d in $(ls -dt .state/sessions/history/s_* | head -40); do ...
[17] bash: ls -lt .state/sessions/history/*/session.json | head -10
[18] bash: ls .state/sessions/history/s_xxxxx/ 2>/dev/null
[19] bash: for d in $(ls -dt .state/sessions/history/s_* | head -25); do ...
... 52 exploratory calls total, 2 productive (1 append + 1 finish)
```

**Root cause**: No index or summary exists. Coach must discover state from raw filesystem every time.

### Pattern 2: Gym Run Proliferation (11.2% of ops)
Sessions run 6-26 gym scenarios sequentially via bash:
- s_1774343314203_19: **26 gym runs** in one session (baselines + comparison + retries)
- s_1775366380997_100: **19 gym runs**
- s_1775149742164_160: **18 gym runs**

Many runs are retry/debugging sequences:
```
[26] bash: scripts/gym-run.sh judgment-ambiguous-spec --agent coder --timeout 8  # baseline
[27] bash: scripts/gym-run.sh judgment-ambiguous-spec --agent coder --lab combo # fork
[28] bash: scripts/gym-run.sh judgment-ambiguous-spec --agent coder --timeout 8  # 2nd baseline
[29] bash: scripts/gym-run.sh judgment-ambiguous-spec --agent coder --lab combo # 2nd fork
[30] bash: scripts/gym-run.sh judgment-ambiguous-spec --agent coder --lab ambig # solo variant
[31] bash: scripts/gym-run.sh judgment-ambiguous-spec --agent coder --lab ambig # 2nd solo
```

**Root cause**: No batch runner. No statistical framework for "run N trials with variants". Each run is a manually-invoked bash command.

### Pattern 3: Consecutive Discovery Chains
Up to **13 consecutive** discovery ops without any productive action between them:
- 64 chains of ≥3 consecutive discovery ops across 15 sessions
- Longest: 13, 10, 9, 9, 9 consecutive exploratory ops
- Average chain length: 4.6 ops

### Pattern 4: Zero-Op "Done" Sessions (799 sessions, avg 322s)
These complete "successfully" but produce 0 ops. They consume 322 seconds on average. 729 of 799 are heartbeats — likely sessions where the coach reads context, decides nothing is needed, and finishes. But 322 seconds is excessive for a "nothing to do" decision.

### Pattern 5: Growth-Trigger 52% Error Rate
222 growth-trigger sessions, 115 errors. This cron job fires frequently but fails more than half the time. Likely fires when there's nothing to trigger on, hitting edge cases.

## Concrete Opportunities

### 1. Coach State Index (saves ~15 ops/session)
**Impact**: Eliminates discovery spirals. Instead of 20 `ls`/`find`/`grep` calls to understand state, read one pre-maintained index.
- Maintain a `agents/coach/workspace/state-index.md` that summarizes: active experiments, pending gym runs, last results, current sprint status.
- Updated by the coach at end of each productive session.
- Coach heartbeat reads this first instead of spelunking the filesystem.

### 2. Gym Batch Runner (saves ~10 ops/session for gym-heavy sessions)
**Impact**: Replace 10-26 manual gym-run bash calls with a single command.
```bash
# Instead of 6 manual calls:
scripts/gym-batch.sh --scenario judgment-ambiguous-spec --variants baseline,combo,ambig --trials 2
```
This is a tool/script opportunity, not a SOUL.md fix.

### 3. Growth-Trigger Error Handling (saves 115 error sessions)
**Impact**: 52% error rate → fix the cron trigger to validate preconditions before launching.
- Check if there's actually a growth signal before starting the session.
- Add guard conditions in the cron handler or heartbeat.md.

### 4. Faster "Nothing To Do" Path (saves ~322s × 799 sessions)
**Impact**: Zero-op heartbeats should complete in <30s, not 322s.
- Heartbeat.md should have an explicit fast-exit: "If no signals, no pending tasks, no overdue items → finish immediately."
- Currently the coach reads SOUL.md, heartbeat.md, todo.md, journal.md before deciding there's nothing to do.

### 5. Read-then-Act Discipline
**Impact**: Reduce consecutive discovery chains from 13 to ≤3.
- Coach SOUL.md should mandate: "After reading 3 files, you MUST take an action (write, edit, or fork) before reading more."
- Similar to the optimizer's "Dispatcher Mode" heartbeat rewrite.

## Estimated Savings

| Opportunity | Ops Saved/Day | Cost Saved/Day | Difficulty |
|------------|---------------|----------------|------------|
| State Index | ~300 ops | ~$10 | Medium (need to build + maintain) |
| Gym Batch Runner | ~100 ops | ~$5 | Low (script only) |
| Growth-Trigger Fix | ~150 ops (error elimination) | ~$8 | Low (guard conditions) |
| Fast "Nothing To Do" | Time only (sessions are 0-op already) | ~$5 (LLM time) | Low (heartbeat.md edit) |
| Read-then-Act | ~200 ops | ~$7 | Medium (SOUL.md + enforcement) |
| **Total** | **~750 ops/day** | **~$35/day** | |

## Comparison With Other Agents

- **Bob** heartbeats: avg 4 ops (87% proper dispatch). Coach avg 7.6 but with massive tail.
- **Optimizer** heartbeats: was avg 56 ops → fixed to Dispatcher Mode (target ≤15).
- **Coach** needs same Dispatcher Mode treatment but also structural fixes (state index, batch runner).
