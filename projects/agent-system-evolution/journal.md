# agent-system-evolution — Journal

Append-only log for agent-system evolution work.

---

## 2026-05-20 — Boundary project created

Created this project to separate learning/evolution ownership from the platform
infra substrate. The intended coupling path is metrics/events/comments/tasks,
not direct ownership of another project's control plane.

## 2026-05-21 — Reframed as harness R&D

Reopened the project as the standing agent harness R&D lane. The project now
owns learning, experimentation, behavioral contracts, and validation for harness
techniques, while platform remains the owner for runtime/SDK/event/persistence
implementation.

Accepted the missing structural receipt gap as the first concrete signal:
`agent-system-evolution` should define the successful-session receipt contract,
platform should implement persistence, and `evaluator-receipt-coverage` should
validate fresh-session coverage.

## 2026-05-21 — Structural receipt contract drafted

Added `contracts/structural-receipt-contract.md` as the harness contract
for successful-session receipts. The contract defines the minimal receipt shape,
closeout persistence surface, evaluator validation signal, platform acceptance
criteria, and non-goals.

The task is now complete in this project. Next ownership step is platform
implementation; `projects/evaluator-receipt-coverage/project.md` remains the
coverage validation tracker.
