# Journal

## 2026-05-07

Project opened from Hao direction: "before the agent can do it by itself, please drive the project."

Initial assessment:
- This is a long tracking project, not a one-off doc patch.
- Phase 0 should still be done immediately because the current spec has misleading state.
- The project should eventually become self-observing through `v2.spec-coverage-rate`, `capability.status-reality-mismatch-count`, and UI conformance views.

Completed Phase 0 cleanup:
- Opened this shared project as the long-running owner of v2 conformance and visibility.
- Patched `v2-spec.md` so it no longer treats hand-maintained status as authoritative.
- Fixed stale/contradictory spec claims around C2 (`metric.recovered`), C3/C8 references to S7, S6 runtime glue LOC, S7 heartbeat workflow path, and S8 metric priority.

Next action: implement the smallest computed conformance signal: `v2.manager-loc` and `v2.runtime-glue-loc`, then add `v2.spec-coverage-rate`.
