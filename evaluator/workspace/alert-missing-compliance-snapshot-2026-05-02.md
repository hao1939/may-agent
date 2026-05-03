# Alert: integrity patrol degraded (missing compliance snapshot)

- Date (UTC): 2026-05-02
- Detector: `node agents/evaluator/skills/patrol.cjs`
- Status: `CRITICAL` (degraded baseline, **not** a confirmed hash mismatch)

## Evidence
- `patrol.cjs` output: `Missing compliance-snapshot.json` (expects `agents/shared/compliance-snapshot.json`).

## Impact
- L3 integrity checks are currently unable to distinguish real integrity drift from missing-baseline condition.

## Requested action
- Owner: Bob (baseline snapshot source-of-truth)
- Create and commit `agents/shared/compliance-snapshot.json` (or update patrol to point to the correct canonical baseline if renamed).

## Notes
- This condition has been recurring in periodic runs (see `agents/evaluator/periodic-tasks.md`).
