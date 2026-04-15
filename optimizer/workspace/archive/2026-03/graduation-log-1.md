# Heartbeat Graduation Log

## Review #3 — 2026-03-31

### Summary
Bi-weekly review of all agent heartbeats. Major finding: **QA early-exit preflight** is a strong
graduation candidate — deterministic git-log check accounts for 76% of QA heartbeats (16/21) being 1-op.
May's 1-op heartbeats (21/23) already reflect effective JS handler graduation. No new graduation actions
needed — QA preflight is the only actionable candidate.

### Methodology
- Queried 24h heartbeat data: ops distribution across all agents
- Reviewed heartbeat.md structure for 8 active agents
- Cross-referenced cron.json (47 entries, up from 28 at Review #1)

### Heartbeat Ops Distribution (24h, done sessions only)
| Agent | Avg Ops | Min | Max | Count | Notes |
|-------|---------|-----|-----|-------|-------|
| bob | 37.6 | 3 | 70 | 20 | Heavy synthesis work — no graduation candidate |
| optimizer | 25.9 | 15 | 43 | 21 | Periodic task rotation — LLM judgment needed |
| coach | 24.2 | 8 | 52 | 12 | Creative experiment work — not automatable |
| tech-lead | 18.8 | 3 | 46 | 4 | Build/intake work — judgment-heavy |
| evaluator | 17 | 12 | 22 | 4 | Calibration/review — LLM needed |
| amy-kimi | 13.9 | 9 | 20 | 13 | Research/social — creative |
| scout | 9.6 | 3 | 39 | 8 | Research — creative |
| may | 4.4 | 1 | 53 | 23 | 91% are 1-op (early exit) — already effectively graduated |
| qa | 4.0 | 1 | 21 | 21 | 76% are 1-op (commit preflight exit) — **graduation candidate** |

### Status of Prior Proposals

| # | Proposal | Status | Update |
|---|----------|--------|--------|
| 1 | Coach ERROR_LOG scanning → JS handler | ✅ **GRADUATED** (Review #2) | `error-log-scanner` in cron.json, working. |
| 2 | May Step 3 (System Health) → remove | ⏳ Still pending | Step 3 still in May's heartbeat.md. Low priority — May's 1-op sessions show the step is already being skipped most of the time. The `watchdog` and `system-status` JS handlers cover this. |
| 3 | Tech-Lead health-check.sh → JS pre-flight | ⏳ Deferred | Still deferred. Tech-lead avg 18.8 ops — the health check is embedded in a broader Error Review step. Not worth splitting. |

### New Findings

#### OBSERVATION 1: QA Commit-Preflight is a JS Handler Candidate
**Current**: QA heartbeat §0a reads `workspace/last-reviewed-commit.txt`, runs `git log <hash>..HEAD`.
If no new commits → `finish()` immediately (1 op). This happens in 76% of heartbeats.

**Pattern**: Perfectly deterministic. `git log --oneline <hash>..HEAD | wc -l` → if 0, skip.

**Proposal**: Add a JS preflight handler to QA's cron entry that:
1. Reads `agents/qa/workspace/last-reviewed-commit.txt`
2. Runs `git log --oneline <hash>..HEAD | wc -l`
3. If 0 → skip the LLM session entirely (zero cost)
4. If >0 → fire the heartbeat normally

**Benefit**: Eliminates ~16 LLM sessions/day × 1 op each = 16 ops saved + LLM inference cost for each.
The savings are modest per session but compound: ~16 unnecessary LLM invocations per day.

**Risk**: Low — the git check is trivial. False negatives (missing new commits) aren't possible since
`git log` is authoritative. False positives (firing when no real work needed) are the same as today.

**Complexity**: Very low — similar to existing preflight patterns in cron.json.

**Status**: ⏳ Proposed — implement as JS preflight on QA's heartbeat cron entry.

#### OBSERVATION 2: May Heartbeat Already Effectively Graduated
May averages 4.4 ops per heartbeat, with 91% being 1-op sessions. The JS handlers (`watchdog`,
`system-status`, `evaluate-sessions`, `daily-brief`, etc.) do nearly all the work. May's heartbeat
is essentially a dispatch check that early-exits when there's no pending work.

No action needed — this is working as designed.

#### OBSERVATION 3: Evaluator Process Check References Stale Path
Evaluator Step 1b references `ls .state/evaluations/` — this directory has only 14 old files (last
updated Mar 24). Evaluations now go to the DB. This is a heartbeat bug, not a graduation candidate.
The evaluator should update its health check to query the DB instead.

**Status**: ℹ️ Note — low priority, doesn't cause errors.

#### OBSERVATION 4: Cron Growth (28 → 47 entries)
Since Review #1 (Mar 16), cron.json has grown from 28 to 47 entries. New entries include:
- `consolidate-memory-*` (9 agents)
- `training-sprint`, `research-intake`
- `tracker-compact`
- `audit-requests`
- `agents-auto-commit`
The graduation pipeline is working — heartbeat work is being moved to cron/handlers.

### No Orphaned Handlers Found
Previous reviews flagged `audit-requests.ts` and `focus-task-tracker.ts` as orphaned.
`audit-requests` now has a cron entry. `focus-task-tracker.ts` status unknown but not causing issues.

### Action Items
1. **Implement QA commit-preflight JS handler** — delegate to tech-lead or implement via workflow
2. **May Step 3 removal** — re-propose to May (low priority)
3. **Evaluator stale path** — note for evaluator to fix (informational)

### Next Review
Scheduled: 2026-04-14 (bi-weekly cadence)
