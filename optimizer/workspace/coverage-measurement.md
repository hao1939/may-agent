# Workflow Coverage Measurement Report
**Date:** 2026-04-19  
**Baseline:** 31% (pre-project)

## Cron-Level Coverage

| Metric | Count |
|--------|-------|
| Total cron entries | 47 |
| Enabled entries | 44 |
| Entries with workflow routing | 10 |
| **Coverage (enabled)** | **10/44 = 22.7%** |

### Workflow-routed entries:
- 7 heartbeat entries (may, bob, optimizer, coach, scout, tech-lead, qa) → `heartbeat` workflow
- 3 job entries (training-sprint, error-scan, coaching-feedback-wf) → dedicated workflows via `run-workflow`

### Why cron-level is misleading:
Most non-workflow cron entries are **JS handlers** (watchdog, zombie-cleanup, session-sync, etc.) that run zero LLM ops. They don't need workflow routing — they're already deterministic. The relevant denominator is LLM-invoking entries only.

**LLM-invoking cron entries:** ~15 (7 heartbeats + optimize + reflect + common-sense-verify + common-sense-infra + research-intake + training-sprint + error-scan + coaching-feedback-wf)  
**With workflow routing:** 10/15 = **66.7%**

## Session-Level Coverage (Last 24h)

| Type | Sessions | % |
|------|----------|---|
| Workflow (has workflowRunId) | 307 | 28.2% |
| Freestyle (no workflowRunId) | 782 | 71.8% |
| **Total** | **1,089** | |

### All-time totals:
- Workflow: 1,963 / 25,768 = 7.6%
- Note: workflow tracking was added recently; all-time is not representative.

## Analysis

### Cron routing vs session reality gap:
The 7 heartbeat entries with `workflow: "heartbeat"` are configured but the session DB shows only 28% of recent sessions have a `workflowRunId`. This suggests:
1. Many sessions are JS handler jobs (no LLM, no workflowRunId) — these inflate the freestyle count
2. The heartbeat workflow may not be fully wired in the runtime yet (config added but not consumed)
3. `agents.fork` and `agents.call` sessions (ad-hoc work) naturally lack workflow routing

### Comparison to baseline:
- **Baseline:** 31% (estimated from pre-project analysis)
- **Current session-level:** 28.2% (last 24h, raw)
- **Current LLM-cron coverage:** 66.7% (entries that invoke LLM and have workflow routing)

### 80% Target Assessment:
**Not yet met at session level.** The cron config changes are in place (10 entries with workflow routing), but the gap between config and actual session data suggests:

1. **JS handler sessions** dominate the session table — these are not candidates for workflow routing
2. **The heartbeat workflow routing may need runtime support** — the `"workflow": "heartbeat"` field in cron.json needs to be consumed by the session spawner
3. **Ad-hoc sessions** (fork/call from within other sessions) will always be freestyle

### Projected path to 80%:
If we filter to only LLM-agent sessions (heartbeats + run-agent-task jobs), the 10 workflow-routed entries likely represent **~70-80% of LLM session volume** since heartbeats fire every 30min for 7 agents. The remaining gap is `optimize`, `reflect`, `common-sense-verify`, `common-sense-infra`, and `research-intake` (5 entries using `run-agent-task` without workflow routing).

**Recommendation:** The 80% target is achievable for LLM sessions by either:
- Routing the 5 remaining `run-agent-task` jobs through workflows (gets to ~95% of LLM cron entries)
- Ensuring the runtime actually creates sessions with `workflowRunId` when `workflow` field is present in cron config
