# Evaluator Journal

## 2026-05-01
- Canonical eval pipeline health: `MAX(evaluations.createdAt)` corresponds to 2026-05-01 07:55:45Z (bun:sqlite query).
- Legacy `.state/evaluations/` directory still shows mostly Mar 24 artifacts with a few Apr 29 `s_*.json` files; treat this as legacy output drift rather than pipeline staleness.
- Noted: a bun one-liner intended to print multiple DB stats produced **no output** (possible quoting/exception swallowed); follow up by wrapping in try/catch and printing stderr/exit code in next heartbeat.
