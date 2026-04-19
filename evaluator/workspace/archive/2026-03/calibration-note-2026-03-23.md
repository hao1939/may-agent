# Evaluator calibration — 2026-03-23

## Calibration inputs presence check
Attempted to read:
- `agents/evaluator/workspace/consistency-flags.jsonl` → ENOENT
- `agents/evaluator/workspace/human-reviews.jsonl` → ENOENT
- `agents/evaluator/workspace/re-evaluations.jsonl` → ENOENT

Evidence: tool `read()` returned ENOENT for each path in this session.

## Periodic task executed
Ran: `node agents/evaluator/skills/monitor-session.cjs --running`

Result (from tool output JSON):
- `sessionsChecked`: 15
- `healthy`: 15
- `unhealthy`: 0
- Summary: "All 15 running session(s) healthy."

## Notes
The repeated ENOENT suggests the calibration input files may have been renamed, moved, or are now generated elsewhere. The evaluator workspace currently contains `activity.jsonl` and various prior calibration notes (see `ls -la agents/evaluator/workspace`).
