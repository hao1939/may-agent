# Workflow Coverage Measurement Report
**Date:** 2026-04-19  
**Baseline:** 31% (at project start)  
**Target:** 80%

## Cron-Level Coverage

**10 / 44 enabled cron entries have workflow routing = 22.7%**

Workflow-routed entries:
- 7 heartbeat entries (may, bob, optimizer, coach, scout, tech-lead, qa) — `workflow: "heartbeat"`
- 3 sensor-judge workflows (training-sprint, error-scan, coaching-feedback-wf) — `handler: "run-workflow"`

Remaining 34 entries are JS handlers (watchdog, zombie-cleanup, session-sync, etc.) or `run-agent-task` jobs.

## Session-Level Coverage (Last 7 Days)

| Type | Sessions | % |
|------|----------|---|
| Workflow (`workflowRunId` present) | 1,103 | 19.3% |
| Freestyle (no workflow) | 4,618 | 80.7% |
| **Total** | **5,721** | |

**Session-level workflow coverage: 19.3%**

## Analysis

### Why coverage is below target

The cron-level metric (22.7%) is misleading because many of the 34 non-workflow entries are **high-frequency JS handlers** (5-10min intervals) that spawn sessions without workflows. These include:
- `session-sync` (5min), `project-resume` (5min), `active-nudge` (5min) — each creates ~2,000+ sessions/week
- `watchdog` (10min), `evaluation-sync` (10min) — ~1,000+ sessions/week

The 7 heartbeat entries fire every 30min each = ~2,352 sessions/week, but they're outnumbered by the high-frequency JS jobs.

### Key insight: JS handler sessions shouldn't count

Most JS handler cron jobs (`watchdog`, `session-sync`, `active-nudge`, etc.) are **infrastructure automation** — they don't involve LLM agents and don't benefit from workflow routing. If we exclude pure JS handler sessions, the picture changes significantly.

Of the 44 enabled cron entries:
- **16 involve LLM agents** (7 heartbeats + 5 `run-agent-task` jobs + 3 `run-workflow` jobs + 1 evaluator-heartbeat)
- **28 are pure JS handlers** (no LLM, no workflow needed)

**LLM-agent cron entries with workflow routing: 10/16 = 62.5%**

The 6 unrouted LLM entries are:
1. `optimize` (daily, optimizer via run-agent-task)
2. `reflect` (6h, coach via run-agent-task)
3. `common-sense-verify` (4h, coach via run-agent-task)
4. `common-sense-infra` (daily, bob via run-agent-task)
5. `research-intake` (daily, coach via run-agent-task)
6. `standing-orders-check` (30min, may — JS but may spawn LLM)

### Comparison to Baseline

| Metric | Baseline | Current | Target |
|--------|----------|---------|--------|
| Cron coverage (all) | 31% | 22.7% | 80% |
| Cron coverage (LLM-only) | ~31% | 62.5% | 80% |
| Session coverage (all) | ~31% | 19.3% | 80% |

## Verdict

**80% target is NOT met** on any metric.

The heartbeat workflow wiring is working (10 entries routed), but the original 31% baseline likely measured something different than what we're measuring now. The high volume of JS infrastructure sessions dilutes workflow coverage.

### Path to 80% (LLM-agent cron entries)

To reach 80% of 16 LLM entries = need 13 routed. Currently at 10. Need 3 more:
- Route `optimize`, `reflect`, and `common-sense-verify` through workflows → 13/16 = **81.3%**

### Path to 80% (all sessions)

Not achievable without either:
1. Adding workflow wrappers to JS handlers (pointless overhead), or
2. Redefining the metric to exclude infrastructure-only sessions
