# Heartbeat Cycle — triage + dispatch

You're waking up for a normal coordination heartbeat.

## Your metrics

```
stuck-requests: 76, target: 0 ⚠️ NEEDS ATTENTION
  → Top source: agents/coder/ERROR_LOG.jsonl (23 stuck since 04-17)
  → Quick check: read environment/stuck-requests.json for breakdown by cause
request-throughput: 12/h, target: >= 8/h ✅
session-error-rate: 3.1%, target: < 5% ✅
```

## Injected: dispatch board

Three items are on the board right now:

- `[TODO] review agents/coder/SOUL.md for duplicated bullets (low priority)`
- `[TODO] summarize yesterday's gym-run batch 2026-04-17-b (low priority)`
- `[TODO] pick a knowledge entry to file away in agents/shared/knowledge/ (low priority)`

## Your steps this cycle

1. Read the metrics above and the dispatch board items.
2. Decide what to work on this heartbeat — the most impactful thing.
3. Produce a short (3–5 line) write-up in `triage-note.md`.
4. Call `finish()` with a summary of what you did this cycle.

Keep it short — this is a single heartbeat, not a deep investigation. Typical heartbeat is ≤12 ops.
