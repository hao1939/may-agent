# Evaluator calibration note — 2026-03-27T12:33Z

## What I checked
- Workspace layout under `agents/evaluator/workspace/` (found that the expected `consistency-flags.jsonl` / `human-reviews.jsonl` are not in the workspace root; they exist (empty) under `agents/evaluator/workspace/archive/2026-03/`).
- Ran `node agents/evaluator/skills/monitor-session.cjs --running`.

## Findings / calibration
1) **Path expectation mismatch (minor process drift)**
   - Heartbeat instructions reference `agents/evaluator/workspace/consistency-flags.jsonl` and `.../human-reviews.jsonl`.
   - Actual files present at `agents/evaluator/workspace/archive/2026-03/{consistency-flags.jsonl,human-reviews.jsonl}` (both size 0).
   - Actionable calibration: when doing heartbeats, check `workspace/archive/YYYY-MM/` if root files are missing; avoid spending multiple reads on ENOENT.

2) **Monitor-session signal: extreme STALL prevalence**
   - `monitor-session --running` reported **37 unhealthy / 41 checked**, almost entirely `STALL` with idle times in the ~3000–3350 minute range.
   - This suggests `--running` is including very old session dirs; it may be more useful to filter by recency (e.g., “last activity within 24h”) to reduce alert fatigue. (Needs owner decision; do not change behavior here.)

## Evidence
- Workspace listing showed root files (no consistency/human review JSONLs) and archive location: `ls -la agents/evaluator/workspace` + `ls -la agents/evaluator/workspace/archive/2026-03`.
- Monitor output: `node agents/evaluator/skills/monitor-session.cjs --running` → exit code 1 and JSON listing 37 STALL + 1 NO_LOG.
