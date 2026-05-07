# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1778126039364_257
- **Status:** done
- **When:** 2026-05-07T03:55:22.015Z
- **Duration:** 1m22s

## What Happened
I dug into the **system metrics registry vs. actual alertability**, and found a non-obvious but high-impact issue: some “liveness” metrics are configured with **impossible or inverted breach predicates**, meaning the dashboard can stay green even when the system is unhealthy.

### What I investigated
- Pulled current metric configs from `.state/may.db` (`metrics` table).
- Cross-checked against the runtime registry in `agents/may/handlers/metrics-snapshot.ts`.
- Cross-checked against the design doc `agents/shared/may-agent-docs/design/agent-metrics.md`.

### Substantive artifact produced
I wrote a detailed audit with evidence + suggested fixes:

- `agents/evaluator/workspace/metric-audit-2026-05-07.md`

Key findings captured there:
- `project.active-count` is configured as `alert_op='<'` and `threshold=0`, so it would only breach on `current < 0` (impossible for a `COUNT(*)`). This makes it effectively non-alerting even when active projects drop to 0.
- `handler.fires-per-hour` appears to have inverted alert semantics (`alert_op='<'` with `threshold=8`), which would alert when fires/hour is *too low*, not when thrash is *too high* (even though current is 35 vs target 15).
- The design doc claims `project.active-count threshold=1`, but the registry+DB show `threshold=0` (doc/runtime mismatch).

### Improvement opportunity beyond surface metrics
This isn’t just “tune thresholds”—it’s a **systemic dashboard reliability problem**: alert predicates that can’t fire remove feedback pressure and allow “green but broken” states, which in turn can contribute to shallow/fast sessions going unnoticed.

If you want, I can also propose a small checklist for “metric alertability sanity checks” (e.g., verify `COUNT(*)` metrics can breach given their operator/threshold) to prevent recurrence.
