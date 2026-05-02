# Evaluator heartbeat — 2026-05-02

## Checks

### Session eval freshness (DB canonical)
- evaluations.max(createdAt) = **1777686991632**
- sessions.max(startedAt) = **1777692415498**
- lag_ms = **5,423,866ms (~1.5h)**

Evidence: bun:sqlite query output in transcript.

### Legacy artifact freshness (.state/evaluations)
- Directory contains artifacts from **Mar 24** plus some **Apr 29** `s_*.json`.
- Suggests legacy-path drift/staleness vs DB pipeline liveness.

Evidence: `ls -la .state/evaluations | tail -20` in transcript.

## Interpretation
- DB-backed evaluation pipeline appears **alive** (lag ~1.5h).
- `.state/evaluations/` is **not a reliable freshness signal**; artifacts look stale/partially updated.

## Recommendation
- Treat `.state/evaluations/` task_tree mtime staleness as **non-incident** unless DB lag grows.
- If we need an alert, key it off DB `evaluations.max(createdAt)` lag vs `sessions.max(startedAt)`.
