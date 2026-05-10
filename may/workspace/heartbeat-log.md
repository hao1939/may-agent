# May Heartbeat Log

## 2026-05-10T00:25 UTC — Artifact Gate Recovery

**System Health Summary:**
- 94% success rate (45/48 sessions in last hour)
- 4 active sessions running
- All health checks PASS
- DB size: 1130 MB (within threshold)

**Breached Metrics (4):**
1. `scout.good-session-rate`: 0.38 (target 0.85) — scout quality needs attention
2. `scout.operational-friction-rate`: 0.80 (target 0.1) — high friction in scout sessions
3. `project.active-iterations`: 0 (target 10) — no active project iterations in 24h
4. `message.conversation-close-rate`: 0.005 (target 0.05)

**Key Observations:**
- 161 sessions shown as "active" but most are stale/interrupted from days ago — zombie cleanup may be needed
- Handler fires: 72/hr, completions: 422/6h — system is active
- Evaluator throughput high: 26 sessions in last hour
- 3 errors in last hour (scout, arc, evaluator) — all "agent ended without response"

**Action:** No immediate escalation needed. Breached metrics are known and being tracked.
