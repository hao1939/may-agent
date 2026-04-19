# Calibration Note — 2026-04-10T04:24Z

## Process ownership check
- **DB canonical is live**: `.state/may.db` has table `evaluations`; `max(evaluations.createdAt)=1775793833413` (see tool output in heartbeat).
- **Legacy artifacts are stale**: `.state/evaluations/` newest mtime observed remains **2026-03-24** → treat as legacy-output-path drift, not pipeline failure.
- **LLM eval (#15) appears disabled/unimplemented**: DB table inventory shows **no** `llm_evaluations` (consistent with prior heartbeat notes).

## Calibration / signal quality
- `workspace/{consistency-flags,human-reviews,re-evaluations}.jsonl` are symlinks to `archive/2026-03/*` and are currently **empty (0 lines)**, so there is no recent human disagreement signal to calibrate against.
- Ran `monitor-session.cjs --running`: **8 checked, 8 healthy**. This remains a low-noise runtime anomaly detector.

## Follow-ups
- Consider creating a fresh (non-empty) April calibration log sink (or updating the symlink targets) so consistency/human-review signals are not silently absent.
- Long-standing infra issue remains: missing `agents/shared/compliance-snapshot.json` baseline keeps `patrol.cjs` CRITICAL (known degraded mode).
