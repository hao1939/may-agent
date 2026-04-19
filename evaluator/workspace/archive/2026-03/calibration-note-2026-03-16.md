# Calibration note — 2026-03-16

## Heartbeat run @ 2026-03-16T20:48Z

### What changed / new signals
- Calibration feeds (`consistency-flags.jsonl`, `human-reviews.jsonl`, `re-evaluations.jsonl`) are empty (no new disagreements/flags to act on).
- `agents/shared/SIGNALS.md` is very large; head read shows multiple recent handoffs not addressed to Evaluator (mostly to tech-lead/may) and indicates the file will require chunked reads (`offset`/`limit`) for any targeted lookup.

### Actions taken
- Reconfirmed heartbeat constraint: calibration-only; do not evaluate sessions during heartbeat (C43).
- Reconfirmed that any SIGNALS review must avoid truncation errors by paging reads.

### Next calibration focus
- Page through `agents/shared/SIGNALS.md` searching specifically for entries where **To: evaluator** (use grep via bash) and then ACK/hand off properly.
- Consider whether evaluator needs a lightweight index/grep workflow for SIGNALS to avoid repeated truncation overhead.
