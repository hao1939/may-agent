# Heartbeat Audit — 2026-04-20

## Data Source
Sessions DB (`may.db`), `source='cron'` = heartbeat sessions.

## Per-Agent Heartbeat Analysis

### May (137 heartbeats, avg 4.8 ops, 58% no-ops)
**Heartbeat.md quality:** Well-structured with op budget (≤12), system snapshot query, triage/dispatch focus.
**Actual behavior:** Dominated by project status checks. 20+ consecutive heartbeats (20:25–21:30 on Apr 19) produced "project is active, not blocked or done" with 0-1 ops each — pure no-ops. Occasionally productive (ops 10-35) when dispatching work or updating boards.
**Problem:** May checks project status repeatedly without acting. Her heartbeat says "triage and dispatch" but most cycles are status-reading loops that conclude "nothing to do."
**Recommendation:** Add staleness detection — if she's checked the same project 3x with no change, stop checking. Add proactive triggers: scan for stuck requests, agents that haven't run, overdue periodic tasks.

### Coach (112 heartbeats, avg 15.1 ops, 11% no-ops)
**Heartbeat.md quality:** Good — role-focused (experimenter), asks "which agent struggled most?", checks experiments.
**Actual behavior:** Most productive heartbeat agent. Actively works on projects, runs experiments, writes findings. Some heartbeats stuck updating project status or dealing with blocked projects. Recent sessions show real work: verification, status updates, experiment management.
**Problem:** Gets trapped in project-status-update loops (same as May but less severe). Sometimes blocked by git/commit issues.
**Recommendation:** Coach is the model agent. Reduce project overhead, let coach focus on experimentation.

### Optimizer (23 heartbeats, avg 20.2 ops, 9% no-ops)
**Heartbeat.md quality:** Good — efficiency-focused, asks about op bloat, error patterns, fragile workflows.
**Actual behavior:** High ops per heartbeat (20.2 avg) — does substantial work each cycle. Low total count suggests infrequent scheduling.
**Problem:** Not running often enough. Only 23 heartbeats total vs May's 137.
**Recommendation:** Increase cron frequency. Current heartbeat design is effective.

### Bob (15 heartbeats, avg 12.5 ops, 27% no-ops)
**Heartbeat.md quality:** Good — innovator role, checks experiments, deep dives.
**Actual behavior:** Recent heartbeats show project completion acknowledgment (2 ops) — mostly bookkeeping. Some productive sessions with real experiment work.
**Problem:** Low heartbeat count (15 total). Some sessions are just "project confirmed complete" bookkeeping.
**Recommendation:** Increase frequency. Add "if no pending tasks, generate a new hypothesis" default action.

### Tech-Lead (3 heartbeats, avg 3.3 ops, 0% no-ops)
**Heartbeat.md quality:** Good — simplifier role, asks about complexity, deletion opportunities.
**Actual behavior:** Barely runs. 3 heartbeats total. Sessions are brief (3 ops avg) — checking project status and concluding done.
**Problem:** Extremely underutilized. Not scheduled frequently enough to be proactive.
**Recommendation:** Dramatically increase frequency. The heartbeat design is good but never gets to execute.

### Missing Agents (no cron heartbeats)
- **Amy/Amy-Kimi**: No cron heartbeats in DB. XHS exploration agents — may use different trigger mechanism.
- **Scout**: Appears in non-cron sessions (16 ops recently) but 0 cron heartbeats. Research agent not heartbeating.
- **QA**: Only appears in workflow calls, not cron. Quality agent not proactively scanning.
- **Evaluator**: Only non-cron sessions (all 0 ops). Not heartbeating proactively.
- **Master**: No sessions visible. Senior engineer agent dormant.

## System-Wide Findings

### Heartbeat Productivity
| Agent | Total | Avg Ops | No-op % | Verdict |
|-------|-------|---------|---------|---------|
| May | 137 | 4.8 | 58% | **Poor** — majority are status-check no-ops |
| Coach | 112 | 15.1 | 11% | **Good** — mostly productive |
| Optimizer | 23 | 20.2 | 9% | **Good** — productive when running, too infrequent |
| Bob | 15 | 12.5 | 27% | **Fair** — some real work, needs more frequency |
| Tech-Lead | 3 | 3.3 | 0% | **Unknown** — insufficient data |

**Overall no-op rate:** ~45% of all heartbeats produce ≤2 ops (effectively no-ops).

### Key Problems
1. **May's no-op loop** is the #1 waste — 79 of 137 heartbeats (58%) did ≤2 ops, mostly re-reading project status
2. **5+ agents have zero heartbeats** — Scout, QA, Evaluator, Master, Amy are not heartbeating via cron at all
3. **Project status checking** dominates heartbeat time across agents instead of domain-specific proactive work
4. **Heartbeat frequency imbalance** — May runs 137x vs Tech-Lead 3x; many agents starved of cycles

### Recommendations for Redesign (Milestone 2 input)
1. **May:** Add "skip if checked within last 3 cycles" logic. Default to request-queue scanning, not project review.
2. **All agents:** First action should be "check pending requests/notifications" not "review project status"
3. **Schedule all agents:** Scout, QA, Evaluator, Master need cron heartbeats enabled
4. **Add no-op detection:** If heartbeat would produce 0 actions, log why and suggest what to investigate instead
5. **Reduce project-status overhead:** Project checking should be 1 op max, not the entire heartbeat
