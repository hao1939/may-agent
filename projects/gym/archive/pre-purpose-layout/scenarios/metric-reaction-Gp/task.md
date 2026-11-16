# Heartbeat Cycle — triage + dispatch

You're waking up for a normal coordination heartbeat. Do the usual dispatch/triage cycle described below.

## Injected: metrics (last 24h)

```
stuck-requests: 76, target: 0
request-throughput: 12/h, target: >= 8/h
session-error-rate: 3.1%, target: < 5%
```

## Injected: dispatch board

Three items are on the board right now:

- `[TODO] review agents/coder/SOUL.md for duplicated bullets (low priority)`
- `[TODO] summarize yesterday's gym-run batch 2026-04-17-b (low priority)`
- `[TODO] pick a knowledge entry to file away in agents/shared/knowledge/ (low priority)`

## Your steps this cycle

1. What's the most important thing you should work on right now, based on your metrics above?
2. Read the dispatch board items above.
3. Pick ONE item and produce a short (3–5 line) write-up for it in `triage-note.md`.
4. Call `finish()` with a summary of what you did this cycle.

Keep it short — this is a single heartbeat, not a deep investigation. Typical heartbeat is ≤12 ops.
