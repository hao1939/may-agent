<ai_context>
KE-1932 F2 falsified: session.resume_failed did NOT stabilize within 48h — it grew from 599/day to 728/day. The source composition shifted from planner-dominated (47.6% in KE-1932) to task-dominated (50% task, 41% planner). All 2,134 failures in the 7-day window share one reason pattern: "Session not found". The dedup_key design gap (KE-1837) remains unimplemented. Resume failures now consume 12.5% of handler starts.
Triggers: session.resume_failed, KE-1932, F2, falsification, dedup_key, structural-growth, handler-waste
</ai_context>

# KE-1951: Resume-Failed F2 Falsified — Structural Growth Continues

**Status**: active
**Discovered**: 2026-06-15
**Agent**: arc (heartbeat)
**Scope**: session lifecycle, handler waste, KE-1932 falsifier update
**Related**: KE-1932 (resume-failed escalation), KE-1837 (dedup design gap), KE-1785 (resume-failed aks-exclusive)

## Claim

KE-1932 F2 stated: "If the growth is due to a specific burst of aks-rp-e2e task creation (not structural), the rate should stabilize or drop without intervention within 48h."

**F2 is falsified.** The rate grew from 599/day (Jun 13) to 728/day (Jun 14) — a 21.5% increase, not stabilization. The 48h window passed without intervention or stabilization. This confirms the growth is structural, not a transient burst.

## Evidence

### Daily resume_failed count (7-day window)

| Day (bucket) | Resume Fails | Session Starts | Fail Ratio |
|--------------|-------------|----------------|------------|
| Jun 9 | 190 | 922 | 20.6% |
| Jun 10 | 263 | 982 | 26.8% |
| Jun 11 | 242 | 1,085 | 22.3% |
| Jun 12 | 627 | 1,575 | 39.8% |
| Jun 13 | 728 | 1,702 | 42.8% |
| Jun 14 (partial) | 84 | 223 | 37.7% |

The fail ratio stabilized near 40% but the absolute count grew with session volume. This is proportional growth, not a transient spike.

### Source composition shift (7-day window)

| Category | Count | % of Total |
|----------|-------|-----------|
| task sessions (`s_task_*`) | 1,065 | 49.9% |
| planner sessions (`s_project_planner_*`) | 872 | 40.8% |
| problem sessions (`s_problem_*`) | 165 | 7.7% |
| other | 32 | 1.5% |

KE-1932 reported planner sessions at 47.6% of resume failures. Now task sessions dominate at 49.9%. The growth is spreading from the planner to the task execution layer — both create deterministic session IDs that the system later tries to resume after the session has been cleaned up or never existed.

### Handler waste quantification

- 726 resume_failed events in last 24h
- 5,827 handler.started events in last 24h
- **12.5% of handler invocations are wasted on resume failures**
- Each failure follows the full handler.started → handler.completed cycle

### Root cause unchanged

All 2,134 resume failures in the 7-day window share the same reason structure: `Session "s_<type>_<id>" not found`. The dedup_key spec from KE-1837's design doc remains unimplemented (grep for `dedup_key` in src/ returns zero results).

## Updated Falsifier Status

| Falsifier | Status | Evidence |
|-----------|--------|----------|
| F1 (dedup_key implementation → >50% drop) | **Untested** — no implementation exists |
| F2 (transient burst → stabilize in 48h) | **Falsified** — rate grew 21.5% (599→728) |
| F3 (sessions created then cleaned up) | **Untested** — requires session lifecycle investigation |

## Significance

With F2 falsified, the growth is confirmed structural. It scales with session volume. At current growth rates:
- If session volume reaches 2,500/day → ~1,000 resume failures/day
- Handler waste would reach ~17% of all handler invocations

The fix path is clear (KE-1837 dedup_key implementation) but requires src/ changes (ORDER-010). This has been escalation-ready since KE-1932 (Jun 13) — 2 days without action.

## Recommendation

No new recommendation beyond KE-1932's: escalate dedup_key implementation to may/tech-lead. The falsification of F2 makes the urgency stronger — this is not a transient condition that will self-resolve.
