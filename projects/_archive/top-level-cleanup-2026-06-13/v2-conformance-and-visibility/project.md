---
id: v2-conformance-and-visibility
owner: may
status: closed
type: archive
priority: P0
iteration: 1
---

# Project: v2 Conformance and Visibility

## Goal

Make v2 conformance visible and self-tracking. A human should be able to open the system and know whether v2 holds without trusting hand-maintained markdown.

This is not a one-off doc cleanup. It is a tracking project whose first slice is to make the current spec honest, then progressively replace hand-maintained status with computed metrics and UI views.

## Metrics

- `capability.session-trace-completeness`: target >= 0.95
- `capability.status-reality-mismatch-count`: target 0
- `v2.spec-coverage-rate`: target >= 0.8, then 1.0
- `v2.heartbeat-decision-rate`: target >= 0.95

## Current State

- `agents/shared/may-agent-docs/proposals/v2-spec.md` has the right contract shape and is now tied to this tracking project instead of a hand-maintained status table.
- The first integrity bugs around S6 runtime LOC, C2 recovery emission, S8 metric priority wiring, and broken S7 references have been corrected or moved into live tracking.
- The current web UI shows useful system data but is still a dashboard/tab surface, not the proposed liveness/trace/spec-conformance window.
- Phase 2 complete: `context.read` and `agent.decision` events now emit in every heartbeat session. `capability.session-trace-completeness` metric computes 24h completeness ratio.
- Next: Phase 3 — visibility UI (liveness view, session trace view, spec conformance view).

## Plan

### Phase 0 — Make The Spec Honest

- [x] Fix stale/contradictory claims in `v2-spec.md`.
- [x] Separate durable contract text from hand-maintained status text, or clearly mark status as non-authoritative.
- [x] Define the visibility project as the owner of ongoing spec drift.

### Phase 1 — Minimal Conformance Signal

- [x] Add a first computed structural metric, starting with `v2.runtime-glue-loc`.
- [x] Add `v2.spec-coverage-rate` so unmeasured claims are visible.
- [x] Add `capability.status-reality-mismatch-count` cross-checks.

### Phase 2 — Trace Completeness

- [x] Add `agent.decision` event to heartbeat sessions.
- [x] Add `context.read` event for heartbeat context loaded before the decision.
- [x] Add `capability.session-trace-completeness`.

### Phase 3 — Visibility Output (Revised)

- [x] Create a script `agents/shared/scripts/conformance-report.ts` that queries the DB and generates a static HTML report showing: heartbeat timeline, session traces, and spec conformance metrics.
- [x] The report is viewable by opening the HTML file directly (no server needed).
- [x] Wire the report generation into the metrics-snapshot handler so it regenerates on each heartbeat cycle.

## References

- `agents/shared/may-agent-docs/proposals/v2-spec.md`
- `agents/shared/may-agent-docs/design/webui.md`
- `agents/shared/may-agent-docs/design/heartbeat-as-agency.md`
- `agents/may/handlers/metrics-snapshot.ts`
- `src/app/ui/web.ts`
- `src/app/ui/web-static/index.html`
