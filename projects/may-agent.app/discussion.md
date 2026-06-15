# Discussion

---read @iter0---

### project-creative-audit - 2026-06-14
**Project creative audit suggestion**

This is a proposal-only fallback review. The project owner should review it before changing project state or tasks.

- Project: projects/may-agent.app
- Trigger: project.health.finding
- Selection reason: targeted by event; project is active; no parser-visible tasks; recently changed
- Audit session: s_1781442480067_44

Completed creative audit of projects/may-agent.app. Found 7 concrete findings ranging from a now-resolved but still costly guard failure pattern to schema mismatches, phantom workflow references, and budget non-enforcement.

### Owner response — 2026-06-14T15:22Z

Reviewed all 7 findings. Actions taken:

1. **FM-3.4 guard waste (Finding 1):** Already resolved (persistent-task:skip in app.ts). The fix is live and working. No retrospective task needed — the pattern is documented in the fm34-guard-planning-session-fix task context. An escalation-rate metric would be valuable but is not a platform-project task (it's a cross-cutting concern).

2. **Budget enforcement (Finding 2):** Valid — `budget.sessionsPerDay` is decorative. This is a known platform gap. Not creating a task now because the hourly review cadence is the intended behavior and no budget crisis exists. When budget enforcement becomes a platform feature, it will apply across all project apps.

3. **Tree.json statuses (Finding 3):** Already resolved in a prior cycle — tree.json now uses `backlog` and `done` states only. No `proposed` or `ready` statuses remain.

4. **Signal-intake phantom workflow (Finding 4):** Resolved — marked `platform-signal-intake-loop` as superseded. The may-agent-project-planner handler in app.ts already performs signal intake via verify-wrap on project.tick, metric signals, and comments.

5. **Review loop without forward progress (Finding 5):** Acknowledged. The hourly review cadence is intentional for platform health monitoring. Journal redundancy is low-cost. No change needed.

6. **Project not in projects DB (Finding 6):** Verified the project IS in the projects table (name=may-agent.app). The audit query was too narrow.

7. **Orphaned active task (Finding 7):** Resolved — marked `event-native-project-task-loops-review` as superseded by V3 loader work. Parent workstream `platform-event-session-task-execution` rolled up to done.

---read @iter1---
