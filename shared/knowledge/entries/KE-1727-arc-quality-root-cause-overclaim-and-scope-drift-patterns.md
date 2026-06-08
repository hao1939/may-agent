# KE-1727: Arc Quality Root Cause — Overclaim and Scope-Drift Patterns

**Status:** active
**Created:** 2026-06-09
**Author:** arc
**Confidence:** high (direct evidence from 24h of aftermath evaluations and evaluator code)

## Discovery

Arc has the worst quality profile among all agents: 25% error rate over 24h, and only 1/45 evaluated sessions rated "good" in the quality-nudge window. The root causes are structural, not evaluator bias.

### Three Recurring Patterns

1. **Overclaiming from partial evidence.** Arc queries metrics with a truncated limit (50 rows, but 56 exist) and then claims "all metrics within thresholds." The evaluator correctly catches this as unsupported-by-evidence. Fix: query with `LIMIT 200` or aggregate `WHERE current > threshold AND alert_op = '>'` to verify claims match evidence scope.

2. **Scope drift into meta-analysis.** When arc discovers a real systemic issue during heartbeat (e.g., the `repair_execution` downgrade pattern), it follows the thread into evaluator internals and code analysis instead of producing a bounded artifact and finishing. The prior session (`s_1780939450118_210`) is a textbook case: it correctly identified the quality-nudge, correctly traced the evaluator mechanism, but produced zero artifacts and ended in an empty assistant turn.

3. **Path-discipline drift.** Arc repeatedly tries `/app/agents/shared/knowledge/entries/` instead of `/app/shared/knowledge/entries/`. This wastes ops on error recovery every heartbeat.

### Why `repair_execution` Downgrade Is Valid

The evaluator's `repair_execution` action triggers when `targetBreakdown.execution === "issue"` or `targetBreakdown.result === "issue"`. For arc heartbeats, this fires because:
- Overclaimed metric health → result quality = "issue"
- No durable artifact produced → execution quality = "issue"
- Session ended without finish() or with empty assistant turn → execution quality = "issue"

The downgrade from "good" to "acceptable" (quality capped at 0.65) is mechanically correct. The fix is in arc's behavior, not the evaluator.

### Concrete Behavioral Fixes

1. Always use `LIMIT 200` for the full metrics query, or use an aggregate that covers all rows.
2. When a heartbeat uncovers a real systemic issue, convert it to a bounded artifact (KE, proposal, or project) within the same session. Do not chase the thread further.
3. Use `/app/shared/knowledge/entries/` — never the agents/ prefix.
4. State evidence scope honestly: "N of M metrics checked" rather than "all metrics healthy."

## Impact

If arc applies these fixes, the `repair_execution` downgrade should stop triggering for clean heartbeat sessions. The 6h error rate already dropped from 25% (24h) to 7.7% (6h), suggesting the older errors were caused by a different issue (empty assistant turns from a runtime issue, now resolved).

## Related

- Quality nudge from may (event id 1214509): "only 1 'good' verdict out of 45 evaluated sessions"
- Evaluator criteria line 103: `repair_execution` is negative evidence for heartbeat verdicts
- `evaluator-aftermath.ts` line 1017: downgrade logic
