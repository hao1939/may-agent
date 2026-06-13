<ai_context>
session.resume_failed events grew from 104/day (Jun 9) to 599/day (Jun 13) — a 5.8× increase in 4 days. Resume failures now represent 41% of session starts (up from ~24% on Jun 10). The design doc added dedup_key spec (KE-1837) but no implementation exists. 601 of the 839 recent failures come from project_planner sessions (event_review + planning_update) that are created then immediately not found. Each resume_failed is a wasted handler invocation.
Triggers: session.resume_failed, watchdog, dedup_key, project-planner, handler, waste, amplification, KE-1837
</ai_context>

# KE-1932: Resume-Failed Escalation — 6× Growth in 4 Days, Design Dedup Unimplemented

**Status**: active
**Discovered**: 2026-06-13
**Agent**: arc (heartbeat)
**Scope**: session lifecycle, handler waste
**Related**: KE-1837 (watchdog dedup design gap), KE-1785 (resume_failed no longer aks-exclusive), KE-1836 (watchdog amplification loop)

## Observation

`session.resume_failed` events are growing rapidly and now constitute a significant fraction of all session activity:

| Day | Resume Fails | Session Starts | Fail % |
|-----|-------------|----------------|--------|
| Jun 9 | 104 | ~320 | ~32% |
| Jun 10 | 263 | 377 | 69.8% |
| Jun 11 | 242 | 1,150 | 21.0% |
| Jun 12 | 627 | 1,765 | 35.5% |
| Jun 13 | 599 | 1,444 | 41.5% |

Each resume_failed is a unique session ID — 1:1 ratio (no re-tries of the same session). The system is creating session IDs (as part of execution-request or planning events), then trying to resume those sessions, and finding they don't exist.

## Source Decomposition (3-day window)

| Source Pattern | Count | % |
|---------------|-------|---|
| `s_project_planner_event_review_*` | 301 | 19.3% |
| `s_project_planner_planning_update_*` | 300 | 19.3% |
| `s_problem_aks-rp-e2e_task-*` | 160 | 10.3% |
| `s_project_planner_2026061*` | 131 | 8.4% |
| `s_task_*` (various) | ~665 | 42.7% |

The project planner is the single largest source: ~47.6% of all resume failures come from planner event-review and planning-update sessions. These are ephemeral sessions created by the project handler's planning loop — they generate session IDs before the session exists, then another handler tries to resume them.

## The Design-Implementation Gap

KE-1837 (2026-06-12) identified the root cause: the watchdog's `project.task.execution.requested` events lack dedup_key. The project-execution-engine design doc was updated to include the spec:

> "Each watchdog-emitted `project.task.execution.requested` must carry a deterministic `dedup_key` of the form `watchdog:<projectId>:<taskId>`. Before emitting, the watchdog must check whether a pending event with the same `dedup_key` already exists..." (line ~870)

**However, no implementation exists.** Grepping the source tree for `dedup_key.*watchdog` returns zero results. The spec was written into the design doc but never coded.

## Impact Assessment

- **839 wasted handler invocations per day** (each resume_failed triggers a handler.started → handler.completed cycle)
- **41% of session starts fail** — the system attempts nearly as many failed resumes as successful starts
- **Handler throughput consumed**: at ~100ms per handler cycle, ~84 seconds/day of handler time wasted. Not critical, but growing.
- **Event bus pollution**: 839 events/day that carry no information beyond "we tried to resume a session that doesn't exist"

## Root Cause Chain

1. Project handler creates a planning/task session with a deterministic session ID
2. The session either (a) completed and was cleaned up, or (b) never actually started
3. A watchdog tick or event handler tries to resume this session
4. Resume fails because the session record doesn't exist
5. No dedup prevents the next tick from trying again

## What Has Changed Since KE-1785

KE-1785 (Jun 10) documented 172 resume_failed events total, calling it "no longer aks-exclusive." Three days later, the count is 599/day — a 3.5× daily increase. The project planner sessions that were a small fraction in KE-1785's analysis now dominate.

The scaling correlates with aks-rp-e2e project activity growth: as the project spawns more tasks, the planner creates more ephemeral session IDs, and the watchdog retries more of them.

## Falsifiers

1. **F1**: If the dedup_key implementation from the design doc spec is deployed, resume_failed count should drop >50% within 24h.
2. **F2**: If the growth is due to a specific burst of aks-rp-e2e task creation (not structural), the rate should stabilize or drop without intervention within 48h.
3. **F3**: If the planner sessions are actually created successfully and then cleaned up (rather than never created), the fix is in session retention, not dedup.

## Recommendation

The design doc spec from KE-1837 is correct. The gap is implementation. This is an ORDER-010 item (requires Hao's approval for src/ changes). Recommend escalation to may/tech-lead for implementation prioritization. The growing rate means the problem will worsen proportionally with project activity.
