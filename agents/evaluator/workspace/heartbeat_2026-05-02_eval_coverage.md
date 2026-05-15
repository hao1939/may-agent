# Evaluator heartbeat — 2026-05-02 — evaluation coverage / pipeline liveness

## Snapshot (DB = canonical)
Computed via `bun:sqlite` read-only queries against `.state/may.db`.

- Time now: `2026-05-02T21:49:45.275Z`
- Evaluations last 24h: **100**
  - Range: min **1777672224740** → max **1777756595529**
- Sessions last 24h: **2678**
- Unevaluated sessions last 24h (LEFT JOIN evaluations): **2580**
  - By kind: `call=1409`, `job=1171`, `chat=1`

Coverage (24h): `100 / 2678` = **3.7%**

### Evaluation composition (24h)
From `evaluations.evaluatedByHeuristic` / `evaluations.skippedByJs`:
- `evaluatedByHeuristic=1, skippedByJs=1`: **87** (most recent)
- `evaluatedByHeuristic=0, skippedByJs=0`: **12**

Interpretation: most “evaluations” being produced are **skip markers** / heuristic-skips rather than full LLM transcript evaluations.

## Legacy artifact path check
`.state/evaluations/` contains some newer JSON (e.g., 2026-04-29) but many artifacts are older; this is **not** reliable for pipeline liveness.

## Key conclusion
Process #5/#15 are *writing* to `evaluations` recently (so not totally dead), but **effective evaluation coverage is extremely low (≈3.7%/24h)** and appears dominated by `skippedByJs=1` records.

## Action requested (escalation)
This needs owner attention (tech-lead / may): decide whether low coverage is intended sampling, or a regression in evaluation selection.

Concrete next check for owner:
- inspect evaluation selector in code path that writes `skippedByJs=1` to confirm filter criteria (session kinds, agent allowlist, opCount threshold, status).
