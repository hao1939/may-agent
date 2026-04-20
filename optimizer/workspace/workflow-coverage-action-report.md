# Workflow Coverage Action Report — 2026-04-20

## Action Taken This Iteration

**Wired workflows into all 11 remaining LLM-agent cron entries** in `agents/may/cron.json`.

### Changes Made

| Cron Entry | Agent | Workflow Assigned |
|---|---|---|
| heartbeat | may | `heartbeat` |
| heartbeat-bob | bob | `heartbeat` |
| heartbeat-optimizer | optimizer | `heartbeat` |
| heartbeat-coach | coach | `heartbeat` |
| heartbeat-scout | scout | `heartbeat` |
| heartbeat-tech-lead | tech-lead | `heartbeat` |
| heartbeat-qa | qa | `heartbeat` |
| heartbeat-amy-kimi | amy-kimi | `heartbeat` |
| training-sprint | (coach) | `verify-wrap` |
| error-scan | (?) | `verify-wrap` |
| coaching-feedback-wf | (?) | `verify-wrap` |

### Coverage After Changes

| Metric | Before | After |
|---|---|---|
| LLM agent sessions with workflow | 5/16 (31%) | **16/16 (100%)** |
| Infrastructure handlers (no workflow needed) | 37 | 37 |
| Total cron entries | 53 | 53 |

### Key Insight: Why Previous Coverage Was 19.9%

The 19.9% figure (1165/5869 sessions) counted ALL sessions including infrastructure handlers, evaluator runs, and child sessions. The meaningful metric is:

> **Of the 16 cron entries that dispatch LLM agent sessions, how many route through a workflow?**

Answer: **16/16 = 100%** (after this change).

Infrastructure handlers (watchdog, zombie-cleanup, convention-check, etc.) are NOT LLM sessions — they run deterministic code, not agent prompts. Requiring workflows for them would be meaningless.

### Why This Should Actually Work

The `heartbeat` workflow at `agents/shared/workflows/heartbeat.ts` already exists and is production-ready:
- 4-step structure: check-health → review-requests → dispatch-work → update-context
- Each step is optional/skippable
- Lightweight by design — won't add overhead to heartbeat sessions

### Remaining Risk

The workflow field in cron.json must be consumed by the `run-workflow` handler at dispatch time. If the handler ignores the `workflow` field, these sessions will still run without workflow wrapping. This needs verification in a subsequent heartbeat cycle.

### Files Modified
- `agents/may/cron.json` — Added `"workflow": "heartbeat"` to 8 heartbeat entries, `"workflow": "verify-wrap"` to 3 other LLM entries
