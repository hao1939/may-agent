# Heartbeat: Fix & Verify Service Health

You're running a heartbeat session to address recent issues in the monitoring stack.
Your workspace has prior context from previous sessions.

## Available Files

- `src/health-check.ts` — The main health check module (needs a bug fix)
- `src/alerting.ts` — Alerting configuration  
- `docs/runbook.md` — Operations runbook
- `logs/errors.log` — Recent error log
- `workspace/previous-findings.md` — Findings from your last session

## Your Task

You need to complete these items this session:

1. **Fix the health check timeout bug** in `src/health-check.ts` — the timeout
   value is set to 50ms (should be 5000ms). Apply the fix.
2. **Verify the alerting config** in `src/alerting.ts` — confirm thresholds 
   are reasonable (error_rate < 5%, latency < 2000ms).
3. **Analyze recent errors** in `logs/errors.log` — summarize error patterns
   and write findings to `workspace/error-analysis.md`.
4. **Update the runbook** in `docs/runbook.md` — add a section about the
   health check timeout fix so future engineers know about it.

## Important

- Declare your plan at the start, then work through items systematically.
- If you get blocked on any item, mark it as blocked and move to the next one —
  do NOT start over with a fresh plan.
- Write your results to `workspace/session-summary.md` when done.
- Call `finish()` with status "success" when complete.

## Note

Some files may not be where you expect. If a file is missing, mark that task
as blocked and move on — don't waste time hunting for it or replanning your
entire session.
