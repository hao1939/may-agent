# Active Proposals

**Supports:** [Design Authoring and Review](../2b-manual/design-authoring/SKILL.md). Keeps only active, pending design and cutover work in `proposals/`; completed implementations, promoted contracts, and historical reviews live in [../2a-design/](../2a-design/) and [../archive/](../archive/README.md).

---

## Active Pending Proposals (3)

| Proposal | Focus & Remaining Scope |
| --- | --- |
| **[Unified Input Channel Design: 2-Mode Mental Model & HTTP + WebSocket Foundation](input-channel-design-and-experience-20261117.md)** | **PR 1 (#581, merged)** and **PR 2 (#587, merged)** promoted the 2-Mode model (`Conversation Mode` + `Task-Focused Mode`), `ref`-first Task APIs, `?q=` search, and Topic retirement into [human-control-surfaces.md](../2a-design/human-control-surfaces.md), [http-boundary.md](../2a-design/http-boundary.md), [webui.md](../2a-design/webui.md), and [may-console.md](../2a-design/may-console.md).<br>**Selected for implementation:** **PR 3** — Bind daemon HTTP + `/ws` directly to the existing owning services and migrate ordinary `may-console` requests/wakes. Preserve headless operation, durable admission/replay, trust boundaries and existing operator/control-SDK compatibility. Internal callers need no loopback HTTP; this is not complete NDJSON retirement or an event-journal rewrite. |
| **[Event System Refinement: Clear, Loud, Fact-Only Events & M:N Resource Watchers](event-system-refinement-20261117.md)** | Separates Direct Commands, Durable Domain Events (`events` table), and Ephemeral Live Wakes (`/ws`), and defines the Pluggable Per-Resource Watcher architecture with two watch modes (`one-shot` vs. `continuous`).<br>**Done & Deployed:**<br>• **Slice 1 (Merged in #591 + Apps `73ab3ccd30`):** M:N `one-shot` vs. `continuous` resource watch lifecycle and retiring `github-pull-request-live` PR-body scraping.<br>• **Slice 2 (Merged in #588 & #593 + Apps `ae40ed0fca`):** Stopped the 66% timer & heartbeat flood in `events` (`runtime.daemon.heartbeat`, `trigger.metrics-*`, `conversation.supervision.review`, `scout` self-subscribed schedules).<br>**Pending:**<br>• **Slice 3:** Move `DbWriter` `sessions` side-effect mutations and `app.task.communication.updated` receipts out of `events`.<br>• **Slice 4:** Route direct controls (`retry`/`cancel`/`reopen`/`close`/`stopTurn`) directly and separate ephemeral `/ws` wakes from durable domain events. |
| **[Unified Agent and Workflow Calls](agent-workflow-interface-review-20261117.md)** | **Accepted; implementation active via May:** Remove invocation permission support; require `{ prompt, data? }` for every call; converge results and validation; use one exact canonical namespace; reduce `agents` to `list` and awaited `call`.<br>**Pending:** Checklist A–F: paired Host/SDK/App migration, fork/session retirement, mixed-call/cancellation checks, and a local candidate trial before merge, including coding/PR follow-through. |

---

## Recently Promoted & Archived (2026-11-17 Hygiene Pass)

All completed source slices, historical reviews, external comparisons, and deferred redesigns have been promoted to `2a-design/` and moved to `../archive/`:

- **Promoted Implementation Records (`../archive/implementation/`):**
  - [`host-ingress-and-boundary-simplification-20261116.md`](../archive/implementation/host-ingress-and-boundary-simplification-20261116.md) (PRs #566, #568, #569, #570, #572, #573, #575, #576, #577, #584)
  - [`sdk-boundary-and-kernel-hardening.md`](../archive/implementation/sdk-boundary-and-kernel-hardening.md) (PRs #542, #546, #555, #558)
  - [`gym-sdk-standalone-modernization.md`](../archive/implementation/gym-sdk-standalone-modernization.md)
  - [`control-socket-simplification.md`](../archive/implementation/control-socket-simplification.md) (PRs #523, #524)
  - [`model-surface-and-prompt-hygiene-20261111.md`](../archive/implementation/model-surface-and-prompt-hygiene-20261111.md) (PR #452)
  - [`task-owned-host-simplification-20261111.md`](../archive/implementation/task-owned-host-simplification-20261111.md) (PR #449)
  - [`unified-agent-instance-runtime-convergence.md`](../archive/implementation/unified-agent-instance-runtime-convergence.md)
  - [`telegram-conversation-experience.md`](../archive/implementation/telegram-conversation-experience.md), [`alex-improvement-app.md`](../archive/implementation/alex-improvement-app.md), [`agent-task-workload-implementation.md`](../archive/implementation/agent-task-workload-implementation.md), [`workflow-tracing-and-health-metrics.md`](../archive/implementation/workflow-tracing-and-health-metrics.md), [`external-components-simplification.md`](../archive/implementation/external-components-simplification.md), [`app-policy-and-host-boundary-cleanup.md`](../archive/implementation/app-policy-and-host-boundary-cleanup.md)
- **Archived Reviews & External Comparisons (`../archive/reviews/`):**
  - [`dsh-superagent-review-and-adoption-20261111.md`](../archive/reviews/dsh-superagent-review-and-adoption-20261111.md), [`orca-review-and-adoption-20261114.md`](../archive/reviews/orca-review-and-adoption-20261114.md), [`event-system-refinement-review-20261117.md`](../archive/reviews/event-system-refinement-review-20261117.md), [`unified-agent-recovery-20261017.md`](../archive/reviews/unified-agent-recovery-20261017.md), [`observer-feedback-and-resource-conventions.md`](../archive/reviews/observer-feedback-and-resource-conventions.md), [`design-implementation-convergence.md`](../archive/reviews/design-implementation-convergence.md), [`authority-boundary-simplification.md`](../archive/reviews/authority-boundary-simplification.md)
- **Archived Deferred Decisions (`../archive/decisions/`):**
  - [`agent-task-workload-model.md`](../archive/decisions/agent-task-workload-model.md), [`tasks-and-communication-resources.md`](../archive/decisions/tasks-and-communication-resources.md), [`standalone-agent-tasks.md`](../archive/decisions/standalone-agent-tasks.md), [`storage-state-service.md`](../archive/decisions/storage-state-service.md), [`focused-session-continuation.md`](../archive/decisions/focused-session-continuation.md), [`may-project-review-loop-20260912.md`](../archive/decisions/may-project-review-loop-20260912.md), [`task-attempt-decision-schema-20261002.md`](../archive/decisions/task-attempt-decision-schema-20261002.md), [`task-execution-capabilities-20261002.md`](../archive/decisions/task-execution-capabilities-20261002.md), [`task-execution-capability-contracts-20261003.md`](../archive/decisions/task-execution-capability-contracts-20261003.md)
