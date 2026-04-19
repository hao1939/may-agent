# Evaluator calibration — 2026-03-27T20:33Z

## Calibration inputs path check
- `agents/evaluator/workspace/consistency-flags.jsonl`: **missing** (read returned ENOENT)
- `agents/evaluator/workspace/human-reviews.jsonl`: **missing** (read returned ENOENT)
- `agents/evaluator/workspace/re-evaluations.jsonl`: **missing** (read returned ENOENT)

Evidence: `ls -la agents/evaluator/workspace` shows only `activity.jsonl`, `archive/`, various `calibration-note-*`, `heartbeat-context.md`, and `journal.md`.

However, the canonical files **do exist** (currently 0 bytes) under:
- `agents/evaluator/workspace/archive/2026-03/consistency-flags.jsonl`
- `agents/evaluator/workspace/archive/2026-03/human-reviews.jsonl`
- `agents/evaluator/workspace/archive/2026-03/re-evaluations.jsonl`

Recommendation: either (a) symlink/copy the latest archived inputs into workspace root, or (b) adjust heartbeat/checklists to read from archive when root is absent.

## Periodic task run: monitor-session
Ran: `node agents/evaluator/skills/monitor-session.cjs --running`
Result: **37 unhealthy / 42 checked**, mostly `STALL` sessions idle for ~3500–3800 minutes; 1 `NO_LOG` (`s_1774413778093_1`).

Note: This pattern looks like historical sessions never cleaned up; the monitor tool correctly flags them but the signal-to-noise for active incident response is low.

## Change made
- Updated `agents/evaluator/periodic-tasks.md` “Last run” timestamp to **2026-03-27 20:33** for the monitor-session task.
